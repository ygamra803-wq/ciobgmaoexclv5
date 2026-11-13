import { normalizeType } from '../application/IncrementalStockIndex';

export interface StockViolation {
  ref: string;
  availableBefore: number;
  projectedBalance: number;
  deficit: number;
}

export interface StockInvariantValidationResult {
  valid: boolean;
  violations: StockViolation[];
}

function toFiniteNumber(val: unknown): number {
  const num = Number(val);
  return Number.isFinite(num) ? num : 0;
}

function computeBalanceMap(
  rawStock: unknown[],
  mouvements: unknown[]
): Map<string, number> {
  const balances = new Map<string, number>();

  for (const item of rawStock) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const ref = String(rec.ref ?? rec.Ref ?? '').trim().toUpperCase();
    if (!ref) continue;
    const init = toFiniteNumber(rec.stockInitial ?? rec.stock_initial ?? rec.initialStock);
    balances.set(ref, (balances.get(ref) ?? 0) + init);
  }

  for (const mvt of mouvements) {
    if (!mvt || typeof mvt !== 'object') continue;
    const rec = mvt as Record<string, unknown>;
    const ref = String(rec.ref ?? rec.Ref ?? rec.code_article ?? rec.reference ?? '')
      .trim()
      .toUpperCase();
    if (!ref || !balances.has(ref)) continue;

    const qty = toFiniteNumber(rec.quantite ?? rec.quantity);
    if (qty <= 0) continue;

    const kind = normalizeType(String(rec.type ?? ''));
    if (kind === 'ENTREE') {
      balances.set(ref, (balances.get(ref) ?? 0) + qty);
    } else if (kind === 'SORTIE') {
      balances.set(ref, (balances.get(ref) ?? 0) - qty);
    }
  }

  return balances;
}

/**
 * Validates the canonical stock conservation invariant (`stockInitial + entrees - sorties >= 0`)
 * across all spare part references registered in `nextRawStock`.
 *
 * Only rejects a reference if its projected balance is negative (`< 0`) AND strictly worse
 * than its balance prior to the mutation (`projected < previous`), ensuring concurrent or
 * over-drawn withdrawals are blocked with `409 Conflict` without breaking unrelated edits
 * on legacy data.
 */
export function validateProjectedStockInvariant(params: {
  previousRawStock: unknown[];
  previousMouvements: unknown[];
  nextRawStock: unknown[];
  nextMouvements: unknown[];
  bypassForAdminForce?: boolean;
}): StockInvariantValidationResult {
  if (params.bypassForAdminForce) {
    return { valid: true, violations: [] };
  }

  const prevStockArr = Array.isArray(params.previousRawStock) ? params.previousRawStock : [];
  const prevMvtArr = Array.isArray(params.previousMouvements) ? params.previousMouvements : [];
  const nextStockArr = Array.isArray(params.nextRawStock) ? params.nextRawStock : [];
  const nextMvtArr = Array.isArray(params.nextMouvements) ? params.nextMouvements : [];

  if (nextStockArr.length === 0) {
    return { valid: true, violations: [] };
  }

  const prevBalances = computeBalanceMap(prevStockArr, prevMvtArr);
  const nextBalances = computeBalanceMap(nextStockArr, nextMvtArr);
  const violations: StockViolation[] = [];

  for (const [ref, projected] of nextBalances.entries()) {
    const previous = prevBalances.has(ref) ? prevBalances.get(ref)! : projected;
    if (projected < -1e-6 && projected < previous - 1e-6) {
      violations.push({
        ref,
        availableBefore: Number(previous.toFixed(4)),
        projectedBalance: Number(projected.toFixed(4)),
        deficit: Number(Math.abs(projected).toFixed(4)),
      });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
