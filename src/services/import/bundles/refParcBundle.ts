import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import type {
  IGeneralSystemType,
  IMachineFamily,
  IMachineTemplate,
  IZone,
} from '../../../types/domain';
import refParcOfficialTemplate from '../../../../templates/import/REF_PARC.template.json';
import {
  cleanStr,
  foldAccentsKey,
  FORBIDDEN_PSEUDO_ZONES,
  FORBIDDEN_REF_PARC_ROOT_KEYS,
  normKey,
  notifyPipelineCommitSync,
} from '../pipelineShared';
import type {
  AcceptedStageRecord,
  ImportCommitPolicy,
  ImportIssue,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  RefParcBundleInput,
  RefParcFamilyRow,
  RefParcGeneralSystemTypeRow,
  RefParcStagingResult,
  RefParcTemplateRow,
  RefParcZoneRow,
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';

/**
 * Validates and optionally commits a `REF_PARC` bundle in strict dependency order:
 * `01_ZONES -> 03_FAMILIES -> 03_TEMPLATES -> 03_GENERAL_SYSTEM_TYPES`.
 *
 * Enforces:
 * - Canonical `code_zone` normalization (`trim + uppercase`).
 * - Zero implicit entity creation on missing foreign keys (`BROKEN_FK`).
 * - Forbidden operational/asset payloads rejected at bundle boundary (`FORBIDDEN_BUNDLE_FIELD`).
 * - `REPLACE_CATALOG` active-reference protection (`REFERENCED_BY_ACTIVE_RECORDS`) with link counts.
 * - Atomic commit gate (`rejected.length === 0 && !dryRun`).
 */
export function validateAndCommitRefParcBundle(
  input: RefParcBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<RefParcStagingResult> {
  const startTime = Date.now();
  const mode: ImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const origin: ImportSourceOrigin = options.origin || 'JSON_BUNDLE';
  const commitPolicy: ImportCommitPolicy = options.commitPolicy || 'ATOMIC';
  const dryRun = Boolean(options.dryRun);
  const actorRole = normKey(options.actorRole || 'ADMIN');

  const store = useGmaoStore.getState();
  const existingZones = options.existingZones ?? store.zones ?? [];
  const existingFamilies = options.existingFamilies ?? store.families ?? [];
  const existingTemplates = options.existingTemplates ?? store.templates ?? [];
  const existingGeneralSystemTypes =
    options.existingGeneralSystemTypes ?? store.generalSystemTypes ?? [];
  const existingMachines = options.existingMachines ?? store.machines ?? [];
  const existingTechnicians = options.existingTechnicians ?? store.technicians ?? [];

  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const accepted: AcceptedStageRecord[] = [];

  const abortReport = (): ImportReport<RefParcStagingResult> => ({
    bundleType: 'REF_PARC',
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
      nextZones: [...existingZones],
      nextFamilies: [...existingFamilies],
      nextTemplates: [...existingTemplates],
      nextGeneralSystemTypes: [...existingGeneralSystemTypes],
    },
  });

  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    rejected.push({
      stage: '01_ZONES',
      entity: 'REF_PARC',
      row: 0,
      code: 'RBAC_DENIED',
      message: 'Accès refusé : le mode REPLACE_CATALOG est strictement réservé au rôle ADMIN.',
      blocking: true,
    });
    return abortReport();
  }

  if (!input || typeof input !== 'object') {
    rejected.push({
      stage: '01_ZONES',
      entity: 'REF_PARC',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: 'Format de paquet REF_PARC invalide.',
      blocking: true,
    });
    return abortReport();
  }

  for (const forbiddenKey of FORBIDDEN_REF_PARC_ROOT_KEYS) {
    const val = (input as Record<string, unknown>)[forbiddenKey];
    if (Array.isArray(val) && val.length > 0) {
      rejected.push({
        stage: '01_ZONES',
        entity: 'REF_PARC',
        row: 0,
        identifier: forbiddenKey,
        code: 'FORBIDDEN_BUNDLE_FIELD',
        message: `Le paquet REF_PARC (Niveau 2 Référentiel) interdit l'inclusion directe de '${forbiddenKey}'.`,
        blocking: true,
      });
    }
  }

  const rawZones = Array.isArray(input.zones) ? input.zones : [];
  const rawFamilies = Array.isArray(input.families) ? input.families : [];
  const rawTemplates = Array.isArray(input.templates) ? input.templates : [];
  const rawSystemTypes = Array.isArray(input.generalSystemTypes) ? input.generalSystemTypes : [];

  // =========================================================================
  // STAGE 1: 01_ZONES
  // =========================================================================
  const workingZonesMap = new Map<string, IZone>();
  const aliasZoneToCanonical = new Map<string, string>();

  if (mode === 'MERGE' || rawZones.length === 0) {
    for (const z of existingZones) {
      if (!z) continue;
      const rawCode = cleanStr(z.code_zone || z.code || z.id_zone);
      if (!rawCode) continue;
      const canonicalKey = normKey(rawCode);
      const normalized: IZone = {
        ...z,
        code: canonicalKey,
        code_zone: canonicalKey,
        id_zone: canonicalKey,
        libelle: cleanStr(z.libelle || z.nom || rawCode),
      };
      workingZonesMap.set(canonicalKey, normalized);
      aliasZoneToCanonical.set(canonicalKey, canonicalKey);
      if (z.id_zone) {
        aliasZoneToCanonical.set(normKey(z.id_zone), canonicalKey);
        aliasZoneToCanonical.set(foldAccentsKey(z.id_zone), canonicalKey);
      }
      if (z.libelle) {
        aliasZoneToCanonical.set(normKey(z.libelle), canonicalKey);
        aliasZoneToCanonical.set(foldAccentsKey(z.libelle), canonicalKey);
      }
    }
  }

  const seenZoneCodes = new Set<string>();
  let zCreated = 0;
  let zUpdated = 0;
  let zUnchanged = 0;
  let zSkipped = 0;

  rawZones.forEach((row: RefParcZoneRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      zSkipped++;
      return;
    }
    const rawCode = cleanStr(row.code_zone ?? (row as Record<string, unknown>).code);
    const rawLibelle = cleanStr(row.libelle ?? row.nom);
    const rawDesc = cleanStr(row.description);

    if (!rawCode && !rawLibelle) {
      zSkipped++;
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '01_ZONES',
        entity: 'ZONES',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (ZONES) : 'code_zone' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '01_ZONES',
        entity: 'ZONES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (ZONES [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const canonicalCode = normKey(rawCode);
    if (
      FORBIDDEN_PSEUDO_ZONES.has(canonicalCode) ||
      FORBIDDEN_PSEUDO_ZONES.has(normKey(rawLibelle))
    ) {
      rejected.push({
        stage: '01_ZONES',
        entity: 'ZONES',
        row: rowNum,
        identifier: rawCode,
        code: 'SCHEMA_MISMATCH',
        message: `Ligne ${rowNum} (ZONES [${rawCode}]) : une zone géographique ne peut pas être '${rawCode}' (utiliser GENERAL_SYSTEM_TYPES).`,
        blocking: true,
      });
      return;
    }

    if (seenZoneCodes.has(canonicalCode)) {
      rejected.push({
        stage: '01_ZONES',
        entity: 'ZONES',
        row: rowNum,
        identifier: canonicalCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (ZONES) : doublon sur code_zone '${canonicalCode}'.`,
        blocking: true,
      });
      return;
    }
    seenZoneCodes.add(canonicalCode);

    const existingCanonicalKey =
      aliasZoneToCanonical.get(canonicalCode) ||
      aliasZoneToCanonical.get(foldAccentsKey(rawLibelle)) ||
      canonicalCode;
    const prev = workingZonesMap.get(existingCanonicalKey);
    const nextRecord: IZone = {
      ...(prev || {}),
      code: canonicalCode,
      code_zone: canonicalCode,
      id_zone: canonicalCode,
      libelle: rawLibelle,
      description: rawDesc || prev?.description || '',
      is_active: row.is_active !== undefined ? Boolean(row.is_active) : (prev?.is_active ?? true),
    };

    if (prev) {
      if (
        prev.code_zone === nextRecord.code_zone &&
        prev.libelle === nextRecord.libelle &&
        (prev.description || '') === (nextRecord.description || '') &&
        (prev.is_active ?? true) === nextRecord.is_active
      ) {
        zUnchanged++;
      } else {
        zUpdated++;
      }
      workingZonesMap.delete(existingCanonicalKey);
    } else {
      zCreated++;
    }

    workingZonesMap.set(canonicalCode, nextRecord);
    aliasZoneToCanonical.set(canonicalCode, canonicalCode);
    aliasZoneToCanonical.set(normKey(rawLibelle), canonicalCode);
    aliasZoneToCanonical.set(foldAccentsKey(rawLibelle), canonicalCode);
  });

  if (mode === 'REPLACE_CATALOG' && rawZones.length > 0) {
    const missingZonesRefs = new Map<string, { machines: number; technicians: number }>();

    for (const m of existingMachines) {
      const mZone = cleanStr(m.id_zone_default || m.id_zone || m.zone);
      if (!mZone) continue;
      const mZoneKey = normKey(mZone);
      const mZoneFolded = foldAccentsKey(mZone);
      if (
        !aliasZoneToCanonical.has(mZoneKey) &&
        !aliasZoneToCanonical.has(mZoneFolded) &&
        !workingZonesMap.has(mZoneKey)
      ) {
        const entry = missingZonesRefs.get(mZoneKey) || { machines: 0, technicians: 0 };
        entry.machines += 1;
        missingZonesRefs.set(mZoneKey, entry);
      }
    }

    for (const t of existingTechnicians) {
      const tZone = cleanStr(t.id_zone);
      if (!tZone) continue;
      const tZoneKey = normKey(tZone);
      const tZoneFolded = foldAccentsKey(tZone);
      if (
        !aliasZoneToCanonical.has(tZoneKey) &&
        !aliasZoneToCanonical.has(tZoneFolded) &&
        !workingZonesMap.has(tZoneKey)
      ) {
        const entry = missingZonesRefs.get(tZoneKey) || { machines: 0, technicians: 0 };
        entry.technicians += 1;
        missingZonesRefs.set(tZoneKey, entry);
      }
    }

    for (const [zKey, counts] of missingZonesRefs.entries()) {
      const total = counts.machines + counts.technicians;
      rejected.push({
        stage: '01_ZONES',
        entity: 'ZONES',
        row: 0,
        identifier: zKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer la zone '${zKey}' en mode REPLACE_CATALOG : ${total} lien(s) actif(s) (machines: ${counts.machines}, techniciens: ${counts.technicians}). Utilisez MERGE ou archivez d'abord.`,
        blocking: true,
        referencedCount: total,
        referenceBreakdown: counts,
      });
    }
  }

  accepted.push({
    stage: '01_ZONES',
    entity: 'ZONES',
    created: zCreated,
    updated: zUpdated,
    unchanged: zUnchanged,
    skipped: zSkipped,
  });

  // =========================================================================
  // STAGE 2: 03_FAMILIES
  // =========================================================================
  const workingFamiliesMap = new Map<string, IMachineFamily>();
  if (mode === 'MERGE' || rawFamilies.length === 0) {
    for (const f of existingFamilies) {
      if (!f) continue;
      const code = cleanStr(f.id_family || f.code || f.id);
      if (!code) continue;
      workingFamiliesMap.set(normKey(code), {
        ...f,
        id_family: code,
        code: cleanStr(f.code || code),
        libelle: cleanStr(f.libelle || f.nom || code),
      });
    }
  }

  const seenFamilyCodes = new Set<string>();
  let fCreated = 0;
  let fUpdated = 0;
  let fUnchanged = 0;
  let fSkipped = 0;

  rawFamilies.forEach((row: RefParcFamilyRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      fSkipped++;
      return;
    }
    const rawCode = cleanStr(
      row.code_family ??
        (row as Record<string, unknown>).id_family ??
        (row as Record<string, unknown>).code
    );
    const rawLibelle = cleanStr(row.libelle ?? row.nom);
    const rawDesc = cleanStr(row.description);

    if (!rawCode && !rawLibelle) {
      fSkipped++;
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '03_FAMILIES',
        entity: 'FAMILIES',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (FAMILIES) : 'code_family' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '03_FAMILIES',
        entity: 'FAMILIES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (FAMILIES [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (seenFamilyCodes.has(codeKey)) {
      rejected.push({
        stage: '03_FAMILIES',
        entity: 'FAMILIES',
        row: rowNum,
        identifier: rawCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (FAMILIES) : doublon sur code_family '${rawCode}'.`,
        blocking: true,
      });
      return;
    }
    seenFamilyCodes.add(codeKey);

    const prev = workingFamiliesMap.get(codeKey);
    const nextRecord: IMachineFamily = {
      ...(prev || {}),
      id_family: rawCode,
      code: rawCode,
      libelle: rawLibelle,
      description: rawDesc || prev?.description || '',
    };

    if (prev) {
      if (
        prev.libelle === nextRecord.libelle &&
        (prev.description || '') === (nextRecord.description || '')
      ) {
        fUnchanged++;
      } else {
        fUpdated++;
      }
    } else {
      fCreated++;
    }
    workingFamiliesMap.set(codeKey, nextRecord);
  });

  if (mode === 'REPLACE_CATALOG' && rawFamilies.length > 0) {
    const missingFamilyRefs = new Map<string, number>();
    for (const m of existingMachines) {
      const mFam = cleanStr(m.id_family);
      if (mFam && !workingFamiliesMap.has(normKey(mFam))) {
        const key = normKey(mFam);
        missingFamilyRefs.set(key, (missingFamilyRefs.get(key) || 0) + 1);
      }
    }
    for (const [fKey, count] of missingFamilyRefs.entries()) {
      rejected.push({
        stage: '03_FAMILIES',
        entity: 'FAMILIES',
        row: 0,
        identifier: fKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer la famille '${fKey}' en mode REPLACE_CATALOG : référencée par ${count} machine(s).`,
        blocking: true,
        referencedCount: count,
        referenceBreakdown: { machines: count },
      });
    }
  }

  accepted.push({
    stage: '03_FAMILIES',
    entity: 'FAMILIES',
    created: fCreated,
    updated: fUpdated,
    unchanged: fUnchanged,
    skipped: fSkipped,
  });

  // =========================================================================
  // STAGE 3: 03_TEMPLATES (Strictly after FAMILIES)
  // =========================================================================
  const workingTemplatesMap = new Map<string, IMachineTemplate>();
  if (mode === 'MERGE' || rawTemplates.length === 0) {
    for (const t of existingTemplates) {
      if (!t) continue;
      const code = cleanStr(t.id_templates || t.id_template || t.id);
      if (!code) continue;
      workingTemplatesMap.set(normKey(code), {
        ...t,
        id_templates: code,
        id_family: cleanStr(t.id_family || t.family),
        libelle: cleanStr(t.libelle || t.nom || code),
      });
    }
  }

  const seenTemplateCodes = new Set<string>();
  let tCreated = 0;
  let tUpdated = 0;
  let tUnchanged = 0;
  let tSkipped = 0;

  rawTemplates.forEach((row: RefParcTemplateRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      tSkipped++;
      return;
    }
    const rawCode = cleanStr(
      row.code_template ??
        (row as Record<string, unknown>).id_templates ??
        (row as Record<string, unknown>).id_template ??
        (row as Record<string, unknown>).code
    );
    const rawLibelle = cleanStr(row.libelle ?? row.nom);
    const rawFamilyCode = cleanStr(
      row.code_family ?? (row as Record<string, unknown>).id_family
    );
    const rawDesc = cleanStr(row.description);

    if (!rawCode && !rawLibelle && !rawFamilyCode) {
      tSkipped++;
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '03_TEMPLATES',
        entity: 'TEMPLATES',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (TEMPLATES) : 'code_template' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '03_TEMPLATES',
        entity: 'TEMPLATES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (TEMPLATES [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawFamilyCode) {
      rejected.push({
        stage: '03_TEMPLATES',
        entity: 'TEMPLATES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (TEMPLATES [${rawCode}]) : 'code_family' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (seenTemplateCodes.has(codeKey)) {
      rejected.push({
        stage: '03_TEMPLATES',
        entity: 'TEMPLATES',
        row: rowNum,
        identifier: rawCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (TEMPLATES) : doublon sur code_template '${rawCode}'.`,
        blocking: true,
      });
      return;
    }
    seenTemplateCodes.add(codeKey);

    const resolvedFamily = workingFamiliesMap.get(normKey(rawFamilyCode));
    if (!resolvedFamily) {
      rejected.push({
        stage: '03_TEMPLATES',
        entity: 'TEMPLATES',
        row: rowNum,
        identifier: rawCode,
        code: 'BROKEN_FK',
        message: `Ligne ${rowNum} (TEMPLATES [${rawCode}]) : la famille '${rawFamilyCode}' est introuvable dans FAMILIES.`,
        blocking: true,
      });
      return;
    }

    const canonicalFamilyCode = cleanStr(resolvedFamily.id_family || resolvedFamily.code);
    const prev = workingTemplatesMap.get(codeKey);
    const nextRecord: IMachineTemplate = {
      ...(prev || {}),
      id_templates: rawCode,
      libelle: rawLibelle,
      id_family: canonicalFamilyCode,
      famille_lib: cleanStr(resolvedFamily.libelle || canonicalFamilyCode),
      constructeur: cleanStr(row.constructeur) || prev?.constructeur,
      puissance: cleanStr(row.puissance) || prev?.puissance,
      vitesse: cleanStr(row.vitesse) || prev?.vitesse,
      description: rawDesc || prev?.description || '',
    };

    if (prev) {
      if (
        prev.libelle === nextRecord.libelle &&
        prev.id_family === nextRecord.id_family &&
        (prev.description || '') === (nextRecord.description || '')
      ) {
        tUnchanged++;
      } else {
        tUpdated++;
      }
    } else {
      tCreated++;
    }
    workingTemplatesMap.set(codeKey, nextRecord);
  });

  if (mode === 'REPLACE_CATALOG' && rawTemplates.length > 0) {
    const missingTemplateRefs = new Map<string, number>();
    for (const m of existingMachines) {
      const mTpl = cleanStr(m.id_templates);
      if (mTpl && !workingTemplatesMap.has(normKey(mTpl))) {
        const key = normKey(mTpl);
        missingTemplateRefs.set(key, (missingTemplateRefs.get(key) || 0) + 1);
      }
    }
    for (const [tKey, count] of missingTemplateRefs.entries()) {
      rejected.push({
        stage: '03_TEMPLATES',
        entity: 'TEMPLATES',
        row: 0,
        identifier: tKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer le modèle '${tKey}' en mode REPLACE_CATALOG : référencé par ${count} machine(s).`,
        blocking: true,
        referencedCount: count,
        referenceBreakdown: { machines: count },
      });
    }
  }

  accepted.push({
    stage: '03_TEMPLATES',
    entity: 'TEMPLATES',
    created: tCreated,
    updated: tUpdated,
    unchanged: tUnchanged,
    skipped: tSkipped,
  });

  // =========================================================================
  // STAGE 4: 03_GENERAL_SYSTEM_TYPES
  // =========================================================================
  const workingSystemTypesMap = new Map<string, IGeneralSystemType>();
  if (mode === 'MERGE' || rawSystemTypes.length === 0) {
    for (const st of existingGeneralSystemTypes) {
      if (!st) continue;
      const code = cleanStr(st.code || st.id);
      if (!code) continue;
      workingSystemTypesMap.set(normKey(code), {
        ...st,
        id: cleanStr(st.id || code),
        code,
        name: cleanStr(st.name || code),
        is_active: st.is_active !== false,
      });
    }
  }

  const seenSystemTypeCodes = new Set<string>();
  let sCreated = 0;
  let sUpdated = 0;
  let sUnchanged = 0;
  let sSkipped = 0;

  rawSystemTypes.forEach((row: RefParcGeneralSystemTypeRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      sSkipped++;
      return;
    }
    const rawCode = cleanStr(
      row.code_system_type ??
        row.id_system_type ??
        row.code ??
        (row as Record<string, unknown>).id
    );
    const rawName = cleanStr(row.libelle ?? row.name ?? (row as Record<string, unknown>).nom);

    if (!rawCode && !rawName) {
      sSkipped++;
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '03_GENERAL_SYSTEM_TYPES',
        entity: 'GENERAL_SYSTEM_TYPES',
        row: rowNum,
        identifier: rawName,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (GENERAL_SYSTEM_TYPES) : 'code_system_type' (ou 'code') est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawName) {
      rejected.push({
        stage: '03_GENERAL_SYSTEM_TYPES',
        entity: 'GENERAL_SYSTEM_TYPES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (GENERAL_SYSTEM_TYPES [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (seenSystemTypeCodes.has(codeKey)) {
      rejected.push({
        stage: '03_GENERAL_SYSTEM_TYPES',
        entity: 'GENERAL_SYSTEM_TYPES',
        row: rowNum,
        identifier: rawCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (GENERAL_SYSTEM_TYPES) : doublon sur '${rawCode}'.`,
        blocking: true,
      });
      return;
    }
    seenSystemTypeCodes.add(codeKey);

    const prev = workingSystemTypesMap.get(codeKey);
    const explicitSysId = cleanStr(
      row.id_system_type ?? (row as Record<string, unknown>).id
    );
    const nextRecord: IGeneralSystemType = {
      id: explicitSysId || prev?.id || rawCode,
      code: rawCode,
      name: rawName,
      is_active: row.is_active !== undefined ? Boolean(row.is_active) : (prev?.is_active ?? true),
    };

    if (prev) {
      if (prev.name === nextRecord.name && prev.is_active === nextRecord.is_active) {
        sUnchanged++;
      } else {
        sUpdated++;
      }
    } else {
      sCreated++;
    }
    workingSystemTypesMap.set(codeKey, nextRecord);
  });

  if (mode === 'REPLACE_CATALOG' && rawSystemTypes.length > 0) {
    const missingSysRefs = new Map<string, number>();
    for (const m of existingMachines) {
      const sysType = cleanStr(m.id_general_system_type);
      if (sysType && !workingSystemTypesMap.has(normKey(sysType))) {
        const key = normKey(sysType);
        missingSysRefs.set(key, (missingSysRefs.get(key) || 0) + 1);
      }
    }
    for (const [sKey, count] of missingSysRefs.entries()) {
      rejected.push({
        stage: '03_GENERAL_SYSTEM_TYPES',
        entity: 'GENERAL_SYSTEM_TYPES',
        row: 0,
        identifier: sKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer le type système général '${sKey}' en mode REPLACE_CATALOG : référencé par ${count} équipement(s).`,
        blocking: true,
        referencedCount: count,
        referenceBreakdown: { machines: count },
      });
    }
  }

  accepted.push({
    stage: '03_GENERAL_SYSTEM_TYPES',
    entity: 'GENERAL_SYSTEM_TYPES',
    created: sCreated,
    updated: sUpdated,
    unchanged: sUnchanged,
    skipped: sSkipped,
  });

  const nextZones = Array.from(workingZonesMap.values());
  const nextFamilies = Array.from(workingFamiliesMap.values());
  const nextTemplates = Array.from(workingTemplatesMap.values());
  const nextGeneralSystemTypes = Array.from(workingSystemTypesMap.values());

  const success = rejected.length === 0;
  let committed = false;

  if (success && !dryRun) {
    // Strict dependency write order via DataGateway SSOT
    DataGateway.saveZones(nextZones);
    DataGateway.saveFamilies(nextFamilies);
    DataGateway.saveTemplates(nextTemplates);
    DataGateway.saveGeneralSystemTypes(nextGeneralSystemTypes);

    store.setZones(nextZones);
    store.setFamilies(nextFamilies);
    store.setTemplates(nextTemplates);
    store.setGeneralSystemTypes(nextGeneralSystemTypes);

    DataGateway.appendAuditEvent({
      actionType: 'SETTINGS_CONFIG_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'REF_PARC',
      actorId: options.actorId || 'ADMIN',
      actorName: options.actorName || 'Import Pipeline',
      actorRole,
      before: {
        zonesCount: existingZones.length,
        familiesCount: existingFamilies.length,
        templatesCount: existingTemplates.length,
      },
      after: {
        zonesCount: nextZones.length,
        familiesCount: nextFamilies.length,
        templatesCount: nextTemplates.length,
        generalSystemTypesCount: nextGeneralSystemTypes.length,
      },
      meta: { mode, origin },
    });

    committed = true;
    notifyPipelineCommitSync('REF_PARC', mode, origin);
  }

  return {
    bundleType: 'REF_PARC',
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
      nextZones,
      nextFamilies,
      nextTemplates,
      nextGeneralSystemTypes,
    },
  };
}

/**
 * Reverse export for `REF_PARC` using stable `code_*` identifiers.
 */
export function exportRefParcBundle(snapshot?: {
  zones?: IZone[];
  families?: IMachineFamily[];
  templates?: IMachineTemplate[];
  generalSystemTypes?: IGeneralSystemType[];
}): Required<
  Pick<RefParcBundleInput, 'bundleType' | 'zones' | 'families' | 'templates' | 'generalSystemTypes'>
> {
  const store = useGmaoStore.getState();
  const zones = snapshot?.zones ?? store.zones ?? [];
  const families = snapshot?.families ?? store.families ?? [];
  const templates = snapshot?.templates ?? store.templates ?? [];
  const generalSystemTypes = snapshot?.generalSystemTypes ?? store.generalSystemTypes ?? [];

  return {
    bundleType: 'REF_PARC',
    zones: zones.map((z) => ({
      code_zone: normKey(z.code_zone || z.code || z.id_zone),
      libelle: cleanStr(z.libelle || z.nom || z.code_zone || z.id_zone),
      description: cleanStr(z.description),
      is_active: z.is_active !== false,
    })),
    families: families.map((f) => ({
      code_family: cleanStr(f.id_family || f.code || f.id),
      libelle: cleanStr(f.libelle || f.nom || f.id_family),
      description: cleanStr(f.description),
    })),
    templates: templates.map((t) => ({
      code_template: cleanStr(t.id_templates || t.id_template || t.id),
      libelle: cleanStr(t.libelle || t.nom || t.id_templates),
      code_family: cleanStr(t.id_family || t.family),
      constructeur: cleanStr(t.constructeur),
      puissance: cleanStr(t.puissance),
      vitesse: cleanStr(t.vitesse),
      description: cleanStr(t.description),
    })),
    generalSystemTypes: generalSystemTypes.map((st) => ({
      code_system_type: cleanStr(st.code || st.id),
      id_system_type: cleanStr(st.id || st.code),
      libelle: cleanStr(st.name || st.code),
      is_active: st.is_active !== false,
    })),
  };
}

/**
 * Returns a fresh clone of the official `REF_PARC` template (`templates/import/REF_PARC.template.json`).
 */
export function getRefParcOfficialTemplate(): RefParcBundleInput & { bundleType: 'REF_PARC' } {
  return JSON.parse(JSON.stringify(refParcOfficialTemplate));
}
