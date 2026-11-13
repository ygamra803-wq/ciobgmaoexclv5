import type { IPartDesignation, IStockItem, PdrGroup, StockType } from '../../types/domain';
import { DataGateway } from '../../application/DataGateway';
import { useGmaoStore } from '../../store/useGmaoStore';
import {
  derivePdrGroupId,
  parseExcelBoolean,
  parsePdrExcelPolicyTags,
} from './pdrExcelParsers';
import type {
  PdrCatalogImportCounts,
  PdrCatalogImportError,
  PdrCatalogImportMode,
  PdrCatalogImportReport,
  PdrCatalogRawSheets,
  PdrCatalogValidationOptions,
} from './types/pdrExcelTypes';

/**
 * Validates and reconciles 3-tier PDR catalog sheets (`Groups -> Types -> Items`)
 * under either `MERGE` (default) or `REPLACE_CATALOG` (ADMIN only + movement FK protection).
 */
export function validateAndReconcilePdrCatalogImport(
  rawSheets: PdrCatalogRawSheets,
  options: PdrCatalogValidationOptions = {}
): PdrCatalogImportReport {
  const mode: PdrCatalogImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const actorRole = String(options.actorRole || 'ADMIN').trim().toUpperCase();
  const hasStockEdit = options.hasStockEditPermission !== false;

  const existingGroups = Array.isArray(options.existingGroups) ? [...options.existingGroups] : [];
  const existingTypes = Array.isArray(options.existingTypes) ? [...options.existingTypes] : [];
  const existingStock = Array.isArray(options.existingStock) ? [...options.existingStock] : [];
  const existingMouvements = Array.isArray(options.existingMouvements) ? options.existingMouvements : [];

  const errors: PdrCatalogImportError[] = [];
  const created: PdrCatalogImportCounts = { groups: 0, types: 0, items: 0, total: 0 };
  const updated: PdrCatalogImportCounts = { groups: 0, types: 0, items: 0, total: 0 };
  const skipped: PdrCatalogImportCounts = { groups: 0, types: 0, items: 0, total: 0 };

  const emptyFailure = (): PdrCatalogImportReport => ({
    success: false,
    mode,
    created,
    updated,
    skipped,
    errors,
    nextGroups: existingGroups,
    nextTypes: existingTypes,
    nextStock: existingStock,
    nextDesignations: [],
  });

  // RBAC Guard
  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    errors.push({
      sheet: 'GLOBAL',
      row: 0,
      message: 'Accès refusé : le mode REPLACE_CATALOG est strictement réservé au rôle ADMIN.',
    });
    return emptyFailure();
  }

  if (!hasStockEdit && actorRole !== 'ADMIN') {
    errors.push({
      sheet: 'GLOBAL',
      row: 0,
      message: 'Accès refusé : permission stock.edit ou rôle ADMIN requis pour importer le catalogue PDR.',
    });
    return emptyFailure();
  }

  const rawGroups = Array.isArray(rawSheets?.groups) ? rawSheets.groups : [];
  const rawTypes = Array.isArray(rawSheets?.types) ? rawSheets.types : [];
  const rawItems = Array.isArray(rawSheets?.items) ? rawSheets.items : [];

  if (rawGroups.length === 0 && rawTypes.length === 0 && rawItems.length === 0) {
    errors.push({
      sheet: 'GLOBAL',
      row: 0,
      message: 'Aucune donnée trouvée dans les feuilles PDR_GROUPS, PDR_TYPES ou PDR_ITEMS.',
    });
    return emptyFailure();
  }

  // =========================================================================
  // STEP 1: GROUPS (PDR_GROUPS)
  // =========================================================================
  const workingGroupsById = new Map<string, PdrGroup>();
  const workingGroupsByCode = new Map<string, PdrGroup>();

  if (mode === 'MERGE') {
    for (const g of existingGroups) {
      if (!g || !g.id) continue;
      workingGroupsById.set(String(g.id).trim().toUpperCase(), { ...g });
      if (g.code) {
        workingGroupsByCode.set(String(g.code).trim().toUpperCase(), { ...g });
      }
    }
  }

  const seenFileGroupCodes = new Set<string>();
  const seenFileGroupIds = new Set<string>();

  rawGroups.forEach((row, idx) => {
    const excelRowNum = idx + 2;
    const rawCode = String(row.code ?? row.CODE ?? '').trim().toUpperCase();
    const rawLibelle = String(row.libelle ?? row.LIBELLE ?? '').trim();
    const rawId = String(row.id ?? row.ID ?? '').trim();

    if (!rawCode && !rawLibelle && !rawId) {
      skipped.groups++;
      return;
    }

    if (!rawCode) {
      errors.push({
        sheet: 'PDR_GROUPS',
        row: excelRowNum,
        identifier: rawId || rawLibelle,
        message: `Ligne ${excelRowNum} (PDR_GROUPS) : le champ 'code' est obligatoire.`,
      });
      skipped.groups++;
      return;
    }

    if (!rawLibelle) {
      errors.push({
        sheet: 'PDR_GROUPS',
        row: excelRowNum,
        identifier: rawCode,
        message: `Ligne ${excelRowNum} (PDR_GROUPS) : le champ 'libelle' est obligatoire pour le groupe '${rawCode}'.`,
      });
      skipped.groups++;
      return;
    }

    const derivedId = derivePdrGroupId(rawCode, rawId);
    const normId = derivedId.toUpperCase();

    if (seenFileGroupCodes.has(rawCode) || seenFileGroupIds.has(normId)) {
      errors.push({
        sheet: 'PDR_GROUPS',
        row: excelRowNum,
        identifier: rawCode,
        message: `Ligne ${excelRowNum} (PDR_GROUPS) : code groupe dupliqué '${rawCode}' dans le fichier.`,
      });
      skipped.groups++;
      return;
    }
    seenFileGroupCodes.add(rawCode);
    seenFileGroupIds.add(normId);

    const existingMatch =
      workingGroupsByCode.get(rawCode) || workingGroupsById.get(normId) || null;

    const canonicalId = existingMatch ? existingMatch.id : derivedId;
    const sortOrderNum = Number(row.sort_order ?? row.SORT_ORDER);
    const rawGroupDomaine = String(
      row.domaine_technique ?? row.DOMAINE_TECHNIQUE ?? existingMatch?.domaine_technique ?? ''
    )
      .trim()
      .toUpperCase();
    const groupRecord: PdrGroup = {
      id: canonicalId,
      id_group: canonicalId,
      code: rawCode,
      libelle: rawLibelle,
      description: String(row.description ?? row.DESCRIPTION ?? existingMatch?.description ?? '').trim(),
      domaine_technique: rawGroupDomaine || undefined,
      default_policy_tags: parsePdrExcelPolicyTags(
        row.default_policy_tags ?? row.DEFAULT_POLICY_TAGS ?? existingMatch?.default_policy_tags
      ),
      sort_order: Number.isFinite(sortOrderNum) && sortOrderNum > 0 ? sortOrderNum : (idx + 1) * 10,
      is_active: parseExcelBoolean(row.is_active ?? row.IS_ACTIVE, true),
    };

    if (existingMatch) {
      updated.groups++;
    } else {
      created.groups++;
    }

    workingGroupsById.set(String(canonicalId).trim().toUpperCase(), groupRecord);
    workingGroupsByCode.set(rawCode, groupRecord);
  });

  const resolveGroupRef = (groupRefRaw: string): PdrGroup | null => {
    const key = String(groupRefRaw || '').trim().toUpperCase();
    if (!key) return null;
    return (
      workingGroupsByCode.get(key) ||
      workingGroupsById.get(key) ||
      workingGroupsById.get(`GRP-${key}`) ||
      null
    );
  };

  // =========================================================================
  // STEP 2: TYPES (PDR_TYPES)
  // =========================================================================
  const workingTypesById = new Map<string, StockType>();
  const workingTypesByLabel = new Map<string, StockType>();

  if (mode === 'MERGE') {
    for (const t of existingTypes) {
      if (!t || !t.id_type) continue;
      workingTypesById.set(String(t.id_type).trim().toUpperCase(), { ...t });
      if (t.libelle) {
        workingTypesByLabel.set(String(t.libelle).trim().toUpperCase(), { ...t });
      }
    }
  }

  const seenFileTypeCodes = new Set<string>();

  rawTypes.forEach((row, idx) => {
    const excelRowNum = idx + 2;
    const rawCodeType = String(
      row.code_type ?? row.id_type ?? row.CODE_TYPE ?? row.ID_TYPE ?? ''
    ).trim();
    const rawLibelle = String(row.libelle ?? row.LIBELLE ?? '').trim();
    const rawGroupCode = String(
      row.group_code ?? row.id_group ?? row.GROUP_CODE ?? row.ID_GROUP ?? ''
    ).trim();

    if (!rawCodeType && !rawLibelle && !rawGroupCode) {
      skipped.types++;
      return;
    }

    if (!rawCodeType) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawLibelle,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : le champ 'code_type' est obligatoire.`,
      });
      skipped.types++;
      return;
    }

    const normTypeCode = rawCodeType.toUpperCase();
    if (seenFileTypeCodes.has(normTypeCode)) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawCodeType,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : 'code_type' dupliqué '${rawCodeType}' dans le fichier.`,
      });
      skipped.types++;
      return;
    }
    seenFileTypeCodes.add(normTypeCode);

    if (!rawGroupCode) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawCodeType,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : 'group_code' manquant pour le type '${rawCodeType}'.`,
      });
      skipped.types++;
      return;
    }

    const targetGroup = resolveGroupRef(rawGroupCode);
    if (!targetGroup) {
      errors.push({
        sheet: 'PDR_TYPES',
        row: excelRowNum,
        identifier: rawCodeType,
        message: `Ligne ${excelRowNum} (PDR_TYPES) : 'group_code' introuvable ('${rawGroupCode}') pour le type '${rawCodeType}'.`,
      });
      skipped.types++;
      return;
    }

    const existingType = workingTypesById.get(normTypeCode) || null;
    const rawTypeDomaine = String(
      row.domaine_technique ?? row.DOMAINE_TECHNIQUE ?? existingType?.domaine_technique ?? targetGroup.domaine_technique ?? ''
    )
      .trim()
      .toUpperCase();
    const typeRecord: StockType = {
      id_type: existingType ? existingType.id_type : rawCodeType,
      libelle: rawLibelle || existingType?.libelle || rawCodeType,
      id_group: targetGroup.id,
      id_groupe: targetGroup.id,
      domaine_technique: rawTypeDomaine || undefined,
      is_active: parseExcelBoolean(row.is_active ?? row.IS_ACTIVE, true),
    };

    if (existingType) {
      updated.types++;
    } else {
      created.types++;
    }

    workingTypesById.set(String(typeRecord.id_type).trim().toUpperCase(), typeRecord);
    if (typeRecord.libelle) {
      workingTypesByLabel.set(String(typeRecord.libelle).trim().toUpperCase(), typeRecord);
    }
  });

  const resolveTypeRef = (typeRefRaw: string): StockType | null => {
    const key = String(typeRefRaw || '').trim().toUpperCase();
    if (!key) return null;
    return workingTypesById.get(key) || workingTypesByLabel.get(key) || null;
  };

  // =========================================================================
  // STEP 3: ITEMS (PDR_ITEMS)
  // =========================================================================
  const existingStockByRef = new Map<string, IStockItem>();
  for (const item of existingStock) {
    if (!item || !item.ref) continue;
    existingStockByRef.set(String(item.ref).trim().toUpperCase(), item);
  }

  const workingStockByRef = new Map<string, IStockItem>();
  if (mode === 'MERGE') {
    for (const [k, v] of existingStockByRef.entries()) {
      workingStockByRef.set(k, { ...v });
    }
  }

  const seenFileRefs = new Set<string>();
  let nextNumericId =
    existingStock.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;

  rawItems.forEach((row, idx) => {
    const excelRowNum = idx + 2;
    const rawRef = String(row.ref ?? row.REF ?? '').trim();
    const rawDesignation = String(row.designation ?? row.DESIGNATION ?? '').trim();
    const rawTypeRef = String(
      row.type_code_or_id ?? row.id_type ?? row.type ?? row.TYPE_CODE_OR_ID ?? row.ID_TYPE ?? ''
    ).trim();
    const rawGroupRef = String(
      row.group_code ?? row.id_group ?? row.GROUP_CODE ?? row.ID_GROUP ?? ''
    ).trim();

    if (!rawRef && !rawDesignation && !rawTypeRef && !rawGroupRef) {
      skipped.items++;
      return;
    }

    if (!rawRef) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawDesignation || `Row-${excelRowNum}`,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : le champ 'ref' est obligatoire.`,
      });
      skipped.items++;
      return;
    }

    const normRef = rawRef.toUpperCase();
    if (seenFileRefs.has(normRef)) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : référence 'ref' dupliquée ('${rawRef}') dans le fichier.`,
      });
      skipped.items++;
      return;
    }
    seenFileRefs.add(normRef);

    if (!rawDesignation) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : 'designation' obligatoire pour l'article '${rawRef}'.`,
      });
      skipped.items++;
      return;
    }

    if (!rawTypeRef) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : 'type_code_or_id' obligatoire pour l'article '${rawRef}'.`,
      });
      skipped.items++;
      return;
    }

    const matchedType = resolveTypeRef(rawTypeRef);
    if (!matchedType) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : type '${rawTypeRef}' introuvable pour l'article '${rawRef}'.`,
      });
      skipped.items++;
      return;
    }

    const typeGroup = matchedType.id_group ? resolveGroupRef(matchedType.id_group) : null;
    if (!typeGroup) {
      errors.push({
        sheet: 'PDR_ITEMS',
        row: excelRowNum,
        identifier: rawRef,
        message: `Ligne ${excelRowNum} (PDR_ITEMS) : le type '${matchedType.id_type}' n'est rattaché à aucun groupe valide.`,
      });
      skipped.items++;
      return;
    }

    if (rawGroupRef) {
      const explicitGroup = resolveGroupRef(rawGroupRef);
      if (!explicitGroup) {
        errors.push({
          sheet: 'PDR_ITEMS',
          row: excelRowNum,
          identifier: rawRef,
          message: `Ligne ${excelRowNum} (PDR_ITEMS) : 'group_code' ('${rawGroupRef}') introuvable pour l'article '${rawRef}'.`,
        });
        skipped.items++;
        return;
      }
      if (String(explicitGroup.id).toUpperCase() !== String(typeGroup.id).toUpperCase()) {
        errors.push({
          sheet: 'PDR_ITEMS',
          row: excelRowNum,
          identifier: rawRef,
          message: `Ligne ${excelRowNum} (PDR_ITEMS) : incohérence hiérarchique pour '${rawRef}' — le groupe de l'article ('${explicitGroup.code}') diffère du groupe du type '${matchedType.id_type}' ('${typeGroup.code}').`,
        });
        skipped.items++;
        return;
      }
    }

    const existingItem = existingStockByRef.get(normRef) || null;
    const stockInitialVal = Math.max(0, Number(row.stockInitial ?? existingItem?.stockInitial ?? 0) || 0);
    const seuilVal = Math.max(0, Number(row.seuil ?? existingItem?.seuil ?? 0) || 0);
    const prixVal = Math.max(0, Number(row.prix_unitaire ?? existingItem?.prix_unitaire ?? 0) || 0);
    const emplacementVal =
      String(row.emplacement ?? existingItem?.emplacement ?? 'Magasin PDR').trim() || 'Magasin PDR';

    const policyTags = parsePdrExcelPolicyTags(row.policy_tags ?? row.POLICY_TAGS);
    const rawUnite = String(
      row.unite_mesure ?? row.unite ?? row.UNITE_MESURE ?? row.UNITE ?? existingItem?.unite_mesure ?? existingItem?.unite ?? 'PCS'
    )
      .trim()
      .toUpperCase() || 'PCS';
    const rawCrit = String(
      row.criticite ?? row.CRITICITE ?? existingItem?.criticite ?? 'B'
    )
      .trim()
      .toUpperCase();
    const criticiteVal = ['A', 'B', 'C'].includes(rawCrit) ? rawCrit : 'B';
    const refConstructeurVal = String(
      row.ref_constructeur ?? row.REF_CONSTRUCTEUR ?? existingItem?.ref_constructeur ?? ''
    ).trim();
    const codeEquivalentsVal = String(
      row.code_equivalents ??
        row.equivalences ??
        row.CODE_EQUIVALENTS ??
        row.EQUIVALENCES ??
        existingItem?.code_equivalents ??
        existingItem?.equivalences ??
        ''
    ).trim();
    const delaiApproVal = Math.max(
      0,
      Number(row.delai_appro_jours ?? row.DELAI_APPRO_JOURS ?? existingItem?.delai_appro_jours ?? 0) || 0
    );
    const rawItemDomaine = String(
      row.domaine_technique ??
        row.DOMAINE_TECHNIQUE ??
        existingItem?.domaine_technique ??
        matchedType.domaine_technique ??
        typeGroup.domaine_technique ??
        ''
    )
      .trim()
      .toUpperCase();

    // Note: stockActuel in Excel is strictly informational and NEVER overrides movement math
    const entreesPreserve = Number(existingItem?.entrees ?? 0);
    const sortiesPreserve = Number(existingItem?.sorties ?? 0);
    const computedActuel = stockInitialVal + entreesPreserve - sortiesPreserve;

    const itemRecord: IStockItem = {
      ...(existingItem || {}),
      id: existingItem?.id ?? nextNumericId++,
      ref: existingItem ? existingItem.ref : rawRef,
      designation: rawDesignation,
      id_group: typeGroup.id,
      id_groupe: typeGroup.id,
      id_type: matchedType.id_type,
      type: matchedType.libelle || matchedType.id_type,
      unite: rawUnite,
      unite_mesure: rawUnite,
      criticite: criticiteVal,
      ref_constructeur: refConstructeurVal,
      code_equivalents: codeEquivalentsVal || undefined,
      equivalences: codeEquivalentsVal || undefined,
      delai_appro_jours: delaiApproVal,
      domaine_technique: rawItemDomaine || undefined,
      stockInitial: stockInitialVal,
      entrees: entreesPreserve,
      sorties: sortiesPreserve,
      stockActuel: computedActuel,
      seuil: seuilVal,
      emplacement: emplacementVal,
      prix_unitaire: prixVal,
      policy_tags: policyTags,
    };

    if (existingItem) {
      updated.items++;
    } else {
      created.items++;
    }

    workingStockByRef.set(normRef, itemRecord);
  });

  // =========================================================================
  // STEP 4: REPLACE_CATALOG MOVEMENT FK GUARD
  // =========================================================================
  if (mode === 'REPLACE_CATALOG') {
    const movRefs = new Set<string>();
    for (const mov of existingMouvements) {
      const r = String(mov?.ref || '').trim().toUpperCase();
      if (r) movRefs.add(r);
    }

    const orphanedMovRefs: string[] = [];
    for (const [normRef, oldItem] of existingStockByRef.entries()) {
      if (!workingStockByRef.has(normRef) && movRefs.has(normRef)) {
        orphanedMovRefs.push(oldItem.ref);
      }
    }

    if (orphanedMovRefs.length > 0) {
      errors.push({
        sheet: 'GLOBAL',
        row: 0,
        identifier: orphanedMovRefs.join(', '),
        message: `Remplacement refusé (Protection FK Mouvements) : ${orphanedMovRefs.length} référence(s) supprimée(s) du catalogue possèdent des mouvements historiques (${orphanedMovRefs.slice(0, 5).join(', ')}). Utilisez le mode MERGE ou conservez ces références.`,
      });
      return emptyFailure();
    }
  }

  created.total = created.groups + created.types + created.items;
  updated.total = updated.groups + updated.types + updated.items;
  skipped.total = skipped.groups + skipped.types + skipped.items;

  const hasAnyValidMutation = created.total > 0 || updated.total > 0;
  const success = errors.length === 0 && hasAnyValidMutation;

  if (!success && !hasAnyValidMutation) {
    return emptyFailure();
  }

  const nextGroups = Array.from(workingGroupsById.values()).sort(
    (a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)
  );
  const nextTypes = Array.from(workingTypesById.values());
  const nextStock = Array.from(workingStockByRef.values());
  const nextDesignations: IPartDesignation[] = nextStock.map((s) => ({
    id: s.id || s.ref,
    ref: s.ref,
    designation: s.designation,
    id_group: s.id_group || null,
    id_type: s.id_type || s.type,
    type: s.type,
    unite_mesure: s.unite_mesure || s.unite || 'PCS',
    criticite: s.criticite || 'B',
    ref_constructeur: s.ref_constructeur || '',
    stockInitial: s.stockInitial,
    seuil: s.seuil,
    emplacement: s.emplacement,
  }));

  return {
    success: errors.length === 0,
    mode,
    created,
    updated,
    skipped,
    errors,
    nextGroups,
    nextTypes,
    nextStock,
    nextDesignations,
  };
}

/**
 * Commits a validated PDR catalog import report to `DataGateway` and `useGmaoStore`
 * in strict `Groups -> Types -> Items` order without invoking `loadDemoData` or changing `START_MODE`.
 */
export function applyPdrCatalogImportToStore(report: PdrCatalogImportReport): boolean {
  if (!report || (report.created.total === 0 && report.updated.total === 0)) {
    return false;
  }

  DataGateway.savePdrGroups(report.nextGroups);
  DataGateway.saveStockTypes(report.nextTypes);
  DataGateway.saveStock(report.nextStock);
  DataGateway.saveDesignations(report.nextDesignations);

  const store = useGmaoStore.getState();
  store.setPdrGroups(report.nextGroups);
  store.setTypes(report.nextTypes);
  store.setRawStock(report.nextStock);
  store.setDesignations(report.nextDesignations);

  return true;
}
