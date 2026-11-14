/**
 * Conflict Resolution Service for GMAO Application.
 * Resolves field/record conflicts when merging local & external Excel/JSON datasets.
 */
import { Logger } from '../core/logger/LoggerService';

export type ConflictRecord = Record<string, unknown>;
export type ConflictResolutionStrategy =
  | 'LAST_WRITE_WINS'
  | 'LOCAL_WINS'
  | 'SERVER_WINS'
  | 'MERGE'
  | string;

export interface FieldConflictDiff {
  field: string;
  local: unknown;
  remote: unknown;
}

export type MergedConflictRecord<T extends ConflictRecord> = T & {
  merged_at: string;
  conflicts: FieldConflictDiff[];
};

export class ConflictResolutionService {
  static readonly STRATEGIES = {
    LAST_WRITE_WINS: 'LAST_WRITE_WINS',
    LOCAL_WINS: 'LOCAL_WINS',
    SERVER_WINS: 'SERVER_WINS',
    MERGE: 'MERGE',
  } as const;

  /** Resolves record conflict using Last Write Wins strategy based on ISO/numeric timestamps. */
  static resolveLastWriteWins<T extends ConflictRecord>(
    local: T = {} as T,
    remote: T = {} as T
  ): T {
    const localTime = new Date(
      String(local.updated_at || local.timestamp || local.date || 0)
    ).getTime();
    const remoteTime = new Date(
      String(remote.updated_at || remote.timestamp || remote.date || 0)
    ).getTime();

    if (localTime >= remoteTime) {
      Logger.debug('✅ Local version wins (newer or equal)');
      return local;
    }
    Logger.debug('✅ Remote version wins (newer)');
    return remote;
  }

  /** Resolves record conflict in favor of the local copy. */
  static resolveLocalWins<T extends ConflictRecord>(local: T = {} as T, _remote: T = {} as T): T {
    Logger.debug('✅ Local version wins:', local?.id || local?.ref || '');
    return local;
  }

  /** Resolves record conflict in favor of the remote/server copy. */
  static resolveServerWins<T extends ConflictRecord>(
    _local: T = {} as T,
    remote: T = {} as T
  ): T {
    Logger.debug('✅ Server/Remote version wins');
    return remote;
  }

  /** Merges two record versions field-by-field while tracking differing fields in `conflicts`. */
  static resolveMerge<T extends ConflictRecord>(
    local: T = {} as T,
    remote: T = {} as T
  ): MergedConflictRecord<T> {
    Logger.debug('🔄 Merging versions...');

    const conflicts: FieldConflictDiff[] = [];
    const merged: MergedConflictRecord<T> = {
      ...local,
      ...remote,
      merged_at: new Date().toISOString(),
      conflicts,
    };

    const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
    for (const key of keys) {
      if (key === 'merged_at' || key === 'conflicts') continue;
      if (local[key] !== undefined && remote[key] !== undefined && local[key] !== remote[key]) {
        conflicts.push({
          field: key,
          local: local[key],
          remote: remote[key],
        });
      }
    }

    Logger.debug(`✅ Merged with ${conflicts.length} field conflicts resolved`);
    return merged;
  }

  /** Dispatches conflict resolution for a single pair of records according to the selected strategy. */
  static resolveConflict<T extends ConflictRecord>(
    local: T | null | undefined,
    remote: T | null | undefined,
    strategy: ConflictResolutionStrategy = 'LAST_WRITE_WINS'
  ): T | MergedConflictRecord<T> | null | undefined {
    if (!local) return remote;
    if (!remote) return local;

    switch (strategy) {
      case this.STRATEGIES.LAST_WRITE_WINS:
        return this.resolveLastWriteWins(local, remote);
      case this.STRATEGIES.LOCAL_WINS:
        return this.resolveLocalWins(local, remote);
      case this.STRATEGIES.SERVER_WINS:
        return this.resolveServerWins(local, remote);
      case this.STRATEGIES.MERGE:
        return this.resolveMerge(local, remote);
      default:
        return this.resolveLastWriteWins(local, remote);
    }
  }

  /** Reconciles two collections of GMAO records by primary key (`id`, `ref`, `code`, or `code_bon`). */
  static resolveMultipleConflicts<T extends ConflictRecord>(
    localData: T[] = [],
    remoteData: T[] = [],
    strategy: ConflictResolutionStrategy = 'LAST_WRITE_WINS'
  ): Array<T | MergedConflictRecord<T>> {
    const resolved: Array<T | MergedConflictRecord<T>> = [];
    const getKey = (item: ConflictRecord) =>
      String(item.id || item.ref || item.code || item.code_bon || '').trim();

    for (const local of localData) {
      const localKey = getKey(local);
      const remote = remoteData.find((r) => getKey(r) === localKey);

      if (remote) {
        const resolvedItem = this.resolveConflict(local, remote, strategy);
        if (resolvedItem) resolved.push(resolvedItem);
      } else {
        resolved.push(local);
      }
    }

    for (const remote of remoteData) {
      const remoteKey = getKey(remote);
      if (!localData.some((l) => getKey(l) === remoteKey)) {
        resolved.push(remote);
      }
    }

    Logger.debug(`✅ Resolved ${resolved.length} items collection`);
    return resolved;
  }
}

export default ConflictResolutionService;
