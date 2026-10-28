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
  correctivePdrCost12m: number;
  preventiveTotalCost12m: number;
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
  referenceDate?: string | Date;
  windowMonths?: number;
  recurrenceWindowDays?: number;
  recurrenceThreshold?: number;
}): MachineHealthPassport {
  const {
    machine,
    correctiveInterventions = [],
    preventiveExecutions = [],
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
    { label: string; count60d: number; count12m: number; cost12m: number }
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

  const recurrentOrganAlerts: RecurrentOrganAlert[] = [];
  for (const [organKey, stats] of byOrgan.entries()) {
    if (stats.count60d >= recurrenceThreshold || stats.count12m >= recurrenceThreshold) {
      recurrentOrganAlerts.push({
        organKey,
        organLabel: stats.label,
        count60d: stats.count60d,
        count12m: stats.count12m,
        totalPdrCost12m: Number(stats.cost12m.toFixed(2)),
        recommendation:
          stats.count60d >= recurrenceThreshold
            ? `Défaillance répétitive sur « ${stats.label} » (${stats.count60d}× en ${recurrenceWindowDays}j) — Convertir en gamme préventive ou analyser la réforme/remplacement de l'organe (BER).`
            : `Récurrence annuelle sur « ${stats.label} » (${stats.count12m}× sur 12 mois) — Renforcer la fréquence préventive.`,
      });
    }
  }

  recurrentOrganAlerts.sort((a, b) => b.count60d - a.count60d || b.count12m - a.count12m);

  const totalMaintenanceCost12m = Number(
    (correctivePdrCost12m + preventiveTotalCost12m).toFixed(2)
  );
  const totalDowntimeHours12m = Number((totalDowntimeMinutes12m / 60).toFixed(1));

  // Compute Health Score (0-100)
  let penalty = correctiveCount12m * 8 + recurrentOrganAlerts.length * 20;
  if (totalDowntimeHours12m > 24) penalty += 15;
  const healthScore = Math.max(10, Math.min(100, 100 - penalty));

  const healthStatus: 'SAIN' | 'SURVEILLANCE' | 'CRITIQUE_BER' =
    recurrentOrganAlerts.some((a) => a.count60d >= recurrenceThreshold) || healthScore < 50
      ? 'CRITIQUE_BER'
      : recurrentOrganAlerts.length > 0 || correctiveCount12m >= 2
      ? 'SURVEILLANCE'
      : 'SAIN';

  return {
    machineCode,
    windowMonths,
    correctiveCount12m,
    preventiveCount12m,
    correctivePdrCost12m: Number(correctivePdrCost12m.toFixed(2)),
    preventiveTotalCost12m: Number(preventiveTotalCost12m.toFixed(2)),
    totalMaintenanceCost12m,
    totalDowntimeHours12m,
    recurrentOrganAlerts,
    healthScore,
    healthStatus,
  };
}
