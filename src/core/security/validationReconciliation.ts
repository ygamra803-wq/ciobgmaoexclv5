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

export interface SpareClaimLine {
  ref?: string;
  reference?: string;
  code_article?: string;
  code?: string;
  designation?: string;
  qty?: number | string;
  quantite?: number | string;
}

export interface ReconciliationStockItem {
  id?: string | number;
  ref?: string;
  reference?: string;
  code_article?: string;
  designation?: string;
  nom?: string;
  emplacement?: string;
  type?: string;
  id_type?: string;
  unit?: string;
  unite?: string;
  stockActuel?: number | string;
  stock_actuel?: number | string;
  stockInitial?: number | string;
  entrees?: number | string;
  sorties?: number | string;
  seuil?: number | string;
  stock_min?: number | string;
  stockMin?: number | string;
  min?: number | string;
}

export interface ReconciliationMovement {
  id?: string | number;
  code_bon?: string;
  num_bon_saisi_par_tech?: string;
  date?: string;
  type?: string;
  ref?: string;
  code_article?: string;
  designation?: string;
  quantite?: number | string;
  id_machine_registered?: string;
  machine?: string;
  technicien?: string;
  merged_demand_id?: string | null;
}

export interface ReconciliationCorrectiveBt {
  id?: string | number;
  num_bt?: string;
  code_machine?: string;
  statut?: string;
  validation_status?: string;
  validated_at?: string;
  num_bon_saisi_par_tech?: string;
  num_bon?: string;
  action_realisee?: string;
  anomalie?: string;
  travail_a_faire?: string;
  submitted_by_name?: string;
  intervenant?: string;
  submitted_at?: string;
  date_demande?: string;
  pieces_proposees?: SpareClaimLine[];
}

export interface ReconciliationPreventiveExec {
  id?: string | number;
  taskCode?: string;
  actionCode?: string;
  machineCode?: string;
  organe?: string;
  notes?: string;
  validation_status?: string;
  validated_at?: string;
  num_bon_saisi_par_tech?: string;
  submitted_by_name?: string;
  executorName?: string;
  submitted_at?: string;
  executedAt?: string;
  sparesProposed?: SpareClaimLine[];
}

export interface ReconciliationSortieDemand {
  id?: string | number;
  code_bon_tech?: string;
  code_bon_magasin?: string;
  id_machine_registered?: string;
  id_zone?: string;
  technicien?: string;
  validation_status?: string;
  validated_at?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  date?: string;
  items?: SpareClaimLine[];
}

export interface ClaimReconciliationResult {
  alerts: ReconciliationAlert[];
  hasCritical: boolean;
  hasWarning: boolean;
  candidateStoreMovements: CandidateStoreMovementMatch[];
  exactMovementMatch?: ReconciliationMovement | null;
}

export interface ReconcileFieldClaimParams {
  claimType?: 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE';
  claimId?: string;
  recordType?: 'CORRECTIVE_BT' | 'PREVENTIVE_EXEC' | 'SORTIE_DEMAND' | string;
  recordId?: string;
  numBonSaisi?: string | null;
  machineCode?: string | null;
  proposedSpares?: SpareClaimLine[];
  proposedItems?: SpareClaimLine[];
  stockItems?: ReconciliationStockItem[];
  mouvements?: ReconciliationMovement[];
  correctiveInterventions?: ReconciliationCorrectiveBt[];
  preventiveExecutions?: ReconciliationPreventiveExec[];
  sortieDemands?: ReconciliationSortieDemand[];
  reservedStockMap?: Map<string, ReservedStockEntry> | Record<string, ReservedStockEntry>;
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

/** Extracts normalized ref/designation/positive qty while tolerating legacy Excel aliases. */
function extractSpareRefAndQty(raw: SpareClaimLine | null | undefined): {
  ref: string;
  designation: string;
  qty: number;
} {
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
  claimType: rawClaimType,
  claimId: rawClaimId,
  recordType,
  recordId,
  numBonSaisi,
  machineCode,
  proposedSpares = [],
  proposedItems = [],
  stockItems = [],
  mouvements = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
}: ReconcileFieldClaimParams): ClaimReconciliationResult {
  const claimType: 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE' =
    rawClaimType ||
    (recordType === 'CORRECTIVE_BT'
      ? 'CORRECTIVE'
      : recordType === 'PREVENTIVE_EXEC'
      ? 'PREVENTIVE'
      : 'SORTIE');
  const claimId = rawClaimId ?? recordId ?? '';
  const effectiveSpares =
    Array.isArray(proposedSpares) && proposedSpares.length > 0
      ? proposedSpares
      : Array.isArray(proposedItems)
      ? proposedItems
      : [];
  const alerts: ReconciliationAlert[] = [];
  const candidateStoreMovements: CandidateStoreMovementMatch[] = [];
  let exactMovementMatch: ReconciliationMovement | null = null;
  const normClaimId = String(claimId ?? '').trim();
  const normBon = normalizeToken(numBonSaisi);
  const normMachine = normalizeToken(machineCode);

  const normalizedSpares = effectiveSpares
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
  const stockByRef = new Map<string, ReconciliationStockItem>();
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
  stockItems?: ReconciliationStockItem[];
  mouvements?: ReconciliationMovement[];
  correctiveInterventions?: ReconciliationCorrectiveBt[];
  preventiveExecutions?: ReconciliationPreventiveExec[];
  sortieDemands?: ReconciliationSortieDemand[];
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
  correctiveInterventions?: ReconciliationCorrectiveBt[];
  preventiveExecutions?: ReconciliationPreventiveExec[];
  sortieDemands?: ReconciliationSortieDemand[];
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

export interface ValidationCenterQueuesResult<
  TCorrective extends ReconciliationCorrectiveBt = ReconciliationCorrectiveBt,
  TPrevExec extends ReconciliationPreventiveExec = ReconciliationPreventiveExec,
  TDemand extends ReconciliationSortieDemand = ReconciliationSortieDemand,
> {
  pendingCorrective: TCorrective[];
  clarificationCorrective: TCorrective[];
  rejectedCorrective: TCorrective[];
  pendingPreventive: TPrevExec[];
  clarificationPreventive: TPrevExec[];
  rejectedPreventive: TPrevExec[];
  pendingSortieDemands: TDemand[];
  clarificationSortieDemands: TDemand[];
  rejectedSortieDemands: TDemand[];
  totalPending: number;
  totalClarification: number;
  totalRejected: number;
  approvedTodayCorrective: number;
  approvedTodayPreventive: number;
  approvedTodaySortieDemands: number;
  totalApprovedToday: number;
  hasAnyApprovedTimestamp: boolean;
  reservedRefsCount: number;
  totalReservedUnits: number;
  reservedStockMap: Map<string, ReservedStockEntry>;
}

/**
 * Pure selector aggregating all pending, clarification, rejected & approved-today
 * Maker-Checker queues for the unified desktop Validation Center (`Centre de validation / À valider`).
 * Preserves concrete caller array types via generics so downstream UI views keep full entity typings.
 */
export function selectValidationCenterQueues<
  TCorrective extends ReconciliationCorrectiveBt = ReconciliationCorrectiveBt,
  TPrevExec extends ReconciliationPreventiveExec = ReconciliationPreventiveExec,
  TDemand extends ReconciliationSortieDemand = ReconciliationSortieDemand,
>({
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
  todayIsoDate,
}: {
  correctiveInterventions?: TCorrective[];
  preventiveExecutions?: TPrevExec[];
  sortieDemands?: TDemand[];
  todayIsoDate?: string;
}): ValidationCenterQueuesResult<TCorrective, TPrevExec, TDemand> {
  const todayPrefix =
    typeof todayIsoDate === 'string' && todayIsoDate.trim().length >= 10
      ? todayIsoDate.trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  const pendingCorrective = (correctiveInterventions || []).filter(
    (bt) =>
      bt?.validation_status === 'PENDING_VALIDATION' ||
      bt?.statut === 'EN_ATTENTE_VALIDATION'
  );
  const clarificationCorrective = (correctiveInterventions || []).filter(
    (bt) => bt?.validation_status === 'NEEDS_CLARIFICATION'
  );
  const rejectedCorrective = (correctiveInterventions || []).filter(
    (bt) => bt?.validation_status === 'REJECTED' && bt?.statut !== 'CLOTURE'
  );

  const pendingPreventive = (preventiveExecutions || []).filter(
    (ex) => ex?.validation_status === 'PENDING_VALIDATION'
  );
  const clarificationPreventive = (preventiveExecutions || []).filter(
    (ex) => ex?.validation_status === 'NEEDS_CLARIFICATION'
  );
  const rejectedPreventive = (preventiveExecutions || []).filter(
    (ex) => ex?.validation_status === 'REJECTED'
  );

  const pendingSortieDemands = (sortieDemands || []).filter(
    (dem) => dem?.validation_status === 'PENDING_VALIDATION'
  );
  const clarificationSortieDemands = (sortieDemands || []).filter(
    (dem) => dem?.validation_status === 'NEEDS_CLARIFICATION'
  );
  const rejectedSortieDemands = (sortieDemands || []).filter(
    (dem) => dem?.validation_status === 'REJECTED'
  );

  let hasAnyApprovedTimestamp = false;
  const isApprovedToday = (
    record: { validation_status?: string; validated_at?: string } | null | undefined
  ): boolean => {
    if (String(record?.validation_status || '').toUpperCase() !== 'APPROVED') return false;
    const rawStamp = String(record?.validated_at || '').trim();
    if (!rawStamp) return false;
    hasAnyApprovedTimestamp = true;
    return rawStamp.slice(0, 10) === todayPrefix;
  };

  const approvedTodayCorrective = (correctiveInterventions || []).filter(isApprovedToday).length;
  const approvedTodayPreventive = (preventiveExecutions || []).filter(isApprovedToday).length;
  const approvedTodaySortieDemands = (sortieDemands || []).filter(isApprovedToday).length;

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
    rejectedCorrective,
    pendingPreventive,
    clarificationPreventive,
    rejectedPreventive,
    pendingSortieDemands,
    clarificationSortieDemands,
    rejectedSortieDemands,
    totalPending:
      pendingCorrective.length + pendingPreventive.length + pendingSortieDemands.length,
    totalClarification:
      clarificationCorrective.length +
      clarificationPreventive.length +
      clarificationSortieDemands.length,
    totalRejected:
      rejectedCorrective.length + rejectedPreventive.length + rejectedSortieDemands.length,
    approvedTodayCorrective,
    approvedTodayPreventive,
    approvedTodaySortieDemands,
    totalApprovedToday:
      approvedTodayCorrective + approvedTodayPreventive + approvedTodaySortieDemands,
    hasAnyApprovedTimestamp,
    reservedRefsCount: reservedStockMap.size,
    totalReservedUnits,
    reservedStockMap,
  };
}

export type StockReorderAlertStatus =
  | 'RUPTURE'
  | 'SOUS_SEUIL'
  | 'RISQUE_APRES_RESERVATION';

export interface StockReorderAlertItem {
  ref: string;
  designation: string;
  emplacement: string;
  type: string;
  unit: string;
  stockActuel: number;
  seuil: number;
  reservedQty: number;
  netAvailable: number;
  deficitToThreshold: number;
  status: StockReorderAlertStatus;
  statusLabelFr: string;
}

export interface StockReorderAlertsSummary {
  items: StockReorderAlertItem[];
  ruptureCount: number;
  sousSeuilCount: number;
  reservationRiskCount: number;
  totalAlertCount: number;
}

/**
 * C3 — Pure read-only reorder alert selector:
 * Evaluates existing `stockItems` against their minimum threshold (`seuil` / `stock_min`)
 * using the already-computed `stockActuel` balance and optional derived Maker-Checker
 * virtual reservations (`computeReservedStockMap`).
 *
 * Rules:
 * - `RUPTURE`: `stockActuel <= 0`
 * - `SOUS_SEUIL`: `stockActuel > 0 && stockActuel <= seuil`
 * - `RISQUE_APRES_RESERVATION`: `stockActuel > seuil && reservedQty > 0 && (stockActuel - reservedQty) <= seuil`
 * - Items with `stockActuel > seuil` AND `(stockActuel - reservedQty) > seuil` are strictly excluded (`OK`).
 * - Never mutates `stockActuel` or touches `IncrementalStockIndex` / `StockCalculationService`.
 */
export function computeStockReorderAlerts({
  stockItems = [],
  correctiveInterventions = [],
  preventiveExecutions = [],
  sortieDemands = [],
  reservedStockMap: providedReservedMap,
}: {
  stockItems?: ReconciliationStockItem[];
  correctiveInterventions?: ReconciliationCorrectiveBt[];
  preventiveExecutions?: ReconciliationPreventiveExec[];
  sortieDemands?: ReconciliationSortieDemand[];
  reservedStockMap?: Map<string, ReservedStockEntry>;
}): StockReorderAlertsSummary {
  const reservedMap =
    providedReservedMap ??
    computeReservedStockMap({
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });

  const items: StockReorderAlertItem[] = [];
  let ruptureCount = 0;
  let sousSeuilCount = 0;
  let reservationRiskCount = 0;

  for (const raw of stockItems || []) {
    if (!raw || typeof raw !== 'object') continue;
    const ref = String(raw.ref || raw.reference || raw.code_article || raw.id || '').trim();
    if (!ref) continue;

    // Read displayed balance strictly as-is (fallback to Initial + Entrees - Sorties only if stockActuel is omitted)
    const hasExplicitActuel =
      raw.stockActuel !== undefined && raw.stockActuel !== null && raw.stockActuel !== '';
    const hasSnakeActuel =
      raw.stock_actuel !== undefined && raw.stock_actuel !== null && raw.stock_actuel !== '';
    const stockActuel = hasExplicitActuel
      ? Number(raw.stockActuel)
      : hasSnakeActuel
      ? Number(raw.stock_actuel)
      : (Number(raw.stockInitial) || 0) + (Number(raw.entrees) || 0) - (Number(raw.sorties) || 0);

    const seuil = Number(raw.seuil ?? raw.stock_min ?? raw.stockMin ?? raw.min ?? 0) || 0;
    const reservedEntry = reservedMap.get(normalizeToken(ref));
    const reservedQty = Number(reservedEntry?.reservedQty || 0) || 0;
    const netAvailable = stockActuel - reservedQty;

    let status: StockReorderAlertStatus | null = null;
    let statusLabelFr = '';

    if (stockActuel <= 0) {
      status = 'RUPTURE';
      statusLabelFr = 'Rupture (Stock ≤ 0)';
      ruptureCount += 1;
    } else if (stockActuel <= seuil) {
      status = 'SOUS_SEUIL';
      statusLabelFr = 'Sous seuil min';
      sousSeuilCount += 1;
    } else if (reservedQty > 0 && netAvailable <= seuil) {
      status = 'RISQUE_APRES_RESERVATION';
      statusLabelFr = 'Sous seuil après réservation';
      reservationRiskCount += 1;
    }

    if (!status) continue; // Above threshold both physically and after reservation -> excluded

    items.push({
      ref,
      designation: String(raw.designation || raw.nom || ref).trim(),
      emplacement: String(raw.emplacement || 'Magasin').trim(),
      type: String(raw.type || raw.id_type || 'PDR').trim(),
      unit: String(raw.unit || raw.unite || 'pcs').trim(),
      stockActuel,
      seuil,
      reservedQty,
      netAvailable,
      deficitToThreshold: Math.max(0, seuil - netAvailable),
      status,
      statusLabelFr,
    });
  }

  const priorityOrder: Record<StockReorderAlertStatus, number> = {
    RUPTURE: 0,
    SOUS_SEUIL: 1,
    RISQUE_APRES_RESERVATION: 2,
  };

  items.sort((a, b) => {
    const pDiff = priorityOrder[a.status] - priorityOrder[b.status];
    if (pDiff !== 0) return pDiff;
    if (a.netAvailable !== b.netAvailable) return a.netAvailable - b.netAvailable;
    return a.ref.localeCompare(b.ref, undefined, { numeric: true, sensitivity: 'base' });
  });

  return {
    items,
    ruptureCount,
    sousSeuilCount,
    reservationRiskCount,
    totalAlertCount: items.length,
  };
}



