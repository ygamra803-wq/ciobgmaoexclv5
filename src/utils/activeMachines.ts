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

