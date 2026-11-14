import { Logger } from '../core/logger/LoggerService';

export type SyncQueuePriority = 'high' | 'normal' | 'low';
export type SyncQueueItemStatus = 'pending' | 'completed' | 'failed';

/**
 * Serializable command descriptor stored safely in IndexedDB (`GMAO_SyncQueue`).
 * Durable offline commands declare a `type` resolved after page reload via `registerOperationHandler()`.
 */
export interface SerializableSyncOperation {
  type: string;
  coalesceKey?: string;
  payload?: unknown;
  options?: Record<string, unknown>;
  [key: string]: unknown;
}

export type SyncQueueOperationInput =
  | SerializableSyncOperation
  | (() => Promise<unknown> | unknown);

export interface SyncQueueItem {
  id: number;
  timestamp: string;
  operation: SerializableSyncOperation;
  metadata: Record<string, unknown>;
  priority: SyncQueuePriority;
  status: SyncQueueItemStatus;
  retries: number;
  error: string | null;
  /** `true` when the command is a JSON-serializable action replayable across browser reloads. */
  replayableAcrossReload: boolean;
}

export type SyncQueueHandler = (
  operation: SerializableSyncOperation,
  item: SyncQueueItem
) => Promise<unknown>;

export interface SyncQueueAddOptions {
  deferProcess?: boolean;
}

export interface SyncQueueState {
  isOnline: boolean;
  isProcessing: boolean;
  queueLength: number;
  pendingCount: number;
  failedCount: number;
  durableCount: number;
  ephemeralCount: number;
  items: SyncQueueItem[];
}

export type SyncQueueSubscriber = (state: SyncQueueState) => void;

const PRIORITY_RANK: Record<SyncQueuePriority, number> = {
  high: 1,
  normal: 2,
  low: 3,
};

function sanitizeSerializableRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  try {
    const cloned = JSON.parse(JSON.stringify(value)) as unknown;
    return cloned && typeof cloned === 'object' && !Array.isArray(cloned)
      ? (cloned as Record<string, unknown>)
      : {};
  } catch {
    throw new Error('La charge utile hors-ligne doit être sérialisable en JSON.');
  }
}

function normalizeSerializableOperation(operation: SerializableSyncOperation): SerializableSyncOperation {
  const cleanType = String(operation?.type || '').trim();
  if (!cleanType) {
    throw new Error("Toute opération hors-ligne sérialisable doit spécifier un champ 'type' non vide.");
  }
  const cloned = sanitizeSerializableRecord(operation);
  return {
    ...cloned,
    type: cleanType,
  };
}

/**
 * Offline Synchronization Queue backed by IndexedDB (`GMAO_SyncQueue`).
 *
 * Design principles:
 *  - Prefer JSON-serializable commands (`{ type, coalesceKey?, payload?, options? }`) mapped to
 *    persistent handlers via `registerOperationHandler()`, surviving F5 reloads in the workshop.
 *  - Reject circular/non-serializable payloads immediately upon `add()`.
 *  - Legacy function closures passed inside the same browser session remain supported in
 *    `inMemoryOperations` (`replayableAcrossReload = false`), but fail explicitly with an audit-safe
 *    error if orphaned after reload rather than being silently dropped.
 */
class SyncQueueService {
  queue: SyncQueueItem[];
  /** Same-session closure fallback map; cleared on page reload (kept for legacy callers/tests). */
  inMemoryOperations: Map<number, () => Promise<unknown> | unknown>;
  operationHandlers: Map<string, SyncQueueHandler>;
  isOnline: boolean;
  isProcessing: boolean;
  private activeProcessPromise: Promise<void> | null;
  private rerunRequested: boolean;
  db: IDBDatabase | null;
  maxRetries: number;
  subscribers: Set<SyncQueueSubscriber>;

  constructor() {
    this.queue = [];
    this.inMemoryOperations = new Map();
    this.operationHandlers = new Map();
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
   * Registers a durable handler for a serializable command type (e.g., `PUSH_SERVER_STATE`).
   * Allows queued operations stored in IndexedDB to replay automatically after reload (F5).
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

  async init(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }

      const request = indexedDB.open('GMAO_SyncQueue', 1);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
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
        Logger.warn(
          'Impossible d’initialiser IndexedDB pour la SyncQueue, fallback en mémoire:',
          request.error,
          'SyncQueueService'
        );
        resolve(null);
      };
    });
  }

  async loadQueueFromDB(): Promise<void> {
    try {
      const items = await this.getQueue();
      this.queue = (items || []).map((item) => this.hydrateLoadedItem(item));
      this.notifySubscribers();
    } catch (e) {
      Logger.warn('Erreur chargement SyncQueue depuis DB:', e, 'SyncQueueService');
    }
  }

  private hydrateLoadedItem(raw: Partial<SyncQueueItem>): SyncQueueItem {
    const opObj: SerializableSyncOperation =
      raw.operation && typeof raw.operation === 'object' && typeof raw.operation.type === 'string'
        ? raw.operation
        : { type: 'UNKNOWN' };
    const isEphemeralClosure =
      opObj.type === 'FUNCTION_CALL' && !this.inMemoryOperations.has(Number(raw.id));
    return {
      id: Number(raw.id ?? Date.now()),
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
      operation: opObj,
      metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
      priority: raw.priority === 'high' || raw.priority === 'low' ? raw.priority : 'normal',
      status:
        raw.status === 'completed' || raw.status === 'failed' ? raw.status : 'pending',
      retries: Number.isFinite(raw.retries) ? Number(raw.retries) : 0,
      error: typeof raw.error === 'string' ? raw.error : null,
      replayableAcrossReload: !isEphemeralClosure && opObj.type !== 'FUNCTION_CALL',
    };
  }

  setupListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      Logger.info(
        '[SyncQueueService] 🌐 Connexion rétablie - Traitement de la file de synchronisation...'
      );
      this.isOnline = true;
      void this.processQueue();
      this.notifySubscribers();
    });

    window.addEventListener('offline', () => {
      Logger.info(
        '[SyncQueueService] 📡 Passage en mode hors-ligne - Les opérations sont mises en file d’attente.'
      );
      this.isOnline = false;
      this.notifySubscribers();
    });
  }

  subscribe(callback: SyncQueueSubscriber): () => void {
    this.subscribers.add(callback);
    callback(this.getState());
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notifySubscribers(): void {
    const state = this.getState();
    this.subscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        Logger.error('Erreur subscriber SyncQueue:', err, 'SyncQueueService');
      }
    });
  }

  getState(): SyncQueueState {
    const durableCount = this.queue.filter((q) => q.replayableAcrossReload).length;
    return {
      isOnline: this.isOnline,
      isProcessing: this.isProcessing,
      queueLength: this.queue.length,
      pendingCount: this.queue.filter((q) => q.status === 'pending').length,
      failedCount: this.queue.filter((q) => q.status === 'failed').length,
      durableCount,
      ephemeralCount: this.queue.length - durableCount,
      items: [...this.queue],
    };
  }

  /**
   * Enqueues either a durable serializable command `{ type, payload, coalesceKey }` (recommended)
   * or a same-session callback closure. Coalesces pending entries sharing the same `coalesceKey`.
   */
  async add(
    operation: SyncQueueOperationInput,
    priority: SyncQueuePriority = 'normal',
    metadata: Record<string, unknown> = {},
    addOptions: SyncQueueAddOptions = {}
  ): Promise<SyncQueueItem> {
    try {
      if (!this.db) {
        await this.init();
      }

      const id = Date.now() + Math.floor(Math.random() * 10000);
      const safeMetadata = sanitizeSerializableRecord(metadata);
      let serializableOp: SerializableSyncOperation;
      let replayableAcrossReload = true;

      if (typeof operation === 'function') {
        this.inMemoryOperations.set(id, operation);
        replayableAcrossReload = false;
        serializableOp = {
          type: 'FUNCTION_CALL',
          name: operation.name || 'anonymous_operation',
          metadata: safeMetadata,
        };
        Logger.warn(
          '[SyncQueueService] Enqueued ephemeral FUNCTION_CALL closure; prefer a serializable command descriptor { type, payload } for reload durability.',
          { id, name: serializableOp.name }
        );
      } else {
        serializableOp = normalizeSerializableOperation(operation);
      }

      const coalesceKey =
        typeof serializableOp.coalesceKey === 'string' && serializableOp.coalesceKey.trim()
          ? serializableOp.coalesceKey.trim()
          : undefined;
      if (coalesceKey) {
        const existing = this.queue.find(
          (q) => q.status === 'pending' && q.operation?.coalesceKey === coalesceKey
        );
        if (existing) {
          existing.timestamp = new Date().toISOString();
          existing.operation = serializableOp;
          existing.metadata = safeMetadata;
          existing.priority = priority;
          existing.retries = 0;
          existing.error = null;
          existing.replayableAcrossReload = replayableAcrossReload;
          if (this.db) {
            await this.updateQueueItem(existing);
          }
          this.notifySubscribers();
          if (this.isOnline && !addOptions.deferProcess) {
            void this.processQueue();
          }
          return existing;
        }
      }

      const queueItem: SyncQueueItem = {
        id,
        timestamp: new Date().toISOString(),
        operation: serializableOp,
        metadata: safeMetadata,
        priority,
        status: 'pending',
        retries: 0,
        error: null,
        replayableAcrossReload,
      };

      if (this.db) {
        await this.saveToQueue(queueItem);
      }

      this.queue.push(queueItem);
      this.notifySubscribers();

      Logger.debug('[SyncQueueService] 📝 Opération ajoutée à la file d’attente:', queueItem);

      if (this.isOnline && !addOptions.deferProcess) {
        void this.processQueue();
      }

      return queueItem;
    } catch (error) {
      Logger.error('[SyncQueueService] ❌ Erreur lors de l’ajout à la Sync Queue:', error);
      throw error;
    }
  }

  async saveToQueue(item: SyncQueueItem): Promise<unknown> {
    const db = this.db;
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(['queue'], 'readwrite');
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
   * Re-entrant safe sequential queue processor protected by `activeProcessPromise`.
   */
  async processQueue(): Promise<void> {
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

          this.queue.sort((a, b) => {
            const pA = PRIORITY_RANK[a.priority] || 2;
            const pB = PRIORITY_RANK[b.priority] || 2;
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
   * Executes one queued item:
   *  1. Resolves durable registered handler (`operationHandlers.get(op.type)`) when available
   *  2. Falls back to same-session in-memory closure if present
   *  3. Fails explicitly (fail-closed) when an orphaned closure cannot be replayed after reload
   */
  async processItem(item: SyncQueueItem): Promise<void> {
    try {
      Logger.debug('[SyncQueueService] ⏳ Traitement de l’opération:', item.id);

      const opType = String(item.operation?.type || '').trim();
      const registeredHandler = opType ? this.operationHandlers.get(opType) : undefined;

      if (typeof registeredHandler === 'function') {
        await registeredHandler(item.operation, item);
        this.inMemoryOperations.delete(item.id);
      } else {
        const fn = this.inMemoryOperations.get(item.id);
        if (typeof fn === 'function') {
          await fn();
          this.inMemoryOperations.delete(item.id);
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

      this.queue = this.queue.filter((q) => q.id !== item.id);
      if (this.db) {
        await this.removeItem(item.id);
      }

      Logger.info('[SyncQueueService] ✅ Opération synchronisée avec succès:', item.id);
    } catch (error) {
      Logger.error('[SyncQueueService] ❌ Erreur d’exécution de l’opération:', error);

      item.retries = (item.retries || 0) + 1;
      item.error = error instanceof Error && error.message ? error.message : 'Erreur inconnue';

      if (item.retries >= this.maxRetries) {
        item.status = 'failed';
        Logger.error(
          `[SyncQueueService] ❌ Échec définitif après ${this.maxRetries} tentatives pour l’item ${item.id}`
        );
      } else {
        item.status = 'pending';
        Logger.debug(
          `[SyncQueueService] 🔄 Nouvelle tentative programmée (${item.retries}/${this.maxRetries})`
        );
      }

      if (this.db) {
        await this.updateQueueItem(item);
      }
    }
  }

  async retryFailed(): Promise<number> {
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

  async updateQueueItem(item: SyncQueueItem): Promise<unknown> {
    const db = this.db;
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(['queue'], 'readwrite');
        const store = tx.objectStore('queue');
        const request = store.put(item);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  async getQueue(): Promise<SyncQueueItem[]> {
    if (!this.db) {
      await this.init();
    }
    const db = this.db;
    if (!db) return this.queue;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(['queue'], 'readonly');
        const store = tx.objectStore('queue');
        const request = store.getAll();

        request.onsuccess = () => {
          const rows = Array.isArray(request.result) ? request.result : [];
          resolve(rows.map((r) => this.hydrateLoadedItem(r as Partial<SyncQueueItem>)));
        };
        request.onerror = () => reject(request.error);
      } catch {
        resolve(this.queue);
      }
    });
  }

  async removeItem(itemId: number): Promise<void> {
    const db = this.db;
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(['queue'], 'readwrite');
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

  async clearQueue(): Promise<void> {
    const db = this.db;
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction(['queue'], 'readwrite');
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
