import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import type { AssetClass, IMachine } from '../../../types/domain';
import { sanitizeMachinesHierarchy } from '../../../utils/assetHierarchy';
import assetsMachinesOfficialTemplate from '../../../../templates/import/ASSETS_MACHINES.template.json';
import {
  buildFamilyIndex,
  buildSystemTypeIndex,
  buildTechnicianIndex,
  buildTemplateIndex,
  buildZoneIndex,
  cleanStr,
  FORBIDDEN_ASSETS_MACHINES_ROOT_KEYS,
  FORBIDDEN_MACHINE_ROW_EMBEDDED_KEYS,
  FORBIDDEN_PSEUDO_ZONES,
  normKey,
  notifyPipelineCommitSync,
  resolveZoneWithCompatibility,
} from '../pipelineShared';
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
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';

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
      id_blueprint:
        cleanStr((row as Record<string, unknown>).id_blueprint) || prev?.id_blueprint || '',
      serial_number: cleanStr(row.serial_number) || prev?.serial_number || '',
      date_mise_en_service:
        cleanStr(row.commissioning_date ?? (row as Record<string, unknown>).date_mise_en_service) ||
        prev?.date_mise_en_service ||
        '',
      ...((row as Record<string, unknown>).compteur_actuel !== undefined ||
      prev?.compteur_actuel !== undefined
        ? {
            compteur_actuel: Number(
              (row as Record<string, unknown>).compteur_actuel ?? prev?.compteur_actuel ?? 0
            ),
          }
        : {}),
      ...((row as Record<string, unknown>).compteur_heures !== undefined ||
      prev?.compteur_heures !== undefined
        ? {
            compteur_heures: Number(
              (row as Record<string, unknown>).compteur_heures ?? prev?.compteur_heures ?? 0
            ),
          }
        : {}),
      ...((row as Record<string, unknown>).dernier_releve_compteur !== undefined ||
      prev?.dernier_releve_compteur !== undefined
        ? {
            dernier_releve_compteur: Number(
              (row as Record<string, unknown>).dernier_releve_compteur ??
                prev?.dernier_releve_compteur ??
                0
            ),
          }
        : {}),
      ...((row as Record<string, unknown>).unite_compteur !== undefined ||
      prev?.unite_compteur !== undefined
        ? {
            unite_compteur: cleanStr(
              (row as Record<string, unknown>).unite_compteur ?? prev?.unite_compteur ?? 'h'
            ),
          }
        : {}),
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
    notifyPipelineCommitSync('ASSETS_MACHINES', mode, origin);
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
 * Returns a fresh clone of the official `ASSETS_MACHINES` template (`templates/import/ASSETS_MACHINES.template.json`).
 */
export function getAssetsMachinesOfficialTemplate(): AssetsMachinesBundleInput & {
  bundleType: 'ASSETS_MACHINES';
} {
  return JSON.parse(JSON.stringify(assetsMachinesOfficialTemplate));
}
