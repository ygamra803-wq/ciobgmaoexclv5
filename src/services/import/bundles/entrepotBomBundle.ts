import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import {
  ICompFamily,
  ICompGroup,
  ICompTemplate,
  IPartDesignation,
  IPartGroup,
  IPartType,
} from '../../../types/domain';
import entrepotBomOfficialTemplate from '../../../../templates/import/ENTREPOT_BOM.template.json';
import {
  AcceptedStageRecord,
  EntrepotBomBundleInput,
  EntrepotBomCompFamilyRow,
  EntrepotBomCompGroupRow,
  EntrepotBomCompTemplateRow,
  EntrepotBomPartDesignationRow,
  EntrepotBomPartGroupRow,
  EntrepotBomPartTypeRow,
  EntrepotBomStagingResult,
  ImportCommitPolicy,
  ImportIssue,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  PipelineStageId,
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';
import {
  cleanStr,
  FORBIDDEN_ENTREPOT_BOM_ROOT_KEYS,
  FORBIDDEN_ENTREPOT_BOM_ROW_KEYS,
  normalizeBomPolicyTags,
  normKey,
  notifyPipelineCommitSync,
} from '../pipelineShared';

/**
 * Validates and optionally commits an `ENTREPOT_BOM` bundle (`Level 2 Components & Parts Hierarchy Only`):
 * `06_COMP_GROUPS -> 06_COMP_FAMILIES -> 06_COMP_TEMPLATES`
 * and `06_PART_GROUPS -> 06_PART_TYPES -> 06_PART_DESIGNATIONS`.
 *
 * Strictly rejects any physical warehouse instance, mounted ledger item, machine, or movement field.
 */
export function validateAndCommitEntrepotBomBundle(
  input: EntrepotBomBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<EntrepotBomStagingResult> {
  const startTime = Date.now();
  const mode: ImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const origin: ImportSourceOrigin = options.origin || 'JSON_BUNDLE';
  const commitPolicy: ImportCommitPolicy = options.commitPolicy || 'ATOMIC';
  const dryRun = Boolean(options.dryRun);
  const actorRole = normKey(options.actorRole || 'ADMIN');

  const store = useGmaoStore.getState();
  const existingCompGroups = options.existingCompGroups ?? store.compGroups ?? [];
  const existingCompFamilies = options.existingCompFamilies ?? store.compFamilies ?? [];
  const existingCompTemplates = options.existingCompTemplates ?? store.compTemplates ?? [];
  const existingPartGroups = options.existingPartGroups ?? store.partGroups ?? [];
  const existingPartTypes = options.existingPartTypes ?? store.partTypes ?? [];
  const existingPartDesignations =
    options.existingPartDesignations ?? store.partDesignations ?? [];
  const existingWarehouseItems = options.existingWarehouseItems ?? store.warehouseItems ?? [];
  const existingEntrepotComponents =
    options.existingEntrepotComponents ?? store.entrepotComponents ?? [];
  const existingMachineElementsLedger =
    options.existingMachineElementsLedger ?? store.machineElementsLedger ?? [];

  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const accepted: AcceptedStageRecord[] = [];

  const abortReport = (): ImportReport<EntrepotBomStagingResult> => ({
    bundleType: 'ENTREPOT_BOM',
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
      nextCompGroups: [...existingCompGroups],
      nextCompFamilies: [...existingCompFamilies],
      nextCompTemplates: [...existingCompTemplates],
      nextPartGroups: [...existingPartGroups],
      nextPartTypes: [...existingPartTypes],
      nextPartDesignations: [...existingPartDesignations],
    },
  });

  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    rejected.push({
      stage: '06_COMP_GROUPS',
      entity: 'ENTREPOT_BOM',
      row: 0,
      code: 'RBAC_DENIED',
      message: 'Accès refusé : le mode REPLACE_CATALOG est strictement réservé au rôle ADMIN.',
      blocking: true,
    });
    return abortReport();
  }

  if (!input || typeof input !== 'object') {
    rejected.push({
      stage: '06_COMP_GROUPS',
      entity: 'ENTREPOT_BOM',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: 'Format de paquet ENTREPOT_BOM invalide.',
      blocking: true,
    });
    return abortReport();
  }

  for (const forbiddenKey of FORBIDDEN_ENTREPOT_BOM_ROOT_KEYS) {
    const val = (input as Record<string, unknown>)[forbiddenKey];
    if (
      (Array.isArray(val) && val.length > 0) ||
      (!Array.isArray(val) && val !== undefined && val !== null)
    ) {
      rejected.push({
        stage: '06_COMP_GROUPS',
        entity: 'ENTREPOT_BOM',
        row: 0,
        identifier: forbiddenKey,
        code: 'FORBIDDEN_BUNDLE_FIELD',
        message: `Le paquet ENTREPOT_BOM (Niveau 2 Référentiels Entrepôt) interdit l'inclusion de '${forbiddenKey}'.`,
        blocking: true,
      });
    }
  }

  const rawCompGroups = Array.isArray(input.compGroups) ? input.compGroups : [];
  const rawCompFamilies = Array.isArray(input.compFamilies) ? input.compFamilies : [];
  const rawCompTemplates = Array.isArray(input.compTemplates) ? input.compTemplates : [];
  const rawPartGroups = Array.isArray(input.partGroups) ? input.partGroups : [];
  const rawPartTypes = Array.isArray(input.partTypes) ? input.partTypes : [];
  const rawPartDesignations = Array.isArray(input.partDesignations)
    ? input.partDesignations
    : [];

  if (
    !Array.isArray(input.compGroups) &&
    !Array.isArray(input.compFamilies) &&
    !Array.isArray(input.compTemplates) &&
    !Array.isArray(input.partGroups) &&
    !Array.isArray(input.partTypes) &&
    !Array.isArray(input.partDesignations)
  ) {
    rejected.push({
      stage: '06_COMP_GROUPS',
      entity: 'ENTREPOT_BOM',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message:
        'Format ENTREPOT_BOM invalide : au moins une collection BOM (compGroups, compFamilies, compTemplates, partGroups, partTypes, partDesignations) est requise.',
      blocking: true,
    });
    return abortReport();
  }

  const checkRowForbiddenKeys = (
    row: Record<string, unknown>,
    stage: PipelineStageId,
    entity: string,
    rowNum: number,
    identifier: string
  ): boolean => {
    let found = false;
    for (const fk of FORBIDDEN_ENTREPOT_BOM_ROW_KEYS) {
      if (row[fk] !== undefined && row[fk] !== null && row[fk] !== '') {
        rejected.push({
          stage,
          entity,
          row: rowNum,
          identifier,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Ligne ${rowNum} (${entity} [${identifier}]) : le champ '${fk}' est interdit dans ENTREPOT_BOM (référentiel Niveau 2 uniquement).`,
          blocking: true,
        });
        found = true;
      }
    }
    return found;
  };

  // =========================================================================
  // STAGE 1: 06_COMP_GROUPS
  // =========================================================================
  const workingCompGroupsMap = new Map<string, ICompGroup>();
  const compGroupLookup = new Map<string, string>();
  const registerCompGroup = (key: string, g: ICompGroup) => {
    workingCompGroupsMap.set(key, g);
    compGroupLookup.set(key, key);
    if (g.code) compGroupLookup.set(normKey(g.code), key);
    if (g.id_groupe) compGroupLookup.set(normKey(g.id_groupe), key);
    if (g.id_group) compGroupLookup.set(normKey(g.id_group), key);
    if (g.id) compGroupLookup.set(normKey(g.id), key);
  };

  if (mode === 'MERGE' || rawCompGroups.length === 0) {
    for (const g of existingCompGroups) {
      if (!g) continue;
      const key = normKey(g.id_groupe || g.id_group || g.id || g.code);
      if (!key) continue;
      registerCompGroup(key, {
        ...g,
        id: key,
        id_groupe: key,
        id_group: key,
        code: cleanStr(g.code) || key,
      });
    }
  }

  const seenCompGroups = new Set<string>();
  let cgCreated = 0;
  let cgUpdated = 0;
  let cgUnchanged = 0;
  let cgSkipped = 0;

  rawCompGroups.forEach((row: EntrepotBomCompGroupRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      cgSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawCode = cleanStr(
      row.code_comp_group ?? rowRec.id_groupe ?? rowRec.id_group ?? rowRec.id ?? row.code
    );
    const rawLibelle = cleanStr(row.libelle ?? rowRec.nom);
    if (!rawCode && !rawLibelle) {
      cgSkipped++;
      return;
    }
    if (checkRowForbiddenKeys(rowRec, '06_COMP_GROUPS', 'COMP_GROUPS', rowNum, rawCode || `ROW-${rowNum}`)) {
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '06_COMP_GROUPS',
        entity: 'COMP_GROUPS',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_GROUPS) : 'code_comp_group' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '06_COMP_GROUPS',
        entity: 'COMP_GROUPS',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_GROUPS [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    const key = normKey(rawCode);
    if (seenCompGroups.has(key)) {
      rejected.push({
        stage: '06_COMP_GROUPS',
        entity: 'COMP_GROUPS',
        row: rowNum,
        identifier: key,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (COMP_GROUPS) : doublon sur code_comp_group '${key}'.`,
        blocking: true,
      });
      return;
    }
    seenCompGroups.add(key);

    const prev = workingCompGroupsMap.get(key);
    const nextRecord: ICompGroup = {
      ...(prev || {}),
      id: key,
      id_groupe: key,
      id_group: key,
      code: cleanStr(row.code) || prev?.code || key,
      libelle: rawLibelle,
      ref: cleanStr(row.ref ?? prev?.ref ?? ''),
      description: cleanStr(row.description ?? prev?.description ?? ''),
      ...(cleanStr(row.domaine_technique ?? prev?.domaine_technique)
        ? { domaine_technique: cleanStr(row.domaine_technique ?? prev?.domaine_technique) }
        : {}),
      created_at: cleanStr(row.created_at ?? prev?.created_at ?? new Date().toISOString().slice(0, 10)),
    };

    if (prev) {
      if (
        prev.libelle === nextRecord.libelle &&
        (prev.code || '') === (nextRecord.code || '') &&
        (prev.description || '') === (nextRecord.description || '')
      ) {
        cgUnchanged++;
      } else {
        cgUpdated++;
      }
    } else {
      cgCreated++;
    }
    registerCompGroup(key, nextRecord);
  });

  accepted.push({
    stage: '06_COMP_GROUPS',
    entity: 'COMP_GROUPS',
    created: cgCreated,
    updated: cgUpdated,
    unchanged: cgUnchanged,
    skipped: cgSkipped,
  });

  // =========================================================================
  // STAGE 2: 06_COMP_FAMILIES (FK -> COMP_GROUPS)
  // =========================================================================
  const workingCompFamiliesMap = new Map<string, ICompFamily>();
  const compFamilyLookup = new Map<string, string>();
  const registerCompFamily = (key: string, f: ICompFamily) => {
    workingCompFamiliesMap.set(key, f);
    compFamilyLookup.set(key, key);
    if (f.id_comp_family) compFamilyLookup.set(normKey(f.id_comp_family), key);
    if (f.id_family) compFamilyLookup.set(normKey(f.id_family), key);
    if (f.id) compFamilyLookup.set(normKey(f.id), key);
    if (f.code && !compFamilyLookup.has(normKey(f.code))) {
      compFamilyLookup.set(normKey(f.code), key);
    }
  };

  if (mode === 'MERGE' || rawCompFamilies.length === 0) {
    for (const f of existingCompFamilies) {
      if (!f) continue;
      const key = normKey(f.id_comp_family || f.id_family || f.id || f.code);
      if (!key) continue;
      registerCompFamily(key, {
        ...f,
        id: key,
        id_comp_family: key,
        id_family: key,
      });
    }
  }

  const seenCompFamilies = new Set<string>();
  let cfCreated = 0;
  let cfUpdated = 0;
  let cfUnchanged = 0;
  let cfSkipped = 0;

  rawCompFamilies.forEach((row: EntrepotBomCompFamilyRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      cfSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawCode = cleanStr(
      row.code_comp_family ?? rowRec.id_comp_family ?? rowRec.id_family ?? rowRec.id ?? row.code
    );
    const rawGroup = cleanStr(row.code_comp_group ?? rowRec.id_groupe ?? rowRec.id_group);
    const rawLibelle = cleanStr(row.libelle ?? rowRec.nom);
    if (!rawCode && !rawLibelle) {
      cfSkipped++;
      return;
    }
    if (checkRowForbiddenKeys(rowRec, '06_COMP_FAMILIES', 'COMP_FAMILIES', rowNum, rawCode || `ROW-${rowNum}`)) {
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '06_COMP_FAMILIES',
        entity: 'COMP_FAMILIES',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_FAMILIES) : 'code_comp_family' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawGroup) {
      rejected.push({
        stage: '06_COMP_FAMILIES',
        entity: 'COMP_FAMILIES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_FAMILIES [${rawCode}]) : 'code_comp_group' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '06_COMP_FAMILIES',
        entity: 'COMP_FAMILIES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_FAMILIES [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const key = normKey(rawCode);
    if (seenCompFamilies.has(key)) {
      rejected.push({
        stage: '06_COMP_FAMILIES',
        entity: 'COMP_FAMILIES',
        row: rowNum,
        identifier: key,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (COMP_FAMILIES) : doublon sur code_comp_family '${key}'.`,
        blocking: true,
      });
      return;
    }
    seenCompFamilies.add(key);

    const resolvedGroupKey = compGroupLookup.get(normKey(rawGroup));
    if (!resolvedGroupKey || !workingCompGroupsMap.has(resolvedGroupKey)) {
      rejected.push({
        stage: '06_COMP_FAMILIES',
        entity: 'COMP_FAMILIES',
        row: rowNum,
        identifier: key,
        code: 'BROKEN_FK',
        message: `Ligne ${rowNum} (COMP_FAMILIES [${key}]) : groupe parent '${rawGroup}' introuvable dans COMP_GROUPS.`,
        blocking: true,
      });
      return;
    }

    const prev = workingCompFamiliesMap.get(key);
    const nextRecord: ICompFamily = {
      ...(prev || {}),
      id: key,
      id_comp_family: key,
      id_family: key,
      id_groupe: resolvedGroupKey,
      id_group: resolvedGroupKey,
      code: cleanStr(row.code) || prev?.code || key,
      libelle: rawLibelle,
      type: cleanStr(row.type) || prev?.type || rawLibelle,
      ref: cleanStr(row.ref ?? prev?.ref ?? ''),
      description: cleanStr(row.description ?? prev?.description ?? ''),
    };

    if (prev) {
      if (
        prev.libelle === nextRecord.libelle &&
        normKey(prev.id_groupe || prev.id_group) === resolvedGroupKey &&
        (prev.description || '') === (nextRecord.description || '')
      ) {
        cfUnchanged++;
      } else {
        cfUpdated++;
      }
    } else {
      cfCreated++;
    }
    registerCompFamily(key, nextRecord);
  });

  accepted.push({
    stage: '06_COMP_FAMILIES',
    entity: 'COMP_FAMILIES',
    created: cfCreated,
    updated: cfUpdated,
    unchanged: cfUnchanged,
    skipped: cfSkipped,
  });

  // =========================================================================
  // STAGE 3: 06_COMP_TEMPLATES (FK -> COMP_FAMILIES + optional COMP_GROUPS)
  // =========================================================================
  const workingCompTemplatesMap = new Map<string, ICompTemplate>();
  if (mode === 'MERGE' || rawCompTemplates.length === 0) {
    for (const t of existingCompTemplates) {
      if (!t) continue;
      const key = normKey(
        t.id_template || t.id_templates || (t as Record<string, unknown>).id_comp_template || t.id || t.code
      );
      if (!key) continue;
      workingCompTemplatesMap.set(key, {
        ...t,
        id: key,
        id_template: key,
        id_templates: key,
      });
    }
  }

  const seenCompTemplates = new Set<string>();
  let ctCreated = 0;
  let ctUpdated = 0;
  let ctUnchanged = 0;
  let ctSkipped = 0;

  rawCompTemplates.forEach((row: EntrepotBomCompTemplateRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      ctSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawCode = cleanStr(
      row.code_comp_template ??
        rowRec.id_template ??
        rowRec.id_templates ??
        rowRec.id_comp_template ??
        rowRec.id ??
        row.code
    );
    const rawFamily = cleanStr(row.code_comp_family ?? rowRec.id_family);
    const rawGroup = cleanStr(row.code_comp_group ?? rowRec.id_groupe ?? rowRec.id_group);
    const rawLibelle = cleanStr(row.libelle ?? rowRec.nom);
    if (!rawCode && !rawLibelle) {
      ctSkipped++;
      return;
    }
    if (
      checkRowForbiddenKeys(
        rowRec,
        '06_COMP_TEMPLATES',
        'COMP_TEMPLATES',
        rowNum,
        rawCode || `ROW-${rowNum}`
      )
    ) {
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '06_COMP_TEMPLATES',
        entity: 'COMP_TEMPLATES',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_TEMPLATES) : 'code_comp_template' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawFamily) {
      rejected.push({
        stage: '06_COMP_TEMPLATES',
        entity: 'COMP_TEMPLATES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_TEMPLATES [${rawCode}]) : 'code_comp_family' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '06_COMP_TEMPLATES',
        entity: 'COMP_TEMPLATES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (COMP_TEMPLATES [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const key = normKey(rawCode);
    if (seenCompTemplates.has(key)) {
      rejected.push({
        stage: '06_COMP_TEMPLATES',
        entity: 'COMP_TEMPLATES',
        row: rowNum,
        identifier: key,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (COMP_TEMPLATES) : doublon sur code_comp_template '${key}'.`,
        blocking: true,
      });
      return;
    }
    seenCompTemplates.add(key);

    const resolvedFamilyKey = compFamilyLookup.get(normKey(rawFamily));
    const resolvedFamily = resolvedFamilyKey ? workingCompFamiliesMap.get(resolvedFamilyKey) : undefined;
    if (!resolvedFamilyKey || !resolvedFamily) {
      rejected.push({
        stage: '06_COMP_TEMPLATES',
        entity: 'COMP_TEMPLATES',
        row: rowNum,
        identifier: key,
        code: 'BROKEN_FK',
        message: `Ligne ${rowNum} (COMP_TEMPLATES [${key}]) : famille parent '${rawFamily}' introuvable dans COMP_FAMILIES.`,
        blocking: true,
      });
      return;
    }

    const familyGroupKey = normKey(resolvedFamily.id_groupe || resolvedFamily.id_group);
    let effectiveGroupKey = familyGroupKey;
    if (rawGroup) {
      const resolvedGroupKey = compGroupLookup.get(normKey(rawGroup));
      if (!resolvedGroupKey || !workingCompGroupsMap.has(resolvedGroupKey)) {
        rejected.push({
          stage: '06_COMP_TEMPLATES',
          entity: 'COMP_TEMPLATES',
          row: rowNum,
          identifier: key,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (COMP_TEMPLATES [${key}]) : groupe '${rawGroup}' introuvable dans COMP_GROUPS.`,
          blocking: true,
        });
        return;
      }
      if (familyGroupKey && resolvedGroupKey !== familyGroupKey) {
        rejected.push({
          stage: '06_COMP_TEMPLATES',
          entity: 'COMP_TEMPLATES',
          row: rowNum,
          identifier: key,
          code: 'TEMPLATE_FAMILY_MISMATCH',
          message: `Ligne ${rowNum} (COMP_TEMPLATES [${key}]) : le groupe '${resolvedGroupKey}' ne correspond pas au groupe '${familyGroupKey}' de la famille '${resolvedFamilyKey}'.`,
          blocking: true,
        });
        return;
      }
      effectiveGroupKey = resolvedGroupKey;
    }

    const prev = workingCompTemplatesMap.get(key);
    const nextRecord: ICompTemplate = {
      ...(prev || {}),
      id: key,
      id_template: key,
      id_templates: key,
      id_family: resolvedFamilyKey,
      ...(effectiveGroupKey ? { id_groupe: effectiveGroupKey, id_group: effectiveGroupKey } : {}),
      code: cleanStr(row.code) || prev?.code || key,
      ref: cleanStr(row.ref ?? prev?.ref ?? ''),
      libelle: rawLibelle,
      type: cleanStr(row.type) || prev?.type || resolvedFamily.type || resolvedFamily.libelle,
      ...(cleanStr(row.mode_reparation_defaut ?? prev?.mode_reparation_defaut)
        ? {
            mode_reparation_defaut: cleanStr(
              row.mode_reparation_defaut ?? prev?.mode_reparation_defaut
            ),
          }
        : {}),
      ...(cleanStr(row.tension_nominale ?? prev?.tension_nominale)
        ? { tension_nominale: cleanStr(row.tension_nominale ?? prev?.tension_nominale) }
        : {}),
      ...(row.courant_nominal_a !== undefined && row.courant_nominal_a !== ''
        ? { courant_nominal_a: row.courant_nominal_a }
        : prev?.courant_nominal_a !== undefined
        ? { courant_nominal_a: prev.courant_nominal_a }
        : {}),
      ...(cleanStr(row.indice_protection ?? prev?.indice_protection)
        ? { indice_protection: cleanStr(row.indice_protection ?? prev?.indice_protection) }
        : {}),
      ...(cleanStr(row.type_fixation ?? prev?.type_fixation)
        ? { type_fixation: cleanStr(row.type_fixation ?? prev?.type_fixation) }
        : {}),
      ...(row.specs && typeof row.specs === 'object' && !Array.isArray(row.specs)
        ? { specs: row.specs }
        : prev?.specs
        ? { specs: prev.specs }
        : {}),
      ...(cleanStr(row.description ?? prev?.description)
        ? { description: cleanStr(row.description ?? prev?.description) }
        : {}),
    };

    if (prev) {
      if (
        prev.libelle === nextRecord.libelle &&
        normKey(prev.id_family) === resolvedFamilyKey &&
        (prev.ref || '') === (nextRecord.ref || '')
      ) {
        ctUnchanged++;
      } else {
        ctUpdated++;
      }
    } else {
      ctCreated++;
    }
    workingCompTemplatesMap.set(key, nextRecord);
  });

  accepted.push({
    stage: '06_COMP_TEMPLATES',
    entity: 'COMP_TEMPLATES',
    created: ctCreated,
    updated: ctUpdated,
    unchanged: ctUnchanged,
    skipped: ctSkipped,
  });

  // =========================================================================
  // STAGE 4: 06_PART_GROUPS
  // =========================================================================
  const workingPartGroupsMap = new Map<string, IPartGroup>();
  const partGroupLookup = new Map<string, string>();
  const registerPartGroup = (key: string, g: IPartGroup) => {
    workingPartGroupsMap.set(key, g);
    partGroupLookup.set(key, key);
    if (g.id_groupe) partGroupLookup.set(normKey(g.id_groupe), key);
    if (g.id_group) partGroupLookup.set(normKey(g.id_group), key);
    if (g.id) partGroupLookup.set(normKey(g.id), key);
    if (g.code) partGroupLookup.set(normKey(g.code), key);
  };

  if (mode === 'MERGE' || rawPartGroups.length === 0) {
    for (const g of existingPartGroups) {
      if (!g) continue;
      const key = normKey(g.id_groupe || g.id_group || g.id || g.code);
      if (!key) continue;
      registerPartGroup(key, {
        ...g,
        id: key,
        id_groupe: key,
        id_group: key,
        code: cleanStr(g.code) || key,
      });
    }
  }

  const seenPartGroups = new Set<string>();
  let pgCreated = 0;
  let pgUpdated = 0;
  let pgUnchanged = 0;
  let pgSkipped = 0;

  rawPartGroups.forEach((row: EntrepotBomPartGroupRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      pgSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawCode = cleanStr(
      row.code_part_group ?? rowRec.id_groupe ?? rowRec.id_group ?? rowRec.id ?? row.code
    );
    const rawLibelle = cleanStr(row.libelle ?? rowRec.nom);
    if (!rawCode && !rawLibelle) {
      pgSkipped++;
      return;
    }
    if (checkRowForbiddenKeys(rowRec, '06_PART_GROUPS', 'PART_GROUPS', rowNum, rawCode || `ROW-${rowNum}`)) {
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '06_PART_GROUPS',
        entity: 'PART_GROUPS',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_GROUPS) : 'code_part_group' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '06_PART_GROUPS',
        entity: 'PART_GROUPS',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_GROUPS [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    const key = normKey(rawCode);
    if (seenPartGroups.has(key)) {
      rejected.push({
        stage: '06_PART_GROUPS',
        entity: 'PART_GROUPS',
        row: rowNum,
        identifier: key,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (PART_GROUPS) : doublon sur code_part_group '${key}'.`,
        blocking: true,
      });
      return;
    }
    seenPartGroups.add(key);

    const prev = workingPartGroupsMap.get(key);
    const nextRecord: IPartGroup = {
      ...(prev || {}),
      id: key,
      id_groupe: key,
      id_group: key,
      code: cleanStr(row.code) || prev?.code || key,
      libelle: rawLibelle,
      description: cleanStr(row.description ?? prev?.description ?? ''),
      ...(cleanStr(row.domaine_technique ?? prev?.domaine_technique)
        ? { domaine_technique: cleanStr(row.domaine_technique ?? prev?.domaine_technique) }
        : {}),
      default_policy_tags:
        row.default_policy_tags !== undefined
          ? normalizeBomPolicyTags(row.default_policy_tags)
          : prev?.default_policy_tags || ['REPLACING'],
      sort_order: Number(row.sort_order ?? prev?.sort_order ?? (idx + 1) * 10) || (idx + 1) * 10,
      is_active: row.is_active !== false,
      created_at: cleanStr(prev?.created_at || new Date().toISOString().slice(0, 10)),
    };

    if (prev) {
      if (
        prev.libelle === nextRecord.libelle &&
        (prev.code || '') === (nextRecord.code || '') &&
        (prev.description || '') === (nextRecord.description || '')
      ) {
        pgUnchanged++;
      } else {
        pgUpdated++;
      }
    } else {
      pgCreated++;
    }
    registerPartGroup(key, nextRecord);
  });

  accepted.push({
    stage: '06_PART_GROUPS',
    entity: 'PART_GROUPS',
    created: pgCreated,
    updated: pgUpdated,
    unchanged: pgUnchanged,
    skipped: pgSkipped,
  });

  // =========================================================================
  // STAGE 5: 06_PART_TYPES (FK -> PART_GROUPS)
  // =========================================================================
  const workingPartTypesMap = new Map<string, IPartType>();
  if (mode === 'MERGE' || rawPartTypes.length === 0) {
    for (const pt of existingPartTypes) {
      if (!pt) continue;
      const key = normKey(pt.id_type || pt.id);
      if (!key) continue;
      workingPartTypesMap.set(key, {
        ...pt,
        id_type: key,
        id: key,
      });
    }
  }

  const seenPartTypes = new Set<string>();
  let ptCreated = 0;
  let ptUpdated = 0;
  let ptUnchanged = 0;
  let ptSkipped = 0;

  rawPartTypes.forEach((row: EntrepotBomPartTypeRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      ptSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawCode = cleanStr(row.code_part_type ?? rowRec.id_type ?? rowRec.id);
    const rawGroup = cleanStr(row.code_part_group ?? rowRec.id_group ?? rowRec.id_groupe);
    const rawLibelle = cleanStr(row.libelle ?? rowRec.nom);
    if (!rawCode && !rawLibelle) {
      ptSkipped++;
      return;
    }
    if (checkRowForbiddenKeys(rowRec, '06_PART_TYPES', 'PART_TYPES', rowNum, rawCode || `ROW-${rowNum}`)) {
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '06_PART_TYPES',
        entity: 'PART_TYPES',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_TYPES) : 'code_part_type' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawGroup) {
      rejected.push({
        stage: '06_PART_TYPES',
        entity: 'PART_TYPES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_TYPES [${rawCode}]) : 'code_part_group' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '06_PART_TYPES',
        entity: 'PART_TYPES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_TYPES [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const key = normKey(rawCode);
    if (seenPartTypes.has(key)) {
      rejected.push({
        stage: '06_PART_TYPES',
        entity: 'PART_TYPES',
        row: rowNum,
        identifier: key,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (PART_TYPES) : doublon sur code_part_type '${key}'.`,
        blocking: true,
      });
      return;
    }
    seenPartTypes.add(key);

    const resolvedGroupKey = partGroupLookup.get(normKey(rawGroup));
    if (!resolvedGroupKey || !workingPartGroupsMap.has(resolvedGroupKey)) {
      rejected.push({
        stage: '06_PART_TYPES',
        entity: 'PART_TYPES',
        row: rowNum,
        identifier: key,
        code: 'BROKEN_FK',
        message: `Ligne ${rowNum} (PART_TYPES [${key}]) : groupe parent '${rawGroup}' introuvable dans PART_GROUPS.`,
        blocking: true,
      });
      return;
    }

    const prev = workingPartTypesMap.get(key);
    const nextRecord: IPartType = {
      ...(prev || {}),
      id_type: key,
      id: key,
      id_group: resolvedGroupKey,
      id_groupe: resolvedGroupKey,
      libelle: rawLibelle,
      ...(cleanStr(row.description ?? prev?.description)
        ? { description: cleanStr(row.description ?? prev?.description) }
        : {}),
      ...(cleanStr(row.domaine_technique ?? prev?.domaine_technique)
        ? { domaine_technique: cleanStr(row.domaine_technique ?? prev?.domaine_technique) }
        : {}),
    };

    if (prev) {
      if (
        (prev.libelle || prev.nom) === nextRecord.libelle &&
        normKey(prev.id_group || prev.id_groupe) === resolvedGroupKey
      ) {
        ptUnchanged++;
      } else {
        ptUpdated++;
      }
    } else {
      ptCreated++;
    }
    workingPartTypesMap.set(key, nextRecord);
  });

  accepted.push({
    stage: '06_PART_TYPES',
    entity: 'PART_TYPES',
    created: ptCreated,
    updated: ptUpdated,
    unchanged: ptUnchanged,
    skipped: ptSkipped,
  });

  // =========================================================================
  // STAGE 6: 06_PART_DESIGNATIONS (FK -> PART_TYPES + PART_GROUPS)
  // =========================================================================
  const workingPartDesignationsMap = new Map<string, IPartDesignation>();
  if (mode === 'MERGE' || rawPartDesignations.length === 0) {
    for (const pd of existingPartDesignations) {
      if (!pd) continue;
      const key = normKey(pd.ref || pd.id_part || pd.id);
      if (!key) continue;
      workingPartDesignationsMap.set(key, {
        ...pd,
        ref: cleanStr(pd.ref) || key,
        id_part: cleanStr(pd.id_part) || key,
      });
    }
  }

  const seenPartDesignations = new Set<string>();
  let pdCreated = 0;
  let pdUpdated = 0;
  let pdUnchanged = 0;
  let pdSkipped = 0;

  rawPartDesignations.forEach((row: EntrepotBomPartDesignationRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      pdSkipped++;
      return;
    }
    const rowRec = row as Record<string, unknown>;
    const rawRef = cleanStr(row.ref ?? rowRec.id_part ?? rowRec.id);
    const rawType = cleanStr(row.code_part_type ?? rowRec.id_type ?? rowRec.type);
    const rawGroup = cleanStr(row.code_part_group ?? rowRec.id_group ?? rowRec.id_groupe);
    const rawDesignation = cleanStr(row.designation ?? row.libelle);
    if (!rawRef && !rawDesignation) {
      pdSkipped++;
      return;
    }
    if (
      checkRowForbiddenKeys(
        rowRec,
        '06_PART_DESIGNATIONS',
        'PART_DESIGNATIONS',
        rowNum,
        rawRef || `ROW-${rowNum}`
      )
    ) {
      return;
    }
    if (!rawRef) {
      rejected.push({
        stage: '06_PART_DESIGNATIONS',
        entity: 'PART_DESIGNATIONS',
        row: rowNum,
        identifier: rawDesignation,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_DESIGNATIONS) : 'ref' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawType) {
      rejected.push({
        stage: '06_PART_DESIGNATIONS',
        entity: 'PART_DESIGNATIONS',
        row: rowNum,
        identifier: rawRef,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_DESIGNATIONS [${rawRef}]) : 'code_part_type' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawDesignation) {
      rejected.push({
        stage: '06_PART_DESIGNATIONS',
        entity: 'PART_DESIGNATIONS',
        row: rowNum,
        identifier: rawRef,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PART_DESIGNATIONS [${rawRef}]) : 'designation' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const key = normKey(rawRef);
    if (seenPartDesignations.has(key)) {
      rejected.push({
        stage: '06_PART_DESIGNATIONS',
        entity: 'PART_DESIGNATIONS',
        row: rowNum,
        identifier: key,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (PART_DESIGNATIONS) : doublon sur ref '${rawRef}'.`,
        blocking: true,
      });
      return;
    }
    seenPartDesignations.add(key);

    const resolvedTypeKey = normKey(rawType);
    const resolvedType = workingPartTypesMap.get(resolvedTypeKey);
    if (!resolvedType) {
      rejected.push({
        stage: '06_PART_DESIGNATIONS',
        entity: 'PART_DESIGNATIONS',
        row: rowNum,
        identifier: key,
        code: 'BROKEN_FK',
        message: `Ligne ${rowNum} (PART_DESIGNATIONS [${rawRef}]) : type parent '${rawType}' introuvable dans PART_TYPES.`,
        blocking: true,
      });
      return;
    }

    const typeGroupKey = normKey(resolvedType.id_group || resolvedType.id_groupe);
    let effectiveGroupKey = typeGroupKey;
    if (rawGroup) {
      const resolvedGroupKey = partGroupLookup.get(normKey(rawGroup));
      if (!resolvedGroupKey || !workingPartGroupsMap.has(resolvedGroupKey)) {
        rejected.push({
          stage: '06_PART_DESIGNATIONS',
          entity: 'PART_DESIGNATIONS',
          row: rowNum,
          identifier: key,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (PART_DESIGNATIONS [${rawRef}]) : groupe '${rawGroup}' introuvable dans PART_GROUPS.`,
          blocking: true,
        });
        return;
      }
      if (typeGroupKey && resolvedGroupKey !== typeGroupKey) {
        rejected.push({
          stage: '06_PART_DESIGNATIONS',
          entity: 'PART_DESIGNATIONS',
          row: rowNum,
          identifier: key,
          code: 'TEMPLATE_FAMILY_MISMATCH',
          message: `Ligne ${rowNum} (PART_DESIGNATIONS [${rawRef}]) : le groupe '${resolvedGroupKey}' ne correspond pas au groupe '${typeGroupKey}' du type '${resolvedTypeKey}'.`,
          blocking: true,
        });
        return;
      }
      effectiveGroupKey = resolvedGroupKey;
    }

    if (row.seuil !== undefined && row.seuil !== null && String(row.seuil) !== '') {
      const numSeuil = Number(row.seuil);
      if (Number.isNaN(numSeuil) || numSeuil < 0) {
        rejected.push({
          stage: '06_PART_DESIGNATIONS',
          entity: 'PART_DESIGNATIONS',
          row: rowNum,
          identifier: key,
          code: 'SCHEMA_MISMATCH',
          message: `Ligne ${rowNum} (PART_DESIGNATIONS [${rawRef}]) : seuil invalide (${row.seuil}).`,
          blocking: true,
        });
        return;
      }
    }

    const prev = workingPartDesignationsMap.get(key);
    const nextRecord: IPartDesignation = {
      ...(prev || {}),
      id_part: rawRef,
      id: rawRef,
      ref: rawRef,
      designation: rawDesignation,
      libelle: cleanStr(row.libelle) || rawDesignation,
      ...(effectiveGroupKey ? { id_group: effectiveGroupKey, id_groupe: effectiveGroupKey } : {}),
      id_type: resolvedTypeKey,
      type: resolvedTypeKey,
      ...(cleanStr(row.id_diag ?? prev?.id_diag)
        ? { id_diag: cleanStr(row.id_diag ?? prev?.id_diag) }
        : {}),
      ...(row.seuil !== undefined && row.seuil !== null && String(row.seuil) !== ''
        ? { seuil: Number(row.seuil) }
        : prev?.seuil !== undefined
        ? { seuil: prev.seuil }
        : {}),
      ...(cleanStr(row.emplacement ?? prev?.emplacement)
        ? { emplacement: cleanStr(row.emplacement ?? prev?.emplacement) }
        : {}),
      ...(cleanStr(row.matiere_nuance ?? prev?.matiere_nuance)
        ? { matiere_nuance: cleanStr(row.matiere_nuance ?? prev?.matiere_nuance) }
        : {}),
      ...(cleanStr(row.ref_plan ?? prev?.ref_plan)
        ? { ref_plan: cleanStr(row.ref_plan ?? prev?.ref_plan) }
        : {}),
      ...(cleanStr(row.dimensions_brut ?? prev?.dimensions_brut)
        ? { dimensions_brut: cleanStr(row.dimensions_brut ?? prev?.dimensions_brut) }
        : {}),
      ...(cleanStr(row.traitement_thermique ?? prev?.traitement_thermique)
        ? {
            traitement_thermique: cleanStr(
              row.traitement_thermique ?? prev?.traitement_thermique
            ),
          }
        : {}),
      policy_tags:
        row.policy_tags !== undefined
          ? normalizeBomPolicyTags(row.policy_tags)
          : prev?.policy_tags || ['REPLACING'],
    };

    if (prev) {
      if (
        prev.designation === nextRecord.designation &&
        normKey(prev.id_type || prev.type) === resolvedTypeKey &&
        (prev.matiere_nuance || '') === (nextRecord.matiere_nuance || '')
      ) {
        pdUnchanged++;
      } else {
        pdUpdated++;
      }
    } else {
      pdCreated++;
    }
    workingPartDesignationsMap.set(key, nextRecord);
  });

  accepted.push({
    stage: '06_PART_DESIGNATIONS',
    entity: 'PART_DESIGNATIONS',
    created: pdCreated,
    updated: pdUpdated,
    unchanged: pdUnchanged,
    skipped: pdSkipped,
  });

  // =========================================================================
  // REPLACE_CATALOG ACTIVE-REFERENCE GUARD (Warehouse Items / Components / Machine BOM)
  // =========================================================================
  if (mode === 'REPLACE_CATALOG') {
    const checkRemovedRefs = (
      stage: PipelineStageId,
      entity: string,
      existingKeys: string[],
      retainedSet: Set<string>,
      extractor: (item: Record<string, unknown>) => string[]
    ) => {
      const removedSet = new Set(existingKeys.filter((k) => k && !retainedSet.has(k)));
      if (removedSet.size === 0) return;

      const refsByKey = new Map<
        string,
        { warehouseItems: number; entrepotComponents: number; machineElementsLedger: number }
      >();
      const bump = (
        k: string,
        bucket: 'warehouseItems' | 'entrepotComponents' | 'machineElementsLedger'
      ) => {
        if (!removedSet.has(k)) return;
        const entry = refsByKey.get(k) || {
          warehouseItems: 0,
          entrepotComponents: 0,
          machineElementsLedger: 0,
        };
        entry[bucket] += 1;
        refsByKey.set(k, entry);
      };

      for (const wh of existingWarehouseItems) {
        for (const cand of extractor(wh as Record<string, unknown>)) bump(cand, 'warehouseItems');
      }
      for (const ec of existingEntrepotComponents) {
        for (const cand of extractor(ec as Record<string, unknown>)) bump(cand, 'entrepotComponents');
      }
      for (const me of existingMachineElementsLedger) {
        for (const cand of extractor(me as unknown as Record<string, unknown>))
          bump(cand, 'machineElementsLedger');
      }

      for (const [k, counts] of refsByKey.entries()) {
        const total =
          counts.warehouseItems + counts.entrepotComponents + counts.machineElementsLedger;
        rejected.push({
          stage,
          entity,
          row: 0,
          identifier: k,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer '${k}' (${entity}) en mode REPLACE_CATALOG : référencé par ${total} élément(s) actif(s) (Entrepôt: ${counts.warehouseItems}, Composants: ${counts.entrepotComponents}, BOM Machine: ${counts.machineElementsLedger}).`,
          blocking: true,
          referencedCount: total,
          referenceBreakdown: counts,
        });
      }
    };

    if (rawCompGroups.length > 0) {
      checkRemovedRefs(
        '06_COMP_GROUPS',
        'COMP_GROUPS',
        existingCompGroups.map((g) => normKey(g?.id_groupe || g?.id_group || g?.id)),
        new Set(workingCompGroupsMap.keys()),
        (r) => [normKey(r.id_groupe || r.id_group)]
      );
    }
    if (rawCompFamilies.length > 0) {
      checkRemovedRefs(
        '06_COMP_FAMILIES',
        'COMP_FAMILIES',
        existingCompFamilies.map((f) => normKey(f?.id_comp_family || f?.id_family || f?.id)),
        new Set(workingCompFamiliesMap.keys()),
        (r) => [normKey(r.id_family || r.id_comp_family)]
      );
    }
    if (rawCompTemplates.length > 0) {
      checkRemovedRefs(
        '06_COMP_TEMPLATES',
        'COMP_TEMPLATES',
        existingCompTemplates.map((t) => normKey(t?.id_template || t?.id_templates || t?.id)),
        new Set(workingCompTemplatesMap.keys()),
        (r) => [normKey(r.id_template || r.id_templates)]
      );
    }
    if (rawPartGroups.length > 0) {
      checkRemovedRefs(
        '06_PART_GROUPS',
        'PART_GROUPS',
        existingPartGroups.map((g) => normKey(g?.id_groupe || g?.id_group || g?.id)),
        new Set(workingPartGroupsMap.keys()),
        (r) => [normKey(r.id_group || r.id_groupe)]
      );
    }
    if (rawPartTypes.length > 0) {
      checkRemovedRefs(
        '06_PART_TYPES',
        'PART_TYPES',
        existingPartTypes.map((pt) => normKey(pt?.id_type || pt?.id)),
        new Set(workingPartTypesMap.keys()),
        (r) => [normKey(r.id_part_type || r.id_type)]
      );
    }
    if (rawPartDesignations.length > 0) {
      checkRemovedRefs(
        '06_PART_DESIGNATIONS',
        'PART_DESIGNATIONS',
        existingPartDesignations.map((pd) => normKey(pd?.ref || pd?.id_part || pd?.id)),
        new Set(workingPartDesignationsMap.keys()),
        (r) => [
          normKey(r.id_part_designation || r.ref || r.code_article || r.ref_element || r.id_element),
        ]
      );
    }
  }

  const nextCompGroups = Array.from(workingCompGroupsMap.values());
  const nextCompFamilies = Array.from(workingCompFamiliesMap.values());
  const nextCompTemplates = Array.from(workingCompTemplatesMap.values());
  const nextPartGroups = Array.from(workingPartGroupsMap.values());
  const nextPartTypes = Array.from(workingPartTypesMap.values());
  const nextPartDesignations = Array.from(workingPartDesignationsMap.values());

  const success = rejected.length === 0;
  let committed = false;

  if (success && !dryRun) {
    DataGateway.saveCompGroups(nextCompGroups);
    DataGateway.saveCompFamilies(nextCompFamilies);
    DataGateway.saveCompTemplates(nextCompTemplates);
    DataGateway.savePartGroups(nextPartGroups);
    DataGateway.savePartTypes(nextPartTypes);
    DataGateway.savePartDesignations(nextPartDesignations);
    store.setCompGroups(nextCompGroups);
    store.setCompFamilies(nextCompFamilies);
    store.setCompTemplates(nextCompTemplates);
    store.setPartGroups(nextPartGroups);
    store.setPartTypes(nextPartTypes);
    store.setPartDesignations(nextPartDesignations);

    DataGateway.appendAuditEvent({
      actionType: 'SETTINGS_CONFIG_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'ENTREPOT_BOM',
      actorId: options.actorId || 'ADMIN',
      actorName: options.actorName || 'Import Pipeline',
      actorRole,
      before: {
        compGroups: existingCompGroups.length,
        compFamilies: existingCompFamilies.length,
        compTemplates: existingCompTemplates.length,
        partGroups: existingPartGroups.length,
        partTypes: existingPartTypes.length,
        partDesignations: existingPartDesignations.length,
      },
      after: {
        compGroups: nextCompGroups.length,
        compFamilies: nextCompFamilies.length,
        compTemplates: nextCompTemplates.length,
        partGroups: nextPartGroups.length,
        partTypes: nextPartTypes.length,
        partDesignations: nextPartDesignations.length,
      },
      meta: { mode, origin },
    });

    committed = true;
    notifyPipelineCommitSync('ENTREPOT_BOM', mode, origin);
  }

  return {
    bundleType: 'ENTREPOT_BOM',
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
      nextCompGroups,
      nextCompFamilies,
      nextCompTemplates,
      nextPartGroups,
      nextPartTypes,
      nextPartDesignations,
    },
  };
}

/**
 * Reverse export for `ENTREPOT_BOM` using stable `code_*` and `ref` identifiers (Type A Round-Trip).
 * Strictly Level 2 BOM classification only: never exports live warehouse instances, machine mounts, or movements.
 */
export function exportEntrepotBomBundle(snapshot?: {
  compGroups?: ICompGroup[];
  compFamilies?: ICompFamily[];
  compTemplates?: ICompTemplate[];
  partGroups?: IPartGroup[];
  partTypes?: IPartType[];
  partDesignations?: IPartDesignation[];
}): Required<
  Pick<
    EntrepotBomBundleInput,
    | 'bundleType'
    | 'compGroups'
    | 'compFamilies'
    | 'compTemplates'
    | 'partGroups'
    | 'partTypes'
    | 'partDesignations'
  >
> {
  const store = useGmaoStore.getState();
  const compGroups = snapshot?.compGroups ?? store.compGroups ?? [];
  const compFamilies = snapshot?.compFamilies ?? store.compFamilies ?? [];
  const compTemplates = snapshot?.compTemplates ?? store.compTemplates ?? [];
  const partGroups = snapshot?.partGroups ?? store.partGroups ?? [];
  const partTypes = snapshot?.partTypes ?? store.partTypes ?? [];
  const partDesignations = snapshot?.partDesignations ?? store.partDesignations ?? [];

  const compFamilyGroupByFamily = new Map<string, string>();
  for (const cf of compFamilies) {
    if (!cf) continue;
    const fKey = normKey(cf.id_comp_family || cf.id_family || cf.id);
    const gKey = normKey(cf.id_groupe || cf.id_group);
    if (fKey && gKey) compFamilyGroupByFamily.set(fKey, gKey);
  }

  const partTypeGroupByType = new Map<string, string>();
  for (const pt of partTypes) {
    if (!pt) continue;
    const tKey = normKey(pt.id_type || pt.id);
    const gKey = normKey(pt.id_group || pt.id_groupe);
    if (tKey && gKey) partTypeGroupByType.set(tKey, gKey);
  }

  return {
    bundleType: 'ENTREPOT_BOM',
    compGroups: compGroups.map((g) => ({
      code_comp_group: normKey(g.id_groupe || g.id_group || g.id || g.code),
      code: cleanStr(g.code || g.id_groupe || g.id_group || g.id),
      libelle: cleanStr(g.libelle),
      ...(g.ref ? { ref: cleanStr(g.ref) } : {}),
      ...(g.description ? { description: cleanStr(g.description) } : {}),
      ...(g.domaine_technique ? { domaine_technique: cleanStr(g.domaine_technique) } : {}),
    })),
    compFamilies: compFamilies.map((f) => ({
      code_comp_family: normKey(f.id_comp_family || f.id_family || f.id || f.code),
      code_comp_group: normKey(f.id_groupe || f.id_group),
      code: cleanStr(f.code || f.id_comp_family || f.id_family || f.id),
      libelle: cleanStr(f.libelle),
      ...(f.type ? { type: cleanStr(f.type) } : {}),
      ...(f.ref ? { ref: cleanStr(f.ref) } : {}),
      ...(f.description ? { description: cleanStr(f.description) } : {}),
    })),
    compTemplates: compTemplates.map((t) => {
      const fKey = normKey(t.id_family);
      const gKey = normKey(t.id_groupe || t.id_group || compFamilyGroupByFamily.get(fKey));
      return {
        code_comp_template: normKey(
          t.id_template ||
            t.id_templates ||
            (t as Record<string, unknown>).id_comp_template ||
            t.id ||
            t.code
        ),
        code_comp_family: fKey,
        ...(gKey ? { code_comp_group: gKey } : {}),
        code: cleanStr(t.code || t.id_template || t.id_templates || t.id),
        ...(t.ref ? { ref: cleanStr(t.ref) } : {}),
        libelle: cleanStr(t.libelle),
        ...(t.type ? { type: cleanStr(t.type) } : {}),
        ...(t.mode_reparation_defaut
          ? { mode_reparation_defaut: cleanStr(t.mode_reparation_defaut) }
          : {}),
        ...(t.tension_nominale ? { tension_nominale: cleanStr(t.tension_nominale) } : {}),
        ...(t.courant_nominal_a !== undefined ? { courant_nominal_a: t.courant_nominal_a } : {}),
        ...(t.indice_protection ? { indice_protection: cleanStr(t.indice_protection) } : {}),
        ...(t.type_fixation ? { type_fixation: cleanStr(t.type_fixation) } : {}),
        ...(t.specs && typeof t.specs === 'object' ? { specs: t.specs } : {}),
        ...(t.description ? { description: cleanStr(t.description) } : {}),
      };
    }),
    partGroups: partGroups.map((g, idx) => ({
      code_part_group: normKey(g.id_groupe || g.id_group || g.id || g.code),
      code: cleanStr(g.code || g.id_groupe || g.id_group || g.id),
      libelle: cleanStr(g.libelle),
      ...(g.description ? { description: cleanStr(g.description) } : {}),
      ...(g.domaine_technique ? { domaine_technique: cleanStr(g.domaine_technique) } : {}),
      default_policy_tags: Array.isArray(g.default_policy_tags)
        ? g.default_policy_tags
        : ['REPLACING'],
      sort_order: Number(g.sort_order) || (idx + 1) * 10,
      is_active: g.is_active !== false,
    })),
    partTypes: partTypes.map((pt) => ({
      code_part_type: normKey(pt.id_type || pt.id),
      code_part_group: normKey(pt.id_group || pt.id_groupe),
      libelle: cleanStr(pt.libelle || pt.nom),
      ...(pt.description ? { description: cleanStr(pt.description) } : {}),
      ...(pt.domaine_technique ? { domaine_technique: cleanStr(pt.domaine_technique) } : {}),
    })),
    partDesignations: partDesignations.map((pd) => {
      const tKey = normKey(pd.id_type || pd.type);
      const gKey = normKey(pd.id_group || pd.id_groupe || partTypeGroupByType.get(tKey));
      return {
        ref: cleanStr(pd.ref || pd.id_part || pd.id),
        code_part_type: tKey,
        ...(gKey ? { code_part_group: gKey } : {}),
        designation: cleanStr(pd.designation || pd.libelle),
        ...(pd.id_diag ? { id_diag: cleanStr(pd.id_diag) } : {}),
        ...(pd.seuil !== undefined ? { seuil: Number(pd.seuil) } : {}),
        ...(pd.emplacement ? { emplacement: cleanStr(pd.emplacement) } : {}),
        ...(pd.matiere_nuance ? { matiere_nuance: cleanStr(pd.matiere_nuance) } : {}),
        ...(pd.ref_plan ? { ref_plan: cleanStr(pd.ref_plan) } : {}),
        ...(pd.dimensions_brut ? { dimensions_brut: cleanStr(pd.dimensions_brut) } : {}),
        ...(pd.traitement_thermique
          ? { traitement_thermique: cleanStr(pd.traitement_thermique) }
          : {}),
        policy_tags: Array.isArray(pd.policy_tags) ? pd.policy_tags : ['REPLACING'],
      };
    }),
  };
}

/**
 * Returns a fresh clone of the official `ENTREPOT_BOM` template (`templates/import/ENTREPOT_BOM.template.json`).
 */
export function getEntrepotBomOfficialTemplate(): EntrepotBomBundleInput & {
  bundleType: 'ENTREPOT_BOM';
} {
  return JSON.parse(JSON.stringify(entrepotBomOfficialTemplate));
}
