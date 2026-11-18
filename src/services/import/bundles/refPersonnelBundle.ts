import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import type { IOperation, ITechnician, IUserRecord } from '../../../types/domain';
import refPersonnelOfficialTemplate from '../../../../templates/import/REF_PERSONNEL.template.json';
import {
  buildZoneIndex,
  cleanStr,
  FORBIDDEN_GATEWAY_PERSONNEL_CODES,
  FORBIDDEN_PERSONNEL_AUTH_KEYS,
  FORBIDDEN_PSEUDO_ZONES,
  FORBIDDEN_REF_PERSONNEL_ROOT_KEYS,
  normKey,
  notifyPipelineCommitSync,
  resolveZoneWithCompatibility,
} from '../pipelineShared';
import type {
  AcceptedStageRecord,
  ImportCommitPolicy,
  ImportIssue,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  RefPersonnelBundleInput,
  RefPersonnelOperationRow,
  RefPersonnelStagingResult,
  RefPersonnelTechnicianRow,
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';

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

    const rowRec = row as Record<string, unknown>;
    const prevRec = prev as Record<string, unknown> | undefined;
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
      ...(Array.isArray(rowRec.templates)
        ? { templates: rowRec.templates as string[] }
        : Array.isArray(prevRec?.templates)
        ? { templates: prevRec.templates as string[] }
        : {}),
      ...(Array.isArray(rowRec.template_ids)
        ? { template_ids: rowRec.template_ids as string[] }
        : Array.isArray(prevRec?.template_ids)
        ? { template_ids: prevRec.template_ids as string[] }
        : {}),
      ...(typeof rowRec.template_id === 'string'
        ? { template_id: rowRec.template_id }
        : typeof prevRec?.template_id === 'string'
        ? { template_id: prevRec.template_id }
        : {}),
      ...(typeof rowRec.template_label === 'string'
        ? { template_label: rowRec.template_label }
        : typeof prevRec?.template_label === 'string'
        ? { template_label: prevRec.template_label }
        : {}),
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
    ...nextOperations.map((op) => {
      const opRec = op as Record<string, unknown>;
      return {
        id: op.id_operation,
        id_operation: op.id_operation,
        nom: op.nom,
        ...(typeof op.prenom === 'string' && op.prenom ? { prenom: op.prenom } : {}),
        role: typeof op.role === 'string' && op.role ? op.role : 'Responsable',
        type_profil: 'RESPONSABLE' as const,
        id_zone: op.id_zone || 'ALL',
        zones: [op.id_zone || 'ALL'],
        specialite:
          typeof op.specialite === 'string' && op.specialite
            ? op.specialite
            : typeof opRec.template_label === 'string'
            ? opRec.template_label
            : '',
        ...(Array.isArray(opRec.templates) ? { templates: opRec.templates as string[] } : {}),
        ...(Array.isArray(opRec.template_ids)
          ? { template_ids: opRec.template_ids as string[] }
          : {}),
        ...(typeof opRec.template_id === 'string' ? { template_id: opRec.template_id } : {}),
        ...(typeof opRec.template_label === 'string'
          ? { template_label: opRec.template_label }
          : {}),
        is_active: op.is_active !== false,
        actif: op.is_active !== false,
      };
    }),
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
    notifyPipelineCommitSync('REF_PERSONNEL', mode, origin);
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
 * Returns a fresh clone of the official `REF_PERSONNEL` template (`templates/import/REF_PERSONNEL.template.json`).
 */
export function getRefPersonnelOfficialTemplate(): RefPersonnelBundleInput & {
  bundleType: 'REF_PERSONNEL';
} {
  return JSON.parse(JSON.stringify(refPersonnelOfficialTemplate));
}
