import {
  getMachineAssetClass,
  isArchivedMachine,
} from '../../utils/activeMachines';
import {
  computeMachineHealthPassport,
  type PassportCorrectiveInterventionInput,
  type PassportExternalSortieInput,
  type PassportMachineInput,
  type PassportPreventiveExecutionInput,
  type PassportStockItemInput,
} from './MachineHealthPassportService';

export interface ZoneLike {
  id?: string | number;
  id_zone?: string;
  code_zone?: string;
  code?: string;
  libelle?: string;
  type?: string;
  description?: string;
}

export interface ZoneMemberLike {
  id?: string | number;
  id_technician?: string;
  id_operation?: string;
  nom?: string;
  name?: string;
  id_zone?: string;
  zones?: string[];
  type_profil?: string;
  is_active?: boolean;
  actif?: boolean;
  statut?: string;
}

export type ZoneOperationalStatus = 'CRITIQUE' | 'VIGILANCE' | 'NOMINAL';

export interface ZoneOperationalSummary {
  zoneKey: string;
  id_zone: string;
  code_zone: string;
  libelle: string;
  activeMachinesCount: number;
  activeProductionCount: number;
  activeSystemGeneralCount: number;
  archivedMachinesCount: number;
  stoppedMachinesCount: number;
  maintenanceMachinesCount: number;
  activeTechniciansCount: number;
  archivedTechniciansCount: number;
  activeResponsablesCount: number;
  activeOperatorsCount: number;
  archivedOperationsCount: number;
  warehouseItemsCount: number;
  openCorrectiveCount: number;
  pendingValidationCount: number;
  overduePreventiveCount: number;
  criticalBerMachinesCount: number;
  totalMaintenanceCost12m: number;
  downtimeHours12m: number;
  downtimeProductionLossCost12m: number;
  zoneStatus: ZoneOperationalStatus;
}

export interface ZoneOperationalReport {
  byZoneKey: Record<string, ZoneOperationalSummary>;
  summaries: ZoneOperationalSummary[];
  totals: {
    totalZones: number;
    alertZonesCount: number;
    criticalZonesCount: number;
    zonesWithoutActiveTechCount: number;
    activeMachinesCount: number;
    activeProductionCount: number;
    activeSystemGeneralCount: number;
    archivedMachinesCount: number;
    stoppedMachinesCount: number;
    activeTechniciansCount: number;
    activeResponsablesCount: number;
    activeOperatorsCount: number;
    openCorrectiveCount: number;
    overduePreventiveCount: number;
    totalMaintenanceCost12m: number;
    downtimeProductionLossCost12m: number;
  };
}

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

export function isArchivedPersonnel(person: ZoneMemberLike | null | undefined): boolean {
  if (!person) return false;
  const st = String(person.statut || '').trim().toUpperCase();
  return (
    person.is_active === false ||
    person.actif === false ||
    st === 'ARCHIVE' ||
    st === 'ARCHIVÉ' ||
    st === 'ARCHIVEE' ||
    st === 'ARCHIVED'
  );
}

export function getCanonicalZoneKey(zone: ZoneLike | null | undefined): string {
  return String(zone?.id_zone || zone?.code_zone || zone?.code || zone?.id || '')
    .trim()
    .toUpperCase();
}

export function matchesZoneRef(
  val: unknown,
  zone: ZoneLike | null | undefined,
  includeLibelle = false
): boolean {
  const v = String(val || '').trim().toUpperCase();
  if (!v || !zone) return false;
  const idZ = String(zone.id_zone || '').trim().toUpperCase();
  const codeZ = String(zone.code_zone || zone.code || '').trim().toUpperCase();
  const libZ = includeLibelle ? String(zone.libelle || '').trim().toUpperCase() : '';
  return Boolean((idZ && v === idZ) || (codeZ && v === codeZ) || (libZ && v === libZ));
}

export function matchesMemberZone(
  member: ZoneMemberLike | null | undefined,
  zone: ZoneLike | null | undefined,
  options?: { includeAll?: boolean }
): boolean {
  if (!member || !zone) return false;
  const includeAll = Boolean(options?.includeAll);
  const tokens: string[] = [];
  if (Array.isArray(member.zones)) {
    for (const z of member.zones) {
      const s = String(z || '').trim();
      if (s) tokens.push(s);
    }
  }
  if (member.id_zone) {
    for (const part of String(member.id_zone).split(',')) {
      const s = part.trim();
      if (s) tokens.push(s);
    }
  }
  return tokens.some((tok) => {
    if (includeAll && tok.toUpperCase() === 'ALL') return true;
    return matchesZoneRef(tok, zone, false);
  });
}

function isOpenCorrectiveIntervention(ci: PassportCorrectiveInterventionInput & { statut?: string; status?: string; validation_status?: string }): boolean {
  const valSt = String(ci?.validation_status || '').trim().toUpperCase();
  if (valSt === 'REJECTED') return false;
  const st = String(ci?.statut || ci?.status || 'OUVERTE').trim().toUpperCase();
  return !CLOSED_BT_STATUSES.has(st);
}

function isStoppedMachineStatus(machine: PassportMachineInput): boolean {
  const st = String(machine?.status || machine?.statut || 'En Service').trim().toUpperCase();
  return (
    st === "À L'ARRÊT" ||
    st === "A L'ARRÊT" ||
    st === "A L'ARRET" ||
    st === 'ARRÊT' ||
    st === 'ARRET' ||
    st === 'HORS SERVICE' ||
    st === 'HORS_SERVICE' ||
    st === 'STOPPED' ||
    machine?.is_active === false ||
    machine?.actif === false
  );
}

function isMaintenanceMachineStatus(machine: PassportMachineInput): boolean {
  const st = String(machine?.status || machine?.statut || '').trim().toUpperCase();
  return st === 'EN MAINTENANCE' || st === 'MAINTENANCE';
}

function extractTodayYmd(referenceDate?: Date): string {
  const d = referenceDate || new Date();
  return d.toISOString().slice(0, 10);
}

function extractPmTaskDueDateYmd(task: Record<string, any>): string {
  const raw = String(
    task?.prochaine_date ||
      task?.nextDueDate ||
      task?.next_due_date ||
      task?.date_prochaine ||
      ''
  ).trim();
  if (!raw) return '';
  return raw.slice(0, 10);
}

function isActivePreventiveTask(task: Record<string, any>): boolean {
  const etat = String(task?.etat || task?.statut || '').trim().toUpperCase();
  if (task?.is_active === false) return false;
  return etat !== 'SUSPENDUE' && etat !== 'ARCHIVEE' && etat !== 'ARCHIVE';
}

function isResponsableMember(op: ZoneMemberLike): boolean {
  const prof = String(op?.type_profil || '').trim().toUpperCase();
  const idOp = String(op?.id_operation || op?.id || '').trim().toUpperCase();
  return (
    prof === 'CHEF' ||
    prof === 'SUPERVISEUR' ||
    prof === 'RESPONSABLE' ||
    idOp.startsWith('RESP') ||
    idOp.startsWith('CHEF')
  );
}

export function computeZoneOperationalAnalytics(params: {
  zones: ZoneLike[];
  machines: PassportMachineInput[];
  technicians: ZoneMemberLike[];
  operations: ZoneMemberLike[];
  warehouseItems?: Array<Record<string, any>>;
  correctiveInterventions?: Array<PassportCorrectiveInterventionInput & Record<string, any>>;
  preventiveTasks?: Array<Record<string, any>>;
  preventiveExecutions?: Array<PassportPreventiveExecutionInput & Record<string, any>>;
  sortiesExterne?: Array<PassportExternalSortieInput & Record<string, any>>;
  stockItems?: PassportStockItemInput[];
  referenceDate?: Date;
}): ZoneOperationalReport {
  const safeZones = Array.isArray(params.zones) ? params.zones : [];
  const safeMachines = Array.isArray(params.machines) ? params.machines : [];
  const safeTechs = Array.isArray(params.technicians) ? params.technicians : [];
  const safeOps = Array.isArray(params.operations) ? params.operations : [];
  const safeWarehouse = Array.isArray(params.warehouseItems) ? params.warehouseItems : [];
  const safeCorrective = Array.isArray(params.correctiveInterventions)
    ? params.correctiveInterventions
    : [];
  const safePmTasks = Array.isArray(params.preventiveTasks) ? params.preventiveTasks : [];
  const safePmExecs = Array.isArray(params.preventiveExecutions)
    ? params.preventiveExecutions
    : [];
  const safeSortiesExterne = Array.isArray(params.sortiesExterne) ? params.sortiesExterne : [];
  const safeStockItems = Array.isArray(params.stockItems) ? params.stockItems : [];
  const todayYmd = extractTodayYmd(params.referenceDate);

  // Pre-index interventions, executions, and external sorties by machine code so per-machine Health Passport calls stay O(N)
  const btByMachine = new Map<string, Array<PassportCorrectiveInterventionInput & Record<string, any>>>();
  for (const ci of safeCorrective) {
    const code = String(
      ci?.code_machine || ci?.id_machine_registered || ci?.id_machine || ci?.machine_id || ''
    )
      .trim()
      .toUpperCase();
    if (!code) continue;
    const list = btByMachine.get(code) || [];
    list.push(ci);
    btByMachine.set(code, list);
  }

  const execByMachine = new Map<string, Array<PassportPreventiveExecutionInput & Record<string, any>>>();
  for (const ex of safePmExecs) {
    const code = String(ex?.machineCode || ex?.id_machine || ex?.code_machine || '')
      .trim()
      .toUpperCase();
    if (!code) continue;
    const list = execByMachine.get(code) || [];
    list.push(ex);
    execByMachine.set(code, list);
  }

  const extByMachine = new Map<string, Array<PassportExternalSortieInput & Record<string, any>>>();
  for (const se of safeSortiesExterne) {
    const code = String(se?.id_machine || se?.code_machine || se?.machineCode || '')
      .trim()
      .toUpperCase();
    if (!code) continue;
    const list = extByMachine.get(code) || [];
    list.push(se);
    extByMachine.set(code, list);
  }

  // Map machine code -> canonical zone match helper
  const activeMachineZoneByCode = new Map<string, string>();
  const passportByMachineCode = new Map<string, ReturnType<typeof computeMachineHealthPassport>>();
  for (const m of safeMachines) {
    const code = String(m?.id_machine_registered || m?.id || m?.code || m?.code_machine || '')
      .trim()
      .toUpperCase();
    if (!code || isArchivedMachine(m)) continue;
    const zVal = String(m?.id_zone_default || m?.id_zone || m?.zone || '').trim();
    if (zVal) activeMachineZoneByCode.set(code, zVal);
    passportByMachineCode.set(
      code,
      computeMachineHealthPassport({
        machine: m,
        correctiveInterventions: btByMachine.get(code) || [],
        preventiveExecutions: execByMachine.get(code) || [],
        sortiesExterne: extByMachine.get(code) || [],
        stockItems: safeStockItems,
        referenceDate: params.referenceDate,
      })
    );
  }

  const byZoneKey: Record<string, ZoneOperationalSummary> = {};
  const summaries: ZoneOperationalSummary[] = [];

  for (const z of safeZones) {
    const zoneKey = getCanonicalZoneKey(z);
    if (!zoneKey) continue;

    let activeMachinesCount = 0;
    let activeProductionCount = 0;
    let activeSystemGeneralCount = 0;
    let archivedMachinesCount = 0;
    let stoppedMachinesCount = 0;
    let maintenanceMachinesCount = 0;
    let criticalBerMachinesCount = 0;
    let totalMaintenanceCost12m = 0;
    let downtimeHours12m = 0;
    let downtimeProductionLossCost12m = 0;

    for (const m of safeMachines) {
      const mZone = m?.id_zone_default || m?.id_zone || m?.zone;
      if (!matchesZoneRef(mZone, z, true)) continue;
      if (isArchivedMachine(m)) {
        archivedMachinesCount += 1;
        continue;
      }
      activeMachinesCount += 1;
      const assetClass = getMachineAssetClass(m);
      if (assetClass === 'SYSTEM_GENERAL') {
        activeSystemGeneralCount += 1;
      } else {
        activeProductionCount += 1;
      }
      if (isStoppedMachineStatus(m)) {
        stoppedMachinesCount += 1;
      } else if (isMaintenanceMachineStatus(m)) {
        maintenanceMachinesCount += 1;
      }

      const code = String(m?.id_machine_registered || m?.id || m?.code || m?.code_machine || '')
        .trim()
        .toUpperCase();
      const passport = code ? passportByMachineCode.get(code) : undefined;
      if (passport) {
        totalMaintenanceCost12m += passport.totalMaintenanceCost12m;
        downtimeHours12m += passport.totalDowntimeHours12m;
        downtimeProductionLossCost12m += passport.downtimeProductionLossCost12m;
        if (passport.healthStatus === 'CRITIQUE_BER') {
          criticalBerMachinesCount += 1;
        }
      }
    }

    let activeTechniciansCount = 0;
    let archivedTechniciansCount = 0;
    for (const tech of safeTechs) {
      if (!matchesMemberZone(tech, z, { includeAll: false })) continue;
      if (isArchivedPersonnel(tech)) archivedTechniciansCount += 1;
      else activeTechniciansCount += 1;
    }

    let activeResponsablesCount = 0;
    let activeOperatorsCount = 0;
    let archivedOperationsCount = 0;
    for (const op of safeOps) {
      if (!matchesMemberZone(op, z, { includeAll: false })) continue;
      if (isArchivedPersonnel(op)) {
        archivedOperationsCount += 1;
      } else if (isResponsableMember(op)) {
        activeResponsablesCount += 1;
      } else {
        activeOperatorsCount += 1;
      }
    }

    const warehouseItemsCount = safeWarehouse.filter(
      (w) =>
        matchesZoneRef(w?.id_zone, z, true) ||
        matchesZoneRef(w?.id_zone_default, z, true)
    ).length;

    let openCorrectiveCount = 0;
    let pendingValidationCount = 0;
    for (const ci of safeCorrective) {
      const mCode = String(
        ci?.code_machine || ci?.id_machine_registered || ci?.id_machine || ci?.machine_id || ''
      )
        .trim()
        .toUpperCase();
      const ciZone = ci?.id_zone || ci?.zone || (mCode ? activeMachineZoneByCode.get(mCode) : '');
      if (!matchesZoneRef(ciZone, z, true)) continue;
      if (isOpenCorrectiveIntervention(ci)) {
        openCorrectiveCount += 1;
      }
      if (String(ci?.validation_status || '').trim().toUpperCase() === 'PENDING_VALIDATION') {
        pendingValidationCount += 1;
      }
    }

    let overduePreventiveCount = 0;
    for (const pt of safePmTasks) {
      if (!isActivePreventiveTask(pt)) continue;
      const mCode = String(
        pt?.id_machine || pt?.code_machine || pt?.machine_id || pt?.id_machine_registered || ''
      )
        .trim()
        .toUpperCase();
      const ptZone = pt?.id_zone || (mCode ? activeMachineZoneByCode.get(mCode) : '');
      if (!matchesZoneRef(ptZone, z, true)) continue;
      const dueYmd = extractPmTaskDueDateYmd(pt);
      if (dueYmd && dueYmd < todayYmd) {
        overduePreventiveCount += 1;
      }
    }

    const zoneStatus: ZoneOperationalStatus =
      stoppedMachinesCount > 0 ||
      criticalBerMachinesCount > 0 ||
      (openCorrectiveCount > 0 && activeTechniciansCount === 0)
        ? 'CRITIQUE'
        : openCorrectiveCount > 0 ||
          overduePreventiveCount > 0 ||
          maintenanceMachinesCount > 0 ||
          pendingValidationCount > 0 ||
          (activeMachinesCount > 0 && activeTechniciansCount === 0)
        ? 'VIGILANCE'
        : 'NOMINAL';

    const summary: ZoneOperationalSummary = {
      zoneKey,
      id_zone: String(z.id_zone || zoneKey).trim(),
      code_zone: String(z.code_zone || z.code || z.id_zone || zoneKey).trim(),
      libelle: String(z.libelle || z.id_zone || zoneKey).trim(),
      activeMachinesCount,
      activeProductionCount,
      activeSystemGeneralCount,
      archivedMachinesCount,
      stoppedMachinesCount,
      maintenanceMachinesCount,
      activeTechniciansCount,
      archivedTechniciansCount,
      activeResponsablesCount,
      activeOperatorsCount,
      archivedOperationsCount,
      warehouseItemsCount,
      openCorrectiveCount,
      pendingValidationCount,
      overduePreventiveCount,
      criticalBerMachinesCount,
      totalMaintenanceCost12m: Number(totalMaintenanceCost12m.toFixed(2)),
      downtimeHours12m: Number(downtimeHours12m.toFixed(1)),
      downtimeProductionLossCost12m: Number(downtimeProductionLossCost12m.toFixed(2)),
      zoneStatus,
    };

    byZoneKey[zoneKey] = summary;
    const altCode = String(z.code_zone || z.code || '').trim().toUpperCase();
    if (altCode && !byZoneKey[altCode]) {
      byZoneKey[altCode] = summary;
    }
    summaries.push(summary);
  }

  // Factory-wide totals computed directly from canonical active records so multi-zone/unassigned items aren't double-counted
  const activeMachines = safeMachines.filter((m) => !isArchivedMachine(m));
  const archivedMachinesCount = safeMachines.length - activeMachines.length;
  const activeProductionCount = activeMachines.filter(
    (m) => getMachineAssetClass(m) === 'PRODUCTION'
  ).length;
  const activeSystemGeneralCount = activeMachines.length - activeProductionCount;
  const stoppedMachinesCount = activeMachines.filter((m) => isStoppedMachineStatus(m)).length;

  const activeTechs = safeTechs.filter((t) => !isArchivedPersonnel(t));
  const activeOps = safeOps.filter((o) => !isArchivedPersonnel(o));
  const activeResponsablesCount = activeOps.filter((o) => isResponsableMember(o)).length;
  const activeOperatorsCount = activeOps.length - activeResponsablesCount;

  const openCorrectiveCount = safeCorrective.filter((ci) => isOpenCorrectiveIntervention(ci)).length;
  const overduePreventiveCount = safePmTasks.filter((pt) => {
    if (!isActivePreventiveTask(pt)) return false;
    const dueYmd = extractPmTaskDueDateYmd(pt);
    return Boolean(dueYmd && dueYmd < todayYmd);
  }).length;

  let totalMaintenanceCost12m = 0;
  let downtimeProductionLossCost12m = 0;
  for (const passport of passportByMachineCode.values()) {
    totalMaintenanceCost12m += passport.totalMaintenanceCost12m;
    downtimeProductionLossCost12m += passport.downtimeProductionLossCost12m;
  }

  return {
    byZoneKey,
    summaries,
    totals: {
      totalZones: safeZones.length,
      alertZonesCount: summaries.filter((s) => s.zoneStatus !== 'NOMINAL').length,
      criticalZonesCount: summaries.filter((s) => s.zoneStatus === 'CRITIQUE').length,
      zonesWithoutActiveTechCount: summaries.filter(
        (s) => s.activeMachinesCount > 0 && s.activeTechniciansCount === 0
      ).length,
      activeMachinesCount: activeMachines.length,
      activeProductionCount,
      activeSystemGeneralCount,
      archivedMachinesCount,
      stoppedMachinesCount,
      activeTechniciansCount: activeTechs.length,
      activeResponsablesCount,
      activeOperatorsCount,
      openCorrectiveCount,
      overduePreventiveCount,
      totalMaintenanceCost12m: Number(totalMaintenanceCost12m.toFixed(2)),
      downtimeProductionLossCost12m: Number(downtimeProductionLossCost12m.toFixed(2)),
    },
  };
}
