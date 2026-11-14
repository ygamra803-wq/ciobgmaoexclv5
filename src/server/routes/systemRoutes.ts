import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { randomBytesHex } from '../../core/security/nativeCrypto';
import {
  buildCspHeaderValue,
  renderHtmlWithCspNonce,
} from '../middleware/securityHeaders';
import type { GmaoApiRequest, GmaoDbState, SseTicketEntry } from '../types';

/**
 * Mounts health diagnostics, LAN network discovery, lightweight revision polling,
 * ticketed SSE broadcast stream, and production static nonced CSP SPA serving.
 */
export function createSystemRoutesController(deps: {
  app: express.Application;
  dbState: GmaoDbState;
  port: number;
  sseTickets: Map<string, SseTicketEntry>;
  sseTicketTtlMs: number;
  pruneSecurityCaches: (nowMs: number) => void;
  authenticateApi: express.RequestHandler;
}) {
  const {
    app,
    dbState,
    port,
    sseTickets,
    sseTicketTtlMs,
    pruneSecurityCaches,
    authenticateApi,
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
    res.json({
      status: 'healthy',
      service: 'GMAO Enterprise Backend API',
      timestamp: new Date().toISOString(),
      version: dbState.version,
      storage: 'Atomic JSON File + Serialized Memory Engine',
    });
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
    app.post('/api/gmao/events/ticket', issueSseTicketHandler);
    app.get('/api/gmao/events', sseStreamHandler);
  };

  const mountProductionStaticWithCspNonce = (distDirectory: string) => {
    const resolvedDist = path.resolve(distDirectory);
    if (!fs.existsSync(resolvedDist)) return;

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
