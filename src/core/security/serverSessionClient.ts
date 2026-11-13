/**
 * Store-free LAN Server Session HTTP Client (SEC-LAN-P1)
 *
 * Handles `/api/gmao/auth/login` and `/api/gmao/auth/logout` without importing
 * Zustand stores or DataGateway, keeping `AuthContext` decoupled from store bootstrap.
 */

import { networkConfigService } from '../../services/networkConfigService';
import {
  clearClientServerSessionToken,
  getClientServerSessionToken,
  parseServerSessionPayloadUnsafe,
  setClientServerSessionToken,
} from './serverSession';

export const DEFAULT_SESSION_REFRESH_MARGIN_SECONDS = 25 * 60; // 25 minutes before exp

export interface ServerSessionAuthResult {
  success: boolean;
  offline?: boolean;
  status?: number;
  code?: string;
  token?: string;
  expiresAt?: string;
  actor?: { sub: string; role: string; name: string };
  error?: string;
}

let inFlightRefreshPromise: Promise<ServerSessionAuthResult> | null = null;

export async function authenticateServerSession(
  identifier: string,
  password: string
): Promise<ServerSessionAuthResult> {
  const cleanId = String(identifier || '').trim();
  const cleanPass = String(password || '').trim();
  if (!cleanId || !cleanPass) {
    return { success: false, status: 400, error: 'Identifiant et mot de passe requis.' };
  }

  try {
    const response = await fetch(networkConfigService.resolveApiUrl('/api/gmao/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-gmao-client-origin': 'gmao-web-client',
      },
      body: JSON.stringify({ identifier: cleanId, password: cleanPass }),
    });

    if (response.status === 401 || response.status === 403 || response.status === 503) {
      clearClientServerSessionToken();
      const errJson = await response.json().catch(() => ({}));
      const errorMsg = errJson?.message || 'Authentification serveur refusée.';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('gmao:server_session_rejected', {
            detail: { status: response.status, code: errJson?.code, error: errorMsg },
          })
        );
      }
      return {
        success: false,
        offline: false,
        status: response.status,
        code: errJson?.code,
        error: errorMsg,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        offline: true,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }

    const json = await response.json();
    if (!json?.token) {
      clearClientServerSessionToken();
      return {
        success: false,
        offline: false,
        error: 'Réponse serveur invalide (jeton de session manquant).',
      };
    }

    setClientServerSessionToken(json.token);
    return {
      success: true,
      offline: false,
      status: response.status,
      token: json.token,
      expiresAt: json.expiresAt,
      actor: json.actor,
    };
  } catch {
    return {
      success: false,
      offline: true,
      error: 'Serveur LAN inaccessible pour la session distante.',
    };
  }
}

export async function refreshServerSession(): Promise<ServerSessionAuthResult> {
  if (inFlightRefreshPromise) {
    return inFlightRefreshPromise;
  }

  const currentToken = getClientServerSessionToken();
  if (!currentToken) {
    return {
      success: false,
      offline: false,
      status: 403,
      code: 'SERVER_SESSION_REQUIRED',
      error: 'Aucune session serveur active à renouveler.',
    };
  }

  inFlightRefreshPromise = (async (): Promise<ServerSessionAuthResult> => {
    try {
      const response = await fetch(networkConfigService.resolveApiUrl('/api/gmao/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-gmao-client-origin': 'gmao-web-client',
          Authorization: `Bearer ${currentToken}`,
          'X-GMAO-SESSION': currentToken,
        },
      });

      if (response.status === 401 || response.status === 403 || response.status === 503) {
        clearClientServerSessionToken();
        const errJson = await response.json().catch(() => ({}));
        const errorMsg = errJson?.message || 'Session serveur expirée ou révoquée.';
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gmao:server_session_expired', {
              detail: { status: response.status, code: errJson?.code, message: errorMsg },
            })
          );
        }
        return {
          success: false,
          offline: false,
          status: response.status,
          code: errJson?.code,
          error: errorMsg,
        };
      }

      if (!response.ok) {
        return {
          success: false,
          offline: true,
          status: response.status,
          error: `HTTP ${response.status}`,
        };
      }

      const json = await response.json();
      if (!json?.token) {
        clearClientServerSessionToken();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('gmao:server_session_expired', {
              detail: { status: 403, code: 'SERVER_SESSION_INVALID', message: 'Jeton de rafraîchissement manquant.' },
            })
          );
        }
        return {
          success: false,
          offline: false,
          error: 'Réponse serveur invalide (jeton de session manquant).',
        };
      }

      setClientServerSessionToken(json.token);
      return {
        success: true,
        offline: false,
        status: response.status,
        token: json.token,
        expiresAt: json.expiresAt,
        actor: json.actor,
      };
    } catch {
      return {
        success: false,
        offline: true,
        error: 'Serveur LAN inaccessible pour le renouvellement de session.',
      };
    } finally {
      inFlightRefreshPromise = null;
    }
  })();

  return inFlightRefreshPromise;
}

/**
 * Silently refreshes the server session token when remaining lifetime is within `marginSeconds`.
 * Fail-closed on 401/403 (clears token & emits `gmao:server_session_expired`, never falls back to headers).
 */
export async function ensureFreshServerSession(
  marginSeconds = DEFAULT_SESSION_REFRESH_MARGIN_SECONDS,
  nowSec = Math.floor(Date.now() / 1000)
): Promise<ServerSessionAuthResult | null> {
  const token = getClientServerSessionToken();
  if (!token) return null;

  const payload = parseServerSessionPayloadUnsafe(token);
  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }

  const remaining = payload.exp - nowSec;
  if (remaining > marginSeconds) {
    return { success: true, token };
  }

  return refreshServerSession();
}

export async function revokeServerSession(): Promise<void> {
  const token = getClientServerSessionToken();
  clearClientServerSessionToken();
  if (!token) return;
  try {
    await fetch(networkConfigService.resolveApiUrl('/api/gmao/auth/logout'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-gmao-client-origin': 'gmao-web-client',
        Authorization: `Bearer ${token}`,
        'X-GMAO-SESSION': token,
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    // ignore offline logout failure
  }
}
