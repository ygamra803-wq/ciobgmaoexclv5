import seedStockItems from '../data/stock/seedStockItems.json';

// Build a fast lookup dictionary from initial baseline stock data to ensure original quantities and type-based references are never lost
export const INITIAL_STOCK_LOOKUP = new Map();
export const BASELINE_TYPE_COUNTERS = {};
export const BASELINE_USED_REFS = new Set();

export const BASELINE_STOCK_ITEMS = seedStockItems.map((item) => {
  const dataObj = {
    ...item,
    qty: item.stockInitial ?? 0,
    refPadded: item.ref,
  };

  const refKey = String(item.ref || '').trim().toLowerCase();
  const desigKey = String(item.designation || '').trim().toLowerCase();

  if (refKey) {
    INITIAL_STOCK_LOOKUP.set(refKey, dataObj);
    BASELINE_USED_REFS.add(refKey);
  }
  if (desigKey) {
    INITIAL_STOCK_LOOKUP.set(desigKey, dataObj);
  }

  const typeName = String(item.type || item.id_type || 'Divers').trim().toLowerCase();
  BASELINE_TYPE_COUNTERS[typeName] = (BASELINE_TYPE_COUNTERS[typeName] || 0) + 1;

  return dataObj;
});

/**
 * Helper to resolve baseline stock item by reference or designation
 */
export function getBaselineStockItem(refOrDesig) {
  if (!refOrDesig) return null;
  const key = String(refOrDesig).trim().toLowerCase();
  return INITIAL_STOCK_LOOKUP.get(key) || null;
}

