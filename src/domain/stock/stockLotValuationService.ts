import type { IMouvement, IStockItem } from '../../types/domain';

export type LotExpiryStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY';

export interface StockBinAllocation {
  binCode: string;
  zone: string;
  quantite: number;
  isPrimary: boolean;
}

export interface StockLotRecord {
  lotNumber: string;
  ref: string;
  binCode: string;
  receptionDate: string;
  expiryDate: string | null;
  initialQty: number;
  remainingQty: number;
  unitPrice: number;
  fournisseur?: string;
  expiryStatus: LotExpiryStatus;
  daysUntilExpiry: number | null;
}

export interface CumpValuationResult {
  ref: string;
  stockActuel: number;
  initialPrice: number;
  cump: number;
  lastPurchasePrice: number;
  totalValuationValue: number;
  historySteps: Array<{
    date: string;
    codeBon: string;
    qtyIn: number;
    unitPriceIn: number;
    stockBefore: number;
    cumpBefore: number;
    cumpAfter: number;
  }>;
}

export interface LotPickAllocationLine {
  lotNumber: string;
  binCode: string;
  pickedQty: number;
  unitPrice: number;
  lineCost: number;
  receptionDate: string;
  expiryDate: string | null;
  expiryStatus: LotExpiryStatus;
}

export interface LotPickingPlanResult {
  ref: string;
  strategy: 'FEFO' | 'FIFO';
  requestedQty: number;
  allocatedQty: number;
  shortageQty: number;
  excludedExpiredQty: number;
  weightedPickUnitCost: number;
  totalPickCost: number;
  picks: LotPickAllocationLine[];
  isFullySatisfied: boolean;
}

const EXPIRY_WARNING_DAYS = 30;

function normalizeRef(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function isEntreeMovement(type: unknown): boolean {
  const norm = String(type ?? '')
    .trim()
    .toLowerCase();
  return norm.startsWith('entr');
}

function isSortieMovement(type: unknown): boolean {
  const norm = String(type ?? '')
    .trim()
    .toLowerCase();
  return norm.startsWith('sortie');
}

/**
 * Evaluates a lot's expiration date against `referenceDate` (YYYY-MM-DD).
 */
export function evaluateLotExpiryStatus(
  expiryDate: string | null | undefined,
  referenceDate: string = new Date().toISOString().slice(0, 10)
): { status: LotExpiryStatus; daysUntilExpiry: number | null } {
  const cleanExp = String(expiryDate ?? '').trim();
  if (!cleanExp) {
    return { status: 'NO_EXPIRY', daysUntilExpiry: null };
  }
  const expMs = Date.parse(cleanExp.slice(0, 10));
  const refMs = Date.parse(referenceDate.slice(0, 10));
  if (Number.isNaN(expMs) || Number.isNaN(refMs)) {
    return { status: 'NO_EXPIRY', daysUntilExpiry: null };
  }
  const diffDays = Math.floor((expMs - refMs) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { status: 'EXPIRED', daysUntilExpiry: diffDays };
  }
  if (diffDays <= EXPIRY_WARNING_DAYS) {
    return { status: 'EXPIRING_SOON', daysUntilExpiry: diffDays };
  }
  return { status: 'VALID', daysUntilExpiry: diffDays };
}

/**
 * Computes the Weighted Average Unit Cost (CUMP — Coût Unitaire Moyen Pondéré) for a stock item
 * across its chronological reception (`Entrée`) and consumption (`Sortie`) history.
 *
 * Formula on each `Entrée`:
 *   CUMP_after = (Stock_before * CUMP_before + Qty_in * Price_in) / (Stock_before + Qty_in)
 *
 * Strictly read-only: never mutates `stockActuel`.
 */
export function computeDynamicCump(
  item: IStockItem,
  mouvements: IMouvement[] = []
): CumpValuationResult {
  const refKey = normalizeRef(item?.ref);
  const stockInitial = Math.max(0, Number(item?.stockInitial) || 0);
  const initialPrice = Math.max(
    0,
    Number(item?.prixUnitaire ?? item?.prix_unitaire ?? item?.prix ?? 0) || 0
  );

  const itemMovements = (mouvements || [])
    .filter((m) => normalizeRef(m?.ref || m?.code_article) === refKey)
    .slice()
    .sort((a, b) => {
      const dA = String(a?.date || '');
      const dB = String(b?.date || '');
      if (dA !== dB) return dA.localeCompare(dB);
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });

  let runningStock = stockInitial;
  let runningCump = initialPrice;
  let lastPurchasePrice = initialPrice;
  const historySteps: CumpValuationResult['historySteps'] = [];

  for (const mvt of itemMovements) {
    const qty = Math.max(0, Number(mvt?.quantite) || 0);
    if (qty <= 0) continue;

    if (isEntreeMovement(mvt.type)) {
      const rawPrice = Number(mvt?.prix_unitaire ?? mvt?.prixUnitaire ?? 0);
      const unitPriceIn = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : runningCump;
      lastPurchasePrice = unitPriceIn;

      const stockBefore = Math.max(0, runningStock);
      const cumpBefore = runningCump;
      const newStock = stockBefore + qty;
      const cumpAfter =
        newStock > 0
          ? Number(((stockBefore * cumpBefore + qty * unitPriceIn) / newStock).toFixed(4))
          : unitPriceIn;

      runningStock = newStock;
      runningCump = cumpAfter;

      historySteps.push({
        date: String(mvt.date || ''),
        codeBon: String(mvt.code_bon || mvt.id || 'ENTREE'),
        qtyIn: qty,
        unitPriceIn,
        stockBefore,
        cumpBefore: Number(cumpBefore.toFixed(2)),
        cumpAfter: Number(cumpAfter.toFixed(2)),
      });
    } else if (isSortieMovement(mvt.type)) {
      // Sortie reduces physical balance at current CUMP without changing the unit CUMP
      runningStock = Math.max(0, runningStock - qty);
    }
  }

  const displayedStockActuel =
    item?.stockActuel !== undefined && item?.stockActuel !== null
      ? Number(item.stockActuel) || 0
      : runningStock;

  const roundedCump = Number(runningCump.toFixed(2));
  const totalValuationValue = Number((Math.max(0, displayedStockActuel) * roundedCump).toFixed(2));

  return {
    ref: String(item?.ref || ''),
    stockActuel: displayedStockActuel,
    initialPrice,
    cump: roundedCump,
    lastPurchasePrice: Number(lastPurchasePrice.toFixed(2)),
    totalValuationValue,
    historySteps,
  };
}

/**
 * Reconstructs active lots and Multi-Bin distribution for a stock item from explicit
 * `item.lots` metadata and historical `Entrée`/`Sortie` movements.
 */
export function buildItemLotsAndBins(
  item: IStockItem,
  mouvements: IMouvement[] = [],
  referenceDate: string = new Date().toISOString().slice(0, 10)
): {
  lots: StockLotRecord[];
  bins: StockBinAllocation[];
  expiredQty: number;
  expiringSoonQty: number;
} {
  const refKey = normalizeRef(item?.ref);
  const primaryBin = String(item?.emplacement || 'MAG-CENTRAL-A1').trim();
  const basePrice = Math.max(
    0,
    Number(item?.prixUnitaire ?? item?.prix_unitaire ?? item?.prix ?? 0) || 0
  );

  const rawExplicitLots = Array.isArray(item?.lots)
    ? (item.lots as Array<Record<string, unknown>>)
    : [];

  const lots: StockLotRecord[] = [];

  if (rawExplicitLots.length > 0) {
    for (const raw of rawExplicitLots) {
      const remQty = Math.max(0, Number(raw.remainingQty ?? raw.quantite_restante ?? raw.quantite ?? 0));
      const initQty = Math.max(remQty, Number(raw.initialQty ?? raw.quantite_initiale ?? remQty));
      const expiryDate = raw.expiryDate || raw.date_peremption ? String(raw.expiryDate || raw.date_peremption) : null;
      const expEval = evaluateLotExpiryStatus(expiryDate, referenceDate);
      lots.push({
        lotNumber: String(raw.lotNumber || raw.lot_number || `LOT-${refKey}-01`),
        ref: String(item.ref),
        binCode: String(raw.binCode || raw.emplacement || primaryBin),
        receptionDate: String(raw.receptionDate || raw.date_reception || '2026-01-01'),
        expiryDate,
        initialQty: initQty,
        remainingQty: remQty,
        unitPrice: Math.max(0, Number(raw.unitPrice ?? raw.prix_unitaire ?? basePrice) || basePrice),
        fournisseur: raw.fournisseur ? String(raw.fournisseur) : item.fournisseur,
        expiryStatus: expEval.status,
        daysUntilExpiry: expEval.daysUntilExpiry,
      });
    }
  } else {
    // Derive lots from initial stock + Entrée movements, then deduct Sorties in FIFO order
    const stockInitial = Math.max(0, Number(item?.stockInitial) || 0);
    if (stockInitial > 0) {
      const initExpiry = item?.date_peremption ? String(item.date_peremption) : null;
      const expEval = evaluateLotExpiryStatus(initExpiry, referenceDate);
      lots.push({
        lotNumber: `LOT-INIT-${refKey}`,
        ref: String(item.ref),
        binCode: primaryBin,
        receptionDate: '2026-01-01',
        expiryDate: initExpiry,
        initialQty: stockInitial,
        remainingQty: stockInitial,
        unitPrice: basePrice,
        fournisseur: item.fournisseur,
        expiryStatus: expEval.status,
        daysUntilExpiry: expEval.daysUntilExpiry,
      });
    }

    const itemMovements = (mouvements || [])
      .filter((m) => normalizeRef(m?.ref || m?.code_article) === refKey)
      .slice()
      .sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));

    let entreeSeq = 1;
    for (const mvt of itemMovements) {
      const qty = Math.max(0, Number(mvt?.quantite) || 0);
      if (qty <= 0) continue;

      if (isEntreeMovement(mvt.type)) {
        const expiryDate = mvt.date_peremption || mvt.expiry_date
          ? String(mvt.date_peremption || mvt.expiry_date)
          : null;
        const expEval = evaluateLotExpiryStatus(expiryDate, referenceDate);
        const lotNum = String(
          mvt.lot_number || mvt.num_lot || mvt.code_bon || `LOT-${refKey}-${String(entreeSeq).padStart(2, '0')}`
        );
        entreeSeq += 1;
        lots.push({
          lotNumber: lotNum,
          ref: String(item.ref),
          binCode: String(mvt.emplacement_reception || mvt.bin_code || primaryBin),
          receptionDate: String(mvt.date || referenceDate),
          expiryDate,
          initialQty: qty,
          remainingQty: qty,
          unitPrice: Math.max(0, Number(mvt.prix_unitaire ?? basePrice) || basePrice),
          fournisseur: mvt.fournisseur || item.fournisseur,
          expiryStatus: expEval.status,
          daysUntilExpiry: expEval.daysUntilExpiry,
        });
      } else if (isSortieMovement(mvt.type)) {
        let toDeduct = qty;
        for (const lot of lots) {
          if (toDeduct <= 0) break;
          if (lot.remainingQty <= 0) continue;
          const deducted = Math.min(lot.remainingQty, toDeduct);
          lot.remainingQty -= deducted;
          toDeduct -= deducted;
        }
      }
    }
  }

  // Aggregate Multi-Bin distribution from active lots + explicit secondary bins
  const binMap = new Map<string, StockBinAllocation>();
  for (const lot of lots) {
    if (lot.remainingQty <= 0) continue;
    const key = lot.binCode.trim().toUpperCase();
    const existing = binMap.get(key) || {
      binCode: lot.binCode.trim(),
      zone: lot.binCode.split('-')[0] || 'MAGASIN',
      quantite: 0,
      isPrimary: lot.binCode.trim().toUpperCase() === primaryBin.toUpperCase(),
    };
    existing.quantite += lot.remainingQty;
    binMap.set(key, existing);
  }

  if (binMap.size === 0) {
    binMap.set(primaryBin.toUpperCase(), {
      binCode: primaryBin,
      zone: primaryBin.split('-')[0] || 'MAGASIN',
      quantite: Math.max(0, Number(item?.stockActuel ?? item?.stockInitial ?? 0) || 0),
      isPrimary: true,
    });
  }

  let expiredQty = 0;
  let expiringSoonQty = 0;
  for (const lot of lots) {
    if (lot.remainingQty <= 0) continue;
    if (lot.expiryStatus === 'EXPIRED') expiredQty += lot.remainingQty;
    else if (lot.expiryStatus === 'EXPIRING_SOON') expiringSoonQty += lot.remainingQty;
  }

  return {
    lots: lots.filter((l) => l.remainingQty > 0 || l.initialQty > 0),
    bins: Array.from(binMap.values()),
    expiredQty,
    expiringSoonQty,
  };
}

/**
 * Computes an automated FIFO (First-In, First-Out) or FEFO (First-Expired, First-Out)
 * multi-bin picking plan for a requested `Sortie` quantity.
 * Automatically quarantines and skips `EXPIRED` lots.
 */
export function allocateStockSortieFifoFefo(
  lots: StockLotRecord[],
  requestedQty: number,
  strategy: 'FEFO' | 'FIFO' = 'FEFO',
  referenceDate: string = new Date().toISOString().slice(0, 10)
): LotPickingPlanResult {
  const safeRequested = Math.max(0, Number(requestedQty) || 0);
  const ref = lots[0]?.ref || '';

  let excludedExpiredQty = 0;
  const eligibleLots: StockLotRecord[] = [];

  for (const lot of lots || []) {
    if (lot.remainingQty <= 0) continue;
    const evalExp = evaluateLotExpiryStatus(lot.expiryDate, referenceDate);
    if (evalExp.status === 'EXPIRED') {
      excludedExpiredQty += lot.remainingQty;
      continue;
    }
    eligibleLots.push({
      ...lot,
      expiryStatus: evalExp.status,
      daysUntilExpiry: evalExp.daysUntilExpiry,
    });
  }

  eligibleLots.sort((a, b) => {
    if (strategy === 'FEFO') {
      // Lots with an expiry date come before lots without expiry, ordered earliest expiry first
      const aHasExp = Boolean(a.expiryDate);
      const bHasExp = Boolean(b.expiryDate);
      if (aHasExp && bHasExp && a.expiryDate !== b.expiryDate) {
        return String(a.expiryDate).localeCompare(String(b.expiryDate));
      }
      if (aHasExp !== bHasExp) {
        return aHasExp ? -1 : 1;
      }
    }
    // Fallback / FIFO tie-breaker: oldest reception date first
    if (a.receptionDate !== b.receptionDate) {
      return String(a.receptionDate).localeCompare(String(b.receptionDate));
    }
    return a.lotNumber.localeCompare(b.lotNumber);
  });

  const picks: LotPickAllocationLine[] = [];
  let remainingToPick = safeRequested;
  let totalPickCost = 0;

  for (const lot of eligibleLots) {
    if (remainingToPick <= 0) break;
    const pickedQty = Math.min(lot.remainingQty, remainingToPick);
    const lineCost = Number((pickedQty * lot.unitPrice).toFixed(2));
    picks.push({
      lotNumber: lot.lotNumber,
      binCode: lot.binCode,
      pickedQty,
      unitPrice: lot.unitPrice,
      lineCost,
      receptionDate: lot.receptionDate,
      expiryDate: lot.expiryDate,
      expiryStatus: lot.expiryStatus,
    });
    remainingToPick -= pickedQty;
    totalPickCost = Number((totalPickCost + lineCost).toFixed(2));
  }

  const allocatedQty = safeRequested - remainingToPick;
  const weightedPickUnitCost =
    allocatedQty > 0 ? Number((totalPickCost / allocatedQty).toFixed(2)) : 0;

  return {
    ref,
    strategy,
    requestedQty: safeRequested,
    allocatedQty,
    shortageQty: Math.max(0, remainingToPick),
    excludedExpiredQty,
    weightedPickUnitCost,
    totalPickCost,
    picks,
    isFullySatisfied: remainingToPick === 0,
  };
}
