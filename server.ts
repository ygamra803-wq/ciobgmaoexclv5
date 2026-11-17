import express from 'express';
import fs from 'fs';
import type http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { isWeakOrEmptyApiToken } from './src/core/security/serverRbacPolicy';
import { resolveServerSessionSecret } from './src/core/security/serverSession';
import { createServerSessionStore } from './src/core/security/serverSessionStore';
import { randomBytesHex } from './src/core/security/nativeCrypto';
import { serverLogger } from './src/server/serverLogger';
import {
  ALLOWED_ENTITIES,
  MAX_STATE_PAYLOAD_LIMIT,
  type CreateGmaoApiAppOptions,
} from './src/server/types';
import {
  buildCspHeaderValue,
  createLanCorsMiddleware,
  createSecurityHeadersMiddleware,
  jsonPayloadErrorMiddleware,
  renderHtmlWithCspNonce,
} from './src/server/middleware/securityHeaders';
import { createSecurityCacheController } from './src/server/middleware/rateLimiter';
import { createAuthenticateApiMiddleware } from './src/server/middleware/authenticateApi';
import { mountSwaggerRoutes } from './src/server/middleware/swaggerGuard';
import {
  createAtomicStatePersister,
  hydrateInitialDbState,
} from './src/server/persistence/stateStore';
import { mountAuthRoutes } from './src/server/routes/authRoutes';
import { mountEntityAndStateRoutes } from './src/server/routes/entityRoutes';
import { createSystemRoutesController } from './src/server/routes/systemRoutes';

export { ALLOWED_ENTITIES, buildCspHeaderValue, renderHtmlWithCspNonce };
export type { CreateGmaoApiAppOptions };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Prevent aborted pre-warm sockets or transient stream errors from killing the dev server process
process.on('uncaughtException', (err: NodeJS.ErrnoException) => {
  if (err?.code === 'ECONNRESET' || err?.code === 'EPIPE' || err?.message?.includes('aborted')) {
    return;
  }
  if (process.env.NODE_ENV === 'production' && !process.env.VITEST) {
    serverLogger.error('[Server] Fatal Uncaught Exception in production, shutting down:', err);
    process.exit(1);
  }
  serverLogger.error('[Server] Uncaught Exception (dev process kept alive):', err);
});

process.on('unhandledRejection', (reason: unknown) => {
  serverLogger.error('[Server] Unhandled Rejection:', reason);
});

/**
 * Composes and configures the Express LAN API server from modular persistence, security,
 * authentication, entity CRUD, and SSE subsystems.
 */
export function createGmaoApiApp(options: CreateGmaoApiAppOptions = {}) {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort =
    portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
  const PORT = options.port ?? (cliPort || Number(process.env.GMAO_PORT) || 3000);
  const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';

  if (isWeakOrEmptyApiToken(process.env.GMAO_API_TOKEN)) {
    if (isProduction) {
      serverLogger.error(
        '[Server][SEC-HARDENING-P1] CRITIQUE : GMAO_API_TOKEN est absent ou faible (ex: empty, change-me, secret, gmao, 1234). Vous devez définir un GMAO_API_TOKEN fort (>= 8 caractères) dans les variables d’environnement. Les requêtes d’écriture API seront refusées.'
      );
    } else {
      serverLogger.warn(
        '[Server][SEC-HARDENING-P1] AVERTISSEMENT DEV : GMAO_API_TOKEN absent ou faible. Autorisé uniquement en développement local ; définissez un GMAO_API_TOKEN robuste en production.'
      );
    }
  }

  const DATA_DIR = options.dataDir ? path.resolve(options.dataDir) : path.join(__dirname, 'data');
  const STATE_FILE = path.join(DATA_DIR, 'gmao_state.json');
  const STATE_TMP_FILE = path.join(DATA_DIR, 'gmao_state.json.tmp');
  const AUDIT_FILE = path.join(DATA_DIR, 'gmao_audit.jsonl');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const sessionStore = createServerSessionStore({
    dataDir: DATA_DIR,
    maxSensitiveSessions: options.maxSensitiveSessions,
    maxStandardSessions: options.maxStandardSessions,
  });

  const ephemeralInstanceSecret = randomBytesHex(32);
  const getSessionSecretInfo = () =>
    resolveServerSessionSecret({
      explicitSecret: options.sessionSecret ?? process.env.GMAO_SESSION_SECRET,
      apiToken: process.env.GMAO_API_TOKEN,
      fallbackInstanceSecret: ephemeralInstanceSecret,
      isProduction,
    });

  if (isProduction && getSessionSecretInfo().missingInProduction) {
    serverLogger.error(
      '[Server][SEC-LAN-P2] CRITIQUE : GMAO_SESSION_SECRET est absent ou faible (< 16 caractères) en production. Générez une clé avec `openssl rand -hex 32`. Émission et validation des sessions refusées.'
    );
  }

  // Core transport & security middleware
  app.use(createLanCorsMiddleware(PORT));
  app.use(express.json({ limit: MAX_STATE_PAYLOAD_LIMIT, strict: true }));
  app.use(jsonPayloadErrorMiddleware);
  app.use(createSecurityHeadersMiddleware(isProduction));

  const securityCache = createSecurityCacheController(sessionStore);
  app.use('/api', securityCache.apiRateLimiter);

  // Hydrate durable state & mount API authentication/RBAC gate
  const dbState = hydrateInitialDbState({
    stateFile: STATE_FILE,
    initialState: options.initialState,
  });

  const authenticateApi = createAuthenticateApiMiddleware({
    dbState,
    sessionStore,
    sseTickets: securityCache.sseTickets,
    isProduction,
    getSessionSecretInfo,
  });
  app.use('/api/gmao', authenticateApi);

  // OpenAPI / Swagger UI (environment & token guarded)
  mountSwaggerRoutes(app, isProduction);

  // System, LAN discovery & SSE routes
  const systemRoutes = createSystemRoutesController({
    app,
    dbState,
    port: PORT,
    sseTickets: securityCache.sseTickets,
    sseTicketTtlMs: securityCache.sseTicketTtlMs,
    pruneSecurityCaches: securityCache.pruneSecurityCaches,
    authenticateApi,
  });
  systemRoutes.mountRoutes();

  // Atomic disk persistence & SSE broadcast hook
  const { persistState } = createAtomicStatePersister({
    dbState,
    stateFile: STATE_FILE,
    stateTmpFile: STATE_TMP_FILE,
    auditFile: AUDIT_FILE,
    onStatePersisted: systemRoutes.broadcastSseEvent,
  });

  // Authentication & Entity CRUD routes (including DELETE stock invariant guard)
  mountAuthRoutes(app, {
    dbState,
    sessionStore,
    loginThrottleMap: securityCache.loginThrottleMap,
    isProduction,
    getSessionSecretInfo,
  });

  mountEntityAndStateRoutes(app, {
    dbState,
    auditFile: AUDIT_FILE,
    persistState,
  });

  if (options.distDir) {
    systemRoutes.mountProductionStaticWithCspNonce(options.distDir);
  }

  const cleanup = () => {
    securityCache.dispose();
    sessionStore.clearMemoryOnly();
    systemRoutes.closeAllSseClients();
  };

  return {
    app,
    dbState,
    port: PORT,
    isProduction,
    sessionStore,
    mountProductionStaticWithCspNonce: systemRoutes.mountProductionStaticWithCspNonce,
    cleanup,
  };
}

export async function startServer() {
  const { app, port: PORT, isProduction, mountProductionStaticWithCspNonce, cleanup } =
    createGmaoApiApp();

  if (!isProduction) {
    let viteInstance: Awaited<ReturnType<typeof import('vite')['createServer']>> | null = null;
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
        serverLogger.info('[Server] Vite development middleware enabled');
        return vite;
      })
      .catch((err) => {
        serverLogger.error('[Server] Vite development middleware initialization failed:', err);
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
    mountProductionStaticWithCspNonce(path.join(__dirname, 'dist'));
    serverLogger.info('[Server] Production static serving enabled from dist/ with nonced CSP');
  }

  let activeHttpServer: http.Server | null = null;
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
      serverLogger.info(`🚀 GMAO Enterprise Server running on http://localhost:${port}`);
    });

    httpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err?.code === 'EADDRINUSE' && retriesLeft > 0) {
        serverLogger.warn(
          `[Server] Port ${port} busy, retrying in 300ms (${retriesLeft} attempts left)...`
        );
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
      serverLogger.error('[Server] HTTP server error:', err);
    });
  };

  listenWithRetry(Number(PORT));
}

const isMainModule =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule && !process.env.VITEST) {
  startServer().catch((err) => {
    serverLogger.error('[Server] Fatal startup error:', err);
    process.exit(1);
  });
}
