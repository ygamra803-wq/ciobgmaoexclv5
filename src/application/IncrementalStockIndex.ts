export type MovementType = 'ENTREE' | 'SORTIE' | 'COMMANDE';

const TYPE_ALIASES: Record<string, MovementType> = {
  'entree': 'ENTREE',
  'entree interne': 'ENTREE',
  'entree externe': 'ENTREE',
  'reception': 'ENTREE',
  'retour': 'ENTREE',
  'retour atelier': 'ENTREE',
  'in': 'ENTREE',
  'reappro': 'ENTREE',
  'reapprovisionnement': 'ENTREE',
  'entree_retour': 'ENTREE',
  'sortie': 'SORTIE',
  'sortie interne': 'SORTIE',
  'sortie externe': 'SORTIE',
  'bon de sortie': 'SORTIE',
  'consommation': 'SORTIE',
  'out': 'SORTIE',
  'commande': 'COMMANDE',
  'commande_fournisseur': 'COMMANDE',
  'demande': 'COMMANDE',
};

export function normalizeType(raw: string): MovementType | null {
  const t = String(raw ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // strip accents
  return TYPE_ALIASES[t] ?? null;
}

export interface StockTotals {
  entrees: number;
  sorties: number;
  commandes: number;
  lastUpdated: number;
}

export interface MovementDelta {
  ref?: string;
  itemId?: string;
  Ref?: string;
  type: string;
  quantity?: number;
  quantite?: number;
  [key: string]: any;
}

export class IncrementalStockIndex {
  private index = new Map<string, StockTotals>();
  private initialStocks = new Map<string, number>();
  private movementHistory = new Map<string, MovementDelta[]>();
  private hydrated = false;

  hasData(): boolean {
    return this.index.size > 0;
  }

  isHydrated(): boolean {
    return this.hydrated;
  }

  markHydrated(value = true): void {
    this.hydrated = value;
  }

  setInitialStock(ref: string, qty: number): void {
    this.initialStocks.set(this._key(ref), Number(qty) || 0);
  }

  setAllInitialStocks(initialStockMap: Map<string, number> | Record<string, number>): void {
    if (initialStockMap instanceof Map) {
      initialStockMap.forEach((qty, ref) => {
        this.setInitialStock(ref, qty);
      });
    } else if (typeof initialStockMap === 'object' && initialStockMap !== null) {
      Object.entries(initialStockMap).forEach(([ref, qty]) => {
        this.setInitialStock(ref, Number(qty) || 0);
      });
    }
  }

  rebuild(movements: MovementDelta[] = [], initialStocks?: Map<string, number> | Record<string, number>): void {
    this.index.clear();
    this.movementHistory.clear();
    if (initialStocks) {
      this.initialStocks.clear();
      this.setAllInitialStocks(initialStocks);
    }
    if (Array.isArray(movements)) {
      for (let i = 0; i < movements.length; i++) {
        const m = movements[i];
        if (!m) continue;
        this._accumulate(m, +1);
      }
    }
    this.hydrated = true;
  }

  /**
   * Alias for rebuild() supporting core/domain/services benchmark and legacy callers
   */
  buildIndex(
    movements: MovementDelta[] = [],
    initialStocks: Map<string, number> | Record<string, number> = new Map()
  ): void {
    this.rebuild(movements, initialStocks);
  }

  applyDelta(m: MovementDelta): void {
    this._accumulate(m, +1);
  }

  /**
   * Alias for applyDelta() supporting core/domain/services callers
   */
  addMovement(m: MovementDelta): void {
    if (!m) return;
    const key = this._key(m.ref ?? m.itemId ?? m.Ref ?? '');
    if (key) {
      let list = this.movementHistory.get(key);
      if (!list) {
        list = [];
        this.movementHistory.set(key, list);
      }
      list.push(m);
    }
    this._accumulate(m, +1);
  }

  getMovements(ref: string): MovementDelta[] {
    const key = this._key(ref);
    if (!key) return [];
    return this.movementHistory.get(key) ?? [];
  }

  getStock(ref: string): number {
    return this.calculateCurrentStock(ref);
  }

  getAllStocks(): Map<string, number> {
    const result = new Map<string, number>();
    const allKeys = new Set<string>([
      ...this.initialStocks.keys(),
      ...this.index.keys(),
    ]);
    allKeys.forEach((k) => {
      result.set(k, this.calculateCurrentStock(k));
    });
    return result;
  }

  clear(): void {
    this.index.clear();
    this.initialStocks.clear();
    this.movementHistory.clear();
    this.hydrated = false;
  }

  rollbackDelta(m: MovementDelta): void {
    this._accumulate(m, -1);
  }

  updateDelta(args: {
    ref: string;
    oldType: string;
    oldQty: number;
    newType: string;
    newQty: number;
  }): void {
    this._accumulate({ ref: args.ref, type: args.oldType, quantity: args.oldQty }, -1);
    this._accumulate({ ref: args.ref, type: args.newType, quantity: args.newQty }, +1);
  }

  getTotals(ref: string): StockTotals {
    return (
      this.index.get(this._key(ref)) ?? {
        entrees: 0,
        sorties: 0,
        commandes: 0,
        lastUpdated: 0,
      }
    );
  }

  calculateCurrentStock(ref: string, overrideInitial?: number, options?: { allowNegative?: boolean }): number {
    const physicalStock = this.calculatePhysicalStock(ref, overrideInitial);
    if (options?.allowNegative) {
      return physicalStock;
    }
    return Math.max(0, physicalStock); // Clamped display value
  }

  /**
   * Calculates the exact un-clamped physical stock (preserves negative values for discrepancy tracking)
   */
  calculatePhysicalStock(ref: string, overrideInitial?: number): number {
    const key = this._key(ref);
    const init = overrideInitial ?? this.initialStocks.get(key) ?? 0;
    const { entrees, sorties } = this.getTotals(ref);
    return init + entrees - sorties;
  }

  /**
   * Flags whether there is an inventory discrepancy where sorties exceed physical stock
   */
  hasNegativeDiscrepancy(ref: string, overrideInitial?: number): boolean {
    return this.calculatePhysicalStock(ref, overrideInitial) < 0;
  }

  /**
   * Returns comprehensive stock integrity metrics for industrial auditing
   */
  getStockIntegrity(ref: string, overrideInitial?: number): {
    physicalStock: number;
    availableStock: number;
    hasDiscrepancy: boolean;
    hasNegativeDiscrepancy: boolean;
    entrees: number;
    sorties: number;
    commandes: number;
  } {
    const totals = this.getTotals(ref);
    const physicalStock = this.calculatePhysicalStock(ref, overrideInitial);
    return {
      physicalStock,
      availableStock: Math.max(0, physicalStock),
      hasDiscrepancy: physicalStock < 0,
      hasNegativeDiscrepancy: physicalStock < 0,
      entrees: totals.entrees,
      sorties: totals.sorties,
      commandes: totals.commandes,
    };
  }

  private _key(ref: string): string {
    return String(ref ?? '')
      .trim()
      .toUpperCase();
  }

  private _accumulate(m: MovementDelta, sign: 1 | -1): void {
    const rawRef = m.ref ?? m.itemId ?? m.Ref ?? '';
    const key = this._key(rawRef);
    if (!key) return;
    const qty = Number(m.quantity ?? m.quantite ?? 0);
    if (!Number.isFinite(qty) || qty === 0) return;

    const type = normalizeType(m.type);
    if (!type) {
      console.warn(`[StockIndex] Unknown type "${m.type}" for ref ${key} — SKIPPED`);
      return;
    }

    let entry = this.index.get(key);
    if (!entry) {
      entry = { entrees: 0, sorties: 0, commandes: 0, lastUpdated: 0 };
      this.index.set(key, entry);
    }

    const delta = sign * qty;
    if (type === 'ENTREE') entry.entrees += delta;
    else if (type === 'SORTIE') entry.sorties += delta;
    else entry.commandes += delta;
    entry.lastUpdated = Date.now();

    // Do NOT clamp raw running totals. Signal inconsistencies if negative.
    if (entry.entrees < 0 || entry.sorties < 0) {
      console.warn('[StockIndex] Negative running total (data inconsistency):', key, entry);
    }
  }
}

export const stockIndex = new IncrementalStockIndex();
export default IncrementalStockIndex;
