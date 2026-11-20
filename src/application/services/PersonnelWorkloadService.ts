import { isArchivedMachine } from '../../utils/activeMachines';
import { isArchivedPersonnel, type ZoneMemberLike } from './ZoneOperationalAnalyticsService';

export type PersonnelWorkloadLevel = 'SURCHARGE' | 'ACTIF' | 'DISPONIBLE' | 'ARCHIVE';

export interface PersonnelWorkloadMetrics {
  personId: string;
  nom: string;
  isArchived: boolean;
  assignedMachinesCount: number;
  assignedMachineCodes: string[];
  openCorrectiveCount: number;
  activePreventiveTasksCount: number;
  completedExecutions30dCount: number;
  activeExternalSortiesCount: number;
  hasAccount: boolean;
  isAccessActive: boolean;
  hasPassword: boolean;
  missingPasswordWarning: boolean;
  totalActiveWorkload: number;
  workloadLevel: PersonnelWorkloadLevel;
}

export interface PersonnelWorkloadReport {
  byPersonId: Record<string, PersonnelWorkloadMetrics>;
  summary: {
    totalMembers: number;
    totalActive: number;
    archivedCount: number;
    activeTechsCount: number;
    unassignedActiveTechsCount: number;
    activeAccessCount: number;
    disabledAccessCount: number;
    missingPasswordCount: number;
  };
}

export interface AuthAccountSummaryLike {
  personnelId?: string;
  id?: string;
  username?: string;
  role?: string;
  isActive?: boolean;
  hasPassword?: boolean;
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

function normalizeToken(v: unknown): string {
  return String(v || '').trim().toUpperCase();
}

function parseDateSafe(val: unknown): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computePersonnelWorkload(params: {
  technicians: ZoneMemberLike[];
  operations: ZoneMemberLike[];
  machines?: Array<Record<string, any>>;
  correctiveInterventions?: Array<Record<string, any>>;
  preventiveTasks?: Array<Record<string, any>>;
  preventiveExecutions?: Array<Record<string, any>>;
  sortiesExterne?: Array<Record<string, any>>;
  authAccounts?: AuthAccountSummaryLike[];
  referenceDate?: Date;
}): PersonnelWorkloadReport {
  const safeTechs = Array.isArray(params.technicians) ? params.technicians : [];
  const safeOps = Array.isArray(params.operations) ? params.operations : [];
  const safeMachines = Array.isArray(params.machines) ? params.machines : [];
  const safeCorrective = Array.isArray(params.correctiveInterventions)
    ? params.correctiveInterventions
    : [];
  const safePmTasks = Array.isArray(params.preventiveTasks) ? params.preventiveTasks : [];
  const safePmExecs = Array.isArray(params.preventiveExecutions)
    ? params.preventiveExecutions
    : [];
  const safeSortiesExterne = Array.isArray(params.sortiesExterne) ? params.sortiesExterne : [];
  const safeAuthAccounts = Array.isArray(params.authAccounts) ? params.authAccounts : [];

  const refDate = params.referenceDate || new Date();
  const cutoff30d = new Date(refDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const accountByPersonnelId = new Map<string, AuthAccountSummaryLike>();
  for (const acc of safeAuthAccounts) {
    const pid = normalizeToken(acc?.personnelId || acc?.id);
    if (pid) accountByPersonnelId.set(pid, acc);
  }

  const activeMachines = safeMachines.filter((m) => !isArchivedMachine(m));
  const openCorrective = safeCorrective.filter((ci) => {
    const valSt = normalizeToken(ci?.validation_status);
    if (valSt === 'REJECTED') return false;
    const st = normalizeToken(ci?.statut || ci?.status || 'OUVERTE');
    return !CLOSED_BT_STATUSES.has(st);
  });
  const activePmTasks = safePmTasks.filter((pt) => {
    if (pt?.is_active === false) return false;
    const etat = normalizeToken(pt?.etat || pt?.statut);
    return etat !== 'SUSPENDUE' && etat !== 'ARCHIVEE' && etat !== 'ARCHIVE';
  });
  const approvedExecs30d = safePmExecs.filter((ex) => {
    const valSt = normalizeToken(ex?.validation_status);
    if (valSt === 'REJECTED' || valSt === 'PENDING_VALIDATION') return false;
    const d = parseDateSafe(ex?.executedAt || ex?.date_realisation || ex?.created_at);
    return !d || d >= cutoff30d;
  });
  const activeExternalSorties = safeSortiesExterne.filter((se) => {
    const st = normalizeToken(se?.statut || se?.status || se?.etat);
    return st !== 'MONTE' && st !== 'MONTÉ' && st !== 'RETOURNE' && st !== 'CLOTURE' && st !== 'CLÔTURÉ';
  });

  const combinedPeople: Array<{ id: string; nom: string; isTech: boolean; isArchived: boolean }> = [];
  for (const t of safeTechs) {
    const id = String(t.id_technician || t.id || '').trim();
    if (!id) continue;
    combinedPeople.push({
      id,
      nom: String(t.nom || t.name || id).trim(),
      isTech: true,
      isArchived: isArchivedPersonnel(t),
    });
  }
  for (const o of safeOps) {
    const id = String(o.id_operation || o.id || '').trim();
    if (!id) continue;
    combinedPeople.push({
      id,
      nom: String(o.nom || o.name || id).trim(),
      isTech: false,
      isArchived: isArchivedPersonnel(o),
    });
  }

  const byPersonId: Record<string, PersonnelWorkloadMetrics> = {};
  let totalActive = 0;
  let archivedCount = 0;
  let activeTechsCount = 0;
  let unassignedActiveTechsCount = 0;
  let activeAccessCount = 0;
  let disabledAccessCount = 0;
  let missingPasswordCount = 0;

  for (const person of combinedPeople) {
    const idNorm = normalizeToken(person.id);
    const nomNorm = normalizeToken(person.nom);
    const matchesPerson = (val: unknown) => {
      const v = normalizeToken(val);
      return Boolean(v && (v === idNorm || (nomNorm && v === nomNorm)));
    };

    const assignedMachineCodes = activeMachines
      .filter((m) => matchesPerson(m?.technician || m?.technicien || m?.technicien_responsable))
      .map((m) => String(m?.id_machine_registered || m?.id || m?.code || '').trim())
      .filter(Boolean);

    const openCorrectiveCount = openCorrective.filter(
      (ci) =>
        matchesPerson(ci?.intervenant) ||
        matchesPerson(ci?.id_technicien) ||
        matchesPerson(ci?.submitted_by_id) ||
        matchesPerson(ci?.submitted_by_name) ||
        matchesPerson(ci?.demandeur)
    ).length;

    const activePreventiveTasksCount = activePmTasks.filter(
      (pt) =>
        matchesPerson(pt?.responsable) ||
        matchesPerson(pt?.technicien) ||
        matchesPerson(pt?.id_technicien)
    ).length;

    const completedExecutions30dCount = approvedExecs30d.filter(
      (ex) =>
        matchesPerson(ex?.executorName) ||
        matchesPerson(ex?.technicien) ||
        matchesPerson(ex?.id_technicien)
    ).length;

    const activeExternalSortiesCount = activeExternalSorties.filter(
      (se) => matchesPerson(se?.technicien_demontage) || matchesPerson(se?.technicien_montage)
    ).length;

    const acc = accountByPersonnelId.get(idNorm);
    const hasAccount = Boolean(acc);
    const isAccessActive = Boolean(acc && acc.isActive !== false);
    const hasPassword = Boolean(acc && acc.hasPassword !== false);
    const missingPasswordWarning = Boolean(acc && isAccessActive && acc.hasPassword === false);

    if (person.isArchived) {
      archivedCount += 1;
    } else {
      totalActive += 1;
      if (person.isTech) {
        activeTechsCount += 1;
        if (
          assignedMachineCodes.length === 0 &&
          openCorrectiveCount === 0 &&
          activePreventiveTasksCount === 0
        ) {
          unassignedActiveTechsCount += 1;
        }
      }
      if (hasAccount) {
        if (isAccessActive) activeAccessCount += 1;
        else disabledAccessCount += 1;
      }
      if (missingPasswordWarning) missingPasswordCount += 1;
    }

    const totalActiveWorkload =
      assignedMachineCodes.length + openCorrectiveCount + activePreventiveTasksCount;
    const workloadLevel: PersonnelWorkloadLevel = person.isArchived
      ? 'ARCHIVE'
      : openCorrectiveCount >= 3 || totalActiveWorkload >= 8
      ? 'SURCHARGE'
      : totalActiveWorkload > 0
      ? 'ACTIF'
      : 'DISPONIBLE';

    byPersonId[person.id] = {
      personId: person.id,
      nom: person.nom,
      isArchived: person.isArchived,
      assignedMachinesCount: assignedMachineCodes.length,
      assignedMachineCodes,
      openCorrectiveCount,
      activePreventiveTasksCount,
      completedExecutions30dCount,
      activeExternalSortiesCount,
      hasAccount,
      isAccessActive,
      hasPassword,
      missingPasswordWarning,
      totalActiveWorkload,
      workloadLevel,
    };
  }

  return {
    byPersonId,
    summary: {
      totalMembers: combinedPeople.length,
      totalActive,
      archivedCount,
      activeTechsCount,
      unassignedActiveTechsCount,
      activeAccessCount,
      disabledAccessCount,
      missingPasswordCount,
    },
  };
}
