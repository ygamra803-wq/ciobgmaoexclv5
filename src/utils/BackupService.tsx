import { AutoBackupService } from '../core/backup/AutoBackupService';
import { Logger } from '../core/logger/LoggerService';

/**
 * Backup Service for GMAO Application & AutoBackup integration
 */
export class BackupService {
  static autoBackupTimer = null;

  /**
   * Create a full snapshot backup of all tables/collections or db instance
   * @param {Object|string} [dbOrReason] - Database instance or snapshot reason description
   * @returns {Promise<Object>} Created backup snapshot object
   */
  static async createBackup(dbOrReason = 'Sauvegarde manuelle') {
    try {
      Logger.debug('🔄 Creating backup snapshot...');

      // If a database wrapper with getAll is passed
      if (dbOrReason && typeof dbOrReason === 'object' && typeof dbOrReason.getAll === 'function') {
        const articles = await dbOrReason.getAll('articles');
        const movements = await dbOrReason.getAll('movements');
        const machines = await dbOrReason.getAll('machines');

        const timestamp = new Date().toISOString();
        const backupId = 'backup_' + Date.now();
        const backupData = {
          id: backupId,
          timestamp,
          reason: 'Sauvegarde automatique / DB',
          data: { articles, movements, machines },
        };

        localStorage.setItem(backupId, JSON.stringify(backupData));
        Logger.debug(`✅ Backup created: ${backupId}`);
        return backupData;
      }

      // Default AutoBackupService snapshot creation across all GMAO collections
      const reason = typeof dbOrReason === 'string' ? dbOrReason : 'Sauvegarde manuelle';
      const snapshot = AutoBackupService.createSnapshot(reason, true);
      Logger.debug('✅ Backup snapshot created successfully');
      return snapshot;
    } catch (error) {
      Logger.error('❌ Backup creation failed:', error);
      return null;
    }
  }

  /**
   * Restore a backup snapshot from db or localStorage
   * @param {Object|string} dbOrSnapshotId - Database instance or snapshot ID to restore
   * @param {string} [backupId] - Optional backup ID if db instance is passed first
   */
  static async restoreBackup(dbOrSnapshotId, backupId) {
    try {
      Logger.debug('🔄 Restoring backup...');

      // Case 1: restoreBackup(db, 'backup_1234567890')
      if (dbOrSnapshotId && typeof dbOrSnapshotId === 'object' && backupId) {
        const raw = localStorage.getItem(backupId);
        if (raw) {
          const backup = JSON.parse(raw);
          if (backup?.data?.articles && typeof dbOrSnapshotId.update === 'function') {
            for (const article of backup.data.articles) {
              await dbOrSnapshotId.update('articles', article);
            }
          }
        }
        Logger.debug('✅ Backup restored from DB handler');
        return true;
      }

      // Case 2: restoreBackup('snap-123456') or restoreBackup('backup_123456')
      const targetId = typeof dbOrSnapshotId === 'string' ? dbOrSnapshotId : backupId;
      if (!targetId) return false;

      if (targetId.startsWith('backup_')) {
        const raw = localStorage.getItem(targetId);
        if (raw) {
          const backupData = JSON.parse(raw);
          if (backupData?.data) {
            Object.entries(backupData.data).forEach(([key, items]) => {
              if (Array.isArray(items)) {
                localStorage.setItem(`gmao_${key}`, JSON.stringify(items));
              }
            });
          }
          Logger.debug(`✅ Backup ${targetId} restored successfully`);
          return true;
        }
      }

      const res = await AutoBackupService.restoreSnapshot(targetId);
      Logger.debug(`✅ Backup ${targetId} restored successfully`);
      return res;
    } catch (error) {
      Logger.error('❌ Restore failed:', error);
      return false;
    }
  }

  /**
   * Get list of all backup snapshots stored in localStorage
   * @returns {Array<string|Object>} Backup keys or snapshot items
   */
  static getBackupList() {
    const backups = [];

    // 1. Gather keys starting with backup_
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('backup_')) {
          backups.push(key);
        }
      }
    } catch {
      // ignore storage access error
    }

    // 2. Combine with AutoBackupService snapshots
    const snapshots = AutoBackupService.listSnapshots();
    snapshots.forEach((snap) => {
      if (snap && snap.id && !backups.includes(snap.id)) {
        backups.push(snap.id);
      }
    });

    Logger.debug(`✅ Found ${backups.length} backups`);
    return backups;
  }

  // Alias for backwards compatibility
  static getBackupsList() {
    return this.getBackupList();
  }

  static startAutoBackup(_getDataFn, _user) {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
    }
    this.autoBackupTimer = setInterval(() => {
      try {
        AutoBackupService.createSnapshot('Sauvegarde automatique périodique', false);
      } catch (e) {
        Logger.warn('Auto backup interval failed', e);
      }
    }, 10 * 60 * 1000);
  }

  static stopAutoBackup() {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
    }
  }

  static exportBackup(id) {
    return AutoBackupService.exportFullBackupJSON(id);
  }
}

export const backupService = BackupService;
export default BackupService;
