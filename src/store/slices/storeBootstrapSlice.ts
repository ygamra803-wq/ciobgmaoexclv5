/**
 * GMAO Store Bootstrap & Pure Slice Helpers (`src/store/slices/storeBootstrapSlice.ts`)
 * Extracted from `useGmaoStore.ts` to keep the master store modular and maintainable.
 */

import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import { storageService } from '../../utils/storageService';
import { sanitizeMachinesHierarchy } from '../../utils/assetHierarchy';
import type { IMeterReading } from '../../types/meter';
import type { IReplenishmentOrder } from '../../types/replenishment';
import SortieExterneService from '../../application/services/SortieExterneService';
import type { IWorkshopOrder } from '../../domain/corrective/workshopOrderService';
import type { INeedRequest } from '../../domain/corrective/needRequestService';
import { getEntityRecordId } from '../../services/lanStateMergeService';
import { SecurityService } from '../../core/security/SecurityService';

import initialPdrGroups from '../../data/stock/seedPdrGroups.json';
import initialStockSeed from '../../data/stock/seedStockItems.json';
import initialStockTypes from '../../data/stock/seedStockTypes.json';
import initialFamilies from '../../data/machines/seedFamilies.json';
import initialTemplates from '../../data/machines/seedTemplates.json';
import initialMachines from '../../data/machines/seedMachines.json';
import initialGeneralSystemTypes from '../../data/machines/seedGeneralSystemTypes.json';
import initialZones from '../../data/machines/seedZones.json';
import initialMachineBomLedger from '../../data/machines/seedMachineBomLedger.json';
import initialWarehouseItems from '../../data/warehouse/seedWarehouseItems.json';
import initialCompGroups from '../../data/warehouse/seedCompGroups.json';
import initialCompFamilies from '../../data/warehouse/seedCompFamilies.json';
import initialCompTemplates from '../../data/warehouse/seedCompTemplates.json';
import initialEntrepotComponents from '../../data/warehouse/seedEntrepotComponents.json';
import initialPartGroups from '../../data/warehouse/seedPartGroups.json';
import initialPartTypes from '../../data/warehouse/seedPartTypes.json';
import initialPartDesignations from '../../data/warehouse/seedPartDesignations.json';
import seedUsers from '../../data/users/seedUsers.json';
import initialMouvements from '../../data/movements/seedMouvements.json';
import initialActions from '../../data/preventive/seedPreventiveActions.json';
import initialGuides from '../../data/preventive/seedPreventiveGuides.json';
import initialActionsByPanne from '../../data/corrective/seedActionsByPanne.json';
import initialPanneCategories from '../../data/corrective/seedPanneByCategory.json';
import initialTravauxAFaire from '../../data/corrective/seedTravailAFaire.json';
import initialIntervenants from '../../data/corrective/seedIntervenants.json';

export const ACTIVE_LIVE_KEY = STORAGE_KEYS.CORRECTIVE_ACTIVE_LIVE;
export const PENDING_DELETED_IDS_KEY = 'gmao_pending_deleted_ids_v1';

export function resolveActiveActorContext(): { actorId: string; actorName: string; actorRole: string } {
  try {
    const parsed = SecurityService.getSessionSecure('gmao_session_v2');
    if (parsed && typeof parsed === 'object') {
      const payload = parsed?.payload || parsed || {};
      return {
        actorId: String(payload.userId || payload.id || payload.username || 'ADMIN').trim(),
        actorName: String(payload.nom || payload.name || payload.username || 'Administrateur').trim(),
        actorRole: String(payload.role || 'ADMIN').trim().toUpperCase(),
      };
    }
  } catch {
    // ignore
  }
  return {
    actorId: 'ADMIN',
    actorName: 'Administrateur GMAO',
    actorRole: 'ADMIN',
  };
}

export function isMachineArchivedState(m: any): boolean {
  if (!m || typeof m !== 'object') return false;
  const statusUpper = String(m.status || m.statut || '').trim().toUpperCase();
  const lifecycleUpper = String(m.lifecycle_status || '').trim().toUpperCase();
  return (
    statusUpper === 'ARCHIVEE' ||
    statusUpper === 'ARCHIVED' ||
    lifecycleUpper === 'ARCHIVED' ||
    m.is_active === false ||
    m.actif === false ||
    m.archived === true
  );
}

export function resolveActiveSessionRole(): string {
  try {
    const parsed = SecurityService.getSessionSecure('gmao_session_v2');
    if (parsed && typeof parsed === 'object') {
      const role = parsed?.payload?.role || parsed?.role || '';
      return String(role).trim().toUpperCase();
    }
  } catch {
    // ignore
  }
  return '';
}

export function normalizeInterventionNature(raw: unknown): string | undefined {
  const clean = String(raw || '').trim().toUpperCase();
  if (
    clean === 'REPLACE' ||
    clean === 'ATELIER' ||
    clean === 'REPAIR' ||
    clean === 'CLEAN' ||
    clean === 'ADJUST' ||
    clean === 'INSPECT' ||
    clean === 'OTHER'
  ) {
    return clean;
  }
  return undefined;
}

export function syncCorrectiveInterventionsWithSortieRecord(
  interventions: any[],
  sortieRecord: any,
  allSorties: any[]
): { changed: boolean; nextInterventions: any[] } {
  if (!Array.isArray(interventions) || !sortieRecord || typeof sortieRecord !== 'object') {
    return { changed: false, nextInterventions: interventions };
  }
  const targetBtKey = String(sortieRecord.id_corrective || '').trim().toUpperCase();
  const sortieId = String(sortieRecord.id || '').trim();
  const sortieCode = String(sortieRecord.code || '').trim();
  if (!targetBtKey && !sortieId && !sortieCode) {
    return { changed: false, nextInterventions: interventions };
  }

  let changed = false;
  const nextInterventions = interventions.map((bt) => {
    if (!bt || typeof bt !== 'object') return bt;
    const btId = String(bt.id || '').trim().toUpperCase();
    const btNum = String(bt.num_bt || '').trim().toUpperCase();
    const existingSortieId = String(bt.id_sortie_atelier || '').trim();
    const existingSortieCode = String(bt.code_sortie_atelier || '').trim().toUpperCase();

    const matches =
      (targetBtKey && (btId === targetBtKey || btNum === targetBtKey)) ||
      (sortieId && existingSortieId === sortieId) ||
      (sortieCode && existingSortieCode === sortieCode.toUpperCase());

    if (!matches) return bt;

    changed = true;
    const linkedList = SortieExterneService.getLinkedOrdersForBt(
      { ...bt, id_sortie_atelier: sortieId || bt.id_sortie_atelier, code_sortie_atelier: sortieCode || bt.code_sortie_atelier },
      allSorties
    );
    const totalAtelierCost = linkedList.reduce(
      (sum, s) => sum + (Number(s?.cout_bobinage ?? s?.cout_atelier) || 0),
      0
    );
    const totalPdrCost = Number(bt.cout_pdr ?? bt.pdr_cost ?? 0) || 0;

    return {
      ...bt,
      id_sortie_atelier: sortieRecord.id || bt.id_sortie_atelier || '',
      code_sortie_atelier: sortieRecord.code || bt.code_sortie_atelier || '',
      cout_atelier: totalAtelierCost,
      cout_total: Number((totalPdrCost + totalAtelierCost).toFixed(2)),
      nature_travail_atelier:
        sortieRecord.nature_travail || sortieRecord.type_probleme || bt.nature_travail_atelier || '',
      prestataire_atelier:
        sortieRecord.fournisseur_externe || bt.prestataire_atelier || '',
      ...(bt.intervention_nature ? {} : { intervention_nature: 'ATELIER' }),
    };
  });

  return { changed, nextInterventions };
}

export function recordLocalDeletedIds(entity: string, removedIds: unknown[]): void {
  const cleanEntity = String(entity || '').trim();
  if (!cleanEntity || !Array.isArray(removedIds) || removedIds.length === 0) return;
  const cleanIds = removedIds
    .map((id) => String(id ?? '').trim())
    .filter(Boolean);
  if (cleanIds.length === 0) return;
  try {
    const raw = storageService.getItem(PENDING_DELETED_IDS_KEY);
    const current =
      typeof raw === 'string'
        ? JSON.parse(raw)
        : raw && typeof raw === 'object'
        ? raw
        : {};
    const parsed = current && typeof current === 'object' && !Array.isArray(current) ? { ...current } : {};
    const existing = new Set<string>(Array.isArray(parsed[cleanEntity]) ? parsed[cleanEntity] : []);
    for (const id of cleanIds) existing.add(id);
    parsed[cleanEntity] = Array.from(existing);
    storageService.setItem(PENDING_DELETED_IDS_KEY, parsed);
  } catch {}
}

export function trackRemovedEntityIds(entity: string, prevList: any[], nextList: any[]): void {
  if (!Array.isArray(prevList) || prevList.length === 0) return;
  const nextArr = Array.isArray(nextList) ? nextList : [];
  if (nextArr.length >= prevList.length) {
    const nextIds = new Set<string>();
    for (const item of nextArr) {
      const id = getEntityRecordId(entity, item);
      if (id) nextIds.add(id);
    }
    const removed: string[] = [];
    for (const prevItem of prevList) {
      const prevId = getEntityRecordId(entity, prevItem);
      if (prevId && !nextIds.has(prevId)) removed.push(prevId);
    }
    if (removed.length > 0) recordLocalDeletedIds(entity, removed);
    return;
  }
  const nextIds = new Set<string>();
  for (const item of nextArr) {
    const id = getEntityRecordId(entity, item);
    if (id) nextIds.add(id);
  }
  const removed: string[] = [];
  for (const prevItem of prevList) {
    const prevId = getEntityRecordId(entity, prevItem);
    if (prevId && !nextIds.has(prevId)) {
      removed.push(prevId);
    }
  }
  if (removed.length > 0) {
    recordLocalDeletedIds(entity, removed);
  }
}

export function isPartAlreadyDeductedByStoreBon(
  mouvements: any[],
  numBonSaisi: unknown,
  ref: unknown
): boolean {
  const cleanBon = String(numBonSaisi || '').trim().toUpperCase();
  const cleanRef = String(ref || '').trim().toUpperCase();
  if (!cleanBon || !cleanRef) return false;
  return (mouvements || []).some((m: any) => {
    if (!m) return false;
    const mType = String(m.type || '').trim().toLowerCase();
    if (!mType.includes('sortie') && mType !== 'out') return false;
    const mBon = String(m.code_bon || '').trim().toUpperCase();
    const mTechBon = String(m.num_bon_saisi_par_tech || '').trim().toUpperCase();
    if (mBon !== cleanBon && mTechBon !== cleanBon) return false;
    const mRef = String(m.ref || m.code_article || m.reference || '').trim().toUpperCase();
    return mRef === cleanRef;
  });
}

export function resolveUpdate<T>(updater: T | ((prev: T) => T), current: T): T {
  return typeof updater === 'function' ? (updater as (prev: T) => T)(current) : updater;
}

export function buildInitialStockMapFromList(rawStock: any[] = []): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(rawStock)) return map;
  for (const item of rawStock) {
    if (!item) continue;
    const ref = String(item.ref || item.Ref || '').trim();
    if (!ref) continue;
    map.set(ref, Number(item.stockInitial) || 0);
  }
  return map;
}

export function isRealPersonnelUser(u: any): boolean {
  if (!u || typeof u !== 'object') return false;
  if (u.passwordHash) return false;
  const idStr = String(u.id || u.id_technician || u.id_operation || '').trim().toUpperCase();
  const usernameStr = String(u.username || '').trim().toLowerCase();
  if (['ADMIN', 'MAGASINIER', 'VIEWER'].includes(idStr) || ['admin', 'magasinier', 'viewer'].includes(usernameStr)) {
    return false;
  }
  if (idStr === 'TECH' && (!u.nom || u.nom === 'Technicien Maintenance')) {
    return false;
  }
  return true;
}

export function deriveTechnicians(users: any[]) {
  return (users || [])
    .filter((u) => {
      if (!u || !isRealPersonnelUser(u)) return false;
      const roleStr = String(u.role || u.type_profil || '').toLowerCase();
      const idStr = String(u.id || u.id_technician || '').toUpperCase();
      return roleStr.includes('tech') || idStr.startsWith('TECH');
    })
    .map((u) => ({
      ...u,
      id_technician: u.id_technician || u.id,
    }));
}

export function deriveOperations(users: any[]) {
  return (users || [])
    .filter((u) => {
      if (!u || !isRealPersonnelUser(u)) return false;
      const roleStr = String(u.role || u.type_profil || '').toLowerCase();
      const idStr = String(u.id || u.id_technician || '').toUpperCase();
      return !roleStr.includes('tech') && !idStr.startsWith('TECH');
    })
    .map((u) => ({
      ...u,
      id_operation: u.id_operation || u.id,
    }));
}

export function getInitialStock() {
  const types = loadCollection(STORAGE_KEYS.STOCK_TYPES, {
    allowDemoFallback: true,
    demoSeed: initialStockTypes,
  });
  const rawStock = loadCollection(STORAGE_KEYS.RAW_STOCK, {
    allowDemoFallback: true,
    demoSeed: initialStockSeed,
  });
  const demoDesignations = initialStockSeed.map((s: any) => ({
    id: s.id,
    ref: s.ref,
    designation: s.designation,
    id_type: s.id_type,
    type: s.type,
    stockInitial: s.stockInitial,
    seuil: s.seuil,
    emplacement: s.emplacement,
  }));
  const designations = loadCollection(STORAGE_KEYS.DESIGNATIONS, {
    allowDemoFallback: true,
    demoSeed: demoDesignations,
  });
  const pdrGroups = loadCollection(STORAGE_KEYS.PDR_GROUPS, {
    allowDemoFallback: true,
    demoSeed: initialPdrGroups,
  });
  return { types, rawStock, designations, pdrGroups };
}

export function normalizeMachinesList(list: any[] = []) {
  if (!Array.isArray(list)) return [];
  const baseNormalized = list.map((m) => {
    if (!m || typeof m !== 'object') return m;
    const assetClass =
      String(m.asset_class || '').trim().toUpperCase() === 'SYSTEM_GENERAL'
        ? 'SYSTEM_GENERAL'
        : 'PRODUCTION';
    return {
      ...m,
      asset_class: assetClass,
      id_general_system_type:
        assetClass === 'SYSTEM_GENERAL' ? m.id_general_system_type || null : null,
    };
  });
  return sanitizeMachinesHierarchy(baseNormalized);
}

export function getInitialMachines() {
  const families = loadCollection(STORAGE_KEYS.FAMILIES, {
    allowDemoFallback: true,
    demoSeed: initialFamilies,
  });
  const templates = loadCollection(STORAGE_KEYS.TEMPLATES, {
    allowDemoFallback: true,
    demoSeed: initialTemplates,
  });
  const blueprints = loadCollection(STORAGE_KEYS.BLUEPRINTS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  const loadedMachines = loadCollection(STORAGE_KEYS.MACHINES, {
    allowDemoFallback: true,
    demoSeed: initialMachines,
  });
  const machines = normalizeMachinesList(loadedMachines);
  const generalSystemTypes = loadCollection(STORAGE_KEYS.GENERAL_SYSTEM_TYPES, {
    allowDemoFallback: true,
    demoSeed: initialGeneralSystemTypes,
  });
  const loadedZones = loadCollection(STORAGE_KEYS.ZONES, {
    allowDemoFallback: true,
    demoSeed: initialZones,
  });
  const zones = loadedZones.map((z: any) => ({
    ...z,
    code_zone: z.code_zone || z.code || z.id_zone,
    id_zone: z.id_zone || z.code_zone || z.code,
  }));
  const machineElementsLedger = loadCollection(STORAGE_KEYS.MACHINE_BOM, {
    allowDemoFallback: true,
    demoSeed: initialMachineBomLedger,
  });
  return { families, templates, blueprints, machines, generalSystemTypes, zones, machineElementsLedger };
}

export function getInitialWarehouse() {
  const compGroups = loadCollection(STORAGE_KEYS.COMP_GROUPS, {
    allowDemoFallback: true,
    demoSeed: initialCompGroups,
  });
  const warehouseItems = loadCollection(STORAGE_KEYS.WAREHOUSE_ITEMS, {
    allowDemoFallback: true,
    demoSeed: initialWarehouseItems,
  });
  const entrepotComponents = loadCollection(STORAGE_KEYS.ENTREPOT_COMPONENTS, {
    allowDemoFallback: true,
    demoSeed: initialEntrepotComponents,
  });
  const compFamilies = loadCollection(STORAGE_KEYS.COMP_FAMILIES, {
    allowDemoFallback: true,
    demoSeed: initialCompFamilies,
  });
  const compTemplates = loadCollection(STORAGE_KEYS.COMP_TEMPLATES, {
    allowDemoFallback: true,
    demoSeed: initialCompTemplates,
  });
  const partGroups = loadCollection(STORAGE_KEYS.PART_GROUPS, {
    allowDemoFallback: true,
    demoSeed: initialPartGroups,
  });
  const partTypes = loadCollection(STORAGE_KEYS.PART_TYPES, {
    allowDemoFallback: true,
    demoSeed: initialPartTypes,
  });
  const partDesignations = loadCollection(STORAGE_KEYS.PART_DESIGNATIONS, {
    allowDemoFallback: true,
    demoSeed: initialPartDesignations,
  });
  return {
    compGroups,
    warehouseItems,
    entrepotComponents,
    compFamilies,
    compTemplates,
    partGroups,
    partTypes,
    partDesignations,
  };
}

export function getInitialPersonnel() {
  const users = loadCollection(STORAGE_KEYS.PERSONNEL, {
    allowDemoFallback: true,
    demoSeed: seedUsers,
  }).filter(isRealPersonnelUser);
  return {
    users,
    technicians: deriveTechnicians(users),
    operations: deriveOperations(users),
  };
}

export function getInitialMovements() {
  const mouvements = loadCollection(STORAGE_KEYS.MOUVEMENTS, {
    allowDemoFallback: true,
    demoSeed: initialMouvements,
  });
  const sortieDemands = loadCollection(STORAGE_KEYS.SORTIE_DEMANDS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  const replenishmentOrders = loadCollection<IReplenishmentOrder>(STORAGE_KEYS.REPLENISHMENT_ORDERS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  return { mouvements, sortieDemands, replenishmentOrders };
}

export function getInitialPreventive() {
  const actions = loadCollection(STORAGE_KEYS.PREVENTIVE_ACTIONS, {
    allowDemoFallback: true,
    demoSeed: initialActions,
  });
  const guides = loadCollection(STORAGE_KEYS.PREVENTIVE_GUIDES, {
    allowDemoFallback: true,
    demoSeed: initialGuides,
  });
  const plans = loadCollection(STORAGE_KEYS.PREVENTIVE_PLANS, {
    allowDemoFallback: true,
    demoSeed: [],
  });
  const tasks = loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  const executions = loadCollection(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  const meterReadings = loadCollection<IMeterReading>(STORAGE_KEYS.METER_READINGS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  return { actions, guides, plans, tasks, executions, meterReadings };
}

export function getInitialSorties() {
  const sorties = loadCollection(STORAGE_KEYS.SORTIE_EXTERNE, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  return { sorties };
}

export function getInitialCorrective() {
  const interventions = loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  const actionsByPanne = loadCollection(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE, {
    allowDemoFallback: true,
    demoSeed: initialActionsByPanne,
    emptyDefault: {},
  });
  const panneCategories = loadCollection(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES, {
    allowDemoFallback: true,
    demoSeed: initialPanneCategories,
    emptyDefault: {},
  });
  const travauxAFaire = loadCollection(STORAGE_KEYS.CORRECTIVE_TRAVAUX, {
    allowDemoFallback: true,
    demoSeed: initialTravauxAFaire,
  });
  const intervenants = loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENANTS, {
    allowDemoFallback: true,
    demoSeed: initialIntervenants,
  });
  const workshopOrders = loadCollection<IWorkshopOrder>(STORAGE_KEYS.WORKSHOP_ORDERS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  const needRequests = loadCollection<INeedRequest>(STORAGE_KEYS.NEED_REQUESTS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  const activeLiveId = storageService.getItem(ACTIVE_LIVE_KEY) || null;
  return {
    interventions,
    actionsByPanne,
    panneCategories,
    travauxAFaire,
    intervenants,
    workshopOrders,
    needRequests,
    activeLiveId,
  };
}
