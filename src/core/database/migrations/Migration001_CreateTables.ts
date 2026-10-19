import { Logger } from '../../logger/LoggerService';

export class Migration001_CreateTables {
  version = 1;
  name = 'Create Core Tables';

  async up(db) {
    try {
      Logger.info('🔄 Running Migration001_CreateTables...');

      // جدول الأنواع (Types)
      db.execute(`
        CREATE TABLE IF NOT EXISTS types (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول الأجزاء (Articles/Spare Parts)
      db.execute(`
        CREATE TABLE IF NOT EXISTS articles (
          id TEXT PRIMARY KEY,
          ref TEXT UNIQUE NOT NULL,
          designation TEXT NOT NULL,
          id_type TEXT NOT NULL,
          id_diag TEXT,
          stockInitial INTEGER NOT NULL DEFAULT 0 CHECK (stockInitial >= 0),
          minThreshold INTEGER NOT NULL DEFAULT 5 CHECK (minThreshold >= 0),
          maxThreshold INTEGER NOT NULL DEFAULT 100 CHECK (maxThreshold >= minThreshold),
          emplacement TEXT,
          unitPrice REAL NOT NULL DEFAULT 0 CHECK (unitPrice >= 0),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (id_type) REFERENCES types(id) ON DELETE RESTRICT
        )
      `);

      // جدول الحركات (Movements)
      db.execute(`
        CREATE TABLE IF NOT EXISTS movements (
          id TEXT PRIMARY KEY,
          code_bon TEXT NOT NULL,
          date TEXT NOT NULL,
          ref TEXT NOT NULL,
          quantite INTEGER NOT NULL CHECK (quantite > 0),
          type TEXT NOT NULL CHECK (type IN ('Entrée', 'Sortie')),
          action_id TEXT NOT NULL,
          technicien TEXT NOT NULL,
          id_zone TEXT,
          id_machine_registered TEXT,
          fournisseur TEXT,
          commentaire TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (ref) REFERENCES articles(ref) ON DELETE RESTRICT
        )
      `);

      // جدول الآلات (Machines)
      db.execute(`
        CREATE TABLE IF NOT EXISTS machines (
          id TEXT PRIMARY KEY,
          designation TEXT NOT NULL,
          id_family TEXT,
          id_templates TEXT,
          id_zone_default TEXT,
          technician TEXT,
          status TEXT NOT NULL CHECK (status IN ('En service', 'En maintenance', 'Arrêt')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول المستخدمين (Users)
      db.execute(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('ADMIN', 'RESPONSABLE', 'TECHNICIEN', 'OPERATEUR')),
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // جدول السجلات (Audit Logs)
      db.execute(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          changes TEXT,
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // جدول الجلسات (Sessions)
      db.execute(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          token TEXT NOT NULL UNIQUE,
          device_id TEXT,
          ip_address TEXT,
          expires_at DATETIME NOT NULL,
          last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

      // جدول النسخ الاحتياطية (Backups)
      db.execute(`
        CREATE TABLE IF NOT EXISTS backups (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          size INTEGER NOT NULL,
          hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by TEXT NOT NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
      `);

      // جدول إصدارات قاعدة البيانات (Schema Versions)
      db.execute(`
        CREATE TABLE IF NOT EXISTS schema_versions (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      Logger.info('✅ Migration001_CreateTables completed successfully');
      return true;
    } catch (error) {
      Logger.error('❌ Migration001_CreateTables failed', error);
      throw error;
    }
  }

  async down(db) {
    try {
      Logger.info('🔄 Rolling back Migration001_CreateTables...');
      
      db.execute('DROP TABLE IF EXISTS schema_versions');
      db.execute('DROP TABLE IF EXISTS backups');
      db.execute('DROP TABLE IF EXISTS sessions');
      db.execute('DROP TABLE IF EXISTS audit_logs');
      db.execute('DROP TABLE IF EXISTS users');
      db.execute('DROP TABLE IF EXISTS machines');
      db.execute('DROP TABLE IF EXISTS movements');
      db.execute('DROP TABLE IF EXISTS articles');
      db.execute('DROP TABLE IF EXISTS types');
      
      Logger.info('✅ Migration001_CreateTables rolled back successfully');
      return true;
    } catch (error) {
      Logger.error('❌ Migration001_CreateTables rollback failed', error);
      throw error;
    }
  }
}
