import type express from 'express';
import {
  normalizeServerRole,
  resolveEffectiveServerRole,
  resolveRecordCanonicalRole,
} from '../../core/security/serverRbacPolicy';
import {
  extractServerSessionToken,
  signServerSession,
  verifyAccountCredentials,
  verifyServerSession,
} from '../../core/security/serverSession';
import type {
  GmaoApiRequest,
  GmaoDbState,
  LoginThrottleEntry,
  ServerRecord,
  ServerSessionStore,
  SessionSecretResolution,
} from '../types';

function isRecordArchived(item: unknown): boolean {
  if (!item || typeof item !== 'object') return false;
  const rec = item as ServerRecord;
  const statut = String(rec.statut || '').trim().toUpperCase();
  const status = String(rec.status || '').trim().toUpperCase();
  return (
    rec.is_active === false ||
    rec.actif === false ||
    rec.isActive === false ||
    statut === 'ARCHIVE' ||
    statut === 'ARCHIVEE' ||
    status === 'ARCHIVE' ||
    status === 'ARCHIVEE'
  );
}

function getArrayCollection(dbState: GmaoDbState, key: string): ServerRecord[] {
  const val = dbState[key];
  return Array.isArray(val) ? (val as ServerRecord[]) : [];
}

/**
 * Mounts server-side authentication, session rotation, revocation, and admin security telemetry routes:
 *  - `POST /api/gmao/auth/login`
 *  - `POST /api/gmao/auth/refresh`
 *  - `POST /api/gmao/auth/logout`
 *  - `GET /api/gmao/security/telemetry`
 */
export function mountAuthRoutes(
  app: express.Application,
  deps: {
    dbState: GmaoDbState;
    sessionStore: ServerSessionStore;
    loginThrottleMap: Map<string, LoginThrottleEntry>;
    isProduction: boolean;
    getSessionSecretInfo: () => SessionSecretResolution;
  }
): void {
  const { dbState, sessionStore, loginThrottleMap, isProduction, getSessionSecretInfo } = deps;

  const findLoginAccountRecord = (
    rawIdentifier: string
  ): { record: ServerRecord; source: 'authAccounts' | 'users' | 'technicians' } | null => {
    const clean = String(rawIdentifier || '').trim().toLowerCase();
    if (!clean) return null;

    const matchRecord = (item: unknown, allowMagasinAlias: boolean): boolean => {
      if (!item || typeof item !== 'object') return false;
      const rec = item as ServerRecord;
      const candidates = [
        rec.id,
        rec.code,
        rec.username,
        rec.personnelId,
        rec.id_technician,
        rec.id_operation,
      ]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
      if (candidates.includes(clean)) return true;
      if (allowMagasinAlias && (clean === 'rmg' || clean === 'magasin')) {
        return candidates.includes('magasinier') || candidates.includes('resp-04');
      }
      return false;
    };

    const authAccounts = getArrayCollection(dbState, 'authAccounts');
    const matchedAuth = authAccounts.find((a) => matchRecord(a, true));
    if (matchedAuth) return { record: matchedAuth, source: 'authAccounts' };

    const users = getArrayCollection(dbState, 'users');
    const matchedUser = users.find((u) => matchRecord(u, true));
    if (matchedUser) return { record: matchedUser, source: 'users' };

    const techs = getArrayCollection(dbState, 'technicians');
    const matchedTech = techs.find((t) => matchRecord(t, false));
    if (matchedTech) return { record: matchedTech, source: 'technicians' };

    return null;
  };

  const isAccountOrLinkedProfileArchived = (record: ServerRecord): boolean => {
    if (isRecordArchived(record)) return true;
    const pid = String(record.personnelId || '').trim().toUpperCase();
    if (!pid) return false;
    const linkedUsers = getArrayCollection(dbState, 'users');
    const linkedTechs = getArrayCollection(dbState, 'technicians');
    const linked = [...linkedUsers, ...linkedTechs].find((entry) =>
      [entry.id, entry.id_technician, entry.id_operation, entry.code]
        .map((v) => String(v || '').trim().toUpperCase())
        .includes(pid)
    );
    return linked ? isRecordArchived(linked) : false;
  };

  app.post('/api/gmao/auth/login', (req, res) => {
    const secretInfo = getSessionSecretInfo();
    if (secretInfo.missingInProduction) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        code: 'SERVER_SESSION_SECRET_REQUIRED',
        message:
          'Configuration sécurité production invalide : GMAO_SESSION_SECRET fort (>= 16 caractères) est requis.',
      });
    }

    const body = (req.body || {}) as ServerRecord;
    const rawIdentifier = String(body.identifier || body.actorId || body.username || '').trim();
    const rawPassword = String(body.password || '').trim();

    if (!rawIdentifier || !rawPassword) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Identifier and password are required.',
      });
    }

    const clientIp = req.socket?.remoteAddress || req.ip || 'unknown';
    const throttleKey = `${clientIp}::${rawIdentifier.toLowerCase()}`;
    const nowMs = Date.now();
    const throttleEntry = loginThrottleMap.get(throttleKey);
    if (throttleEntry && throttleEntry.lockUntil > nowMs) {
      sessionStore.recordSecurityEvent('LOGIN_THROTTLED', {
        actorId: rawIdentifier,
        ip: String(clientIp),
        detail: 'Rate limit lock active on /auth/login',
      });
      res.setHeader('Retry-After', '900');
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Trop de tentatives de connexion échouées. Réessayez plus tard.',
      });
    }

    const found = findLoginAccountRecord(rawIdentifier);
    if (!found) {
      const nextFailures = (throttleEntry?.failures || 0) + 1;
      loginThrottleMap.set(throttleKey, {
        failures: nextFailures,
        lockUntil: nextFailures >= 10 ? nowMs + 15 * 60 * 1000 : 0,
        resetAt: nowMs + 15 * 60 * 1000,
      });
      sessionStore.recordSecurityEvent('LOGIN_FAIL', {
        actorId: rawIdentifier,
        ip: String(clientIp),
        detail: 'Unknown account identifier',
      });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiant ou mot de passe incorrect.',
      });
    }

    if (isAccountOrLinkedProfileArchived(found.record)) {
      sessionStore.recordSecurityEvent('LOGIN_FAIL', {
        actorId: rawIdentifier,
        ip: String(clientIp),
        detail: 'Archived account blocked',
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'ACTOR_ARCHIVED',
        message: 'Ce compte ou profil est désactivé/archivé.',
      });
    }

    const credCheck = verifyAccountCredentials(found.record, rawPassword, isProduction);
    if (!credCheck.valid) {
      if (credCheck.reason === 'PROHIBITED_DEFAULT_PASSWORD_IN_PROD') {
        sessionStore.recordSecurityEvent('LOGIN_FAIL', {
          actorId: rawIdentifier,
          ip: String(clientIp),
          detail: 'Default bootstrap password rejected in production',
        });
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          code: 'PROHIBITED_DEFAULT_PASSWORD_IN_PROD',
          message: 'Default bootstrap passwords are disabled in production.',
        });
      }
      const nextFailures = (throttleEntry?.failures || 0) + 1;
      loginThrottleMap.set(throttleKey, {
        failures: nextFailures,
        lockUntil: nextFailures >= 10 ? nowMs + 15 * 60 * 1000 : 0,
        resetAt: nowMs + 15 * 60 * 1000,
      });
      sessionStore.recordSecurityEvent('LOGIN_FAIL', {
        actorId: rawIdentifier,
        ip: String(clientIp),
        detail: 'Invalid password',
      });
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiant ou mot de passe incorrect.',
      });
    }

    loginThrottleMap.delete(throttleKey);

    const canonicalSub = String(
      found.record.personnelId ||
        found.record.id_technician ||
        found.record.id_operation ||
        found.record.id ||
        found.record.code ||
        found.record.username
    ).trim();
    const canonicalRole = resolveRecordCanonicalRole(
      found.record,
      found.source === 'technicians' ? 'TECHNICIEN' : 'VIEWER'
    );
    const displayName = String(
      found.record.name || found.record.nom || found.record.username || canonicalSub
    ).trim();

    const issued = signServerSession(
      {
        sub: canonicalSub,
        role: canonicalRole,
        name: displayName,
      },
      secretInfo.secret
    );

    sessionStore.registerIssuedSession({
      sub: issued.payload.sub,
      role: issued.payload.role,
      sid: issued.payload.sid,
      iat: issued.payload.iat,
      exp: issued.payload.exp,
      ip: String(clientIp),
    });
    sessionStore.recordSecurityEvent('LOGIN_SUCCESS', {
      actorId: issued.payload.sub,
      ip: String(clientIp),
      detail: `role=${issued.payload.role}`,
    });

    return res.json({
      success: true,
      token: issued.token,
      expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
      expiresIn: issued.payload.exp - issued.payload.iat,
      mustChangePassword: Boolean(credCheck.isDefaultSeed),
      actor: {
        sub: issued.payload.sub,
        role: issued.payload.role,
        name: issued.payload.name,
      },
    });
  });

  app.post('/api/gmao/auth/refresh', (req, res) => {
    const secretInfo = getSessionSecretInfo();
    if (secretInfo.missingInProduction) {
      return res.status(503).json({
        success: false,
        error: 'Service Unavailable',
        code: 'SERVER_SESSION_SECRET_REQUIRED',
        message:
          'Configuration sécurité production invalide : GMAO_SESSION_SECRET fort (>= 16 caractères) est requis.',
      });
    }

    const body = (req.body || {}) as ServerRecord;
    const token =
      extractServerSessionToken(req.headers as Record<string, unknown>) ||
      String(body.token || '').trim();
    if (!token) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'SERVER_SESSION_REQUIRED',
        message: 'Server session token is required for refresh.',
      });
    }

    const clientIp = req.socket?.remoteAddress || req.ip || 'unknown';
    const verified = verifyServerSession(token, secretInfo.secret, {
      revokedSessionIds: sessionStore.revokedSessionIds,
    });

    if (!verified.valid || !verified.payload) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'SERVER_SESSION_INVALID',
        reason: verified.reason || 'INVALID_SIGNATURE',
        message: 'Server session token is invalid, expired, or revoked.',
      });
    }

    const currentPayload = verified.payload;
    const liveActor = resolveEffectiveServerRole(
      {
        'x-gmao-actor-id': currentPayload.sub,
        'x-gmao-actor': currentPayload.name,
      },
      getArrayCollection(dbState, 'users'),
      getArrayCollection(dbState, 'technicians'),
      getArrayCollection(dbState, 'authAccounts')
    );

    if (liveActor.isArchivedActor || liveActor.identityStatus === 'ARCHIVED') {
      sessionStore.revokeSession(currentPayload.sid, currentPayload.exp, {
        sub: currentPayload.sub,
        ip: String(clientIp),
        detail: 'Revoked on refresh: actor archived',
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'ACTOR_ARCHIVED',
        message: 'Actor profile is archived/inactive and cannot refresh session.',
      });
    }

    if (liveActor.identityStatus !== 'VERIFIED') {
      sessionStore.revokeSession(currentPayload.sid, currentPayload.exp, {
        sub: currentPayload.sub,
        ip: String(clientIp),
        detail: 'Revoked on refresh: actor unregistered',
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'SERVER_SESSION_ACTOR_UNREGISTERED',
        message: 'Authenticated session actor is no longer active in server registry.',
      });
    }

    const liveRole = normalizeServerRole(liveActor.effectiveRole);
    const tokenRole = normalizeServerRole(currentPayload.role);
    if (liveRole !== tokenRole) {
      sessionStore.revokeSession(currentPayload.sid, currentPayload.exp, {
        sub: currentPayload.sub,
        ip: String(clientIp),
        detail: `Revoked on refresh: role changed (${tokenRole} -> ${liveRole})`,
      });
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'SERVER_SESSION_ROLE_CHANGED',
        message: 'User registry role changed; re-authentication required.',
      });
    }

    const issued = signServerSession(
      {
        sub: currentPayload.sub,
        role: liveRole,
        name: liveActor.actorName || currentPayload.name,
      },
      secretInfo.secret
    );

    sessionStore.rotateSession({
      oldSid: currentPayload.sid,
      oldExp: currentPayload.exp,
      sub: issued.payload.sub,
      role: issued.payload.role,
      newSid: issued.payload.sid,
      newIat: issued.payload.iat,
      newExp: issued.payload.exp,
      ip: String(clientIp),
    });

    return res.json({
      success: true,
      token: issued.token,
      expiresAt: new Date(issued.payload.exp * 1000).toISOString(),
      expiresIn: issued.payload.exp - issued.payload.iat,
      actor: {
        sub: issued.payload.sub,
        role: issued.payload.role,
        name: issued.payload.name,
      },
    });
  });

  app.post('/api/gmao/auth/logout', (req, res) => {
    const body = (req.body || {}) as ServerRecord;
    const token =
      extractServerSessionToken(req.headers as Record<string, unknown>) ||
      String(body.token || '').trim();
    if (token) {
      const secretInfo = getSessionSecretInfo();
      if (secretInfo.secret) {
        const verified = verifyServerSession(token, secretInfo.secret);
        if (verified.payload?.sid) {
          sessionStore.revokeSession(verified.payload.sid, verified.payload.exp, {
            sub: verified.payload.sub,
            ip: String(req.socket?.remoteAddress || req.ip || 'unknown'),
            detail: 'Explicit user logout',
          });
        }
      }
    }
    return res.json({ success: true });
  });

  app.get('/api/gmao/security/telemetry', (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const resolvedActor = gmaoReq.resolvedServerActor;
    const role = normalizeServerRole(resolvedActor?.effectiveRole);
    if (!resolvedActor?.sessionVerified || role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'ADMIN verified server session required for security telemetry.',
      });
    }
    return res.json({
      success: true,
      data: sessionStore.getTelemetrySnapshot(),
    });
  });
}
