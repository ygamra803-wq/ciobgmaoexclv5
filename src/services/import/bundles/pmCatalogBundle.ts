import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import {
  IPreventiveActionCatalogItem,
  IPreventiveGuideCatalogItem,
  PreventiveTaskItem,
} from '../../../types/store';
import { PreventiveExecutionRecord } from '../../../types/preventive';
import pmCatalogOfficialTemplate from '../../../../templates/import/PM_CATALOG.template.json';
import {
  AcceptedStageRecord,
  ImportCommitPolicy,
  ImportIssue,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  PipelineStageId,
  PmCatalogActionRow,
  PmCatalogBundleInput,
  PmCatalogGuidePieceRow,
  PmCatalogGuideRow,
  PmCatalogStagingResult,
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';
import {
  cleanStr,
  FORBIDDEN_PM_CATALOG_ROOT_KEYS,
  FORBIDDEN_PM_CATALOG_ROW_KEYS,
  normKey,
  notifyPipelineCommitSync,
} from '../pipelineShared';

/**
 * Validates and optionally commits a `PM_CATALOG` bundle (`05_PM_ACTIONS -> 05_PM_GUIDES`, Level 2 only).
 *
 * Guarantees:
 * - Strictly machine-agnostic Level 2 catalog: rejects any embedded `preventiveTasks`, `preventivePlans`,
 *   `preventiveExecutions`, or machine references (`FORBIDDEN_BUNDLE_FIELD`).
 * - Validates `guides[].actions_liees` and `guides[].fiches_actions` keys against `05_PM_ACTIONS`.
 * - When the live PDR catalog (`rawStock`) is non-empty (or `strictPdrCheck: true`), validates `pieces_rechange[].ref`
 *   against existing stock items (`BROKEN_FK`).
 */
export function validateAndCommitPmCatalogBundle(
  input: PmCatalogBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<PmCatalogStagingResult> {
  const startTime = Date.now();
  const mode: ImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const origin: ImportSourceOrigin = options.origin || 'JSON_BUNDLE';
  const commitPolicy: ImportCommitPolicy = options.commitPolicy || 'ATOMIC';
  const dryRun = Boolean(options.dryRun);
  const actorRole = normKey(options.actorRole || 'ADMIN');

  const store = useGmaoStore.getState();
  const existingActions = options.existingPreventiveActions ?? store.preventiveActions ?? [];
  const existingGuides = options.existingPreventiveGuides ?? store.preventiveGuides ?? [];
  const existingStock = options.existingStock ?? store.rawStock ?? [];
  const existingPreventiveTasks: PreventiveTaskItem[] =
    options.existingPreventiveTasks ?? store.preventiveTasks ?? [];
  const existingPreventiveExecutions: PreventiveExecutionRecord[] =
    options.existingPreventiveExecutions ?? store.preventiveExecutions ?? [];

  const rejected: ImportIssue[] = [];
  const warnings: ImportIssue[] = [];
  const accepted: AcceptedStageRecord[] = [];

  if (mode === 'REPLACE_CATALOG' && actorRole !== 'ADMIN') {
    rejected.push({
      stage: '05_PM_ACTIONS',
      entity: 'PM_CATALOG',
      row: 0,
      code: 'RBAC_DENIED',
      message: 'Le mode REPLACE_CATALOG sur PM_CATALOG est réservé au rôle ADMIN.',
      blocking: true,
    });
  }

  if (!input || typeof input !== 'object') {
    rejected.push({
      stage: '05_PM_ACTIONS',
      entity: 'PM_CATALOG',
      row: 0,
      code: 'SCHEMA_MISMATCH',
      message: 'Le paquet PM_CATALOG fourni est invalide ou vide.',
      blocking: true,
    });
  } else {
    for (const forbiddenKey of FORBIDDEN_PM_CATALOG_ROOT_KEYS) {
      if (
        (input as Record<string, unknown>)[forbiddenKey] !== undefined ||
        Object.keys(input).some((k) => /^password/i.test(k))
      ) {
        const offendingKey =
          (input as Record<string, unknown>)[forbiddenKey] !== undefined
            ? forbiddenKey
            : Object.keys(input).find((k) => /^password/i.test(k)) || forbiddenKey;
        rejected.push({
          stage: '05_PM_ACTIONS',
          entity: 'PM_CATALOG',
          row: 0,
          identifier: offendingKey,
          code: 'FORBIDDEN_BUNDLE_FIELD',
          message: `Le champ '${offendingKey}' est interdit dans PM_CATALOG (catalogue Niveau 2 uniquement — aucune tâche machine ni exécution).`,
          blocking: true,
        });
        break;
      }
    }
  }

  const rawActions = Array.isArray(input?.actions) ? input.actions : [];
  const rawGuides = Array.isArray(input?.guides) ? input.guides : [];

  if (input && typeof input === 'object' && rawActions.length === 0 && rawGuides.length === 0) {
    rejected.push({
      stage: '05_PM_ACTIONS',
      entity: 'PM_CATALOG',
      row: 0,
      code: 'MISSING_REQUIRED',
      message: 'Le paquet PM_CATALOG doit contenir au moins une action ou un guide.',
      blocking: true,
    });
  }

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
          (FORBIDDEN_PM_CATALOG_ROW_KEYS as readonly string[]).includes(k) ||
          /^password/i.test(k)
        ) {
          rejected.push({
            stage,
            entity,
            row: rowNum,
            identifier: cleanStr(row[idField]) || `ROW-${rowNum}`,
            code: 'FORBIDDEN_BUNDLE_FIELD',
            message: `Ligne ${rowNum} (${entity}) : le champ '${k}' est strictement interdit dans PM_CATALOG.`,
            blocking: true,
          });
        }
      }
    });
  };

  checkRowForbiddenKeys(
    rawActions as unknown as ReadonlyArray<Record<string, unknown>>,
    '05_PM_ACTIONS',
    'PM_ACTIONS',
    'code_action'
  );
  checkRowForbiddenKeys(
    rawGuides as unknown as ReadonlyArray<Record<string, unknown>>,
    '05_PM_GUIDES',
    'PM_GUIDES',
    'code_guide'
  );

  // =========================================================================
  // STAGE 1: 05_PM_ACTIONS
  // =========================================================================
  const workingActionsMap = new Map<string, IPreventiveActionCatalogItem>();
  if (mode === 'MERGE' || rawActions.length === 0) {
    for (const a of existingActions) {
      if (!a) continue;
      const code = normKey(a.code || (a as Record<string, unknown>).code_action);
      if (!code) continue;
      workingActionsMap.set(code, {
        ...a,
        code,
      });
    }
  }

  const seenActionCodes = new Set<string>();
  let aCreated = 0;
  let aUpdated = 0;
  let aUnchanged = 0;
  let aSkipped = 0;

  rawActions.forEach((row: PmCatalogActionRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      aSkipped++;
      return;
    }

    const rawCode = cleanStr(row.code_action ?? row.code);
    const rawLibelle = cleanStr(row.libelle);

    if (!rawCode && !rawLibelle) {
      aSkipped++;
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '05_PM_ACTIONS',
        entity: 'PM_ACTIONS',
        row: rowNum,
        identifier: rawLibelle,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PM_ACTIONS) : 'code_action' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawLibelle) {
      rejected.push({
        stage: '05_PM_ACTIONS',
        entity: 'PM_ACTIONS',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PM_ACTIONS [${rawCode}]) : 'libelle' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (seenActionCodes.has(codeKey)) {
      rejected.push({
        stage: '05_PM_ACTIONS',
        entity: 'PM_ACTIONS',
        row: rowNum,
        identifier: rawCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (PM_ACTIONS) : doublon sur code_action '${codeKey}'.`,
        blocking: true,
      });
      return;
    }
    seenActionCodes.add(codeKey);

    const prev = workingActionsMap.get(codeKey);
    const cleanSlug = rawLibelle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'ACT';
    const generatedId = `ID-ACT-${codeKey}-${cleanSlug}`;
    const explicitActId = cleanStr((row as Record<string, unknown>).id);

    const nextRecord: IPreventiveActionCatalogItem = {
      ...(prev || {}),
      id: explicitActId || prev?.id || generatedId,
      action_id: String(
        explicitActId ||
          (prev as Record<string, unknown> | undefined)?.action_id ||
          prev?.id ||
          generatedId
      ),
      code: codeKey,
      libelle: rawLibelle,
      ref: cleanStr(row.ref) || prev?.ref || '',
      description: cleanStr(row.description) || prev?.description || '',
      type_maintenance:
        cleanStr(row.type_maintenance) ||
        String((prev as Record<string, unknown> | undefined)?.type_maintenance || 'Préventif'),
      frequence_defaut:
        cleanStr(row.frequence_defaut) ||
        String((prev as Record<string, unknown> | undefined)?.frequence_defaut || '1M'),
      duree_standard:
        row.duree_standard !== undefined
          ? row.duree_standard
          : prev?.duree_standard ?? (row.duree_estimee_min ? `${row.duree_estimee_min} min` : '15 min'),
      ...(row.duree_estimee_min !== undefined
        ? { duree_estimee_min: Number(row.duree_estimee_min) || 15 }
        : {}),
      outils:
        row.outils !== undefined
          ? row.outils
          : prev?.outils ?? '',
      couleur: cleanStr(row.couleur) || prev?.couleur || 'blue',
      icone: cleanStr(row.icone) || prev?.icone || 'Wrench',
      symbole: cleanStr(row.symbole) || String((prev as Record<string, unknown> | undefined)?.symbole || codeKey),
      active: row.is_active !== false,
      is_active: row.is_active !== false,
      created_at: prev?.created_at || new Date().toISOString(),
    };

    if (prev) {
      if (
        prev.libelle === nextRecord.libelle &&
        (prev.description || '') === (nextRecord.description || '') &&
        (prev.ref || '') === (nextRecord.ref || '')
      ) {
        aUnchanged++;
      } else {
        aUpdated++;
      }
    } else {
      aCreated++;
    }

    workingActionsMap.set(codeKey, nextRecord);
  });

  if (mode === 'REPLACE_CATALOG' && rawActions.length > 0) {
    const missingActionRefs = new Map<string, { tasks: number; executions: number }>();
    for (const t of existingPreventiveTasks) {
      const aCode = normKey(t.action_code);
      if (aCode && !workingActionsMap.has(aCode)) {
        const entry = missingActionRefs.get(aCode) || { tasks: 0, executions: 0 };
        entry.tasks += 1;
        missingActionRefs.set(aCode, entry);
      }
    }
    for (const ex of existingPreventiveExecutions) {
      const aCode = normKey(ex.actionCode);
      if (aCode && !workingActionsMap.has(aCode)) {
        const entry = missingActionRefs.get(aCode) || { tasks: 0, executions: 0 };
        entry.executions += 1;
        missingActionRefs.set(aCode, entry);
      }
    }
    for (const [aKey, counts] of missingActionRefs.entries()) {
      const total = counts.tasks + counts.executions;
      rejected.push({
        stage: '05_PM_ACTIONS',
        entity: 'PM_ACTIONS',
        row: 0,
        identifier: aKey,
        code: 'REFERENCED_BY_ACTIVE_RECORDS',
        message: `Impossible de supprimer l'action '${aKey}' en mode REPLACE_CATALOG : utilisée par ${total} enregistrement(s) (tâches: ${counts.tasks}, exécutions: ${counts.executions}).`,
        blocking: true,
        referencedCount: total,
        referenceBreakdown: counts,
      });
    }
  }

  accepted.push({
    stage: '05_PM_ACTIONS',
    entity: 'PM_ACTIONS',
    created: aCreated,
    updated: aUpdated,
    unchanged: aUnchanged,
    skipped: aSkipped,
  });

  // =========================================================================
  // STAGE 2: 05_PM_GUIDES (Validates action FKs + optional PDR FKs)
  // =========================================================================
  const stockRefSet = new Set<string>(
    existingStock.map((it) => normKey(it?.ref)).filter(Boolean)
  );
  const checkPdrCatalog = stockRefSet.size > 0 || Boolean(options.strictPdrCheck);
  const strictPdrBlocking =
    options.strictPdrCheck === true ||
    (options.strictPdrCheck !== false && origin !== 'DEMO_BUNDLE');

  const workingGuidesMap = new Map<string, IPreventiveGuideCatalogItem>();
  if (mode === 'MERGE' || rawGuides.length === 0) {
    for (const g of existingGuides) {
      if (!g) continue;
      const code = normKey(g.code || (g as Record<string, unknown>).code_guide || g.id);
      if (!code) continue;
      workingGuidesMap.set(code, {
        ...g,
        code,
      });
    }
  }

  const seenGuideCodes = new Set<string>();
  let gCreated = 0;
  let gUpdated = 0;
  let gUnchanged = 0;
  let gSkipped = 0;

  rawGuides.forEach((row: PmCatalogGuideRow, idx: number) => {
    const rowNum = idx + 1;
    if (!row || typeof row !== 'object') {
      gSkipped++;
      return;
    }

    const rawCode = cleanStr(row.code_guide ?? row.code);
    const rawCompNom = cleanStr(row.composant_nom);

    if (!rawCode && !rawCompNom) {
      gSkipped++;
      return;
    }
    if (!rawCode) {
      rejected.push({
        stage: '05_PM_GUIDES',
        entity: 'PM_GUIDES',
        row: rowNum,
        identifier: rawCompNom,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PM_GUIDES) : 'code_guide' est obligatoire.`,
        blocking: true,
      });
      return;
    }
    if (!rawCompNom) {
      rejected.push({
        stage: '05_PM_GUIDES',
        entity: 'PM_GUIDES',
        row: rowNum,
        identifier: rawCode,
        code: 'MISSING_REQUIRED',
        message: `Ligne ${rowNum} (PM_GUIDES [${rawCode}]) : 'composant_nom' est obligatoire.`,
        blocking: true,
      });
      return;
    }

    const codeKey = normKey(rawCode);
    if (seenGuideCodes.has(codeKey)) {
      rejected.push({
        stage: '05_PM_GUIDES',
        entity: 'PM_GUIDES',
        row: rowNum,
        identifier: rawCode,
        code: 'DUPLICATE_KEY',
        message: `Ligne ${rowNum} (PM_GUIDES) : doublon sur code_guide '${codeKey}'.`,
        blocking: true,
      });
      return;
    }
    seenGuideCodes.add(codeKey);

    const rawActionsLiees = Array.isArray(row.actions_liees) ? row.actions_liees : [];
    const normalizedActionsLiees: string[] = [];
    let hasGuideFkError = false;

    for (const actCodeRaw of rawActionsLiees) {
      const actKey = normKey(actCodeRaw);
      if (!actKey) continue;
      if (!workingActionsMap.has(actKey)) {
        rejected.push({
          stage: '05_PM_GUIDES',
          entity: 'PM_GUIDES',
          row: rowNum,
          identifier: codeKey,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (PM_GUIDES [${codeKey}]) : action liée '${actKey}' introuvable dans 05_PM_ACTIONS.`,
          blocking: true,
        });
        hasGuideFkError = true;
      } else if (!normalizedActionsLiees.includes(actKey)) {
        normalizedActionsLiees.push(actKey);
      }
    }

    let normalizedFichesActions: Record<string, Record<string, unknown>> | undefined = undefined;
    if (row.fiches_actions && typeof row.fiches_actions === 'object' && !Array.isArray(row.fiches_actions)) {
      normalizedFichesActions = {};
      for (const [fKey, fVal] of Object.entries(row.fiches_actions)) {
        const normFKey = normKey(fKey);
        if (!normFKey) continue;
        if (!workingActionsMap.has(normFKey)) {
          rejected.push({
            stage: '05_PM_GUIDES',
            entity: 'PM_GUIDES',
            row: rowNum,
            identifier: codeKey,
            code: 'BROKEN_FK',
            message: `Ligne ${rowNum} (PM_GUIDES [${codeKey}]) : fiche action '${normFKey}' introuvable dans 05_PM_ACTIONS.`,
            blocking: true,
          });
          hasGuideFkError = true;
        } else {
          normalizedFichesActions[normFKey] = fVal && typeof fVal === 'object' ? { ...fVal } : {};
        }
      }
    }

    const rawPieces = Array.isArray(row.pieces_rechange) ? row.pieces_rechange : [];
    const normalizedPieces: Array<Record<string, unknown>> = [];

    for (const p of rawPieces as PmCatalogGuidePieceRow[]) {
      if (!p || typeof p !== 'object') continue;
      const pieceRef = cleanStr(p.ref ?? p.reference);
      if (!pieceRef) {
        rejected.push({
          stage: '05_PM_GUIDES',
          entity: 'PM_GUIDES',
          row: rowNum,
          identifier: codeKey,
          code: 'MISSING_REQUIRED',
          message: `Ligne ${rowNum} (PM_GUIDES [${codeKey}]) : chaque entrée de pieces_rechange doit contenir 'ref'.`,
          blocking: true,
        });
        hasGuideFkError = true;
        continue;
      }
      const qty = p.quantite !== undefined ? Number(p.quantite) : 1;
      if (Number.isNaN(qty) || qty < 0) {
        rejected.push({
          stage: '05_PM_GUIDES',
          entity: 'PM_GUIDES',
          row: rowNum,
          identifier: pieceRef,
          code: 'SCHEMA_MISMATCH',
          message: `Ligne ${rowNum} (PM_GUIDES [${codeKey}]) : quantité invalide pour la PDR '${pieceRef}'.`,
          blocking: true,
        });
        hasGuideFkError = true;
        continue;
      }
      const refUpper = normKey(pieceRef);
      if (checkPdrCatalog && !stockRefSet.has(refUpper)) {
        const issue: ImportIssue = {
          stage: '05_PM_GUIDES',
          entity: 'PM_GUIDES',
          row: rowNum,
          identifier: pieceRef,
          code: 'BROKEN_FK',
          message: `Ligne ${rowNum} (PM_GUIDES [${codeKey}]) : la pièce recommandée '${pieceRef}' est introuvable dans le catalogue PDR (REF_PDR).`,
          blocking: strictPdrBlocking,
        };
        if (strictPdrBlocking) {
          rejected.push(issue);
          hasGuideFkError = true;
          continue;
        } else {
          warnings.push(issue);
        }
      }

      normalizedPieces.push({
        ...(typeof (p as Record<string, unknown>).id_article === 'string'
          ? { id_article: cleanStr((p as Record<string, unknown>).id_article) }
          : {}),
        ref: pieceRef,
        reference: pieceRef,
        designation: cleanStr(p.designation) || pieceRef,
        quantite: qty || 1,
        unite: cleanStr(p.unite) || 'PCS',
        ...(p.prix_unitaire !== undefined ? { prix_unitaire: Number(p.prix_unitaire) || 0 } : {}),
      });
    }

    if (hasGuideFkError) {
      return;
    }

    const prev = workingGuidesMap.get(codeKey);
    const generatedGuideId = `ID-${codeKey}`;
    const explicitGuideId = cleanStr((row as Record<string, unknown>).id);
    const nextRecord: IPreventiveGuideCatalogItem = {
      ...(prev || {}),
      id: explicitGuideId || prev?.id || generatedGuideId,
      guide_id: String(
        explicitGuideId ||
          (prev as Record<string, unknown> | undefined)?.guide_id ||
          prev?.id ||
          generatedGuideId
      ),
      code: codeKey,
      composant_nom: rawCompNom,
      famille: cleanStr(row.famille) || prev?.famille || '',
      ref: cleanStr(row.ref) || prev?.ref || '',
      actions_liees:
        normalizedActionsLiees.length > 0
          ? normalizedActionsLiees
          : Array.isArray(prev?.actions_liees)
          ? prev.actions_liees
          : [],
      pieces_rechange:
        rawPieces.length > 0
          ? normalizedPieces
          : Array.isArray(prev?.pieces_rechange)
          ? prev.pieces_rechange
          : [],
      ...(normalizedFichesActions
        ? { fiches_actions: normalizedFichesActions }
        : prev?.fiches_actions
        ? { fiches_actions: prev.fiches_actions }
        : {}),
      consignes_securite:
        row.consignes_securite !== undefined
          ? row.consignes_securite
          : prev?.consignes_securite ?? '',
      criticite: cleanStr(row.criticite) || prev?.criticite || 'Moyenne',
      ...(row.periodicite_suggeree
        ? { periodicite_suggeree: cleanStr(row.periodicite_suggeree) }
        : {}),
      ...(Array.isArray(row.outillage_requis) ? { outillage_requis: row.outillage_requis } : {}),
      ...(Array.isArray(row.points_de_controle) ? { points_de_controle: row.points_de_controle } : {}),
      active: row.is_active !== false,
      is_active: row.is_active !== false,
      created_at: prev?.created_at || new Date().toISOString(),
    };

    if (prev) {
      if (
        prev.composant_nom === nextRecord.composant_nom &&
        (prev.famille || '') === (nextRecord.famille || '') &&
        JSON.stringify(prev.actions_liees || []) === JSON.stringify(nextRecord.actions_liees || []) &&
        JSON.stringify(prev.pieces_rechange || []) === JSON.stringify(nextRecord.pieces_rechange || [])
      ) {
        gUnchanged++;
      } else {
        gUpdated++;
      }
    } else {
      gCreated++;
    }

    workingGuidesMap.set(codeKey, nextRecord);
  });

  accepted.push({
    stage: '05_PM_GUIDES',
    entity: 'PM_GUIDES',
    created: gCreated,
    updated: gUpdated,
    unchanged: gUnchanged,
    skipped: gSkipped,
  });

  const nextActions = Array.from(workingActionsMap.values());
  const nextGuides = Array.from(workingGuidesMap.values());

  const success = rejected.length === 0;
  let committed = false;

  if (success && !dryRun) {
    DataGateway.savePreventiveActions(nextActions);
    DataGateway.savePreventiveGuides(nextGuides);
    store.setPreventiveActions(nextActions);
    store.setPreventiveGuides(nextGuides);

    DataGateway.appendAuditEvent({
      actionType: 'SETTINGS_CONFIG_UPDATED',
      entityType: 'SYSTEM',
      entityId: 'PM_CATALOG',
      actorId: options.actorId || 'ADMIN',
      actorName: options.actorName || 'Import Pipeline',
      actorRole,
      before: {
        actionsCount: existingActions.length,
        guidesCount: existingGuides.length,
      },
      after: {
        actionsCount: nextActions.length,
        guidesCount: nextGuides.length,
      },
      meta: { mode, origin },
    });

    committed = true;
    notifyPipelineCommitSync('PM_CATALOG', mode, origin);
  }

  return {
    bundleType: 'PM_CATALOG',
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
      nextActions,
      nextGuides,
    },
  };
}

/**
 * Reverse export for `PM_CATALOG` using stable `code_action` and `code_guide` identifiers (Type A Round-Trip).
 * Strictly Level 2 catalog only: never exports machine tasks, plans, or executions.
 */
export function exportPmCatalogBundle(snapshot?: {
  actions?: IPreventiveActionCatalogItem[];
  guides?: IPreventiveGuideCatalogItem[];
}): Required<Pick<PmCatalogBundleInput, 'bundleType' | 'actions' | 'guides'>> {
  const store = useGmaoStore.getState();
  const actions = snapshot?.actions ?? store.preventiveActions ?? [];
  const guides = snapshot?.guides ?? store.preventiveGuides ?? [];

  return {
    bundleType: 'PM_CATALOG',
    actions: actions.map((a) => ({
      code_action: normKey(a.code || (a as Record<string, unknown>).code_action),
      libelle: cleanStr(a.libelle),
      ...(a.ref ? { ref: cleanStr(a.ref) } : {}),
      ...(a.description ? { description: cleanStr(a.description) } : {}),
      ...(typeof (a as Record<string, unknown>).type_maintenance === 'string'
        ? { type_maintenance: cleanStr((a as Record<string, unknown>).type_maintenance) }
        : {}),
      ...(typeof (a as Record<string, unknown>).frequence_defaut === 'string'
        ? { frequence_defaut: cleanStr((a as Record<string, unknown>).frequence_defaut) }
        : {}),
      ...(a.duree_standard !== undefined ? { duree_standard: a.duree_standard } : {}),
      ...(a.outils !== undefined ? { outils: a.outils } : {}),
      ...(a.couleur ? { couleur: cleanStr(a.couleur) } : {}),
      ...(a.icone ? { icone: cleanStr(a.icone) } : {}),
      is_active: (a as Record<string, unknown>).is_active !== false && (a as Record<string, unknown>).active !== false,
    })),
    guides: guides.map((g) => ({
      code_guide: normKey(g.code || (g as Record<string, unknown>).code_guide || g.id),
      composant_nom: cleanStr(g.composant_nom),
      ...(g.famille ? { famille: cleanStr(g.famille) } : {}),
      ...(g.ref ? { ref: cleanStr(g.ref) } : {}),
      actions_liees: Array.isArray(g.actions_liees)
        ? g.actions_liees.map((c) => normKey(c)).filter(Boolean)
        : [],
      pieces_rechange: Array.isArray(g.pieces_rechange)
        ? g.pieces_rechange.map((p) => ({
            ref: cleanStr(p?.ref ?? p?.reference),
            ...(p?.designation ? { designation: cleanStr(p.designation) } : {}),
            quantite: Number(p?.quantite ?? 1) || 1,
            ...(p?.unite ? { unite: cleanStr(p.unite) } : {}),
            ...(p?.prix_unitaire !== undefined ? { prix_unitaire: Number(p.prix_unitaire) || 0 } : {}),
          }))
        : [],
      ...(g.fiches_actions && typeof g.fiches_actions === 'object' && !Array.isArray(g.fiches_actions)
        ? { fiches_actions: g.fiches_actions as Record<string, Record<string, unknown>> }
        : {}),
      ...(g.consignes_securite !== undefined ? { consignes_securite: g.consignes_securite } : {}),
      ...(g.criticite ? { criticite: cleanStr(g.criticite) } : {}),
      is_active: (g as Record<string, unknown>).is_active !== false && (g as Record<string, unknown>).active !== false,
    })),
  };
}

/**
 * Returns a fresh clone of the official `PM_CATALOG` template (`templates/import/PM_CATALOG.template.json`).
 */
export function getPmCatalogOfficialTemplate(): PmCatalogBundleInput & {
  bundleType: 'PM_CATALOG';
} {
  return JSON.parse(JSON.stringify(pmCatalogOfficialTemplate));
}
