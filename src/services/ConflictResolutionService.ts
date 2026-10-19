/**
 * Conflict Resolution Service for GMAO Application
 * Solves data conflicts when merging local & external Excel/JSON datasets
 */
import { Logger } from '../core/logger/LoggerService';

export class ConflictResolutionService {
  static STRATEGIES = {
    LAST_WRITE_WINS: 'LAST_WRITE_WINS',
    LOCAL_WINS: 'LOCAL_WINS',
    SERVER_WINS: 'SERVER_WINS',
    MERGE: 'MERGE'
  };

  /**
   * Resolve conflict using Last Write Wins Strategy based on timestamp
   */
  static resolveLastWriteWins(local = {}, remote = {}) {
    const localTime = new Date(local.updated_at || local.timestamp || local.date || 0).getTime();
    const remoteTime = new Date(remote.updated_at || remote.timestamp || remote.date || 0).getTime();

    if (localTime >= remoteTime) {
      Logger.debug('✅ Local version wins (newer or equal)');
      return local;
    } else {
      Logger.debug('✅ Remote version wins (newer)');
      return remote;
    }
  }

  /**
   * Resolve conflict using Local Version Wins
   */
  static resolveLocalWins(local = {}) {
    Logger.debug('✅ Local version wins:', local?.id || local?.ref || '');
    return local;
  }

  /**
   * Resolve conflict using Server / Remote Version Wins
   */
  static resolveServerWins(_local = {}, remote = {}) {
    Logger.debug('✅ Server/Remote version wins');
    return remote;
  }

  /**
   * Resolve conflict using Property Field Merge Strategy
   */
  static resolveMerge(local = {}, remote = {}) {
    Logger.debug('🔄 Merging versions...');

    const merged = {
      ...local,
      ...remote,
      merged_at: new Date().toISOString(),
      conflicts: []
    };

    const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
    for (const key of keys) {
      if (key === 'merged_at' || key === 'conflicts') continue;
      if (local[key] !== undefined && remote[key] !== undefined && local[key] !== remote[key]) {
        merged.conflicts.push({
          field: key,
          local: local[key],
          remote: remote[key]
        });
      }
    }

    Logger.debug(`✅ Merged with ${merged.conflicts.length} field conflicts resolved`);
    return merged;
  }

  /**
   * Main conflict resolution dispatcher
   */
  static resolveConflict(local, remote, strategy = 'LAST_WRITE_WINS') {
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

  /**
   * Resolve multiple items array conflict by primary key (id, ref, code)
   */
  static resolveMultipleConflicts(localData = [], remoteData = [], strategy = 'LAST_WRITE_WINS') {
    const resolved = [];
    const getKey = (item) => String(item.id || item.ref || item.code || item.code_bon || '').trim();

    for (const local of localData) {
      const localKey = getKey(local);
      const remote = remoteData.find((r) => getKey(r) === localKey);

      if (remote) {
        const resolvedItem = this.resolveConflict(local, remote, strategy);
        resolved.push(resolvedItem);
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
