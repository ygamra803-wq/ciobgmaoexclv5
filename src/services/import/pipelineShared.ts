import { storageService } from '../../utils/storageService';
import type {
  IGeneralSystemType,
  IMachineFamily,
  IMachineTemplate,
  ITechnician,
  IUserRecord,
  IZone,
  MaterialPolicyTag,
} from '../../types/domain';
import type {
  ImportMode,
  ImportSourceOrigin,
  PipelineBundleType,
} from './types/unifiedImportTypes';

export const FORBIDDEN_PSEUDO_ZONES = new Set([
  'DIVERS',
  'SYSTEM_GENERAL',
  'SYSTEME_GENERAL',
  'TOUTES',
]);

export const FORBIDDEN_GATEWAY_PERSONNEL_CODES = new Set(['ADMIN', 'MAGASINIER', 'VIEWER']);

export const FORBIDDEN_PERSONNEL_AUTH_KEYS = [
  'password',
  'passwordHash',
  'pin',
  'masterPin',
  'secret',
  'token',
] as const;

export const FORBIDDEN_REF_PARC_ROOT_KEYS = [
  'machines',
  'preventiveTasks',
  'mouvements',
  'blueprints',
  'correctiveInterventions',
  'warehouseItems',
] as const;

export const FORBIDDEN_REF_PERSONNEL_ROOT_KEYS = [
  'machines',
  'preventiveTasks',
  'mouvements',
  'blueprints',
  'correctiveInterventions',
  'warehouseItems',
  'accounts',
  'credentials',
] as const;

export const FORBIDDEN_ASSETS_MACHINES_ROOT_KEYS = [
  'blueprints',
  'preventiveTasks',
  'mouvements',
  'correctiveInterventions',
] as const;

export const FORBIDDEN_REF_PDR_ROOT_KEYS = [
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

export const FORBIDDEN_REF_PDR_ROW_KEYS = [
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

export const FORBIDDEN_MACHINE_ROW_EMBEDDED_KEYS = [
  'components_theoriques',
  'parts_theoriques',
  'pdr_theoriques',
  'preventivePlanItems',
  'preventiveTasks',
  'mouvements',
] as const;

export const FORBIDDEN_PM_CATALOG_ROOT_KEYS = [
  'preventiveTasks',
  'tasks',
  'taches',
  'preventivePlans',
  'plans',
  'preventiveExecutions',
  'executions',
  'machines',
  'mouvements',
  'interventions',
  'correctiveInterventions',
  'blueprints',
  'warehouseItems',
  'password',
  'passwordHash',
  'accounts',
  'credentials',
] as const;

export const FORBIDDEN_PM_CATALOG_ROW_KEYS = [
  'id_machine',
  'code_machine',
  'machine_id',
  'id_machine_registered',
  'id_zone',
  'code_zone',
  'preventiveTasks',
  'tasks',
  'taches',
  'preventivePlans',
  'plans',
  'preventiveExecutions',
  'executions',
  'machines',
  'mouvements',
  'blueprints',
  'password',
  'passwordHash',
  'pin',
  'secret',
  'token',
] as const;

export const FORBIDDEN_ENTREPOT_BOM_ROOT_KEYS = [
  'warehouseItems',
  'entrepotComponents',
  'machineElementsLedger',
  'machines',
  'mouvements',
  'rawStock',
  'blueprints',
  'preventiveTasks',
  'correctiveInterventions',
  'interventions',
  'password',
  'passwordHash',
  'accounts',
  'credentials',
] as const;

export const FORBIDDEN_ENTREPOT_BOM_ROW_KEYS = [
  'id_machine',
  'code_machine',
  'machine_id',
  'id_machine_registered',
  'id_warehouse_item',
  'id_entrepot',
  'stock_actuel',
  'quantite',
  'mouvements',
  'historique_bobinage',
  'password',
  'passwordHash',
  'pin',
  'secret',
  'token',
] as const;

export const FORBIDDEN_CM_CATALOG_ROOT_KEYS = [
  'correctiveInterventions',
  'interventions',
  'bonsTravail',
  'demandes',
  'workshopOrders',
  'needRequests',
  'machines',
  'mouvements',
  'preventiveTasks',
  'blueprints',
  'warehouseItems',
  'password',
  'passwordHash',
  'accounts',
  'credentials',
] as const;

export const FORBIDDEN_CM_CATALOG_ROW_KEYS = [
  'id_machine',
  'code_machine',
  'machine_id',
  'id_machine_registered',
  'num_bt',
  'id_bt',
  'statut',
  'mouvements',
  'pieces_utilisees',
  'password',
  'passwordHash',
  'pin',
  'secret',
  'token',
] as const;

export const DEFAULT_CM_CATEGORY_LABELS: Record<string, string> = {
  M: 'Mécanique',
  E: 'Électrique',
  H: 'Hydraulique',
  P: 'Pneumatique',
};

export function normKey(raw: unknown): string {
  return String(raw ?? '').trim().toUpperCase();
}

export function foldAccentsKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export function cleanStr(raw: unknown): string {
  return String(raw ?? '').trim();
}

export type PipelineCommitSyncListener = (info: {
  bundleType: PipelineBundleType;
  mode: ImportMode;
  origin: ImportSourceOrigin;
  committedAt: string;
}) => void;

const pipelineCommitListeners = new Set<PipelineCommitSyncListener>();

/**
 * Registers an observer notified synchronously whenever any non-dryRun UnifiedImportPipeline commit succeeds.
 */
export function registerPipelineCommitListener(listener: PipelineCommitSyncListener): () => void {
  pipelineCommitListeners.add(listener);
  return () => pipelineCommitListeners.delete(listener);
}

export function notifyPipelineCommitSync(
  bundleType: PipelineBundleType,
  mode: ImportMode,
  origin: ImportSourceOrigin
): void {
  const committedAt = new Date().toISOString();
  try {
    storageService.setItem('gmao_local_modified_at', committedAt);
  } catch {
    // Non-blocking when storage is unavailable
  }

  for (const listener of pipelineCommitListeners) {
    try {
      listener({ bundleType, mode, origin, committedAt });
    } catch {
      // Isolate subscriber failures from commit flow
    }
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('gmao:pipeline_committed', {
          detail: { bundleType, mode, origin, committedAt },
        })
      );
      void import('../serverSyncService')
        .then(({ serverSyncService }) => {
          serverSyncService.markLocalModified();
          serverSyncService.scheduleAutoPush(undefined, 500);
        })
        .catch(() => {});
    } catch {
      // Non-blocking in headless/Vitest environments
    }
  }
}

export interface ZoneIndexLookup {
  canonicalMap: Map<string, IZone>;
  legacyFallbackMap: Map<string, IZone>;
}

export function buildZoneIndex(zones: IZone[]): ZoneIndexLookup {
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

export function resolveZoneWithCompatibility(
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

export function buildFamilyIndex(families: IMachineFamily[]): Map<string, IMachineFamily> {
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

export function buildTemplateIndex(templates: IMachineTemplate[]): Map<string, IMachineTemplate> {
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

export function buildSystemTypeIndex(types: IGeneralSystemType[]): Map<string, IGeneralSystemType> {
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

export function buildTechnicianIndex(
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

export function normalizeBomPolicyTags(raw: unknown): MaterialPolicyTag[] {
  const allowed = new Set<MaterialPolicyTag>(['REPLACING', 'REPAIRABLE', 'MODIFYING']);
  const tokens = Array.isArray(raw)
    ? raw.map((x) => normKey(x))
    : cleanStr(raw)
        .split(/[,;|]/)
        .map((x) => normKey(x));
  const out: MaterialPolicyTag[] = [];
  for (const tk of tokens) {
    if (allowed.has(tk as MaterialPolicyTag) && !out.includes(tk as MaterialPolicyTag)) {
      out.push(tk as MaterialPolicyTag);
    }
  }
  return out.length > 0 ? out : ['REPLACING'];
}
