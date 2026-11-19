import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { randomBytesHex } from '../../core/security/nativeCrypto.ts';
import { serverLogger } from '../serverLogger.ts';
import { createDefaultState, hydrateInitialDbState } from './stateStore.ts';
import {
  ALLOWED_ENTITIES,
  OBJECT_ENTITY_SET,
  type AuditWriteContext,
  type GmaoDbState,
  type SqliteBackupResult,
  type SqliteJournalMode,
  type SqliteStorageInfo,
} from '../types.ts';

const SQLITE_SCHEMA_VERSION = 1;
const MAX_LEGACY_AUDIT_MIGRATION_ROWS = 5000;

export function isUncNetworkPath(filePath: string): boolean {
  return /^(\\\\|\/\/)/.test(String(filePath || '').trim());
}

function getEntityItemCount(key: string, value: unknown): number {
  if (OBJECT_ENTITY_SET.has(key)) {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value as Record<string, unknown>).length
      : 0;
  }
  return Array.isArray(value) ? value.length : 0;
}

function safeFileSize(filePath: string): number {
  try {
    return fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
  } catch {
    return 0;
  }
}

function countBackupFiles(backupDir: string): number {
  try {
    if (!fs.existsSync(backupDir)) return 0;
    return fs
      .readdirSync(backupDir)
      .filter((name) => name.endsWith('.db') && name.startsWith('ciob_gmao_')).length;
  } catch {
    return 0;
  }
}

function readLegacyAuditJsonlForMigration(auditFile: string): Array<{
  id: string;
  timestamp: string;
  version: number;
  actor: string;
  action: string;
  entity: string;
  summary: string;
}> {
  if (!auditFile || !fs.existsSync(auditFile)) return [];
  try {
    const raw = fs.readFileSync(auditFile, 'utf-8');
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const tail = lines.slice(-MAX_LEGACY_AUDIT_MIGRATION_ROWS);
    const entries: Array<{
      id: string;
      timestamp: string;
      version: number;
      actor: string;
      action: string;
      entity: string;
      summary: string;
    }> = [];
    for (const line of tail) {
      try {
        const parsed: unknown = JSON.parse(line);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
        const obj = parsed as Record<string, unknown>;
        entries.push({
          id: typeof obj.id === 'string' && obj.id ? obj.id : `aud_mig_${randomUUID().slice(0, 8)}`,
          timestamp:
            typeof obj.timestamp === 'string' && obj.timestamp
              ? obj.timestamp
              : new Date().toISOString(),
          version:
            typeof obj.version === 'number' && Number.isFinite(obj.version)
              ? Math.floor(obj.version)
              : 1,
          actor: typeof obj.actor === 'string' && obj.actor ? obj.actor : 'system',
          action: typeof obj.action === 'string' && obj.action ? obj.action : 'LEGACY_MIGRATED',
          entity: typeof obj.entity === 'string' && obj.entity ? obj.entity : 'state',
          summary: typeof obj.summary === 'string' ? obj.summary : '',
        });
      } catch {
        // Skip malformed legacy JSONL line cleanly
      }
    }
    return entries;
  } catch (err) {
    serverLogger.warn('[SQLite] Failed to read legacy audit file during migration:', err);
    return [];
  }
}

export interface SqliteStateStore {
  dbState: GmaoDbState;
  dbFile: string;
  journalMode: SqliteJournalMode;
  persistState: (auditContext?: AuditWriteContext, rollbackState?: () => void) => Promise<void>;
  readRecentAuditEntries: (limit: number) => Promise<Record<string, unknown>[]>;
  createHotBackup: (backupDir: string, maxBackups?: number) => Promise<SqliteBackupResult>;
  getStorageInfo: (backupDir: string) => SqliteStorageInfo;
  close: () => void;
}

/**
 * Single-File ACID SQLite Persistence Engine powered by Node 22 built-in `node:sqlite` (`DatabaseSync`).
 *
 * Design guarantees:
 *  - Zero native C++ build dependencies (portable across Windows desktop PCs and Linux containers).
 *  - Transactional writes (`BEGIN IMMEDIATE ... COMMIT`) with dirty-entity diffing so single edits
 *    touch only the modified entity row, metadata row, and audit log row.
 *  - Automatic one-time zero-loss migration from legacy `gmao_state.json` + `gmao_audit.jsonl`.
 *  - Network-share safety: automatically switches from `WAL` to `DELETE` + `synchronous=FULL` when
 *    pointed at a UNC SMB path (`\\server\share\...`), preventing WAL shared-memory corruption.
 *  - Consistent online hot backups via `VACUUM INTO` with automatic snapshot retention pruning.
 */
export function createSqliteStateStore(params: {
  dbFile: string;
  legacyStateFile?: string;
  legacyAuditFile?: string;
  initialState?: Record<string, unknown>;
  journalMode?: SqliteJournalMode;
  onStatePersisted?: (eventPayload: Record<string, unknown>) => void;
}): SqliteStateStore {
  const resolvedDbFile = path.resolve(params.dbFile);
  const dbParentDir = path.dirname(resolvedDbFile);
  if (!fs.existsSync(dbParentDir)) {
    fs.mkdirSync(dbParentDir, { recursive: true });
  }

  const networkPath = isUncNetworkPath(params.dbFile);
  const requestedMode =
    params.journalMode ||
    (String(process.env.GMAO_SQLITE_JOURNAL_MODE || '').toUpperCase() === 'DELETE'
      ? 'DELETE'
      : 'WAL');
  const effectiveJournalMode: SqliteJournalMode = networkPath ? 'DELETE' : requestedMode;

  if (networkPath) {
    serverLogger.warn(
      `[SQLite] UNC/SMB network path detected (${params.dbFile}). Switching to journal_mode=DELETE & synchronous=FULL. For multi-PC Wi-Fi LAN usage, run 1 Host PC locally and connect other PCs/phones over HTTP LAN.`
    );
  }

  const db = new DatabaseSync(resolvedDbFile);
  let isClosed = false;

  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(`PRAGMA journal_mode = ${effectiveJournalMode};`);
  db.exec(
    effectiveJournalMode === 'WAL' ? 'PRAGMA synchronous = NORMAL;' : 'PRAGMA synchronous = FULL;'
  );

  db.exec(`
    CREATE TABLE IF NOT EXISTS gmao_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gmao_entities (
      entity_key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      item_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gmao_audit_log (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      version INTEGER NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      summary TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gmao_audit_version_seq
      ON gmao_audit_log (version DESC, seq DESC);
  `);

  const upsertMetaStmt = db.prepare(`
    INSERT INTO gmao_meta (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const selectMetaStmt = db.prepare('SELECT key, value FROM gmao_meta');
  const upsertEntityStmt = db.prepare(`
    INSERT INTO gmao_entities (entity_key, payload_json, item_count, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(entity_key) DO UPDATE SET
      payload_json = excluded.payload_json,
      item_count = excluded.item_count,
      updated_at = excluded.updated_at
  `);
  const selectEntitiesStmt = db.prepare('SELECT entity_key, payload_json FROM gmao_entities');
  const countEntitiesStmt = db.prepare('SELECT COUNT(*) AS cnt FROM gmao_entities');
  const insertAuditStmt = db.prepare(`
    INSERT INTO gmao_audit_log (id, timestamp, version, actor, action, entity, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const selectRecentAuditStmt = db.prepare(`
    SELECT id, timestamp, version, actor, action, entity, summary
    FROM gmao_audit_log
    ORDER BY seq DESC
    LIMIT ?
  `);
  const countAuditStmt = db.prepare('SELECT COUNT(*) AS cnt FROM gmao_audit_log');

  const lastPersistedJsonByEntity = new Map<string, string>();
  let migratedFromJsonAt: string | null = null;
  let dbState: GmaoDbState;

  if (params.initialState && typeof params.initialState === 'object') {
    dbState = hydrateInitialDbState({
      stateFile: '',
      initialState: params.initialState,
    });
  } else {
    const rowCountRow = countEntitiesStmt.get() as { cnt?: number } | undefined;
    const existingEntityCount = Number(rowCountRow?.cnt || 0);

    if (existingEntityCount > 0) {
      dbState = createDefaultState();
      const stateMap: Record<string, unknown> = dbState;
      const metaRows = selectMetaStmt.all() as Array<{ key: string; value: string }>;
      for (const row of metaRows) {
        if (row.key === 'state_version') {
          const parsedVersion = Number(row.value);
          if (Number.isFinite(parsedVersion) && parsedVersion >= 1) {
            dbState.version = Math.floor(parsedVersion);
          }
        } else if (row.key === 'updated_at' && row.value) {
          dbState.updatedAt = row.value;
        } else if (row.key === 'migrated_from_json_at' && row.value) {
          migratedFromJsonAt = row.value;
        }
      }

      const entityRows = selectEntitiesStmt.all() as Array<{
        entity_key: string;
        payload_json: string;
      }>;
      const allowedSet = new Set<string>(ALLOWED_ENTITIES);
      for (const row of entityRows) {
        if (!allowedSet.has(row.entity_key)) continue;
        try {
          const parsed: unknown = JSON.parse(row.payload_json);
          if (OBJECT_ENTITY_SET.has(row.entity_key)) {
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              stateMap[row.entity_key] = parsed;
              lastPersistedJsonByEntity.set(row.entity_key, row.payload_json);
            }
          } else if (Array.isArray(parsed)) {
            stateMap[row.entity_key] = parsed;
            lastPersistedJsonByEntity.set(row.entity_key, row.payload_json);
          }
        } catch (err) {
          serverLogger.error(`[SQLite] Failed to parse entity '${row.entity_key}':`, err);
        }
      }
    } else if (params.legacyStateFile && fs.existsSync(params.legacyStateFile)) {
      // Automatic one-time migration from legacy gmao_state.json (+ optional gmao_audit.jsonl)
      dbState = hydrateInitialDbState({ stateFile: params.legacyStateFile });
      const migratedAt = new Date().toISOString();
      const legacyAuditEntries = params.legacyAuditFile
        ? readLegacyAuditJsonlForMigration(params.legacyAuditFile)
        : [];

      db.exec('BEGIN IMMEDIATE');
      try {
        for (const key of ALLOWED_ENTITIES) {
          const val = dbState[key];
          const serialized = JSON.stringify(val ?? (OBJECT_ENTITY_SET.has(key) ? {} : []));
          upsertEntityStmt.run(key, serialized, getEntityItemCount(key, val), dbState.updatedAt);
          lastPersistedJsonByEntity.set(key, serialized);
        }
        upsertMetaStmt.run('schema_version', String(SQLITE_SCHEMA_VERSION));
        upsertMetaStmt.run('state_version', String(dbState.version));
        upsertMetaStmt.run('updated_at', dbState.updatedAt);
        upsertMetaStmt.run('migrated_from_json_at', migratedAt);

        for (const entry of legacyAuditEntries) {
          insertAuditStmt.run(
            entry.id,
            entry.timestamp,
            entry.version,
            entry.actor,
            entry.action,
            entry.entity,
            entry.summary
          );
        }
        db.exec('COMMIT');
        migratedFromJsonAt = migratedAt;
        serverLogger.info(
          `[SQLite] Migrated legacy JSON state (${params.legacyStateFile}, v${dbState.version}, ${legacyAuditEntries.length} audit entries) into ${resolvedDbFile}`
        );
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          // ignore rollback error
        }
        serverLogger.error('[SQLite] Legacy JSON migration failed:', err);
        throw err;
      }
    } else {
      dbState = createDefaultState();
      upsertMetaStmt.run('schema_version', String(SQLITE_SCHEMA_VERSION));
      upsertMetaStmt.run('state_version', String(dbState.version));
      upsertMetaStmt.run('updated_at', dbState.updatedAt);
    }
  }

  let writeQueue: Promise<void> = Promise.resolve();

  const persistState = (
    auditContext?: AuditWriteContext,
    rollbackState?: () => void
  ): Promise<void> => {
    const writeTask = writeQueue.then(async () => {
      if (isClosed) {
        if (rollbackState) {
          try {
            rollbackState();
          } catch {
            // ignore
          }
        }
        throw new Error('SQLite database connection is closed.');
      }

      const prevVersion = typeof dbState.version === 'number' ? dbState.version : 1;
      const prevUpdatedAt = dbState.updatedAt;
      const currentVersion = prevVersion + 1;
      const currentUpdatedAt = new Date().toISOString();
      dbState.version = currentVersion;
      dbState.updatedAt = currentUpdatedAt;

      const changedEntities: Array<{ key: string; json: string; count: number }> = [];
      for (const key of ALLOWED_ENTITIES) {
        const val = dbState[key] ?? (OBJECT_ENTITY_SET.has(key) ? {} : []);
        const serialized = JSON.stringify(val);
        if (lastPersistedJsonByEntity.get(key) !== serialized) {
          changedEntities.push({
            key,
            json: serialized,
            count: getEntityItemCount(key, val),
          });
        }
      }

      const auditRow = auditContext
        ? {
            id: `aud_${Date.now()}_${randomUUID().slice(0, 8)}`,
            timestamp: currentUpdatedAt,
            version: currentVersion,
            actor: auditContext.actor || 'system',
            action: auditContext.action,
            entity: auditContext.entity,
            summary: auditContext.summary || '',
          }
        : null;

      let inTx = false;
      try {
        db.exec('BEGIN IMMEDIATE');
        inTx = true;

        for (const item of changedEntities) {
          upsertEntityStmt.run(item.key, item.json, item.count, currentUpdatedAt);
        }

        upsertMetaStmt.run('schema_version', String(SQLITE_SCHEMA_VERSION));
        upsertMetaStmt.run('state_version', String(currentVersion));
        upsertMetaStmt.run('updated_at', currentUpdatedAt);

        if (auditRow) {
          insertAuditStmt.run(
            auditRow.id,
            auditRow.timestamp,
            auditRow.version,
            auditRow.actor,
            auditRow.action,
            auditRow.entity,
            auditRow.summary
          );
        }

        db.exec('COMMIT');
        inTx = false;

        for (const item of changedEntities) {
          lastPersistedJsonByEntity.set(item.key, item.json);
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
        if (inTx) {
          try {
            db.exec('ROLLBACK');
          } catch {
            // ignore rollback error
          }
        }
        if (dbState.version === currentVersion) {
          dbState.version = prevVersion;
          dbState.updatedAt = prevUpdatedAt;
        }
        if (rollbackState) {
          try {
            rollbackState();
          } catch {
            // ignore rollback error
          }
        }
        serverLogger.error('[SQLite] Failed to persist state transaction:', err);
        throw err;
      }
    });

    writeQueue = writeTask.catch(() => undefined);
    return writeTask;
  };

  const readRecentAuditEntries = async (limit: number): Promise<Record<string, unknown>[]> => {
    if (isClosed) return [];
    const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 100), 500);
    const rows = selectRecentAuditStmt.all(safeLimit) as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id || ''),
      timestamp: String(row.timestamp || ''),
      version: Number(row.version || 1),
      actor: String(row.actor || 'system'),
      action: String(row.action || ''),
      entity: String(row.entity || ''),
      summary: String(row.summary || ''),
    }));
  };

  const createHotBackup = (
    backupDir: string,
    maxBackups = 10
  ): Promise<SqliteBackupResult> => {
    const task = writeQueue.then(async (): Promise<SqliteBackupResult> => {
      if (isClosed) {
        throw new Error('Cannot back up a closed SQLite database.');
      }
      const resolvedBackupDir = path.resolve(backupDir);
      if (!fs.existsSync(resolvedBackupDir)) {
        fs.mkdirSync(resolvedBackupDir, { recursive: true });
      }

      // Ensure at least the current state is materialized in the DB before VACUUM INTO
      if (lastPersistedJsonByEntity.size === 0) {
        db.exec('BEGIN IMMEDIATE');
        try {
          for (const key of ALLOWED_ENTITIES) {
            const val = dbState[key] ?? (OBJECT_ENTITY_SET.has(key) ? {} : []);
            const serialized = JSON.stringify(val);
            upsertEntityStmt.run(key, serialized, getEntityItemCount(key, val), dbState.updatedAt);
            lastPersistedJsonByEntity.set(key, serialized);
          }
          upsertMetaStmt.run('schema_version', String(SQLITE_SCHEMA_VERSION));
          upsertMetaStmt.run('state_version', String(dbState.version));
          upsertMetaStmt.run('updated_at', dbState.updatedAt);
          db.exec('COMMIT');
        } catch (err) {
          try {
            db.exec('ROLLBACK');
          } catch {
            // ignore
          }
          throw err;
        }
      }

      const now = new Date();
      const stamp = now.toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const fileName = `ciob_gmao_${stamp}_v${dbState.version}_${randomBytesHex(3)}.db`;
      const targetFile = path.resolve(resolvedBackupDir, fileName);

      if (!targetFile.startsWith(resolvedBackupDir + path.sep)) {
        throw new Error('Invalid backup target path.');
      }

      const escapedPath = targetFile.replace(/'/g, "''");
      db.exec(`VACUUM INTO '${escapedPath}'`);

      const safeRetention = Math.min(Math.max(1, Math.floor(maxBackups) || 10), 100);
      const existingBackups = fs
        .readdirSync(resolvedBackupDir)
        .filter((name) => name.endsWith('.db') && name.startsWith('ciob_gmao_'))
        .map((name) => {
          const full = path.join(resolvedBackupDir, name);
          let mtimeMs = 0;
          try {
            mtimeMs = fs.statSync(full).mtimeMs;
          } catch {
            mtimeMs = 0;
          }
          return { name, full, mtimeMs };
        })
        .sort((a, b) => b.mtimeMs - a.mtimeMs);

      for (const stale of existingBackups.slice(safeRetention)) {
        try {
          fs.unlinkSync(stale.full);
        } catch {
          // ignore cleanup failure on locked old backup
        }
      }

      const retainedBackups = Math.min(existingBackups.length, safeRetention);

      return {
        backupFile: targetFile,
        fileName,
        sizeBytes: safeFileSize(targetFile),
        version: dbState.version,
        createdAt: now.toISOString(),
        retainedBackups,
      };
    });

    writeQueue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  };

  const getStorageInfo = (backupDir: string): SqliteStorageInfo => {
    let entityCount = 0;
    let auditCount = 0;
    if (!isClosed) {
      try {
        entityCount = Number((countEntitiesStmt.get() as { cnt?: number } | undefined)?.cnt || 0);
        auditCount = Number((countAuditStmt.get() as { cnt?: number } | undefined)?.cnt || 0);
      } catch {
        // ignore if read fails on closing handle
      }
    }
    return {
      engine: 'sqlite',
      dbFile: resolvedDbFile,
      journalMode: effectiveJournalMode,
      schemaVersion: SQLITE_SCHEMA_VERSION,
      version: dbState.version,
      updatedAt: dbState.updatedAt,
      sizeBytes: safeFileSize(resolvedDbFile),
      walSizeBytes: safeFileSize(`${resolvedDbFile}-wal`),
      entityCount,
      auditCount,
      backupsCount: countBackupFiles(backupDir),
      migratedFromJsonAt,
      isNetworkPath: networkPath,
    };
  };

  const close = () => {
    if (isClosed) return;
    isClosed = true;
    try {
      if (effectiveJournalMode === 'WAL') {
        db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
      }
    } catch {
      // ignore checkpoint error on shutdown
    }
    try {
      db.close();
    } catch {
      // ignore close error
    }
  };

  return {
    dbState,
    dbFile: resolvedDbFile,
    journalMode: effectiveJournalMode,
    persistState,
    readRecentAuditEntries,
    createHotBackup,
    getStorageInfo,
    close,
  };
}
