import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import type { IStockItem, PdrGroup, StockType } from '../../../types/domain';
import {
  applyPdrCatalogImportToStore,
  validateAndReconcilePdrCatalogImport,
} from '../../pdr/pdrExcelValidator';
import type { PdrCatalogImportError } from '../../pdr/types/pdrExcelTypes';
import refPdrOfficialTemplate from '../../../../templates/import/REF_PDR.template.json';
import {
  cleanStr,
  FORBIDDEN_REF_PDR_ROOT_KEYS,
  FORBIDDEN_REF_PDR_ROW_KEYS,
  normKey,
  notifyPipelineCommitSync,
} from '../pipelineShared';
import type {
  AcceptedStageRecord,
  ImportCommitPolicy,
  ImportIssue,
  ImportIssueCode,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  PipelineStageId,
  RefPdrBundleInput,
  RefPdrStagingResult,
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';

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
      code_type: cleanStr(t.code_type ?? (t as Record<string, unknown>).id_type),
      group_code: cleanStr(
        t.code_group ?? t.group_code ?? (t as Record<string, unknown>).id_group
      ),
      libelle: cleanStr(t.libelle),
      domaine_technique: t.domaine_technique,
      is_active: t.is_active !== false,
    })),
    items: rawItems.map((it) => ({
      ...it,
      ref: cleanStr(it.ref ?? it.code_article),
      designation: cleanStr(it.designation),
      type_code_or_id: cleanStr(
        it.code_type ??
          (it as Record<string, unknown>).type_code_or_id ??
          (it as Record<string, unknown>).id_type ??
          (it as Record<string, unknown>).type
      ),
      group_code: cleanStr(
        it.code_group ??
          (it as Record<string, unknown>).group_code ??
          (it as Record<string, unknown>).id_group
      ),
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
      notifyPipelineCommitSync('REF_PDR', mode, origin);
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
 * Returns a fresh clone of the official `REF_PDR` template (`templates/import/REF_PDR.template.json`).
 */
export function getRefPdrOfficialTemplate(): RefPdrBundleInput & {
  bundleType: 'REF_PDR';
} {
  return JSON.parse(JSON.stringify(refPdrOfficialTemplate));
}
