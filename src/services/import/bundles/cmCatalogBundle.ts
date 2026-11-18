import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import cmCatalogOfficialTemplate from '../../../../templates/import/CM_CATALOG.template.json';
import {
  AcceptedStageRecord,
  CmCatalogBundleInput,
  CmCatalogCategoryRow,
  CmCatalogFaultRow,
  CmCatalogStagingResult,
  ImportCommitPolicy,
  ImportIssue,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';
import {
  cleanStr,
  DEFAULT_CM_CATEGORY_LABELS,
  FORBIDDEN_CM_CATALOG_ROOT_KEYS,
  FORBIDDEN_CM_CATALOG_ROW_KEYS,
  normKey,
  notifyPipelineCommitSync,
} from '../pipelineShared';

/**
 * Validates and optionally commits a `CM_CATALOG` bundle (`Level 2 Fault Categories & Standard Corrective Actions Only`):
 * `07_PANNE_CATEGORIES -> 07_PANNE_ACTIONS`.
 *
 * Strictly rejects work orders (`correctiveInterventions`, `bonsTravail`, `demandes`), machines, movements, or secrets.
 */
export function validateAndCommitCmCatalogBundle(
  input: CmCatalogBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<CmCatalogStagingResult> {
  const startTime = Date.now();
  const mode: ImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const origin: ImportSourceOrigin = options.origin || 'JSON_BUNDLE';
  const commitPolicy: ImportCommitPolicy = options.commitPolicy || 'ATOMIC';
  const dryRun = Boolean(options.dryRun);
  const actorRole = normKey(options.actorRole || 'ADMIN');

  const store = useGmaoStore.getState();
  const existingPanneCategories =
    options.existingPanneCategories ?? store.correctivePanneCategories ?? {};
  const existingActionsByPanne =
    options.existingActionsByPanne ?? store.correctiveActionsByPanne ?? {};
  const existingCorrective =
    options.existingCorrectiveInterventions ?? store.correctiveInterventions ?? [];

  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const accepted: AcceptedStageRecord[] = [];

  const abortReport = (): ImportReport<CmCatalogStagingResult> => ({
    bundleType: 'CM_CATALOG',
    success: false,
    dryRun,
    origin,
    mode,
    commitPolicy,
    committed: false,
    accepted,
    rejected,
    warnings,
    durationMs: Date.now() - startTime,
    staging: {
      nextPanneCategories: { ...existingPanneCategories },
      nextActionsByPanne: { ...existingActionsByPanne },
    },
  });

  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    rejected.push({
      stage: '07_PANNE_CATEGORIES',
      entity: 'CM_CATALOG',
      row: 0,
      code: 'RBAC_DENIED',
      message: 'Accès refusé : le mode REPLACE_CATALOG est strictement réservé au rôle ADMIN.',
      blocking: true,
    });
    return abortReport();
  }

  if (!input || typeof input !== 'object') {
    rejected.push({
      stage: '07_PANNE_CATEGORIES',
      entity: 'CM_CATALOG',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: 'Format de paquet CM_CATALOG invalide.',
      blocking: true,
    });
    return abortReport();
  }

  for (const forbiddenKey of FORBIDDEN_CM_CATALOG_ROOT_KEYS) {
    const val = (input as Record<string, unknown>)[forbiddenKey];
    if (
      (Array.isArray(val) && val.length > 0) ||
      (!Array.isArray(val) && val !== undefined && val !== null)
    ) {
      rejected.push({
        stage: '07_PANNE_CATEGORIES',
        entity: 'CM_CATALOG',
        row: 0,
        identifier: forbiddenKey,
        code: 'FORBIDDEN_BUNDLE_FIELD',
        message: `Le paquet CM_CATALOG (Niveau 2 Catalogue Pannes uniquement) interdit l'inclusion de '${forbiddenKey}'.`,
        blocking: true,
      });
    }
  }

  const rawCategories = Array.isArray(input.categories) ? input.categories : [];
  const rawFaults = Array.isArray(input.faults) ? input.faults : [];

  if (!Array.isArray(input.categories) && !Array.isArray(input.faults)) {
    rejected.push({
      stage: '07_PANNE_CATEGORIES',
      entity: 'CM_CATALOG',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: "Format CM_CATALOG invalide : les tableaux 'categories' et/ou 'faults' sont requis.",
      blocking: true,
    });
    return abortReport();
  }

  // =========================================================================
  // STAGE 1: 07_PANNE_CATEGORIES
  // =========================================================================
  const workingCategoriesMap = new Map<string, string[]>();
  const existingCatKeys = new Set<string>();
  for (const [rawCat, list] of Object.entries(existingPanneCategories)) {
    const catKey = normKey(rawCat);
    if (!catKey) continue;
    existingCatKeys.add(catKey);
    if (mode === 'MERGE' || rawCategories.length === 0) {
      workingCategoriesMap.set(
        catKey,
        Array.isArray(list) ? list.map((p) => cleanStr(p)).filter(Boolean) : []
      );
    }
  }

  const seenCategories = new Set<string>();
  let catCreated = 0;
  let catUpdated = 0;
  let catUnchanged = 0;
  let catSkipped = 0;

  rawCategories.forEach((row: CmCatalogCategoryRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      catSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawCode = cleanStr(row.code_category ?? rowRec.code ?? rowRec.category);
    if (!rawCode && !cleanStr(row.libelle)) {
      catSkipped++;
      return;
    }
    for (const fk of FORBIDDEN_CM_CATALOG_ROW_KEYS) {
      if (rowRec[fk] !== undefined && rowRec[fk] !== null && rowRec[fk] !== '') {
        rejected.push({
          stage: '07_PANNE_CATEGORIES',
          entity: 'CM_CATEGORIES',
          row: rowNum,
          identifier: rawCode || `ROW-${rowNum}`,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Ligne ${rowNum} (CM_CATEGORIES [${rawCode}]) : le champ '${fk}' est interdit dans CM_CATALOG.`,
          blocking: true,
        });
        return;
      }
    }
    if (!rawCode) {
      rejected.push({
        stage: '07_PANNE_CATEGORIES',
        entity: 'CM_CATEGORIES',
        row: rowNum,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (CM_CATEGORIES) : 'code_category' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    const catKey = normKey(rawCode);
    if (seenCategories.has(catKey)) {
      rejected.push({
        stage: '07_PANNE_CATEGORIES',
        entity: 'CM_CATEGORIES',
        row: rowNum,
        identifier: catKey,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (CM_CATEGORIES) : doublon sur code_category '${catKey}'.`,
        blocking: true,
      });
      return;
    }
    seenCategories.add(catKey);

    if (existingCatKeys.has(catKey)) {
      if (!workingCategoriesMap.has(catKey)) {
        workingCategoriesMap.set(catKey, []);
      }
      catUnchanged++;
    } else {
      workingCategoriesMap.set(catKey, []);
      catCreated++;
    }
  });

  accepted.push({
    stage: '07_PANNE_CATEGORIES',
    entity: 'CM_CATEGORIES',
    created: catCreated,
    updated: catUpdated,
    unchanged: catUnchanged,
    skipped: catSkipped,
  });

  // =========================================================================
  // STAGE 2: 07_PANNE_ACTIONS (Faults -> Actions Matrix)
  // =========================================================================
  const workingActionsMap = new Map<string, string[]>();
  const existingFaultLabelsUpper = new Set<string>();
  for (const [rawCat, list] of Object.entries(existingPanneCategories)) {
    if (!Array.isArray(list)) continue;
    for (const p of list) {
      const cleanP = cleanStr(p);
      if (cleanP) existingFaultLabelsUpper.add(`${normKey(rawCat)}::${normKey(cleanP)}`);
    }
  }
  const existingActionsByUpper = new Map<string, { rawKey: string; actions: string[] }>();
  for (const [k, acts] of Object.entries(existingActionsByPanne)) {
    const cleanK = cleanStr(k);
    if (!cleanK) continue;
    const cleanActs = Array.isArray(acts) ? acts.map((a) => cleanStr(a)).filter(Boolean) : [];
    existingActionsByUpper.set(normKey(cleanK), { rawKey: cleanK, actions: cleanActs });
    if (mode === 'MERGE' || rawFaults.length === 0) {
      workingActionsMap.set(cleanK, cleanActs);
    }
  }

  const seenFaultCodes = new Set<string>();
  const seenCategoryFaultPairs = new Set<string>();
  let fCreated = 0;
  let fUpdated = 0;
  let fUnchanged = 0;
  let fSkipped = 0;

  rawFaults.forEach((row: CmCatalogFaultRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      fSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawCode = cleanStr(row.code_fault ?? rowRec.code ?? rowRec.id);
    const rawCat = cleanStr(row.code_category ?? rowRec.category ?? rowRec.type_panne);
    const rawPanne = cleanStr(row.panne ?? rowRec.libelle ?? rowRec.anomalie);

    if (!rawCode && !rawCat && !rawPanne) {
      fSkipped++;
      return;
    }

    let hasForbidden = false;
    for (const fk of FORBIDDEN_CM_CATALOG_ROW_KEYS) {
      if (rowRec[fk] !== undefined && rowRec[fk] !== null && rowRec[fk] !== '') {
        rejected.push({
          stage: '07_PANNE_ACTIONS',
          entity: 'CM_FAULTS',
          row: rowNum,
          identifier: rawCode || rawPanne || `ROW-${rowNum}`,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Ligne ${rowNum} (CM_FAULTS [${rawCode || rawPanne}]) : le champ '${fk}' est interdit dans CM_CATALOG.`,
          blocking: true,
        });
        hasForbidden = true;
      }
    }
    if (hasForbidden) return;

    if (!rawCode) {
      rejected.push({
        stage: '07_PANNE_ACTIONS',
        entity: 'CM_FAULTS',
        row: rowNum,
        identifier: rawPanne,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (CM_FAULTS) : 'code_fault' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawCat) {
      rejected.push({
        stage: '07_PANNE_ACTIONS',
        entity: 'CM_FAULTS',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (CM_FAULTS [${rawCode}]) : 'code_category' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawPanne) {
      rejected.push({
        stage: '07_PANNE_ACTIONS',
        entity: 'CM_FAULTS',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (CM_FAULTS [${rawCode}]) : 'panne' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    const catKey = normKey(rawCat);
    if (seenFaultCodes.has(codeKey)) {
      rejected.push({
        stage: '07_PANNE_ACTIONS',
        entity: 'CM_FAULTS',
        row: rowNum,
        identifier: codeKey,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (CM_FAULTS) : doublon sur code_fault '${codeKey}'.`,
        blocking: true,
      });
      return;
    }
    seenFaultCodes.add(codeKey);

    if (!workingCategoriesMap.has(catKey)) {
      rejected.push({
        stage: '07_PANNE_ACTIONS',
        entity: 'CM_FAULTS',
        row: rowNum,
        identifier: codeKey,
        code: 'BROKEN_FK',
        message: `Ligne ${rowNum} (CM_FAULTS [${codeKey}]) : catégorie '${rawCat}' introuvable dans CM_CATEGORIES.`,
        blocking: true,
      });
      return;
    }

    const pairKey = `${catKey}::${normKey(rawPanne)}`;
    if (seenCategoryFaultPairs.has(pairKey)) {
      rejected.push({
        stage: '07_PANNE_ACTIONS',
        entity: 'CM_FAULTS',
        row: rowNum,
        identifier: codeKey,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (CM_FAULTS) : anomalie en doublon '${rawPanne}' dans la catégorie '${catKey}'.`,
        blocking: true,
      });
      return;
    }
    seenCategoryFaultPairs.add(pairKey);

    const catPannes = workingCategoriesMap.get(catKey) || [];
    const existedInCat = existingFaultLabelsUpper.has(pairKey);
    const existingActEntry = existingActionsByUpper.get(normKey(rawPanne));

    // Preserve unique normalized panne label inside category list
    const existingPanneMatch = catPannes.find((p) => normKey(p) === normKey(rawPanne));
    if (!existingPanneMatch) {
      catPannes.push(rawPanne);
      workingCategoriesMap.set(catKey, catPannes);
    }

    const incomingActionsRaw = Array.isArray(row.actions) ? row.actions : undefined;
    const normalizedActions: string[] = [];
    if (incomingActionsRaw) {
      const seenAct = new Set<string>();
      for (const act of incomingActionsRaw) {
        const cleanAct = cleanStr(act);
        const actKey = normKey(cleanAct);
        if (cleanAct && !seenAct.has(actKey)) {
          seenAct.add(actKey);
          normalizedActions.push(cleanAct);
        }
      }
    }

    if (incomingActionsRaw !== undefined) {
      if (normalizedActions.length > 0) {
        workingActionsMap.set(rawPanne, normalizedActions);
      } else if (mode === 'REPLACE_CATALOG') {
        workingActionsMap.delete(rawPanne);
      }
    }

    if (!existedInCat) {
      fCreated++;
    } else if (
      incomingActionsRaw !== undefined &&
      JSON.stringify(existingActEntry?.actions || []) !== JSON.stringify(normalizedActions)
    ) {
      fUpdated++;
    } else {
      fUnchanged++;
    }
  });

  // REPLACE_CATALOG active-reference guard against correctiveInterventions
  if (mode === 'REPLACE_CATALOG' && (rawCategories.length > 0 || rawFaults.length > 0)) {
    const retainedCategories = new Set(workingCategoriesMap.keys());
    const retainedFaultsUpper = new Set<string>();
    for (const pList of workingCategoriesMap.values()) {
      for (const p of pList) retainedFaultsUpper.add(normKey(p));
    }

    const removedCatRefs = new Map<string, number>();
    const removedFaultRefs = new Map<string, number>();

    for (const bt of existingCorrective) {
      const btCat = normKey(bt?.type_panne);
      if (rawCategories.length > 0 && btCat && existingCatKeys.has(btCat) && !retainedCategories.has(btCat)) {
        removedCatRefs.set(btCat, (removedCatRefs.get(btCat) || 0) + 1);
      }
      const btFault = cleanStr(bt?.anomalie);
      const btFaultUpper = normKey(btFault);
      if (
        rawFaults.length > 0 &&
        btFaultUpper &&
        !retainedFaultsUpper.has(btFaultUpper) &&
        Object.values(existingPanneCategories).some((arr) =>
          Array.isArray(arr) && arr.some((p) => normKey(p) === btFaultUpper)
        )
      ) {
        removedFaultRefs.set(btFaultUpper, (removedFaultRefs.get(btFaultUpper) || 0) + 1);
      }
    }

    for (const [catKey, count] of removedCatRefs.entries()) {
      rejected.push({
        stage: '07_PANNE_CATEGORIES',
        entity: 'CM_CATEGORIES',
        row: 0,
        identifier: catKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer la catégorie '${catKey}' en mode REPLACE_CATALOG : utilisée par ${count} intervention(s) corrective(s).`,
        blocking: true,
        referencedCount: count,
        referenceBreakdown: { correctiveInterventions: count },
      });
    }
    for (const [faultKey, count] of removedFaultRefs.entries()) {
      rejected.push({
        stage: '07_PANNE_ACTIONS',
        entity: 'CM_FAULTS',
        row: 0,
        identifier: faultKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer l'anomalie '${faultKey}' en mode REPLACE_CATALOG : référencée par ${count} intervention(s) corrective(s).`,
        blocking: true,
        referencedCount: count,
        referenceBreakdown: { correctiveInterventions: count },
      });
    }
  }

  accepted.push({
    stage: '07_PANNE_ACTIONS',
    entity: 'CM_FAULTS',
    created: fCreated,
    updated: fUpdated,
    unchanged: fUnchanged,
    skipped: fSkipped,
  });

  const nextPanneCategories: Record<string, string[]> = {};
  for (const [catKey, list] of workingCategoriesMap.entries()) {
    nextPanneCategories[catKey] = list;
  }
  const nextActionsByPanne: Record<string, string[]> = {};
  for (const [panneKey, acts] of workingActionsMap.entries()) {
    if (Array.isArray(acts) && acts.length > 0) {
      nextActionsByPanne[panneKey] = acts;
    }
  }

  const success = rejected.length === 0;
  let committed = false;

  if (success && !dryRun) {
    DataGateway.saveCorrectivePanneCategories(nextPanneCategories);
    DataGateway.saveCorrectiveActionsByPanne(nextActionsByPanne);
    store.setCorrectivePanneCategories(nextPanneCategories);
    store.setCorrectiveActionsByPanne(nextActionsByPanne);

    DataGateway.appendAuditEvent({
      actionType: 'SETTINGS_CONFIG_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'CM_CATALOG',
      actorId: options.actorId || 'ADMIN',
      actorName: options.actorName || 'Import Pipeline',
      actorRole,
      before: {
        categoriesCount: Object.keys(existingPanneCategories).length,
        actionsKeysCount: Object.keys(existingActionsByPanne).length,
      },
      after: {
        categoriesCount: Object.keys(nextPanneCategories).length,
        actionsKeysCount: Object.keys(nextActionsByPanne).length,
      },
      meta: { mode, origin },
    });

    committed = true;
    notifyPipelineCommitSync('CM_CATALOG', mode, origin);
  }

  return {
    bundleType: 'CM_CATALOG',
    success,
    dryRun,
    origin,
    mode,
    commitPolicy,
    committed,
    accepted,
    rejected,
    warnings,
    durationMs: Date.now() - startTime,
    staging: {
      nextPanneCategories,
      nextActionsByPanne,
    },
  };
}

/**
 * Reverse export for `CM_CATALOG` using stable `code_category` and `code_fault` identifiers (Type A Round-Trip).
 * Strictly Level 2 fault & recommended action catalog only: never exports live BTs or work orders.
 */
export function exportCmCatalogBundle(snapshot?: {
  panneCategories?: Record<string, string[]>;
  actionsByPanne?: Record<string, string[]>;
}): Required<Pick<CmCatalogBundleInput, 'bundleType' | 'categories' | 'faults'>> {
  const store = useGmaoStore.getState();
  const panneCategories = snapshot?.panneCategories ?? store.correctivePanneCategories ?? {};
  const actionsByPanne = snapshot?.actionsByPanne ?? store.correctiveActionsByPanne ?? {};

  const actionsByPanneUpper = new Map<string, string[]>();
  for (const [k, acts] of Object.entries(actionsByPanne)) {
    const cleanK = normKey(k);
    if (cleanK && Array.isArray(acts)) {
      actionsByPanneUpper.set(cleanK, acts.map((a) => cleanStr(a)).filter(Boolean));
    }
  }

  const categories: CmCatalogCategoryRow[] = [];
  const faults: CmCatalogFaultRow[] = [];

  for (const [rawCat, list] of Object.entries(panneCategories)) {
    const catKey = normKey(rawCat);
    if (!catKey) continue;
    categories.push({
      code_category: catKey,
      libelle: DEFAULT_CM_CATEGORY_LABELS[catKey] || catKey,
    });
    const pannes = Array.isArray(list) ? list : [];
    pannes.forEach((rawPanne, idx) => {
      const panne = cleanStr(rawPanne);
      if (!panne) return;
      const acts =
        actionsByPanne[panne] || actionsByPanneUpper.get(normKey(panne)) || [];
      faults.push({
        code_fault: `PANNE-${catKey}-${String(idx + 1).padStart(2, '0')}`,
        code_category: catKey,
        panne,
        actions: Array.isArray(acts) ? acts.map((a) => cleanStr(a)).filter(Boolean) : [],
      });
    });
  }

  return {
    bundleType: 'CM_CATALOG',
    categories,
    faults,
  };
}

/**
 * Returns a fresh clone of the official `CM_CATALOG` template (`templates/import/CM_CATALOG.template.json`).
 */
export function getCmCatalogOfficialTemplate(): CmCatalogBundleInput & {
  bundleType: 'CM_CATALOG';
} {
  return JSON.parse(JSON.stringify(cmCatalogOfficialTemplate));
}
