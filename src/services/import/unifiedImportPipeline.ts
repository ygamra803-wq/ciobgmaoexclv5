import { DataGateway } from '../../application/DataGateway';
import { useGmaoStore } from '../../store/useGmaoStore';
import type {
  AssetClass,
  IGeneralSystemType,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  ITechnician,
  IUserRecord,
  IZone,
  StockType,
} from '../../types/domain';
import {
  applyPdrCatalogImportToStore,
  validateAndReconcilePdrCatalogImport,
} from '../pdr/pdrExcelValidator';
import type {
  AcceptedStageRecord,
  AssetsMachineRow,
  AssetsMachinesBundleInput,
  AssetsMachinesStagingResult,
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
  RefPdrBundleInput,
  RefPdrStagingResult,
  UnifiedImportOptions,
} from './types/unifiedImportTypes';

const FORBIDDEN_PSEUDO_ZONES = new Set(['DIVERS', 'SYSTEM_GENERAL', 'SYSTEME_GENERAL']);

const FORBIDDEN_REF_PARC_ROOT_KEYS = [
  'machines',
  'preventiveTasks',
  'mouvements',
  'blueprints',
  'correctiveInterventions',
  'warehouseItems',
] as const;

const FORBIDDEN_ASSETS_MACHINES_ROOT_KEYS = [
  'blueprints',
  'preventiveTasks',
  'mouvements',
  'correctiveInterventions',
] as const;

const FORBIDDEN_MACHINE_ROW_EMBEDDED_KEYS = [
  'components_theoriques',
  'parts_theoriques',
  'pdr_theoriques',
  'preventivePlanItems',
  'preventiveTasks',
  'mouvements',
] as const;

function normKey(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

function cleanStr(raw: unknown): string {
  return String(raw ?? '').trim();
}

function buildZoneIndex(zones: IZone[]): Map<string, IZone> {
  const map = new Map<string, IZone>();
  for (const z of zones) {
    if (!z) continue;
    const canonicalCode = cleanStr(z.code_zone || z.code || z.id_zone);
    if (!canonicalCode) continue;
    const normalizedRecord: IZone = {
      ...z,
      code: canonicalCode,
      code_zone: canonicalCode,
      id_zone: cleanStr(z.id_zone || canonicalCode),
      libelle: cleanStr(z.libelle || z.nom || canonicalCode),
    };
    map.set(normKey(canonicalCode), normalizedRecord);
    if (z.id_zone) map.set(normKey(z.id_zone), normalizedRecord);
    if (z.code) map.set(normKey(z.code), normalizedRecord);
    if (z.libelle) map.set(normKey(z.libelle), normalizedRecord);
  }
  return map;
}

function buildFamilyIndex(families: IMachineFamily[]): Map<string, IMachineFamily> {
  const map = new Map<string, IMachineFamily>();
  for (const f of families) {
    if (!f) continue;
    const code = cleanStr(f.id_family || f.code || f.id);
    if (!code) continue;
    const normalized: IMachineFamily = {
      ...f,
      id_family: code,
      code: cleanStr(f.code || code),
      libelle: cleanStr(f.libelle || f.nom || f.name || code),
    };
    map.set(normKey(code), normalized);
    if (f.code) map.set(normKey(f.code), normalized);
  }
  return map;
}

function buildTemplateIndex(templates: IMachineTemplate[]): Map<string, IMachineTemplate> {
  const map = new Map<string, IMachineTemplate>();
  for (const t of templates) {
    if (!t) continue;
    const code = cleanStr(t.id_templates || t.id_template || t.id);
    if (!code) continue;
    const normalized: IMachineTemplate = {
      ...t,
      id_templates: code,
      id_family: cleanStr(t.id_family || t.family),
      libelle: cleanStr(t.libelle || t.nom || code),
    };
    map.set(normKey(code), normalized);
  }
  return map;
}

function buildSystemTypeIndex(types: IGeneralSystemType[]): Map<string, IGeneralSystemType> {
  const map = new Map<string, IGeneralSystemType>();
  for (const st of types) {
    if (!st) continue;
    const code = cleanStr(st.code || st.id);
    if (!code) continue;
    const normalized: IGeneralSystemType = {
      ...st,
      id: cleanStr(st.id || code),
      code,
      name: cleanStr(st.name || (st as unknown as Record<string, unknown>).libelle || code),
      is_active: st.is_active !== false,
    };
    map.set(normKey(code), normalized);
    if (st.id) map.set(normKey(st.id), normalized);
  }
  return map;
}

function buildTechnicianIndex(
  technicians: ITechnician[],
  users: IUserRecord[]
): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of technicians || []) {
    if (!t) continue;
    const id = cleanStr(t.id_technician || t.id);
    const nom = cleanStr(t.nom);
    const resolved = nom || id;
    if (id) map.set(normKey(id), resolved);
    if (nom) map.set(normKey(nom), resolved);
  }
  for (const u of users || []) {
    if (!u) continue;
    const id = cleanStr(u.id_technician || u.id);
    const nom = cleanStr(u.nom);
    const resolved = nom || id;
    if (id && !map.has(normKey(id))) map.set(normKey(id), resolved);
    if (nom && !map.has(normKey(nom))) map.set(normKey(nom), resolved);
  }
  return map;
}

/**
 * Validates and optionally commits a `REF_PARC` bundle in strict dependency order:
 * `01_ZONES -> 03_FAMILIES -> 03_TEMPLATES -> 03_GENERAL_SYSTEM_TYPES`.
 *
 * Enforces:
 * - Zero implicit entity creation on missing foreign keys (`BROKEN_FK`).
 * - Forbidden operational/asset payloads rejected at bundle boundary (`FORBIDDEN_BUNDLE_FIELD`).
 * - `REPLACE_CATALOG` active-reference protection (`REFERENCED_BY_ACTIVE_RECORDS`).
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
      const code = cleanStr(z.code_zone || z.code || z.id_zone);
      if (!code) continue;
      const key = normKey(code);
      const normalized: IZone = {
        ...z,
        code,
        code_zone: code,
        id_zone: cleanStr(z.id_zone || code),
        libelle: cleanStr(z.libelle || z.nom || code),
      };
      workingZonesMap.set(key, normalized);
      aliasZoneToCanonical.set(key, key);
      if (z.id_zone) aliasZoneToCanonical.set(normKey(z.id_zone), key);
      if (z.libelle) aliasZoneToCanonical.set(normKey(z.libelle), key);
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

    const codeKey = normKey(rawCode);
    if (FORBIDDEN_PSEUDO_ZONES.has(codeKey) || FORBIDDEN_PSEUDO_ZONES.has(normKey(rawLibelle))) {
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

    if (seenZoneCodes.has(codeKey)) {
      rejected.push({
        stage: '01_ZONES',
        entity: 'ZONES',
        row: rowNum,
        identifier: rawCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (ZONES) : doublon sur code_zone '${rawCode}'.`,
        blocking: true,
      });
      return;
    }
    seenZoneCodes.add(codeKey);

    const existingCanonicalKey = aliasZoneToCanonical.get(codeKey) || codeKey;
    const prev = workingZonesMap.get(existingCanonicalKey);
    const nextRecord: IZone = {
      ...(prev || {}),
      code: rawCode,
      code_zone: rawCode,
      id_zone: rawCode,
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

    workingZonesMap.set(codeKey, nextRecord);
    aliasZoneToCanonical.set(codeKey, codeKey);
    aliasZoneToCanonical.set(normKey(rawLibelle), codeKey);
  });

  if (mode === 'REPLACE_CATALOG' && rawZones.length > 0) {
    for (const m of existingMachines) {
      const mZone = cleanStr(m.id_zone_default || m.id_zone || m.zone);
      if (!mZone) continue;
      const mZoneKey = normKey(mZone);
      if (!aliasZoneToCanonical.has(mZoneKey) && !workingZonesMap.has(mZoneKey)) {
        rejected.push({
          stage: '01_ZONES',
          entity: 'ZONES',
          row: 0,
          identifier: mZone,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer la zone '${mZone}' en mode REPLACE_CATALOG : référencée par la machine '${m.id_machine_registered || m.id}'.`,
          blocking: true,
        });
      }
    }
    for (const t of existingTechnicians) {
      const tZone = cleanStr(t.id_zone);
      if (!tZone) continue;
      const tZoneKey = normKey(tZone);
      if (!aliasZoneToCanonical.has(tZoneKey) && !workingZonesMap.has(tZoneKey)) {
        rejected.push({
          stage: '01_ZONES',
          entity: 'ZONES',
          row: 0,
          identifier: tZone,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer la zone '${tZone}' en mode REPLACE_CATALOG : référencée par le technicien '${t.nom || t.id_technician}'.`,
          blocking: true,
        });
      }
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
    for (const m of existingMachines) {
      const mFam = cleanStr(m.id_family);
      if (mFam && !workingFamiliesMap.has(normKey(mFam))) {
        rejected.push({
          stage: '03_FAMILIES',
          entity: 'FAMILIES',
          row: 0,
          identifier: mFam,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer la famille '${mFam}' en mode REPLACE_CATALOG : référencée par la machine '${m.id_machine_registered || m.id}'.`,
          blocking: true,
        });
      }
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
    for (const m of existingMachines) {
      const mTpl = cleanStr(m.id_templates);
      if (mTpl && !workingTemplatesMap.has(normKey(mTpl))) {
        rejected.push({
          stage: '03_TEMPLATES',
          entity: 'TEMPLATES',
          row: 0,
          identifier: mTpl,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer le modèle '${mTpl}' en mode REPLACE_CATALOG : référencé par la machine '${m.id_machine_registered || m.id}'.`,
          blocking: true,
        });
      }
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
    const rawCode = cleanStr(row.code_system_type ?? row.id_system_type ?? row.code ?? (row as Record<string, unknown>).id);
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
    const nextRecord: IGeneralSystemType = {
      id: cleanStr(row.id_system_type || prev?.id || rawCode),
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
    for (const m of existingMachines) {
      const sysType = cleanStr(m.id_general_system_type);
      if (sysType && !workingSystemTypesMap.has(normKey(sysType))) {
        rejected.push({
          stage: '03_GENERAL_SYSTEM_TYPES',
          entity: 'GENERAL_SYSTEM_TYPES',
          row: 0,
          identifier: sysType,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer le type système général '${sysType}' en mode REPLACE_CATALOG : référencé par l'équipement '${m.id_machine_registered || m.id}'.`,
          blocking: true,
        });
      }
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
 * Validates and optionally commits an `ASSETS_MACHINES` bundle (`03_MACHINES`).
 *
 * Enforces:
 * - Dependency Gate against live `ZONES`, `FAMILIES`, `TEMPLATES`, and `GENERAL_SYSTEM_TYPES`.
 * - Strict branch validation for `PRODUCTION` (`code_family` + `code_template` matching family)
 *   vs `SYSTEM_GENERAL` (`code_system_type`).
 * - Forbidden Blueprint/PM/CM/Movement embedded payloads (`FORBIDDEN_BUNDLE_FIELD`).
 * - Parent line hierarchy cycle detection (`CIRCULAR_HIERARCHY`) without property inheritance.
 * - `REPLACE_CATALOG` active-reference protection against PM tasks, Corrective BTs, Movements, and Warehouse items.
 */
export function validateAndCommitAssetsMachinesBundle(
  input: AssetsMachinesBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<AssetsMachinesStagingResult> {
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
  const existingUsers = options.existingUsers ?? store.users ?? [];
  const existingPreventiveTasks = options.existingPreventiveTasks ?? store.preventiveTasks ?? [];
  const existingCorrective =
    options.existingCorrectiveInterventions ?? store.correctiveInterventions ?? [];
  const existingMouvements = options.existingMouvements ?? store.mouvements ?? [];
  const existingWarehouseItems = options.existingWarehouseItems ?? store.warehouseItems ?? [];

  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const accepted: AcceptedStageRecord[] = [];

  const abortReport = (): ImportReport<AssetsMachinesStagingResult> => ({
    bundleType: 'ASSETS_MACHINES',
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
      nextMachines: [...existingMachines],
    },
  });

  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    rejected.push({
      stage: '03_MACHINES',
      entity: 'MACHINES',
      row: 0,
      code: 'RBAC_DENIED',
      message: 'Accès refusé : le mode REPLACE_CATALOG est strictement réservé au rôle ADMIN.',
      blocking: true,
    });
    return abortReport();
  }

  if (!input || typeof input !== 'object' || !Array.isArray(input.machines)) {
    rejected.push({
      stage: '03_MACHINES',
      entity: 'MACHINES',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: "Format ASSETS_MACHINES invalide : le tableau 'machines' est requis.",
      blocking: true,
    });
    return abortReport();
  }

  for (const forbiddenKey of FORBIDDEN_ASSETS_MACHINES_ROOT_KEYS) {
    const val = (input as Record<string, unknown>)[forbiddenKey];
    if (Array.isArray(val) && val.length > 0) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'ASSETS_MACHINES',
        row: 0,
        identifier: forbiddenKey,
        code: 'FORBIDDEN_BUNDLE_FIELD',
        message: `Le paquet ASSETS_MACHINES interdit l'inclusion de '${forbiddenKey}'.`,
        blocking: true,
      });
    }
  }

  const zoneLookup = buildZoneIndex(existingZones);
  const familyLookup = buildFamilyIndex(existingFamilies);
  const templateLookup = buildTemplateIndex(existingTemplates);
  const systemTypeLookup = buildSystemTypeIndex(existingGeneralSystemTypes);
  const techLookup = buildTechnicianIndex(existingTechnicians, existingUsers);

  const workingMachinesMap = new Map<string, IMachine>();
  if (mode === 'MERGE') {
    for (const m of existingMachines) {
      if (!m) continue;
      const code = cleanStr(m.id_machine_registered || m.id || m.code);
      if (!code) continue;
      workingMachinesMap.set(normKey(code), { ...m, id_machine_registered: code, id: code });
    }
  }

  const seenMachineCodes = new Set<string>();
  const pendingParentLinks: Array<{ rowNum: number; codeMachine: string; parentCode: string }> = [];

  let mCreated = 0;
  let mUpdated = 0;
  let mUnchanged = 0;
  let mSkipped = 0;

  input.machines.forEach((row: AssetsMachineRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      mSkipped++;
      return;
    }

    const rawCode = cleanStr(
      row.code_machine ??
        (row as Record<string, unknown>).id_machine_registered ??
        (row as Record<string, unknown>).id
    );
    const rawDesig = cleanStr(row.designation ?? row.nom ?? (row as Record<string, unknown>).libelle);
    const rawZone = cleanStr(
      row.code_zone ??
        (row as Record<string, unknown>).id_zone_default ??
        (row as Record<string, unknown>).id_zone
    );

    if (!rawCode && !rawDesig && !rawZone) {
      mSkipped++;
      return;
    }

    // Reject embedded Blueprint/PM/Movement fields inside a machine row
    for (const embeddedKey of FORBIDDEN_MACHINE_ROW_EMBEDDED_KEYS) {
      if ((row as Record<string, unknown>)[embeddedKey] !== undefined) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode || `ROW-${rowNum}`,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : le champ '${embeddedKey}' est interdit dans ASSETS_MACHINES.`,
          blocking: true,
        });
        return;
      }
    }

    if (!rawCode) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawDesig,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (MACHINES) : 'code_machine' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    if (!rawDesig) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : 'designation' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    if (!rawZone) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : 'code_zone' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (seenMachineCodes.has(codeKey)) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (MACHINES) : doublon sur code_machine '${rawCode}'.`,
        blocking: true,
      });
      return;
    }
    seenMachineCodes.add(codeKey);

    if (FORBIDDEN_PSEUDO_ZONES.has(normKey(rawZone))) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawCode,
        code: 'SCHEMA_MISMATCH',
        message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : '${rawZone}' n'est pas une zone valide (utiliser asset_class = SYSTEM_GENERAL avec une zone physique réelle).`,
        blocking: true,
      });
      return;
    }

    const resolvedZone = zoneLookup.get(normKey(rawZone));
    if (!resolvedZone) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawCode,
        code: 'BROKEN_FK',
        message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : la zone '${rawZone}' est introuvable dans ZONES.`,
        blocking: true,
      });
      return;
    }

    const rawAssetClass = cleanStr(row.asset_class || 'PRODUCTION').toUpperCase();
    if (rawAssetClass !== 'PRODUCTION' && rawAssetClass !== 'SYSTEM_GENERAL') {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawCode,
        code: 'SCHEMA_MISMATCH',
        message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : asset_class '${row.asset_class}' invalide (attendu PRODUCTION ou SYSTEM_GENERAL).`,
        blocking: true,
      });
      return;
    }
    const assetClass = rawAssetClass as AssetClass;

    let resolvedFamilyCode = '';
    let resolvedTemplateCode = '';
    let resolvedSystemTypeCode: string | null = null;

    if (assetClass === 'PRODUCTION') {
      const rawFam = cleanStr(
        row.code_family ?? (row as Record<string, unknown>).id_family
      );
      const rawTpl = cleanStr(
        row.code_template ??
          (row as Record<string, unknown>).id_templates ??
          (row as Record<string, unknown>).id_template
      );

      if (!rawFam) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'MISSING_REQUIRED',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : 'code_family' est obligatoire pour une machine PRODUCTION.`,
          blocking: true,
        });
        return;
      }
      if (!rawTpl) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'MISSING_REQUIRED',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : 'code_template' est obligatoire pour une machine PRODUCTION.`,
          blocking: true,
        });
        return;
      }

      const famObj = familyLookup.get(normKey(rawFam));
      if (!famObj) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : la famille '${rawFam}' est introuvable dans FAMILIES.`,
          blocking: true,
        });
        return;
      }

      const tplObj = templateLookup.get(normKey(rawTpl));
      if (!tplObj) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : le modèle '${rawTpl}' est introuvable dans TEMPLATES.`,
          blocking: true,
        });
        return;
      }

      const tplFamKey = normKey(tplObj.id_family || tplObj.family);
      const famKey = normKey(famObj.id_family || famObj.code);
      if (tplFamKey && tplFamKey !== famKey) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'TEMPLATE_FAMILY_MISMATCH',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : le modèle '${rawTpl}' appartient à la famille '${tplObj.id_family}' et non à '${rawFam}'.`,
          blocking: true,
        });
        return;
      }

      resolvedFamilyCode = cleanStr(famObj.id_family || famObj.code);
      resolvedTemplateCode = cleanStr(tplObj.id_templates);
    } else {
      const rawSysType = cleanStr(
        row.code_system_type ??
          (row as Record<string, unknown>).id_general_system_type ??
          (row as Record<string, unknown>).id_system_type
      );
      if (!rawSysType) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'MISSING_REQUIRED',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : 'code_system_type' est obligatoire pour un équipement SYSTEM_GENERAL.`,
          blocking: true,
        });
        return;
      }

      const sysObj = systemTypeLookup.get(normKey(rawSysType));
      if (!sysObj) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : le type système général '${rawSysType}' est introuvable dans GENERAL_SYSTEM_TYPES.`,
          blocking: true,
        });
        return;
      }
      resolvedSystemTypeCode = cleanStr(sysObj.code || sysObj.id);
    }

    // Optional Technician resolution
    const rawTech = cleanStr(
      row.code_technician ?? (row as Record<string, unknown>).technician
    );
    let resolvedTech = '';
    if (rawTech) {
      const foundTech = techLookup.get(normKey(rawTech));
      if (foundTech) {
        resolvedTech = foundTech;
      } else {
        const shouldBlock =
          options.strictTechnicianCheck === true ||
          (options.strictTechnicianCheck !== false && techLookup.size > 0);
        const issue: ImportIssue = {
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: rowNum,
          identifier: rawCode,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : le technicien '${rawTech}' est introuvable dans le référentiel personnel.`,
          blocking: shouldBlock,
        };
        if (shouldBlock) {
          rejected.push(issue);
          return;
        } else {
          warnings.push(issue);
          resolvedTech = rawTech;
        }
      }
    }

    const parentCode = cleanStr(
      row.parent_code_machine ?? (row as Record<string, unknown>).parent_id
    );
    if (parentCode) {
      pendingParentLinks.push({ rowNum, codeMachine: rawCode, parentCode });
    }

    const prev = workingMachinesMap.get(codeKey);
    const rawStatus = cleanStr(row.status ?? (row as Record<string, unknown>).statut);
    const isArchived =
      normKey(rawStatus) === 'ARCHIVEE' ||
      normKey(rawStatus) === 'ARCHIVED' ||
      row.is_active === false;
    const statusValue = isArchived
      ? 'ARCHIVEE'
      : rawStatus || prev?.status || 'En service';

    const canonicalZone = cleanStr(resolvedZone.code_zone || resolvedZone.id_zone || resolvedZone.code);

    const nextMachine: IMachine = {
      ...(prev || {}),
      id_machine_registered: rawCode,
      id: rawCode,
      code: rawCode,
      designation: rawDesig,
      nom: rawDesig,
      id_zone_default: canonicalZone,
      id_zone: canonicalZone,
      asset_class: assetClass,
      id_family: resolvedFamilyCode,
      id_templates: resolvedTemplateCode,
      id_general_system_type: resolvedSystemTypeCode,
      technician: resolvedTech || prev?.technician || '',
      parent_id: parentCode || null,
      asset_level: cleanStr(row.asset_level || prev?.asset_level || 'MACHINE').toUpperCase() === 'LINE' ? 'LINE' : 'MACHINE',
      status: statusValue,
      statut: statusValue,
      is_active: !isArchived,
      serial_number: cleanStr(row.serial_number) || prev?.serial_number || '',
      date_mise_en_service:
        cleanStr(row.commissioning_date ?? (row as Record<string, unknown>).date_mise_en_service) ||
        prev?.date_mise_en_service ||
        '',
    };

    if (prev) {
      mUpdated++;
    } else {
      mCreated++;
    }
    workingMachinesMap.set(codeKey, nextMachine);
  });

  // Second pass: validate parent_code_machine existence and detect circular hierarchies
  for (const link of pendingParentLinks) {
    const childKey = normKey(link.codeMachine);
    const parentKey = normKey(link.parentCode);

    if (childKey === parentKey) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: link.rowNum,
        identifier: link.codeMachine,
        code: 'CIRCULAR_HIERARCHY',
        message: `Ligne ${link.rowNum} (MACHINES [${link.codeMachine}]) : une machine ne peut pas être son propre parent.`,
        blocking: true,
      });
      continue;
    }

    if (!workingMachinesMap.has(parentKey)) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: link.rowNum,
        identifier: link.codeMachine,
        code: 'BROKEN_FK',
        message: `Ligne ${link.rowNum} (MACHINES [${link.codeMachine}]) : la machine/ligne parente '${link.parentCode}' est introuvable.`,
        blocking: true,
      });
      continue;
    }

    const visited = new Set<string>([childKey]);
    let cursor: string | null = parentKey;
    let hasCycle = false;
    while (cursor) {
      if (visited.has(cursor)) {
        hasCycle = true;
        break;
      }
      visited.add(cursor);
      const cursorMachine = workingMachinesMap.get(cursor);
      const nextParent = cleanStr(cursorMachine?.parent_id);
      cursor = nextParent ? normKey(nextParent) : null;
    }

    if (hasCycle) {
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: link.rowNum,
        identifier: link.codeMachine,
        code: 'CIRCULAR_HIERARCHY',
        message: `Ligne ${link.rowNum} (MACHINES [${link.codeMachine}]) : boucle circulaire détectée dans parent_code_machine.`,
        blocking: true,
      });
    }
  }

  // REPLACE_CATALOG active-reference guard
  if (mode === 'REPLACE_CATALOG') {
    for (const task of existingPreventiveTasks) {
      const mCode = cleanStr(task.id_machine);
      if (mCode && !workingMachinesMap.has(normKey(mCode))) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: 0,
          identifier: mCode,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer la machine '${mCode}' en mode REPLACE_CATALOG : référencée par une tâche préventive (${task.code || task.id}).`,
          blocking: true,
        });
      }
    }
    for (const bt of existingCorrective) {
      const mCode = cleanStr(bt.code_machine);
      if (mCode && !workingMachinesMap.has(normKey(mCode))) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: 0,
          identifier: mCode,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer la machine '${mCode}' en mode REPLACE_CATALOG : référencée par une intervention corrective (${bt.num_bt || bt.id}).`,
          blocking: true,
        });
      }
    }
    for (const mv of existingMouvements) {
      const mCode = cleanStr(mv.id_machine_registered || (mv as Record<string, unknown>).machine);
      if (
        mCode &&
        mCode !== 'Stock' &&
        mCode !== 'Atelier' &&
        mCode !== 'N/A' &&
        !workingMachinesMap.has(normKey(mCode))
      ) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: 0,
          identifier: mCode,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer la machine '${mCode}' en mode REPLACE_CATALOG : référencée par un mouvement de stock.`,
          blocking: true,
        });
      }
    }
    for (const wh of existingWarehouseItems) {
      const mCode = cleanStr(wh.id_machine_registered || wh.id_machine);
      if (mCode && !workingMachinesMap.has(normKey(mCode))) {
        rejected.push({
          stage: '03_MACHINES',
          entity: 'MACHINES',
          row: 0,
          identifier: mCode,
          code: 'REFERENCED_BY_ACTIVE_RECORDS',
          message: `Impossible de supprimer la machine '${mCode}' en mode REPLACE_CATALOG : référencée par un organe d'entrepôt (${wh.code || wh.id_warehouse_item}).`,
          blocking: true,
        });
      }
    }
  }

  accepted.push({
    stage: '03_MACHINES',
    entity: 'MACHINES',
    created: mCreated,
    updated: mUpdated,
    unchanged: mUnchanged,
    skipped: mSkipped,
  });

  const nextMachines = Array.from(workingMachinesMap.values());
  const success = rejected.length === 0;
  let committed = false;

  if (success && !dryRun) {
    DataGateway.saveMachines(nextMachines);
    store.setMachines(nextMachines);

    DataGateway.appendAuditEvent({
      actionType: 'SETTINGS_CONFIG_UPDATED',
      entityType: 'MACHINE',
      entityId: 'ASSETS_MACHINES',
      actorId: options.actorId || 'ADMIN',
      actorName: options.actorName || 'Import Pipeline',
      actorRole,
      before: { machinesCount: existingMachines.length },
      after: { machinesCount: nextMachines.length, created: mCreated, updated: mUpdated },
      meta: { mode, origin },
    });

    committed = true;
  }

  return {
    bundleType: 'ASSETS_MACHINES',
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
      nextMachines,
    },
  };
}

/**
 * Adapter wrapping the existing `pdrExcelValidator` (`Groups -> Types -> Items`)
 * into the unified `ImportReport<RefPdrStagingResult>` contract.
 */
export function validateAndCommitRefPdrBundle(
  input: RefPdrBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<RefPdrStagingResult> {
  const startTime = Date.now();
  const mode: ImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const origin: ImportSourceOrigin = options.origin || 'JSON_BUNDLE';
  const commitPolicy: ImportCommitPolicy = options.commitPolicy || 'ATOMIC';
  const dryRun = Boolean(options.dryRun);
  const actorRole = normKey(options.actorRole || 'ADMIN');

  const store = useGmaoStore.getState();
  const pdrReport = validateAndReconcilePdrCatalogImport(
    {
      groups: input?.groups || [],
      types: input?.types || [],
      items: input?.items || [],
    },
    {
      mode,
      actorRole,
      existingGroups: options.existingPdrGroups ?? store.pdrGroups ?? [],
      existingTypes: options.existingStockTypes ?? (store.types as StockType[]) ?? [],
      existingStock: options.existingStock ?? store.rawStock ?? [],
      existingMouvements: options.existingMouvements ?? store.mouvements ?? [],
    }
  );

  const rejected: ImportIssue[] = pdrReport.errors.map((err) => ({
    stage: '04_PDR',
    entity: err.sheet,
    row: err.row,
    identifier: err.identifier,
    code: err.message.includes('Accès refusé')
      ? 'RBAC_DENIED'
      : err.message.includes('introuvable')
      ? 'BROKEN_FK'
      : err.message.includes('Doublon')
      ? 'DUPLICATE_KEY'
      : 'MISSING_REQUIRED',
    message: err.message,
    blocking: true,
  }));

  const accepted: AcceptedStageRecord[] = [
    {
      stage: '04_PDR',
      entity: 'PDR_GROUPS',
      created: pdrReport.created.groups,
      updated: pdrReport.updated.groups,
      unchanged: 0,
      skipped: pdrReport.skipped.groups,
    },
    {
      stage: '04_PDR',
      entity: 'PDR_TYPES',
      created: pdrReport.created.types,
      updated: pdrReport.updated.types,
      unchanged: 0,
      skipped: pdrReport.skipped.types,
    },
    {
      stage: '04_PDR',
      entity: 'PDR_ITEMS',
      created: pdrReport.created.items,
      updated: pdrReport.updated.items,
      unchanged: 0,
      skipped: pdrReport.skipped.items,
    },
  ];

  const success = rejected.length === 0 && pdrReport.success;
  let committed = false;

  if (success && !dryRun) {
    committed = applyPdrCatalogImportToStore(pdrReport);
  }

  return {
    bundleType: 'REF_PDR',
    success,
    dryRun,
    origin,
    mode,
    commitPolicy,
    committed,
    accepted,
    rejected,
    warnings: [],
    durationMs: Date.now() - startTime,
    staging: {
      nextGroups: pdrReport.nextGroups,
      nextTypes: pdrReport.nextTypes,
      nextStock: pdrReport.nextStock,
      nextDesignations: pdrReport.nextDesignations,
    },
  };
}

/**
 * Unified entry point dispatching `REF_PARC`, `ASSETS_MACHINES`, or `REF_PDR` bundles.
 */
export function runUnifiedImportPipeline(
  bundle:
    | (RefParcBundleInput & { bundleType: 'REF_PARC' })
    | (AssetsMachinesBundleInput & { bundleType: 'ASSETS_MACHINES' })
    | (RefPdrBundleInput & { bundleType: 'REF_PDR' }),
  options: UnifiedImportOptions = {}
): ImportReport<any> {
  if (bundle.bundleType === 'REF_PARC') {
    return validateAndCommitRefParcBundle(bundle, options);
  }
  if (bundle.bundleType === 'ASSETS_MACHINES') {
    return validateAndCommitAssetsMachinesBundle(bundle, options);
  }
  if (bundle.bundleType === 'REF_PDR') {
    return validateAndCommitRefPdrBundle(bundle, options);
  }
  throw new Error(`Type de paquet non pris en charge : ${(bundle as any)?.bundleType}`);
}

/**
 * Reverse export for `REF_PARC` using stable `code_*` identifiers.
 */
export function exportRefParcBundle(snapshot?: {
  zones?: IZone[];
  families?: IMachineFamily[];
  templates?: IMachineTemplate[];
  generalSystemTypes?: IGeneralSystemType[];
}): Required<Pick<RefParcBundleInput, 'bundleType' | 'zones' | 'families' | 'templates' | 'generalSystemTypes'>> {
  const store = useGmaoStore.getState();
  const zones = snapshot?.zones ?? store.zones ?? [];
  const families = snapshot?.families ?? store.families ?? [];
  const templates = snapshot?.templates ?? store.templates ?? [];
  const generalSystemTypes = snapshot?.generalSystemTypes ?? store.generalSystemTypes ?? [];

  return {
    bundleType: 'REF_PARC',
    zones: zones.map((z) => ({
      code_zone: cleanStr(z.code_zone || z.code || z.id_zone),
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
 * Reverse export for `ASSETS_MACHINES` using stable `code_*` identifiers.
 */
export function exportAssetsMachinesBundle(snapshot?: {
  machines?: IMachine[];
}): AssetsMachinesBundleInput & { bundleType: 'ASSETS_MACHINES' } {
  const store = useGmaoStore.getState();
  const machines = snapshot?.machines ?? store.machines ?? [];

  return {
    bundleType: 'ASSETS_MACHINES',
    machines: machines.map((m) => {
      const assetClass: AssetClass =
        cleanStr(m.asset_class).toUpperCase() === 'SYSTEM_GENERAL'
          ? 'SYSTEM_GENERAL'
          : 'PRODUCTION';
      return {
        code_machine: cleanStr(m.id_machine_registered || m.id || m.code),
        designation: cleanStr(m.designation || m.nom || m.libelle),
        code_zone: cleanStr(m.id_zone_default || m.id_zone || m.zone),
        asset_class: assetClass,
        code_family: assetClass === 'PRODUCTION' ? cleanStr(m.id_family) : null,
        code_template: assetClass === 'PRODUCTION' ? cleanStr(m.id_templates) : null,
        code_system_type:
          assetClass === 'SYSTEM_GENERAL' ? cleanStr(m.id_general_system_type) : null,
        code_technician: cleanStr(m.technician) || null,
        parent_code_machine: cleanStr(m.parent_id) || null,
        asset_level: cleanStr(m.asset_level || 'MACHINE').toUpperCase() === 'LINE' ? 'LINE' : 'MACHINE',
        status: cleanStr(m.status || m.statut || 'En service'),
        is_active: m.is_active !== false && normKey(m.status || m.statut) !== 'ARCHIVEE',
        serial_number: cleanStr(m.serial_number || m.numero_serie),
        commissioning_date: cleanStr(m.date_mise_en_service || m.date_installation),
      };
    }),
  };
}
