import { isArchivedMachine } from './activeMachines';

/**
 * 🏛️ ASSET-HIERARCHY-P0 — Operational Line / Parent Machine Grouping (CIOB 3-Tier Philosophy)
 *
 * Strict Architectural Boundaries (Non-Negotiable):
 * - Tier 1 (Design Classification): `Family` ➔ `Template` defines the equipment category/model.
 * - Tier 2 (Physical Reality): `Machine Registered` (`DET-01`, `DET-02`) is the real physical asset
 *   on the shop floor. It exclusively owns its physical `Zone`, assigned `Technician`, live counter,
 *   and mounted real components (`Nexus` / `Entrepôt`). It NEVER inherits `Zone` or `Technician`
 *   from a parent or from a Blueprint.
 * - Tier 3 (Cognitive Fingerprint): `Blueprint` (`id_blueprint`) is the accumulated virtual knowledge
 *   twin (empirical BOM, proven PM plan, failure modes learned over interventions). Two machines of
 *   the same template (`DET-01`, `DET-02`) can link to different Blueprints as their real history evolves.
 *
 * Role of `parent_id` & `asset_level` ('MACHINE' | 'LINE'):
 * - Purely optional operational grouping (`Machine ➔ Production Line / Mother Machine`) for
 *   analytical rollup (bottleneck detection, aggregated approved corrective downtime/MTTR/MTBF).
 * - Never replaces `Zone` (geography) and never represents internal components/sub-assemblies
 *   (which belong strictly to `Blueprint` / `Nexus` / `Entrepôt`).
 */

export type AssetHierarchyLevel = 'MACHINE' | 'LINE';

export const ASSET_HIERARCHY_LEVEL_LABELS: Record<AssetHierarchyLevel, string> = {
  MACHINE: 'Machine / Équipement individuel',
  LINE: 'Ligne de Production / Machine Mère (Regroupement)',
};

export function getMachineCanonicalId(machine: any): string {
  if (!machine || typeof machine !== 'object') return '';
  return String(
    machine.id_machine_registered || machine.id_machine || machine.id || machine.code || ''
  )
    .trim()
    .toUpperCase();
}

export function getMachineParentId(machine: any): string | null {
  if (!machine || typeof machine !== 'object') return null;
  const raw = machine.parent_id ?? machine.id_parent ?? null;
  if (raw === null || raw === undefined) return null;
  const clean = String(raw).trim().toUpperCase();
  return clean.length > 0 ? clean : null;
}

/**
 * Enforces strict 2-mode operational role ('MACHINE' | 'LINE').
 * Any legacy or non-machine/line value ('SITE', 'ZONE_LINK', 'SUB_SYSTEM') normalizes to 'MACHINE'
 * so geographical Zones and internal BOM Components are never conflated with registered machines.
 */
export function getMachineAssetLevel(machine: any): AssetHierarchyLevel {
  if (!machine || typeof machine !== 'object') return 'MACHINE';
  const raw = String(machine.asset_level || '').trim().toUpperCase();
  return raw === 'LINE' ? 'LINE' : 'MACHINE';
}

/**
 * Checks whether setting `candidateParentId` as the parent of `childId` would create a cycle
 * (`A -> A` or `A -> B -> ... -> A`) in the given machines collection.
 */
export function wouldCreateHierarchyCycle(
  machines: any[],
  childId: string,
  candidateParentId: string | null | undefined
): boolean {
  const cleanChild = String(childId || '').trim().toUpperCase();
  const cleanCandidate = String(candidateParentId || '').trim().toUpperCase();
  if (!cleanCandidate) return false;
  if (!cleanChild) return false;
  if (cleanChild === cleanCandidate) return true;

  const parentMap = new Map<string, string | null>();
  if (Array.isArray(machines)) {
    for (const m of machines) {
      const id = getMachineCanonicalId(m);
      if (id) {
        parentMap.set(id, getMachineParentId(m));
      }
    }
  }

  // Simulate the proposed link
  parentMap.set(cleanChild, cleanCandidate);

  const visited = new Set<string>([cleanChild]);
  let cursor: string | null = cleanCandidate;
  let depth = 0;
  const maxDepth = (Array.isArray(machines) ? machines.length : 0) + 10;

  while (cursor && depth <= maxDepth) {
    if (visited.has(cursor)) {
      return true;
    }
    visited.add(cursor);
    cursor = parentMap.get(cursor) || null;
    depth += 1;
  }

  return false;
}

/**
 * Returns all direct and transitive descendant IDs (normalized uppercase) for a given parent ID.
 */
export function getDescendantMachineIds(parentId: string, machines: any[]): string[] {
  const target = String(parentId || '').trim().toUpperCase();
  if (!target || !Array.isArray(machines) || machines.length === 0) return [];

  const childrenByParent = new Map<string, string[]>();
  for (const m of machines) {
    const id = getMachineCanonicalId(m);
    const pId = getMachineParentId(m);
    if (!id || !pId || id === pId) continue;
    const list = childrenByParent.get(pId) || [];
    list.push(id);
    childrenByParent.set(pId, list);
  }

  const descendants: string[] = [];
  const visited = new Set<string>([target]);
  const queue: string[] = [...(childrenByParent.get(target) || [])];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    descendants.push(current);
    const nextChildren = childrenByParent.get(current) || [];
    for (const child of nextChildren) {
      if (!visited.has(child)) {
        queue.push(child);
      }
    }
  }

  return descendants;
}

/**
 * Resolves the operational parent/line context for a registered machine.
 * Note: Physical `Zone`, `Technician`, `Family`, `Template`, and `Blueprint` belong strictly
 * to the individual `Machine Registered` and are NEVER overwritten or inherited from the parent line.
 */
export interface IMachineHierarchyContext {
  id: string;
  level: AssetHierarchyLevel;
  levelLabel: string;
  parentId: string | null;
  parentDesignation: string | null;
  breadcrumbIds: string[];
  breadcrumbLabels: string[];
  ownZone: string;
  ownFamily: string;
  ownBlueprint: string;
  isRoot: boolean;
}

export function resolveMachineHierarchyContext(
  machine: any,
  machines: any[] = []
): IMachineHierarchyContext {
  const selfId = getMachineCanonicalId(machine);
  const level = getMachineAssetLevel(machine);
  const levelLabel = ASSET_HIERARCHY_LEVEL_LABELS[level];

  const byId = new Map<string, any>();
  if (Array.isArray(machines)) {
    for (const m of machines) {
      const id = getMachineCanonicalId(m);
      if (id) byId.set(id, m);
    }
  }

  const rawParentId = getMachineParentId(machine);
  const validParentId =
    rawParentId && !wouldCreateHierarchyCycle(machines, selfId, rawParentId)
      ? rawParentId
      : null;
  const parentMachine = validParentId ? byId.get(validParentId) || null : null;

  const breadcrumbIds: string[] = selfId ? [selfId] : [];
  const breadcrumbLabels: string[] = [
    String(machine?.designation || machine?.nom || selfId || '').trim(),
  ];

  // Physical and cognitive attributes belong strictly to the individual Machine Registered
  const ownZone = String(machine?.id_zone_default || machine?.zone || '').trim();
  const ownFamily = String(machine?.id_family || '').trim();
  const ownBlueprint = String(machine?.id_blueprint || '').trim();

  const visited = new Set<string>(selfId ? [selfId] : []);
  let cursorId = validParentId;
  let guard = 0;

  while (cursorId && !visited.has(cursorId) && guard < 25) {
    visited.add(cursorId);
    const ancestor = byId.get(cursorId);
    breadcrumbIds.unshift(cursorId);
    breadcrumbLabels.unshift(
      ancestor ? String(ancestor.designation || ancestor.nom || cursorId).trim() : cursorId
    );
    cursorId = ancestor ? getMachineParentId(ancestor) : null;
    guard += 1;
  }

  return {
    id: selfId,
    level,
    levelLabel,
    parentId: validParentId,
    parentDesignation: parentMachine
      ? String(parentMachine.designation || parentMachine.nom || validParentId).trim()
      : null,
    breadcrumbIds,
    breadcrumbLabels,
    ownZone,
    ownFamily,
    ownBlueprint,
    isRoot: !validParentId,
  };
}

/**
 * Documented Parent Archive Policy (`ASSET-HIERARCHY-P0` Rule 2):
 * - When a parent machine/line has active child machines:
 *   1. If `strictBlock === true`, archiving the parent is rejected until children are reassigned.
 *   2. By default (`WARN_AND_DETACH_PRESERVE`), archiving the parent emits a clear warning with the
 *      list of active child IDs, and upon archive, safely detaches active children (`parent_id: null`,
 *      recording `previous_parent_id: parentId`) so active children are never orphaned to an archived
 *      parent and `filterActiveMachines` continues to include all active child machines cleanly.
 */
export interface IParentArchivePolicyEvaluation {
  parentId: string;
  hasActiveChildren: boolean;
  activeChildrenIds: string[];
  allChildrenIds: string[];
  allowed: boolean;
  warningMessage: string | null;
}

export function evaluateParentArchivePolicy(
  parentId: string,
  machines: any[] = [],
  options?: { strictBlock?: boolean }
): IParentArchivePolicyEvaluation {
  const cleanParentId = String(parentId || '').trim().toUpperCase();
  if (!cleanParentId || !Array.isArray(machines)) {
    return {
      parentId: cleanParentId,
      hasActiveChildren: false,
      activeChildrenIds: [],
      allChildrenIds: [],
      allowed: true,
      warningMessage: null,
    };
  }

  const directChildren = machines.filter(
    (m) => getMachineParentId(m) === cleanParentId && getMachineCanonicalId(m) !== cleanParentId
  );
  const allChildrenIds = directChildren.map((m) => getMachineCanonicalId(m)).filter(Boolean);
  const activeChildrenIds = directChildren
    .filter((m) => !isArchivedMachine(m))
    .map((m) => getMachineCanonicalId(m))
    .filter(Boolean);

  const hasActiveChildren = activeChildrenIds.length > 0;
  const strictBlock = Boolean(options?.strictBlock);

  const warningMessage = hasActiveChildren
    ? `Cette ligne / machine mère possède ${activeChildrenIds.length} machine(s) rattachée(s) active(s) (${activeChildrenIds.join(', ')}). Conformément à la politique d'archivage, les machines rattachées restent actives dans leur Zone respective et leur lien parent_id sera détaché proprement (avec conservation de previous_parent_id=${cleanParentId}).`
    : null;

  return {
    parentId: cleanParentId,
    hasActiveChildren,
    activeChildrenIds,
    allChildrenIds,
    allowed: strictBlock ? !hasActiveChildren : true,
    warningMessage,
  };
}

/**
 * Sanitizes a list of machines to guarantee:
 * 1. Canonical `parent_id` (or `null`) and `asset_level` (`'MACHINE' | 'LINE'`).
 * 2. Zero hierarchy cycles (`A -> A` or `A -> B -> A` stripped to `parent_id: null`).
 * 3. Safe Parent Archive Policy: if a parent machine is archived (`isArchivedMachine(parent)`),
 *    any active child machine pointing to that archived parent has its active `parent_id`
 *    detached to `null` and `previous_parent_id` preserved so children never break.
 */
export function sanitizeMachinesHierarchy(machines: any[] = []): any[] {
  if (!Array.isArray(machines)) return [];

  // Pass 1: Normalize fields
  const normalized = machines.map((m) => {
    if (!m || typeof m !== 'object') return m;
    const rawParent = getMachineParentId(m);
    const selfId = getMachineCanonicalId(m);
    const safeInitialParent = rawParent && rawParent !== selfId ? rawParent : null;
    const level = getMachineAssetLevel(m);
    return {
      ...m,
      parent_id: safeInitialParent,
      id_parent: safeInitialParent,
      asset_level: level,
    };
  });

  // Build lookup map
  const byId = new Map<string, any>();
  for (const m of normalized) {
    const id = getMachineCanonicalId(m);
    if (id) byId.set(id, m);
  }

  // Pass 2: Strip cycles & enforce Safe Parent Archive Policy on active children
  return normalized.map((m) => {
    if (!m || typeof m !== 'object') return m;
    const selfId = getMachineCanonicalId(m);
    const parentId = getMachineParentId(m);
    if (!parentId) return m;

    // 1. Cycle check
    if (wouldCreateHierarchyCycle(normalized, selfId, parentId)) {
      return {
        ...m,
        parent_id: null,
        id_parent: null,
      };
    }

    // 2. If parent is archived and child is active, detach active parent pointer while preserving previous_parent_id
    const parentObj = byId.get(parentId);
    if (parentObj && isArchivedMachine(parentObj) && !isArchivedMachine(m)) {
      return {
        ...m,
        previous_parent_id: m.previous_parent_id || parentId,
        parent_id: null,
        id_parent: null,
      };
    }

    return m;
  });
}

/**
 * Computes simple, factual rollup metrics on a parent line/machine across itself
 * and its attached child machines using ONLY approved/closed corrective interventions.
 * Zero invented or extrapolated data.
 */
export interface IParentCorrectiveRollup {
  parentId: string;
  descendantIds: string[];
  descendantCount: number;
  approvedFailuresCount: number;
  totalDowntimeHours: number;
  totalRepairHours: number;
  mttrHours: number;
  mtbfHours: number | null;
}

export function isApprovedCorrectiveIntervention(ci: any): boolean {
  if (!ci || typeof ci !== 'object') return false;
  const valStatus = String(ci.validation_status || '').trim().toUpperCase();
  if (valStatus === 'REJECTED' || valStatus === 'PENDING_APPROVAL') {
    return false;
  }
  if (valStatus === 'APPROVED') {
    return true;
  }
  const statut = String(ci.statut || ci.status || '').trim().toUpperCase();
  const closedFlag = String(ci.action_fermee || '').trim().toUpperCase();
  return statut === 'CLOTURE' || statut === 'TERMINEE' || closedFlag === 'OUI';
}

export function computeParentCorrectiveRollup(
  parentId: string,
  machines: any[] = [],
  correctiveInterventions: any[] = [],
  operatingWindowHours = 720
): IParentCorrectiveRollup {
  const cleanParentId = String(parentId || '').trim().toUpperCase();
  const descendantIds = getDescendantMachineIds(cleanParentId, machines);
  const scopeIds = new Set<string>([cleanParentId, ...descendantIds].filter(Boolean));

  let approvedFailuresCount = 0;
  let totalDowntimeMinutes = 0;
  let totalRepairMinutes = 0;

  if (Array.isArray(correctiveInterventions)) {
    for (const ci of correctiveInterventions) {
      if (!isApprovedCorrectiveIntervention(ci)) continue;
      const machineRef = String(
        ci.id_machine || ci.code_machine || ci.id_machine_registered || ci.machineId || ''
      )
        .trim()
        .toUpperCase();
      if (!machineRef || !scopeIds.has(machineRef)) continue;

      approvedFailuresCount += 1;

      const arretMin = Number(ci.temps_arret_machine_min ?? ci.duree_arret_min ?? 0);
      const interMin = Number(ci.duree_intervention_min ?? ci.temps_reparation_min ?? 0);
      const arretHoursFallback = Number(ci.duree_arret_heures ?? ci.temps_arret ?? 0) * 60;

      const effectiveDowntimeMin =
        Number.isFinite(arretMin) && arretMin > 0
          ? arretMin
          : Number.isFinite(arretHoursFallback) && arretHoursFallback > 0
          ? arretHoursFallback
          : Number.isFinite(interMin) && interMin > 0
          ? interMin
          : 0;

      const effectiveRepairMin =
        Number.isFinite(interMin) && interMin > 0 ? interMin : effectiveDowntimeMin;

      totalDowntimeMinutes += effectiveDowntimeMin;
      totalRepairMinutes += effectiveRepairMin;
    }
  }

  const totalDowntimeHours = Number((totalDowntimeMinutes / 60).toFixed(2));
  const totalRepairHours = Number((totalRepairMinutes / 60).toFixed(2));
  const mttrHours =
    approvedFailuresCount > 0
      ? Number((totalRepairHours / approvedFailuresCount).toFixed(2))
      : 0;

  const activeUnitsCount = Math.max(1, descendantIds.length || 1);
  const totalAvailableHours = Math.max(0, operatingWindowHours * activeUnitsCount - totalDowntimeHours);
  const mtbfHours =
    approvedFailuresCount > 0
      ? Number((totalAvailableHours / approvedFailuresCount).toFixed(2))
      : null;

  return {
    parentId: cleanParentId,
    descendantIds,
    descendantCount: descendantIds.length,
    approvedFailuresCount,
    totalDowntimeHours,
    totalRepairHours,
    mttrHours,
    mtbfHours,
  };
}
