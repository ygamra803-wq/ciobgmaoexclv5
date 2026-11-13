/**
 * Server-Issued HMAC-SHA256 Session Tokens & Credential Proof Helpers (SEC-LAN-P1)
 *
 * Zero-dependency cryptographic session issuance, verification, revocation, and
 * server-side credential verification using `nativeCrypto.ts` primitives.
 * Works identically across Node.js (`server.ts`) and browser/Vitest environments.
 */

import {
  bytesToBase64,
  base64ToBytes,
  constantTimeEqual,
  hmacSha256Hex,
  pbkdf2Sha256Hex,
  randomBytesHex,
  sha256Hex,
} from './nativeCrypto';

export { constantTimeEqual };

export const SERVER_SESSION_STORAGE_KEY = 'gmao_server_session_v1';
export const DEFAULT_SERVER_SESSION_TTL_SECONDS = 10 * 60 * 60; // 10 hours
export const SENSITIVE_ROLES_SET = new Set<string>(['ADMIN', 'RESPONSABLE_MAINTENANCE']);
export const DEFAULT_MAX_SESSIONS_SENSITIVE = 1;
export const DEFAULT_MAX_SESSIONS_STANDARD = 3;

export function getMaxConcurrentSessionsForRole(role: string): number {
  const normalized = String(role || 'VIEWER').trim().toUpperCase();
  return SENSITIVE_ROLES_SET.has(normalized)
    ? DEFAULT_MAX_SESSIONS_SENSITIVE
    : DEFAULT_MAX_SESSIONS_STANDARD;
}

export const PROHIBITED_DEFAULT_PASSWORDS = new Set<string>([
  'admin',
  'magasinier',
  'viewer',
  'tech',
  '1234',
]);

const WEAK_SESSION_SECRETS = new Set<string>([
  '',
  'empty',
  'change-me',
  'changeme',
  'secret',
  'gmao',
  '1234',
  '123456',
  'admin',
  'password',
  'default',
  'token',
  'gmao_secret',
]);

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export interface ServerSessionPayload {
  sub: string;
  role: string;
  name: string;
  sid: string;
  iat: number;
  exp: number;
}

export type ServerSessionVerifyReason =
  | 'MISSING'
  | 'MALFORMED'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED'
  | 'REVOKED';

export interface ServerSessionVerifyResult {
  valid: boolean;
  reason?: ServerSessionVerifyReason;
  payload?: ServerSessionPayload;
}



function toBase64Url(input: string): string {
  const bytes = utf8Encoder.encode(input);
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(b64Url: string): string {
  const normalized = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  return utf8Decoder.decode(base64ToBytes(padded));
}

export function isWeakOrEmptySessionSecret(secret: unknown): boolean {
  if (typeof secret !== 'string') return true;
  const clean = secret.trim();
  if (clean.length < 16) return true;
  return WEAK_SESSION_SECRETS.has(clean.toLowerCase());
}

/**
 * Safely decodes the unverified payload of a `GMAO1.` token on the client solely
 * to inspect `exp`/`iat` for proactive refresh scheduling (never used for trust decisions).
 */
export function parseServerSessionPayloadUnsafe(token: string): ServerSessionPayload | null {
  try {
    const clean = typeof token === 'string' ? token.trim() : '';
    const parts = clean.split('.');
    if (parts.length !== 3 || parts[0] !== 'GMAO1' || !parts[1]) return null;
    const parsed = JSON.parse(fromBase64Url(parts[1]));
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.sub !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.iat !== 'number'
    ) {
      return null;
    }
    return parsed as ServerSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Resolves the server HMAC signing key with zero hardcoded fallback secrets:
 *  1. Explicit `GMAO_SESSION_SECRET` (if >= 16 chars and not weak).
 *  2. In `isProduction === true`, silent derivation / ephemeral keys are disabled:
 *     returns `MISSING_PRODUCTION_SECRET` so session issuance fails closed.
 *  3. In development: HMAC derivation from strong `GMAO_API_TOKEN`, then per-process CSPRNG key.
 */
export function resolveServerSessionSecret(params: {
  explicitSecret?: string;
  apiToken?: string;
  fallbackInstanceSecret?: string;
  isProduction?: boolean;
} = {}): {
  secret: string;
  source:
    | 'ENV_SESSION_SECRET'
    | 'DERIVED_FROM_API_TOKEN'
    | 'EPHEMERAL_INSTANCE'
    | 'MISSING_PRODUCTION_SECRET';
  missingInProduction?: boolean;
} {
  const explicit = typeof params.explicitSecret === 'string' ? params.explicitSecret.trim() : '';
  if (!isWeakOrEmptySessionSecret(explicit)) {
    return { secret: explicit, source: 'ENV_SESSION_SECRET' };
  }

  if (params.isProduction) {
    return {
      secret: '',
      source: 'MISSING_PRODUCTION_SECRET',
      missingInProduction: true,
    };
  }

  const apiToken = typeof params.apiToken === 'string' ? params.apiToken.trim() : '';
  if (apiToken.length >= 8 && !WEAK_SESSION_SECRETS.has(apiToken.toLowerCase())) {
    return {
      secret: hmacSha256Hex('gmao-lan-server-session-key-v1', apiToken),
      source: 'DERIVED_FROM_API_TOKEN',
    };
  }

  const fallback =
    typeof params.fallbackInstanceSecret === 'string' && params.fallbackInstanceSecret.trim().length >= 16
      ? params.fallbackInstanceSecret.trim()
      : randomBytesHex(32);

  return {
    secret: fallback,
    source: 'EPHEMERAL_INSTANCE',
  };
}

/**
 * Signs a server-issued session token (`GMAO1.<payloadB64Url>.<hmacSha256Hex>`).
 */
export function signServerSession(
  input: {
    sub: string;
    role: string;
    name?: string;
    ttlSeconds?: number;
    sid?: string;
  },
  secret: string,
  nowSec = Math.floor(Date.now() / 1000)
): { token: string; payload: ServerSessionPayload } {
  const cleanSub = String(input.sub || '').trim();
  if (!cleanSub) {
    throw new Error('Cannot sign server session without subject (sub).');
  }
  if (!secret || secret.length < 16) {
    throw new Error('Server session signing secret must be at least 16 characters.');
  }

  const ttl =
    typeof input.ttlSeconds === 'number' && Number.isFinite(input.ttlSeconds) && input.ttlSeconds > 0
      ? Math.floor(input.ttlSeconds)
      : DEFAULT_SERVER_SESSION_TTL_SECONDS;

  const payload: ServerSessionPayload = {
    sub: cleanSub,
    role: String(input.role || 'VIEWER').trim().toUpperCase(),
    name: String(input.name || cleanSub).trim().slice(0, 120),
    sid: String(input.sid || randomBytesHex(16)),
    iat: Math.floor(nowSec),
    exp: Math.floor(nowSec) + ttl,
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signingInput = `GMAO1.${encodedPayload}`;
  const signatureHex = hmacSha256Hex(signingInput, secret);
  return {
    token: `${signingInput}.${signatureHex}`,
    payload,
  };
}

/**
 * Verifies a server-issued session token's HMAC signature, expiration, and revocation status.
 */
export function verifyServerSession(
  token: string,
  secret: string,
  options: {
    nowSec?: number;
    revokedSessionIds?: Map<string, number> | Set<string>;
  } = {}
): ServerSessionVerifyResult {
  const cleanToken = typeof token === 'string' ? token.trim() : '';
  if (!cleanToken) {
    return { valid: false, reason: 'MISSING' };
  }

  const parts = cleanToken.split('.');
  if (parts.length !== 3 || parts[0] !== 'GMAO1' || !parts[1] || !parts[2]) {
    return { valid: false, reason: 'MALFORMED' };
  }

  const [, encodedPayload, providedSigHex] = parts;
  if (!/^[0-9a-f]{64}$/i.test(providedSigHex)) {
    return { valid: false, reason: 'MALFORMED' };
  }

  const expectedSigHex = hmacSha256Hex(`GMAO1.${encodedPayload}`, secret);
  if (!constantTimeEqual(providedSigHex.toLowerCase(), expectedSigHex.toLowerCase())) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    return { valid: false, reason: 'MALFORMED' };
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    typeof parsed.sub !== 'string' ||
    !parsed.sub.trim() ||
    typeof parsed.role !== 'string' ||
    typeof parsed.sid !== 'string' ||
    !parsed.sid.trim() ||
    typeof parsed.iat !== 'number' ||
    typeof parsed.exp !== 'number'
  ) {
    return { valid: false, reason: 'MALFORMED' };
  }

  const nowSec = typeof options.nowSec === 'number' ? options.nowSec : Math.floor(Date.now() / 1000);
  if (nowSec >= parsed.exp) {
    return { valid: false, reason: 'EXPIRED', payload: parsed as ServerSessionPayload };
  }

  if (options.revokedSessionIds && options.revokedSessionIds.has(parsed.sid)) {
    return { valid: false, reason: 'REVOKED', payload: parsed as ServerSessionPayload };
  }

  return {
    valid: true,
    payload: {
      sub: parsed.sub.trim(),
      role: parsed.role.trim().toUpperCase(),
      name: String(parsed.name || parsed.sub).trim(),
      sid: parsed.sid.trim(),
      iat: parsed.iat,
      exp: parsed.exp,
    },
  };
}

/**
 * Extracts a server session token from `Authorization: Bearer <token>` or `X-GMAO-SESSION`.
 */
export function extractServerSessionToken(headers: Record<string, unknown> | undefined): string {
  if (!headers || typeof headers !== 'object') return '';

  let authHeader = '';
  let sessionHeader = '';
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    const raw = Array.isArray(value) ? value[0] : value;
    const str = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw).trim() : '';
    if (lower === 'authorization') authHeader = str;
    if (lower === 'x-gmao-session') sessionHeader = str;
  }

  if (authHeader) {
    const match = /^Bearer\s+(.+)$/i.exec(authHeader);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return sessionHeader;
}

/**
 * Verifies plain password credentials against a stored account record (`passwordHash`).
 * Supports:
 *  - `pbkdf2:v1:<saltHex>:<iterations>:<hashHex>`
 *  - Dev bootstrap seed hashes (`:admin_init_seed`, `:mag_init_seed`, `:viewer_init_seed`, `:tech_init_seed`)
 *  - Legacy 64-hex SHA-256 digests
 * Rejects prohibited default passwords and init-seed hashes in production mode.
 */
export function verifyAccountCredentials(
  account: any,
  plainPassword: string,
  isProduction: boolean
): { valid: boolean; reason?: string; isDefaultSeed?: boolean } {
  const cleanPass = String(plainPassword || '').trim();
  if (!account || typeof account !== 'object' || !cleanPass) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }

  const hashStr = String(account.passwordHash || '').trim();
  if (!hashStr) {
    return { valid: false, reason: 'NO_CREDENTIAL_HASH' };
  }

  const isSeedHashMatch =
    (hashStr.endsWith(':admin_init_seed') && cleanPass === 'admin') ||
    (hashStr.endsWith(':mag_init_seed') && cleanPass === 'magasinier') ||
    (hashStr.endsWith(':viewer_init_seed') && cleanPass === 'viewer') ||
    (hashStr.endsWith(':tech_init_seed') && (cleanPass === 'tech' || cleanPass === '1234'));

  let isCryptographicMatch = false;

  if (hashStr.startsWith('pbkdf2:v1:') && !isSeedHashMatch) {
    const parts = hashStr.split(':');
    if (parts.length === 5) {
      const [, , saltHex, iterStr, expectedHashHex] = parts;
      const iterations = Math.min(Math.max(parseInt(iterStr, 10) || 100000, 1), 1000000);
      if (/^[0-9a-f]+$/i.test(saltHex) && /^[0-9a-f]+$/i.test(expectedHashHex)) {
        const derivedHex = pbkdf2Sha256Hex(cleanPass, saltHex, iterations, 32);
        isCryptographicMatch = constantTimeEqual(
          derivedHex.toLowerCase(),
          expectedHashHex.toLowerCase()
        );
      }
    }
  } else if (hashStr.length === 64 && /^[0-9a-f]+$/i.test(hashStr)) {
    const digest = sha256Hex(cleanPass);
    isCryptographicMatch = constantTimeEqual(digest.toLowerCase(), hashStr.toLowerCase());
  }

  if (!isSeedHashMatch && !isCryptographicMatch) {
    return { valid: false, reason: 'INVALID_CREDENTIALS' };
  }

  const isProhibitedDefault =
    isSeedHashMatch || PROHIBITED_DEFAULT_PASSWORDS.has(cleanPass.toLowerCase());

  if (isProhibitedDefault && isProduction) {
    return {
      valid: false,
      reason: 'PROHIBITED_DEFAULT_PASSWORD_IN_PROD',
      isDefaultSeed: true,
    };
  }

  return {
    valid: true,
    isDefaultSeed: isProhibitedDefault,
  };
}

const ACCOUNT_SENSITIVE_ENTITIES = new Set<string>(['users', 'technicians', 'authAccounts']);

/**
 * Strips credential secrets (`passwordHash`, `defaultPass`, `pinHash`, `pin`,
 * `resetToken`, `securityAnswer`, `secret`, `apiKey`) before returning
 * account or personnel records over HTTP GET responses.
 */
export function stripSensitiveAccountFields(entityKey: string, data: any): any {
  if (!ACCOUNT_SENSITIVE_ENTITIES.has(entityKey) || !Array.isArray(data)) {
    return data;
  }
  return data.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const {
      passwordHash: _ph,
      defaultPass: _dp,
      pinHash: _pinHash,
      pin: _pin,
      resetToken: _rt,
      securityAnswer: _sa,
      secret: _sec,
      apiKey: _ak,
      ...safe
    } = item;
    return safe;
  });
}

/**
 * Produces a shallow transport-safe copy of `dbState` with all credential hashes stripped.
 * If `includeProtectedCollections` is false (unauthenticated read), `authAccounts`, `users`,
 * and `auditEvents` are redacted to empty arrays.
 */
export function sanitizeStateSnapshotForTransport(
  state: Record<string, any>,
  options: { includeProtectedCollections?: boolean } = {}
): Record<string, any> {
  const includeProtected = options.includeProtectedCollections !== false;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(state || {})) {
    if (!includeProtected && (key === 'authAccounts' || key === 'users' || key === 'auditEvents')) {
      out[key] = [];
      continue;
    }
    out[key] = stripSensitiveAccountFields(key, value);
  }
  return out;
}

export function getClientServerSessionToken(): string {
  try {
    if (typeof sessionStorage === 'undefined') return '';
    return String(sessionStorage.getItem(SERVER_SESSION_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setClientServerSessionToken(token: string): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    const clean = String(token || '').trim();
    if (clean) {
      sessionStorage.setItem(SERVER_SESSION_STORAGE_KEY, clean);
    } else {
      sessionStorage.removeItem(SERVER_SESSION_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function clearClientServerSessionToken(): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.removeItem(SERVER_SESSION_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
