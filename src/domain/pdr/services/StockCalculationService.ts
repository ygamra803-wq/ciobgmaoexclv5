/**
 * @module StockCalculationService
 * @description
 * Canonical Spare Parts (`PDR`) Stock Calculation Engine for CIOB GMAO v4.
 *
 * ### Core Mathematical Invariant (`AGENTS.md` §1.3):
 * - `stockActuel = Math.max(0, stockInitial + entrées − sorties)`
 * - Never combine direct `stockInitial` mutation with a `SORTIE` movement (prevents double deduction).
 * - Maker-Checker unapproved demands (`PENDING_VALIDATION` in `sortieDemands`) remain excluded from `movements`
 *   until explicitly approved by a supervisor.
 */

import { Logger } from '../../../core/logger/LoggerService';
import { safeNum, calculateStockStatus } from '../../../utils/formulaEngine';
import { multiLevelCacheManager } from '../../../core/cache/MultiLevelCacheManager';
import { normalizeType } from '../../../application/IncrementalStockIndex';

/**
 * Computed stock snapshot for a single spare part reference (`PDR`).
 */
export interface StockCalculationResult {
  ref: string;
  designation: string;
  stockInitial: number;
  entrees: number;
  sorties: number;
  stockActuel: number;
  alerte: 'OK' | 'ALERTE' | 'RUPTURE';
  seuil: number;
  lastUpdated: Date;
}

/**
 * Canonical Stock Calculation Service for CIOB GMAO v4.
 *
 * ### Capabilities & Performance Guarantees:
 * - **Multi-Level Caching:** L1 in-memory TTL map (`5000ms`) synchronized with `multiLevelCacheManager` (`stock` & `formula` tags).
 * - **Single-Pass Batch Aggregation:** `calculateAllStocks` and `generateStockReport` execute in `O(A + M)` linear time (`A` = articles, `M` = movements).
 * - **Pre-Dispatch Availability Guard:** `checkAvailability` validates requested quantities and computes exact shortages prior to movement creation.
 * - **Per-Reference Serial Concurrency Queue:** `queueConcurrentMovement` serializes concurrent async mutations targeting the same `ref` key to eliminate race conditions.
 */
export class StockCalculationService {
  static cache = new Map();
  static cacheTtlMs = 5000; // 5s cache TTL
  static movementQueue = new Map(); // Key: ref -> Promise chain for concurrency control
  static normalizeType = normalizeType;

  /**
   * Computes a lightweight `O(1)` fingerprint hash for a movement array based on its length
   * and boundary/midpoint elements (`first`, `mid`, `last`).
   *
   * @param movements - Array of stock movement records (`IMouvement[]`).
   * @returns Deterministic string fingerprint used as part of the L1 cache key.
   */
  static getMovementHash(movements) {
    if (!Array.isArray(movements) || movements.length === 0) return 'mvt_0';
    const len = movements.length;
    const first = movements[0];
    const mid = movements[Math.floor(len / 2)];
    const last = movements[len - 1];
    return `mvt_${len}_${first?.id || first?.code_bon || '0'}_${mid?.quantite || '0'}_${last?.id || last?.code_bon || '0'}`;
  }

  /**
   * Clears the L1 calculation cache and invalidates the `'stock'` and `'formula'` tags
   * in the global `multiLevelCacheManager`.
   */
  static clearCache() {
    this.cache.clear();
    multiLevelCacheManager.invalidateByTag('stock');
    multiLevelCacheManager.invalidateByTag('formula');
  }

  /**
   * Calculates cumulative stock entries (`ENTREE`) for a given spare part reference (`ref`)
   * with L1 TTL caching (`5s`). Equivalent to Excel `SUMIFS` on normalized `ENTREE` movements.
   *
   * @param ref - Spare part reference code (case-insensitive).
   * @param movements - Array of stock movement records.
   * @returns Total quantity entered (`>= 0`). Returns `0` on empty ref or error.
   */
  static calculateEntrees(ref, movements = []) {
    try {
      if (!ref) return 0;
      const refKey = String(ref).toUpperCase().trim();
      const hash = `${refKey}_entrees_${this.getMovementHash(movements)}`;

      if (this.cache.has(hash)) {
        const cached = this.cache.get(hash);
        if (Date.now() - cached.timestamp < this.cacheTtlMs) {
          return cached.value;
        }
      }

      const entrees = movements.reduce((sum, m) => {
        if (!m) return sum;
        const mRef = String(m.ref || m.Ref || '').toUpperCase().trim();
        const normalized = normalizeType(m.type || '');
        if (mRef === refKey && normalized === 'ENTREE') {
          return sum + safeNum(m.quantite || m.quantity, 0);
        }
        return sum;
      }, 0);

      this.cache.set(hash, { value: entrees, timestamp: Date.now() });
      return entrees;
    } catch (error) {
      Logger.error('❌ Entrees calculation failed', error, 'StockCalc');
      return 0;
    }
  }

  /**
   * Calculates cumulative stock withdrawals (`SORTIE`) for a given spare part reference (`ref`)
   * with L1 TTL caching (`5s`). Equivalent to Excel `SUMIFS` on normalized `SORTIE` movements.
   *
   * @param ref - Spare part reference code (case-insensitive).
   * @param movements - Array of stock movement records.
   * @returns Total quantity withdrawn (`>= 0`). Returns `0` on empty ref or error.
   */
  static calculateSorties(ref, movements = []) {
    try {
      if (!ref) return 0;
      const refKey = String(ref).toUpperCase().trim();
      const hash = `${refKey}_sorties_${this.getMovementHash(movements)}`;

      if (this.cache.has(hash)) {
        const cached = this.cache.get(hash);
        if (Date.now() - cached.timestamp < this.cacheTtlMs) {
          return cached.value;
        }
      }

      const sorties = movements.reduce((sum, m) => {
        if (!m) return sum;
        const mRef = String(m.ref || m.Ref || '').toUpperCase().trim();
        const normalized = normalizeType(m.type || '');
        if (mRef === refKey && normalized === 'SORTIE') {
          return sum + safeNum(m.quantite || m.quantity, 0);
        }
        return sum;
      }, 0);

      this.cache.set(hash, { value: sorties, timestamp: Date.now() });
      return sorties;
    } catch (error) {
      Logger.error('❌ Sorties calculation failed', error, 'StockCalc');
      return 0;
    }
  }

  /**
   * Computes current stock balance (`stockActuel`) for a single article according to the
   * canonical invariant: `stockInitial + entrées - sorties` via `calculateStockStatus`.
   *
   * @param article - Stock item entity (`IStockItem`) containing `ref`, `stockInitial`, and `seuil`.
   * @param movements - Array of stock movement records (`IMouvement[]`).
   * @returns Current stock balance. Falls back to `stockInitial` if an unexpected error occurs.
   */
  static calculateStockActuel(article, movements = []) {
    try {
      if (!article) return 0;
      const ref = article.ref || article.Ref || '';
      const stockInitial = safeNum(article.stockInitial || article.stock_initial, 0);
      const entrees = this.calculateEntrees(ref, movements);
      const sorties = this.calculateSorties(ref, movements);

      const status = calculateStockStatus(
        stockInitial,
        entrees,
        sorties,
        article.seuil || article.minThreshold || 0,
        article.isAchatUnique
      );

      return status.stockActuelRaw !== undefined ? status.stockActuelRaw : status.stockActuel;
    } catch (error) {
      Logger.error('❌ Stock calculation failed', error, 'StockCalc');
      return safeNum(article?.stockInitial, 0);
    }
  }

  /**
   * Evaluates the stock alert threshold state for a given article and its current stock level.
   * - One-off purchase items (`isAchatUnique === true`) always return `'OK'`.
   * - `currentStock <= 0` -> `'RUPTURE'`
   * - `currentStock <= seuil` -> `'ALERTE'`
   * - Otherwise -> `'OK'`
   *
   * @param article - Stock item entity (`IStockItem`).
   * @param currentStock - Computed current stock balance.
   * @returns Alert level: `'OK' | 'ALERTE' | 'RUPTURE'`.
   */
  static getAlertStatus(article, currentStock) {
    try {
      const seuil = safeNum(article?.seuil || article?.minThreshold, 0);
      if (article?.isAchatUnique) return 'OK';
      if (currentStock <= 0) return 'RUPTURE';
      if (currentStock <= seuil) return 'ALERTE';
      return 'OK';
    } catch (error) {
      Logger.error('❌ Alert status calculation failed', error, 'StockCalc');
      return 'OK';
    }
  }

  /**
   * Pre-dispatch availability validator executed before recording a `SORTIE` movement.
   * Verifies that `requestedQty > 0` and `currentStock >= requestedQty`, returning exact shortage metrics.
   *
   * @param ref - Spare part reference code.
   * @param requestedQty - Quantity requested for withdrawal.
   * @param article - Target stock article record (`IStockItem`).
   * @param movements - Movement history used to compute live availability.
   * @returns Availability check object (`available`, `currentStock`, `requestedQty`, `shortage`, `message`).
   */
  static checkAvailability(ref, requestedQty, article, movements = []) {
    try {
      const qty = safeNum(requestedQty, 0);
      if (qty <= 0) {
        return {
          available: false,
          currentStock: 0,
          requestedQty: qty,
          shortage: 0,
          message: 'La quantité demandée doit être supérieure à 0.',
        };
      }

      const currentStock = this.calculateStockActuel(article, movements);

      if (currentStock < qty) {
        const shortage = qty - currentStock;
        return {
          available: false,
          currentStock,
          requestedQty: qty,
          shortage,
          message: `Stock insuffisant pour la référence "${ref}". Mousse disponible: ${currentStock}, Demandé: ${qty}, Manquant: ${shortage}.`,
        };
      }

      return {
        available: true,
        currentStock,
        requestedQty: qty,
        shortage: 0,
        message: 'Stock disponible suffisant.',
      };
    } catch (error) {
      Logger.error('❌ Stock availability check error', error, 'StockCalc');
      return {
        available: false,
        currentStock: 0,
        requestedQty: safeNum(requestedQty, 0),
        shortage: safeNum(requestedQty, 0),
        message: 'Erreur lors de la vérification du stock.',
      };
    }
  }

  /**
   * Serializes concurrent asynchronous stock movement mutations targeting the same `ref` key
   * via a per-reference Promise chain. Invalidates calculation caches prior to each task execution
   * so subsequent tasks in the queue always observe the latest committed balance.
   *
   * @param ref - Spare part reference code (or `'global'` fallback) acting as the mutex key.
   * @param movementTaskFn - Async callback performing the stock check and movement persistence.
   * @returns Promise resolving with the result of `movementTaskFn()`.
   */
  static async queueConcurrentMovement(ref, movementTaskFn) {
    const key = String(ref || 'global').toLowerCase().trim();
    const currentQueue = this.movementQueue.get(key) || Promise.resolve();

    const nextTask = currentQueue
      .then(async () => {
        this.clearCache();
        return await movementTaskFn();
      })
      .catch((err) => {
        Logger.error(`Concurrent movement queue error for [${key}]:`, err, 'StockCalc');
        throw err;
      });

    // Keep queue alive even if task rejects
    this.movementQueue.set(key, nextTask.catch(() => {}));
    return nextTask;
  }

  /**
   * Generates a complete financial and operational stock valuation report in `O(A + M)` linear time.
   * Indexes all movements in a single `O(M)` pass, then computes valuation and alert buckets in `O(A)`.
   *
   * @param articles - Array of stock articles (`IStockItem[]`).
   * @param movements - Array of stock movements (`IMouvement[]`).
   * @returns Aggregated valuation report (`totalArticles`, `totalQuantity`, `totalValue`, `summary`, `ruptureItems`, `alerteItems`).
   */
  static generateStockReport(articles = [], movements = []) {
    try {
      let totalValue = 0;
      let totalQuantity = 0;
      let countRupture = 0;
      let countAlerte = 0;
      let countOK = 0;
      const ruptureItems = [];
      const alerteItems = [];

      // Single-pass O(M) index
      const mvtIndex = new Map();
      movements.forEach((m) => {
        if (!m) return;
        const r = String(m.ref || m.Ref || '').toUpperCase().trim();
        if (!r) return;
        if (!mvtIndex.has(r)) {
          mvtIndex.set(r, { entrees: 0, sorties: 0 });
        }
        const entry = mvtIndex.get(r);
        const normalized = normalizeType(m.type || '');
        const qty = safeNum(m.quantite || m.quantity, 0);
        if (normalized === 'ENTREE') {
          entry.entrees += qty;
        } else if (normalized === 'SORTIE') {
          entry.sorties += qty;
        }
      });

      // Single-pass O(A) calculations
      articles.forEach((art) => {
        if (!art) return;
        const refKey = String(art.ref || '').toUpperCase().trim();
        const mTotals = mvtIndex.get(refKey) || { entrees: 0, sorties: 0 };
        const init = safeNum(art.stockInitial || art.initialStock, 0);
        const currentStock = Math.max(0, init + mTotals.entrees - mTotals.sorties);
        const status = this.getAlertStatus(art, currentStock);
        const unitPrice = safeNum(art.prixUnitaire || art.unitPrice || art.prix_unitaire, 0);
        const itemVal = currentStock * unitPrice;

        totalValue += itemVal;
        totalQuantity += currentStock;

        const reportItem = {
          ref: art.ref,
          designation: art.designation || art.name || '',
          stockInitial: init,
          stockActuel: currentStock,
          unitPrice,
          totalValue: itemVal,
          status,
        };

        if (status === 'RUPTURE') {
          countRupture++;
          ruptureItems.push(reportItem);
        } else if (status === 'ALERTE') {
          countAlerte++;
          alerteItems.push(reportItem);
        } else {
          countOK++;
        }
      });

      return {
        generatedAt: new Date().toISOString(),
        totalArticles: articles.length,
        totalQuantity,
        totalValue: Number(totalValue.toFixed(2)),
        summary: {
          rupture: countRupture,
          alerte: countAlerte,
          ok: countOK,
        },
        ruptureItems,
        alerteItems,
      };
    } catch (error) {
      Logger.error('❌ Error generating stock report', error, 'StockCalc');
      return {
        totalArticles: articles.length,
        totalQuantity: 0,
        totalValue: 0,
        summary: { rupture: 0, alerte: 0, ok: 0 },
        ruptureItems: [],
        alerteItems: [],
      };
    }
  }

  /**
   * Batch-calculates `StockCalculationResult` for all articles in `O(A + M)` linear time
   * using normalized reference keys and movement types (`ENTREE` / `SORTIE`).
   *
   * @param articles - Collection of stock items (`IStockItem[]`).
   * @param movements - Collection of stock movements (`IMouvement[]`).
   * @returns Array of {@link StockCalculationResult} in the same order as `articles`.
   */
  static calculateAllStocks(
    articles: any[] = [],
    movements: any[] = []
  ): StockCalculationResult[] {
    const index = new Map<string, { entreesSum: number; sortiesSum: number }>();

    if (Array.isArray(movements)) {
      for (let i = 0; i < movements.length; i++) {
        const m = movements[i];
        if (!m) continue;
        const key = String(m.ref || m.Ref || '').trim().toUpperCase();
        if (!key) continue;
        let item = index.get(key);
        if (!item) {
          item = { entreesSum: 0, sortiesSum: 0 };
          index.set(key, item);
        }
        const qty = safeNum(m.quantite ?? m.quantity, 0);
        const norm = normalizeType(m.type || '');
        if (norm === 'ENTREE') item.entreesSum += qty;
        else if (norm === 'SORTIE') item.sortiesSum += qty;
      }
    }

    const now = new Date();
    return (Array.isArray(articles) ? articles : []).map((article) => {
      const ref = String(article?.ref || '').trim();
      const key = ref.toUpperCase();
      const stockInitial = safeNum(article?.stockInitial, 0);
      const seuil = safeNum(article?.seuil, 0);
      const mvt = index.get(key);
      const entrees = mvt ? mvt.entreesSum : 0;
      const sorties = mvt ? mvt.sortiesSum : 0;
      const rawActuel = stockInitial + entrees - sorties;
      const stockActuel = Math.max(0, rawActuel);
      const alerte: 'OK' | 'ALERTE' | 'RUPTURE' =
        rawActuel <= 0 ? 'RUPTURE' : rawActuel <= seuil ? 'ALERTE' : 'OK';

      return {
        ref,
        designation: article?.designation || '',
        stockInitial,
        entrees,
        sorties,
        stockActuel,
        alerte,
        seuil,
        lastUpdated: now,
      };
    });
  }

  /**
   * Computes {@link StockCalculationResult} for a single article against the movement ledger.
   *
   * @param article - Single stock item (`IStockItem`).
   * @param movements - Movement ledger (`IMouvement[]`).
   * @returns Computed {@link StockCalculationResult}.
   */
  static calculateStockByRef(article: any, movements: any[] = []): StockCalculationResult {
    const [res] = this.calculateAllStocks([article], movements);
    return res;
  }

  /**
   * Pure threshold comparator mapping `(stockActuel, seuil)` to `'OK' | 'ALERTE' | 'RUPTURE'`.
   *
   * @param stockActuel - Computed current stock balance.
   * @param seuil - Minimum alert threshold.
   * @returns `'RUPTURE'` when `<= 0`, `'ALERTE'` when `<= seuil`, otherwise `'OK'`.
   */
  static getStockStatus(stockActuel: number, seuil: number): 'OK' | 'ALERTE' | 'RUPTURE' {
    if (stockActuel <= 0) return 'RUPTURE';
    if (stockActuel <= seuil) return 'ALERTE';
    return 'OK';
  }

  /**
   * Partitions an array of {@link StockCalculationResult} into `rupture`, `alerte`, and `ok` buckets.
   *
   * @param stocks - Array of computed stock results.
   * @returns Partitioned buckets `{ rupture, alerte, ok }`.
   */
  static getStockAlerts(stocks: StockCalculationResult[] = []) {
    return {
      rupture: stocks.filter((s) => s.alerte === 'RUPTURE'),
      alerte: stocks.filter((s) => s.alerte === 'ALERTE'),
      ok: stocks.filter((s) => s.alerte === 'OK'),
    };
  }

  /**
   * Computes summary KPIs across an array of {@link StockCalculationResult}.
   *
   * @param stocks - Array of computed stock results.
   * @returns Summary metrics (`totalArticles`, `totalValue`, `articlesInRupture`, `articlesInAlerte`, `articlesOK`, `averageStock`).
   */
  static getStockStatistics(stocks: StockCalculationResult[] = []) {
    return {
      totalArticles: stocks.length,
      totalValue: stocks.reduce((sum, s) => sum + s.stockActuel * 100, 0),
      articlesInRupture: stocks.filter((s) => s.alerte === 'RUPTURE').length,
      articlesInAlerte: stocks.filter((s) => s.alerte === 'ALERTE').length,
      articlesOK: stocks.filter((s) => s.alerte === 'OK').length,
      averageStock:
        stocks.length > 0
          ? stocks.reduce((sum, s) => sum + s.stockActuel, 0) / stocks.length
          : 0,
    };
  }

  /**
   * Audits pre-stored `stockActuel` and `alerte` fields on `articles` against fresh
   * recalculations from `movements`, returning any discrepancies exceeding `0.01`.
   *
   * @param articles - Array of stock articles containing cached/expected `stockActuel` and `alerte`.
   * @param movements - Authoritative movement ledger.
   * @returns Audit result `{ isValid, mismatches }`.
   */
  static async verifyCalculations(articles = [], movements = []) {
    try {
      const mismatches = [];

      for (const article of articles) {
        const calculatedStock = this.calculateStockActuel(article, movements);
        const calculatedAlert = this.getAlertStatus(article, calculatedStock);

        if (article.stockActuel !== undefined && Math.abs(article.stockActuel - calculatedStock) > 0.01) {
          mismatches.push({
            ref: article.ref,
            field: 'stockActuel',
            expected: article.stockActuel,
            calculated: calculatedStock,
            difference: article.stockActuel - calculatedStock,
          });
        }

        if (article.alerte && article.alerte !== calculatedAlert) {
          mismatches.push({
            ref: article.ref,
            field: 'alerte',
            expected: article.alerte,
            calculated: calculatedAlert,
          });
        }
      }

      return {
        isValid: mismatches.length === 0,
        mismatches,
      };
    } catch (error: any) {
      Logger.error('❌ Verification failed', error, 'StockCalc');
      return { isValid: false, error: error?.message || String(error) };
    }
  }
}

export default StockCalculationService;

