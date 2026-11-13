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
  setClientServerSessionToken,
} from './serverSession';

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

    if (response.status === 401 || response.status === 403) {
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
