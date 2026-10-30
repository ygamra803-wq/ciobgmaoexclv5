export type MachineLifecycleState = 'ACTIVE' | 'STOPPED' | 'ARCHIVED';

export interface MachineLifecycleEvent {
  id: string;
  event_type: 'ARCHIVED' | 'REACTIVATED' | 'STATUS_CHANGED';
  from_status: string;
  to_status: string;
  lifecycle_state: MachineLifecycleState;
  timestamp: string;
  actor?: string;
  reason?: string;
  suspended_tasks_count?: number;
  restored_tasks_count?: number;
}

/**
 * Returns true ONLY when a machine record is explicitly in the ARCHIVED lifecycle state
 * (status/statut ARCHIVEE|ARCHIVED or archived===true / explicit archive timestamp).
 * Note: is_active === false alone does NOT make a machine ARCHIVED (it may be STOPPED/INACTIVE).
 */
export function isArchivedMachine(machine: any): boolean {
  if (!machine) return false;
  const statusNorm = String(machine.status || machine.statut || '').trim().toUpperCase();
  const lifecycleNorm = String(machine.lifecycle_state || '').trim().toUpperCase();
  if (
    statusNorm === 'ARCHIVEE' ||
    statusNorm === 'ARCHIVÉE' ||
    statusNorm === 'ARCHIVED' ||
    statusNorm === 'ARCHIVE' ||
    lifecycleNorm === 'ARCHIVED' ||
    machine.archived === true ||
    machine.isArchived === true
  ) {
    return true;
  }
  return false;
}

/**
 * Returns the explicit canonical lifecycle state of a machine:
 * - 'ARCHIVED': Soft-archived asset (status 'ARCHIVEE' | 'ARCHIVED' or archived === true).
 * - 'STOPPED': Stopped / inactive operational state ('Arrêt', 'HORS_SERVICE', 'INACTIVE', or is_active === false when not archived).
 * - 'ACTIVE': Operational state ('En Service', 'En Maintenance', 'En Panne').
 */
export function getMachineLifecycleState(machine: any): MachineLifecycleState {
  if (!machine) return 'ARCHIVED';
  if (isArchivedMachine(machine)) return 'ARCHIVED';
  const statusNorm = String(machine.status || machine.statut || 'En Service')
    .trim()
    .toUpperCase();
  if (
    statusNorm === 'ARRÊT' ||
    statusNorm === 'ARRET' ||
    statusNorm === "À L'ARRÊT" ||
    statusNorm === 'HORS_SERVICE' ||
    statusNorm === 'HORS SERVICE' ||
    statusNorm === 'INACTIVE' ||
    statusNorm === 'INACTIF' ||
    statusNorm === 'STOPPED' ||
    machine.is_active === false ||
    machine.actif === false
  ) {
    return 'STOPPED';
  }
  return 'ACTIVE';
}

/**
 * Machines eligible for NEW links (create forms, bulk relink targets).
 * Archived or explicitly deactivated (is_active === false) machines must never appear in selectors.
 */
export function filterActiveMachines(machines: any[] = []) {
  return (machines || []).filter((m) => {
    if (!m || isArchivedMachine(m)) return false;
    if (m.is_active === false || m.actif === false) return false;
    return Boolean(m.id_machine_registered || m.id || m.code || m.id_machine || m.code_machine);
  });
}

export function getActiveMachineCodes(machines: any[] = []) {
  return filterActiveMachines(machines).map((m) =>
    String(m.id_machine_registered || m.id || m.code || m.id_machine || m.code_machine).trim()
  );
}

/**
 * Pure lifecycle transition helper for a machine and its linked preventive tasks.
 * Guarantees:
 * 1) Transitioning to ARCHIVED ('ARCHIVEE') sets soft-archive flags, suspends active PM tasks, and logs a lifecycle event.
 * 2) Transitioning from ARCHIVED to ACTIVE/STOPPED (Reactivation) clears archive flags, restores PM tasks suspended with the machine, and logs a lifecycle event.
 * 3) Transitioning between ACTIVE and STOPPED updates status_changed_at and logs a lifecycle event.
 */
export function transitionMachineLifecycle({
  machine,
  targetStatus,
  preventiveTasks = [],
  timestamp,
  actor,
  reason,
}: {
  machine: any;
  targetStatus?: string;
  preventiveTasks?: any[];
  timestamp?: string;
  actor?: string;
  reason?: string;
}) {
  const nowIso = timestamp || new Date().toISOString();
  const prevStatus = String(machine?.status || machine?.statut || 'En Service').trim();
  const wasArchived = isArchivedMachine(machine);

  const requestedStatusRaw = String(
    targetStatus !== undefined ? targetStatus : machine?.status || machine?.statut || 'En Service'
  ).trim();
  const reqUpper = requestedStatusRaw.toUpperCase();
  const targetIsArchive =
    reqUpper === 'ARCHIVEE' ||
    reqUpper === 'ARCHIVÉE' ||
    reqUpper === 'ARCHIVED' ||
    reqUpper === 'ARCHIVE';

  const machineCodeNorm = String(
    machine?.id_machine_registered || machine?.id || machine?.code || machine?.id_machine || ''
  )
    .trim()
    .toUpperCase();

  const existingEvents: MachineLifecycleEvent[] = Array.isArray(machine?.lifecycle_events)
    ? [...machine.lifecycle_events]
    : [];

  let suspendedTasksCount = 0;
  let restoredTasksCount = 0;
  let lifecycleEvent: MachineLifecycleEvent | null = null;
  let updatedMachine = { ...machine };

  if (targetIsArchive) {
    updatedMachine = {
      ...machine,
      status: 'ARCHIVEE',
      statut: 'Archivée',
      lifecycle_state: 'ARCHIVED' as MachineLifecycleState,
      is_active: false,
      actif: false,
      archived: true,
      date_archivage: nowIso,
      archived_at: nowIso,
      status_changed_at: nowIso,
      ...(actor ? { archived_by: actor, updated_by: actor } : {}),
    };
  } else {
    const cleanNextStatus = requestedStatusRaw || 'En Service';
    const nextLifecycle = getMachineLifecycleState({
      status: cleanNextStatus,
      is_active: true,
      archived: false,
    });
    const nextIsActive =
      nextLifecycle === 'ACTIVE' || wasArchived
        ? true
        : machine?.is_active !== undefined
        ? Boolean(machine.is_active)
        : true;
    updatedMachine = {
      ...machine,
      status: cleanNextStatus,
      statut: cleanNextStatus,
      lifecycle_state: nextLifecycle,
      is_active: nextIsActive,
      actif: nextIsActive,
      archived: false,
      status_changed_at: nowIso,
      ...(wasArchived ? { reactivated_at: nowIso } : {}),
      ...(actor ? { updated_by: actor } : {}),
    };
  }

  const updatedPreventiveTasks = (preventiveTasks || []).map((t) => {
    if (!t) return t;
    const tMach = String(
      t.id_machine || t.code_machine || t.machineCode || t.machine_id || t.id_machine_registered || ''
    )
      .trim()
      .toUpperCase();
    if (!machineCodeNorm || tMach !== machineCodeNorm) return t;

    if (targetIsArchive) {
      suspendedTasksCount++;
      return {
        ...t,
        is_active: false,
        active: false,
        statut: 'ARCHIVEE',
        etat: 'Suspendu (Machine archivée)',
        archived_with_machine: true,
        date_archivage: nowIso,
      };
    }

    if (
      wasArchived &&
      (t.archived_with_machine === true ||
        String(t.statut || '').trim().toUpperCase() === 'ARCHIVEE')
    ) {
      restoredTasksCount++;
      return {
        ...t,
        is_active: true,
        active: true,
        statut: 'ACTIF',
        etat: t.etat === 'Suspendu (Machine archivée)' ? 'Planifié' : t.etat || 'Planifié',
        archived_with_machine: false,
        reactivated_at: nowIso,
      };
    }

    return t;
  });

  const finalStatus = String(updatedMachine.status || '').trim();
  const statusChanged =
    targetIsArchive !== wasArchived ||
    prevStatus.toUpperCase() !== finalStatus.toUpperCase();

  if (statusChanged) {
    const eventType: MachineLifecycleEvent['event_type'] = targetIsArchive
      ? 'ARCHIVED'
      : wasArchived
      ? 'REACTIVATED'
      : 'STATUS_CHANGED';

    lifecycleEvent = {
      id: `LIFE-${machineCodeNorm || 'MCH'}-${eventType}-${existingEvents.length + 1}`,
      event_type: eventType,
      from_status: prevStatus,
      to_status: finalStatus,
      lifecycle_state: getMachineLifecycleState(updatedMachine),
      timestamp: nowIso,
      ...(actor ? { actor } : {}),
      ...(reason ? { reason } : {}),
      ...(suspendedTasksCount > 0 ? { suspended_tasks_count: suspendedTasksCount } : {}),
      ...(restoredTasksCount > 0 ? { restored_tasks_count: restoredTasksCount } : {}),
    };

    updatedMachine.lifecycle_events = [...existingEvents, lifecycleEvent];
  }

  return {
    updatedMachine,
    updatedPreventiveTasks,
    suspendedTasksCount,
    restoredTasksCount,
    lifecycleEvent,
  };
}

/**
 * Returns the canonical asset_class of a machine ('PRODUCTION' by default for backward compatibility).
 */
export function getMachineAssetClass(machine: any): 'PRODUCTION' | 'SYSTEM_GENERAL' {
  if (!machine) return 'PRODUCTION';
  return String(machine.asset_class || '').trim().toUpperCase() === 'SYSTEM_GENERAL'
    ? 'SYSTEM_GENERAL'
    : 'PRODUCTION';
}

export function isSystemGeneralMachine(machine: any): boolean {
  return getMachineAssetClass(machine) === 'SYSTEM_GENERAL';
}

/**
 * Filters machines to active PRODUCTION machines only (excludes SYSTEM_GENERAL assets from production organ/BOM attachment).
 */
export function filterProductionMachines(machines: any[] = []) {
  return filterActiveMachines(machines).filter((m) => !isSystemGeneralMachine(m));
}



