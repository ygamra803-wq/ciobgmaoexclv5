/**
 * Durable Server Session Revocation, Concurrent Session Limit & Telemetry Store
 * (SEC-LAN-P2 + SEC-LAN-P3)
 *
 * Persists revoked session IDs (`sid -> exp`) and active session lists per `sub`
 * in a lightweight atomic JSON file (`gmao_revoked_sessions.json` via `.tmp` -> `rename`),
 * surviving server process restarts and pruning expired entries periodically.
 */

import fs from 'fs';
import path from 'path';
import { getMaxConcurrentSessionsForRole } from './serverSession';

export interface ActiveSessionEntry {
  sid: string;
  iat: number;
  exp: number;
}

export type SecurityTelemetryEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAIL'
  | 'LOGIN_THROTTLED'
  | 'SESSION_REFRESHED'
  | 'SESSION_REVOKED'
  | 'SESSION_LIMIT_EVICTED'
  | 'SPOOF_DETECTED'
  | 'UNAUTHORIZED_WRITE_BLOCKED';

export interface SecurityTelemetryEvent {
  type: SecurityTelemetryEventType;
  timestamp: string;
  actorId?: string;
  ip?: string;
  detail?: string;
}

export interface SecurityTelemetrySnapshot {
  counters: Record<SecurityTelemetryEventType, number>;
  recentEvents: SecurityTelemetryEvent[];
  revokedCount: number;
  activeTrackedSubjects: number;
}

interface PersistedSessionStoreV1 {
  version: 1;
  updatedAt: string;
  revoked: Record<string, number>;
  activeBySub: Record<string, ActiveSessionEntry[]>;
}

const MAX_RECENT_EVENTS = 100;

export function createServerSessionStore(options: {
  dataDir: string;
  maxSensitiveSessions?: number;
  maxStandardSessions?: number;
}) {
  const storeFile = path.join(options.dataDir, 'gmao_revoked_sessions.json');
  const tmpFile = path.join(options.dataDir, 'gmao_revoked_sessions.json.tmp');

  const revokedSessionIds = new Map<string, number>();
  const activeBySub = new Map<string, ActiveSessionEntry[]>();

  const counters: Record<SecurityTelemetryEventType, number> = {
    LOGIN_SUCCESS: 0,
    LOGIN_FAIL: 0,
    LOGIN_THROTTLED: 0,
    SESSION_REFRESHED: 0,
    SESSION_REVOKED: 0,
    SESSION_LIMIT_EVICTED: 0,
    SPOOF_DETECTED: 0,
    UNAUTHORIZED_WRITE_BLOCKED: 0,
  };
  const recentEvents: SecurityTelemetryEvent[] = [];

  let writeChain: Promise<void> = Promise.resolve();

  const recordSecurityEvent = (
    type: SecurityTelemetryEventType,
    meta: { actorId?: string; ip?: string; detail?: string } = {}
  ) => {
    counters[type] = (counters[type] || 0) + 1;
    const entry: SecurityTelemetryEvent = {
      type,
      timestamp: new Date().toISOString(),
      ...(meta.actorId ? { actorId: String(meta.actorId).slice(0, 64) } : {}),
      ...(meta.ip ? { ip: String(meta.ip).slice(0, 64) } : {}),
      ...(meta.detail ? { detail: String(meta.detail).slice(0, 160) } : {}),
    };
    recentEvents.push(entry);
    if (recentEvents.length > MAX_RECENT_EVENTS) {
      recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS);
    }
  };

  const pruneExpired = (nowSec = Math.floor(Date.now() / 1000)): boolean => {
    let changed = false;
    for (const [sid, expSec] of revokedSessionIds.entries()) {
      if (!Number.isFinite(expSec) || nowSec >= expSec) {
        revokedSessionIds.delete(sid);
        changed = true;
      }
    }
    for (const [subKey, list] of activeBySub.entries()) {
      const filtered = list.filter(
        (entry) =>
          entry &&
          entry.sid &&
          Number.isFinite(entry.exp) &&
          nowSec < entry.exp &&
          !revokedSessionIds.has(entry.sid)
      );
      if (filtered.length !== list.length) {
        changed = true;
      }
      if (filtered.length === 0) {
        if (list.length > 0) changed = true;
        activeBySub.delete(subKey);
      } else {
        activeBySub.set(subKey, filtered);
      }
    }
    return changed;
  };

  const serializePayload = (): PersistedSessionStoreV1 => {
    const revoked: Record<string, number> = {};
    for (const [sid, expSec] of revokedSessionIds.entries()) {
      revoked[sid] = expSec;
    }
    const activeObj: Record<string, ActiveSessionEntry[]> = {};
    for (const [subKey, list] of activeBySub.entries()) {
      if (list.length > 0) {
        activeObj[subKey] = list;
      }
    }
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      revoked,
      activeBySub: activeObj,
    };
  };

  // Synchronous atomic write helper for logout/login/refresh so persistence finishes
  // before HTTP response returns (survives immediate process restart in production & tests).
  const persistSync = () => {
    try {
      if (!fs.existsSync(options.dataDir)) {
        fs.mkdirSync(options.dataDir, { recursive: true });
      }
      pruneExpired();
      const serialized = JSON.stringify(serializePayload(), null, 2);
      fs.writeFileSync(tmpFile, serialized, 'utf-8');
      fs.renameSync(tmpFile, storeFile);
    } catch (err) {
      console.error('[Server][SEC-LAN-P2] Failed to persist session revocation store:', err);
    }
  };

  const persistAsync = (): Promise<void> => {
    pruneExpired();
    const serialized = JSON.stringify(serializePayload(), null, 2);
    writeChain = writeChain
      .then(async () => {
        if (!fs.existsSync(options.dataDir)) {
          await fs.promises.mkdir(options.dataDir, { recursive: true });
        }
        await fs.promises.writeFile(tmpFile, serialized, 'utf-8');
        await fs.promises.rename(tmpFile, storeFile);
      })
      .catch((err) => {
        console.error('[Server][SEC-LAN-P2] Async persist error in revocation store:', err);
      });
    return writeChain;
  };

  // Load persisted state at startup and immediately purge expired entries
  const loadFromDisk = () => {
    try {
      if (!fs.existsSync(storeFile)) return;
      const raw = fs.readFileSync(storeFile, 'utf-8');
      const parsed = JSON.parse(raw);
      const nowSec = Math.floor(Date.now() / 1000);
      if (parsed && typeof parsed === 'object') {
        if (parsed.revoked && typeof parsed.revoked === 'object') {
          for (const [sid, exp] of Object.entries(parsed.revoked)) {
            const expNum = Number(exp);
            if (sid && Number.isFinite(expNum) && nowSec < expNum) {
              revokedSessionIds.set(sid, expNum);
            }
          }
        }
        if (parsed.activeBySub && typeof parsed.activeBySub === 'object') {
          for (const [subKey, entries] of Object.entries(parsed.activeBySub)) {
            if (!Array.isArray(entries)) continue;
            const validList = entries
              .filter(
                (item: any) =>
                  item &&
                  typeof item.sid === 'string' &&
                  item.sid.trim() &&
                  typeof item.exp === 'number' &&
                  nowSec < item.exp &&
                  !revokedSessionIds.has(item.sid)
              )
              .map((item: any) => ({
                sid: item.sid.trim(),
                iat: typeof item.iat === 'number' ? item.iat : nowSec,
                exp: item.exp,
              }));
            if (validList.length > 0) {
              activeBySub.set(subKey.toUpperCase(), validList);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Server][SEC-LAN-P2] Failed to load revocation store from disk:', err);
    }
  };

  loadFromDisk();

  const resolveMaxSessions = (role: string): number => {
    const defaultMax = getMaxConcurrentSessionsForRole(role);
    const upper = String(role || 'VIEWER').trim().toUpperCase();
    if (upper === 'ADMIN' || upper === 'RESPONSABLE_MAINTENANCE') {
      return options.maxSensitiveSessions ?? defaultMax;
    }
    return options.maxStandardSessions ?? defaultMax;
  };

  const revokeSession = (
    sid: string,
    expSec: number,
    meta: { sub?: string; actorId?: string; ip?: string; detail?: string; skipEvent?: boolean } = {}
  ) => {
    const cleanSid = String(sid || '').trim();
    if (!cleanSid) return;
    revokedSessionIds.set(cleanSid, Number.isFinite(expSec) ? expSec : Math.floor(Date.now() / 1000) + 3600);
    if (meta.sub) {
      const subKey = meta.sub.trim().toUpperCase();
      const current = activeBySub.get(subKey) || [];
      const next = current.filter((e) => e.sid !== cleanSid);
      if (next.length > 0) activeBySub.set(subKey, next);
      else activeBySub.delete(subKey);
    } else {
      for (const [subKey, list] of activeBySub.entries()) {
        const next = list.filter((e) => e.sid !== cleanSid);
        if (next.length !== list.length) {
          if (next.length > 0) activeBySub.set(subKey, next);
          else activeBySub.delete(subKey);
        }
      }
    }
    if (!meta.skipEvent) {
      recordSecurityEvent('SESSION_REVOKED', {
        actorId: meta.actorId || meta.sub,
        ip: meta.ip,
        detail: meta.detail || 'Session explicitly revoked',
      });
    }
    persistSync();
  };

  const registerIssuedSession = (params: {
    sub: string;
    role: string;
    sid: string;
    iat: number;
    exp: number;
    ip?: string;
  }): { evictedSids: string[] } => {
    const subKey = String(params.sub || '').trim().toUpperCase();
    const maxSessions = Math.max(1, resolveMaxSessions(params.role));
    const nowSec = Math.floor(Date.now() / 1000);

    const existing = (activeBySub.get(subKey) || []).filter(
      (entry) => nowSec < entry.exp && !revokedSessionIds.has(entry.sid) && entry.sid !== params.sid
    );
    existing.sort((a, b) => a.iat - b.iat);

    const evictedSids: string[] = [];
    while (existing.length >= maxSessions) {
      const oldest = existing.shift();
      if (oldest) {
        revokedSessionIds.set(oldest.sid, oldest.exp);
        evictedSids.push(oldest.sid);
        recordSecurityEvent('SESSION_LIMIT_EVICTED', {
          actorId: params.sub,
          ip: params.ip,
          detail: `Evicted oldest session due to concurrent limit (${maxSessions})`,
        });
      }
    }

    existing.push({ sid: params.sid, iat: params.iat, exp: params.exp });
    activeBySub.set(subKey, existing);
    persistSync();
    return { evictedSids };
  };

  const rotateSession = (params: {
    oldSid: string;
    oldExp: number;
    sub: string;
    role: string;
    newSid: string;
    newIat: number;
    newExp: number;
    ip?: string;
  }): { evictedSids: string[] } => {
    const subKey = String(params.sub || '').trim().toUpperCase();
    revokedSessionIds.set(params.oldSid, params.oldExp);

    const existing = (activeBySub.get(subKey) || []).filter(
      (entry) => entry.sid !== params.oldSid && !revokedSessionIds.has(entry.sid)
    );
    activeBySub.set(subKey, existing);

    const res = registerIssuedSession({
      sub: params.sub,
      role: params.role,
      sid: params.newSid,
      iat: params.newIat,
      exp: params.newExp,
      ip: params.ip,
    });

    recordSecurityEvent('SESSION_REFRESHED', {
      actorId: params.sub,
      ip: params.ip,
      detail: 'Session token rotated',
    });

    return res;
  };

  const getTelemetrySnapshot = (): SecurityTelemetrySnapshot => {
    pruneExpired();
    return {
      counters: { ...counters },
      recentEvents: [...recentEvents].reverse(),
      revokedCount: revokedSessionIds.size,
      activeTrackedSubjects: activeBySub.size,
    };
  };

  return {
    storeFile,
    revokedSessionIds,
    activeBySub,
    revokeSession,
    registerIssuedSession,
    rotateSession,
    pruneExpired,
    persistAsync,
    persistSync,
    recordSecurityEvent,
    getTelemetrySnapshot,
    clearMemoryOnly() {
      revokedSessionIds.clear();
      activeBySub.clear();
    },
  };
}
