import { Logger } from '../core/logger/LoggerService';

export type SyncQueueHandler = (operation: any, item: any) => Promise<any>;

export interface SyncQueueAddOptions {
  deferProcess?: boolean;
}

/**
 * Service de File d'Attente de Synchronisation Hors-Ligne (Offline Sync Queue)
 * Permet d'empiler et de rejouer les opérations critiques lorsque le réseau ou le stockage distant est rétabli.
 */
class SyncQueueService {
  queue: any[];
  inMemoryOperations: Map<any, Function>;
  operationHandlers: Map<string, SyncQueueHandler>;
  isOnline: boolean;
  isProcessing: boolean;
  private activeProcessPromise: Promise<void> | null;
  private rerunRequested: boolean;
  db: any;
  maxRetries: number;
  subscribers: Set<Function>;

  constructor() {
    this.queue = [];
    this.inMemoryOperations = new Map(); // id -> callable function
    this.operationHandlers = new Map(); // operation.type -> serializable persistent handler
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.isProcessing = false;
    this.activeProcessPromise = null;
    this.rerunRequested = false;
    this.db = null;
    this.maxRetries = 3;
    this.subscribers = new Set();
    this.setupListeners();
  }

  /**
   * Enregistre un gestionnaire persistant pour un type d'opération sérialisable (ex: PUSH_SERVER_STATE).
   * Permet de rejouer les opérations stockées dans IndexedDB même après un rechargement de page (F5).
   */
  registerOperationHandler(opType: string, handler: SyncQueueHandler): void {
    const cleanType = String(opType || '').trim();
    if (!cleanType || typeof handler !== 'function') return;
    this.operationHandlers.set(cleanType, handler);
  }

  unregisterOperationHandler(opType: string): void {
    const cleanType = String(opType || '').trim();
    if (!cleanType) return;
    this.operationHandlers.delete(cleanType);
  }

  hasOperationHandler(opType: string): boolean {
    const cleanType = String(opType || '').trim();
    return Boolean(cleanType && this.operationHandlers.has(cleanType));
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

      request.onupgradeneeded = (event: any) => {
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
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      pendingCount: this.queue.filter((q) => q.status === 'pending').length,
      failedCount: this.queue.filter((q) => q.status === 'failed').length,
      items: [...this.queue],
    };
  }

  /**
   * Ajout d'une opération à la file d'attente
   * @param {Function|Object} operation - Fonction à exécuter ou description d'action sérialisable
   * @param {'high'|'normal'|'low'} priority - Priorité d'exécution
   * @param {Object} metadata - Métadonnées sérialisables (ex: type de mouvement, ref, etc.)
   * @param {Object} addOptions - Options d'ajout (ex: deferProcess pour éviter boucle immédiate sur échec réseau)
   */
  async add(operation, priority = 'normal', metadata = {}, addOptions: SyncQueueAddOptions = {}) {
    try {
      if (!this.db) {
        await this.init();
      }

      const id = Date.now() + Math.floor(Math.random() * 10000);
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

      // Fusion/déduplication pour les opérations idempotentes (ex: PUSH_SERVER_STATE via coalesceKey)
      const coalesceKey =
        serializableOp && typeof serializableOp === 'object' ? serializableOp.coalesceKey : undefined;
      if (coalesceKey) {
        const existing = this.queue.find(
          (q) => q.status === 'pending' && q.operation?.coalesceKey === coalesceKey
        );
        if (existing) {
          existing.timestamp = new Date().toISOString();
          existing.operation = serializableOp;
          existing.metadata = metadata;
          existing.priority = priority;
          existing.retries = 0;
          existing.error = null;
          if (this.db) {
            await this.updateQueueItem(existing);
          }
          this.notifySubscribers();
          if (this.isOnline && !addOptions.deferProcess) {
            this.processQueue();
          }
          return existing;
        }
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

      // Traitement immédiat si en ligne (sauf si différé explicitement)
      if (this.isOnline && !addOptions.deferProcess) {
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
   * Traitement séquentiel de la file protégé par mutex anti-réentrance
   */
  async processQueue() {
    if (!this.isOnline || this.queue.length === 0) {
      return;
    }

    if (this.activeProcessPromise) {
      this.rerunRequested = true;
      return this.activeProcessPromise;
    }

    this.isProcessing = true;
    this.notifySubscribers();

    this.activeProcessPromise = (async () => {
      try {
        do {
          this.rerunRequested = false;
          if (!this.isOnline || this.queue.length === 0) break;

          Logger.debug('[SyncQueueService] 🔄 Traitement de la file de synchronisation...');

          const priorityMap: Record<string, number> = { high: 1, normal: 2, low: 3 };
          this.queue.sort((a: any, b: any) => {
            const pA = priorityMap[a.priority] || 2;
            const pB = priorityMap[b.priority] || 2;
            return pA - pB;
          });

          const pendingBatch = [...this.queue].filter((item) => item.status === 'pending');
          for (const item of pendingBatch) {
            if (!this.isOnline) break;
            if (item.status === 'pending') {
              await this.processItem(item);
            }
          }
        } while (this.rerunRequested && this.isOnline);
      } finally {
        this.isProcessing = false;
        this.activeProcessPromise = null;
        this.notifySubscribers();
      }
    })();

    return this.activeProcessPromise;
  }

  /**
   * Traitement d'un élément unique :
   * 1) Exécute la closure mémoire si présente dans la session courante
   * 2) Sinon résout un gestionnaire persistant enregistré via registerOperationHandler()
   * 3) Sinon rejette proprement (fail-closed) au lieu de supprimer silencieusement l'opération
   */
  async processItem(item) {
    try {
      Logger.debug('[SyncQueueService] ⏳ Traitement de l’opération:', item.id);

      const fn = this.inMemoryOperations.get(item.id);
      if (typeof fn === 'function') {
        await fn();
        this.inMemoryOperations.delete(item.id);
      } else {
        const opType = String(item.operation?.type || '').trim();
        const registeredHandler = opType ? this.operationHandlers.get(opType) : undefined;
        if (typeof registeredHandler === 'function') {
          await registeredHandler(item.operation, item);
        } else {
          throw new Error(
            `Opération hors-ligne non rejouable (${opType || 'INCONNUE'}) : aucun gestionnaire enregistré après rechargement.`
          );
        }
      }

      item.status = 'completed';
      if (this.db) {
        await this.updateQueueItem(item);
      }

      // Retrait de la file après exécution réussie
      this.queue = this.queue.filter((q) => q.id !== item.id);
      if (this.db) {
        await this.removeItem(item.id);
      }

      Logger.info('[SyncQueueService] ✅ Opération synchronisée avec succès:', item.id);
    } catch (error: any) {
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
   * Réinitialise les éléments en échec définitif et relance la file si en ligne
   */
  async retryFailed() {
    let resetCount = 0;
    for (const item of this.queue) {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.retries = 0;
        item.error = null;
        resetCount += 1;
        if (this.db) {
          await this.updateQueueItem(item);
        }
      }
    }
    this.notifySubscribers();
    if (resetCount > 0 && this.isOnline) {
      await this.processQueue();
    }
    return resetCount;
  }

  /**
   * Mise à jour d'un élément dans IndexedDB
   */
  async updateQueueItem(item: any) {
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
  async getQueue(): Promise<any[]> {
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
  async removeItem(itemId: any) {
    if (this.db) {
      await new Promise<void>((resolve) => {
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
      await new Promise<void>((resolve) => {
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
