import { Logger } from '../core/logger/LoggerService';

/**
 * Service de File d'Attente de Synchronisation Hors-Ligne (Offline Sync Queue)
 * Permet d'empiler et de rejouer les opérations critiques lorsque le réseau ou le stockage distant est rétabli.
 */
class SyncQueueService {
  constructor() {
    this.queue = [];
    this.inMemoryOperations = new Map(); // id -> callable function
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.db = null;
    this.maxRetries = 3;
    this.subscribers = new Set();
    this.setupListeners();
  }

  /**
   * Initialisation de la base IndexedDB pour la Sync Queue
   */
  async init() {
    if (this.db) return this.db;
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }

      const request = indexedDB.open('GMAO_SyncQueue', 1);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('queue')) {
          const store = db.createObjectStore('queue', {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('priority', 'priority', { unique: false });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.loadQueueFromDB().then(() => resolve(this.db));
      };

      request.onerror = () => {
        Logger.warn('Impossible d’initialiser IndexedDB pour la SyncQueue, fallback en mémoire:', request.error, 'SyncQueueService');
        resolve(null);
      };
    });
  }

  /**
   * Charger les éléments en attente depuis la DB
   */
  async loadQueueFromDB() {
    try {
      const items = await this.getQueue();
      this.queue = items || [];
      this.notifySubscribers();
    } catch (e) {
      Logger.warn('Erreur chargement SyncQueue depuis DB:', e, 'SyncQueueService');
    }
  }

  /**
   * Configuration des écouteurs de statut réseau
   */
  setupListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      Logger.info('[SyncQueueService] 🌐 Connexion rétablie - Traitement de la file de synchronisation...');
      this.isOnline = true;
      this.processQueue();
      this.notifySubscribers();
    });

    window.addEventListener('offline', () => {
      Logger.info('[SyncQueueService] 📡 Passage en mode hors-ligne - Les opérations sont mises en file d’attente.');
      this.isOnline = false;
      this.notifySubscribers();
    });
  }

  /**
   * Abonnement aux changements d'état de la queue
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    const state = this.getState();
    this.subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        Logger.error('Erreur subscriber SyncQueue:', err, 'SyncQueueService');
      }
    });
  }

  getState() {
    return {
      isOnline: this.isOnline,
      queueLength: this.queue.length,
      pendingCount: this.queue.filter((q) => q.status === 'pending').length,
      failedCount: this.queue.filter((q) => q.status === 'failed').length,
      items: [...this.queue],
    };
  }

  /**
   * Ajout d'une opération à la file d'attente
   * @param {Function|Object} operation - Fonction à exécuter ou description d'action
   * @param {'high'|'normal'|'low'} priority - Priorité d'exécution
   * @param {Object} metadata - Métadonnées sérialisables (ex: type de mouvement, ref, etc.)
   */
  async add(operation, priority = 'normal', metadata = {}) {
    try {
      if (!this.db) {
        await this.init();
      }

      const id = Date.now() + Math.floor(Math.random() * 1000);
      let serializableOp = null;

      if (typeof operation === 'function') {
        this.inMemoryOperations.set(id, operation);
        serializableOp = {
          type: 'FUNCTION_CALL',
          name: operation.name || 'anonymous_operation',
          metadata,
        };
      } else {
        serializableOp = operation;
      }

      const queueItem = {
        id,
        timestamp: new Date().toISOString(),
        operation: serializableOp,
        metadata,
        priority,
        status: 'pending',
        retries: 0,
        error: null,
      };

      // Sauvegarde dans IndexedDB
      if (this.db) {
        await this.saveToQueue(queueItem);
      }

      // Ajout en mémoire
      this.queue.push(queueItem);
      this.notifySubscribers();

      Logger.debug('[SyncQueueService] 📝 Opération ajoutée à la file d’attente:', queueItem);

      // Traitement immédiat si en ligne
      if (this.isOnline) {
        this.processQueue();
      }

      return queueItem;
    } catch (error) {
      Logger.error('[SyncQueueService] ❌ Erreur lors de l’ajout à la Sync Queue:', error);
      throw error;
    }
  }

  /**
   * Sauvegarde dans IndexedDB
   */
  async saveToQueue(item) {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(['queue'], 'readwrite');
        const store = tx.objectStore('queue');
        const request = store.add(item);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Traitement séquentiel de la file
   */
  async processQueue() {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    Logger.debug('[SyncQueueService] 🔄 Traitement de la file de synchronisation...');

    // Ordonnancement par priorité
    const priorityMap = { high: 1, normal: 2, low: 3 };
    this.queue.sort((a, b) => {
      const pA = priorityMap[a.priority] || 2;
      const pB = priorityMap[b.priority] || 2;
      return pA - pB;
    });

    for (const item of [...this.queue]) {
      if (item.status === 'pending') {
        await this.processItem(item);
      }
    }

    this.notifySubscribers();
  }

  /**
   * Traitement d'un élément unique
   */
  async processItem(item) {
    try {
      Logger.debug('[SyncQueueService] ⏳ Traitement de l’opération:', item.id);

      const fn = this.inMemoryOperations.get(item.id);
      if (typeof fn === 'function') {
        await fn();
        this.inMemoryOperations.delete(item.id);
      }

      item.status = 'completed';
      if (this.db) {
        await this.updateQueueItem(item);
      }

      // Retrait de la file
      this.queue = this.queue.filter((q) => q.id !== item.id);
      if (this.db) {
        await this.removeItem(item.id);
      }

      Logger.info('[SyncQueueService] ✅ Opération synchronisée avec succès:', item.id);
    } catch (error) {
      Logger.error('[SyncQueueService] ❌ Erreur d’exécution de l’opération:', error);

      item.retries = (item.retries || 0) + 1;
      item.error = error?.message || 'Erreur inconnue';

      if (item.retries >= this.maxRetries) {
        item.status = 'failed';
        Logger.error(`[SyncQueueService] ❌ Échec définitif après ${this.maxRetries} tentatives pour l’item ${item.id}`);
      } else {
        item.status = 'pending';
        Logger.debug(`[SyncQueueService] 🔄 Nouvelle tentative programmée (${item.retries}/${this.maxRetries})`);
      }

      if (this.db) {
        await this.updateQueueItem(item);
      }
    }
  }

  /**
   * Mise à jour d'un élément dans IndexedDB
   */
  async updateQueueItem(item) {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(['queue'], 'readwrite');
        const store = tx.objectStore('queue');
        const request = store.put(item);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Lecture de tous les éléments de la file
   */
  async getQueue() {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) return this.queue;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(['queue'], 'readonly');
        const store = tx.objectStore('queue');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch {
        resolve(this.queue);
      }
    });
  }

  /**
   * Suppression d'un élément
   */
  async removeItem(itemId) {
    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(['queue'], 'readwrite');
          const store = tx.objectStore('queue');
          const request = store.delete(itemId);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
    this.inMemoryOperations.delete(itemId);
    this.queue = this.queue.filter((q) => q.id !== itemId);
    this.notifySubscribers();
  }

  /**
   * Vider toute la file
   */
  async clearQueue() {
    if (this.db) {
      await new Promise((resolve) => {
        try {
          const tx = this.db.transaction(['queue'], 'readwrite');
          const store = tx.objectStore('queue');
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
    this.inMemoryOperations.clear();
    this.queue = [];
    this.notifySubscribers();
  }
}

export const syncQueueService = new SyncQueueService();
export default syncQueueService;
