export type ReconciliationAlertCode =
  | 'STOCK_SHORTAGE'
  | 'CONCURRENT_CLAIM_OVERFLOW'
  | 'DUPLICATE_BON'
  | 'EXACT_BON_MATCH'
  | 'MISSING_BON_WITH_PDR'
  | 'CANDIDATE_STORE_BON_MATCH';

export interface ReconciliationAlert {
  code: ReconciliationAlertCode;
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  ref?: string;
}

export interface CandidateStoreMovementMatch {
  movementId: string;
  code_bon: string;
  date: string;
  ref: string;
  designation: string;
  quantite: number;
  machine: string;
  technicien: string;
  exactQtyMatch: boolean;
  bonNumberDiffers: boolean;
}

export interface ClaimReconciliationResult {
  alerts: ReconciliationAlert[];
  hasCritical: boolean;
  hasWarning: boolean;
  candidateStoreMovements: CandidateStoreMovementMatch[];
  exactMovementMatch?: any | null;
}

export interface ReconcileFieldClaimParams {
  claimType: 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE';
  claimId: string;
  numBonSaisi?: string | null;
  machineCode?: string | null;
  proposedSpares?: any[];
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortieDemands?: any[];
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
 * V4: Evaluates a technician's field claim (Corrective BT, Preventive Execution, or Sortie Demand)
 * before Admin/Magasin approval to detect stock shortages, duplicate paper bon numbers,
 * missing bon references, concurrent pending claim overflows, and candidate storekeeper movements
 * for interactive BS-Tech × BS-Magasin merge/discrepancy resolution.
 */
export function reconcileFieldClaim({
  claimType,
  claimId,
  numBonSaisi,
  machineCode,
  proposedSpares = [],
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
}: ReconcileFieldClaimParams): ClaimReconciliationResult {
  const alerts: ReconciliationAlert[] = [];
  const candidateStoreMovements: CandidateStoreMovementMatch[] = [];
  let exactMovementMatch: any | null = null;
  const normClaimId = String(claimId ?? '').trim();
  const normBon = normalizeToken(numBonSaisi);
  const normMachine = normalizeToken(machineCode);

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

  // 2. Check DUPLICATE_BON / EXACT_BON_MATCH across movements, corrective BTs, preventive executions, and sortie demands
  if (normBon) {
    const duplicateSources: string[] = [];

    for (const mvt of mouvements || []) {
      const mvtBon = normalizeToken(mvt?.code_bon || mvt?.num_bon_saisi_par_tech);
      if (mvtBon && mvtBon === normBon) {
        exactMovementMatch = mvt;
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

    for (const dem of sortieDemands || []) {
      const demId = String(dem?.id ?? '').trim();
      if (claimType === 'SORTIE' && demId === normClaimId) continue;
      if (dem?.validation_status === 'REJECTED') continue;
      const demBonTech = normalizeToken(dem?.code_bon_tech);
      const demBonMag = normalizeToken(dem?.code_bon_magasin);
      if ((demBonTech && demBonTech === normBon) || (demBonMag && demBonMag === normBon)) {
        duplicateSources.push(`Demande Sortie ${dem?.code_bon_tech || dem?.id}`);
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

  for (const dem of sortieDemands || []) {
    const demId = String(dem?.id ?? '').trim();
    if (claimType === 'SORTIE' && demId === normClaimId) continue;
    if (dem?.validation_status !== 'PENDING_VALIDATION') continue;
    const items = Array.isArray(dem?.items) ? dem.items : [];
    for (const it of items) {
      const parsed = extractSpareRefAndQty(it);
      addOtherPending(parsed.ref, parsed.qty, `Sortie ${dem?.code_bon_tech || dem?.id}`);
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

    // 4. V4 Storekeeper Bon × Technician Bon Discrepancy / Candidate Merge Detection
    for (const mvt of mouvements || []) {
      if (mvt?.merged_demand_id) continue; // Already merged with a demand
      const mvtType = String(mvt?.type || '').toLowerCase();
      if (!mvtType.includes('sort')) continue;
      const mvtRef = normalizeToken(mvt?.ref || mvt?.code_article);
      if (mvtRef !== refKey) continue;

      const mvtMachine = normalizeToken(mvt?.id_machine_registered || mvt?.machine);
      if (normMachine && mvtMachine && mvtMachine !== normMachine) continue;

      const mvtBon = String(mvt?.code_bon || mvt?.id || '').trim();
      const mvtQty = Number(mvt?.quantite || 0);
      const bonNumberDiffers = Boolean(normBon && normalizeToken(mvtBon) !== normBon);

      candidateStoreMovements.push({
        movementId: String(mvt?.id || mvt?.code_bon),
        code_bon: mvtBon,
        date: String(mvt?.date || ''),
        ref: req.ref,
        designation: String(mvt?.designation || req.designation),
        quantite: mvtQty,
        machine: String(mvt?.id_machine_registered || mvt?.machine || ''),
        technicien: String(mvt?.technicien || ''),
        exactQtyMatch: mvtQty === req.qty,
        bonNumberDiffers,
      });
    }
  }

  if (claimType === 'SORTIE' && candidateStoreMovements.length > 0) {
    const firstCand = candidateStoreMovements[0];
    if (firstCand.bonNumberDiffers) {
      alerts.push({
        code: 'CANDIDATE_STORE_BON_MATCH',
        severity: 'warning',
        ref: firstCand.ref,
        title: `Écart N° Bon Terrain (${numBonSaisi || '—'}) × Magasin (${firstCand.code_bon})`,
        detail: `Un mouvement magasin existant (${firstCand.code_bon}, Qté: ${firstCand.quantite}) correspond à la même pièce (${firstCand.ref}). Vous pouvez les fusionner sans double déstockage ou signaler un écart.`,
      });
    }
  }

  return {
    alerts,
    hasCritical: alerts.some((a) => a.severity === 'critical'),
    hasWarning: alerts.length > 0,
    candidateStoreMovements,
    exactMovementMatch,
  };
}

export interface ValidationRadarItem {
  id: string;
  claimType: 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE';
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
  pendingSortieCount: number;
  clarificationCorrectiveCount: number;
  clarificationPreventiveCount: number;
  clarificationSortieCount: number;
  totalPendingCount: number;
  totalClarificationCount: number;
  criticalAlertCount: number;
  warningAlertCount: number;
  items: ValidationRadarItem[];
}

/**
 * V4: Builds the unified Admin Validation Radar summary across Corrective, Preventive & Sortie queues.
 */
export function buildAdminValidationRadar({
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
}: {
  stockItems?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortieDemands?: any[];
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

  const pendingSortie = (sortieDemands || []).filter(
    (dem) => dem?.validation_status === 'PENDING_VALIDATION'
  );
  const clarificationSortieCount = (sortieDemands || []).filter(
    (dem) => dem?.validation_status === 'NEEDS_CLARIFICATION'
  ).length;

  const items: ValidationRadarItem[] = [];

  for (const bt of pendingCorrective) {
    const proposed = Array.isArray(bt?.pieces_proposees) ? bt.pieces_proposees : [];
    const reconciliation = reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: String(bt.id),
      numBonSaisi: bt.num_bon_saisi_par_tech,
      machineCode: bt.code_machine,
      proposedSpares: proposed,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
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
      machineCode: ex.machineCode,
      proposedSpares: proposed,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
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

  for (const dem of pendingSortie) {
    const proposed = Array.isArray(dem?.items) ? dem.items : [];
    const reconciliation = reconcileFieldClaim({
      claimType: 'SORTIE',
      claimId: String(dem.id),
      numBonSaisi: dem.code_bon_tech,
      machineCode: dem.id_machine_registered,
      proposedSpares: proposed,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });

    const firstRef = proposed[0]?.ref ? `${proposed[0].ref} (x${proposed[0].quantite})` : 'Sortie PDR';
    items.push({
      id: String(dem.id),
      claimType: 'SORTIE',
      code: String(dem.code_bon_tech || dem.id),
      machineCode: String(dem.id_machine_registered || dem.id_zone || 'MAGASIN'),
      title: `Demande Sortie ${dem.code_bon_tech} • ${firstRef}`,
      technicianName: String(dem.submitted_by_name || dem.technicien || 'Technicien'),
      submittedAt: String(dem.submitted_at || dem.date || ''),
      numBonSaisi: String(dem.code_bon_tech || ''),
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
    pendingSortieCount: pendingSortie.length,
    clarificationCorrectiveCount,
    clarificationPreventiveCount,
    clarificationSortieCount,
    totalPendingCount: pendingCorrective.length + pendingPreventive.length + pendingSortie.length,
    totalClarificationCount:
      clarificationCorrectiveCount + clarificationPreventiveCount + clarificationSortieCount,
    criticalAlertCount,
    warningAlertCount,
    items,
  };
}

export interface ReservedStockSource {
  claimType: 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE';
  claimId: string;
  code: string;
  machineCode: string;
  technicianName: string;
  qty: number;
  status: string;
}

export interface ReservedStockEntry {
  ref: string;
  reservedQty: number;
  sources: ReservedStockSource[];
}

/**
 * Idea 3: Computes virtual reserved stock per article reference from unapproved Maker-Checker
 * claims (Corrective BTs, Preventive Executions, and Sortie Demands in PENDING_VALIDATION or NEEDS_CLARIFICATION).
 * Purely derived read-model — never mutates stockActuel or IncrementalStockIndex (AGENTS.md Rule #3).
 */
export function computeReservedStockMap({
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
}: {
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortieDemands?: any[];
}): Map<string, ReservedStockEntry> {
  const map = new Map<string, ReservedStockEntry>();

  const addReservation = (
    rawRef: unknown,
    rawQty: unknown,
    source: Omit<ReservedStockSource, 'qty'>
  ) => {
    const key = normalizeToken(rawRef);
    const qty = Number(rawQty ?? 0);
    if (!key || !Number.isFinite(qty) || qty <= 0) return;

    const existing = map.get(key) || {
      ref: String(rawRef).trim(),
      reservedQty: 0,
      sources: [],
    };
    existing.reservedQty += qty;
    existing.sources.push({ ...source, qty });
    map.set(key, existing);
  };

  for (const bt of correctiveInterventions || []) {
    const status = String(bt?.validation_status || '');
    if (status !== 'PENDING_VALIDATION' && status !== 'NEEDS_CLARIFICATION') continue;
    const pieces = Array.isArray(bt?.pieces_proposees) ? bt.pieces_proposees : [];
    for (const p of pieces) {
      const parsed = extractSpareRefAndQty(p);
      addReservation(parsed.ref, parsed.qty, {
        claimType: 'CORRECTIVE',
        claimId: String(bt?.id || ''),
        code: String(bt?.num_bt || bt?.id || 'BT'),
        machineCode: String(bt?.code_machine || ''),
        technicianName: String(bt?.submitted_by_name || bt?.intervenant || 'Technicien'),
        status,
      });
    }
  }

  for (const ex of preventiveExecutions || []) {
    const status = String(ex?.validation_status || '');
    if (status !== 'PENDING_VALIDATION' && status !== 'NEEDS_CLARIFICATION') continue;
    const pieces = Array.isArray(ex?.sparesProposed) ? ex.sparesProposed : [];
    for (const p of pieces) {
      const parsed = extractSpareRefAndQty(p);
      addReservation(parsed.ref, parsed.qty, {
        claimType: 'PREVENTIVE',
        claimId: String(ex?.id || ''),
        code: String(ex?.taskCode || ex?.actionCode || ex?.id || 'PM'),
        machineCode: String(ex?.machineCode || ''),
        technicianName: String(ex?.submitted_by_name || ex?.executorName || 'Technicien'),
        status,
      });
    }
  }

  for (const dem of sortieDemands || []) {
    const status = String(dem?.validation_status || '');
    if (status !== 'PENDING_VALIDATION' && status !== 'NEEDS_CLARIFICATION') continue;
    const items = Array.isArray(dem?.items) ? dem.items : [];
    for (const it of items) {
      const parsed = extractSpareRefAndQty(it);
      addReservation(parsed.ref, parsed.qty, {
        claimType: 'SORTIE',
        claimId: String(dem?.id || ''),
        code: String(dem?.code_bon_tech || dem?.id || 'BS'),
        machineCode: String(dem?.id_machine_registered || dem?.id_zone || ''),
        technicianName: String(dem?.submitted_by_name || dem?.technicien || 'Technicien'),
        status,
      });
    }
  }

  return map;
}

export interface ValidationCenterQueuesResult {
  pendingCorrective: any[];
  clarificationCorrective: any[];
  pendingPreventive: any[];
  clarificationPreventive: any[];
  pendingSortieDemands: any[];
  clarificationSortieDemands: any[];
  totalPending: number;
  totalClarification: number;
  reservedRefsCount: number;
  totalReservedUnits: number;
  reservedStockMap: Map<string, ReservedStockEntry>;
}

/**
 * Pure selector aggregating all pending & clarification Maker-Checker queues
 * for the unified desktop Validation Center (`Centre de validation / À valider`).
 */
export function selectValidationCenterQueues({
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
}: {
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortieDemands?: any[];
}): ValidationCenterQueuesResult {
  const pendingCorrective = (correctiveInterventions || []).filter(
    (bt) =>
      bt?.validation_status === 'PENDING_VALIDATION' ||
      bt?.statut === 'EN_ATTENTE_VALIDATION'
  );
  const clarificationCorrective = (correctiveInterventions || []).filter(
    (bt) => bt?.validation_status === 'NEEDS_CLARIFICATION'
  );

  const pendingPreventive = (preventiveExecutions || []).filter(
    (ex) => ex?.validation_status === 'PENDING_VALIDATION'
  );
  const clarificationPreventive = (preventiveExecutions || []).filter(
    (ex) => ex?.validation_status === 'NEEDS_CLARIFICATION'
  );

  const pendingSortieDemands = (sortieDemands || []).filter(
    (dem) => dem?.validation_status === 'PENDING_VALIDATION'
  );
  const clarificationSortieDemands = (sortieDemands || []).filter(
    (dem) => dem?.validation_status === 'NEEDS_CLARIFICATION'
  );

  const reservedStockMap = computeReservedStockMap({
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  });

  let totalReservedUnits = 0;
  for (const entry of reservedStockMap.values()) {
    totalReservedUnits += entry.reservedQty;
  }

  return {
    pendingCorrective,
    clarificationCorrective,
    pendingPreventive,
    clarificationPreventive,
    pendingSortieDemands,
    clarificationSortieDemands,
    totalPending:
      pendingCorrective.length + pendingPreventive.length + pendingSortieDemands.length,
    totalClarification:
      clarificationCorrective.length +
      clarificationPreventive.length +
      clarificationSortieDemands.length,
    reservedRefsCount: reservedStockMap.size,
    totalReservedUnits,
    reservedStockMap,
  };
}


