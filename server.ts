import express from 'express';
import cors from 'cors';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec, swaggerUiOptions } from './src/config/swaggerConfig';
import { mergeEntityCollection, mergeGmaoStateSnapshot } from './src/services/lanStateMergeService';
import {
  ADMIN_ONLY_ENTITIES,
  CATALOG_PROTECTED_ENTITIES,
  normalizeServerRole,
  resolveEffectiveServerRole,
  canRoleMutateEntity,
  sanitizeBulkStateForRole,
  isWeakOrEmptyApiToken,
  evaluateServerApiTokenGuard,
  evaluateBootstrapWriteAllowance,
  isLoopbackRemoteAddress,
  isAllowedCorsOrigin,
  isRegistryInitialized,
  getRolePrivilegeRank,
  resolveRecordCanonicalRole,
} from './src/core/security/serverRbacPolicy';
import {
  resolveServerSessionSecret,
  signServerSession,
  verifyServerSession,
  extractServerSessionToken,
  verifyAccountCredentials,
  stripSensitiveAccountFields,
  sanitizeStateSnapshotForTransport,
} from './src/core/security/serverSession';
import { randomBytesHex } from './src/core/security/nativeCrypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prevent aborted pre-warm sockets or transient stream errors from killing the dev server process
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.message?.includes('aborted')) {
    return;
  }
  console.error('[Server] Uncaught Exception (process kept alive):', err);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[Server] Unhandled Rejection (process kept alive):', reason);
});

const MAX_STATE_PAYLOAD_LIMIT = '10mb';

export const ALLOWED_ENTITIES = [
  'rawStock',
  'stock',
  'types',
  'pdrGroups',
  'designations',
  'machines',
  'generalSystemTypes',
  'families',
  'templates',
  'blueprints',
  'zones',
  'machineElementsLedger',
  'mouvements',
  'preventiveTasks',
  'preventiveActions',
  'preventiveGuides',
  'preventivePlans',
  'preventiveExecutions',
  'correctiveInterventions',
  'correctiveActionsByPanne',
  'correctivePanneCategories',
  'correctiveTravauxAFaire',
  'correctiveIntervenants',
  'users',
  'technicians',
  'operations',
  'authAccounts',
  'warehouseItems',
  'entrepotComponents',
  'compGroups',
  'compFamilies',
  'compTemplates',
  'partTypes',
  'partDesignations',
  'sortiesExterne',
  'sortieDemands',
  'meterReadings',
  'replenishmentOrders',
  'workshopOrders',
  'needRequests',
  'auditEvents',
] as const;

const ALLOWED_ENTITY_SET = new Set<string>(ALLOWED_ENTITIES);
const OBJECT_ENTITY_SET = new Set<string>([
  'correctiveActionsByPanne',
  'correctivePanneCategories',
]);

export interface CreateGmaoApiAppOptions {
  dataDir?: string;
  port?: number;
  isProduction?: boolean;
  initialState?: Record<string, any>;
  sessionSecret?: string;
}

function collectHostIpv4Addresses(): Set<string> {
  const ips = new Set<string>(['127.0.0.1', 'localhost', '::1']);
  try {
    const nets = os.networkInterfaces();
    for (const netList of Object.values(nets)) {
      if (!Array.isArray(netList)) continue;
      for (const net of netList) {
        const isIPv4 = net.family === 'IPv4' || (net as any).family === 4;
        if (isIPv4 && net.address) {
          ips.add(net.address.toLowerCase());
        }
      }
    }
  } catch {
    // ignore interface enumeration error
  }
  return ips;
}

export function createGmaoApiApp(options: CreateGmaoApiAppOptions = {}) {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
  const PORT = options.port ?? (cliPort || Number(process.env.GMAO_PORT) || 3000);
  const isProduction = options.isProduction ?? (process.env.NODE_ENV === 'production');

  // SEC-HARDENING-P1 (Batch B): Startup verification of GMAO_API_TOKEN
  // In production/host mode, an empty or weak token blocks all write operations and logs a critical alert.
  // In DEV mode, logs a warning without breaking local development workflow.
  if (isWeakOrEmptyApiToken(process.env.GMAO_API_TOKEN)) {
    if (isProduction) {
      console.error(
        '[Server][SEC-HARDENING-P1] CRITIQUE : GMAO_API_TOKEN est absent ou faible (ex: empty, change-me, secret, gmao, 1234). Vous devez définir un GMAO_API_TOKEN fort (>= 8 caractères) dans les variables d’environnement. Les requêtes d’écriture API seront refusées.'
      );
    } else if (!process.env.VITEST) {
      console.warn(
        '[Server][SEC-HARDENING-P1] AVERTISSEMENT DEV : GMAO_API_TOKEN absent ou faible. Autorisé uniquement en développement local ; définissez un GMAO_API_TOKEN robuste en production.'
      );
    }
  }

  const ephemeralInstanceSecret = randomBytesHex(32);
  const getSessionSecretInfo = () =>
    resolveServerSessionSecret({
      explicitSecret: options.sessionSecret ?? process.env.GMAO_SESSION_SECRET,
      apiToken: process.env.GMAO_API_TOKEN,
      fallbackInstanceSecret: ephemeralInstanceSecret,
    });

  if (isProduction && getSessionSecretInfo().source === 'EPHEMERAL_INSTANCE' && !process.env.VITEST) {
    console.warn(
      '[Server][SEC-LAN-P1] AVERTISSEMENT : GMAO_SESSION_SECRET absent en production ; clé éphémère générée en mémoire (les sessions expireraient au redémarrage). Définissez GMAO_SESSION_SECRET dans .env.local.'
    );
  }

  // SEC-LAN-P0: Restricted CORS allowlist (localhost, host LAN IPs, and optional GMAO_CORS_ORIGINS)
  const serverHostIps = collectHostIpv4Addresses();
  const extraAllowedOrigins = new Set<string>(
    String(process.env.GMAO_CORS_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        const allowed = isAllowedCorsOrigin(
          origin,
          extraAllowedOrigins,
          serverHostIps,
          Number(PORT) || 3000
        );
        callback(null, allowed);
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Accept',
        'If-Match',
        'Authorization',
        'authorization',
        'X-GMAO-SESSION',
        'x-gmao-session',
        'X-GMAO-API-TOKEN',
        'x-gmao-api-token',
        'x-gmao-client-origin',
        'x-gmao-actor',
        'x-gmao-actor-id',
        'x-gmao-role',
      ],
      maxAge: 600,
    })
  );
  app.use(express.json({ limit: MAX_STATE_PAYLOAD_LIMIT, strict: false }));

  // Handle JSON parse errors and payload size limit errors cleanly
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err?.type === 'entity.too.large' || err?.status === 413) {
      return res.status(413).json({
        success: false,
        error: 'Payload Too Large',
        message: `Payload exceeds maximum allowed size (${MAX_STATE_PAYLOAD_LIMIT}).`,
      });
    }
    if (err instanceof SyntaxError && 'body' in err) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Invalid JSON payload.',
      });
    }
    next(err);
  });

  // Security Headers Middleware (CSP, Anti-Sniffing, Frame Protection)
  app.use((req, res, next) => {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api.dicebear.com; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';"
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Enterprise In-Memory Rate Limiting (Token Bucket / Sliding Window)
  // Uses socket.remoteAddress by default so attackers cannot bypass limits via spoofed X-Forwarded-For.
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 300; // 300 req/min for general API

  const revokedSessionIds = new Map<string, number>();
  const loginThrottleMap = new Map<
    string,
    { failures: number; lockUntil: number; resetAt: number }
  >();

  const pruneSecurityCaches = (nowMs: number) => {
    const nowSec = Math.floor(nowMs / 1000);
    for (const [key, entry] of rateLimitMap.entries()) {
      if (nowMs > entry.resetTime) {
        rateLimitMap.delete(key);
      }
    }
    for (const [sid, expSec] of revokedSessionIds.entries()) {
      if (nowSec >= expSec) {
        revokedSessionIds.delete(sid);
      }
    }
    for (const [key, entry] of loginThrottleMap.entries()) {
      if (nowMs > entry.resetAt && nowMs > entry.lockUntil) {
        loginThrottleMap.delete(key);
      }
    }
  };

  const rateLimitCleanupTimer = setInterval(() => {
    pruneSecurityCaches(Date.now());
  }, RATE_LIMIT_WINDOW_MS);
  if (typeof rateLimitCleanupTimer.unref === 'function') {
    rateLimitCleanupTimer.unref();
  }

  const apiRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const trustProxy = process.env.GMAO_TRUST_PROXY === 'true';
    const forwardedFor = trustProxy ? req.headers['x-forwarded-for'] : undefined;
    const clientIp =
      (typeof forwardedFor === 'string' && forwardedFor.split(',')[0].trim()) ||
      req.socket?.remoteAddress ||
      req.ip ||
      'unknown';

    const now = Date.now();
    if (rateLimitMap.size > 1000) {
      pruneSecurityCaches(now);
    }

    const clientData = rateLimitMap.get(clientIp);
    if (!clientData || now > clientData.resetTime) {
      rateLimitMap.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      return next();
    }

    clientData.count += 1;
    if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Taux de requêtes dépassé. Veuillez patienter 60 secondes.',
      });
    }

    next();
  };

  app.use('/api', apiRateLimiter);

  // Reference to dbState for RBAC cross-checks before dbState is populated below
  let dbStateRef: Record<string, any> = {};

  // API Authentication & Fail-Closed RBAC Middleware (SEC-LAN-P0 + SEC-LAN-P1)
  const authenticateApi = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers['x-gmao-api-token'];
    const clientOrigin = req.headers['x-gmao-client-origin'];
    const expectedToken = process.env.GMAO_API_TOKEN;
    const remoteAddress = req.socket?.remoteAddress;

    // Guard: expectedToken && token !== undefined && token !== expectedToken
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

    // Auth login/logout endpoints bypass write-session proof (they issue/revoke the session)
    const normalizedPath = String(req.path || '').toLowerCase();
    if (
      req.baseUrl === '/api/gmao' &&
      req.method === 'POST' &&
      (normalizedPath === '/auth/login' || normalizedPath === '/auth/logout')
    ) {
      return next();
    }

    const rawExpected = typeof expectedToken === 'string' ? expectedToken.trim() : '';
    const rawProvided = typeof token === 'string' ? token.trim() : '';
    const hasValidStrongToken =
      !isWeakOrEmptyApiToken(rawExpected) && rawProvided === rawExpected;

    const registryInitialized = isRegistryInitialized(
      dbStateRef.users,
      dbStateRef.technicians,
      dbStateRef.authAccounts
    );
    const serverSessionToken = extractServerSessionToken(req.headers as Record<string, unknown>);

    let resolvedActor = resolveEffectiveServerRole(
      req.headers as Record<string, unknown>,
      dbStateRef.users,
      dbStateRef.technicians,
      dbStateRef.authAccounts
    );

    if (serverSessionToken) {
      const { secret } = getSessionSecretInfo();
      const verifiedSession = verifyServerSession(serverSessionToken, secret, {
        revokedSessionIds,
      });

      if (!verifiedSession.valid || !verifiedSession.payload) {
        console.warn(
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

      // Re-resolve authoritative identity strictly from verified token subject (`sub`), ignoring forged x-gmao-actor-id
      const liveActor = resolveEffectiveServerRole(
        {
          'x-gmao-actor-id': sessionPayload.sub,
          'x-gmao-actor': sessionPayload.name,
          'x-gmao-role': req.headers['x-gmao-role'] || sessionPayload.role,
        },
        dbStateRef.users,
        dbStateRef.technicians,
        dbStateRef.authAccounts
      );

      // Clamp role to min(liveRegistryRole, tokenIssuedRole, claimedRole)
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
      (req as any).serverSessionPayload = sessionPayload;

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

    (req as any).resolvedServerActor = resolvedActor;

    if (resolvedActor.roleSpoofDetected) {
      console.warn(
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

    if (req.method === 'GET') {
      const hasClientContext =
        Boolean(resolvedActor.sessionVerified) ||
        clientOrigin === 'gmao-web-client' ||
        Boolean(req.headers['x-gmao-actor-id']) ||
        Boolean(req.headers['x-gmao-actor']) ||
        Boolean(req.headers['x-gmao-role']) ||
        Boolean(expectedToken && token === expectedToken);
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
        fullPath === '/api/gmao/users' ||
        fullPath === '/api/gmao/authaccounts';

      // Unrecognized actorId (e.g. ghost-99) is strictly rejected even with API token once registry exists
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

      return next();
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const pathParts = req.path.split('/').filter(Boolean);
      const targetEntity = pathParts[0] || '';

      // SEC-LAN-P1: On initialized registries, every write requires a verified server session token
      if (!resolvedActor.sessionVerified) {
        if (!registryInitialized) {
          const bootstrapCheck = evaluateBootstrapWriteAllowance({
            method: req.method,
            targetEntity,
            dbUsers: dbStateRef.users,
            dbTechnicians: dbStateRef.technicians,
            dbAuthAccounts: dbStateRef.authAccounts,
            remoteAddress,
            providedToken: token,
            expectedToken,
            isProduction,
          });

          if (!bootstrapCheck.allowed) {
            console.warn(
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

          (req as any).isBootstrapAuthorized = true;
          console.warn(
            `[Server][SEC-LAN-P0][BOOTSTRAP] Permitted initial ${req.method} on '${targetEntity}' while user/technician registries are empty (ip="${remoteAddress || 'unknown'}").`
          );
          return next();
        }

        console.warn(
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
        if (ADMIN_ONLY_ENTITIES.has(targetEntity) && role !== 'ADMIN' && role !== 'RESPONSABLE_MAINTENANCE') {
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
            message: entityGuard.reason || `Role '${role}' is not authorized to modify '${targetEntity}'.`,
          });
        }
      }
    }
    next();
  };
  app.use('/api/gmao', authenticateApi);

  // OpenAPI 3.0 / Swagger Interactive Documentation (disabled in production unless explicitly opted-in with auth; loopback-only in dev)
  const swaggerEnabled = !isProduction || process.env.GMAO_ENABLE_SWAGGER === 'true';
  const guardSwaggerAccess = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!swaggerEnabled) {
      return res.status(404).json({
        success: false,
        error: 'Not Found',
        message: 'API documentation is disabled in production mode.',
      });
    }
    if (isProduction) {
      const expected = String(process.env.GMAO_API_TOKEN || '').trim();
      const provided = String(req.headers['x-gmao-api-token'] || '').trim();
      if (isWeakOrEmptyApiToken(expected) || provided !== expected) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Valid strong GMAO_API_TOKEN required for API docs.',
        });
      }
      return next();
    }
    if (
      process.env.GMAO_ALLOW_LAN_SWAGGER !== 'true' &&
      !isLoopbackRemoteAddress(req.socket?.remoteAddress)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Swagger documentation is restricted to localhost in development.',
      });
    }
    return next();
  };

  if (swaggerEnabled && !isProduction && !process.env.VITEST) {
    console.warn(
      '[Server][SEC-LAN-P0] Swagger /api/docs active in DEV mode (restricted to localhost).'
    );
  }

  app.get('/api/docs.json', guardSwaggerAccess, (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.use('/api/docs', guardSwaggerAccess, swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Data persistence file path
  const DATA_DIR = options.dataDir ? path.resolve(options.dataDir) : path.join(__dirname, 'data');
  const STATE_FILE = path.join(DATA_DIR, 'gmao_state.json');
  const STATE_TMP_FILE = path.join(DATA_DIR, 'gmao_state.json.tmp');
  const AUDIT_FILE = path.join(DATA_DIR, 'gmao_audit.jsonl');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const createDefaultState = (): Record<string, any> => {
    const initial: Record<string, any> = {};
    for (const key of ALLOWED_ENTITIES) {
      initial[key] = OBJECT_ENTITY_SET.has(key) ? {} : [];
    }
    initial.version = 1;
    initial.updatedAt = new Date().toISOString();
    return initial;
  };

  // In-memory / file-backed state store for enterprise GMAO backend
  const dbState: Record<string, any> = createDefaultState();
  dbStateRef = dbState;

  if (options.initialState && typeof options.initialState === 'object') {
    for (const key of ALLOWED_ENTITIES) {
      if (Object.prototype.hasOwnProperty.call(options.initialState, key)) {
        const val = options.initialState[key];
        if (OBJECT_ENTITY_SET.has(key)) {
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            dbState[key] = val;
          }
        } else if (Array.isArray(val)) {
          dbState[key] = val;
        }
      }
    }
  } else {
    // Load initial state once at startup if exists (filtering only allowed keys)
    try {
      if (fs.existsSync(STATE_FILE)) {
        const raw = fs.readFileSync(STATE_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const key of ALLOWED_ENTITIES) {
            if (Object.prototype.hasOwnProperty.call(parsed, key)) {
              const val = parsed[key];
              if (OBJECT_ENTITY_SET.has(key)) {
                if (val && typeof val === 'object' && !Array.isArray(val)) {
                  dbState[key] = val;
                }
              } else if (Array.isArray(val)) {
                dbState[key] = val;
              }
            }
          }
          if (typeof parsed.version === 'number' && Number.isFinite(parsed.version) && parsed.version >= 1) {
            dbState.version = Math.floor(parsed.version);
          }
          if (typeof parsed.updatedAt === 'string') {
            dbState.updatedAt = parsed.updatedAt;
          }
        }
      }
    } catch (err) {
      console.error('[Backend] Failed to load state file:', err);
    }
  }

  // Active Server-Sent Events (SSE) clients for real-time LAN revision broadcast (P3.4)
  const sseClients = new Set<express.Response>();

  const broadcastSseEvent = (eventPayload: Record<string, any>) => {
    const frame = `data: ${JSON.stringify(eventPayload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  // Non-blocking serialized write queue with atomic .tmp -> rename (P3.3)
  let writeQueue: Promise<void> = Promise.resolve();

  const persistState = (auditContext?: {
    actor?: string;
    action: string;
    entity: string;
    summary?: string;
  }): Promise<void> => {
    dbState.version = (typeof dbState.version === 'number' ? dbState.version : 1) + 1;
    dbState.updatedAt = new Date().toISOString();
    const currentVersion = dbState.version;
    const currentUpdatedAt = dbState.updatedAt;
    const serializedState = JSON.stringify(dbState, null, 2);

    const auditEntry = auditContext
      ? JSON.stringify({
          id: `aud_${Date.now()}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 8)}`,
          timestamp: currentUpdatedAt,
          version: currentVersion,
          actor: auditContext.actor || 'system',
          action: auditContext.action,
          entity: auditContext.entity,
          summary: auditContext.summary || '',
        }) + '\n'
      : null;

    writeQueue = writeQueue
      .then(async () => {
        await fs.promises.writeFile(STATE_TMP_FILE, serializedState, 'utf-8');
        await fs.promises.rename(STATE_TMP_FILE, STATE_FILE);
        if (auditEntry) {
          await fs.promises.appendFile(AUDIT_FILE, auditEntry, 'utf-8');
        }
        broadcastSseEvent({
          type: 'STATE_UPDATED',
          version: currentVersion,
          updatedAt: currentUpdatedAt,
          actor: auditContext?.actor || 'system',
          action: auditContext?.action || 'SYNC_STATE',
          entity: auditContext?.entity || 'state',
        });
      })
      .catch((err) => {
        console.error('[Backend] Failed to persist state or audit file:', err);
      });

    return writeQueue;
  };

  const resolveActor = (req: express.Request): string => {
    const resolved = (req as any).resolvedServerActor;
    if (resolved?.identityStatus === 'VERIFIED' && resolved.actorName) {
      return (resolved.actorId ? `${resolved.actorName} (${resolved.actorId})` : resolved.actorName).slice(0, 120);
    }
    const headerActor = req.headers['x-gmao-actor'];
    if (typeof headerActor === 'string' && headerActor.trim().length > 0) {
      return headerActor.trim().slice(0, 120);
    }
    return 'web-operator';
  };

  // API Routes
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.json({
      status: 'healthy',
      service: 'GMAO Enterprise Backend API',
      timestamp: new Date().toISOString(),
      version: dbState.version,
      storage: 'Atomic JSON File + Serialized Memory Engine',
    });
  };
  app.get('/api/health', healthHandler);
  app.get('/api/gmao/health', healthHandler);

  // LAN Host Network Discovery Endpoint (P3.1 & P3.2) — Protected by authenticateApi (SEC-LAN-P0)
  app.get('/api/network/info', authenticateApi, (req, res) => {
    try {
      const nets = os.networkInterfaces();
      const interfaces: Array<{ name: string; address: string; netmask: string; family: string }> = [];

      for (const [name, netList] of Object.entries(nets)) {
        if (!Array.isArray(netList)) continue;
        for (const net of netList) {
          const isIPv4 = net.family === 'IPv4' || (net as any).family === 4;
          if (isIPv4 && !net.internal && net.address) {
            interfaces.push({
              name,
              address: net.address,
              netmask: net.netmask || '255.255.255.0',
              family: 'IPv4',
            });
          }
        }
      }

      // Prioritize private LAN subnets (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      const preferred = interfaces.find(
        (iface) =>
          iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(iface.address)
      );
      const primaryIp = preferred?.address || interfaces[0]?.address || '127.0.0.1';
      const hostPort = Number(PORT) || 3000;
      const baseHostUrl = `http://${primaryIp}:${hostPort}`;

      return res.json({
        success: true,
        hostname: os.hostname(),
        port: hostPort,
        primaryIp,
        interfaces,
        urls: {
          desktop: baseHostUrl,
          mobile: `${baseHostUrl}/#mobile`,
        },
        version: dbState.version,
        updatedAt: dbState.updatedAt,
        connectedClients: sseClients.size,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: err?.message || 'Failed to inspect network interfaces',
      });
    }
  });

  // Lightweight Revision Check Endpoint (P3.4)
  app.get('/api/gmao/revision', (_req, res) => {
    res.setHeader('ETag', `W/"v${dbState.version}"`);
    return res.json({
      success: true,
      version: dbState.version,
      updatedAt: dbState.updatedAt,
    });
  });

  // Server-Sent Events (SSE) Stream for Real-Time LAN Synchronization (P3.4)
  app.get('/api/gmao/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(
      `data: ${JSON.stringify({
        type: 'CONNECTED',
        version: dbState.version,
        updatedAt: dbState.updatedAt,
      })}\n\n`
    );

    sseClients.add(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // Server-Issued Session Login & Logout (SEC-LAN-P1)
  const findLoginAccountRecord = (rawIdentifier: string): { record: any; source: 'authAccounts' | 'users' | 'technicians' } | null => {
    const clean = String(rawIdentifier || '').trim().toLowerCase();
    if (!clean) return null;

    const matchRecord = (item: any, allowMagasinAlias: boolean): boolean => {
      if (!item || typeof item !== 'object') return false;
      const candidates = [
        item.id,
        item.code,
        item.username,
        item.personnelId,
        item.id_technician,
        item.id_operation,
      ]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean);
      if (candidates.includes(clean)) return true;
      if (allowMagasinAlias && (clean === 'rmg' || clean === 'magasin')) {
        return candidates.includes('magasinier') || candidates.includes('resp-04');
      }
      return false;
    };

    const authAccounts = Array.isArray(dbState.authAccounts) ? dbState.authAccounts : [];
    const matchedAuth = authAccounts.find((a: any) => matchRecord(a, true));
    if (matchedAuth) return { record: matchedAuth, source: 'authAccounts' };

    const users = Array.isArray(dbState.users) ? dbState.users : [];
    const matchedUser = users.find((u: any) => matchRecord(u, true));
    if (matchedUser) return { record: matchedUser, source: 'users' };

    const techs = Array.isArray(dbState.technicians) ? dbState.technicians : [];
    const matchedTech = techs.find((t: any) => matchRecord(t, false));
    if (matchedTech) return { record: matchedTech, source: 'technicians' };

    return null;
  };

  const isAccountOrLinkedProfileArchived = (record: any): boolean => {
    const checkArchived = (item: any) => {
      if (!item || typeof item !== 'object') return false;
      const statut = String(item.statut || '').trim().toUpperCase();
      const status = String(item.status || '').trim().toUpperCase();
      return (
        item.is_active === false ||
        item.actif === false ||
        item.isActive === false ||
        statut === 'ARCHIVE' ||
        statut === 'ARCHIVEE' ||
        status === 'ARCHIVE' ||
        status === 'ARCHIVEE'
      );
    };
    if (checkArchived(record)) return true;
    const pid = String(record?.personnelId || '').trim().toUpperCase();
    if (!pid) return false;
    const linkedUsers = Array.isArray(dbState.users) ? dbState.users : [];
    const linkedTechs = Array.isArray(dbState.technicians) ? dbState.technicians : [];
    const linked = [...linkedUsers, ...linkedTechs].find((entry: any) =>
      [entry?.id, entry?.id_technician, entry?.id_operation, entry?.code]
        .map((v) => String(v || '').trim().toUpperCase())
        .includes(pid)
    );
    return linked ? checkArchived(linked) : false;
  };

  app.post('/api/gmao/auth/login', (req, res) => {
    const rawIdentifier = String(
      req.body?.identifier || req.body?.actorId || req.body?.username || ''
    ).trim();
    const rawPassword = String(req.body?.password || '').trim();

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
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'INVALID_CREDENTIALS',
        message: 'Identifiant ou mot de passe incorrect.',
      });
    }

    if (isAccountOrLinkedProfileArchived(found.record)) {
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

    const { secret } = getSessionSecretInfo();
    const issued = signServerSession(
      {
        sub: canonicalSub,
        role: canonicalRole,
        name: displayName,
      },
      secret
    );

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

  app.post('/api/gmao/auth/logout', (req, res) => {
    const token =
      extractServerSessionToken(req.headers as Record<string, unknown>) ||
      String(req.body?.token || '').trim();
    if (token) {
      const { secret } = getSessionSecretInfo();
      const verified = verifyServerSession(token, secret);
      if (verified.payload?.sid) {
        revokedSessionIds.set(verified.payload.sid, verified.payload.exp);
      }
    }
    return res.json({ success: true });
  });

  // Get recent server-side audit trail entries
  app.get('/api/gmao/audit', async (req, res) => {
    try {
      const limitParam = Number(req.query.limit) || 100;
      const limit = Math.min(Math.max(1, limitParam), 500);
      if (!fs.existsSync(AUDIT_FILE)) {
        return res.json({ success: true, data: [] });
      }
      const raw = await fs.promises.readFile(AUDIT_FILE, 'utf-8');
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const recent = lines
        .slice(-limit)
        .reverse()
        .map((line) => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return res.json({ success: true, data: recent });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Failed to read audit log' });
    }
  });

  // Get full GMAO state (hashes are stripped; protected collections hidden unless session-verified or bootstrap)
  app.get('/api/gmao/state', (req, res) => {
    res.setHeader('ETag', `W/"v${dbState.version}"`);
    const sessionVerified = Boolean((req as any).resolvedServerActor?.sessionVerified);
    const registryReady = isRegistryInitialized(
      dbState.users,
      dbState.technicians,
      dbState.authAccounts
    );
    res.json({
      success: true,
      version: dbState.version,
      updatedAt: dbState.updatedAt,
      data: sanitizeStateSnapshotForTransport(dbState, {
        includeProtectedCollections: sessionVerified || !registryReady,
      }),
    });
  });

  // Save/Sync full GMAO state (reject non-object; merge ALLOWED_ENTITIES only; support optimistic concurrency)
  app.post('/api/gmao/state', async (req, res) => {
    try {
      const incomingState = req.body;
      if (!incomingState || typeof incomingState !== 'object' || Array.isArray(incomingState)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid state payload: body must be a JSON object.',
        });
      }

      // Optional Optimistic Concurrency Check when expectedVersion is explicitly provided and force !== true
      const expectedVersion =
        typeof incomingState.expectedVersion === 'number'
          ? incomingState.expectedVersion
          : req.headers['if-match']
          ? Number(String(req.headers['if-match']).replace(/[^\d]/g, ''))
          : undefined;

      const serverHasData = ALLOWED_ENTITIES.some((k) =>
        Array.isArray(dbState[k]) ? dbState[k].length > 0 : Object.keys(dbState[k] || {}).length > 0
      );

      const isSmartMergeRequest = incomingState.merge === true;

      if (
        expectedVersion !== undefined &&
        !Number.isNaN(expectedVersion) &&
        incomingState.force !== true &&
        !isSmartMergeRequest &&
        serverHasData &&
        expectedVersion < dbState.version
      ) {
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: `Server state version (${dbState.version}) is newer than client expectedVersion (${expectedVersion}).`,
          version: dbState.version,
          updatedAt: dbState.updatedAt,
          data: sanitizeStateSnapshotForTransport(dbState, { includeProtectedCollections: true }),
        });
      }

      const isBootstrapAuthorized = (req as any).isBootstrapAuthorized === true;
      const resolvedActor =
        (req as any).resolvedServerActor ||
        resolveEffectiveServerRole(
          req.headers as Record<string, unknown>,
          dbState.users,
          dbState.technicians,
          dbState.authAccounts
        );

      let effectiveIncomingState = incomingState;
      if (!isBootstrapAuthorized) {
        if (resolvedActor.identityStatus !== 'VERIFIED') {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: 'Unverified or inactive actor cannot modify server state.',
          });
        }
        const bulkCheck = sanitizeBulkStateForRole(
          resolvedActor.effectiveRole,
          incomingState,
          dbState
        );
        if (!bulkCheck.allowed) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: bulkCheck.reason || 'Role not authorized for this state operation.',
          });
        }
        effectiveIncomingState = bulkCheck.sanitizedState;
      }

      // If client was synced with exact current server version (and not requesting union merge),
      // intentional item deletions from this client are respected. Otherwise (cross-version force/merge),
      // server-only records created by other LAN devices (e.g., mobile technicians) are preserved.
      const baseVersionMatches =
        expectedVersion !== undefined &&
        !Number.isNaN(expectedVersion) &&
        expectedVersion === dbState.version;

      const preserveServerOnlyItems =
        effectiveIncomingState.replaceAll === true
          ? false
          : isSmartMergeRequest
          ? true
          : !baseVersionMatches;

      const { acceptedKeys } = mergeGmaoStateSnapshot(
        dbState,
        effectiveIncomingState,
        ALLOWED_ENTITIES,
        OBJECT_ENTITY_SET,
        {
          replaceAll: effectiveIncomingState.replaceAll === true,
          preserveServerOnlyItems,
          deletedIdsByEntity: effectiveIncomingState.deletedIdsByEntity,
        }
      );

      await persistState({
        actor: resolveActor(req),
        action: isSmartMergeRequest ? 'MERGE_STATE' : 'SYNC_STATE',
        entity: 'state',
        summary: `${isSmartMergeRequest ? 'Merged' : 'Updated'} ${acceptedKeys.length} collections (${acceptedKeys.slice(0, 6).join(', ')})`,
      });

      res.setHeader('ETag', `W/"v${dbState.version}"`);
      return res.json({
        success: true,
        merged: isSmartMergeRequest || preserveServerOnlyItems,
        message: 'State synchronized successfully',
        version: dbState.version,
        updatedAt: dbState.updatedAt,
        acceptedKeys,
        data:
          isSmartMergeRequest || preserveServerOnlyItems
            ? sanitizeStateSnapshotForTransport(dbState, { includeProtectedCollections: true })
            : undefined,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  });

  // Entity whitelist guard: returns 403 Forbidden if :entity is not in ALLOWED_ENTITIES
  const requireAllowedEntity = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const entity = String(req.params.entity || '');
    if (!ALLOWED_ENTITY_SET.has(entity)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Entity '${entity}' is not allowed.`,
      });
    }
    next();
  };

  // Generic Entity CRUD Endpoints for allowed GMAO entities only
  app.get('/api/gmao/:entity', requireAllowedEntity, (req, res) => {
    const entity = String(req.params.entity);
    if (dbState[entity] === undefined) {
      dbState[entity] = OBJECT_ENTITY_SET.has(entity) ? {} : [];
    }
    return res.json({
      success: true,
      version: dbState.version,
      data: stripSensitiveAccountFields(entity, dbState[entity]),
    });
  });

  app.post('/api/gmao/:entity', requireAllowedEntity, async (req, res) => {
    const entity = String(req.params.entity);
    const newItem = req.body;
    if (!newItem || typeof newItem !== 'object' || Array.isArray(newItem)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Item payload must be a JSON object.',
      });
    }
    if (OBJECT_ENTITY_SET.has(entity)) {
      dbState[entity] = { ...(dbState[entity] || {}), ...newItem };
      await persistState({
        actor: resolveActor(req),
        action: 'UPSERT_DICTIONARY',
        entity,
        summary: `Updated dictionary keys in ${entity}`,
      });
      return res.status(201).json({ success: true, version: dbState.version, data: dbState[entity] });
    }
    if (!Array.isArray(dbState[entity])) {
      dbState[entity] = [];
    }
    dbState[entity].push(newItem);
    if (entity === 'rawStock') dbState.stock = dbState.rawStock;
    if (entity === 'stock') dbState.rawStock = dbState.stock;
    const itemId = newItem.id || newItem.code || newItem.ref || 'new';
    await persistState({
      actor: resolveActor(req),
      action: 'CREATE_ITEM',
      entity,
      summary: `Created item '${itemId}' in ${entity}`,
    });
    return res.status(201).json({ success: true, version: dbState.version, data: newItem });
  });

  app.put('/api/gmao/:entity', requireAllowedEntity, async (req, res) => {
    const entity = String(req.params.entity);
    const payload = req.body;
    if (OBJECT_ENTITY_SET.has(entity)) {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: `Entity '${entity}' requires a JSON object payload.`,
        });
      }
      dbState[entity] = payload;
      await persistState({
        actor: resolveActor(req),
        action: 'REPLACE_DICTIONARY',
        entity,
        summary: `Replaced dictionary ${entity}`,
      });
      return res.json({ success: true, version: dbState.version, data: dbState[entity] });
    }
    if (!Array.isArray(payload)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: `PUT /api/gmao/${entity} requires an array payload or use /api/gmao/${entity}/:id.`,
      });
    }
    const shouldMergeEntity = req.query.merge === 'true';
    const currentList = Array.isArray(dbState[entity]) ? dbState[entity] : [];
    dbState[entity] = shouldMergeEntity
      ? mergeEntityCollection(entity, currentList, payload, { preserveServerOnlyItems: true })
      : payload;
    if (entity === 'rawStock') dbState.stock = dbState.rawStock;
    if (entity === 'stock') dbState.rawStock = dbState.stock;
    await persistState({
      actor: resolveActor(req),
      action: shouldMergeEntity ? 'MERGE_COLLECTION' : 'REPLACE_COLLECTION',
      entity,
      summary: `${shouldMergeEntity ? 'Merged' : 'Replaced'} collection ${entity} (${dbState[entity].length} items)`,
    });
    return res.json({ success: true, version: dbState.version, data: dbState[entity] });
  });

  app.put('/api/gmao/:entity/:id', requireAllowedEntity, async (req, res) => {
    const entity = String(req.params.entity);
    const id = String(req.params.id);
    const updatedData = req.body;
    if (!updatedData || typeof updatedData !== 'object' || Array.isArray(updatedData)) {
      return res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'Update payload must be a JSON object.',
      });
    }
    if (!Array.isArray(dbState[entity])) {
      return res.status(404).json({ success: false, message: `Entity '${entity}' is not an array collection` });
    }
    const index = dbState[entity].findIndex(
      (item: any) => item && (String(item.id) === id || String(item.code) === id || String(item.ref) === id)
    );
    if (index !== -1) {
      dbState[entity][index] = { ...dbState[entity][index], ...updatedData };
      if (entity === 'rawStock') dbState.stock = dbState.rawStock;
      if (entity === 'stock') dbState.rawStock = dbState.stock;
      await persistState({
        actor: resolveActor(req),
        action: 'UPDATE_ITEM',
        entity,
        summary: `Updated item '${id}' in ${entity}`,
      });
      return res.json({ success: true, version: dbState.version, data: dbState[entity][index] });
    }
    return res.status(404).json({ success: false, message: `Item with id/code '${id}' not found in '${entity}'` });
  });

  app.delete('/api/gmao/:entity', requireAllowedEntity, (_req, res) => {
    return res.status(400).json({
      success: false,
      error: 'Bad Request',
      message: 'Item ID is required for DELETE (/api/gmao/:entity/:id).',
    });
  });

  app.delete('/api/gmao/:entity/:id', requireAllowedEntity, async (req, res) => {
    const entity = String(req.params.entity);
    const id = String(req.params.id);
    if (!Array.isArray(dbState[entity])) {
      return res.status(404).json({ success: false, message: `Entity '${entity}' is not an array collection` });
    }
    const initialLen = dbState[entity].length;
    dbState[entity] = dbState[entity].filter(
      (item: any) => !item || (String(item.id) !== id && String(item.code) !== id && String(item.ref) !== id)
    );
    if (dbState[entity].length < initialLen) {
      if (entity === 'rawStock') dbState.stock = dbState.rawStock;
      if (entity === 'stock') dbState.rawStock = dbState.stock;
      await persistState({
        actor: resolveActor(req),
        action: 'DELETE_ITEM',
        entity,
        summary: `Deleted item '${id}' from ${entity}`,
      });
      return res.json({ success: true, version: dbState.version, message: `Deleted item '${id}' from '${entity}'` });
    }
    return res.status(404).json({ success: false, message: `Item with id/code '${id}' not found in '${entity}'` });
  });

  const cleanup = () => {
    clearInterval(rateLimitCleanupTimer);
    revokedSessionIds.clear();
    loginThrottleMap.clear();
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    sseClients.clear();
  };

  return {
    app,
    dbState,
    port: PORT,
    isProduction,
    cleanup,
  };
}

export async function startServer() {
  const { app, port: PORT, isProduction, cleanup } = createGmaoApiApp();

  // Setup Vite or static serving
  let viteInstance: any = null;
  if (!isProduction) {
    const viteReadyPromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: {
            middlewareMode: true,
            hmr: false,
            watch: {
              ignored: ['**/dist/**', '**/coverage/**', '**/data/**', '**/node_modules/**', '**/.git/**'],
            },
          },
          appType: 'spa',
        })
      )
      .then((vite) => {
        viteInstance = vite;
        console.log('[Server] Vite development middleware enabled');
        return vite;
      })
      .catch((err) => {
        console.error('[Server] Vite development middleware initialization failed:', err);
        return null;
      });

    app.use(async (req, res, next) => {
      try {
        const vite = viteInstance || (await viteReadyPromise);
        if (vite && vite.middlewares) {
          vite.middlewares(req, res, next);
        } else {
          res.status(503).send('Server initializing, please retry...');
        }
      } catch (err) {
        next(err);
      }
    });
  } else {
    const DIST_DIR = path.join(__dirname, 'dist');
    app.use(express.static(DIST_DIR));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
    console.log('[Server] Production static serving enabled from dist/');
  }

  let activeHttpServer: any = null;
  const shutdown = () => {
    try {
      cleanup();
      if (activeHttpServer) {
        activeHttpServer.close(() => {
          process.exit(0);
        });
      }
      setTimeout(() => process.exit(0), 500).unref();
    } catch {
      process.exit(0);
    }
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  const listenWithRetry = (port: number, retriesLeft = 25) => {
    const httpServer = app.listen(port, '0.0.0.0', () => {
      activeHttpServer = httpServer;
      console.log(`🚀 GMAO Enterprise Server running on http://localhost:${port}`);
    });

    httpServer.on('error', (err: any) => {
      if (err?.code === 'EADDRINUSE' && retriesLeft > 0) {
        console.warn(`[Server] Port ${port} busy, retrying in 300ms (${retriesLeft} attempts left)...`);
        setTimeout(() => {
          try {
            httpServer.close();
          } catch {
            // ignore
          }
          listenWithRetry(port, retriesLeft - 1);
        }, 300);
        return;
      }
      console.error('[Server] HTTP server error:', err);
    });
  };

  listenWithRetry(Number(PORT));
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}

