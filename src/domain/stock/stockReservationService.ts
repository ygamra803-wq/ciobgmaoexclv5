import {
  computeReservedStockMap,
  type ReconciliationCorrectiveBt,
  type ReconciliationPreventiveExec,
  type ReconciliationPreventiveTask,
  type ReconciliationSortieDemand,
  type ReconciliationStockItem,
  type ReservedStockSource,
  type SpareClaimLine,
} from '../../core/security/validationReconciliation';

export type ReservationConflictCode =
  | 'NONE'
  | 'DOUBLE_MACHINE_RESERVATION_CONFLICT'
  | 'INSUFFICIENT_PHYSICAL_STOCK'
  | 'INSUFFICIENT_AVAILABLE_STOCK'
  | 'UNKNOWN_STOCK_REF';

export interface SpareReservationEvaluation {
  ref: string;
  designation: string;
  unit: string;
  requestedQty: number;
  stockPhysique: number;
  reservedQtyTotal: number;
  reservedByOtherClaimsQty: number;
  reservedByOtherMachinesQty: number;
  stockDisponible: number;
  remainingAfterAllocation: number;
  canAllocate: boolean;
  conflictCode: ReservationConflictCode;
  conflictMessageFr: string;
  competingSources: ReservedStockSource[];
}

export interface EvaluateSpareAllocationParams {
  ref: string;
  requestedQty: number;
  machineCode?: string;
  excludeClaimId?: string;
  stockItems?: ReconciliationStockItem[];
  correctiveInterventions?: ReconciliationCorrectiveBt[];
  preventiveExecutions?: ReconciliationPreventiveExec[];
  sortieDemands?: ReconciliationSortieDemand[];
  preventiveTasks?: ReconciliationPreventiveTask[];
}

function normalizeKey(val: unknown): string {
  return String(val ?? '')
    .trim()
    .toUpperCase();
}

function resolvePhysicalStock(item: ReconciliationStockItem | undefined): number {
  if (!item) return 0;
  if (item.stockActuel !== undefined && item.stockActuel !== null && item.stockActuel !== '') {
    return Number(item.stockActuel) || 0;
  }
  if (item.stock_actuel !== undefined && item.stock_actuel !== null && item.stock_actuel !== '') {
    return Number(item.stock_actuel) || 0;
  }
  return (
    (Number(item.stockInitial) || 0) +
    (Number(item.entrees) || 0) -
    (Number(item.sorties) || 0)
  );
}

/**
 * Evaluates whether a spare part (`ref`) can be pre-reserved for a Work Order (`BT`) or
 * Preventive Maintenance Plan without colliding with another machine's active reservation.
 *
 * Strictly preserves `AGENTS.md` Rule #3: `stockPhysique` (`stockActuel`) is never mutated;
 * `stockDisponible = Math.max(0, stockPhysique - reservedByOtherClaimsQty)`.
 */
export function evaluateSpareAllocation({
  ref,
  requestedQty,
  machineCode = '',
  excludeClaimId = '',
  stockItems = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
  preventiveTasks = [],
}: EvaluateSpareAllocationParams): SpareReservationEvaluation {
  const cleanRef = normalizeKey(ref);
  const safeRequested = Math.max(0, Number(requestedQty) || 0);
  const cleanMachine = normalizeKey(machineCode);
  const cleanExcludeId = String(excludeClaimId ?? '').trim();

  const matchedItem = (stockItems || []).find(
    (s) => normalizeKey(s.ref || s.reference || s.code_article) === cleanRef
  );

  if (!matchedItem) {
    return {
      ref: String(ref || '').trim(),
      designation: String(ref || 'Article inconnu'),
      unit: 'pcs',
      requestedQty: safeRequested,
      stockPhysique: 0,
      reservedQtyTotal: 0,
      reservedByOtherClaimsQty: 0,
      reservedByOtherMachinesQty: 0,
      stockDisponible: 0,
      remainingAfterAllocation: -safeRequested,
      canAllocate: false,
      conflictCode: 'UNKNOWN_STOCK_REF',
      conflictMessageFr: `Référence "${ref}" introuvable dans le catalogue PDR.`,
      competingSources: [],
    };
  }

  const stockPhysique = resolvePhysicalStock(matchedItem);
  const designation = String(matchedItem.designation || matchedItem.nom || cleanRef).trim();
  const unit = String(matchedItem.unit || matchedItem.unite || 'pcs').trim();

  const reservedMap = computeReservedStockMap({
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
    preventiveTasks,
  });

  const entry = reservedMap.get(cleanRef);
  const allSources = entry?.sources || [];

  const competingSources = allSources.filter(
    (src) => !cleanExcludeId || String(src.claimId).trim() !== cleanExcludeId
  );

  const reservedByOtherClaimsQty = competingSources.reduce((acc, s) => acc + (Number(s.qty) || 0), 0);
  const otherMachineSources = competingSources.filter(
    (src) => cleanMachine && normalizeKey(src.machineCode) !== cleanMachine
  );
  const reservedByOtherMachinesQty = otherMachineSources.reduce(
    (acc, s) => acc + (Number(s.qty) || 0),
    0
  );

  const stockDisponible = Math.max(0, stockPhysique - reservedByOtherClaimsQty);
  const remainingAfterAllocation = stockDisponible - safeRequested;
  const canAllocate = safeRequested <= stockDisponible;

  let conflictCode: ReservationConflictCode = 'NONE';
  let conflictMessageFr = `Disponible net suffisant (${stockDisponible} ${unit} disponibles sur ${stockPhysique} ${unit} physiques).`;

  if (!canAllocate) {
    if (stockPhysique < safeRequested) {
      conflictCode = 'INSUFFICIENT_PHYSICAL_STOCK';
      conflictMessageFr = `Stock physique insuffisant pour ${cleanRef} : demandé ${safeRequested} ${unit}, stock physique ${stockPhysique} ${unit}.`;
    } else if (otherMachineSources.length > 0) {
      conflictCode = 'DOUBLE_MACHINE_RESERVATION_CONFLICT';
      const holders = otherMachineSources
        .map((s) => `${s.code} (${s.machineCode || 'Autre machine'}: ${s.qty} ${unit})`)
        .join(', ');
      conflictMessageFr = `Conflit de réservation inter-machines sur ${cleanRef} : Stock physique = ${stockPhysique} ${unit}, mais ${reservedByOtherClaimsQty} ${unit} sont déjà réservées par [${holders}]. Disponible net = ${stockDisponible} ${unit} (demandé: ${safeRequested} ${unit}).`;
    } else {
      conflictCode = 'INSUFFICIENT_AVAILABLE_STOCK';
      const holders = competingSources.map((s) => `${s.code} (${s.qty} ${unit})`).join(', ');
      conflictMessageFr = `Stock disponible insuffisant après réservations sur ${cleanRef} : ${reservedByOtherClaimsQty} ${unit} réservées par [${holders}]. Disponible net = ${stockDisponible} ${unit}.`;
    }
  }

  return {
    ref: String(matchedItem.ref || cleanRef),
    designation,
    unit,
    requestedQty: safeRequested,
    stockPhysique,
    reservedQtyTotal: entry?.reservedQty || 0,
    reservedByOtherClaimsQty,
    reservedByOtherMachinesQty,
    stockDisponible,
    remainingAfterAllocation,
    canAllocate,
    conflictCode,
    conflictMessageFr,
    competingSources,
  };
}

/**
 * Evaluates a batch of spare parts to be pre-reserved on a BT or Preventive Plan.
 */
export function evaluateBatchSpareAllocation(
  lines: SpareClaimLine[],
  context: Omit<EvaluateSpareAllocationParams, 'ref' | 'requestedQty'>
): {
  canAllocateAll: boolean;
  evaluations: SpareReservationEvaluation[];
  conflicts: SpareReservationEvaluation[];
} {
  // Aggregate duplicate refs within the same batch request
  const aggregated = new Map<string, number>();
  for (const line of lines || []) {
    const ref = String(line?.ref || line?.reference || line?.code_article || line?.code || '').trim();
    const qty = Number(line?.qty ?? line?.quantite ?? 0);
    if (!ref || !Number.isFinite(qty) || qty <= 0) continue;
    const key = normalizeKey(ref);
    aggregated.set(key, (aggregated.get(key) || 0) + qty);
  }

  const evaluations: SpareReservationEvaluation[] = [];
  for (const [ref, requestedQty] of aggregated.entries()) {
    evaluations.push(
      evaluateSpareAllocation({
        ...context,
        ref,
        requestedQty,
      })
    );
  }

  const conflicts = evaluations.filter((ev) => !ev.canAllocate);
  return {
    canAllocateAll: conflicts.length === 0,
    evaluations,
    conflicts,
  };
}
