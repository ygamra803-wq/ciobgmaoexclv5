import { MaterialPolicyTag, PdrGroup, IStockItem, StockType } from '../../types/domain';
import { normalizePolicyTags } from '../corrective/needRequestService';

/**
 * Canonical reader for group linkage across PDR, Parts, and Components (`id_group` with legacy `id_groupe` fallback).
 */
export function getGroupId(
  entity?: { id_group?: string | null; id_groupe?: string | null } | null
): string {
  if (!entity) return '';
  return String(entity.id_group || entity.id_groupe || '').trim();
}

/**
 * Canonical reader for a Group record's own primary key (`id_group` / `id` / `id_groupe`).
 */
export function getGroupRecordId(
  group?: { id?: string | number | null; id_group?: string | null; id_groupe?: string | null } | null
): string {
  if (!group) return '';
  return String(group.id_group || group.id || group.id_groupe || '').trim();
}

/**
 * Filter and list PdrGroups, optionally activeOnly, ordered by sort_order / code / libelle.
 */
export function listPdrGroups(groups?: ReadonlyArray<PdrGroup> | null, activeOnly = false): PdrGroup[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .filter((g) => {
      if (!g || !getGroupRecordId(g)) return false;
      if (activeOnly && g.is_active === false) return false;
      return true;
    })
    .sort((a, b) => {
      const orderA = a.sort_order ?? 999;
      const orderB = b.sort_order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return (a.code || '').localeCompare(b.code || '');
    });
}

/**
 * Lists PDR Types assigned to a specific group, or all types if groupId is undefined / 'ALL'.
 * Supports 'UNCLASSIFIED' for types without id_group.
 */
export function listPdrTypesByGroup(
  types?: ReadonlyArray<StockType | any> | null,
  groupId?: string | null
): any[] {
  if (!Array.isArray(types)) return [];
  if (!groupId || groupId === 'ALL') {
    return [...types];
  }
  if (groupId === 'UNCLASSIFIED') {
    return types.filter((t) => !getGroupId(t));
  }
  const targetGroupUpper = String(groupId).trim().toUpperCase();
  return types.filter((t) => getGroupId(t).toUpperCase() === targetGroupUpper);
}

/**
 * Pure filter for stock items by Group and Type.
 * Backward compatible: items without id_group are never dropped when groupId is 'ALL' or undefined.
 * When groupId is 'UNCLASSIFIED', returns items that have no id_group and whose type has no id_group.
 */
export function listStockItemsByGroupType(
  items?: ReadonlyArray<IStockItem> | null,
  types?: ReadonlyArray<StockType | any> | null,
  groupId?: string | null,
  typeId?: string | null
): IStockItem[] {
  if (!Array.isArray(items)) return [];
  const typeMap = new Map<string, any>();
  if (Array.isArray(types)) {
    for (const t of types) {
      if (t && t.id_type) {
        typeMap.set(String(t.id_type).trim().toUpperCase(), t);
        if (t.libelle) {
          typeMap.set(String(t.libelle).trim().toUpperCase(), t);
        }
      }
    }
  }

  return items.filter((item) => {
    if (!item) return false;

    // 1. Filter by Type if specified
    if (typeId && typeId !== 'ALL') {
      const itemType = String(item.id_type || item.type || '').trim().toUpperCase();
      const targetType = String(typeId).trim().toUpperCase();
      if (itemType !== targetType) {
        return false;
      }
    }

    // 2. Filter by Group if specified
    if (groupId && groupId !== 'ALL') {
      const directGroup = getGroupId(item).toUpperCase() || null;
      const itemTypeKey = String(item.id_type || item.type || '').trim().toUpperCase();
      const resolvedType = itemTypeKey ? typeMap.get(itemTypeKey) : null;
      const inheritedGroup = getGroupId(resolvedType).toUpperCase() || null;
      const effectiveGroup = directGroup || inheritedGroup;

      if (groupId === 'UNCLASSIFIED') {
        if (effectiveGroup) return false;
      } else {
        const targetGroup = String(groupId).trim().toUpperCase();
        if (effectiveGroup !== targetGroup) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Resolves the 3-tier PDR Hierarchy (Group -> Type -> Article) for a given stock item.
 */
export function resolvePdrHierarchy(
  item: IStockItem,
  groups?: ReadonlyArray<PdrGroup> | null,
  types?: ReadonlyArray<StockType | any> | null
): {
  group: PdrGroup | null;
  type: any | null;
  item: IStockItem;
} {
  const safeTypes = Array.isArray(types) ? types : [];
  const safeGroups = Array.isArray(groups) ? groups : [];

  const itemTypeKey = String(item.id_type || item.type || '').trim().toUpperCase();
  const matchedType =
    safeTypes.find((t) => {
      const tId = String(t.id_type || '').trim().toUpperCase();
      const tLib = String(t.libelle || '').trim().toUpperCase();
      return tId === itemTypeKey || tLib === itemTypeKey;
    }) || null;

  const targetGroupId = getGroupId(item) || getGroupId(matchedType) || null;
  const targetGroupUpper = targetGroupId ? String(targetGroupId).trim().toUpperCase() : null;

  const matchedGroup = targetGroupUpper
    ? safeGroups.find((g) => {
        const gId = getGroupRecordId(g).toUpperCase();
        const gCode = String(g.code || '').trim().toUpperCase();
        return gId === targetGroupUpper || gCode === targetGroupUpper;
      }) || null
    : null;

  return {
    group: matchedGroup,
    type: matchedType,
    item,
  };
}

/**
 * Returns effective policy tags for a PDR article, inheriting from Group defaults
 * if the item itself has no explicit tags, with deterministic fallback to ['REPLACING'].
 */
export function getEffectivePdrPolicyTags(
  item?: IStockItem | null,
  group?: PdrGroup | null
): MaterialPolicyTag[] {
  const explicit = normalizePolicyTags(item?.policy_tags);
  if (explicit.length > 0) {
    const pdrOnly = explicit.filter((t) => t === 'REPLACING');
    return pdrOnly.length > 0 ? pdrOnly : ['REPLACING'];
  }
  const groupDefaults = normalizePolicyTags(group?.default_policy_tags);
  if (groupDefaults.length > 0) {
    const pdrOnly = groupDefaults.filter((t) => t === 'REPLACING');
    return pdrOnly.length > 0 ? pdrOnly : ['REPLACING'];
  }
  return ['REPLACING'];
}

/**
 * Computes the number of linked StockTypes and StockItems (direct or via linked types) for a given PdrGroup.
 */
export function computePdrGroupStats(
  group: PdrGroup,
  types?: ReadonlyArray<StockType | any> | null,
  stockItems?: ReadonlyArray<IStockItem | any> | null
): { typesCount: number; itemsCount: number; hasChildren: boolean } {
  const gIdUpper = getGroupRecordId(group).toUpperCase();
  const gCodeUpper = String(group?.code || '').trim().toUpperCase();
  const safeTypes = Array.isArray(types) ? types : [];
  const safeItems = Array.isArray(stockItems) ? stockItems : [];

  const linkedTypeKeys = new Set<string>();
  let typesCount = 0;

  for (const t of safeTypes) {
    if (!t) continue;
    const tGroupUpper = getGroupId(t).toUpperCase();
    if (tGroupUpper && (tGroupUpper === gIdUpper || (gCodeUpper && tGroupUpper === gCodeUpper))) {
      typesCount += 1;
      if (t.id_type) linkedTypeKeys.add(String(t.id_type).trim().toUpperCase());
      if (t.libelle) linkedTypeKeys.add(String(t.libelle).trim().toUpperCase());
    }
  }

  let itemsCount = 0;
  for (const item of safeItems) {
    if (!item) continue;
    const directGroupUpper = getGroupId(item).toUpperCase();
    const itemTypeUpper = String(item.id_type || item.type || '').trim().toUpperCase();
    const matchesDirect =
      Boolean(directGroupUpper) &&
      (directGroupUpper === gIdUpper || (Boolean(gCodeUpper) && directGroupUpper === gCodeUpper));
    const matchesViaType = Boolean(itemTypeUpper) && linkedTypeKeys.has(itemTypeUpper);
    if (matchesDirect || matchesViaType) {
      itemsCount += 1;
    }
  }

  return {
    typesCount,
    itemsCount,
    hasChildren: typesCount > 0 || itemsCount > 0,
  };
}

/**
 * Shared validation and upsert logic for PdrGroup (used by both PdrGroupView and PdrGroupsModal).
 */
export function validateAndUpsertPdrGroup(
  pdrGroups: ReadonlyArray<PdrGroup> = [],
  payload: {
    code: string;
    libelle: string;
    description?: string;
    domaine_technique?: string;
    default_policy_tags?: MaterialPolicyTag[];
    sort_order?: number;
    is_active?: boolean;
  },
  editingGroupId?: string | null
): { ok: boolean; error?: string; groups: PdrGroup[]; savedGroup?: PdrGroup } {
  const cleanCode = String(payload.code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  const cleanLibelle = String(payload.libelle || '').trim();
  const cleanDesc = String(payload.description || '').trim();
  const cleanDomaine = String(payload.domaine_technique || '').trim().toUpperCase() || undefined;

  if (!cleanCode || !cleanLibelle) {
    return {
      ok: false,
      error: 'Le code et le libellé du groupe PDR sont obligatoires.',
      groups: [...pdrGroups],
    };
  }

  const normalizedTags = normalizePolicyTags(payload.default_policy_tags);
  const effectiveTags: MaterialPolicyTag[] =
    normalizedTags.length > 0 ? normalizedTags : ['REPLACING'];

  const duplicate = pdrGroups.some(
    (g) =>
      String(g.code || '').trim().toUpperCase() === cleanCode &&
      (!editingGroupId || getGroupRecordId(g) !== editingGroupId)
  );
  if (duplicate) {
    return {
      ok: false,
      error: `Un groupe PDR avec le code "${cleanCode}" existe déjà.`,
      groups: [...pdrGroups],
    };
  }

  if (editingGroupId) {
    let updatedRecord: PdrGroup | undefined;
    const nextGroups = pdrGroups.map((g) => {
      if (getGroupRecordId(g) !== editingGroupId && g.id !== editingGroupId) return g;
      updatedRecord = {
        ...g,
        id_group: g.id_group || g.id,
        code: cleanCode,
        libelle: cleanLibelle,
        description: cleanDesc,
        domaine_technique: cleanDomaine ?? g.domaine_technique,
        default_policy_tags: effectiveTags,
        sort_order:
          payload.sort_order !== undefined && Number.isFinite(Number(payload.sort_order))
            ? Number(payload.sort_order)
            : g.sort_order ?? 1,
        is_active: payload.is_active !== false,
      };
      return updatedRecord;
    });
    return { ok: true, groups: nextGroups, savedGroup: updatedRecord };
  }

  const newId = `GRP-${cleanCode}`;
  const idCollision = pdrGroups.some((g) => getGroupRecordId(g).toUpperCase() === newId);
  const finalId = idCollision ? `${newId}-${pdrGroups.length + 1}` : newId;

  const newGroup: PdrGroup = {
    id: finalId,
    id_group: finalId,
    code: cleanCode,
    libelle: cleanLibelle,
    description: cleanDesc,
    domaine_technique: cleanDomaine,
    default_policy_tags: effectiveTags,
    sort_order:
      payload.sort_order !== undefined && Number.isFinite(Number(payload.sort_order))
        ? Number(payload.sort_order)
        : pdrGroups.length + 1,
    is_active: payload.is_active !== false,
  };

  return {
    ok: true,
    groups: [...pdrGroups, newGroup],
    savedGroup: newGroup,
  };
}

/**
 * Safe deletion / deactivation policy for PdrGroup:
 * - If the group has linked StockTypes or StockItems, it is NEVER hard-deleted; instead it is safely deactivated (is_active = false).
 * - If the group has 0 linked types and 0 linked items, it can be cleanly removed.
 */
export function safeDeleteOrDeactivatePdrGroup(
  pdrGroups: ReadonlyArray<PdrGroup> = [],
  groupId: string,
  types?: ReadonlyArray<StockType | any> | null,
  stockItems?: ReadonlyArray<IStockItem | any> | null
): {
  mode: 'DELETED' | 'DEACTIVATED' | 'NOT_FOUND';
  groups: PdrGroup[];
  typesCount: number;
  itemsCount: number;
} {
  const target = pdrGroups.find((g) => g.id === groupId || getGroupRecordId(g) === groupId);
  if (!target) {
    return { mode: 'NOT_FOUND', groups: [...pdrGroups], typesCount: 0, itemsCount: 0 };
  }

  const stats = computePdrGroupStats(target, types, stockItems);
  if (stats.hasChildren) {
    const nextGroups = pdrGroups.map((g) =>
      g.id === groupId || getGroupRecordId(g) === groupId ? { ...g, is_active: false } : g
    );
    return {
      mode: 'DEACTIVATED',
      groups: nextGroups,
      typesCount: stats.typesCount,
      itemsCount: stats.itemsCount,
    };
  }

  return {
    mode: 'DELETED',
    groups: pdrGroups.filter((g) => g.id !== groupId && getGroupRecordId(g) !== groupId),
    typesCount: 0,
    itemsCount: 0,
  };
}


