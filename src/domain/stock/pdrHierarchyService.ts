import { MaterialPolicyTag, PdrGroup, IStockItem, StockType } from '../../types/domain';
import { normalizePolicyTags } from '../corrective/needRequestService';

/**
 * Filter and list PdrGroups, optionally activeOnly, ordered by sort_order / code / libelle.
 */
export function listPdrGroups(groups?: ReadonlyArray<PdrGroup> | null, activeOnly = false): PdrGroup[] {
  if (!Array.isArray(groups)) return [];
  return groups
    .filter((g) => {
      if (!g || !g.id) return false;
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
    return types.filter((t) => !t.id_group);
  }
  const targetGroupUpper = String(groupId).trim().toUpperCase();
  return types.filter((t) => String(t.id_group || '').trim().toUpperCase() === targetGroupUpper);
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
      const directGroup = item.id_group ? String(item.id_group).trim().toUpperCase() : null;
      const itemTypeKey = String(item.id_type || item.type || '').trim().toUpperCase();
      const resolvedType = itemTypeKey ? typeMap.get(itemTypeKey) : null;
      const inheritedGroup = resolvedType?.id_group ? String(resolvedType.id_group).trim().toUpperCase() : null;
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

  const targetGroupId = item.id_group || matchedType?.id_group || null;
  const targetGroupUpper = targetGroupId ? String(targetGroupId).trim().toUpperCase() : null;

  const matchedGroup = targetGroupUpper
    ? safeGroups.find((g) => {
        const gId = String(g.id || '').trim().toUpperCase();
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
