import { Logger } from '../../logger/LoggerService';

export class Migration002_AddIndexes {
  version = 2;
  name = 'Add Indexes for Performance';

  async up(db) {
    try {
      Logger.info('🔄 Running Migration002_AddIndexes...');

      // Indexes للأداء
      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_articles_ref ON articles(ref)',
        'CREATE INDEX IF NOT EXISTS idx_articles_type ON articles(id_type)',
        'CREATE INDEX IF NOT EXISTS idx_movements_ref ON movements(ref)',
        'CREATE INDEX IF NOT EXISTS idx_movements_type ON movements(type)',
        'CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date)',
        'CREATE INDEX IF NOT EXISTS idx_movements_machine ON movements(id_machine_registered)',
        'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)',
      ];

      for (const index of indexes) {
        db.execute(index);
      }

      Logger.info('✅ Migration002_AddIndexes completed successfully');
      return true;
    } catch (error) {
      Logger.error('❌ Migration002_AddIndexes failed', error);
      throw error;
    }
  }

  async down(db) {
    try {
      Logger.info('🔄 Rolling back Migration002_AddIndexes...');
      
      const indexes = [
        'DROP INDEX IF EXISTS idx_articles_ref',
        'DROP INDEX IF EXISTS idx_articles_type',
        'DROP INDEX IF EXISTS idx_movements_ref',
        'DROP INDEX IF EXISTS idx_movements_type',
        'DROP INDEX IF EXISTS idx_movements_date',
        'DROP INDEX IF EXISTS idx_movements_machine',
        'DROP INDEX IF EXISTS idx_users_username',
        'DROP INDEX IF EXISTS idx_users_email',
        'DROP INDEX IF EXISTS idx_sessions_user',
        'DROP INDEX IF EXISTS idx_sessions_token',
        'DROP INDEX IF EXISTS idx_audit_logs_user',
        'DROP INDEX IF EXISTS idx_audit_logs_entity',
      ];

      for (const index of indexes) {
        db.execute(index);
      }

      Logger.info('✅ Migration002_AddIndexes rolled back successfully');
      return true;
    } catch (error) {
      Logger.error('❌ Migration002_AddIndexes rollback failed', error);
      throw error;
    }
  }
}
