import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import type {
  IMouvement,
  IPartDesignation,
  ISortieDemand,
  IStockItem,
  IType,
  PdrGroup,
} from '../../types/domain';
import type { IReplenishmentOrder } from '../../types/replenishment';
import type { SortieExterneItem } from '../../types/store';

export interface StockRefLike {
  ref?: unknown;
  Ref?: unknown;
  stockInitial?: unknown;
}

export interface MovementRefLike {
  ref?: unknown;
  [key: string]: unknown;
}

/**
 * Builds an initial stock lookup map (`ref -> stockInitial`) used to re-prime
 * `movementRepository` during bulk seed or server state synchronization.
 */
export function buildInitialStockMap(rawStock: ReadonlyArray<StockRefLike> = []): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(rawStock)) return map;
  for (const item of rawStock) {
    if (!item) continue;
    const ref = String(item.ref || item.Ref || '').trim();
    if (!ref) continue;
    map.set(ref, Number(item.stockInitial) || 0);
  }
  return map;
}

/**
 * Domain repository owning spare parts catalog (`RAW_STOCK`), PDR groups/types/designations,
 * stock movements, sortie demands, replenishment POs, and external workshop exits.
 */
export const StockRepo = {
  saveStock<T = IStockItem>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.RAW_STOCK, clean);
    return clean;
  },

  saveStockTypes<T = IType>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.STOCK_TYPES, clean);
    return clean;
  },

  savePdrGroups<T = PdrGroup>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PDR_GROUPS, clean);
    return clean;
  },

  loadPdrGroups(): PdrGroup[] {
    const data = storageService.getItem(STORAGE_KEYS.PDR_GROUPS);
    return Array.isArray(data) ? (data as PdrGroup[]) : [];
  },

  saveDesignations<T = IPartDesignation>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.DESIGNATIONS, clean);
    return clean;
  },

  saveMouvements<T extends MovementRefLike = IMouvement>(
    list: ReadonlyArray<T> = [],
    options: { stock?: ReadonlyArray<StockRefLike> | null; strict?: boolean } = {}
  ): T[] {
    const { stock = null, strict = false } = options;
    let clean: T[] = Array.isArray(list) ? [...list] : [];
    if (strict && Array.isArray(stock) && stock.length > 0) {
      const validRefs = new Set(
        stock.map((s) => String(s.ref || '').trim().toUpperCase()).filter(Boolean)
      );
      clean = clean.filter((m) => {
        const ref = String(m.ref || '').trim().toUpperCase();
        return !ref || validRefs.has(ref);
      });
    }
    storageService.setItem(STORAGE_KEYS.MOUVEMENTS, clean);
    return clean;
  },

  saveMovements<T extends MovementRefLike = IMouvement>(
    list: ReadonlyArray<T> = [],
    options: { stock?: ReadonlyArray<StockRefLike> | null; strict?: boolean } = {}
  ): T[] {
    return this.saveMouvements(list, options);
  },

  saveSortieDemands<T = ISortieDemand>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.SORTIE_DEMANDS, clean);
    return clean;
  },

  saveReplenishmentOrders<T = IReplenishmentOrder>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.REPLENISHMENT_ORDERS, clean);
    return clean;
  },

  saveSortiesExterne<T = SortieExterneItem>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.SORTIE_EXTERNE, clean);
    return clean;
  },
};
