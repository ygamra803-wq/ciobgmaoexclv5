/**
 * Machines eligible for NEW links (create forms, bulk relink targets).
 * Archived / inactive machines must never appear in selectors.
 */
export function filterActiveMachines(machines: any[] = []) {
  return (machines || []).filter((m) => {
    if (!m) return false;
    const statusNorm = String(m.status || m.statut || '').trim().toUpperCase();
    if (
      statusNorm === 'ARCHIVEE' ||
      statusNorm === 'ARCHIVÉE' ||
      statusNorm === 'ARCHIVED' ||
      statusNorm === 'ARCHIVE' ||
      m.archived === true ||
      m.isArchived === true
    ) {
      return false;
    }
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


