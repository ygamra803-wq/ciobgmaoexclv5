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

export interface MachineLifecycleLike {
  id?: string | number;
  id_machine_registered?: string;
  id_machine?: string;
  code?: string;
  code_machine?: string;
  designation?: string;
  nom?: string;
  name?: string;
  libelle?: string;
  zone?: string;
  id_zone?: string;
  id_zone_default?: string;
  technician?: string;
  technicien?: string;
  technicien_responsable?: string;
  status?: string;
  statut?: string;
  lifecycle_state?: string;
  is_active?: boolean;
  actif?: boolean;
  archived?: boolean;
  isArchived?: boolean;
  asset_class?: string;
  date_archivage?: string;
  archived_at?: string;
  reactivated_at?: string;
  status_changed_at?: string;
  archived_by?: string;
  updated_by?: string;
  lifecycle_events?: MachineLifecycleEvent[];
}

export interface PreventiveTaskLifecycleLike {
  id?: string | number;
  id_machine?: string;
  code_machine?: string;
  machineCode?: string;
  machine_id?: string;
  id_machine_registered?: string;
  is_active?: boolean;
  active?: boolean;
  statut?: string;
  etat?: string;
  archived_with_machine?: boolean;
  date_archivage?: string;
  reactivated_at?: string;
}

/**
 * Returns true ONLY when a machine record is explicitly in the ARCHIVED lifecycle state
 * (`status`/`statut` ARCHIVEE|ARCHIVED or `archived===true`).
 * Note: `is_active === false` alone represents STOPPED/INACTIVE, not ARCHIVED.
 */
export function isArchivedMachine(machine: MachineLifecycleLike | null | undefined): boolean {
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
 * - `'ARCHIVED'`: Soft-archived asset (`status` ARCHIVEE|ARCHIVED or `archived === true`).
 * - `'STOPPED'`: Stopped/inactive operational state (`Arrêt`, `HORS_SERVICE`, `INACTIVE`, or `is_active === false`).
 * - `'ACTIVE'`: Operational state (`En Service`, `En Maintenance`, `En Panne`).
 */
export function getMachineLifecycleState(
  machine: MachineLifecycleLike | null | undefined
): MachineLifecycleState {
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
 * Filters machines eligible for NEW relational links (create forms, bulk relink targets).
 * Archived or explicitly deactivated (`is_active === false`) machines must never appear in selectors.
 */
export function filterActiveMachines<T extends MachineLifecycleLike>(machines: T[] = []): T[] {
  return (machines || []).filter((m) => {
    if (!m || isArchivedMachine(m)) return false;
    if (m.is_active === false || m.actif === false) return false;
    return Boolean(m.id_machine_registered || m.id || m.code || m.id_machine || m.code_machine);
  });
}

export function getActiveMachineCodes(machines: MachineLifecycleLike[] = []): string[] {
  return filterActiveMachines(machines).map((m) =>
    String(m.id_machine_registered || m.id || m.code || m.id_machine || m.code_machine).trim()
  );
}

/**
 * Pure lifecycle transition helper for a machine and its linked preventive tasks.
 * Guarantees:
 * 1) Transitioning to `ARCHIVED` (`ARCHIVEE`) sets soft-archive flags, suspends active PM tasks, and logs an event.
 * 2) Reactivating from `ARCHIVED` clears archive flags, restores previously suspended PM tasks, and logs an event.
 * 3) Transitions between `ACTIVE` and `STOPPED` stamp `status_changed_at` and record a lifecycle event.
 */
export function transitionMachineLifecycle<
  TMachine extends MachineLifecycleLike,
  TTask extends PreventiveTaskLifecycleLike = PreventiveTaskLifecycleLike,
>({
  machine,
  targetStatus,
  preventiveTasks = [],
  timestamp,
  actor,
  reason,
}: {
  machine: TMachine;
  targetStatus?: string;
  preventiveTasks?: TTask[];
  timestamp?: string;
  actor?: string;
  reason?: string;
}): {
  updatedMachine: TMachine & {
    status: string;
    statut: string;
    lifecycle_state: MachineLifecycleState;
    is_active: boolean;
    actif: boolean;
    archived: boolean;
    lifecycle_events?: MachineLifecycleEvent[];
  };
  updatedPreventiveTasks: Array<TTask & { archived_with_machine?: boolean }>;
  suspendedTasksCount: number;
  restoredTasksCount: number;
  lifecycleEvent: MachineLifecycleEvent | null;
} {
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
  type TransitionedMachine = TMachine & {
    status: string;
    statut: string;
    lifecycle_state: MachineLifecycleState;
    is_active: boolean;
    actif: boolean;
    archived: boolean;
    lifecycle_events?: MachineLifecycleEvent[];
  };
  let updatedMachine: TransitionedMachine;

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

  type TransitionedTask = TTask & { archived_with_machine?: boolean };
  const updatedPreventiveTasks: TransitionedTask[] = (preventiveTasks || []).map((t): TransitionedTask => {
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

    updatedMachine = {
      ...updatedMachine,
      lifecycle_events: [...existingEvents, lifecycleEvent],
    };
  }

  return {
    updatedMachine,
    updatedPreventiveTasks,
    suspendedTasksCount,
    restoredTasksCount,
    lifecycleEvent,
  };
}

/** Returns the canonical `asset_class` of a machine (`PRODUCTION` by default for backward compatibility). */
export function getMachineAssetClass(
  machine: MachineLifecycleLike | null | undefined
): 'PRODUCTION' | 'SYSTEM_GENERAL' {
  if (!machine) return 'PRODUCTION';
  return String(machine.asset_class || '').trim().toUpperCase() === 'SYSTEM_GENERAL'
    ? 'SYSTEM_GENERAL'
    : 'PRODUCTION';
}

export function isSystemGeneralMachine(machine: MachineLifecycleLike | null | undefined): boolean {
  return getMachineAssetClass(machine) === 'SYSTEM_GENERAL';
}

/** Filters machines to active `PRODUCTION` machines only (excludes `SYSTEM_GENERAL` assets from production organ/BOM attachment). */
export function filterProductionMachines<T extends MachineLifecycleLike>(machines: T[] = []): T[] {
  return filterActiveMachines(machines).filter((m) => !isSystemGeneralMachine(m));
}



