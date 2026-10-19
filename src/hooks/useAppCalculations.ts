import { useMemo, useCallback, useSyncExternalStore } from 'react';
import { safeNum } from '../utils/formulaEngine';
import { stockIndexStore } from '../application/StockIndexStore';
import { reactiveCalculationEngine } from '../services/reactiveCalculationEngine';

let _lastSyncedMouvements = null;

/**
 * Lightweight Reselect-style selector memoizer (O(1) reference equality check on inputs).
 * Prevents redundant array scans when input references have not changed.
 */
export function createMemoizedSelector(inputSelectors, resultFunc) {
  let lastInputs = null;
  let lastResult = null;

  return function memoizedSelector(state) {
    const nextInputs = inputSelectors.map((sel) => sel(state));
    if (
      lastInputs !== null &&
      nextInputs.length === lastInputs.length &&
      nextInputs.every((val, i) => val === lastInputs[i])
    ) {
      return lastResult;
    }
    lastInputs = nextInputs;
    lastResult = resultFunc(...nextInputs);
    return lastResult;
  };
}

/**
 * Synchronizes movement deltas into the O(1) IncrementalStockIndex with reference deduplication.
 */
export function syncMovementsToIndex(mouvements = []) {
  if (!Array.isArray(mouvements)) return;
  if (_lastSyncedMouvements === mouvements && stockIndexStore.isHydrated()) {
    return;
  }
  const deltas = new Array(mouvements.length);
  for (let i = 0; i < mouvements.length; i++) {
    const m = mouvements[i];
    if (!m) {
      deltas[i] = { ref: '', type: '', quantity: 0 };
      continue;
    }
    deltas[i] = {
      ref: m.ref || m['Référence'] || m['Reference'] || '',
      type: m.type || m['Type (Entrée/Sortie)'] || '',
      quantity: safeNum(m.quantite != null ? m.quantite : m['Quantité'], 0),
    };
  }
  stockIndexStore.index.rebuild(deltas);
  stockIndexStore.markHydrated(true);
  _lastSyncedMouvements = mouvements;
}

/**
 * Pure helper to calculate stock items from rawStock and mouvements.
 */
export function calculateStockItems(rawStock = [], mouvements = []) {
  if (!Array.isArray(rawStock) || rawStock.length === 0) return [];
  return reactiveCalculationEngine.recalculateStockReactive(rawStock, mouvements);
}

const EMPTY_ARRAY = Object.freeze([]);
const _derivedDesignationsCache = new WeakMap();

/**
 * Pure helper to calculate effective designations (decoupled from dynamic movements).
 * Uses WeakMap caching on rawStock when designations is empty to guarantee strict reference equality.
 */
export function calculateEffectiveDesignations(designations = EMPTY_ARRAY, rawStock = EMPTY_ARRAY) {
  if (
    Array.isArray(designations) &&
    designations.length > 0 &&
    designations.some((d) => (d.ref || d.id_designation) && (d.designation || d.libelle))
  ) {
    return designations;
  }
  if (Array.isArray(rawStock) && rawStock.length > 0) {
    if (_derivedDesignationsCache.has(rawStock)) {
      return _derivedDesignationsCache.get(rawStock);
    }
    const derived = rawStock.map((s, idx) => ({
      id: s.id ?? idx + 1,
      ref: String(s.ref || s.Ref || `ART-${idx + 1}`).trim(),
      designation: s.designation || s.Designation || '',
      id_type: s.id_type || s.type || 'Standard',
      type: s.type || s.id_type || 'Standard',
      stockInitial: safeNum(s.stockInitial, 0),
      seuil: safeNum(s.seuil, 3),
      emplacement: s.emplacement || 'A1-R1',
    }));
    _derivedDesignationsCache.set(rawStock, derived);
    return derived;
  }
  return Array.isArray(designations) ? designations : EMPTY_ARRAY;
}

/**
 * Pure helper to compute warehouse items with O(1) indexed movement lookups.
 */
export function calculateWarehouseItems(warehouseItems = []) {
  if (!Array.isArray(warehouseItems) || warehouseItems.length === 0) return [];
  return warehouseItems.map((item) => {
    const itemKey = String(item.id_warehouse_item || item.ref || '').trim();
    const initial = safeNum(item.stockInitial, 1);
    const totals = stockIndexStore.index.getTotals(itemKey);
    const stockActuel = initial + totals.entrees - totals.sorties;

    const seuil = safeNum(item.seuil, 0);
    let alerte = 'OK';
    if (stockActuel <= 0) alerte = 'RUPTURE';
    else if (stockActuel <= seuil && seuil > 0) alerte = 'ALERTE';

    return {
      ...item,
      stockInitial: initial,
      entrees: totals.entrees,
      sorties: totals.sorties,
      commandes: totals.commandes,
      stockActuel,
      seuil,
      alerte,
    };
  });
}

/**
 * Memoized Redux/Zustand-compatible selectors
 */
export const selectStockItems = createMemoizedSelector(
  [(state) => state.rawStock || state.stock, (state) => state.mouvements],
  (rawStock, mouvements) => {
    syncMovementsToIndex(mouvements);
    return calculateStockItems(rawStock, mouvements);
  }
);

export const selectEffectiveDesignations = createMemoizedSelector(
  [(state) => state.designations, (state) => state.rawStock || state.stock],
  (designations, rawStock) => calculateEffectiveDesignations(designations, rawStock)
);

/**
 * High-Performance Hook to compute real-time stock calculations, warehouse stock, KPIs, and fallback lists.
 * - Utilizes stockIndexStore for O(1) indexed lookups and eliminates linear array scans over movement history.
 * - Synchronizes movement index during render memoization to eliminate double-render passes and stale same-length mutations.
 * - Decouples static designation metadata from dynamic movement updates.
 * - Strictly respects SSOT: never substitutes short or empty user arrays with legacy seedData.js!
 */
export function useAppCalculations({
  rawStock = EMPTY_ARRAY,
  mouvements = EMPTY_ARRAY,
  designations = EMPTY_ARRAY,
  families = EMPTY_ARRAY,
  templates = EMPTY_ARRAY,
  warehouseItems = EMPTY_ARRAY,
} = {}) {
  // Subscribe to external incremental index updates (e.g. from MovementRepository delta events)
  const globalVersion = useSyncExternalStore(
    stockIndexStore.subscribeAll,
    stockIndexStore.getGlobalVersion,
    () => 0
  );

  // Stable callback helpers
  const calculateStock = useCallback((stock, mvts) => {
    syncMovementsToIndex(mvts);
    return calculateStockItems(stock, mvts);
  }, []);

  const calculateDesignations = useCallback((desigs, stock) => {
    return calculateEffectiveDesignations(desigs, stock);
  }, []);

  const calculateWarehouse = useCallback((items) => {
    return calculateWarehouseItems(items);
  }, []);

  // 1. Compute Full Stock with O(1) Indexed Lookups & Reference Memoization
  const stockItems = useMemo(() => {
    syncMovementsToIndex(mouvements);
    return calculateStockItems(rawStock, mouvements);
  }, [rawStock, mouvements, globalVersion]);

  // 2. Compute Effective Designations (strictly decoupled from mouvements to prevent unnecessary re-renders)
  const effectiveDesignations = useMemo(() => {
    return calculateEffectiveDesignations(designations, rawStock);
  }, [designations, rawStock]);

  // 3. Compute Effective Machine Families
  const effectiveFamilies = useMemo(() => {
    return Array.isArray(families) ? families : EMPTY_ARRAY;
  }, [families]);

  // 4. Compute Effective Machine Templates
  const effectiveTemplates = useMemo(() => {
    return Array.isArray(templates) ? templates : EMPTY_ARRAY;
  }, [templates]);

  const diagnostics = effectiveDesignations;

  // 5. Compute Warehouse Items with O(1) Indexed Totals
  const warehouseItemsComputed = useMemo(() => {
    void globalVersion;
    syncMovementsToIndex(mouvements);
    return calculateWarehouseItems(warehouseItems);
  }, [warehouseItems, mouvements, globalVersion]);

  // 6. Compute Stock KPIs (WeakMap-cached on stockItems reference)
  const stockKPIs = useMemo(() => {
    return reactiveCalculationEngine.computeStockKPIs(stockItems);
  }, [stockItems]);

  return {
    stockItems,
    effectiveDesignations,
    effectiveFamilies,
    effectiveTemplates,
    diagnostics,
    warehouseItemsComputed,
    stockKPIs,
    calculateStock,
    calculateDesignations,
    calculateWarehouse,
    reactiveEngine: reactiveCalculationEngine,
  };
}
