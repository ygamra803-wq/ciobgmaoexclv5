import fs from 'fs';
import { randomUUID } from 'crypto';
import { serverLogger } from '../serverLogger';
import {
  ALLOWED_ENTITIES,
  OBJECT_ENTITY_SET,
  type AuditWriteContext,
  type GmaoDbState,
} from '../types';

/**
 * Builds an empty factory-clean GMAO state matching the canonical entity allowlist.
 */
export function createDefaultState(): GmaoDbState {
  const initial: Record<string, unknown> = {};
  for (const key of ALLOWED_ENTITIES) {
    initial[key] = OBJECT_ENTITY_SET.has(key) ? {} : [];
  }
  initial.version = 1;
  initial.updatedAt = new Date().toISOString();
  return initial as GmaoDbState;
}

/**
 * Hydrates in-memory `dbState` either from explicit test `initialState` or from disk `stateFile`.
 * Only allowlisted entities of the expected structural shape (`Array` vs dictionary `Object`) are loaded.
 */
export function hydrateInitialDbState(params: {
  stateFile: string;
  initialState?: Record<string, unknown>;
}): GmaoDbState {
  const dbState = createDefaultState();
  const stateMap: Record<string, unknown> = dbState;

  if (params.initialState && typeof params.initialState === 'object') {
    for (const key of ALLOWED_ENTITIES) {
      if (Object.prototype.hasOwnProperty.call(params.initialState, key)) {
        const val = params.initialState[key];
        if (OBJECT_ENTITY_SET.has(key)) {
          if (val && typeof val === 'object' && !Array.isArray(val)) {
            stateMap[key] = val;
          }
        } else if (Array.isArray(val)) {
          stateMap[key] = val;
        }
      }
    }
    return dbState;
  }

  try {
    if (fs.existsSync(params.stateFile)) {
      const raw = fs.readFileSync(params.stateFile, 'utf-8');
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const parsedObj = parsed as Record<string, unknown>;
        for (const key of ALLOWED_ENTITIES) {
          if (Object.prototype.hasOwnProperty.call(parsedObj, key)) {
            const val = parsedObj[key];
            if (OBJECT_ENTITY_SET.has(key)) {
              if (val && typeof val === 'object' && !Array.isArray(val)) {
                stateMap[key] = val;
              }
            } else if (Array.isArray(val)) {
              stateMap[key] = val;
            }
          }
        }
        if (
          typeof parsedObj.version === 'number' &&
          Number.isFinite(parsedObj.version) &&
          parsedObj.version >= 1
        ) {
          dbState.version = Math.floor(parsedObj.version);
        }
        if (typeof parsedObj.updatedAt === 'string') {
          dbState.updatedAt = parsedObj.updatedAt;
        }
      }
    }
  } catch (err) {
    serverLogger.error('[Backend] Failed to load state file:', err);
  }

  return dbState;
}

/**
 * Serialized atomic state persister (`.tmp` write + POSIX rename + append-only `.jsonl` audit log).
 *
 * Invariants:
 *  - Only one disk flush executes at a time via `writeQueue`.
 *  - Failed writes revert `dbState.version` / `updatedAt`, run caller `rollbackState()`, and re-throw
 *    so HTTP routes return `500 PERSISTENCE_FAILED` instead of silent `200 OK`.
 *  - A rejected write never poisons subsequent queued writes (`writeQueue = writeTask.catch(...)`).
 */
export function createAtomicStatePersister(params: {
  dbState: GmaoDbState;
  stateFile: string;
  stateTmpFile: string;
  auditFile: string;
  onStatePersisted?: (eventPayload: Record<string, unknown>) => void;
}) {
  let writeQueue: Promise<void> = Promise.resolve();

  const persistState = (
    auditContext?: AuditWriteContext,
    rollbackState?: () => void
  ): Promise<void> => {
    const prevVersion = typeof params.dbState.version === 'number' ? params.dbState.version : 1;
    const prevUpdatedAt = params.dbState.updatedAt;
    const currentVersion = prevVersion + 1;
    const currentUpdatedAt = new Date().toISOString();
    params.dbState.version = currentVersion;
    params.dbState.updatedAt = currentUpdatedAt;
    const serializedState = JSON.stringify(params.dbState, null, 2);

    const auditEntry = auditContext
      ? JSON.stringify({
          id: `aud_${Date.now()}_${randomUUID().slice(0, 8)}`,
          timestamp: currentUpdatedAt,
          version: currentVersion,
          actor: auditContext.actor || 'system',
          action: auditContext.action,
          entity: auditContext.entity,
          summary: auditContext.summary || '',
        }) + '\n'
      : null;

    const writeTask = writeQueue.then(async () => {
      try {
        await fs.promises.writeFile(params.stateTmpFile, serializedState, 'utf-8');
        await fs.promises.rename(params.stateTmpFile, params.stateFile);
        if (auditEntry) {
          await fs.promises.appendFile(params.auditFile, auditEntry, 'utf-8');
        }
        params.onStatePersisted?.({
          type: 'STATE_UPDATED',
          version: currentVersion,
          updatedAt: currentUpdatedAt,
          actor: auditContext?.actor || 'system',
          action: auditContext?.action || 'SYNC_STATE',
          entity: auditContext?.entity || 'state',
        });
      } catch (err) {
        if (params.dbState.version === currentVersion) {
          params.dbState.version = prevVersion;
          params.dbState.updatedAt = prevUpdatedAt;
        }
        if (rollbackState) {
          try {
            rollbackState();
          } catch {
            // ignore rollback error
          }
        }
        serverLogger.error('[Backend] Failed to persist state or audit file:', err);
        throw err;
      }
    });

    writeQueue = writeTask.catch(() => undefined);
    return writeTask;
  };

  return { persistState };
}
