import type express from 'express';
import type { LoginThrottleEntry, ServerSessionStore, SseTicketEntry } from '../types';

export interface RateLimitController {
  apiRateLimiter: express.RequestHandler;
  loginThrottleMap: Map<string, LoginThrottleEntry>;
  sseTickets: Map<string, SseTicketEntry>;
  sseTicketTtlMs: number;
  pruneSecurityCaches: (nowMs: number) => void;
  dispose: () => void;
}

/**
 * Creates bounded in-memory rate-limiting, login throttling, and single-use SSE ticket caches
 * with deterministic background pruning and clean shutdown disposal.
 *
 * Client IPs default to `socket.remoteAddress` unless `GMAO_TRUST_PROXY=true` so attackers
 * cannot bypass per-IP rate limits by spoofing `X-Forwarded-For`.
 */
export function createSecurityCacheController(sessionStore: ServerSessionStore): RateLimitController {
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW_MS = 60 * 1000;
  const MAX_REQUESTS_PER_WINDOW = 300;

  const loginThrottleMap = new Map<string, LoginThrottleEntry>();
  const sseTickets = new Map<string, SseTicketEntry>();
  const sseTicketTtlMs = 30 * 1000;

  const pruneSecurityCaches = (nowMs: number) => {
    const nowSec = Math.floor(nowMs / 1000);
    for (const [key, entry] of rateLimitMap.entries()) {
      if (nowMs > entry.resetTime) {
        rateLimitMap.delete(key);
      }
    }
    if (sessionStore.pruneExpired(nowSec)) {
      void sessionStore.persistAsync();
    }
    for (const [key, entry] of loginThrottleMap.entries()) {
      if (nowMs > entry.resetAt && nowMs > entry.lockUntil) {
        loginThrottleMap.delete(key);
      }
    }
    for (const [ticket, entry] of sseTickets.entries()) {
      if (nowMs > entry.exp) {
        sseTickets.delete(ticket);
      }
    }
  };

  const rateLimitCleanupTimer = setInterval(() => {
    pruneSecurityCaches(Date.now());
  }, RATE_LIMIT_WINDOW_MS);
  if (typeof rateLimitCleanupTimer.unref === 'function') {
    rateLimitCleanupTimer.unref();
  }

  const apiRateLimiter: express.RequestHandler = (req, res, next) => {
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

    let clientData = rateLimitMap.get(clientIp);
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS };
      rateLimitMap.set(clientIp, clientData);
    } else {
      clientData.count += 1;
    }

    const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - clientData.count);
    res.setHeader('X-RateLimit-Limit', String(MAX_REQUESTS_PER_WINDOW));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(clientData.resetTime / 1000)));

    if (clientData.count > MAX_REQUESTS_PER_WINDOW) {
      res.setHeader('Retry-After', '60');
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: 'Taux de requêtes dépassé. Veuillez patienter 60 secondes.',
      });
    }

    return next();
  };

  const dispose = () => {
    clearInterval(rateLimitCleanupTimer);
    rateLimitMap.clear();
    loginThrottleMap.clear();
    sseTickets.clear();
  };

  return {
    apiRateLimiter,
    loginThrottleMap,
    sseTickets,
    sseTicketTtlMs,
    pruneSecurityCaches,
    dispose,
  };
}
