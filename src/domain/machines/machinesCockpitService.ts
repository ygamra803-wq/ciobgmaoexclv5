import {
  computeMachineHealthPassport,
  type PassportCorrectiveInterventionInput,
  type PassportExternalSortieInput,
  type PassportPreventiveExecutionInput,
  type PassportStockItemInput,
} from '../../application/services/MachineHealthPassportService';
import { getMachineAssetClass, isArchivedMachine } from '../../utils/activeMachines';

export type MachinesCockpitFilter =
  | 'NONE'
  | 'STOPPED_OR_MAINT'
  | 'BAD_ACTORS'
  | 'MAINT_DUE'
  | 'INCOMPLETE_SETUP';

export interface MachineCockpitRowSignals {
  machineCode: string;
  isArchived: boolean;
  isStoppedOrMaint: boolean;
  hourlyDowntimeCost: number;
  healthScore: number;
  healthStatus: 'SAIN' | 'SURVEILLANCE' | 'CRITIQUE_BER';
  isEconomicBerExceeded: boolean;
  berRatioPercent: number | null;
  totalEconomicImpact12m: number;
  isBadActor: boolean;
  openBtCount: number;
  duePmCount: number;
  hasMaintDue: boolean;
  missingZone: boolean;
  missingTechnician: boolean;
  missingHourlyCost: boolean;
  isIncompleteSetup: boolean;
}

export interface MachinesCockpitMetrics {
  activeMachinesCount: number;
  stoppedMachinesCount: number;
  activeHourlyLossDh: number;
  badActorsCount: number;
  badActorsEconomicImpact12m: number;
  maintDueMachinesCount: number;
  totalOpenBtsCount: number;
  incompleteSetupCount: number;
  totalEconomicImpact12m: number;
  perMachineSignals: Record<string, MachineCockpitRowSignals>;
}

export interface ComputeMachinesCockpitInput {
  machines?: Array<Record<string, any>>;
  correctiveInterventions?: Array<PassportCorrectiveInterventionInput & Record<string, any>>;
  preventiveTasks?: Array<Record<string, any>>;
  preventiveExecutions?: Array<PassportPreventiveExecutionInput & Record<string, any>>;
  sortiesExterne?: Array<PassportExternalSortieInput & Record<string, any>>;
  stockItems?: Array<PassportStockItemInput & Record<string, any>>;
  referenceDate?: Date;
}

function normalizeCode(raw: unknown): string {
  return String(raw || '').trim().toUpperCase();
}

export function computeMachinesCockpitMetrics({
  machines = [],
  correctiveInterventions = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  sortiesExterne = [],
  stockItems = [],
  referenceDate,
}: ComputeMachinesCockpitInput): MachinesCockpitMetrics {
  const openBtCountByMachine = new Map<string, number>();
  for (const ci of correctiveInterventions || []) {
    const code = normalizeCode(ci?.code_machine || ci?.id_machine_registered || ci?.id_machine);
    if (!code) continue;
    const st = String(ci?.statut || ci?.status || '').trim().toUpperCase();
    const isClosedOrCancelled =
      st === 'CLOTURE' ||
      st === 'TERMINEE' ||
      st === 'ANNULE' ||
      String(ci?.action_fermee || '').trim().toUpperCase() === 'OUI';
    if (!isClosedOrCancelled) {
      openBtCountByMachine.set(code, (openBtCountByMachine.get(code) || 0) + 1);
    }
  }

  const duePmCountByMachine = new Map<string, number>();
  for (const task of preventiveTasks || []) {
    const code = normalizeCode(task?.id_machine || task?.code_machine || task?.machineCode);
    if (!code) continue;
    const taskStatus = String(task?.statut || task?.status || '').trim().toUpperCase();
    if (taskStatus === 'SUSPENDUE' || task?.active === false) continue;
    const etat = String(task?.etat || '').trim().toLowerCase();
    const isDone = etat === 'fait' || etat === 'effectué' || etat === 'effectue';
    if (!isDone) {
      duePmCountByMachine.set(code, (duePmCountByMachine.get(code) || 0) + 1);
    }
  }

  let activeMachinesCount = 0;
  let stoppedMachinesCount = 0;
  let activeHourlyLossDh = 0;
  let badActorsCount = 0;
  let badActorsEconomicImpact12m = 0;
  let maintDueMachinesCount = 0;
  let totalOpenBtsCount = 0;
  let incompleteSetupCount = 0;
  let totalEconomicImpact12m = 0;

  const perMachineSignals: Record<string, MachineCockpitRowSignals> = {};

  for (const machine of machines || []) {
    const machineCode = normalizeCode(
      machine?.id_machine_registered || machine?.id || machine?.code
    );
    if (!machineCode) continue;

    const archived = isArchivedMachine(machine);
    const passport = computeMachineHealthPassport({
      machine,
      correctiveInterventions,
      preventiveExecutions,
      sortiesExterne,
      stockItems,
      referenceDate,
    });

    const rawStatus = String(machine?.status || machine?.statut || 'En Service').trim().toLowerCase();
    const isStoppedOrMaint = !archived && !rawStatus.includes('service');
    const hourlyDowntimeCost = Math.max(0, Number(machine?.cout_arret_horaire || 0) || 0);
    const isBadActor =
      !archived && (passport.isEconomicBerExceeded || passport.healthStatus === 'CRITIQUE_BER');

    const openBtCount = openBtCountByMachine.get(machineCode) || 0;
    const duePmCount = duePmCountByMachine.get(machineCode) || 0;
    const hasMaintDue = !archived && (openBtCount > 0 || duePmCount > 0);

    const missingZone = !String(machine?.id_zone_default || machine?.id_zone || machine?.zone || '').trim();
    const missingTechnician = !String(machine?.technician || '').trim();
    const isProduction = getMachineAssetClass(machine) === 'PRODUCTION';
    const missingHourlyCost = isProduction && hourlyDowntimeCost <= 0;
    const isIncompleteSetup =
      !archived && (missingZone || missingTechnician || missingHourlyCost);

    perMachineSignals[machineCode] = {
      machineCode,
      isArchived: archived,
      isStoppedOrMaint,
      hourlyDowntimeCost,
      healthScore: passport.healthScore,
      healthStatus: passport.healthStatus,
      isEconomicBerExceeded: passport.isEconomicBerExceeded,
      berRatioPercent: passport.berRatioPercent,
      totalEconomicImpact12m: passport.totalEconomicImpact12m,
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

    activeMachinesCount += 1;
    totalEconomicImpact12m += passport.totalEconomicImpact12m;

    if (isStoppedOrMaint) {
      stoppedMachinesCount += 1;
      activeHourlyLossDh += hourlyDowntimeCost;
    }

    if (isBadActor) {
      badActorsCount += 1;
      badActorsEconomicImpact12m += passport.totalEconomicImpact12m;
    }

    if (hasMaintDue) {
      maintDueMachinesCount += 1;
      totalOpenBtsCount += openBtCount;
    }

    if (isIncompleteSetup) {
      incompleteSetupCount += 1;
    }
  }

  return {
    activeMachinesCount,
    stoppedMachinesCount,
    activeHourlyLossDh: Number(activeHourlyLossDh.toFixed(2)),
    badActorsCount,
    badActorsEconomicImpact12m: Number(badActorsEconomicImpact12m.toFixed(2)),
    maintDueMachinesCount,
    totalOpenBtsCount,
    incompleteSetupCount,
    totalEconomicImpact12m: Number(totalEconomicImpact12m.toFixed(2)),
    perMachineSignals,
  };
}

export interface MachineQuickEditDraft {
  status?: string;
  technician?: string;
  regime_travail?: '1x8' | '2x8' | '3x8' | string;
  cout_arret_horaire?: number | string;
}

export interface MachineQuickEditUpdateItem {
  id: string;
  updatedMachine: Record<string, any>;
}

/**
 * Computes normalized machine update payloads from inline quick-edit drafts.
 * Ignores archived machines and untouched rows so AUDIT_EVENTS and lifecycle transitions
 * only execute for actual changes.
 */
export function buildQuickEditMachineUpdates(
  machines: Array<Record<string, any>>,
  drafts: Record<string, MachineQuickEditDraft>
): MachineQuickEditUpdateItem[] {
  const updates: MachineQuickEditUpdateItem[] = [];
  if (!Array.isArray(machines) || !drafts || typeof drafts !== 'object') {
    return updates;
  }

  for (const machine of machines) {
    if (isArchivedMachine(machine)) continue;
    const id = String(
      machine?.id_machine_registered || machine?.id || machine?.code || ''
    ).trim();
    if (!id) continue;

    const draft = drafts[id];
    if (!draft) continue;

    const currentStatus = String(machine?.status || machine?.statut || 'En Service').trim();
    const nextStatus =
      draft.status !== undefined ? String(draft.status).trim() : currentStatus;

    const currentTech = String(machine?.technician || '').trim();
    const nextTech =
      draft.technician !== undefined ? String(draft.technician).trim() : currentTech;

    const currentRegime = String(machine?.regime_travail || '2x8').trim();
    const nextRegime =
      draft.regime_travail !== undefined ? String(draft.regime_travail).trim() : currentRegime;

    const currentCost = Math.max(0, Number(machine?.cout_arret_horaire || 0) || 0);
    const parsedDraftCost =
      draft.cout_arret_horaire !== undefined && draft.cout_arret_horaire !== ''
        ? Math.max(0, Number(draft.cout_arret_horaire) || 0)
        : currentCost;

    const hasChange =
      nextStatus !== currentStatus ||
      nextTech !== currentTech ||
      nextRegime !== currentRegime ||
      parsedDraftCost !== currentCost;

    if (!hasChange) continue;

    updates.push({
      id,
      updatedMachine: {
        ...machine,
        status: nextStatus,
        statut: nextStatus,
        technician: nextTech,
        regime_travail: nextRegime,
        cout_arret_horaire: parsedDraftCost,
      },
    });
  }

  return updates;
}
