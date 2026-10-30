/**
 * @file MachineHealthPassportService.ts
 * @description
 * Pure domain calculations for:
 * 1) Detecting field anomalies in Preventive Executions (Rondes / PM tasks) to trigger Auto-DI.
 * 2) Computing the 12-Month Machine Health Passport (TCO = Corrective PDR + Preventive Cost,
 *    Downtime hours, and Recurrent Component/Organ Failure BER Alerts).
 */

const UNAPPROVED_STATUSES = new Set([
  'PENDING_VALIDATION',
  'NEEDS_CLARIFICATION',
  'REJECTED',
]);

const ANOMALY_KEYWORDS = [
  '[ronde: anomalie]',
  'anomalie',
  'fuite',
  'bruit anormal',
  'surchauffe',
  'cassé',
  'casse',
  'défaut',
  'defaut',
  'endommagé',
  'hs',
  'à remplacer',
  'a remplacer',
  ' critique',
];

/**
 * Determines whether a PreventiveExecution record signals a field anomaly
 * that warrants a follow-up Corrective Demande d'Intervention (Auto-DI).
 */
export function hasPreventiveExecutionAnomaly(exec: any): boolean {
  if (!exec) return false;
  if (String(exec.roundStatus || exec.etat_ronde || '').toUpperCase() === 'ANOMALIE') {
    return true;
  }
  if (exec.hasAnomaly === true || exec.anomalie_detectee === true) {
    return true;
  }
  const text = `${exec.notes || ''} ${exec.observations || ''} ${exec.status || ''}`
    .trim()
    .toLowerCase();
  if (!text) return false;
  if (text.includes('[ronde: conforme]')) return false;
  return ANOMALY_KEYWORDS.some((kw) => text.includes(kw));
}

export interface RecurrentOrganAlert {
  organKey: string;
  organLabel: string;
  count60d: number;
  count12m: number;
  totalPdrCost12m: number;
  recommendation: string;
}

export interface MachineHealthPassport {
  machineCode: string;
  windowMonths: number;
  correctiveCount12m: number;
  preventiveCount12m: number;
  externalBobinageCount12m: number;
  correctivePdrCost12m: number;
  preventiveTotalCost12m: number;
  externalBobinageCost12m: number;
  totalMaintenanceCost12m: number;
  totalDowntimeHours12m: number;
  recurrentOrganAlerts: RecurrentOrganAlert[];
  healthScore: number;
  healthStatus: 'SAIN' | 'SURVEILLANCE' | 'CRITIQUE_BER';
}

function parseDateSafe(raw: any): Date | null {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  const d = new Date(str.length === 10 ? `${str}T12:00:00Z` : str);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeMachineHealthPassport(params: {
  machine: any;
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortiesExterne?: any[];
  referenceDate?: string | Date;
  windowMonths?: number;
  recurrenceWindowDays?: number;
  recurrenceThreshold?: number;
}): MachineHealthPassport {
  const {
    machine,
    correctiveInterventions = [],
    preventiveExecutions = [],
    sortiesExterne = [],
    referenceDate,
    windowMonths = 12,
    recurrenceWindowDays = 60,
    recurrenceThreshold = 3,
  } = params;

  const machineCode = String(
    machine?.id_machine_registered || machine?.id || machine?.code || ''
  )
    .trim()
    .toUpperCase();

  const refDate = referenceDate ? new Date(referenceDate) : new Date();
  const cutoff12m = new Date(refDate.getTime() - windowMonths * 30.44 * 24 * 60 * 60 * 1000);
  const cutoff60d = new Date(refDate.getTime() - recurrenceWindowDays * 24 * 60 * 60 * 1000);

  let correctiveCount12m = 0;
  let correctivePdrCost12m = 0;
  let totalDowntimeMinutes12m = 0;

  const byOrgan = new Map<
    string,
    { label: string; count60d: number; count12m: number; cost12m: number; bobinageCount12m: number }
  >();

  for (const ci of correctiveInterventions || []) {
    const code = String(ci?.code_machine || ci?.id_machine_registered || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    // Exclude unapproved / rejected Maker-Checker claims
    const valSt = String(ci?.validation_status || '').trim().toUpperCase();
    const wfSt = String(ci?.statut || '').trim().toUpperCase();
    if (
      UNAPPROVED_STATUSES.has(valSt) ||
      wfSt === 'EN_ATTENTE_VALIDATION' ||
      wfSt === 'ANNULE' ||
      wfSt === 'REJECTED'
    ) {
      continue;
    }

    const d = parseDateSafe(ci?.date_cloture || ci?.date_fin || ci?.date_demande || ci?.demande_date);
    if (d && d < cutoff12m) continue;

    correctiveCount12m += 1;
    const cost = Number(ci?.cout_pdr ?? ci?.pdr_cost ?? 0) || 0;
    correctivePdrCost12m += cost;

    const mins =
      Number(
        ci?.temps_arret_minutes ??
          ci?.temps_intervention_mins ??
          (ci?.duree_arret_heures ? Number(ci.duree_arret_heures) * 60 : 0)
      ) || 0;
    totalDowntimeMinutes12m += mins;

    const organRaw = String(
      ci?.nom_composant ||
        ci?.id_composant ||
        ci?.organe ||
        ci?.type_panne ||
        ci?.anomalie ||
        'Organe Général'
    ).trim();
    const organKey = organRaw.toUpperCase();

    const entry = byOrgan.get(organKey) || {
      label: organRaw,
      count60d: 0,
      count12m: 0,
      cost12m: 0,
      bobinageCount12m: 0,
    };
    entry.count12m += 1;
    entry.cost12m += cost;
    if (!d || d >= cutoff60d) {
      entry.count60d += 1;
    }
    byOrgan.set(organKey, entry);
  }

  let preventiveCount12m = 0;
  let preventiveTotalCost12m = 0;

  for (const ex of preventiveExecutions || []) {
    const code = String(ex?.machineCode || ex?.id_machine || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    const valSt = String(ex?.validation_status || '').trim().toUpperCase();
    if (UNAPPROVED_STATUSES.has(valSt)) continue;

    const d = parseDateSafe(ex?.executedAt || ex?.date_realisation);
    if (d && d < cutoff12m) continue;

    preventiveCount12m += 1;
    const cost = Number(ex?.totalCost ?? ex?.sparesCost ?? 0) || 0;
    preventiveTotalCost12m += cost;
  }

  // External Subcontracting / Bobinage (Sorties Externe)
  let externalBobinageCount12m = 0;
  let externalBobinageCost12m = 0;

  for (const se of sortiesExterne || []) {
    const code = String(se?.id_machine || se?.code_machine || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    const d = parseDateSafe(
      se?.date_montage ||
        se?.date_arrivee_reelle ||
        se?.date_expedition ||
        se?.date_demontage ||
        se?.created_at
    );
    if (d && d < cutoff12m) continue;

    externalBobinageCount12m += 1;
    const bobinageCost = Number(se?.cout_bobinage || 0) || 0;
    externalBobinageCost12m += bobinageCost;

    const motorRaw = String(
      se?.code_moteur_reel || se?.designation_moteur || 'Moteur Externe'
    ).trim();
    const motorKey = motorRaw.toUpperCase();

    const entry = byOrgan.get(motorKey) || {
      label: motorRaw,
      count60d: 0,
      count12m: 0,
      cost12m: 0,
      bobinageCount12m: 0,
    };
    entry.count12m += 1;
    entry.bobinageCount12m += 1;
    entry.cost12m += bobinageCost;
    if (!d || d >= cutoff60d) {
      entry.count60d += 1;
    }
    byOrgan.set(motorKey, entry);
  }

  const recurrentOrganAlerts: RecurrentOrganAlert[] = [];
  for (const [organKey, stats] of byOrgan.entries()) {
    const isRepeatedBobinage = stats.bobinageCount12m >= 2;
    if (
      stats.count60d >= recurrenceThreshold ||
      stats.count12m >= recurrenceThreshold ||
      isRepeatedBobinage
    ) {
      recurrentOrganAlerts.push({
        organKey,
        organLabel: stats.label,
        count60d: stats.count60d,
        count12m: stats.count12m,
        totalPdrCost12m: Number(stats.cost12m.toFixed(2)),
        recommendation: isRepeatedBobinage
          ? `Rebobinages multiples sur « ${stats.label} » (${stats.bobinageCount12m}× sur 12m, ${stats.cost12m.toFixed(0)} DH) — Évaluer le remplacement par un moteur neuf (BER).`
          : stats.count60d >= recurrenceThreshold
          ? `Défaillance répétitive sur « ${stats.label} » (${stats.count60d}× en ${recurrenceWindowDays}j) — Convertir en gamme préventive ou analyser la réforme/remplacement de l'organe (BER).`
          : `Récurrence annuelle sur « ${stats.label} » (${stats.count12m}× sur 12 mois) — Renforcer la fréquence préventive.`,
      });
    }
  }

  recurrentOrganAlerts.sort((a, b) => b.count60d - a.count60d || b.count12m - a.count12m);

  const totalMaintenanceCost12m = Number(
    (correctivePdrCost12m + preventiveTotalCost12m + externalBobinageCost12m).toFixed(2)
  );
  const totalDowntimeHours12m = Number((totalDowntimeMinutes12m / 60).toFixed(1));

  // Compute Health Score (0-100)
  let penalty =
    correctiveCount12m * 8 +
    externalBobinageCount12m * 10 +
    recurrentOrganAlerts.length * 20;
  if (totalDowntimeHours12m > 24) penalty += 15;
  const healthScore = Math.max(10, Math.min(100, 100 - penalty));

  const healthStatus: 'SAIN' | 'SURVEILLANCE' | 'CRITIQUE_BER' =
    recurrentOrganAlerts.some((a) => a.count60d >= recurrenceThreshold) ||
    recurrentOrganAlerts.some((a) => a.recommendation.includes('Rebobinages multiples')) ||
    healthScore < 50
      ? 'CRITIQUE_BER'
      : recurrentOrganAlerts.length > 0 || correctiveCount12m >= 2 || externalBobinageCount12m >= 1
      ? 'SURVEILLANCE'
      : 'SAIN';

  return {
    machineCode,
    windowMonths,
    correctiveCount12m,
    preventiveCount12m,
    externalBobinageCount12m,
    correctivePdrCost12m: Number(correctivePdrCost12m.toFixed(2)),
    preventiveTotalCost12m: Number(preventiveTotalCost12m.toFixed(2)),
    externalBobinageCost12m: Number(externalBobinageCost12m.toFixed(2)),
    totalMaintenanceCost12m,
    totalDowntimeHours12m,
    recurrentOrganAlerts,
    healthScore,
    healthStatus,
  };
}

export type MachineActivityEventType =
  | 'CORRECTIVE_BT'
  | 'PREVENTIVE_EXECUTION'
  | 'EXTERNAL_BOBINAGE'
  | 'BOM_COMPONENT'
  | 'MACHINE_LIFECYCLE';

export interface MachineActivityLedgerEvent {
  id: string;
  machineCode: string;
  type: MachineActivityEventType;
  typeLabelFr: string;
  timestamp: string;
  dateYMD: string;
  title: string;
  details: string;
  actor?: string;
  cost?: number;
  downtimeMinutes?: number;
  referenceCode?: string;
  validationStatus: 'APPROVED' | 'PENDING_VALIDATION' | 'NEEDS_CLARIFICATION' | 'REJECTED';
  isOfficial: boolean;
}

function toYMD(raw: any): string {
  const d = parseDateSafe(raw);
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

/**
 * B2 — Pure chronological activity & audit ledger for a single machine.
 * Aggregates official (validated) events across existing SSOT collections without duplicate storage:
 * - Approved Corrective BTs & official PDR costs
 * - Approved Preventive Executions
 * - External Bobinage / Subcontracting records
 * - Attached BOM / Organ installation & lifecycle traces
 * - Machine archiving / status change trace when present
 *
 * By default (`includePendingClaims = false`), unapproved field claims (`PENDING_VALIDATION`,
 * `NEEDS_CLARIFICATION`, `REJECTED`) are strictly excluded from the official ledger.
 */
export function buildMachineActivityLedger(params: {
  machineOrId: any;
  machines?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortiesExterne?: any[];
  machineElementsLedger?: any[];
  warehouseItems?: any[];
  includePendingClaims?: boolean;
}): MachineActivityLedgerEvent[] {
  const {
    machineOrId,
    machines = [],
    correctiveInterventions = [],
    preventiveExecutions = [],
    sortiesExterne = [],
    machineElementsLedger = [],
    warehouseItems = [],
    includePendingClaims = false,
  } = params || {};

  const rawCode =
    typeof machineOrId === 'string'
      ? machineOrId
      : machineOrId?.id_machine_registered ||
        machineOrId?.id ||
        machineOrId?.code ||
        machineOrId?.code_machine ||
        '';
  const machineCode = String(rawCode || '').trim().toUpperCase();
  if (!machineCode) return [];

  const resolvedMachine =
    typeof machineOrId === 'object' && machineOrId !== null
      ? machineOrId
      : (machines || []).find(
          (m: any) =>
            String(m?.id_machine_registered || m?.id || m?.code || m?.code_machine || '')
              .trim()
              .toUpperCase() === machineCode
        ) || null;

  const events: MachineActivityLedgerEvent[] = [];

  // 1) Corrective Interventions (BT / Clôtures approuvées + Coûts PDR validés)
  for (const ci of correctiveInterventions || []) {
    if (!ci) continue;
    const code = String(ci.code_machine || ci.id_machine_registered || ci.id_machine || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    const valSt = String(ci.validation_status || '').trim().toUpperCase();
    const wfSt = String(ci.statut || '').trim().toUpperCase();

    const isUnapproved =
      UNAPPROVED_STATUSES.has(valSt) ||
      wfSt === 'EN_ATTENTE_VALIDATION' ||
      wfSt === 'ANNULE' ||
      wfSt === 'REJECTED';

    const isOfficial = !isUnapproved;
    if (!isOfficial && !includePendingClaims) continue;

    const rawTs =
      ci.validated_at ||
      ci.date_cloture ||
      ci.date_fin ||
      ci.submitted_at ||
      ci.date_demande ||
      ci.demande_date ||
      ci.created_at;
    const dateYMD = toYMD(rawTs);
    if (!dateYMD) continue;

    const cost = Number(ci.cout_pdr ?? ci.pdr_cost ?? 0) || 0;
    const downtimeMinutes =
      Number(
        ci.temps_arret_minutes ??
          ci.temps_intervention_mins ??
          (ci.duree_arret_heures ? Number(ci.duree_arret_heures) * 60 : 0)
      ) || 0;

    const btRef = String(ci.num_bt || ci.id || 'BT').trim();
    const organ = String(ci.nom_composant || ci.id_composant || '').trim();
    const pdrList = Array.isArray(ci.pieces_utilisees) && ci.pieces_utilisees.length > 0
      ? ci.pieces_utilisees
          .map((p: any) => `${p.ref || p.designation} (×${p.quantite || 1})`)
          .join(', ')
      : ci.pdr_ref
      ? `${ci.pdr_ref} (×${ci.pdr_quantite || 1})`
      : '';

    const detailParts: string[] = [];
    if (ci.action_realisee) detailParts.push(`Action: ${ci.action_realisee}`);
    if (organ) detailParts.push(`Organe: ${organ}`);
    if (pdrList && isOfficial) detailParts.push(`PDR validée: ${pdrList}`);
    if (wfSt) detailParts.push(`Statut: ${wfSt}`);

    events.push({
      id: `LEDGER-BT-${String(ci.id || btRef)}`,
      machineCode,
      type: 'CORRECTIVE_BT',
      typeLabelFr: isOfficial ? 'BT Correctif Approuvé' : 'BT (En attente validation)',
      timestamp: String(rawTs),
      dateYMD,
      title: `${btRef} — ${ci.anomalie || ci.travail_a_faire || 'Intervention corrective'}`,
      details: detailParts.join(' • ') || 'Intervention corrective enregistrée',
      actor: String(
        ci.validated_by_name || ci.intervenant || ci.technicien || ci.demandeur || ''
      ).trim() || undefined,
      cost: isOfficial && cost > 0 ? Number(cost.toFixed(2)) : undefined,
      downtimeMinutes: downtimeMinutes > 0 ? downtimeMinutes : undefined,
      referenceCode: btRef,
      validationStatus: (UNAPPROVED_STATUSES.has(valSt) ? valSt : 'APPROVED') as any,
      isOfficial,
    });
  }

  // 2) Preventive Executions (Exécutions préventives approuvées)
  for (const ex of preventiveExecutions || []) {
    if (!ex) continue;
    const code = String(ex.machineCode || ex.id_machine || ex.code_machine || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    const statusUpper = String(ex.status || '').trim().toUpperCase();
    if (statusUpper === 'SKIPPED') continue;

    const valSt = String(ex.validation_status || '').trim().toUpperCase();
    const isUnapproved =
      UNAPPROVED_STATUSES.has(valSt) || statusUpper === 'PENDING_VALIDATION';
    const isOfficial = !isUnapproved;
    if (!isOfficial && !includePendingClaims) continue;

    const rawTs = ex.validated_at || ex.executedAt || ex.date_realisation || ex.created_at;
    const dateYMD = toYMD(rawTs);
    if (!dateYMD) continue;

    const cost = Number(ex.totalCost ?? ex.sparesCost ?? 0) || 0;
    const durationMinutes = Number(ex.durationMinutes || 0) || 0;
    const sparesSummary =
      Array.isArray(ex.sparesUsed) && ex.sparesUsed.length > 0
        ? ex.sparesUsed.map((s: any) => `${s.ref || s.designation} (×${s.quantity || s.quantite || 1})`).join(', ')
        : '';

    const detailParts: string[] = [];
    if (ex.notes || ex.observations) detailParts.push(String(ex.notes || ex.observations).trim());
    if (sparesSummary && isOfficial) detailParts.push(`PDR: ${sparesSummary}`);
    if (ex.scheduledDueDate) detailParts.push(`Échéance: ${ex.scheduledDueDate}`);

    events.push({
      id: `LEDGER-PM-${String(ex.id || ex.taskId || events.length + 1)}`,
      machineCode,
      type: 'PREVENTIVE_EXECUTION',
      typeLabelFr: isOfficial ? 'Préventif Validé' : 'Préventif (En attente)',
      timestamp: String(rawTs),
      dateYMD,
      title: String(ex.taskName || ex.designation || `Exécution préventive ${ex.taskId || ''}`).trim(),
      details: detailParts.join(' • ') || 'Contrôle préventif exécuté et validé',
      actor: String(ex.validated_by_name || ex.executorName || ex.technicien || '').trim() || undefined,
      cost: isOfficial && cost > 0 ? Number(cost.toFixed(2)) : undefined,
      downtimeMinutes: durationMinutes > 0 ? durationMinutes : undefined,
      referenceCode: String(ex.taskId || ex.id || 'PM').trim(),
      validationStatus: (UNAPPROVED_STATUSES.has(valSt) ? valSt : 'APPROVED') as any,
      isOfficial,
    });
  }

  // 3) External Subcontracting / Bobinage (Sorties Externe)
  for (const se of sortiesExterne || []) {
    if (!se) continue;
    const code = String(se.id_machine || se.code_machine || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    const rawTs =
      se.date_montage ||
      se.date_arrivee_reelle ||
      se.date_expedition ||
      se.date_demontage ||
      se.created_at;
    const dateYMD = toYMD(rawTs);
    if (!dateYMD) continue;

    const cost = Number(se.cout_bobinage || 0) || 0;
    const refCode = String(se.code || se.id || se.ref || 'SORT-EXT').trim();
    const motorLabel = String(se.designation_moteur || se.code_moteur_reel || 'Moteur / Organe').trim();

    events.push({
      id: `LEDGER-EXT-${String(se.id || se.code || events.length + 1)}`,
      machineCode,
      type: 'EXTERNAL_BOBINAGE',
      typeLabelFr: 'Bobinage / Prestataire Externe',
      timestamp: String(rawTs),
      dateYMD,
      title: `${refCode} — ${motorLabel}`,
      details: `Statut: ${se.statut || 'Enregistré'}${se.fournisseur ? ` • Prestataire: ${se.fournisseur}` : ''}${se.nature_travaux ? ` • Travaux: ${se.nature_travaux}` : ''}`,
      actor: se.fournisseur || se.technicien_demontage || undefined,
      cost: cost > 0 ? Number(cost.toFixed(2)) : undefined,
      referenceCode: refCode,
      validationStatus: 'APPROVED',
      isOfficial: true,
    });
  }

  // 4) BOM & Organ Events (machineElementsLedger & warehouseItems with installation / intervention trace)
  for (const el of machineElementsLedger || []) {
    if (!el) continue;
    const code = String(el.id_machine_registered || el.id_machine || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    const rawTs = el.date_installation || el.updated_at || el.created_at;
    const dateYMD = toYMD(rawTs);
    if (!dateYMD) continue;

    const refEl = String(el.ref_element || el.code_element || el.id_element || el.id || 'BOM').trim();
    const desig = String(el.designation || el.designation_element || refEl).trim();

    events.push({
      id: `LEDGER-BOM-${String(el.id || el.id_element_instance || refEl)}`,
      machineCode,
      type: 'BOM_COMPONENT',
      typeLabelFr: 'Organe / Nomenclature BOM',
      timestamp: String(rawTs),
      dateYMD,
      title: `Montage BOM : ${desig}`,
      details: `Réf: ${refEl} • Qté: ${el.qte_montee || 1} ${el.unite || 'U'}${el.emplacement_machine ? ` • Emplacement: ${el.emplacement_machine}` : ''}${el.statut ? ` • Statut: ${el.statut}` : ''}`,
      actor: el.technicien || undefined,
      referenceCode: refEl,
      validationStatus: 'APPROVED',
      isOfficial: true,
    });
  }

  for (const w of warehouseItems || []) {
    if (!w) continue;
    const code = String(w.id_machine_registered || w.id_machine || '')
      .trim()
      .toUpperCase();
    if (!code || code !== machineCode) continue;

    const rawTs = w.derniere_intervention_date || w.date_installation || w.updated_at;
    const dateYMD = toYMD(rawTs);
    if (!dateYMD) continue;

    const wCode = String(w.code || w.id_warehouse_item || w.id || 'ORG').trim();
    events.push({
      id: `LEDGER-ORG-${wCode}`,
      machineCode,
      type: 'BOM_COMPONENT',
      typeLabelFr: 'Organe Rattaché (Entrepôt)',
      timestamp: String(rawTs),
      dateYMD,
      title: `Mouvement Organe : ${w.designation || wCode}`,
      details: `Statut: ${w.status || w.statut || 'En service'}${w.derniere_intervention_bt ? ` • Lié au BT: ${w.derniere_intervention_bt}` : ''}`,
      referenceCode: wCode,
      validationStatus: 'APPROVED',
      isOfficial: true,
    });
  }

  // 5) Machine Lifecycle / Archive / Status Change trace (when present on the machine record)
  if (resolvedMachine) {
    const lifecycleEvents = Array.isArray(resolvedMachine.lifecycle_events)
      ? resolvedMachine.lifecycle_events
      : [];

    if (lifecycleEvents.length > 0) {
      for (const le of lifecycleEvents) {
        if (!le) continue;
        const leTs = le.timestamp || le.date || resolvedMachine.status_changed_at;
        const dateYMD = toYMD(leTs);
        if (!dateYMD) continue;

        const evType = String(le.event_type || '').toUpperCase();
        const toStatus = String(le.to_status || resolvedMachine.status || 'ARCHIVEE').trim();
        const fromStatus = String(le.from_status || '').trim();

        const title =
          evType === 'ARCHIVED'
            ? `Archivage / Mise hors service (${toStatus})`
            : evType === 'REACTIVATED'
            ? `Réactivation de l'équipement (${fromStatus ? `${fromStatus} → ` : ''}${toStatus})`
            : `Changement d'état machine : ${fromStatus ? `${fromStatus} → ` : ''}${toStatus}`;

        const taskNote =
          Number(le.suspended_tasks_count) > 0
            ? ` • ${le.suspended_tasks_count} gamme(s) préventive(s) suspendue(s)`
            : Number(le.restored_tasks_count) > 0
            ? ` • ${le.restored_tasks_count} gamme(s) préventive(s) réactivée(s)`
            : '';

        events.push({
          id: String(le.id || `LEDGER-LIFE-${machineCode}-${events.length + 1}`),
          machineCode,
          type: 'MACHINE_LIFECYCLE',
          typeLabelFr:
            evType === 'ARCHIVED'
              ? 'Cycle de Vie / Archivage'
              : evType === 'REACTIVATED'
              ? 'Cycle de Vie / Réactivation'
              : 'Changement de Statut',
          timestamp: String(leTs),
          dateYMD,
          title,
          details: `${le.reason || `Transition vers « ${toStatus} »`}${taskNote}.`,
          actor: le.actor || resolvedMachine.archived_by || resolvedMachine.updated_by || undefined,
          referenceCode: machineCode,
          validationStatus: 'APPROVED',
          isOfficial: true,
        });
      }
    } else {
      const statusStr = String(resolvedMachine.status || resolvedMachine.statut || '').trim();
      const statusUpper = statusStr.toUpperCase();
      const isArchived =
        resolvedMachine.archived === true ||
        resolvedMachine.isArchived === true ||
        statusUpper === 'ARCHIVEE' ||
        statusUpper === 'ARCHIVÉE' ||
        statusUpper === 'ARCHIVED' ||
        statusUpper === 'ARCHIVE' ||
        String(resolvedMachine.lifecycle_state || '').trim().toUpperCase() === 'ARCHIVED' ||
        Boolean(
          resolvedMachine.date_archivage ||
            resolvedMachine.archived_at ||
            resolvedMachine.archivedAt
        );

      const archiveTs =
        resolvedMachine.date_archivage ||
        resolvedMachine.archived_at ||
        resolvedMachine.archivedAt ||
        resolvedMachine.status_changed_at ||
        resolvedMachine.updated_at;

      if (isArchived && archiveTs) {
        const dateYMD = toYMD(archiveTs);
        if (dateYMD) {
          events.push({
            id: `LEDGER-LIFE-ARCHIVE-${machineCode}`,
            machineCode,
            type: 'MACHINE_LIFECYCLE',
            typeLabelFr: 'Cycle de Vie / Archivage',
            timestamp: String(archiveTs),
            dateYMD,
            title: `Archivage / Mise hors service (${statusStr || 'ARCHIVEE'})`,
            details: `La machine ${machineCode} a été placée en statut « ${statusStr || 'ARCHIVEE'} » (conservation historique sans tâches actives).`,
            actor: resolvedMachine.archived_by || resolvedMachine.updated_by || undefined,
            referenceCode: machineCode,
            validationStatus: 'APPROVED',
            isOfficial: true,
          });
        }
      } else if (
        resolvedMachine.status_changed_at ||
        (resolvedMachine.updated_at &&
          statusUpper &&
          statusUpper !== 'EN SERVICE' &&
          statusUpper !== 'OPERATIONNELLE')
      ) {
        const changeTs = resolvedMachine.status_changed_at || resolvedMachine.updated_at;
        const dateYMD = toYMD(changeTs);
        if (dateYMD) {
          events.push({
            id: `LEDGER-LIFE-STATUS-${machineCode}`,
            machineCode,
            type: 'MACHINE_LIFECYCLE',
            typeLabelFr: 'Changement de Statut',
            timestamp: String(changeTs),
            dateYMD,
            title: `Changement d'état machine : ${statusStr}`,
            details: `Statut opérationnel mis à jour vers « ${statusStr} ».`,
            actor: resolvedMachine.updated_by || undefined,
            referenceCode: machineCode,
            validationStatus: 'APPROVED',
            isOfficial: true,
          });
        }
      }
    }
  }

  // Sort newest first (descending by timestamp / dateYMD)
  events.sort((a, b) => {
    const tA = parseDateSafe(a.timestamp)?.getTime() || 0;
    const tB = parseDateSafe(b.timestamp)?.getTime() || 0;
    if (tB !== tA) return tB - tA;
    return b.dateYMD.localeCompare(a.dateYMD);
  });

  return events;
}

