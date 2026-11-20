import { getMachineAssetClass, isArchivedMachine } from '../../utils/activeMachines';
import {
  computeMachineHealthPassport,
  type PassportCorrectiveInterventionInput,
  type PassportExternalSortieInput,
  type PassportPreventiveExecutionInput,
  type PassportStockItemInput,
} from './MachineHealthPassportService';

const CLOSED_BT_STATUSES = new Set([
  'CLOTURE',
  'CLÔTURÉ',
  'CLOTURÉ',
  'CLOSED',
  'TERMINE',
  'TERMINÉ',
  'ANNULE',
  'ANNULÉ',
  'RESOLVED',
]);

function norm(val: unknown): string {
  return String(val || '').trim().toUpperCase();
}

export function normalizeCanonicalEquipStatus(
  raw: unknown
): 'En Service' | 'En Maintenance' | "À l'Arrêt" {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return 'En Service';
  if (s.includes('maint')) return 'En Maintenance';
  if (
    s.includes('arrêt') ||
    s.includes('arret') ||
    s.includes('hors') ||
    s.includes('stop') ||
    s.includes('panne') ||
    s === 'inactive'
  ) {
    return "À l'Arrêt";
  }
  return 'En Service';
}

export interface ReconcileTechnicianReassignmentInput {
  sourceTechId: string;
  sourceTechName?: string;
  targetTechId: string;
  targetTechName?: string;
  machines?: Array<Record<string, any>>;
  correctiveInterventions?: Array<Record<string, any>>;
  preventiveTasks?: Array<Record<string, any>>;
  includeMachines?: boolean;
  includeOpenBts?: boolean;
  includeActivePm?: boolean;
}

export interface ReconcileTechnicianReassignmentResult {
  updatedMachines: Array<Record<string, any>>;
  updatedCorrectiveInterventions: Array<Record<string, any>>;
  updatedPreventiveTasks: Array<Record<string, any>>;
  reassignedMachinesCount: number;
  reassignedBtsCount: number;
  reassignedPmCount: number;
  totalReassigned: number;
}

/**
 * Pure domain reconciliation for transferring active shopfloor responsibilities
 * (active machines, open corrective BTs, and active preventive tasks) from one
 * technician to another. Historical closed BTs, archived machines, and suspended
 * PM tasks remain untouched to preserve audit history.
 */
export function reconcileTechnicianReassignment(
  input: ReconcileTechnicianReassignmentInput
): ReconcileTechnicianReassignmentResult {
  const sourceId = String(input.sourceTechId || '').trim();
  const targetId = String(input.targetTechId || '').trim();
  const sourceName = String(input.sourceTechName || '').trim();
  const targetName = String(input.targetTechName || '').trim() || targetId;

  const safeMachines = Array.isArray(input.machines) ? input.machines : [];
  const safeCorrective = Array.isArray(input.correctiveInterventions)
    ? input.correctiveInterventions
    : [];
  const safePm = Array.isArray(input.preventiveTasks) ? input.preventiveTasks : [];

  const sourceIdNorm = norm(sourceId);
  const sourceNameNorm = norm(sourceName);
  const targetIdNorm = norm(targetId);

  if (!sourceIdNorm || !targetIdNorm || sourceIdNorm === targetIdNorm) {
    return {
      updatedMachines: safeMachines,
      updatedCorrectiveInterventions: safeCorrective,
      updatedPreventiveTasks: safePm,
      reassignedMachinesCount: 0,
      reassignedBtsCount: 0,
      reassignedPmCount: 0,
      totalReassigned: 0,
    };
  }

  const matchesSource = (val: unknown) => {
    const v = norm(val);
    return Boolean(v && (v === sourceIdNorm || (sourceNameNorm && v === sourceNameNorm)));
  };

  const includeMachines = input.includeMachines !== false;
  const includeOpenBts = input.includeOpenBts !== false;
  const includeActivePm = input.includeActivePm !== false;

  let reassignedMachinesCount = 0;
  const updatedMachines = includeMachines
    ? safeMachines.map((m) => {
        if (isArchivedMachine(m)) return m;
        const fieldMatchesTech =
          matchesSource(m?.technician) ||
          matchesSource(m?.technicien) ||
          matchesSource(m?.technicien_responsable);
        if (!fieldMatchesTech) return m;
        reassignedMachinesCount += 1;
        return {
          ...m,
          ...(matchesSource(m?.technician) ? { technician: targetId } : {}),
          ...(matchesSource(m?.technicien) ? { technicien: targetId } : {}),
          ...(matchesSource(m?.technicien_responsable) ? { technicien_responsable: targetId } : {}),
        };
      })
    : safeMachines;

  let reassignedBtsCount = 0;
  const updatedCorrectiveInterventions = includeOpenBts
    ? safeCorrective.map((ci) => {
        const valSt = norm(ci?.validation_status);
        if (valSt === 'REJECTED') return ci;
        const st = norm(ci?.statut || ci?.status || 'OUVERTE');
        if (CLOSED_BT_STATUSES.has(st)) return ci;

        const matchInterv = matchesSource(ci?.intervenant);
        const matchTechId = matchesSource(ci?.id_technicien);
        const matchTech = matchesSource(ci?.technicien);
        if (!matchInterv && !matchTechId && !matchTech) return ci;

        reassignedBtsCount += 1;
        return {
          ...ci,
          ...(matchIdField(ci?.id_technicien, sourceIdNorm, sourceNameNorm)
            ? { id_technicien: targetId }
            : {}),
          ...(matchInterv ? { intervenant: norm(ci?.intervenant) === sourceIdNorm ? targetId : targetName } : {}),
          ...(matchTech ? { technicien: norm(ci?.technicien) === sourceIdNorm ? targetId : targetName } : {}),
        };
      })
    : safeCorrective;

  let reassignedPmCount = 0;
  const updatedPreventiveTasks = includeActivePm
    ? safePm.map((pt) => {
        if (pt?.is_active === false) return pt;
        const etat = norm(pt?.etat || pt?.statut);
        if (etat === 'SUSPENDUE' || etat === 'ARCHIVEE' || etat === 'ARCHIVE') return pt;

        const matchTechId = matchesSource(pt?.id_technicien);
        const matchTech = matchesSource(pt?.technicien);
        const matchResp = matchesSource(pt?.responsable);
        if (!matchTechId && !matchTech && !matchResp) return pt;

        reassignedPmCount += 1;
        return {
          ...pt,
          ...(matchTechId ? { id_technicien: targetId } : {}),
          ...(matchTech ? { technicien: norm(pt?.technicien) === sourceIdNorm ? targetId : targetName } : {}),
          ...(matchResp ? { responsable: norm(pt?.responsable) === sourceIdNorm ? targetId : targetName } : {}),
        };
      })
    : safePm;

  return {
    updatedMachines,
    updatedCorrectiveInterventions,
    updatedPreventiveTasks,
    reassignedMachinesCount,
    reassignedBtsCount,
    reassignedPmCount,
    totalReassigned: reassignedMachinesCount + reassignedBtsCount + reassignedPmCount,
  };
}

function matchIdField(val: unknown, sourceIdNorm: string, sourceNameNorm: string): boolean {
  const v = norm(val);
  return Boolean(v && (v === sourceIdNorm || (sourceNameNorm && v === sourceNameNorm)));
}

export type EquipmentCockpitFilter =
  | 'NONE'
  | 'STOPPED_OR_MAINT'
  | 'BAD_ACTORS'
  | 'MAINT_DUE'
  | 'INCOMPLETE_SETUP';

export interface EquipmentCockpitSignal {
  machineCode: string;
  isArchived: boolean;
  isStoppedOrMaint: boolean;
  hourlyDowntimeCost: number;
  healthScore: number;
  healthStatus: 'SAIN' | 'SURVEILLANCE' | 'CRITIQUE_BER';
  isBadActor: boolean;
  openBtCount: number;
  duePmCount: number;
  hasMaintDue: boolean;
  missingZone: boolean;
  missingTechnician: boolean;
  missingHourlyCost: boolean;
  isIncompleteSetup: boolean;
}

export interface EquipmentCockpitMetrics {
  activeCount: number;
  stoppedOrMaintCount: number;
  activeHourlyLossDh: number;
  badActorsCount: number;
  badActorsEconomicImpact12m: number;
  maintDueCount: number;
  totalOpenBtsCount: number;
  incompleteSetupCount: number;
  totalEconomicImpact12m: number;
  perEquipmentSignals: Record<string, EquipmentCockpitSignal>;
}

export function computeEquipmentCockpitMetrics(params: {
  machines?: Array<Record<string, any>>;
  correctiveInterventions?: Array<PassportCorrectiveInterventionInput & Record<string, any>>;
  preventiveTasks?: Array<Record<string, any>>;
  preventiveExecutions?: Array<PassportPreventiveExecutionInput & Record<string, any>>;
  sortiesExterne?: Array<PassportExternalSortieInput & Record<string, any>>;
  stockItems?: Array<PassportStockItemInput & Record<string, any>>;
  referenceDate?: Date;
}): EquipmentCockpitMetrics {
  const safeMachines = (params.machines || []).filter(
    (m) => getMachineAssetClass(m) === 'SYSTEM_GENERAL'
  );
  const safeCorrective = params.correctiveInterventions || [];
  const safePmTasks = params.preventiveTasks || [];
  const safePmExecs = params.preventiveExecutions || [];
  const safeSortiesExterne = params.sortiesExterne || [];
  const safeStockItems = params.stockItems || [];

  const btByMachine = new Map<string, Array<PassportCorrectiveInterventionInput & Record<string, any>>>();
  const openBtCountByMachine = new Map<string, number>();
  for (const ci of safeCorrective) {
    const code = norm(ci?.code_machine || ci?.id_machine_registered || ci?.id_machine || ci?.machine_id);
    if (!code) continue;
    const list = btByMachine.get(code) || [];
    list.push(ci);
    btByMachine.set(code, list);

    const valSt = norm(ci?.validation_status);
    const st = norm(ci?.statut || ci?.status || 'OUVERTE');
    if (valSt !== 'REJECTED' && !CLOSED_BT_STATUSES.has(st)) {
      openBtCountByMachine.set(code, (openBtCountByMachine.get(code) || 0) + 1);
    }
  }

  const execByMachine = new Map<string, Array<PassportPreventiveExecutionInput & Record<string, any>>>();
  for (const ex of safePmExecs) {
    const code = norm(ex?.machineCode || ex?.id_machine || ex?.code_machine);
    if (!code) continue;
    const list = execByMachine.get(code) || [];
    list.push(ex);
    execByMachine.set(code, list);
  }

  const extByMachine = new Map<string, Array<PassportExternalSortieInput & Record<string, any>>>();
  for (const se of safeSortiesExterne) {
    const code = norm(se?.id_machine || se?.code_machine || se?.machineCode);
    if (!code) continue;
    const list = extByMachine.get(code) || [];
    list.push(se);
    extByMachine.set(code, list);
  }

  const duePmCountByMachine = new Map<string, number>();
  for (const pt of safePmTasks) {
    if (pt?.is_active === false) continue;
    const etat = norm(pt?.etat || pt?.statut);
    if (etat === 'SUSPENDUE' || etat === 'ARCHIVEE' || etat === 'ARCHIVE') continue;
    if (etat === 'FAIT' || etat === 'EFFECTUE' || etat === 'EFFECTUÉ') continue;
    const code = norm(pt?.id_machine || pt?.code_machine || pt?.id_machine_registered);
    if (!code) continue;
    duePmCountByMachine.set(code, (duePmCountByMachine.get(code) || 0) + 1);
  }

  let activeCount = 0;
  let stoppedOrMaintCount = 0;
  let activeHourlyLossDh = 0;
  let badActorsCount = 0;
  let badActorsEconomicImpact12m = 0;
  let maintDueCount = 0;
  let totalOpenBtsCount = 0;
  let incompleteSetupCount = 0;
  let totalEconomicImpact12m = 0;
  const perEquipmentSignals: Record<string, EquipmentCockpitSignal> = {};

  for (const eq of safeMachines) {
    const code = norm(eq?.id_machine_registered || eq?.id || eq?.code);
    if (!code) continue;

    const archived = isArchivedMachine(eq);
    const passport = computeMachineHealthPassport({
      machine: eq,
      correctiveInterventions: btByMachine.get(code) || [],
      preventiveExecutions: execByMachine.get(code) || [],
      sortiesExterne: extByMachine.get(code) || [],
      stockItems: safeStockItems,
      referenceDate: params.referenceDate,
    });

    const canonicalStatus = normalizeCanonicalEquipStatus(eq?.status || eq?.statut);
    const isStoppedOrMaint = !archived && canonicalStatus !== 'En Service';
    const hourlyDowntimeCost = Math.max(0, Number(eq?.cout_arret_horaire || 0) || 0);
    const isBadActor =
      !archived && (passport.isEconomicBerExceeded || passport.healthStatus === 'CRITIQUE_BER');
    const openBtCount = openBtCountByMachine.get(code) || 0;
    const duePmCount = duePmCountByMachine.get(code) || 0;
    const hasMaintDue = !archived && (openBtCount > 0 || duePmCount > 0);
    const missingZone = !String(eq?.id_zone_default || eq?.id_zone || '').trim();
    const missingTechnician = !String(eq?.technician || '').trim();
    const missingHourlyCost = hourlyDowntimeCost <= 0;
    const isIncompleteSetup =
      !archived && (missingZone || missingTechnician || missingHourlyCost);

    perEquipmentSignals[code] = {
      machineCode: code,
      isArchived: archived,
      isStoppedOrMaint,
      hourlyDowntimeCost,
      healthScore: passport.healthScore,
      healthStatus: passport.healthStatus,
      isBadActor,
      openBtCount,
      duePmCount,
      hasMaintDue,
      missingZone,
      missingTechnician,
      missingHourlyCost,
      isIncompleteSetup,
    };

    if (archived) continue;

    activeCount += 1;
    totalEconomicImpact12m += passport.totalEconomicImpact12m;
    if (isStoppedOrMaint) {
      stoppedOrMaintCount += 1;
      activeHourlyLossDh += hourlyDowntimeCost;
    }
    if (isBadActor) {
      badActorsCount += 1;
      badActorsEconomicImpact12m += passport.totalEconomicImpact12m;
    }
    if (hasMaintDue) {
      maintDueCount += 1;
      totalOpenBtsCount += openBtCount;
    }
    if (isIncompleteSetup) {
      incompleteSetupCount += 1;
    }
  }

  return {
    activeCount,
    stoppedOrMaintCount,
    activeHourlyLossDh: Number(activeHourlyLossDh.toFixed(2)),
    badActorsCount,
    badActorsEconomicImpact12m: Number(badActorsEconomicImpact12m.toFixed(2)),
    maintDueCount,
    totalOpenBtsCount,
    incompleteSetupCount,
    totalEconomicImpact12m: Number(totalEconomicImpact12m.toFixed(2)),
    perEquipmentSignals,
  };
}

export interface EquipmentQuickEditDraft {
  status?: string;
  technician?: string;
  regime_travail?: '1x8' | '2x8' | '3x8' | string;
  cout_arret_horaire?: number | string;
}

export interface EquipmentQuickEditUpdateItem {
  id: string;
  updatedEquipment: Record<string, any>;
}

/**
 * Computes minimal update payloads for SYSTEM_GENERAL equipments modified
 * in inline Pilotage Terrain mode, ignoring archived items and untouched rows.
 */
export function buildQuickEditEquipmentUpdates(
  machines: Array<Record<string, any>>,
  drafts: Record<string, EquipmentQuickEditDraft>
): EquipmentQuickEditUpdateItem[] {
  const updates: EquipmentQuickEditUpdateItem[] = [];
  if (!Array.isArray(machines) || !drafts || typeof drafts !== 'object') {
    return updates;
  }

  for (const eq of machines) {
    if (getMachineAssetClass(eq) !== 'SYSTEM_GENERAL' || isArchivedMachine(eq)) continue;
    const id = String(eq?.id_machine_registered || eq?.id || eq?.code || '').trim();
    if (!id) continue;

    const draft = drafts[id];
    if (!draft) continue;

    const currentStatus = normalizeCanonicalEquipStatus(eq?.status || eq?.statut);
    const nextStatus =
      draft.status !== undefined
        ? normalizeCanonicalEquipStatus(draft.status)
        : currentStatus;

    const currentTech = String(eq?.technician || '').trim();
    const nextTech =
      draft.technician !== undefined ? String(draft.technician).trim() : currentTech;

    const currentRegime = String(eq?.regime_travail || '2x8').trim();
    const nextRegime =
      draft.regime_travail !== undefined ? String(draft.regime_travail).trim() : currentRegime;

    const currentCost = Math.max(0, Number(eq?.cout_arret_horaire || 0) || 0);
    const parsedCost =
      draft.cout_arret_horaire !== undefined && draft.cout_arret_horaire !== ''
        ? Math.max(0, Number(draft.cout_arret_horaire) || 0)
        : currentCost;

    const hasChange =
      nextStatus !== currentStatus ||
      nextTech !== currentTech ||
      nextRegime !== currentRegime ||
      parsedCost !== currentCost;

    if (!hasChange) continue;

    updates.push({
      id,
      updatedEquipment: {
        ...eq,
        status: nextStatus,
        statut: nextStatus,
        technician: nextTech,
        regime_travail: nextRegime,
        cout_arret_horaire: parsedCost,
      },
    });
  }

  return updates;
}
