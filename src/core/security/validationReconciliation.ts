export type ReconciliationAlertCode =
  | 'STOCK_SHORTAGE'
  | 'CONCURRENT_CLAIM_OVERFLOW'
  | 'DUPLICATE_BON'
  | 'MISSING_BON_WITH_PDR';

export interface ReconciliationAlert {
  code: ReconciliationAlertCode;
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  ref?: string;
}

export interface ClaimReconciliationResult {
  alerts: ReconciliationAlert[];
  hasCritical: boolean;
  hasWarning: boolean;
}

export interface ReconcileFieldClaimParams {
  claimType: 'CORRECTIVE' | 'PREVENTIVE';
  claimId: string;
  numBonSaisi?: string | null;
  proposedSpares?: any[];
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function extractSpareRefAndQty(raw: any): { ref: string; designation: string; qty: number } {
  const ref = String(raw?.ref || raw?.reference || raw?.code_article || raw?.code || '').trim();
  const designation = String(raw?.designation || ref || 'PDR').trim();
  const qty = Number(raw?.qty ?? raw?.quantite ?? 0);
  return {
    ref,
    designation,
    qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
  };
}

/**
 * V4: Evaluates a technician's field claim (Corrective BT or Preventive Execution)
 * before Admin approval to detect stock shortages, duplicate paper bon numbers,
 * missing bon references, and concurrent pending claim overflows.
 */
export function reconcileFieldClaim({
  claimType,
  claimId,
  numBonSaisi,
  proposedSpares = [],
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
}: ReconcileFieldClaimParams): ClaimReconciliationResult {
  const alerts: ReconciliationAlert[] = [];
  const normClaimId = String(claimId ?? '').trim();
  const normBon = normalizeToken(numBonSaisi);

  const normalizedSpares = (Array.isArray(proposedSpares) ? proposedSpares : [])
    .map(extractSpareRefAndQty)
    .filter((s) => Boolean(s.ref && s.qty > 0));

  // 1. Check MISSING_BON_WITH_PDR
  if (normalizedSpares.length > 0 && !normBon) {
    alerts.push({
      code: 'MISSING_BON_WITH_PDR',
      severity: 'warning',
      title: 'N° Bon Magasin manquant',
      detail: 'Sortie PDR proposée sans N° de bon magasin papier renseigné par le technicien.',
    });
  }

  // 2. Check DUPLICATE_BON across movements, corrective BTs, and preventive executions
  if (normBon) {
    const duplicateSources: string[] = [];

    for (const mvt of mouvements || []) {
      const mvtBon = normalizeToken(mvt?.code_bon || mvt?.num_bon_saisi_par_tech);
      if (mvtBon && mvtBon === normBon) {
        duplicateSources.push(`Mouvement ${mvt?.code_bon || mvt?.id || normBon}`);
        break;
      }
    }

    for (const bt of correctiveInterventions || []) {
      const btId = String(bt?.id ?? '').trim();
      if (claimType === 'CORRECTIVE' && btId === normClaimId) continue;
      if (bt?.validation_status === 'REJECTED') continue;
      const btBon = normalizeToken(bt?.num_bon_saisi_par_tech || bt?.num_bon);
      if (btBon && btBon === normBon) {
        duplicateSources.push(`BT ${bt?.num_bt || bt?.id}`);
        break;
      }
    }

    for (const ex of preventiveExecutions || []) {
      const exId = String(ex?.id ?? '').trim();
      if (claimType === 'PREVENTIVE' && exId === normClaimId) continue;
      if (ex?.validation_status === 'REJECTED') continue;
      const exBon = normalizeToken(ex?.num_bon_saisi_par_tech);
      if (exBon && exBon === normBon) {
        duplicateSources.push(`Exéc. Préventive ${ex?.taskCode || ex?.id}`);
        break;
      }
    }

    if (duplicateSources.length > 0) {
      alerts.push({
        code: 'DUPLICATE_BON',
        severity: 'critical',
        title: `Doublon N° Bon (${numBonSaisi})`,
        detail: `Le N° de bon « ${numBonSaisi} » est déjà utilisé sur : ${duplicateSources.join(', ')}.`,
      });
    }
  }

  // 3. Build lookup for Stock Actuel & concurrent PENDING_VALIDATION claims
  const stockByRef = new Map<string, any>();
  for (const item of stockItems || []) {
    const refKey = normalizeToken(item?.ref || item?.code_article);
    if (refKey) stockByRef.set(refKey, item);
  }

  const otherPendingQtyByRef = new Map<string, { qty: number; sources: string[] }>();
  const addOtherPending = (ref: string, qty: number, label: string) => {
    const key = normalizeToken(ref);
    if (!key || qty <= 0) return;
    const prev = otherPendingQtyByRef.get(key) || { qty: 0, sources: [] };
    prev.qty += qty;
    if (!prev.sources.includes(label)) prev.sources.push(label);
    otherPendingQtyByRef.set(key, prev);
  };

  for (const bt of correctiveInterventions || []) {
    const btId = String(bt?.id ?? '').trim();
    if (claimType === 'CORRECTIVE' && btId === normClaimId) continue;
    if (bt?.validation_status !== 'PENDING_VALIDATION') continue;
    const pieces = Array.isArray(bt?.pieces_proposees) ? bt.pieces_proposees : [];
    for (const p of pieces) {
      const parsed = extractSpareRefAndQty(p);
      addOtherPending(parsed.ref, parsed.qty, `BT ${bt?.num_bt || bt?.id}`);
    }
  }

  for (const ex of preventiveExecutions || []) {
    const exId = String(ex?.id ?? '').trim();
    if (claimType === 'PREVENTIVE' && exId === normClaimId) continue;
    if (ex?.validation_status !== 'PENDING_VALIDATION') continue;
    const pieces = Array.isArray(ex?.sparesProposed) ? ex.sparesProposed : [];
    for (const p of pieces) {
      const parsed = extractSpareRefAndQty(p);
      addOtherPending(parsed.ref, parsed.qty, `Prév. ${ex?.machineCode || ex?.id}`);
    }
  }

  // Aggregate requested qty by ref within this claim itself
  const requestedByRef = new Map<string, { ref: string; designation: string; qty: number }>();
  for (const sp of normalizedSpares) {
    const key = normalizeToken(sp.ref);
    const existing = requestedByRef.get(key);
    if (existing) {
      existing.qty += sp.qty;
    } else {
      requestedByRef.set(key, { ...sp });
    }
  }

  for (const [refKey, req] of requestedByRef.entries()) {
    const stockMatch = stockByRef.get(refKey);
    if (!stockMatch) continue;

    const stockActuel = Number(stockMatch?.stockActuel ?? 0);
    const otherPending = otherPendingQtyByRef.get(refKey);
    const otherQty = otherPending?.qty || 0;

    if (req.qty > stockActuel) {
      alerts.push({
        code: 'STOCK_SHORTAGE',
        severity: 'critical',
        ref: req.ref,
        title: `Stock insuffisant (${req.ref})`,
        detail: `Quantité demandée (${req.qty}) supérieure au Stock Actuel (${stockActuel}).`,
      });
    } else if (otherQty > 0 && req.qty + otherQty > stockActuel) {
      alerts.push({
        code: 'CONCURRENT_CLAIM_OVERFLOW',
        severity: 'critical',
        ref: req.ref,
        title: `Conflit de réservation (${req.ref})`,
        detail: `Demandé ${req.qty} + ${otherQty} réservé(s) sur ${otherPending?.sources.join(', ')} (Total ${
          req.qty + otherQty
        } > Stock Actuel ${stockActuel}).`,
      });
    }
  }

  return {
    alerts,
    hasCritical: alerts.some((a) => a.severity === 'critical'),
    hasWarning: alerts.length > 0,
  };
}

export interface ValidationRadarItem {
  id: string;
  claimType: 'CORRECTIVE' | 'PREVENTIVE';
  code: string;
  machineCode: string;
  title: string;
  technicianName: string;
  submittedAt: string;
  numBonSaisi: string;
  sparesCount: number;
  reconciliation: ClaimReconciliationResult;
}

export interface AdminValidationRadarSummary {
  pendingCorrectiveCount: number;
  pendingPreventiveCount: number;
  clarificationCorrectiveCount: number;
  clarificationPreventiveCount: number;
  totalPendingCount: number;
  totalClarificationCount: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  items: ValidationRadarItem[];
}

/**
 * V4: Builds the unified Admin Validation Radar summary across Corrective & Preventive queues.
 */
export function buildAdminValidationRadar({
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
}: {
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
}): AdminValidationRadarSummary {
  const pendingCorrective = (correctiveInterventions || []).filter(
    (bt) => bt?.validation_status === 'PENDING_VALIDATION'
  );
  const clarificationCorrectiveCount = (correctiveInterventions || []).filter(
    (bt) => bt?.validation_status === 'NEEDS_CLARIFICATION'
  ).length;

  const pendingPreventive = (preventiveExecutions || []).filter(
    (ex) => ex?.validation_status === 'PENDING_VALIDATION'
  );
  const clarificationPreventiveCount = (preventiveExecutions || []).filter(
    (ex) => ex?.validation_status === 'NEEDS_CLARIFICATION'
  ).length;

  const items: ValidationRadarItem[] = [];

  for (const bt of pendingCorrective) {
    const proposed = Array.isArray(bt?.pieces_proposees) ? bt.pieces_proposees : [];
    const reconciliation = reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: String(bt.id),
      numBonSaisi: bt.num_bon_saisi_par_tech,
      proposedSpares: proposed,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
    });

    items.push({
      id: String(bt.id),
      claimType: 'CORRECTIVE',
      code: String(bt.num_bt || bt.id),
      machineCode: String(bt.code_machine || 'MACHINE'),
      title: String(bt.action_realisee || bt.anomalie || bt.travail_a_faire || 'Intervention corrective'),
      technicianName: String(bt.submitted_by_name || bt.intervenant || 'Technicien'),
      submittedAt: String(bt.submitted_at || bt.date_demande || ''),
      numBonSaisi: String(bt.num_bon_saisi_par_tech || ''),
      sparesCount: proposed.length,
      reconciliation,
    });
  }

  for (const ex of pendingPreventive) {
    const proposed = Array.isArray(ex?.sparesProposed) ? ex.sparesProposed : [];
    const reconciliation = reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: String(ex.id),
      numBonSaisi: ex.num_bon_saisi_par_tech,
      proposedSpares: proposed,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
    });

    items.push({
      id: String(ex.id),
      claimType: 'PREVENTIVE',
      code: String(ex.actionCode || ex.taskCode || ex.id),
      machineCode: String(ex.machineCode || 'MACHINE'),
      title: String(ex.organe || ex.notes || 'Maintenance préventive'),
      technicianName: String(ex.submitted_by_name || ex.executorName || 'Technicien'),
      submittedAt: String(ex.submitted_at || ex.executedAt || ''),
      numBonSaisi: String(ex.num_bon_saisi_par_tech || ''),
      sparesCount: proposed.length,
      reconciliation,
    });
  }

  // Sort: critical alerts first, then warning alerts, then most recent
  items.sort((a, b) => {
    if (a.reconciliation.hasCritical !== b.reconciliation.hasCritical) {
      return a.reconciliation.hasCritical ? -1 : 1;
    }
    if (a.reconciliation.hasWarning !== b.reconciliation.hasWarning) {
      return a.reconciliation.hasWarning ? -1 : 1;
    }
    return String(b.submittedAt).localeCompare(String(a.submittedAt));
  });

  const criticalAlertCount = items.filter((i) => i.reconciliation.hasCritical).length;
  const warningAlertCount = items.filter((i) => i.reconciliation.hasWarning).length;

  return {
    pendingCorrectiveCount: pendingCorrective.length,
    pendingPreventiveCount: pendingPreventive.length,
    clarificationCorrectiveCount,
    clarificationPreventiveCount,
    totalPendingCount: pendingCorrective.length + pendingPreventive.length,
    totalClarificationCount: clarificationCorrectiveCount + clarificationPreventiveCount,
    criticalAlertCount,
    warningAlertCount,
    items,
  };
}
