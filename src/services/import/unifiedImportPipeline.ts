import { DataGateway } from '../../application/DataGateway';
import { useGmaoStore } from '../../store/useGmaoStore';
import type {
  AssetClass,
  IGeneralSystemType,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IOperation,
  IPartDesignation,
  IStockItem,
  ITechnician,
  IUserRecord,
  IZone,
  PdrGroup,
  StockType,
} from '../../types/domain';
import { sanitizeMachinesHierarchy } from '../../utils/assetHierarchy';
import {
  applyPdrCatalogImportToStore,
  validateAndReconcilePdrCatalogImport,
} from '../pdr/pdrExcelValidator';
import type { PdrCatalogImportError } from '../pdr/types/pdrExcelTypes';
import refParcOfficialTemplate from '../../../templates/import/REF_PARC.template.json';
import refPersonnelOfficialTemplate from '../../../templates/import/REF_PERSONNEL.template.json';
import assetsMachinesOfficialTemplate from '../../../templates/import/ASSETS_MACHINES.template.json';
import refPdrOfficialTemplate from '../../../templates/import/REF_PDR.template.json';
import type {
  AcceptedStageRecord,
  AssetsMachineRow,
  AssetsMachinesBundleInput,
  AssetsMachinesStagingResult,
  ImportCommitPolicy,
  ImportIssue,
  ImportIssueCode,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  PipelineStageId,
  RefParcBundleInput,
  RefParcFamilyRow,
  RefParcGeneralSystemTypeRow,
  RefParcStagingResult,
  RefParcTemplateRow,
  RefParcZoneRow,
  RefPdrBundleInput,
  RefPdrStagingResult,
  RefPersonnelBundleInput,
  RefPersonnelOperationRow,
  RefPersonnelStagingResult,
  RefPersonnelTechnicianRow,
  UnifiedImportOptions,
} from './types/unifiedImportTypes';

const FORBIDDEN_PSEUDO_ZONES = new Set(['DIVERS', 'SYSTEM_GENERAL', 'SYSTEME_GENERAL', 'TOUTES']);

const FORBIDDEN_GATEWAY_PERSONNEL_CODES = new Set(['ADMIN', 'MAGASINIER', 'VIEWER']);

const FORBIDDEN_PERSONNEL_AUTH_KEYS = [
  'password',
  'passwordHash',
  'pin',
  'masterPin',
  'secret',
  'token',
] as const;

const FORBIDDEN_REF_PARC_ROOT_KEYS = [
  'machines',
  'preventiveTasks',
  'mouvements',
  'blueprints',
  'correctiveInterventions',
  'warehouseItems',
] as const;

const FORBIDDEN_REF_PERSONNEL_ROOT_KEYS = [
  'machines',
  'preventiveTasks',
  'mouvements',
  'blueprints',
  'correctiveInterventions',
  'warehouseItems',
  'accounts',
  'credentials',
] as const;

const FORBIDDEN_ASSETS_MACHINES_ROOT_KEYS = [
  'blueprints',
  'preventiveTasks',
  'mouvements',
  'correctiveInterventions',
] as const;

const FORBIDDEN_REF_PDR_ROOT_KEYS = [
  'mouvements',
  'machines',
  'preventiveTasks',
  'interventions',
  'correctiveInterventions',
  'blueprints',
  'warehouseItems',
  'password',
  'passwordHash',
  'accounts',
  'credentials',
] as const;

const FORBIDDEN_REF_PDR_ROW_KEYS = [
  'mouvements',
  'machines',
  'preventiveTasks',
  'interventions',
  'correctiveInterventions',
  'blueprints',
  'password',
  'passwordHash',
  'pin',
  'secret',
  'token',
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

function foldAccentsKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function cleanStr(raw: unknown): string {
  return String(raw ?? '').trim();
}

interface ZoneIndexLookup {
  canonicalMap: Map<string, IZone>;
  legacyFallbackMap: Map<string, IZone>;
}

function buildZoneIndex(zones: IZone[]): ZoneIndexLookup {
  const canonicalMap = new Map<string, IZone>();
  const legacyFallbackMap = new Map<string, IZone>();

  for (const z of zones) {
    if (!z) continue;
    const rawCanonical = cleanStr(z.code_zone || z.code || z.id_zone);
    if (!rawCanonical) continue;
    const canonicalCode = normKey(rawCanonical);
    const normalizedRecord: IZone = {
      ...z,
      code: canonicalCode,
      code_zone: canonicalCode,
      id_zone: canonicalCode,
      libelle: cleanStr(z.libelle || z.nom || rawCanonical),
    };
    canonicalMap.set(canonicalCode, normalizedRecord);

    if (z.id_zone) {
      legacyFallbackMap.set(normKey(z.id_zone), normalizedRecord);
      legacyFallbackMap.set(foldAccentsKey(z.id_zone), normalizedRecord);
    }
    if (z.code) {
      legacyFallbackMap.set(normKey(z.code), normalizedRecord);
      legacyFallbackMap.set(foldAccentsKey(z.code), normalizedRecord);
    }
    if (z.libelle) {
      legacyFallbackMap.set(normKey(z.libelle), normalizedRecord);
      legacyFallbackMap.set(foldAccentsKey(z.libelle), normalizedRecord);
    }
    if (z.nom) {
      legacyFallbackMap.set(normKey(z.nom), normalizedRecord);
      legacyFallbackMap.set(foldAccentsKey(z.nom), normalizedRecord);
    }
  }

  return { canonicalMap, legacyFallbackMap };
}

function resolveZoneWithCompatibility(
  rawZoneInput: string,
  lookup: ZoneIndexLookup
): { zone: IZone | null; viaLegacyFallback: boolean; canonicalCode: string } {
  const exactKey = normKey(rawZoneInput);
  const direct = lookup.canonicalMap.get(exactKey);
  if (direct) {
    const canonicalCode = normKey(direct.code_zone || direct.code || direct.id_zone);
    return {
      zone: direct,
      viaLegacyFallback: cleanStr(rawZoneInput) !== canonicalCode,
      canonicalCode,
    };
  }

  const fallback =
    lookup.legacyFallbackMap.get(exactKey) ||
    lookup.legacyFallbackMap.get(foldAccentsKey(rawZoneInput)) ||
    null;

  if (fallback) {
    const canonicalCode = normKey(fallback.code_zone || fallback.code || fallback.id_zone);
    return {
      zone: fallback,
      viaLegacyFallback: true,
      canonicalCode,
    };
  }

  return { zone: null, viaLegacyFallback: false, canonicalCode: '' };
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
 * - Zone resolution: canonical `code_zone` first; fallback to legacy `id_zone`/`libelle`
 *   writes canonical `code_zone` onto the machine and records a `LEGACY_ZONE_NORMALIZED` warning.
 * - Strict branch validation for `PRODUCTION` (`code_family` + `code_template` matching family)
 *   vs `SYSTEM_GENERAL` (`code_system_type`).
 * - Forbidden Blueprint/PM/CM/Movement embedded payloads (`FORBIDDEN_BUNDLE_FIELD`).
 * - Two-pass `parent_code_machine` validation + `sanitizeMachinesHierarchy` with zero property inheritance.
 * - `REPLACE_CATALOG` active-reference protection (`REFERENCED_BY_ACTIVE_RECORDS`) with link counts.
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
    const rawDesig = cleanStr(
      row.designation ?? row.nom ?? (row as Record<string, unknown>).libelle
    );
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

    const { zone: resolvedZone, viaLegacyFallback, canonicalCode: canonicalZone } =
      resolveZoneWithCompatibility(rawZone, zoneLookup);

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

    if (viaLegacyFallback) {
      warnings.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: rowNum,
        identifier: rawCode,
        code: 'LEGACY_ZONE_NORMALIZED',
        message: `Ligne ${rowNum} (MACHINES [${rawCode}]) : zone '${rawZone}' normalisée par compatibilité vers le code canonique '${canonicalZone}'.`,
        blocking: false,
      });
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
      const rawFam = cleanStr(row.code_family ?? (row as Record<string, unknown>).id_family);
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
    const rawTech = cleanStr(row.code_technician ?? (row as Record<string, unknown>).technician);
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
    const statusValue = isArchived ? 'ARCHIVEE' : rawStatus || prev?.status || 'En service';

    // Strict non-inheritance rule: each machine owns its own canonical zone, family, template, and blueprint
    const nextMachine: IMachine = {
      ...(prev || {}),
      id_machine_registered: rawCode,
      id: rawCode,
      code: rawCode,
      designation: rawDesig,
      nom: rawDesig,
      id_zone_default: canonicalZone,
      id_zone: canonicalZone,
      zone: canonicalZone,
      asset_class: assetClass,
      id_family: resolvedFamilyCode,
      id_templates: resolvedTemplateCode,
      id_general_system_type: resolvedSystemTypeCode,
      technician: resolvedTech || prev?.technician || '',
      parent_id: parentCode ? normKey(parentCode) : null,
      asset_level:
        cleanStr(row.asset_level || prev?.asset_level || 'MACHINE').toUpperCase() === 'LINE'
          ? 'LINE'
          : 'MACHINE',
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

  // REPLACE_CATALOG active-reference guard with aggregated breakdown per deleted machine key
  if (mode === 'REPLACE_CATALOG') {
    const deletedMachineRefs = new Map<
      string,
      {
        preventiveTasks: number;
        correctiveInterventions: number;
        mouvements: number;
        warehouseItems: number;
      }
    >();

    const recordRef = (
      rawMachineCode: string,
      bucket:
        | 'preventiveTasks'
        | 'correctiveInterventions'
        | 'mouvements'
        | 'warehouseItems'
    ) => {
      const mKey = normKey(rawMachineCode);
      if (!mKey || workingMachinesMap.has(mKey)) return;
      const entry = deletedMachineRefs.get(mKey) || {
        preventiveTasks: 0,
        correctiveInterventions: 0,
        mouvements: 0,
        warehouseItems: 0,
      };
      entry[bucket] += 1;
      deletedMachineRefs.set(mKey, entry);
    };

    for (const task of existingPreventiveTasks) {
      const mCode = cleanStr(task.id_machine);
      if (mCode) recordRef(mCode, 'preventiveTasks');
    }
    for (const bt of existingCorrective) {
      const mCode = cleanStr(bt.code_machine);
      if (mCode) recordRef(mCode, 'correctiveInterventions');
    }
    for (const mv of existingMouvements) {
      const mCode = cleanStr(
        mv.id_machine_registered || (mv as Record<string, unknown>).machine
      );
      if (mCode && mCode !== 'Stock' && mCode !== 'Atelier' && mCode !== 'N/A') {
        recordRef(mCode, 'mouvements');
      }
    }
    for (const wh of existingWarehouseItems) {
      const mCode = cleanStr(wh.id_machine_registered || wh.id_machine);
      if (mCode) recordRef(mCode, 'warehouseItems');
    }

    for (const [mKey, breakdown] of deletedMachineRefs.entries()) {
      const total =
        breakdown.preventiveTasks +
        breakdown.correctiveInterventions +
        breakdown.mouvements +
        breakdown.warehouseItems;
      rejected.push({
        stage: '03_MACHINES',
        entity: 'MACHINES',
        row: 0,
        identifier: mKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer la machine '${mKey}' en mode REPLACE_CATALOG : ${total} lien(s) opérationnel(s) actif(s) (PM: ${breakdown.preventiveTasks}, BT: ${breakdown.correctiveInterventions}, Mouvements: ${breakdown.mouvements}, Entrepôt: ${breakdown.warehouseItems}). Utilisez MERGE ou archivez la machine.`,
        blocking: true,
        referencedCount: total,
        referenceBreakdown: breakdown,
      });
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

  const rawNextMachines = Array.from(workingMachinesMap.values());
  const nextMachines =
    rejected.length === 0 ? sanitizeMachinesHierarchy(rawNextMachines) : rawNextMachines;
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
 * Validates and optionally commits a `REF_PERSONNEL` bundle (`02_PERSONNEL`).
 *
 * Enforces:
 * - Stable operational identifiers (`code_technician`, `code_operation`) and display names (`nom`).
 * - Optional `code_zone` validated against live `ZONES` (`BROKEN_FK` when unknown; `LEGACY_ZONE_NORMALIZED` warning on legacy label match).
 * - Strict security boundary: rejects any row or bundle containing auth secrets (`password`, `passwordHash`, `pin`, `masterPin`, `token`) or gateway account IDs (`ADMIN`, `MAGASINIER`, `VIEWER`).
 * - `REPLACE_CATALOG` active-reference protection (`REFERENCED_BY_ACTIVE_RECORDS`) across `machines`, `preventiveTasks`, `correctiveInterventions`, and `mouvements`.
 * - Single unified persistence path (`DataGateway.savePersonnel(nextUsers, nextTechnicians, nextOperations)`) with zero mutation of login/auth accounts.
 */
export function validateAndCommitRefPersonnelBundle(
  input: RefPersonnelBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<RefPersonnelStagingResult> {
  const startTime = Date.now();
  const mode: ImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const origin: ImportSourceOrigin = options.origin || 'JSON_BUNDLE';
  const commitPolicy: ImportCommitPolicy = options.commitPolicy || 'ATOMIC';
  const dryRun = Boolean(options.dryRun);
  const actorRole = normKey(options.actorRole || 'ADMIN');

  const store = useGmaoStore.getState();
  const existingZones = options.existingZones ?? store.zones ?? [];
  const existingTechnicians = options.existingTechnicians ?? store.technicians ?? [];
  const existingOperations = options.existingOperations ?? store.operations ?? [];
  const existingUsers = options.existingUsers ?? store.users ?? [];
  const existingMachines = options.existingMachines ?? store.machines ?? [];
  const existingPreventiveTasks = options.existingPreventiveTasks ?? store.preventiveTasks ?? [];
  const existingCorrective =
    options.existingCorrectiveInterventions ?? store.correctiveInterventions ?? [];
  const existingMouvements = options.existingMouvements ?? store.mouvements ?? [];

  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const accepted: AcceptedStageRecord[] = [];

  const abortReport = (): ImportReport<RefPersonnelStagingResult> => ({
    bundleType: 'REF_PERSONNEL',
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
      nextTechnicians: [...existingTechnicians],
      nextOperations: [...existingOperations],
      nextUsers: [...existingUsers],
    },
  });

  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    rejected.push({
      stage: '02_PERSONNEL',
      entity: 'REF_PERSONNEL',
      row: 0,
      code: 'RBAC_DENIED',
      message: 'Accès refusé : le mode REPLACE_CATALOG est strictement réservé au rôle ADMIN.',
      blocking: true,
    });
    return abortReport();
  }

  if (!input || typeof input !== 'object') {
    rejected.push({
      stage: '02_PERSONNEL',
      entity: 'REF_PERSONNEL',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: 'Format de paquet REF_PERSONNEL invalide.',
      blocking: true,
    });
    return abortReport();
  }

  for (const forbiddenKey of FORBIDDEN_REF_PERSONNEL_ROOT_KEYS) {
    const val = (input as Record<string, unknown>)[forbiddenKey];
    if (Array.isArray(val) && val.length > 0) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'REF_PERSONNEL',
        row: 0,
        identifier: forbiddenKey,
        code: 'FORBIDDEN_BUNDLE_FIELD',
        message: `Le paquet REF_PERSONNEL interdit l'inclusion de '${forbiddenKey}'.`,
        blocking: true,
      });
    }
  }

  const rawTechnicians = Array.isArray(input.technicians) ? input.technicians : [];
  const rawOperations = Array.isArray(input.operations) ? input.operations : [];

  if (!Array.isArray(input.technicians) && !Array.isArray(input.operations)) {
    rejected.push({
      stage: '02_PERSONNEL',
      entity: 'REF_PERSONNEL',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: "Format REF_PERSONNEL invalide : au moins 'technicians' ou 'operations' est requis.",
      blocking: true,
    });
    return abortReport();
  }

  const zoneLookup = buildZoneIndex(existingZones);

  const workingTechniciansMap = new Map<string, ITechnician>();
  if (mode === 'MERGE') {
    for (const t of existingTechnicians) {
      if (!t) continue;
      const code = normKey(t.id_technician || t.id);
      if (!code || FORBIDDEN_GATEWAY_PERSONNEL_CODES.has(code)) continue;
      workingTechniciansMap.set(code, {
        ...t,
        id_technician: code,
        id: code,
      });
    }
  }

  const workingOperationsMap = new Map<string, IOperation>();
  if (mode === 'MERGE') {
    for (const op of existingOperations) {
      if (!op) continue;
      const code = normKey(op.id_operation || op.id);
      if (!code || FORBIDDEN_GATEWAY_PERSONNEL_CODES.has(code)) continue;
      workingOperationsMap.set(code, {
        ...op,
        id_operation: code,
        id: code,
      });
    }
  }

  const seenPersonnelCodes = new Set<string>();
  let techCreated = 0;
  let techUpdated = 0;
  let techUnchanged = 0;
  let techSkipped = 0;

  rawTechnicians.forEach((row: RefPersonnelTechnicianRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      techSkipped++;
      return;
    }

    const rawCode = cleanStr(
      row.code_technician ??
        (row as Record<string, unknown>).id_technician ??
        (row as Record<string, unknown>).id
    );
    const rawNom = cleanStr(row.nom ?? (row as Record<string, unknown>).name);
    const rawPrenom = cleanStr(row.prenom);
    const rawZone = cleanStr(
      row.code_zone ?? (row as Record<string, unknown>).id_zone ?? (row as Record<string, unknown>).zone
    );
    const rawSpec = cleanStr(row.specialite);

    if (!rawCode && !rawNom) {
      techSkipped++;
      return;
    }

    // Reject auth/security fields inside REF_PERSONNEL
    let hasForbiddenAuth = false;
    for (const authKey of FORBIDDEN_PERSONNEL_AUTH_KEYS) {
      if ((row as Record<string, unknown>)[authKey] !== undefined) {
        rejected.push({
          stage: '02_PERSONNEL',
          entity: 'TECHNICIANS',
          row: rowNum,
          identifier: rawCode || rawNom || `ROW-${rowNum}`,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Ligne ${rowNum} (TECHNICIANS [${rawCode}]) : le champ d'authentification '${authKey}' est strictement interdit dans REF_PERSONNEL.`,
          blocking: true,
        });
        hasForbiddenAuth = true;
      }
    }

    if (!rawCode) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'TECHNICIANS',
        row: rowNum,
        identifier: rawNom,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (TECHNICIANS) : 'code_technician' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    if (!rawNom) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'TECHNICIANS',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (TECHNICIANS [${rawCode}]) : 'nom' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (FORBIDDEN_GATEWAY_PERSONNEL_CODES.has(codeKey)) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'TECHNICIANS',
        row: rowNum,
        identifier: rawCode,
        code: 'SCHEMA_MISMATCH',
        message: `Ligne ${rowNum} (TECHNICIANS [${rawCode}]) : '${rawCode}' est un identifiant système réservé et ne peut pas être utilisé comme code_technician.`,
        blocking: true,
      });
      return;
    }

    if (seenPersonnelCodes.has(codeKey)) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'TECHNICIANS',
        row: rowNum,
        identifier: codeKey,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (TECHNICIANS) : doublon sur code_technician '${codeKey}'.`,
        blocking: true,
      });
      return;
    }
    seenPersonnelCodes.add(codeKey);
    if (hasForbiddenAuth) {
      return;
    }

    let resolvedZoneCode = '';
    if (rawZone && normKey(rawZone) !== 'ALL') {
      if (FORBIDDEN_PSEUDO_ZONES.has(normKey(rawZone))) {
        rejected.push({
          stage: '02_PERSONNEL',
          entity: 'TECHNICIANS',
          row: rowNum,
          identifier: codeKey,
          code: 'SCHEMA_MISMATCH',
          message: `Ligne ${rowNum} (TECHNICIANS [${codeKey}]) : '${rawZone}' n'est pas une zone valide.`,
          blocking: true,
        });
        return;
      }

      const { zone: foundZone, viaLegacyFallback, canonicalCode } = resolveZoneWithCompatibility(
        rawZone,
        zoneLookup
      );
      if (!foundZone) {
        rejected.push({
          stage: '02_PERSONNEL',
          entity: 'TECHNICIANS',
          row: rowNum,
          identifier: codeKey,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (TECHNICIANS [${codeKey}]) : la zone '${rawZone}' est introuvable dans ZONES.`,
          blocking: true,
        });
        return;
      }
      resolvedZoneCode = canonicalCode;
      if (viaLegacyFallback) {
        warnings.push({
          stage: '02_PERSONNEL',
          entity: 'TECHNICIANS',
          row: rowNum,
          identifier: codeKey,
          code: 'LEGACY_ZONE_NORMALIZED',
          message: `Ligne ${rowNum} (TECHNICIANS [${codeKey}]) : zone '${rawZone}' normalisée par compatibilité vers '${canonicalCode}'.`,
          blocking: false,
        });
      }
    } else if (normKey(rawZone) === 'ALL') {
      resolvedZoneCode = 'ALL';
    }

    const prev = workingTechniciansMap.get(codeKey);
    const isActive =
      row.is_active !== undefined
        ? Boolean(row.is_active)
        : normKey(row.statut) === 'INACTIF' || normKey(row.statut) === 'ARCHIVEE'
        ? false
        : prev?.is_active ?? true;

    const nextTech: ITechnician = {
      ...(prev || {}),
      id_technician: codeKey,
      id: codeKey,
      nom: rawNom,
      ...(rawPrenom ? { prenom: rawPrenom } : {}),
      id_zone: resolvedZoneCode || prev?.id_zone || '',
      zones: resolvedZoneCode ? [resolvedZoneCode] : prev?.zones || [],
      role: 'Technicien',
      type_profil: 'TECHNICIEN',
      specialite: rawSpec || prev?.specialite || '',
      is_active: isActive,
      actif: isActive,
      active: isActive,
      statut: isActive ? 'Actif' : 'Inactif',
    };

    if (prev) {
      if (
        prev.nom === nextTech.nom &&
        (prev.id_zone || '') === (nextTech.id_zone || '') &&
        (prev.specialite || '') === (nextTech.specialite || '') &&
        (prev.is_active ?? true) === nextTech.is_active
      ) {
        techUnchanged++;
      } else {
        techUpdated++;
      }
    } else {
      techCreated++;
    }

    workingTechniciansMap.set(codeKey, nextTech);
  });

  accepted.push({
    stage: '02_PERSONNEL',
    entity: 'TECHNICIANS',
    created: techCreated,
    updated: techUpdated,
    unchanged: techUnchanged,
    skipped: techSkipped,
  });

  let opCreated = 0;
  let opUpdated = 0;
  let opUnchanged = 0;
  let opSkipped = 0;

  rawOperations.forEach((row: RefPersonnelOperationRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      opSkipped++;
      return;
    }

    const rawCode = cleanStr(
      row.code_operation ??
        (row as Record<string, unknown>).id_operation ??
        (row as Record<string, unknown>).id
    );
    const rawNom = cleanStr(row.nom ?? (row as Record<string, unknown>).name);
    const rawPrenom = cleanStr(row.prenom);
    const rawZone = cleanStr(
      row.code_zone ?? (row as Record<string, unknown>).id_zone ?? (row as Record<string, unknown>).zone
    );
    const rawSpec = cleanStr(row.specialite);

    if (!rawCode && !rawNom) {
      opSkipped++;
      return;
    }

    for (const authKey of FORBIDDEN_PERSONNEL_AUTH_KEYS) {
      if ((row as Record<string, unknown>)[authKey] !== undefined) {
        rejected.push({
          stage: '02_PERSONNEL',
          entity: 'OPERATIONS',
          row: rowNum,
          identifier: rawCode || rawNom || `ROW-${rowNum}`,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Ligne ${rowNum} (OPERATIONS [${rawCode}]) : le champ d'authentification '${authKey}' est strictement interdit dans REF_PERSONNEL.`,
          blocking: true,
        });
        return;
      }
    }

    if (!rawCode) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'OPERATIONS',
        row: rowNum,
        identifier: rawNom,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (OPERATIONS) : 'code_operation' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    if (!rawNom) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'OPERATIONS',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (OPERATIONS [${rawCode}]) : 'nom' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (FORBIDDEN_GATEWAY_PERSONNEL_CODES.has(codeKey)) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'OPERATIONS',
        row: rowNum,
        identifier: rawCode,
        code: 'SCHEMA_MISMATCH',
        message: `Ligne ${rowNum} (OPERATIONS [${rawCode}]) : '${rawCode}' est un identifiant système réservé.`,
        blocking: true,
      });
      return;
    }

    if (seenPersonnelCodes.has(codeKey)) {
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'OPERATIONS',
        row: rowNum,
        identifier: codeKey,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (OPERATIONS) : doublon sur '${codeKey}'.`,
        blocking: true,
      });
      return;
    }
    seenPersonnelCodes.add(codeKey);

    let resolvedZoneCode = 'ALL';
    if (rawZone && normKey(rawZone) !== 'ALL') {
      const { zone: foundZone, viaLegacyFallback, canonicalCode } = resolveZoneWithCompatibility(
        rawZone,
        zoneLookup
      );
      if (!foundZone) {
        rejected.push({
          stage: '02_PERSONNEL',
          entity: 'OPERATIONS',
          row: rowNum,
          identifier: codeKey,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (OPERATIONS [${codeKey}]) : la zone '${rawZone}' est introuvable dans ZONES.`,
          blocking: true,
        });
        return;
      }
      resolvedZoneCode = canonicalCode;
      if (viaLegacyFallback) {
        warnings.push({
          stage: '02_PERSONNEL',
          entity: 'OPERATIONS',
          row: rowNum,
          identifier: codeKey,
          code: 'LEGACY_ZONE_NORMALIZED',
          message: `Ligne ${rowNum} (OPERATIONS [${codeKey}]) : zone '${rawZone}' normalisée par compatibilité vers '${canonicalCode}'.`,
          blocking: false,
        });
      }
    }

    const rawProfil = normKey(row.type_profil || 'RESPONSABLE');
    const resolvedProfil =
      rawProfil === 'OPERATEUR' || rawProfil === 'CHEF' ? rawProfil : 'RESPONSABLE';
    const prev = workingOperationsMap.get(codeKey);
    const isActive =
      row.is_active !== undefined
        ? Boolean(row.is_active)
        : normKey(row.statut) === 'INACTIF' || normKey(row.statut) === 'ARCHIVEE'
        ? false
        : prev?.is_active ?? true;

    const nextOp: IOperation = {
      ...(prev || {}),
      id_operation: codeKey,
      id: codeKey,
      nom: rawNom,
      ...(rawPrenom ? { prenom: rawPrenom } : {}),
      id_zone: resolvedZoneCode,
      zones: [resolvedZoneCode],
      type_profil: resolvedProfil,
      role:
        resolvedProfil === 'OPERATEUR'
          ? 'Opérateur'
          : resolvedProfil === 'CHEF'
          ? 'Chef'
          : 'Responsable',
      specialite: rawSpec || prev?.specialite || '',
      is_active: isActive,
      actif: isActive,
    };

    if (prev) {
      if (
        prev.nom === nextOp.nom &&
        (prev.id_zone || 'ALL') === nextOp.id_zone &&
        (prev.specialite || '') === (nextOp.specialite || '') &&
        (prev.is_active ?? true) === nextOp.is_active
      ) {
        opUnchanged++;
      } else {
        opUpdated++;
      }
    } else {
      opCreated++;
    }

    workingOperationsMap.set(codeKey, nextOp);
  });

  if (rawOperations.length > 0 || mode === 'REPLACE_CATALOG') {
    accepted.push({
      stage: '02_PERSONNEL',
      entity: 'OPERATIONS',
      created: opCreated,
      updated: opUpdated,
      unchanged: opUnchanged,
      skipped: opSkipped,
    });
  }

  // REPLACE_CATALOG active-reference guard across machines, PM tasks, corrective BTs, and movements
  if (mode === 'REPLACE_CATALOG') {
    const removedAliasToCanonical = new Map<string, string>();

    for (const t of existingTechnicians) {
      if (!t) continue;
      const code = normKey(t.id_technician || t.id);
      if (!code || workingTechniciansMap.has(code)) continue;
      removedAliasToCanonical.set(code, code);
      if (t.nom) removedAliasToCanonical.set(normKey(t.nom), code);
    }

    for (const op of existingOperations) {
      if (!op) continue;
      const code = normKey(op.id_operation || op.id);
      if (!code || workingOperationsMap.has(code)) continue;
      removedAliasToCanonical.set(code, code);
      if (op.nom) removedAliasToCanonical.set(normKey(op.nom), code);
    }

    const activeRefs = new Map<
      string,
      {
        machines: number;
        preventiveTasks: number;
        correctiveInterventions: number;
        mouvements: number;
      }
    >();

    const recordPersonnelRef = (
      rawRef: unknown,
      bucket: 'machines' | 'preventiveTasks' | 'correctiveInterventions' | 'mouvements'
    ) => {
      const refKey = normKey(rawRef);
      if (!refKey) return;
      const canonical = removedAliasToCanonical.get(refKey);
      if (!canonical) return;
      const entry = activeRefs.get(canonical) || {
        machines: 0,
        preventiveTasks: 0,
        correctiveInterventions: 0,
        mouvements: 0,
      };
      entry[bucket] += 1;
      activeRefs.set(canonical, entry);
    };

    for (const m of existingMachines) {
      if (m?.technician) recordPersonnelRef(m.technician, 'machines');
    }
    for (const task of existingPreventiveTasks) {
      const tRec = task as unknown as Record<string, unknown>;
      const ref = cleanStr(tRec.id_technician || tRec.technicien || tRec.assigned_to);
      if (ref) recordPersonnelRef(ref, 'preventiveTasks');
    }
    for (const bt of existingCorrective) {
      const btRec = bt as unknown as Record<string, unknown>;
      const ref = cleanStr(btRec.id_technician || btRec.technicien || btRec.nom_technicien);
      if (ref) recordPersonnelRef(ref, 'correctiveInterventions');
    }
    for (const mv of existingMouvements) {
      const techRef = cleanStr(mv.id_technician || mv.technicien);
      if (techRef) recordPersonnelRef(techRef, 'mouvements');
      const opRef = cleanStr(mv.id_operation || mv.operation);
      if (opRef) recordPersonnelRef(opRef, 'mouvements');
    }

    for (const [pKey, breakdown] of activeRefs.entries()) {
      const total =
        breakdown.machines +
        breakdown.preventiveTasks +
        breakdown.correctiveInterventions +
        breakdown.mouvements;
      rejected.push({
        stage: '02_PERSONNEL',
        entity: 'REF_PERSONNEL',
        row: 0,
        identifier: pKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer l'intervenant '${pKey}' en mode REPLACE_CATALOG : ${total} lien(s) actif(s) (Machines: ${breakdown.machines}, PM: ${breakdown.preventiveTasks}, BT: ${breakdown.correctiveInterventions}, Mouvements: ${breakdown.mouvements}). Désactivez (is_active: false) ou utilisez MERGE.`,
        blocking: true,
        referencedCount: total,
        referenceBreakdown: breakdown,
      });
    }
  }

  const nextTechnicians = Array.from(workingTechniciansMap.values());
  const nextOperations = Array.from(workingOperationsMap.values());

  // Build synchronized IUserRecord[] for STORAGE_KEYS.PERSONNEL (zero auth secrets)
  const nextUsers: IUserRecord[] = [
    ...nextTechnicians.map((t) => ({
      id: t.id_technician,
      id_technician: t.id_technician,
      nom: t.nom,
      ...(typeof t.prenom === 'string' && t.prenom ? { prenom: t.prenom } : {}),
      role: 'Technicien',
      type_profil: 'TECHNICIEN' as const,
      id_zone: t.id_zone || '',
      zones: t.id_zone ? [t.id_zone] : [],
      specialite: t.specialite || '',
      is_active: t.is_active !== false,
      actif: t.is_active !== false,
      statut: t.is_active !== false ? 'Actif' : 'Inactif',
    })),
    ...nextOperations.map((op) => ({
      id: op.id_operation,
      id_operation: op.id_operation,
      nom: op.nom,
      ...(typeof op.prenom === 'string' && op.prenom ? { prenom: op.prenom } : {}),
      role: typeof op.role === 'string' && op.role ? op.role : 'Responsable',
      type_profil: 'RESPONSABLE' as const,
      id_zone: op.id_zone || 'ALL',
      zones: [op.id_zone || 'ALL'],
      specialite: typeof op.specialite === 'string' ? op.specialite : '',
      is_active: op.is_active !== false,
      actif: op.is_active !== false,
    })),
  ];

  const success = rejected.length === 0;
  let committed = false;

  if (success && !dryRun) {
    DataGateway.savePersonnel(nextUsers, nextTechnicians, nextOperations);
    store.setUsers(nextUsers);
    store.setTechnicians(nextTechnicians);
    store.setOperations(nextOperations);

    DataGateway.appendAuditEvent({
      actionType: 'SETTINGS_CONFIG_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'REF_PERSONNEL',
      actorId: options.actorId || 'ADMIN',
      actorName: options.actorName || 'Import Pipeline',
      actorRole,
      before: {
        techniciansCount: existingTechnicians.length,
        operationsCount: existingOperations.length,
      },
      after: {
        techniciansCount: nextTechnicians.length,
        operationsCount: nextOperations.length,
      },
      meta: { mode, origin },
    });

    committed = true;
  }

  return {
    bundleType: 'REF_PERSONNEL',
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
      nextTechnicians,
      nextOperations,
      nextUsers,
    },
  };
}

function mapPdrValidatorErrorToIssue(err: PdrCatalogImportError): ImportIssue {
  const stage: PipelineStageId =
    err.sheet === 'PDR_GROUPS'
      ? '04_PDR_GROUPS'
      : err.sheet === 'PDR_TYPES'
      ? '04_PDR_TYPES'
      : '04_PDR_ITEMS';
  const entity = err.sheet === 'GLOBAL' ? 'REF_PDR' : err.sheet;
  const msg = String(err.message || '');

  let code: ImportIssueCode = 'SCHEMA_MISMATCH';
  if (/Accès refusé/i.test(msg)) {
    code = 'RBAC_DENIED';
  } else if (/Protection FK Mouvements|mouvements historiques/i.test(msg)) {
    code = 'REFERENCED_BY_ACTIVE_RECORDS';
  } else if (/dupliqué|dupliquée/i.test(msg)) {
    code = 'DUPLICATE_KEY';
  } else if (/introuvable|rattaché à aucun groupe|incohérence hiérarchique/i.test(msg)) {
    code = 'BROKEN_FK';
  } else if (/obligatoire|manquant|Aucune donnée trouvée/i.test(msg)) {
    code = 'MISSING_REQUIRED';
  }

  return {
    stage,
    entity,
    row: err.row,
    identifier: err.identifier,
    code,
    message: msg,
    blocking: true,
  };
}

/**
 * Validates and optionally commits a `REF_PDR` bundle (`04_PDR_GROUPS -> 04_PDR_TYPES -> 04_PDR_ITEMS`)
 * by wrapping `validateAndReconcilePdrCatalogImport` and `applyPdrCatalogImportToStore` from `pdrExcelValidator.ts`.
 *
 * Guarantees:
 * - Zero stock movements (`Sortie`/`Entrée`) are created or modified.
 * - `IncrementalStockIndex` and `StockCalculationService` math remain completely untouched.
 * - Omitted `stockInitial` on new items defaults strictly to `0` (never falls back to `seedStockItems.json`).
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
  const existingGroups = options.existingPdrGroups ?? store.pdrGroups ?? [];
  const existingTypes: StockType[] = options.existingStockTypes ?? (store.types as StockType[]) ?? [];
  const existingStock = options.existingStock ?? store.rawStock ?? [];
  const existingMouvements = options.existingMouvements ?? store.mouvements ?? [];

  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const accepted: AcceptedStageRecord[] = [];

  if (!input || typeof input !== 'object') {
    rejected.push({
      stage: '04_PDR_GROUPS',
      entity: 'REF_PDR',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: 'Le paquet REF_PDR fourni est invalide ou vide.',
      blocking: true,
    });
  } else {
    for (const forbiddenKey of FORBIDDEN_REF_PDR_ROOT_KEYS) {
      if (
        (input as Record<string, unknown>)[forbiddenKey] !== undefined ||
        Object.keys(input).some((k) => /^password/i.test(k))
      ) {
        const offendingKey =
          (input as Record<string, unknown>)[forbiddenKey] !== undefined
            ? forbiddenKey
            : Object.keys(input).find((k) => /^password/i.test(k)) || forbiddenKey;
        rejected.push({
          stage: '04_PDR_GROUPS',
          entity: 'REF_PDR',
          row: 0,
          identifier: offendingKey,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Le champ '${offendingKey}' est interdit dans le paquet REF_PDR (catalogue pur uniquement, aucun mouvement ni secret).`,
          blocking: true,
        });
        break;
      }
    }
  }

  const rawGroups = Array.isArray(input?.groups) ? input.groups : [];
  const rawTypes = Array.isArray(input?.types) ? input.types : [];
  const rawItems = Array.isArray(input?.items) ? input.items : [];

  const checkRowForbiddenKeys = (
    rows: ReadonlyArray<Record<string, unknown>>,
    stage: PipelineStageId,
    entity: string,
    idField: string
  ) => {
    rows.forEach((row, idx) => {
      if (!row || typeof row !== 'object') return;
      const rowNum = idx + 1;
      for (const k of Object.keys(row)) {
        if (
          (FORBIDDEN_REF_PDR_ROW_KEYS as readonly string[]).includes(k) ||
          /^password/i.test(k) ||
          /^mouvement/i.test(k)
        ) {
          rejected.push({
            stage,
            entity,
            row: rowNum,
            identifier: cleanStr(row[idField]) || `ROW-${rowNum}`,
            code: 'FORBIDDEN_BUNDLE_FIELD',
            message: `Ligne ${rowNum} (${entity}) : le champ '${k}' est strictement interdit dans REF_PDR.`,
            blocking: true,
          });
        }
      }
    });
  };

  checkRowForbiddenKeys(
    rawGroups as unknown as ReadonlyArray<Record<string, unknown>>,
    '04_PDR_GROUPS',
    'PDR_GROUPS',
    'code_group'
  );
  checkRowForbiddenKeys(
    rawTypes as unknown as ReadonlyArray<Record<string, unknown>>,
    '04_PDR_TYPES',
    'PDR_TYPES',
    'code_type'
  );
  checkRowForbiddenKeys(
    rawItems as unknown as ReadonlyArray<Record<string, unknown>>,
    '04_PDR_ITEMS',
    'PDR_ITEMS',
    'ref'
  );

  // Convert REF_PDR JSON bundle rows into PdrCatalogRawSheets expected by pdrExcelValidator
  const validatorSheets = {
    groups: rawGroups.map((g) => ({
      ...g,
      code: cleanStr(g.code_group ?? g.code),
      libelle: cleanStr(g.libelle),
      description: cleanStr(g.description),
      domaine_technique: g.domaine_technique,
      default_policy_tags: g.default_policy_tags ?? ['REPLACING'],
      sort_order: g.sort_order ?? 10,
      is_active: g.is_active !== false,
    })),
    types: rawTypes.map((t) => ({
      ...t,
      code_type: cleanStr(t.code_type),
      group_code: cleanStr(t.code_group ?? t.group_code),
      libelle: cleanStr(t.libelle),
      domaine_technique: t.domaine_technique,
      is_active: t.is_active !== false,
    })),
    items: rawItems.map((it) => ({
      ...it,
      ref: cleanStr(it.ref ?? it.code_article),
      designation: cleanStr(it.designation),
      type_code_or_id: cleanStr(it.code_type ?? (it as Record<string, unknown>).type_code_or_id),
      group_code: cleanStr(it.code_group ?? (it as Record<string, unknown>).group_code),
      seuil: Number(it.seuil ?? 0) || 0,
      emplacement: cleanStr(it.emplacement) || 'Magasin PDR',
      stockInitial:
        it.stockInitial !== undefined && it.stockInitial !== null
          ? Math.max(0, Number(it.stockInitial) || 0)
          : undefined,
      prix_unitaire: Number(it.prix_unitaire ?? 0) || 0,
      unite_mesure: cleanStr(it.unite_mesure) || 'PCS',
      criticite: cleanStr(it.criticite) || 'B',
      ref_constructeur: cleanStr(it.ref_constructeur),
      code_equivalents: cleanStr(it.code_equivalents),
      delai_appro_jours: Number(it.delai_appro_jours ?? 0) || 0,
      domaine_technique: it.domaine_technique,
      policy_tags: it.policy_tags ?? ['REPLACING'],
    })),
  };

  const pdrReport = validateAndReconcilePdrCatalogImport(validatorSheets, {
    mode,
    actorRole,
    hasStockEditPermission: true,
    existingGroups,
    existingTypes,
    existingStock,
    existingMouvements: existingMouvements as unknown as ReadonlyArray<Record<string, unknown>>,
  });

  for (const err of pdrReport.errors) {
    rejected.push(mapPdrValidatorErrorToIssue(err));
  }

  accepted.push(
    {
      stage: '04_PDR_GROUPS',
      entity: 'PDR_GROUPS',
      created: pdrReport.created.groups,
      updated: pdrReport.updated.groups,
      unchanged: 0,
      skipped: pdrReport.skipped.groups,
    },
    {
      stage: '04_PDR_TYPES',
      entity: 'PDR_TYPES',
      created: pdrReport.created.types,
      updated: pdrReport.updated.types,
      unchanged: 0,
      skipped: pdrReport.skipped.types,
    },
    {
      stage: '04_PDR_ITEMS',
      entity: 'PDR_ITEMS',
      created: pdrReport.created.items,
      updated: pdrReport.updated.items,
      unchanged: 0,
      skipped: pdrReport.skipped.items,
    }
  );

  const success = rejected.length === 0 && pdrReport.success;
  let committed = false;

  if (success && !dryRun) {
    committed = applyPdrCatalogImportToStore(pdrReport);

    if (committed) {
      DataGateway.appendAuditEvent({
        actionType: 'SETTINGS_CONFIG_UPDATED',
        entityType: 'SYSTEM',
        entityId: 'REF_PDR',
        actorId: options.actorId || 'ADMIN',
        actorName: options.actorName || 'Import Pipeline',
        actorRole,
        before: {
          groupsCount: existingGroups.length,
          typesCount: existingTypes.length,
          itemsCount: existingStock.length,
        },
        after: {
          groupsCount: pdrReport.nextGroups.length,
          typesCount: pdrReport.nextTypes.length,
          itemsCount: pdrReport.nextStock.length,
        },
        meta: { mode, origin },
      });
    }
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
    warnings,
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
 * Unified entry point dispatching `REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, or `REF_PDR` bundles.
 */
export function runUnifiedImportPipeline(
  bundle:
    | (RefParcBundleInput & { bundleType: 'REF_PARC' })
    | (RefPersonnelBundleInput & { bundleType: 'REF_PERSONNEL' })
    | (AssetsMachinesBundleInput & { bundleType: 'ASSETS_MACHINES' })
    | (RefPdrBundleInput & { bundleType: 'REF_PDR' }),
  options: UnifiedImportOptions = {}
): ImportReport<any> {
  if (bundle.bundleType === 'REF_PARC') {
    return validateAndCommitRefParcBundle(bundle, options);
  }
  if (bundle.bundleType === 'REF_PERSONNEL') {
    return validateAndCommitRefPersonnelBundle(bundle, options);
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
 * Reverse export for `REF_PERSONNEL` using stable `code_*` identifiers (Type A Round-Trip).
 * Never exports authentication credentials or gateway accounts.
 */
export function exportRefPersonnelBundle(snapshot?: {
  technicians?: ITechnician[];
  operations?: IOperation[];
}): Required<Pick<RefPersonnelBundleInput, 'bundleType' | 'technicians' | 'operations'>> {
  const store = useGmaoStore.getState();
  const technicians = snapshot?.technicians ?? store.technicians ?? [];
  const operations = snapshot?.operations ?? store.operations ?? [];

  return {
    bundleType: 'REF_PERSONNEL',
    technicians: technicians
      .filter((t) => t && !FORBIDDEN_GATEWAY_PERSONNEL_CODES.has(normKey(t.id_technician || t.id)))
      .map((t) => ({
        code_technician: normKey(t.id_technician || t.id),
        nom: cleanStr(t.nom || t.name),
        ...(t.prenom ? { prenom: cleanStr(t.prenom) } : {}),
        code_zone: cleanStr(t.id_zone || t.zone) ? normKey(t.id_zone || t.zone) : null,
        specialite: cleanStr(t.specialite),
        is_active: t.is_active !== false && t.actif !== false && t.active !== false,
      })),
    operations: operations
      .filter((op) => op && !FORBIDDEN_GATEWAY_PERSONNEL_CODES.has(normKey(op.id_operation || op.id)))
      .map((op) => ({
        code_operation: normKey(op.id_operation || op.id),
        nom: cleanStr(op.nom),
        code_zone: cleanStr(op.id_zone) ? normKey(op.id_zone) : 'ALL',
        type_profil: cleanStr(op.type_profil || 'RESPONSABLE').toUpperCase(),
        specialite: cleanStr(op.specialite),
        is_active: op.is_active !== false && op.actif !== false,
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
        code_zone: normKey(m.id_zone_default || m.id_zone || m.zone),
        asset_class: assetClass,
        code_family: assetClass === 'PRODUCTION' ? cleanStr(m.id_family) : null,
        code_template: assetClass === 'PRODUCTION' ? cleanStr(m.id_templates) : null,
        code_system_type:
          assetClass === 'SYSTEM_GENERAL' ? cleanStr(m.id_general_system_type) : null,
        code_technician: cleanStr(m.technician) || null,
        parent_code_machine: cleanStr(m.parent_id) || null,
        asset_level:
          cleanStr(m.asset_level || 'MACHINE').toUpperCase() === 'LINE' ? 'LINE' : 'MACHINE',
        status: cleanStr(m.status || m.statut || 'En service'),
        is_active: m.is_active !== false && normKey(m.status || m.statut) !== 'ARCHIVEE',
        serial_number: cleanStr(m.serial_number || m.numero_serie),
        commissioning_date: cleanStr(m.date_mise_en_service || m.date_installation),
      };
    }),
  };
}

/**
 * Reverse export for `REF_PDR` using stable `code_group`, `code_type`, and `ref` identifiers (Type A Round-Trip).
 * Never exports stock movements (`mouvements`).
 */
export function exportRefPdrBundle(snapshot?: {
  groups?: PdrGroup[];
  types?: StockType[];
  items?: IStockItem[];
}): Required<Pick<RefPdrBundleInput, 'bundleType' | 'groups' | 'types' | 'items'>> {
  const store = useGmaoStore.getState();
  const groups = snapshot?.groups ?? store.pdrGroups ?? [];
  const types = snapshot?.types ?? store.types ?? [];
  const items = snapshot?.items ?? store.rawStock ?? [];

  const groupIdToCode = new Map<string, string>();
  for (const g of groups) {
    if (!g) continue;
    const code = normKey(g.code || String(g.id || '').replace(/^GRP-/i, ''));
    if (g.id) groupIdToCode.set(normKey(g.id), code);
    if (g.id_group) groupIdToCode.set(normKey(g.id_group), code);
    if (code) groupIdToCode.set(code, code);
  }

  const resolveCodeGroup = (rawIdGroup: unknown): string => {
    const key = normKey(rawIdGroup);
    if (!key) return '';
    return groupIdToCode.get(key) || key.replace(/^GRP-/i, '');
  };

  return {
    bundleType: 'REF_PDR',
    groups: groups.map((g, idx) => ({
      code_group: normKey(g.code || String(g.id || '').replace(/^GRP-/i, '')),
      libelle: cleanStr(g.libelle),
      description: cleanStr(g.description),
      ...(g.domaine_technique ? { domaine_technique: cleanStr(g.domaine_technique) } : {}),
      default_policy_tags: Array.isArray(g.default_policy_tags)
        ? g.default_policy_tags
        : ['REPLACING'],
      sort_order: Number(g.sort_order) || (idx + 1) * 10,
      is_active: g.is_active !== false,
    })),
    types: types.map((t) => ({
      code_type: cleanStr(t.id_type),
      code_group: resolveCodeGroup(t.id_group),
      libelle: cleanStr(t.libelle || t.id_type),
      ...(t.domaine_technique ? { domaine_technique: cleanStr(t.domaine_technique) } : {}),
      is_active: t.is_active !== false,
    })),
    items: items.map((it) => ({
      ref: cleanStr(it.ref),
      designation: cleanStr(it.designation),
      code_type: cleanStr(it.id_type || it.type),
      code_group: resolveCodeGroup(it.id_group),
      seuil: Number(it.seuil ?? 0) || 0,
      emplacement: cleanStr(it.emplacement) || 'Magasin PDR',
      stockInitial: Number(it.stockInitial ?? 0) || 0,
      prix_unitaire: Number(it.prix_unitaire ?? 0) || 0,
      unite_mesure: cleanStr(it.unite_mesure || it.unite) || 'PCS',
      criticite: cleanStr(it.criticite) || 'B',
      ...(it.ref_constructeur ? { ref_constructeur: cleanStr(it.ref_constructeur) } : {}),
      ...(it.code_equivalents ? { code_equivalents: cleanStr(it.code_equivalents) } : {}),
      ...(it.delai_appro_jours ? { delai_appro_jours: Number(it.delai_appro_jours) } : {}),
      ...(it.domaine_technique ? { domaine_technique: cleanStr(it.domaine_technique) } : {}),
      policy_tags: Array.isArray(it.policy_tags) ? it.policy_tags : ['REPLACING'],
    })),
  };
}

/**
 * Returns a fresh clone of the official `REF_PARC` template (`templates/import/REF_PARC.template.json`).
 */
export function getRefParcOfficialTemplate(): RefParcBundleInput & { bundleType: 'REF_PARC' } {
  return JSON.parse(JSON.stringify(refParcOfficialTemplate));
}

/**
 * Returns a fresh clone of the official `REF_PERSONNEL` template (`templates/import/REF_PERSONNEL.template.json`).
 */
export function getRefPersonnelOfficialTemplate(): RefPersonnelBundleInput & {
  bundleType: 'REF_PERSONNEL';
} {
  return JSON.parse(JSON.stringify(refPersonnelOfficialTemplate));
}

/**
 * Returns a fresh clone of the official `ASSETS_MACHINES` template (`templates/import/ASSETS_MACHINES.template.json`).
 */
export function getAssetsMachinesOfficialTemplate(): AssetsMachinesBundleInput & {
  bundleType: 'ASSETS_MACHINES';
} {
  return JSON.parse(JSON.stringify(assetsMachinesOfficialTemplate));
}

/**
 * Returns a fresh clone of the official `REF_PDR` template (`templates/import/REF_PDR.template.json`).
 */
export function getRefPdrOfficialTemplate(): RefPdrBundleInput & {
  bundleType: 'REF_PDR';
} {
  return JSON.parse(JSON.stringify(refPdrOfficialTemplate));
}


