/**
 * Pure domain calculations for the Storekeeper & Owner Live Cockpit (`StockView` C1)
 * and Dead Stock > 90 days capital immobilization analytics.
 */
import { normalizeType } from '../../application/IncrementalStockIndex';
import type { IMouvement, ISortieDemand, IStockItem } from '../../types/domain';
import type { IReplenishmentOrder } from '../../types/replenishment';

export interface StockCockpitMetrics {
  classeARupturesCount: number;
  classeARuptureRefs: Set<string>;
  deadStock90dCount: number;
  deadStock90dRefs: Set<string>;
  deadStock90dValueMad: number;
  pendingSortieDemandsCount: number;
  activePoCount: number;
}

function isArchivedItem(item: Partial<IStockItem> | Record<string, unknown> | null | undefined): boolean {
  if (!item || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  const statusUpper = String(rec.statut || rec.status || '').trim().toUpperCase();
  return (
    rec.is_active === false ||
    rec.actif === false ||
    rec.archived === true ||
    statusUpper === 'ARCHIVE' ||
    statusUpper === 'ARCHIVEE' ||
    statusUpper === 'ARCHIVED'
  );
}

function parseMovementTimestampMs(m: Partial<IMouvement> | Record<string, unknown>): number | null {
  const raw = (m as Record<string, unknown>)?.timestamp || m?.date;
  if (!raw) return null;
  const parsed = Date.parse(String(raw).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveStockUnitPrice(item: Partial<IStockItem> | Record<string, unknown>): number {
  const rec = item as Record<string, unknown>;
  const val = Number(rec?.prixUnitaire ?? rec?.prix_unitaire ?? rec?.unitPrice ?? rec?.prix ?? 0);
  return Number.isFinite(val) && val > 0 ? val : 0;
}

export function computeStockCockpitMetrics(params: {
  stockItems: IStockItem[];
  mouvements: IMouvement[];
  sortieDemands: ISortieDemand[];
  replenishmentOrders: IReplenishmentOrder[];
  referenceDate?: Date;
  deadStockWindowDays?: number;
}): StockCockpitMetrics {
  const {
    stockItems = [],
    mouvements = [],
    sortieDemands = [],
    replenishmentOrders = [],
    referenceDate = new Date(),
    deadStockWindowDays = 90,
  } = params;

  const refMs = referenceDate.getTime();
  const windowMs = Math.max(1, deadStockWindowDays) * 24 * 60 * 60 * 1000;
  const cutoffMs = refMs - windowMs;

  // 1. Index latest SORTIE timestamp per normalized ref
  const lastSortieMsByRef = new Map<string, number>();
  for (const m of mouvements || []) {
    if (!m) continue;
    const refKey = String(m.ref || (m as Record<string, unknown>).Ref || '').trim().toUpperCase();
    if (!refKey) continue;
    if (normalizeType(String(m.type || '')) !== 'SORTIE') continue;
    const ts = parseMovementTimestampMs(m);
    if (ts === null) continue;
    const prev = lastSortieMsByRef.get(refKey);
    if (prev === undefined || ts > prev) {
      lastSortieMsByRef.set(refKey, ts);
    }
  }

  const classeARuptureRefs = new Set<string>();
  const deadStock90dRefs = new Set<string>();
  let deadStock90dValueMad = 0;

  for (const item of stockItems || []) {
    if (!item || isArchivedItem(item)) continue;
    const refKey = String(item.ref || '').trim().toUpperCase();
    if (!refKey) continue;

    const currentStock = Number(item.stockActuel ?? item.stockInitial ?? 0) || 0;
    const crit = String(item.criticite || 'B').trim().toUpperCase();
    const isRupture =
      String(item.alerte || '').trim().toUpperCase() === 'RUPTURE' || currentStock <= 0;

    if (crit === 'A' && isRupture) {
      classeARuptureRefs.add(refKey);
    }

    if (currentStock > 0) {
      const lastSortieMs = lastSortieMsByRef.get(refKey);
      const isDead = lastSortieMs === undefined || lastSortieMs < cutoffMs;
      if (isDead) {
        deadStock90dRefs.add(refKey);
        const unitPrice = resolveStockUnitPrice(item);
        deadStock90dValueMad += currentStock * unitPrice;
      }
    }
  }

  const pendingSortieDemandsCount = (sortieDemands || []).filter((d) => {
    const st = String(d?.validation_status || '').trim().toUpperCase();
    return st === 'PENDING_VALIDATION' || st === 'NEEDS_CLARIFICATION';
  }).length;

  const activePoCount = (replenishmentOrders || []).filter((o) => {
    const st = String(o?.statut || '').trim().toUpperCase();
    return st === 'BROUILLON' || st === 'COMMANDE' || st === 'RECEPTION_PARTIELLE';
  }).length;

  return {
    classeARupturesCount: classeARuptureRefs.size,
    classeARuptureRefs,
    deadStock90dCount: deadStock90dRefs.size,
    deadStock90dRefs,
    deadStock90dValueMad: Number(deadStock90dValueMad.toFixed(2)),
    pendingSortieDemandsCount,
    activePoCount,
  };
}
