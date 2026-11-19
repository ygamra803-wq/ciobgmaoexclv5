import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { randomBytesHex } from '../../core/security/nativeCrypto.ts';
import { normalizeServerRole } from '../../core/security/serverRbacPolicy.ts';
import {
  buildCspHeaderValue,
  renderHtmlWithCspNonce,
} from '../middleware/securityHeaders.ts';
import type {
  GmaoApiRequest,
  GmaoDbState,
  SqliteBackupResult,
  SqliteStorageInfo,
  SseTicketEntry,
} from '../types.ts';

/**
 * Mounts health diagnostics, LAN network discovery, lightweight revision polling,
 * SQLite database diagnostics/backups, ticketed SSE broadcast stream, and production static SPA serving.
 */
export function createSystemRoutesController(deps: {
  app: express.Application;
  dbState: GmaoDbState;
  port: number;
  sseTickets: Map<string, SseTicketEntry>;
  sseTicketTtlMs: number;
  pruneSecurityCaches: (nowMs: number) => void;
  authenticateApi: express.RequestHandler;
  storageDescriptor?: string;
  getStorageInfo?: () => SqliteStorageInfo;
  createHotBackup?: () => Promise<SqliteBackupResult>;
}) {
  const {
    app,
    dbState,
    port,
    sseTickets,
    sseTicketTtlMs,
    pruneSecurityCaches,
    authenticateApi,
    storageDescriptor,
    getStorageInfo,
    createHotBackup,
  } = deps;

  const sseClients = new Set<express.Response>();

  const broadcastSseEvent = (eventPayload: Record<string, unknown>) => {
    const frame = `data: ${JSON.stringify(eventPayload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  const healthHandler: express.RequestHandler = (_req, res) => {
    const info = getStorageInfo?.();
    res.json({
      status: 'healthy',
      service: 'GMAO Enterprise Backend API',
      timestamp: new Date().toISOString(),
      version: dbState.version,
      storage: storageDescriptor || 'SQLite Single-File ACID Engine (WAL)',
      storageEngine: info?.engine || 'sqlite',
      journalMode: info?.journalMode || 'WAL',
    });
  };

  const dbInfoHandler: express.RequestHandler = (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const role = normalizeServerRole(gmaoReq.resolvedServerActor?.effectiveRole);
    if (!gmaoReq.resolvedServerActor?.sessionVerified || (role !== 'ADMIN' && role !== 'RESPONSABLE_MAINTENANCE')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Verified ADMIN or RESPONSABLE_MAINTENANCE session required to inspect database info.',
      });
    }
    if (!getStorageInfo) {
      return res.status(404).json({
        success: false,
        message: 'Database diagnostics unavailable.',
      });
    }
    return res.json({
      success: true,
      data: getStorageInfo(),
    });
  };

  const dbBackupHandler: express.RequestHandler = async (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const role = normalizeServerRole(gmaoReq.resolvedServerActor?.effectiveRole);
    if (!gmaoReq.resolvedServerActor?.sessionVerified || (role !== 'ADMIN' && role !== 'RESPONSABLE_MAINTENANCE')) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Verified ADMIN or RESPONSABLE_MAINTENANCE session required to create database backups.',
      });
    }
    if (!createHotBackup) {
      return res.status(400).json({
        success: false,
        code: 'BACKUP_UNSUPPORTED_ENGINE',
        message: 'Online SQLite VACUUM INTO backup is only available when the SQLite engine is active.',
      });
    }
    try {
      const backup = await createHotBackup();
      return res.status(201).json({
        success: true,
        data: backup,
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        code: 'BACKUP_FAILED',
        message: err instanceof Error ? err.message : 'Failed to create SQLite hot backup',
      });
    }
  };

  const networkInfoHandler: express.RequestHandler = (_req, res) => {
    try {
      const nets = os.networkInterfaces();
      const interfaces: Array<{ name: string; address: string; netmask: string; family: string }> = [];

      for (const [name, netList] of Object.entries(nets)) {
        if (!Array.isArray(netList)) continue;
        for (const net of netList) {
          const family = (net as { family: string | number }).family;
          const isIPv4 = family === 'IPv4' || family === 4;
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

      const preferred = interfaces.find(
        (iface) =>
          iface.address.startsWith('192.168.') ||
          iface.address.startsWith('10.') ||
          /^172\.(1[6-9]|2\d|3[0-1])\./.test(iface.address)
      );
      const primaryIp = preferred?.address || interfaces[0]?.address || '127.0.0.1';
      const hostPort = Number(port) || 3000;
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
    } catch (err) {
      return res.status(500).json({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to inspect network interfaces',
      });
    }
  };

  const revisionHandler: express.RequestHandler = (_req, res) => {
    res.setHeader('ETag', `W/"v${dbState.version}"`);
    return res.json({
      success: true,
      version: dbState.version,
      updatedAt: dbState.updatedAt,
    });
  };

  const issueSseTicketHandler: express.RequestHandler = (req, res) => {
    const gmaoReq = req as GmaoApiRequest;
    const now = Date.now();
    if (sseTickets.size >= 1000) {
      pruneSecurityCaches(now);
      if (sseTickets.size >= 1000) {
        const oldestKey = sseTickets.keys().next().value;
        if (oldestKey) sseTickets.delete(oldestKey);
      }
    }
    const ticket = randomBytesHex(24);
    const resolvedActor = gmaoReq.resolvedServerActor;
    sseTickets.set(ticket, {
      sub: String(resolvedActor?.actorId || 'bootstrap'),
      role: String(resolvedActor?.effectiveRole || 'VIEWER'),
      ip: String(req.socket?.remoteAddress || req.ip || 'unknown'),
      exp: now + sseTicketTtlMs,
    });
    return res.json({
      success: true,
      ticket,
      expiresIn: Math.floor(sseTicketTtlMs / 1000),
    });
  };

  const sseStreamHandler: express.RequestHandler = (req, res) => {
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
  };

  const mountRoutes = () => {
    app.get('/api/health', healthHandler);
    app.get('/api/gmao/health', healthHandler);
    app.get('/api/network/info', authenticateApi, networkInfoHandler);
    app.get('/api/gmao/revision', revisionHandler);
    app.get('/api/gmao/db/info', dbInfoHandler);
    app.post('/api/gmao/db/backup', dbBackupHandler);
    app.post('/api/gmao/events/ticket', issueSseTicketHandler);
    app.get('/api/gmao/events', sseStreamHandler);
  };

  const mountProductionStaticWithCspNonce = (distDirectory: string) => {
    const resolvedDist = path.resolve(distDirectory);
    if (!fs.existsSync(resolvedDist)) return;

    // Neutralize any previously registered VitePWA /sw.js so only /service-worker.js operates in production
    app.get(['/sw.js', '/registerSW.js'], (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.send(
        `self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('workbox-precache')).map((k) => caches.delete(k)));
      await self.registration.unregister();
    } catch {}
  })());
  self.clients.claim();
});`
      );
    });

    app.use(expressStaticMiddleware(resolvedDist));
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      const indexFile = path.join(resolvedDist, 'index.html');
      if (!fs.existsSync(indexFile)) {
        return res.status(404).send('Not Found');
      }
      try {
        const rawHtml = fs.readFileSync(indexFile, 'utf-8');
        const nonce = String(res.locals?.cspNonce || randomBytesHex(16));
        res.setHeader(
          'Content-Security-Policy',
          buildCspHeaderValue({ isProduction: true, nonce, isHtml: true })
        );
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(renderHtmlWithCspNonce(rawHtml, nonce));
      } catch (err) {
        return next(err);
      }
    });
  };

  const closeAllSseClients = () => {
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // ignore close error
      }
    }
    sseClients.clear();
  };

  return {
    mountRoutes,
    broadcastSseEvent,
    mountProductionStaticWithCspNonce,
    closeAllSseClients,
  };
}

function expressStaticMiddleware(resolvedDist: string): express.RequestHandler {
  return express.static(resolvedDist, { index: false });
}
