import type express from 'express';
import {
  ADMIN_ONLY_ENTITIES,
  CATALOG_PROTECTED_ENTITIES,
  canRoleMutateEntity,
  evaluateBootstrapWriteAllowance,
  evaluateServerApiTokenGuard,
  getRolePrivilegeRank,
  isLoopbackRemoteAddress,
  isRegistryInitialized,
  isWeakOrEmptyApiToken,
  normalizeServerRole,
  resolveEffectiveServerRole,
} from '../../core/security/serverRbacPolicy';
import {
  extractServerSessionToken,
  verifyServerSession,
} from '../../core/security/serverSession';
import { constantTimeEqual } from '../../core/security/nativeCrypto';
import { serverLogger } from '../serverLogger';
import type {
  GmaoApiRequest,
  GmaoDbState,
  ServerSessionStore,
  SessionSecretResolution,
  SseTicketEntry,
} from '../types';

/**
 * Factory creating the fail-closed API authentication and RBAC enforcement middleware.
 *
 * Enforces:
 *  - Single-use IP-bound SSE stream tickets on `GET /api/gmao/events`
 *  - API token check via `evaluateServerApiTokenGuard`
 *  - Signed HMAC server session validation and minimum-privilege role clamping
 *  - Protected read guards (`audit`, `auditevents`, `authaccounts`, `users`, `security/telemetry`, `/api/network/info`)
 *  - Initial empty-registry bootstrap gating and entity-level RBAC write/delete guards
 */
export function createAuthenticateApiMiddleware(deps: {
  dbState: GmaoDbState;
  sessionStore: ServerSessionStore;
  sseTickets: Map<string, SseTicketEntry>;
  isProduction: boolean;
  getSessionSecretInfo: () => SessionSecretResolution;
}): express.RequestHandler {
  const { dbState, sessionStore, sseTickets, isProduction, getSessionSecretInfo } = deps;

  return (req, res, next) => {
    const gmaoReq = req as GmaoApiRequest;
    const token = req.headers['x-gmao-api-token'];
    const clientOrigin = req.headers['x-gmao-client-origin'];
    const expectedToken = process.env.GMAO_API_TOKEN;
    const remoteAddress = req.socket?.remoteAddress;
    const normalizedPath = String(req.path || '').toLowerCase();

    // SSE stream (EventSource cannot attach custom headers): validate & consume single-use ticket
    if (req.baseUrl === '/api/gmao' && req.method === 'GET' && normalizedPath === '/events') {
      const rawTicket = typeof req.query?.ticket === 'string' ? req.query.ticket.trim() : '';
      if (rawTicket) {
        const ticketEntry = sseTickets.get(rawTicket);
        sseTickets.delete(rawTicket);
        const remoteIpStr = String(remoteAddress || 'unknown');
        const ipMatches =
          ticketEntry &&
          (ticketEntry.ip === remoteIpStr ||
            (isLoopbackRemoteAddress(ticketEntry.ip) && isLoopbackRemoteAddress(remoteIpStr)));
        if (!ticketEntry || Date.now() > ticketEntry.exp || !ipMatches) {
          return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            code: 'SSE_TICKET_INVALID',
            message: 'SSE connection ticket is invalid or expired.',
          });
        }
        gmaoReq.sseTicketActor = ticketEntry;
        return next();
      }
    }

    const tokenGuard = evaluateServerApiTokenGuard({
      method: req.method,
      providedToken: token,
      expectedToken,
      clientOrigin,
      isProduction,
      strictTokenEnv: process.env.GMAO_STRICT_TOKEN,
    });

    if (!tokenGuard.allowed) {
      return res.status(tokenGuard.statusCode || 401).json({
        success: false,
        error: tokenGuard.error || 'Unauthorized',
        message: tokenGuard.message || 'API Token invalide ou manquant.',
      });
    }

    if (
      req.baseUrl === '/api/gmao' &&
      req.method === 'POST' &&
      (normalizedPath === '/auth/login' ||
        normalizedPath === '/auth/logout' ||
        normalizedPath === '/auth/refresh')
    ) {
      return next();
    }

    const rawExpected = typeof expectedToken === 'string' ? expectedToken.trim() : '';
    const rawProvided = typeof token === 'string' ? token.trim() : '';
    const hasValidStrongToken =
      !isWeakOrEmptyApiToken(rawExpected) && constantTimeEqual(rawProvided, rawExpected);

    const dbUsers = Array.isArray(dbState.users) ? dbState.users : [];
    const dbTechnicians = Array.isArray(dbState.technicians) ? dbState.technicians : [];
    const dbAuthAccounts = Array.isArray(dbState.authAccounts) ? dbState.authAccounts : [];

    const registryInitialized = isRegistryInitialized(dbUsers, dbTechnicians, dbAuthAccounts);
    const serverSessionToken = extractServerSessionToken(req.headers as Record<string, unknown>);

    let resolvedActor: ReturnType<typeof resolveEffectiveServerRole> & {
      sessionVerified?: boolean;
    } = resolveEffectiveServerRole(
      req.headers as Record<string, unknown>,
      dbUsers,
      dbTechnicians,
      dbAuthAccounts
    );

    if (serverSessionToken) {
      const secretInfo = getSessionSecretInfo();
      if (secretInfo.missingInProduction) {
        return res.status(503).json({
          success: false,
          error: 'Service Unavailable',
          code: 'SERVER_SESSION_SECRET_REQUIRED',
          message:
            'Sécurité Production : GMAO_SESSION_SECRET fort (>= 16 caractères) est requis pour valider les sessions.',
        });
      }
      const verifiedSession = verifyServerSession(serverSessionToken, secretInfo.secret, {
        revokedSessionIds: sessionStore.revokedSessionIds,
      });

      if (!verifiedSession.valid || !verifiedSession.payload) {
        serverLogger.warn(
          `[Server][SEC-LAN-P1] Rejected ${verifiedSession.reason || 'INVALID'} server session on ${req.method} ${req.originalUrl} (ip="${remoteAddress || 'unknown'}")`
        );
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          code: 'SERVER_SESSION_INVALID',
          reason: verifiedSession.reason || 'INVALID_SIGNATURE',
          message: 'Server session token is invalid, expired, or revoked.',
        });
      }

      const sessionPayload = verifiedSession.payload;
      const claimedActorIdHeader = String(req.headers['x-gmao-actor-id'] || '').trim();
      const actorIdMismatch =
        Boolean(claimedActorIdHeader) &&
        claimedActorIdHeader.toUpperCase() !== sessionPayload.sub.toUpperCase();

      const liveActor: typeof resolvedActor = resolveEffectiveServerRole(
        {
          'x-gmao-actor-id': sessionPayload.sub,
          'x-gmao-actor': sessionPayload.name,
          'x-gmao-role': req.headers['x-gmao-role'] || sessionPayload.role,
        },
        dbUsers,
        dbTechnicians,
        dbAuthAccounts
      );

      if (
        getRolePrivilegeRank(liveActor.effectiveRole) >
        getRolePrivilegeRank(sessionPayload.role)
      ) {
        liveActor.effectiveRole = normalizeServerRole(sessionPayload.role);
        liveActor.roleSpoofDetected = true;
      }
      if (actorIdMismatch) {
        liveActor.roleSpoofDetected = true;
      }
      liveActor.sessionVerified = true;
      resolvedActor = liveActor;
      gmaoReq.serverSessionPayload = sessionPayload;

      if (resolvedActor.isArchivedActor || resolvedActor.identityStatus === 'ARCHIVED') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          code: 'ACTOR_ARCHIVED',
          message: 'Actor profile is archived/inactive and cannot access server state.',
        });
      }

      if (resolvedActor.identityStatus !== 'VERIFIED') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          code: 'SERVER_SESSION_ACTOR_UNREGISTERED',
          message: 'Authenticated session actor is not active in the server registry.',
        });
      }
    } else {
      resolvedActor.sessionVerified = false;
    }

    gmaoReq.resolvedServerActor = resolvedActor;

    if (resolvedActor.roleSpoofDetected) {
      sessionStore.recordSecurityEvent('SPOOF_DETECTED', {
        actorId: resolvedActor.actorId,
        ip: typeof remoteAddress === 'string' ? remoteAddress : undefined,
        detail: `claimed=${resolvedActor.claimedRole}, resolved=${resolvedActor.effectiveRole}`,
      });
      serverLogger.warn(
        `[Server][SEC-LAN-P1] Role spoof or unverified privilege/actor claim detected: actorId="${resolvedActor.actorId || 'none'}", actor="${resolvedActor.actorName}", claimed="${resolvedActor.claimedRole}", resolved="${resolvedActor.effectiveRole}", status="${resolvedActor.identityStatus}", sessionVerified=${Boolean(resolvedActor.sessionVerified)}, ip="${remoteAddress || 'unknown'}"`
      );
    }

    if (resolvedActor.isArchivedActor || resolvedActor.identityStatus === 'ARCHIVED') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Actor profile is archived/inactive and cannot access server state.',
      });
    }

    if (req.baseUrl === '/api/gmao' && req.method === 'POST' && normalizedPath === '/events/ticket') {
      const canIssueTicket =
        Boolean(resolvedActor.sessionVerified) ||
        (!registryInitialized &&
          (hasValidStrongToken || (!isProduction && isLoopbackRemoteAddress(remoteAddress))));
      if (!canIssueTicket) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          code: 'SERVER_SESSION_REQUIRED',
          message: 'Authenticated server session required to subscribe to live SSE events.',
        });
      }
      return next();
    }

    if (req.method === 'GET') {
      const hasClientContext =
        Boolean(resolvedActor.sessionVerified) ||
        clientOrigin === 'gmao-web-client' ||
        Boolean(req.headers['x-gmao-actor-id']) ||
        Boolean(req.headers['x-gmao-actor']) ||
        Boolean(req.headers['x-gmao-role']) ||
        Boolean(rawExpected && constantTimeEqual(rawProvided, rawExpected));
      if (!hasClientContext) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Client non identifié pour la lecture LAN (/api/gmao/*).',
        });
      }

      const fullPath = `${req.baseUrl || ''}${req.path || ''}`.toLowerCase();
      const isSensitiveRead =
        fullPath === '/api/network/info' ||
        fullPath === '/api/gmao/audit' ||
        fullPath === '/api/gmao/auditevents' ||
        fullPath === '/api/gmao/users' ||
        fullPath === '/api/gmao/authaccounts' ||
        fullPath === '/api/gmao/security/telemetry';

      if (resolvedActor.identityStatus === 'UNKNOWN' && registryInitialized) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Unrecognized actor identity is not authorized for API reads.',
        });
      }

      if (isSensitiveRead && !resolvedActor.sessionVerified) {
        const allowBootstrapRead =
          !registryInitialized &&
          fullPath !== '/api/gmao/security/telemetry' &&
          (hasValidStrongToken || (!isProduction && isLoopbackRemoteAddress(remoteAddress)));
        if (!allowBootstrapRead) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            code: 'SERVER_SESSION_REQUIRED',
            message: `Verified server session required for '${fullPath}'.`,
          });
        }
      }

      if (
        resolvedActor.sessionVerified &&
        (fullPath === '/api/gmao/audit' ||
          fullPath === '/api/gmao/auditevents' ||
          fullPath === '/api/gmao/authaccounts')
      ) {
        const readRole = normalizeServerRole(resolvedActor.effectiveRole);
        if (readRole !== 'ADMIN' && readRole !== 'RESPONSABLE_MAINTENANCE') {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: `Role '${readRole}' is not authorized to read sensitive endpoint '${fullPath}'.`,
          });
        }
      }

      return next();
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const pathParts = req.path.split('/').filter(Boolean);
      const targetEntity = pathParts[0] || '';

      if (!resolvedActor.sessionVerified) {
        if (!registryInitialized) {
          const bootstrapCheck = evaluateBootstrapWriteAllowance({
            method: req.method,
            targetEntity,
            dbUsers,
            dbTechnicians,
            dbAuthAccounts,
            remoteAddress,
            providedToken: token,
            expectedToken,
            isProduction,
          });

          if (!bootstrapCheck.allowed) {
            serverLogger.warn(
              `[Server][SEC-LAN-P0] Blocked unverified ${req.method} ${req.originalUrl}: status=${resolvedActor.identityStatus}, actorId="${resolvedActor.actorId || 'none'}", reason="${bootstrapCheck.reason}"`
            );
            return res.status(403).json({
              success: false,
              error: 'Forbidden',
              message:
                bootstrapCheck.reason ||
                'Unverified or anonymous actor cannot modify server state.',
            });
          }

          gmaoReq.isBootstrapAuthorized = true;
          serverLogger.warn(
            `[Server][SEC-LAN-P0][BOOTSTRAP] Permitted initial ${req.method} on '${targetEntity}' while user/technician registries are empty (ip="${remoteAddress || 'unknown'}").`
          );
          return next();
        }

        if (getSessionSecretInfo().missingInProduction) {
          return res.status(503).json({
            success: false,
            error: 'Service Unavailable',
            code: 'SERVER_SESSION_SECRET_REQUIRED',
            message:
              'Sécurité Production : GMAO_SESSION_SECRET fort (>= 16 caractères) est requis pour les opérations d’écriture.',
          });
        }

        sessionStore.recordSecurityEvent('UNAUTHORIZED_WRITE_BLOCKED', {
          actorId: resolvedActor.actorId,
          ip: typeof remoteAddress === 'string' ? remoteAddress : undefined,
          detail: `${req.method} ${req.path} without session token`,
        });

        serverLogger.warn(
          `[Server][SEC-LAN-P1] Blocked header-only ${req.method} ${req.originalUrl} without server session token (actorId="${resolvedActor.actorId || 'none'}", status=${resolvedActor.identityStatus}, ip="${remoteAddress || 'unknown'}")`
        );
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          code: 'SERVER_SESSION_REQUIRED',
          message: 'Authenticated server session token required for write operations.',
        });
      }

      const role = normalizeServerRole(resolvedActor.effectiveRole);

      if (role === 'VIEWER') {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Role VIEWER or unauthenticated actor is read-only and cannot modify server state.',
        });
      }

      if (targetEntity && targetEntity !== 'state' && targetEntity !== 'audit') {
        if (
          ADMIN_ONLY_ENTITIES.has(targetEntity) &&
          role !== 'ADMIN' &&
          role !== 'RESPONSABLE_MAINTENANCE'
        ) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: `Role '${role}' is not authorized to modify administrative entity '${targetEntity}'.`,
          });
        }
        if (
          req.method === 'DELETE' &&
          CATALOG_PROTECTED_ENTITIES.has(targetEntity) &&
          (role === 'TECHNICIEN' || role === 'OPERATEUR')
        ) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: `Role '${role}' is not authorized to delete records from '${targetEntity}'.`,
          });
        }
        const entityGuard = canRoleMutateEntity(role, targetEntity, req.method);
        if (!entityGuard.allowed) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message:
              entityGuard.reason || `Role '${role}' is not authorized to modify '${targetEntity}'.`,
          });
        }
      }
    }

    return next();
  };
}
