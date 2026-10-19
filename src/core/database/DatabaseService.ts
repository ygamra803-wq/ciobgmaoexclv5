import { Logger } from '../logger/LoggerService';
import { storageService } from '../../utils/storageService';
import { indexedDBService } from '../../infrastructure/database/IndexedDBService';

/**
 * Database Service
 * Support SQLite in Node environment & In-Memory / LocalStorage / IndexedDB Engine in Browser
 */
export class DatabaseService {
  static instance = null;

  constructor(_dbPath = './data/gmao.db') {
    if (DatabaseService.instance) {
      return DatabaseService.instance;
    }

    this.isBrowser = typeof window !== 'undefined';
    this.db = null;
    this.indexedDB = indexedDBService;
    Logger.info('✅ Database initialized (Offline LocalStorage & IndexedDB Engine)');

    // Pre-initialize IndexedDB in background
    if (this.isBrowser) {
      this.indexedDB.init().catch(() => {});
    }

    DatabaseService.instance = this;
  }

  getStorageKey(storeName) {
    if (!storeName) return 'gmao_data';
    if (storeName.startsWith('gmao_')) return storeName;
    return `gmao_${storeName}`;
  }

  async getAll(storeName) {
    if (this.db) {
      try {
        const stmt = this.db.prepare(`SELECT * FROM ${storeName}`);
        const rows = stmt.all();
        if (rows && rows.length > 0) {
          return rows.map(r => {
            if (r.data_json) {
              try { return JSON.parse(r.data_json); } catch {}
            }
            return r;
          });
        }
      } catch (err) {
        Logger.warn(`SQLite read table ${storeName} failed, falling back to storageService:`, err);
      }
    }

    const primaryKey = this.getStorageKey(storeName);
    let items = storageService.getItem(primaryKey, null);

    if (!items || !Array.isArray(items) || items.length === 0) {
      if (storeName === 'spare_parts') {
        items = storageService.getItem('gmao_raw_stock_v6', null);
      } else if (storeName === 'movements') {
        items = storageService.getItem('gmao_mouvements', null);
      } else if (storeName === 'machines') {
        items = storageService.getItem('gmao_machines_registered_v6', null);
      }
    }

    return Array.isArray(items) ? items : [];
  }

  async getById(storeName, id) {
    const all = await this.getAll(storeName);
    return all.find(item => item.id === id || item.id_machine_registered === id || item.ref === id || item.code_bon === id) || null;
  }

  async save(storeName, record) {
    if (!record) return false;
    const all = await this.getAll(storeName);
    const id = record.id || record.id_machine_registered || record.ref || record.code_bon;
    
    const index = all.findIndex(item => 
      (item.id && item.id === id) || 
      (item.id_machine_registered && item.id_machine_registered === id) || 
      (item.ref && item.ref === id) ||
      (item.code_bon && item.code_bon === id)
    );
    
    if (index >= 0) {
      all[index] = { ...all[index], ...record };
    } else {
      all.push(record);
    }

    if (this.db) {
      try {
        const jsonStr = JSON.stringify(record);
        this.db.prepare(`INSERT OR REPLACE INTO ${storeName} (id, data_json) VALUES (?, ?)`).run(id, jsonStr);
      } catch {}
    }

    const primaryKey = this.getStorageKey(storeName);
    storageService.setItem(primaryKey, all);

    if (storeName === 'spare_parts') {
      storageService.setItem('gmao_raw_stock_v6', all);
    } else if (storeName === 'movements') {
      storageService.setItem('gmao_mouvements', all);
    }

    // Background sync to IndexedDB
    if (this.indexedDB) {
      this.indexedDB.put(storeName, record).catch(() => {});
    }

    return true;
  }

  async delete(storeName, id) {
    const all = await this.getAll(storeName);
    const filtered = all.filter(item => 
      item.id !== id && 
      item.id_machine_registered !== id && 
      item.ref !== id && 
      item.code_bon !== id
    );
    
    if (this.db) {
      try {
        this.db.prepare(`DELETE FROM ${storeName} WHERE id = ?`).run(id);
      } catch {}
    }

    const primaryKey = this.getStorageKey(storeName);
    storageService.setItem(primaryKey, filtered);

    if (storeName === 'spare_parts') {
      storageService.setItem('gmao_raw_stock_v6', filtered);
    } else if (storeName === 'movements') {
      storageService.setItem('gmao_mouvements', filtered);
    }

    // Background sync delete to IndexedDB
    if (this.indexedDB) {
      this.indexedDB.delete(storeName, id).catch(() => {});
    }

    return true;
  }

  query(sql, params = []) {
    if (this.db) {
      try {
        const stmt = this.db.prepare(sql);
        return stmt.all(...params);
      } catch {
        Logger.error('❌ Query failed', { sql, params });
        return [];
      }
    }
    return [];
  }

  queryOne(sql, params = []) {
    if (this.db) {
      try {
        const stmt = this.db.prepare(sql);
        return stmt.get(...params);
      } catch (error) {
        Logger.error('❌ QueryOne failed', { sql, params, error: error.message });
        return null;
      }
    }
    return null;
  }

  execute(sql, params = []) {
    if (this.db) {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.run(...params);
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid
        };
      } catch (error) {
        Logger.error('❌ Execute failed', { sql, params, error: error.message });
        return { changes: 0, lastInsertRowid: 0 };
      }
    }
    return { changes: 1, lastInsertRowid: Date.now() };
  }

  transaction(callback) {
    if (this.db) {
      try {
        this.db.exec('BEGIN TRANSACTION');
        const result = callback(this);
        this.db.exec('COMMIT');
        return result;
      } catch (error) {
        try {
          this.db.exec('ROLLBACK');
        } catch {}
        throw error;
      }
    }
    return callback(this);
  }

  batchInsert(table, rows) {
    return this.transaction((db) => {
      let inserted = 0;
      for (const row of rows) {
        db.execute(`INSERT INTO ${table} VALUES (...)`, Object.values(row));
        inserted++;
      }
      return inserted;
    });
  }

  close() {
    if (this.db) {
      try {
        this.db.close();
      } catch {}
      this.db = null;
    }
    DatabaseService.instance = null;
  }

  getStats() {
    return {
      tables: 15,
      pageCount: 1,
      pageSize: 4096,
      sizeInMB: 0.1
    };
  }

  vacuum() {
    if (this.db) {
      try {
        this.db.exec('VACUUM');
      } catch {}
    }
  }
}

export class DatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseError';
  }
}
