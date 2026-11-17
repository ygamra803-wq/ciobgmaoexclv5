import type { IncomingHttpHeaders } from 'http';
import os from 'os';
import type express from 'express';
import cors from 'cors';
import { isAllowedCorsOrigin } from '../../core/security/serverRbacPolicy';
import { randomBytesHex } from '../../core/security/nativeCrypto';
import { MAX_STATE_PAYLOAD_LIMIT } from '../types';

/**
 * Builds the Content-Security-Policy header value.
 * Production HTML responses attach a per-request cryptographic nonce instead of `unsafe-inline`.
 */
export function buildCspHeaderValue(params: {
  isProduction: boolean;
  nonce?: string;
  isHtml?: boolean;
}): string {
  const scriptSrc = params.isProduction
    ? params.isHtml && params.nonce
      ? `'self' 'nonce-${params.nonce}'`
      : `'self'`
    : `'self' 'unsafe-inline'`;
  return `default-src 'self' blob: data:; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://api.dicebear.com https://fonts.gstatic.com https://www.gstatic.com; connect-src 'self' blob: data: https://fonts.googleapis.com https://fonts.gstatic.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self';`;
}

/**
 * Injects per-request CSP nonces into inline/external `<script>` tags and updates any static CSP meta tag.
 */
export function renderHtmlWithCspNonce(html: string, nonce: string): string {
  const cspLine = buildCspHeaderValue({ isProduction: true, nonce, isHtml: true });
  let out = html.replace(/<script\b(?![^>]*\bnonce=)/gi, `<script nonce="${nonce}"`);
  out = out.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']Content-Security-Policy["'][^>]*>/i,
    `<meta http-equiv="Content-Security-Policy" content="${cspLine.replace(/"/g, '&quot;')}">`
  );
  return out;
}

/**
 * Enumerates active IPv4 addresses bound to the local host so dynamic LAN origins are permitted by CORS.
 */
export function collectHostIpv4Addresses(): Set<string> {
  const ips = new Set<string>(['127.0.0.1', 'localhost', '::1']);
  try {
    const nets = os.networkInterfaces();
    for (const netList of Object.values(nets)) {
      if (!Array.isArray(netList)) continue;
      for (const net of netList) {
        const family = (net as { family: string | number }).family;
        const isIPv4 = family === 'IPv4' || family === 4;
        if (isIPv4 && net.address) {
          ips.add(net.address.toLowerCase());
        }
      }
    }
  } catch {
    // ignore interface enumeration errors in constrained environments
  }
  return ips;
}

function isSameHostProxyOrigin(origin: string | undefined, reqHeaders: IncomingHttpHeaders): boolean {
  if (!origin) return false;
  const cleanOrigin = origin.trim();
  if (!cleanOrigin || cleanOrigin === 'null') return false;

  try {
    const parsedOrigin = new URL(cleanOrigin);
    if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
      return false;
    }

    const directHost = String(reqHeaders.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const forwardedHost = String(reqHeaders['x-forwarded-host'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();

    const isLoopbackDirectHost =
      directHost === 'localhost' ||
      directHost.startsWith('localhost:') ||
      directHost === '127.0.0.1' ||
      directHost.startsWith('127.0.0.1:') ||
      directHost === '[::1]' ||
      directHost.startsWith('[::1]:');

    const effectiveHost = isLoopbackDirectHost && forwardedHost ? forwardedHost : directHost;
    if (!effectiveHost) return false;

    const normalizedEffectiveHost =
      parsedOrigin.protocol === 'https:'
        ? effectiveHost.replace(/:443$/, '')
        : effectiveHost.replace(/:80$/, '');

    return parsedOrigin.host.toLowerCase() === normalizedEffectiveHost;
  } catch {
    return false;
  }
}

export function createLanCorsMiddleware(port: number): express.RequestHandler {
  const serverHostIps = collectHostIpv4Addresses();
  const extraAllowedOrigins = new Set<string>(
    String(process.env.GMAO_CORS_ORIGINS || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  );

  const baseCorsOptions: Omit<cors.CorsOptions, 'origin'> = {
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
  };

  return cors((req, callback) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
    const allowed =
      isSameHostProxyOrigin(origin, req.headers) ||
      isAllowedCorsOrigin(origin, extraAllowedOrigins, serverHostIps, Number(port) || 3000);
    callback(null, {
      ...baseCorsOptions,
      origin: allowed,
    });
  }) as express.RequestHandler;
}

interface ExpressJsonError extends Error {
  type?: string;
  status?: number;
}

export const jsonPayloadErrorMiddleware: express.ErrorRequestHandler = (err, _req, res, next) => {
  const typedErr = err as ExpressJsonError | null;
  if (typedErr?.type === 'entity.too.large' || typedErr?.status === 413) {
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
  return next(err);
};

export function createSecurityHeadersMiddleware(isProduction: boolean): express.RequestHandler {
  return (_req, res, next) => {
    const nonce = isProduction ? randomBytesHex(16) : '';
    res.locals = res.locals || {};
    res.locals.cspNonce = nonce;
    res.setHeader(
      'Content-Security-Policy',
      buildCspHeaderValue({ isProduction, nonce, isHtml: false })
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  };
}
