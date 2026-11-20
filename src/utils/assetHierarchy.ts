import { isArchivedMachine, type MachineLifecycleLike } from './activeMachines';

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

export type MachineShiftRegime = '1x8' | '2x8' | '3x8';

export const MACHINE_SHIFT_REGIME_HOURS: Record<MachineShiftRegime, number> = {
  '1x8': 176,
  '2x8': 352,
  '3x8': 720,
};

export interface HierarchyMachineLike extends MachineLifecycleLike {
  parent_id?: string | null;
  id_parent?: string | null;
  previous_parent_id?: string | null;
  asset_level?: AssetHierarchyLevel | string;
  id_family?: string;
  id_blueprint?: string;
  cout_arret_horaire?: number | string;
  valeur_acquisition?: number | string;
  regime_travail?: MachineShiftRegime | string;
  heures_ouverture_mensuelles?: number | string;
}

export interface HierarchyCorrectiveLike {
  validation_status?: string;
  statut?: string;
  status?: string;
  action_fermee?: string;
  id_machine?: string;
  code_machine?: string;
  id_machine_registered?: string;
  machineId?: string;
  temps_arret_minutes?: number | string;
  temps_arret_machine_min?: number | string;
  duree_arret_min?: number | string;
  temps_intervention_mins?: number | string;
  duree_intervention_min?: number | string;
  temps_reparation_min?: number | string;
  duree_arret_heures?: number | string;
  temps_arret?: number | string;
  cout_arret_horaire?: number | string;
}

export const ASSET_HIERARCHY_LEVEL_LABELS: Record<AssetHierarchyLevel, string> = {
  MACHINE: 'Machine / Équipement individuel',
  LINE: 'Ligne de Production / Machine Mère (Regroupement)',
};

/**
 * Resolves monthly planned operating hours for a machine based on explicit `heures_ouverture_mensuelles`
 * or `regime_travail` ('1x8' -> 176h, '2x8' -> 352h, '3x8' -> 720h), falling back to `fallbackHours`.
 */
export function resolveMonthlyOperatingHours(
  machine?: HierarchyMachineLike | null,
  fallbackHours = 720
): number {
  if (!machine || typeof machine !== 'object') return fallbackHours;
  const explicitHours = Number(machine.heures_ouverture_mensuelles);
  if (Number.isFinite(explicitHours) && explicitHours > 0) {
    return explicitHours;
  }
  const regime = String(machine.regime_travail || '').trim().toLowerCase();
  if (regime === '1x8') return MACHINE_SHIFT_REGIME_HOURS['1x8'];
  if (regime === '2x8') return MACHINE_SHIFT_REGIME_HOURS['2x8'];
  if (regime === '3x8') return MACHINE_SHIFT_REGIME_HOURS['3x8'];
  return fallbackHours;
}

export function getMachineCanonicalId(
  machine: HierarchyMachineLike | null | undefined
): string {
  if (!machine || typeof machine !== 'object') return '';
  return String(
    machine.id_machine_registered || machine.id_machine || machine.id || machine.code || ''
  )
    .trim()
    .toUpperCase();
}

export function getMachineParentId(
  machine: HierarchyMachineLike | null | undefined
): string | null {
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
export function getMachineAssetLevel(
  machine: HierarchyMachineLike | null | undefined
): AssetHierarchyLevel {
  if (!machine || typeof machine !== 'object') return 'MACHINE';
  const raw = String(machine.asset_level || '').trim().toUpperCase();
  return raw === 'LINE' ? 'LINE' : 'MACHINE';
}

/**
 * Checks whether setting `candidateParentId` as the parent of `childId` would create a cycle
 * (`A -> A` or `A -> B -> ... -> A`) in the given machines collection.
 */
export function wouldCreateHierarchyCycle(
  machines: HierarchyMachineLike[],
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
export function getDescendantMachineIds(
  parentId: string,
  machines: HierarchyMachineLike[]
): string[] {
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
export interface IMachineHierarchyContext<
  T extends HierarchyMachineLike = HierarchyMachineLike,
> {
  id: string;
  level: AssetHierarchyLevel;
  levelLabel: string;
  parentId: string | null;
  parentDesignation: string | null;
  parentMachine: T | null;
  childrenCount: number;
  breadcrumbIds: string[];
  breadcrumbLabels: string[];
  ownZone: string;
  ownFamily: string;
  ownBlueprint: string;
  isRoot: boolean;
}

export function resolveMachineHierarchyContext<
  T extends HierarchyMachineLike = HierarchyMachineLike,
>(
  machine: T | null | undefined,
  machines: T[] = []
): IMachineHierarchyContext<T> {
  const selfId = getMachineCanonicalId(machine);
  const level = getMachineAssetLevel(machine);
  const levelLabel = ASSET_HIERARCHY_LEVEL_LABELS[level];

  const byId = new Map<string, T>();
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
  const childrenCount = selfId ? getDescendantMachineIds(selfId, machines).length : 0;

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
    parentMachine,
    childrenCount,
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
  machines: HierarchyMachineLike[] = [],
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
export function sanitizeMachinesHierarchy<
  T extends HierarchyMachineLike = HierarchyMachineLike,
>(machines: T[] = []): T[] {
  if (!Array.isArray(machines)) return [];

  // Pass 1: Normalize parent pointers and enforce strict MACHINE | LINE operational role
  const normalized: T[] = machines.map((m) => {
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
  const byId = new Map<string, T>();
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
  totalDowntimeCost: number;
  totalPlannedHours: number;
  availabilityRatePercent: number;
  mttrHours: number;
  mtbfHours: number | null;
}

export function isApprovedCorrectiveIntervention(
  ci: HierarchyCorrectiveLike | null | undefined
): boolean {
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

export function extractCorrectiveDowntimeMinutes(
  ci: HierarchyCorrectiveLike | null | undefined
): number {
  if (!ci || typeof ci !== 'object') return 0;

  const arretMinCandidates = [
    ci.temps_arret_minutes,
    ci.temps_arret_machine_min,
    ci.duree_arret_min,
  ];
  for (const cand of arretMinCandidates) {
    const val = Number(cand);
    if (Number.isFinite(val) && val > 0) return val;
  }

  const arretHoursCandidates = [ci.duree_arret_heures, ci.temps_arret];
  for (const cand of arretHoursCandidates) {
    const val = Number(cand);
    if (Number.isFinite(val) && val > 0) return val * 60;
  }

  const repairCandidates = [
    ci.temps_intervention_mins,
    ci.duree_intervention_min,
    ci.temps_reparation_min,
  ];
  for (const cand of repairCandidates) {
    const val = Number(cand);
    if (Number.isFinite(val) && val > 0) return val;
  }

  return 0;
}

export function extractCorrectiveRepairMinutes(
  ci: HierarchyCorrectiveLike | null | undefined
): number {
  if (!ci || typeof ci !== 'object') return 0;
  const repairCandidates = [
    ci.temps_intervention_mins,
    ci.duree_intervention_min,
    ci.temps_reparation_min,
  ];
  for (const cand of repairCandidates) {
    const val = Number(cand);
    if (Number.isFinite(val) && val > 0) return val;
  }
  return extractCorrectiveDowntimeMinutes(ci);
}

export function computeParentCorrectiveRollup(
  parentId: string,
  machines: HierarchyMachineLike[] = [],
  correctiveInterventions: HierarchyCorrectiveLike[] = [],
  operatingWindowHours?: number
): IParentCorrectiveRollup {
  const cleanParentId = String(parentId || '').trim().toUpperCase();
  const descendantIds = getDescendantMachineIds(cleanParentId, machines);
  const scopeIds = new Set<string>([cleanParentId, ...descendantIds].filter(Boolean));

  const machinesById = new Map<string, HierarchyMachineLike>();
  if (Array.isArray(machines)) {
    for (const m of machines) {
      const id = getMachineCanonicalId(m);
      if (id) machinesById.set(id, m);
    }
  }
  const parentMachine = machinesById.get(cleanParentId);

  let approvedFailuresCount = 0;
  let totalDowntimeMinutes = 0;
  let totalRepairMinutes = 0;
  let totalDowntimeCost = 0;

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

      const effectiveDowntimeMin = extractCorrectiveDowntimeMinutes(ci);
      const effectiveRepairMin = extractCorrectiveRepairMinutes(ci);

      totalDowntimeMinutes += effectiveDowntimeMin;
      totalRepairMinutes += effectiveRepairMin;

      const unitMachine = machinesById.get(machineRef);
      const hourlyRate =
        Math.max(
          0,
          Number(
            ci.cout_arret_horaire ??
              unitMachine?.cout_arret_horaire ??
              parentMachine?.cout_arret_horaire ??
              0
          ) || 0
        );
      if (hourlyRate > 0 && effectiveDowntimeMin > 0) {
        totalDowntimeCost += (effectiveDowntimeMin / 60) * hourlyRate;
      }
    }
  }

  const totalDowntimeHours = Number((totalDowntimeMinutes / 60).toFixed(2));
  const totalRepairHours = Number((totalRepairMinutes / 60).toFixed(2));
  const mttrHours =
    approvedFailuresCount > 0
      ? Number((totalRepairHours / approvedFailuresCount).toFixed(2))
      : 0;

  const activeUnitIds = descendantIds.length > 0 ? descendantIds : [cleanParentId];
  const activeUnitsCount = Math.max(1, activeUnitIds.length);
  const totalPlannedHours =
    operatingWindowHours !== undefined
      ? operatingWindowHours * activeUnitsCount
      : activeUnitIds.reduce((sum, uId) => {
          const unit = machinesById.get(uId) || parentMachine;
          return sum + resolveMonthlyOperatingHours(unit, 720);
        }, 0);

  const totalAvailableHours = Math.max(0, totalPlannedHours - totalDowntimeHours);
  const availabilityRatePercent =
    totalPlannedHours > 0
      ? Number(Math.max(0, Math.min(100, (totalAvailableHours / totalPlannedHours) * 100)).toFixed(1))
      : 100;
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
    totalDowntimeCost: Number(totalDowntimeCost.toFixed(2)),
    totalPlannedHours,
    availabilityRatePercent,
    mttrHours,
    mtbfHours,
  };
}
