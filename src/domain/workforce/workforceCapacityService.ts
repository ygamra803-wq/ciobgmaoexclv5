import type { ITechnician } from '../../types/domain';
import type { CorrectiveInterventionItem, PreventiveTaskItem } from '../../types/store';

export type HabilitationCode =
  | 'B0'
  | 'B1V'
  | 'B2V'
  | 'BR'
  | 'BC'
  | 'H0V'
  | 'LOTO_CONSIGNATION'
  | 'HYDRAULIQUE_HP'
  | 'PNEUMATIQUE_INDUS'
  | 'MECANIQUE_PRECISION'
  | 'ATEX'
  | 'TRAVAIL_HAUTEUR'
  | 'CACES_R489'
  | 'SOUDURE_TIG';

export type ShiftPosteCode = 'MATIN' | 'SOIR' | 'NUIT' | 'JOUR';

export interface ITechnicianHabilitation {
  code: HabilitationCode;
  labelFr?: string;
  expiresAt?: string | null; // YYYY-MM-DD
}

export interface TechnicianShiftWorkload {
  technicianId: string;
  technicianName: string;
  zone: string;
  shift: ShiftPosteCode;
  capacityMinutes: number;
  assignedCorrectiveMinutes: number;
  assignedPreventiveMinutes: number;
  totalAssignedMinutes: number;
  remainingMinutes: number;
  utilizationRatePct: number;
  loadStatus: 'AVAILABLE' | 'HIGH_LOAD' | 'OVERLOADED';
  activeBtCount: number;
  duePreventiveCount: number;
}

export interface TechnicianSuitabilityEvaluation {
  technicianId: string;
  technicianName: string;
  specialite: string;
  zone: string;
  shift: ShiftPosteCode;
  requiredHabilitations: HabilitationCode[];
  heldValidHabilitations: HabilitationCode[];
  missingHabilitations: HabilitationCode[];
  expiredHabilitations: HabilitationCode[];
  isHabilitationCompliant: boolean;
  workload: TechnicianShiftWorkload;
  projectedUtilizationPct: number;
  wouldExceedShiftCapacity: boolean;
  score: number;
  recommendationLabelFr: string;
}

export const HABILITATION_CATALOG: Record<HabilitationCode, { labelFr: string; domain: string }> = {
  B0: { labelFr: 'B0 — Exécutant non électricien', domain: 'ELECTRIQUE' },
  B1V: { labelFr: 'B1V — Exécutant électricien BT (voisinage)', domain: 'ELECTRIQUE' },
  B2V: { labelFr: 'B2V — Chargé de travaux électriques BT', domain: 'ELECTRIQUE' },
  BR: { labelFr: 'BR — Chargé d’intervention générale BT', domain: 'ELECTRIQUE' },
  BC: { labelFr: 'BC — Chargé de consignation électrique', domain: 'LOTO' },
  H0V: { labelFr: 'H0V — Accès poste Haute Tension HTA', domain: 'ELECTRIQUE' },
  LOTO_CONSIGNATION: { labelFr: 'LOTO — Consignation multi-énergies', domain: 'LOTO' },
  HYDRAULIQUE_HP: { labelFr: 'Hydraulique Haute Pression (> 150 bar)', domain: 'HYDRAULIQUE' },
  PNEUMATIQUE_INDUS: { labelFr: 'Pneumatique & Air Comprimé', domain: 'PNEUMATIQUE' },
  MECANIQUE_PRECISION: { labelFr: 'Mécanique & Alignement Laser', domain: 'MECANIQUE' },
  ATEX: { labelFr: 'ATEX — Atmosphères Explosives', domain: 'SECURITE' },
  TRAVAIL_HAUTEUR: { labelFr: 'Travail en Hauteur & Nacelle', domain: 'SECURITE' },
  CACES_R489: { labelFr: 'CACES R489 — Chariots élévateurs', domain: 'LOGISTIQUE' },
  SOUDURE_TIG: { labelFr: 'Soudure TIG / ARC Certifiée', domain: 'ATELIER' },
};

const DEFAULT_SHIFT_CAPACITY_MINUTES = 480; // 8 hours standard shift

/**
 * Infers required safety/technical habilitations for an intervention from its breakdown category
 * (`type_panne`), LOTO flag (`requires_loto`), and anomaly description.
 */
export function inferRequiredHabilitations(
  intervention: Partial<CorrectiveInterventionItem> | null | undefined
): HabilitationCode[] {
  if (!intervention) return [];
  const required = new Set<HabilitationCode>();
  const typePanne = String(intervention.type_panne || '')
    .trim()
    .toUpperCase();
  const text = `${intervention.anomalie || ''} ${intervention.travail_a_faire || ''}`.toLowerCase();

  if (typePanne === 'E' || text.includes('électr') || text.includes('bobinage') || text.includes('variateur') || text.includes('armoire')) {
    required.add('BR');
  }
  if (intervention.requires_loto || text.includes('consign') || text.includes('loto')) {
    required.add('BC');
  }
  if (typePanne === 'H' || text.includes('hydraul') || text.includes('vérin') || text.includes('pompe hp')) {
    required.add('HYDRAULIQUE_HP');
  }
  if (typePanne === 'P' || text.includes('pneumat') || text.includes('compresseur')) {
    required.add('PNEUMATIQUE_INDUS');
  }
  if (text.includes('atex') || text.includes('gaz')) {
    required.add('ATEX');
  }
  if (text.includes('soudure') || text.includes('souder')) {
    required.add('SOUDURE_TIG');
  }

  return Array.from(required);
}

/**
 * Extracts normalized habilitations from a technician record (supporting both explicit
 * `tech.habilitations` arrays and specialty-based inference when legacy records omit array).
 */
export function extractTechnicianHabilitations(
  tech: ITechnician | Record<string, unknown>
): ITechnicianHabilitation[] {
  const rawList = (tech as Record<string, unknown>)?.habilitations;
  if (Array.isArray(rawList) && rawList.length > 0) {
    return rawList
      .map((item): ITechnicianHabilitation | null => {
        if (typeof item === 'string') {
          const code = item.trim().toUpperCase() as HabilitationCode;
          return code ? { code, expiresAt: null } : null;
        }
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          const code = String(rec.code || '').trim().toUpperCase() as HabilitationCode;
          if (!code) return null;
          return {
            code,
            labelFr: rec.labelFr ? String(rec.labelFr) : HABILITATION_CATALOG[code]?.labelFr,
            expiresAt: rec.expiresAt || rec.date_expiration ? String(rec.expiresAt || rec.date_expiration) : null,
          };
        }
        return null;
      })
      .filter((x): x is ITechnicianHabilitation => x !== null);
  }

  // Fallback inference from `specialite` for legacy seeded technicians
  const spec = String((tech as Record<string, unknown>)?.specialite || (tech as Record<string, unknown>)?.role || '').toLowerCase();
  const inferred: ITechnicianHabilitation[] = [];
  if (spec.includes('électr') || spec.includes('electr') || spec.includes('auto')) {
    inferred.push({ code: 'BR', expiresAt: null }, { code: 'B2V', expiresAt: null }, { code: 'BC', expiresAt: null });
  }
  if (spec.includes('hydraul')) {
    inferred.push({ code: 'HYDRAULIQUE_HP', expiresAt: null });
  }
  if (spec.includes('pneumat')) {
    inferred.push({ code: 'PNEUMATIQUE_INDUS', expiresAt: null });
  }
  if (spec.includes('mécan') || spec.includes('mecan') || spec.includes('maintenance') || spec.includes('dépannage')) {
    inferred.push(
      { code: 'MECANIQUE_PRECISION', expiresAt: null },
      { code: 'BR', expiresAt: null },
      { code: 'LOTO_CONSIGNATION', expiresAt: null }
    );
  }
  return inferred;
}

/**
 * Computes shift workload capacity for a technician across active Corrective BTs and due Preventive tasks.
 */
export function computeTechnicianShiftWorkload({
  technician,
  activeInterventions = [],
  preventiveTasks = [],
}: {
  technician: ITechnician | Record<string, unknown>;
  activeInterventions?: CorrectiveInterventionItem[];
  preventiveTasks?: PreventiveTaskItem[];
}): TechnicianShiftWorkload {
  const rec = technician as Record<string, unknown>;
  const techId = String(rec.id_technician || rec.id || '').trim();
  const techName = String(rec.nom || rec.name || techId || 'Technicien').trim();
  const normName = techName.toLowerCase();
  const normId = techId.toLowerCase();
  const zone = String(rec.id_zone || rec.zone || 'Toutes zones').trim();
  const shift = (String(rec.shift_poste || rec.poste || 'MATIN')
    .trim()
    .toUpperCase() || 'MATIN') as ShiftPosteCode;
  const capacityMinutes = Math.max(
    60,
    Number(rec.capacite_journaliere_min ?? rec.shift_capacity_min ?? DEFAULT_SHIFT_CAPACITY_MINUTES) ||
      DEFAULT_SHIFT_CAPACITY_MINUTES
  );

  let assignedCorrectiveMinutes = 0;
  let activeBtCount = 0;

  for (const bt of activeInterventions || []) {
    const statut = String(bt?.statut || '').toUpperCase();
    if (statut === 'CLOTURE' || statut === 'DEMANDE' || statut === 'DEMANDE_CREEE') continue;
    if (bt?.validation_status === 'PENDING_VALIDATION' || bt?.validation_status === 'APPROVED') continue;

    const btTechName = String(bt?.intervenant || '').trim().toLowerCase();
    const btTechId = String(bt?.technicien_matricule || '').trim().toLowerCase();
    const matches =
      (normName && btTechName === normName) ||
      (normId && btTechId === normId);
    if (!matches) continue;

    activeBtCount += 1;
    const estMins = Number(
      bt?.duree_prevue_mins ??
        bt?.temps_intervention_mins ??
        (bt?.priorite === 'HAUTE' || bt?.priorite === 'URGENTE' ? 120 : 90)
    );
    assignedCorrectiveMinutes += Math.max(15, Number.isFinite(estMins) ? estMins : 90);
  }

  let assignedPreventiveMinutes = 0;
  let duePreventiveCount = 0;

  for (const task of preventiveTasks || []) {
    const etat = String(task?.etat || '').trim().toLowerCase();
    if (etat === 'fait' || etat === 'en attente validation') continue;
    const resp = String(task?.responsable || task?.technicien || '').trim().toLowerCase();
    if (!resp || (resp !== normName && resp !== normId)) continue;

    duePreventiveCount += 1;
    const rawDur = Number(
      String(task?.duree_estimee_min ?? task?.duree_estimee ?? '45').replace(/[^\d.]/g, '')
    );
    assignedPreventiveMinutes += Math.max(15, Number.isFinite(rawDur) && rawDur > 0 ? rawDur : 45);
  }

  const totalAssignedMinutes = assignedCorrectiveMinutes + assignedPreventiveMinutes;
  const remainingMinutes = Math.max(0, capacityMinutes - totalAssignedMinutes);
  const utilizationRatePct = Math.round((totalAssignedMinutes / capacityMinutes) * 100);

  let loadStatus: TechnicianShiftWorkload['loadStatus'] = 'AVAILABLE';
  if (utilizationRatePct > 100) loadStatus = 'OVERLOADED';
  else if (utilizationRatePct >= 75) loadStatus = 'HIGH_LOAD';

  return {
    technicianId: techId || techName,
    technicianName: techName,
    zone,
    shift,
    capacityMinutes,
    assignedCorrectiveMinutes,
    assignedPreventiveMinutes,
    totalAssignedMinutes,
    remainingMinutes,
    utilizationRatePct,
    loadStatus,
    activeBtCount,
    duePreventiveCount,
  };
}

/**
 * Evaluates and ranks technicians for a given intervention based on:
 * 1. Valid (non-expired) safety & technical habilitations (`B2V`/`BR`/`BC`/`Hydraulique`/etc.)
 * 2. Shift workload capacity (`assignedMinutes + estimatedTaskMinutes <= capacityMinutes`)
 * 3. Geographical Zone match (`id_zone`)
 */
export function evaluateTechniciansForIntervention({
  intervention,
  technicians = [],
  activeInterventions = [],
  preventiveTasks = [],
  estimatedTaskMinutes = 90,
  referenceDate = new Date().toISOString().slice(0, 10),
}: {
  intervention: Partial<CorrectiveInterventionItem> | null | undefined;
  technicians: Array<ITechnician | Record<string, unknown>>;
  activeInterventions?: CorrectiveInterventionItem[];
  preventiveTasks?: PreventiveTaskItem[];
  estimatedTaskMinutes?: number;
  referenceDate?: string;
}): TechnicianSuitabilityEvaluation[] {
  const requiredHabs = inferRequiredHabilitations(intervention);
  const refTime = Date.parse(referenceDate.slice(0, 10));
  const targetZone = String(intervention?.zone || intervention?.id_zone || '')
    .trim()
    .toUpperCase();

  const evaluations: TechnicianSuitabilityEvaluation[] = [];

  for (const tech of technicians || []) {
    const rec = tech as Record<string, unknown>;
    if (rec.is_active === false || rec.actif === false) continue;

    const habs = extractTechnicianHabilitations(tech);
    const validSet = new Set<HabilitationCode>();
    const expiredSet = new Set<HabilitationCode>();

    for (const h of habs) {
      if (h.expiresAt) {
        const expMs = Date.parse(String(h.expiresAt).slice(0, 10));
        if (!Number.isNaN(expMs) && !Number.isNaN(refTime) && expMs < refTime) {
          expiredSet.add(h.code);
          continue;
        }
      }
      validSet.add(h.code);
      // Equivalence rules: B2V satisfies BR; BC satisfies LOTO_CONSIGNATION and vice versa
      if (h.code === 'B2V') validSet.add('BR');
      if (h.code === 'BC') validSet.add('LOTO_CONSIGNATION');
      if (h.code === 'LOTO_CONSIGNATION') validSet.add('BC');
    }

    const missingHabilitations: HabilitationCode[] = [];
    const expiredHabilitations: HabilitationCode[] = [];

    for (const req of requiredHabs) {
      if (validSet.has(req)) continue;
      if (expiredSet.has(req)) {
        expiredHabilitations.push(req);
      } else {
        missingHabilitations.push(req);
      }
    }

    const isHabilitationCompliant =
      missingHabilitations.length === 0 && expiredHabilitations.length === 0;

    const workload = computeTechnicianShiftWorkload({
      technician: tech,
      activeInterventions,
      preventiveTasks,
    });

    const projectedMinutes = workload.totalAssignedMinutes + Math.max(15, estimatedTaskMinutes);
    const projectedUtilizationPct = Math.round((projectedMinutes / workload.capacityMinutes) * 100);
    const wouldExceedShiftCapacity = projectedMinutes > workload.capacityMinutes;

    const zoneMatches =
      !targetZone ||
      workload.zone.toUpperCase() === 'TOUTES ZONES' ||
      workload.zone.toUpperCase() === targetZone;

    let score = 100;
    if (!isHabilitationCompliant) score -= 60;
    if (wouldExceedShiftCapacity) score -= 30;
    if (!zoneMatches) score -= 10;
    score -= Math.min(25, Math.round(workload.utilizationRatePct / 4));

    let recommendationLabelFr = `Conforme • Charge ${workload.utilizationRatePct}% (${workload.remainingMinutes} min dispo)`;
    if (!isHabilitationCompliant) {
      const missingStr = [...expiredHabilitations.map((c) => `${c} expirée`), ...missingHabilitations].join(', ');
      recommendationLabelFr = `Habilitation manquante/expirée (${missingStr})`;
    } else if (wouldExceedShiftCapacity) {
      recommendationLabelFr = `Surcharge poste (${projectedUtilizationPct}% > 100% capacité)`;
    }

    evaluations.push({
      technicianId: workload.technicianId,
      technicianName: workload.technicianName,
      specialite: String(rec.specialite || rec.role || 'Maintenance'),
      zone: workload.zone,
      shift: workload.shift,
      requiredHabilitations: requiredHabs,
      heldValidHabilitations: Array.from(validSet),
      missingHabilitations,
      expiredHabilitations,
      isHabilitationCompliant,
      workload,
      projectedUtilizationPct,
      wouldExceedShiftCapacity,
      score,
      recommendationLabelFr,
    });
  }

  evaluations.sort((a, b) => b.score - a.score);
  return evaluations;
}
