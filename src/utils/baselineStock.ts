/**
 * Legacy baseline stock lookup stub.
 * Direct static seed imports are disabled per AGENTS.md §1.2 (Zero Silent Seed Reinjection).
 * All stock items and initial quantities must originate from canonical SSOT storage (`STORAGE_KEYS.RAW_STOCK`).
 */
export const INITIAL_STOCK_LOOKUP = new Map<string, any>();
export const BASELINE_TYPE_COUNTERS: Record<string, number> = {};
export const BASELINE_USED_REFS = new Set<string>();
export const BASELINE_STOCK_ITEMS: any[] = [];

export function getBaselineStockItem(_refOrDesig: unknown) {
  return null;
}
