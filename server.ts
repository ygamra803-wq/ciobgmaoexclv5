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
} from './src/core/security/serverRbacPolicy';

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
  'warehouseItems',
  'entrepotComponents',
  'compGroups',
  'compFamilies',
  'compTemplates',
  'partTypes',
  'partDesignations',
  'sortiesExterne',
  'sortieDemands',
] as const;

const ALLOWED_ENTITY_SET = new Set<string>(ALLOWED_ENTITIES);
const OBJECT_ENTITY_SET = new Set<string>([
  'correctiveActionsByPanne',
  'correctivePanneCategories',
]);

async function startServer() {
  const app = express();
  const portArgIdx = process.argv.indexOf('--port');
  const cliPort = portArgIdx !== -1 && process.argv[portArgIdx + 1] ? Number(process.argv[portArgIdx + 1]) : null;
  const PORT = cliPort || Number(process.env.GMAO_PORT) || 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(cors());
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

  // Reference to dbState for RBAC cross-checks before dbState is populated below
  let dbStateRef: Record<string, any> = {};

  // API Authentication & RBAC Middleware
  const authenticateApi = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const token = req.headers['x-gmao-api-token'];
      const clientOrigin = req.headers['x-gmao-client-origin'];
      const expectedToken = process.env.GMAO_API_TOKEN;
      const strictToken = process.env.GMAO_STRICT_TOKEN === 'true';

      // Reject immediately if an explicit token header is provided and does not match expectedToken
      if (expectedToken && token !== undefined && token !== expectedToken) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'API Token invalide ou manquant.',
        });
      }

      const tokenValid = !expectedToken || token === expectedToken || (!strictToken && clientOrigin === 'gmao-web-client');
      if (!tokenValid) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'API Token invalide ou manquant.',
        });
      }

      // Server-side RBAC enforcement: cross-check x-gmao-role & x-gmao-actor against dbState.users / technicians
      const roleHeader = req.headers['x-gmao-role'];
      const actorHeader = req.headers['x-gmao-actor'] || req.headers['x-gmao-actor-id'];
      if (
        (typeof roleHeader === 'string' && roleHeader.trim().length > 0) ||
        (typeof actorHeader === 'string' && actorHeader.trim().length > 0)
      ) {
        const resolvedActor = resolveEffectiveServerRole(
          req.headers as Record<string, unknown>,
          dbStateRef.users,
          dbStateRef.technicians
        );
        const role = normalizeServerRole(resolvedActor.effectiveRole);
        (req as any).resolvedServerActor = resolvedActor;

        if (role === 'VIEWER') {
          return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: resolvedActor.isArchivedActor
              ? 'Actor profile is archived/inactive and cannot modify server state.'
              : 'Role VIEWER is read-only and cannot modify server state.',
          });
        }

        const pathParts = req.path.split('/').filter(Boolean);
        const targetEntity = pathParts[0] || '';
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
    }
    next();
  };
  app.use('/api/gmao', authenticateApi);

  // Enterprise In-Memory Rate Limiting (Token Bucket / Sliding Window)
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
  const MAX_REQUESTS_PER_WINDOW = 300; // 300 req/min for general API

  const apiRateLimiter = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
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

  // OpenAPI 3.0 / Swagger Interactive Documentation
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

  // Data persistence file path
  const DATA_DIR = path.join(__dirname, 'data');
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
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
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
    const headerActor = req.headers['x-gmao-actor'];
    if (typeof headerActor === 'string' && headerActor.trim().length > 0) {
      return headerActor.trim().slice(0, 120);
    }
    return 'web-operator';
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'GMAO Enterprise Backend API',
      timestamp: new Date().toISOString(),
      version: dbState.version,
      storage: 'Atomic JSON File + Serialized Memory Engine',
    });
  });

  // LAN Host Network Discovery Endpoint (P3.1 & P3.2)
  app.get('/api/network/info', (req, res) => {
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
        platform: os.platform(),
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

  // Get full GMAO state
  app.get('/api/gmao/state', (req, res) => {
    res.setHeader('ETag', `W/"v${dbState.version}"`);
    res.json({
      success: true,
      version: dbState.version,
      updatedAt: dbState.updatedAt,
      data: dbState,
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
          data: dbState,
        });
      }

      const resolvedActor =
        (req as any).resolvedServerActor ||
        resolveEffectiveServerRole(
          req.headers as Record<string, unknown>,
          dbState.users,
          dbState.technicians
        );
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

      const effectiveIncomingState = bulkCheck.sanitizedState;

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
        data: isSmartMergeRequest || preserveServerOnlyItems ? dbState : undefined,
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
    return res.json({ success: true, version: dbState.version, data: dbState[entity] });
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

  // Setup Vite or static serving
  if (!isProduction) {
    let viteInstance: any = null;
    const viteReadyPromise = import('vite')
      .then(({ createServer: createViteServer }) =>
        createViteServer({
          server: { middlewareMode: true, hmr: false },
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
          next(new Error('Vite middleware is unavailable'));
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

  const httpServer = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`🚀 GMAO Enterprise Server running on http://localhost:${PORT}`);
  });

  httpServer.on('error', (err) => {
    console.error('[Server] HTTP server error:', err);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
