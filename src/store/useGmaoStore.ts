/**
 * 🏛️ GMAO Master State Store (Zustand + Clean Architecture)
 * Centralizes all GMAO domain slices with TypeScript type safety, fine-grained subscriptions,
 * zero unnecessary re-renders, and automatic persistence synchronization.
 */

import { create } from 'zustand';
import type { GmaoStoreState } from '../types/store';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection, migrateStorageOnce } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import { storageService } from '../utils/storageService';
import { Logger } from '../core/logger/LoggerService';
import { MeterService } from '../application/services/meter/MeterService';
import type { IMeterReading, MeterUnit } from '../types/meter';
import type { IReplenishmentOrder, ReplenishmentOrderStatus } from '../types/replenishment';
import { dataIntegrityService } from '../services/dataIntegrityService';
import { reactiveCalculationEngine } from '../services/reactiveCalculationEngine';
import { loadBaselineCorrectiveData } from '../utils/baselineCorrective';
import { confirmAction } from '../utils/confirmAction';
import { sanitizeMachinesHierarchy } from '../utils/assetHierarchy';

import initialPdrGroups from '../data/stock/seedPdrGroups.json';
import initialStockSeed from '../data/stock/seedStockItems.json';
import initialStockTypes from '../data/stock/seedStockTypes.json';
import initialFamilies from '../data/machines/seedFamilies.json';
import initialTemplates from '../data/machines/seedTemplates.json';
import initialBlueprints from '../data/machines/seedBlueprints.json';
import initialMachines from '../data/machines/seedMachines.json';
import initialGeneralSystemTypes from '../data/machines/seedGeneralSystemTypes.json';
import initialZones from '../data/machines/seedZones.json';
import initialMachineBomLedger from '../data/machines/seedMachineBomLedger.json';
import initialWarehouseItems from '../data/warehouse/seedWarehouseItems.json';
import initialCompGroups from '../data/warehouse/seedCompGroups.json';
import initialCompFamilies from '../data/warehouse/seedCompFamilies.json';
import initialCompTemplates from '../data/warehouse/seedCompTemplates.json';
import initialEntrepotComponents from '../data/warehouse/seedEntrepotComponents.json';
import initialPartGroups from '../data/warehouse/seedPartGroups.json';
import initialPartTypes from '../data/warehouse/seedPartTypes.json';
import initialPartDesignations from '../data/warehouse/seedPartDesignations.json';
import seedUsers from '../data/users/seedUsers.json';
import initialMouvements from '../data/movements/seedMouvements.json';
import initialTasks from '../data/preventive/seedPreventiveTasks.json';
import initialActions from '../data/preventive/seedPreventiveActions.json';
import initialGuides from '../data/preventive/seedPreventiveGuides.json';
import initialInterventions from '../data/corrective/seedCorrectiveInterventions.json';
import initialActionsByPanne from '../data/corrective/seedActionsByPanne.json';
import initialPanneCategories from '../data/corrective/seedPanneByCategory.json';
import initialTravauxAFaire from '../data/corrective/seedTravailAFaire.json';
import initialIntervenants from '../data/corrective/seedIntervenants.json';

import PreventiveService from '../application/services/PreventiveService';
import { computeNextDueDate } from '../application/services/preventive/TaskService';
import SortieExterneService, { INITIAL_SORTIES_BOBINAGE } from '../application/services/SortieExterneService';
import { CorrectiveIntervention } from '../domain/corrective/entities/CorrectiveIntervention';
import { CorrectiveCalculationService } from '../domain/corrective/services/CorrectiveCalculationService';
import { WorkOrderStateMachine } from '../domain/corrective/services/WorkOrderStateMachine';
import {
  createWorkshopOrderRecord,
  getLinkedWorkshopOrdersForIntervention,
  isWorkshopOrderActive,
  validateWorkshopOrderTransition,
  type IWorkshopOrder,
  type WorkshopOrderStatus,
} from '../domain/corrective/workshopOrderService';
import {
  createNeedRequestRecord,
  getEffectivePolicyTags,
  getLinkedNeedRequestsForIntervention,
  hasBlockingNeedRequestForIntervention,
  isNeedRequestBlockingBtClosure,
  suggestWorkshopType,
  validateNeedRequestTransition,
  type INeedRequest,
  type NeedApproChannel,
  type NeedRequestStatus,
} from '../domain/corrective/needRequestService';
import { movementRepository } from '../application/MovementRepository';
import { getEntityRecordId } from '../services/lanStateMergeService';

import type { IAuditEvent } from '../types/audit';
import { SecurityService } from '../core/security/SecurityService';

const ACTIVE_LIVE_KEY = STORAGE_KEYS.CORRECTIVE_ACTIVE_LIVE;
const PENDING_DELETED_IDS_KEY = 'gmao_pending_deleted_ids_v1';

function resolveActiveActorContext(): { actorId: string; actorName: string; actorRole: string } {
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

function isMachineArchivedState(m: any): boolean {
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

function resolveActiveSessionRole(): string {
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

function normalizeInterventionNature(raw: unknown): string | undefined {
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

function syncCorrectiveInterventionsWithSortieRecord(
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

function recordLocalDeletedIds(entity: string, removedIds: unknown[]): void {
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

function trackRemovedEntityIds(entity: string, prevList: any[], nextList: any[]): void {
  if (!Array.isArray(prevList) || prevList.length === 0) return;
  const nextArr = Array.isArray(nextList) ? nextList : [];
  if (nextArr.length >= prevList.length) {
    // Quick check if any IDs were replaced/removed even when length didn't shrink
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

function isPartAlreadyDeductedByStoreBon(
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

function resolveUpdate<T>(updater: T | ((prev: T) => T), current: T): T {
  return typeof updater === 'function' ? (updater as (prev: T) => T)(current) : updater;
}

function buildInitialStockMapFromList(rawStock: any[] = []): Map<string, number> {
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

function isRealPersonnelUser(u: any): boolean {
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

function deriveTechnicians(users: any[]) {
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

function deriveOperations(users: any[]) {
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

// Initial state builders obeying SSOT
function getInitialStock() {
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

function normalizeMachinesList(list: any[] = []) {
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

function getInitialMachines() {
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

function getInitialWarehouse() {
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

function getInitialPersonnel() {
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

function getInitialMovements() {
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

function getInitialPreventive() {
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

function getInitialSorties() {
  const sorties = loadCollection(STORAGE_KEYS.SORTIE_EXTERNE, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  return { sorties };
}

function getInitialCorrective() {
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

/**
 * Zustand Global Store Instance
 */
export const useGmaoStore = create<GmaoStoreState>((set, get) => {
  // Run storage migration synchronously BEFORE reading any canonical keys
  migrateStorageOnce();

  const stockInit = getInitialStock();
  const machinesInit = getInitialMachines();
  const warehouseInit = getInitialWarehouse();
  const personnelInit = getInitialPersonnel();
  const movementsInit = getInitialMovements();
  const preventiveInit = getInitialPreventive();
  const sortiesInit = getInitialSorties();
  const correctiveInit = getInitialCorrective();

  return {
    // ==========================================
    // 1. Stock Slice
    // ==========================================
    types: stockInit.types,
    rawStock: stockInit.rawStock,
    designations: stockInit.designations,
    pdrGroups: stockInit.pdrGroups || [],

    setTypes: (updater) => {
      const next = resolveUpdate(updater, get().types);
      set({ types: next });
      DataGateway.saveStockTypes(next);
    },

    setPdrGroups: (updater) => {
      const prev = get().pdrGroups || [];
      const next = resolveUpdate(updater, prev);
      set({ pdrGroups: next });
      DataGateway.savePdrGroups(next);
    },

    setRawStock: (updater) => {
      const prev = get().rawStock || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('rawStock', prev, next);
      set({ rawStock: next });
      DataGateway.saveStock(next);

      // Record before/after audit events for stockInitial or unit price changes on existing items
      if (Array.isArray(prev) && prev.length > 0 && Array.isArray(next) && next.length > 0) {
        const prevMap = new Map<string, any>();
        for (const item of prev) {
          const key = String(item?.ref || item?.id || '').trim().toUpperCase();
          if (key) prevMap.set(key, item);
        }
        for (const nextItem of next) {
          const key = String(nextItem?.ref || nextItem?.id || '').trim().toUpperCase();
          if (!key) continue;
          const prevItem = prevMap.get(key);
          if (!prevItem) continue;
          const prevInit = Number(prevItem.stockInitial ?? 0);
          const nextInit = Number(nextItem.stockInitial ?? 0);
          const prevPrice = Number(prevItem.prix ?? prevItem.prix_unitaire ?? (prevItem as any).prixUnitaire ?? 0);
          const nextPrice = Number(nextItem.prix ?? nextItem.prix_unitaire ?? (nextItem as any).prixUnitaire ?? 0);
          if (prevInit !== nextInit || prevPrice !== nextPrice) {
            const actionType =
              prevInit !== nextInit && prevPrice !== nextPrice
                ? 'STOCK_INITIAL_AND_PRICE_CHANGED'
                : prevInit !== nextInit
                ? 'STOCK_INITIAL_CHANGED'
                : 'STOCK_PRICE_CHANGED';
            get().appendAuditEvent({
              actionType,
              entityType: 'STOCK_ITEM',
              entityId: String(nextItem.ref || nextItem.id || key),
              before: {
                ref: prevItem.ref,
                designation: prevItem.designation,
                stockInitial: prevInit,
                prix_unitaire: prevPrice,
              },
              after: {
                ref: nextItem.ref,
                designation: nextItem.designation,
                stockInitial: nextInit,
                prix_unitaire: nextPrice,
              },
              meta: {
                summary: `Modification article ${nextItem.ref || key}: stockInitial (${prevInit} ➔ ${nextInit}), prix (${prevPrice} ➔ ${nextPrice})`,
              },
            });
          }
        }
      }
    },

    setDesignations: (updater) => {
      const next = resolveUpdate(updater, get().designations);
      set({ designations: next });
      DataGateway.saveDesignations(next);
    },

    // ==========================================
    // 2. Machines Slice
    // ==========================================
    families: machinesInit.families,
    templates: machinesInit.templates,
    blueprints: machinesInit.blueprints,
    machines: machinesInit.machines,
    generalSystemTypes: machinesInit.generalSystemTypes,
    zones: machinesInit.zones,
    machineElementsLedger: machinesInit.machineElementsLedger,

    setFamilies: (updater) => {
      const next = resolveUpdate(updater, get().families);
      set({ families: next });
      DataGateway.saveFamilies(next);
    },

    setTemplates: (updater) => {
      const next = resolveUpdate(updater, get().templates);
      set({ templates: next });
      DataGateway.saveTemplates(next);
    },

    setBlueprints: (updater) => {
      const next = resolveUpdate(updater, get().blueprints);
      set({ blueprints: next });
      DataGateway.saveBlueprints(next);
    },

    setMachines: (updater) => {
      const prev = get().machines || [];
      const next = normalizeMachinesList(resolveUpdate(updater, prev));
      trackRemovedEntityIds('machines', prev, next);
      set({ machines: next });
      DataGateway.saveMachines(next);

      // Record before/after audit events for machine archive/restore lifecycle transitions
      if (Array.isArray(prev) && prev.length > 0 && Array.isArray(next) && next.length > 0) {
        const prevMap = new Map<string, any>();
        for (const m of prev) {
          const key = String(m?.id_machine_registered || m?.id_machine || m?.id || '').trim().toUpperCase();
          if (key) prevMap.set(key, m);
        }
        for (const nextM of next) {
          const key = String(nextM?.id_machine_registered || nextM?.id_machine || nextM?.id || '').trim().toUpperCase();
          if (!key) continue;
          const prevM = prevMap.get(key);
          if (!prevM) continue;
          const wasArchived = isMachineArchivedState(prevM);
          const isNowArchived = isMachineArchivedState(nextM);
          if (wasArchived !== isNowArchived) {
            get().appendAuditEvent({
              actionType: isNowArchived ? 'MACHINE_ARCHIVED' : 'MACHINE_RESTORED',
              entityType: 'MACHINE',
              entityId: String(nextM.id_machine_registered || nextM.id_machine || key),
              before: {
                id_machine_registered: prevM.id_machine_registered,
                status: prevM.status || (wasArchived ? 'ARCHIVEE' : 'EN_SERVICE'),
                lifecycle_status: prevM.lifecycle_status || (wasArchived ? 'ARCHIVED' : 'ACTIVE'),
                is_active: !wasArchived,
              },
              after: {
                id_machine_registered: nextM.id_machine_registered,
                status: nextM.status || (isNowArchived ? 'ARCHIVEE' : 'EN_SERVICE'),
                lifecycle_status: nextM.lifecycle_status || (isNowArchived ? 'ARCHIVED' : 'ACTIVE'),
                is_active: !isNowArchived,
                archive_reason: (nextM as any).archive_reason || undefined,
              },
              meta: {
                summary: isNowArchived
                  ? `Archivage machine ${nextM.id_machine_registered || key}`
                  : `Restauration machine ${nextM.id_machine_registered || key}`,
              },
            });
          }
        }
      }
    },

    setGeneralSystemTypes: (updater) => {
      const next = resolveUpdate(updater, get().generalSystemTypes || []);
      set({ generalSystemTypes: next });
      DataGateway.saveGeneralSystemTypes(next);
    },

    handleAddGeneralSystemType: (payload) => {
      const rawName = String(payload?.name || '').trim();
      if (!rawName) return null;
      const rawCode = String(payload?.code || rawName.substring(0, 3))
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8) || 'SYS';
      const id = String(payload?.id || `SYS-${rawCode}`).toUpperCase();
      const current = get().generalSystemTypes || [];
      const existing = current.find(
        (t) =>
          String(t.id).toUpperCase() === id ||
          String(t.code).toUpperCase() === rawCode ||
          String(t.name).toLowerCase() === rawName.toLowerCase()
      );
      if (existing) {
        if (!existing.is_active) {
          get().handleToggleGeneralSystemType(existing.id, true);
        }
        return existing;
      }
      const created = {
        id,
        code: rawCode,
        name: rawName,
        is_active: true,
      };
      const next = [...current, created];
      set({ generalSystemTypes: next });
      DataGateway.saveGeneralSystemTypes(next);
      return created;
    },

    handleToggleGeneralSystemType: (id, isActive) => {
      const current = get().generalSystemTypes || [];
      const next = current.map((t) =>
        String(t.id) === String(id)
          ? { ...t, is_active: isActive !== undefined ? Boolean(isActive) : !t.is_active }
          : t
      );
      set({ generalSystemTypes: next });
      DataGateway.saveGeneralSystemTypes(next);
    },

    setZones: (updater) => {
      const prev = get().zones;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('zones', prev, next);
      set({ zones: next });
      DataGateway.saveZones(next);
    },

    setMachineElementsLedger: (updater) => {
      const prev = get().machineElementsLedger;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('machineElementsLedger', prev, next);
      set({ machineElementsLedger: next });
      DataGateway.saveMachineBom(next);
    },

    addMachineElement: (element) => {
      const targetMachineId = element?.id_machine_registered || element?.id_machine;
      const targetMachine = (get().machines || []).find(
        (m) => m.id_machine_registered === targetMachineId
      );
      if (targetMachine && String(targetMachine.asset_class || '').toUpperCase() === 'SYSTEM_GENERAL') {
        Logger.warn('[useGmaoStore] Blocked adding production BOM element to SYSTEM_GENERAL asset:', targetMachine.id_machine_registered);
        return;
      }
      const id = element.id || `BOM-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const next = [{ ...element, id }, ...get().machineElementsLedger];
      set({ machineElementsLedger: next });
      DataGateway.saveMachineBom(next);
    },

    updateMachineElement: (id, updates) => {
      const next = get().machineElementsLedger.map((item) => (item.id === id ? { ...item, ...updates } : item));
      set({ machineElementsLedger: next });
      DataGateway.saveMachineBom(next);
    },

    deleteMachineElement: (id) => {
      recordLocalDeletedIds('machineElementsLedger', [id]);
      const next = get().machineElementsLedger.filter((item) => item.id !== id);
      set({ machineElementsLedger: next });
      DataGateway.saveMachineBom(next);
    },

    duplicateBOMToTwins: (sourceMachineId, targetMachineIds = []) => {
      const prev = get().machineElementsLedger;
      const machinesList = get().machines || [];
      const prodTargetIds = (targetMachineIds || []).filter((targetId) => {
        const m = machinesList.find((item) => item.id_machine_registered === targetId);
        return !m || String(m.asset_class || '').toUpperCase() !== 'SYSTEM_GENERAL';
      });
      const sourceElements = prev.filter((e) => e.id_machine_registered === sourceMachineId);
      if (sourceElements.length === 0 || prodTargetIds.length === 0) {
        return;
      }
      const cloned: any[] = [];
      prodTargetIds.forEach((targetId) => {
        sourceElements.forEach((src) => {
          const exists = prev.some((e) => e.id_machine_registered === targetId && e.ref_element === src.ref_element);
          if (!exists) {
            cloned.push({
              ...src,
              id: `BOM-${targetId}-${Math.random().toString(36).substring(2, 7)}`,
              id_machine_registered: targetId,
              date_installation: new Date().toISOString().split('T')[0],
              heures_actuelles: 0,
            });
          }
        });
      });
      const updated = [...cloned, ...prev];
      set({ machineElementsLedger: updated });
      DataGateway.saveMachineBom(updated);
    },

    isValidMachineFamilies: (arr) => {
      if (!Array.isArray(arr)) return false;
      return arr.every((item) => item && (item.id_family || item.id) && (item.libelle || item.nom || item.name));
    },

    isValidMachineTemplates: (arr) => {
      if (!Array.isArray(arr)) return false;
      return arr.every((item) => item && (item.id_templates || item.id) && (item.id_family || item.libelle || item.family));
    },

    // ==========================================
    // 3. Warehouse Slice
    // ==========================================
    warehouseItems: warehouseInit.warehouseItems,
    entrepotComponents: warehouseInit.entrepotComponents,
    compGroups: warehouseInit.compGroups,
    compFamilies: warehouseInit.compFamilies,
    compTemplates: warehouseInit.compTemplates,
    partGroups: warehouseInit.partGroups,
    partTypes: warehouseInit.partTypes,
    partDesignations: warehouseInit.partDesignations,

    setWarehouseItems: (updater) => {
      const prev = get().warehouseItems;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('warehouseItems', prev, next);
      set({ warehouseItems: next });
      DataGateway.saveWarehouseItems(next);
    },

    setEntrepotComponents: (updater) => {
      const next = resolveUpdate(updater, get().entrepotComponents);
      set({ entrepotComponents: next });
      DataGateway.saveEntrepotComponents(next);
    },

    setCompGroups: (updater) => {
      const next = resolveUpdate(updater, get().compGroups);
      set({ compGroups: next });
      DataGateway.saveCompGroups(next);
    },

    setCompFamilies: (updater) => {
      const next = resolveUpdate(updater, get().compFamilies);
      set({ compFamilies: next });
      DataGateway.saveCompFamilies(next);
    },

    setCompTemplates: (updater) => {
      const next = resolveUpdate(updater, get().compTemplates);
      set({ compTemplates: next });
      DataGateway.saveCompTemplates(next);
    },

    setPartGroups: (updater) => {
      const next = resolveUpdate(updater, get().partGroups);
      set({ partGroups: next });
      DataGateway.savePartGroups(next);
    },

    setPartTypes: (updater) => {
      const next = resolveUpdate(updater, get().partTypes);
      set({ partTypes: next });
      DataGateway.savePartTypes(next);
    },

    setPartDesignations: (updater) => {
      const next = resolveUpdate(updater, get().partDesignations);
      set({ partDesignations: next });
      DataGateway.savePartDesignations(next);
    },

    // ==========================================
    // 4. Personnel & Users Slice
    // ==========================================
    users: personnelInit.users,
    technicians: personnelInit.technicians,
    operations: personnelInit.operations,

    setUsers: (updater) => {
      const prev = get().users;
      const next = resolveUpdate(updater, prev).filter(isRealPersonnelUser);
      trackRemovedEntityIds('users', prev, next);
      set({
        users: next,
        technicians: deriveTechnicians(next),
        operations: deriveOperations(next),
      });
      DataGateway.saveUsers(next);
    },

    setTechnicians: (updater) => {
      const currentTechs = get().technicians;
      const next = resolveUpdate(updater, currentTechs);
      const cleanNext = next.map((t: any) => ({
        ...t,
        id_technician: t.id_technician || t.id,
        role: t.role || 'Technicien',
      }));
      trackRemovedEntityIds('technicians', currentTechs, cleanNext);
      set({ technicians: cleanNext });
      DataGateway.saveTechnicians(cleanNext);
    },

    setOperations: (updater) => {
      const currentOps = get().operations;
      const next = resolveUpdate(updater, currentOps);
      const cleanNext = next.map((o: any) => ({
        ...o,
        id_operation: o.id_operation || o.id,
        role: o.role || 'Opérateur',
      }));
      trackRemovedEntityIds('operations', currentOps, cleanNext);
      set({ operations: cleanNext });
      DataGateway.saveOperations(cleanNext);
    },

    // ==========================================
    // 5. Movements Slice & V3/V4 Sortie Demands
    // ==========================================
    mouvements: movementsInit.mouvements,
    sortieDemands: movementsInit.sortieDemands,
    replenishmentOrders: movementsInit.replenishmentOrders,

    setMouvements: (updater) => {
      const prev = get().mouvements;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('mouvements', prev, next);
      set({ mouvements: next });
      DataGateway.saveMovements(next);
      movementRepository.bulkReplace(next as any[], buildInitialStockMapFromList(get().rawStock));
    },

    setSortieDemands: (updater) => {
      const prev = get().sortieDemands || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('sortieDemands', prev, next);
      set({ sortieDemands: next });
      DataGateway.saveSortieDemands(next);
    },

    handleSubmitSortieDemand: (demandPayload) => {
      if (!demandPayload || typeof demandPayload !== 'object') return null;
      const nowIso = new Date().toISOString();
      const rawItems = Array.isArray(demandPayload.items) ? demandPayload.items : [];
      const cleanItems = rawItems
        .map((it: any) => ({
          source: String(it?.source || 'STOCK_PDR'),
          ref: String(it?.ref || it?.code_article || '').trim(),
          designation: String(it?.designation || it?.ref || 'PDR').trim(),
          quantite: Math.max(1, Number(it?.quantite ?? it?.qty ?? 1) || 1),
          unit: String(it?.unit || it?.unite || 'pcs'),
          emplacement: String(it?.emplacement || ''),
        }))
        .filter((it: any) => Boolean(it.ref));

      if (cleanItems.length === 0) return null;

      const currentDemands = get().sortieDemands || [];
      const existingIdx = demandPayload.id
        ? currentDemands.findIndex((d: any) => String(d.id) === String(demandPayload.id))
        : -1;

      const codeBonTech = String(
        demandPayload.code_bon_tech || demandPayload.code_bon || `BS-TECH-${Date.now().toString().slice(-4)}`
      ).trim();

      const record = {
        ...(existingIdx >= 0 ? currentDemands[existingIdx] : {}),
        id:
          existingIdx >= 0
            ? currentDemands[existingIdx].id
            : String(demandPayload.id || `DEM-SRT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`),
        code_bon_tech: codeBonTech,
        code_bon_magasin: '',
        num_commande: String(demandPayload.num_commande || 'SORTIE_TERRAIN').trim(),
        date: String(demandPayload.date || nowIso.split('T')[0]),
        heure: String(demandPayload.heure || '10:00'),
        type: String(demandPayload.type || 'Sortie Interne'),
        action_id: String(demandPayload.action_id || 'CORRECTIVE'),
        usage_type: String(demandPayload.usage_type || 'technician'),
        id_zone: String(demandPayload.id_zone || ''),
        id_machine_registered: String(demandPayload.id_machine_registered || ''),
        technicien: String(demandPayload.technicien || demandPayload.submitted_by_name || 'Technicien'),
        id_technician: String(demandPayload.id_technician || demandPayload.submitted_by_id || ''),
        operation: String(demandPayload.operation || ''),
        id_operation: String(demandPayload.id_operation || ''),
        commentaire: String(demandPayload.commentaire || '').trim(),
        items: cleanItems,
        validation_status: 'PENDING_VALIDATION',
        discrepancy_status: 'NONE',
        submitted_by_id: String(demandPayload.submitted_by_id || demandPayload.id_technician || 'tech'),
        submitted_by_name: String(demandPayload.submitted_by_name || demandPayload.technicien || 'Technicien'),
        submitted_at: nowIso,
        stock_deducted: false,
      };

      const nextDemands =
        existingIdx >= 0
          ? currentDemands.map((d: any, i: number) => (i === existingIdx ? record : d))
          : [record, ...currentDemands];

      set({ sortieDemands: nextDemands });
      DataGateway.saveSortieDemands(nextDemands);
      return record;
    },

    handleReviewSortieDemandValidation: (
      demandId,
      decisionData = { decision: 'APPROVED' },
      onAddMouvement = null
    ) => {
      const currentDemands = get().sortieDemands || [];
      const existing = currentDemands.find((d: any) => String(d.id) === String(demandId));
      if (!existing) return null;

      if (existing.validation_status === 'APPROVED' && existing.stock_deducted === true) {
        Logger.warn(
          `[useGmaoStore] handleReviewSortieDemandValidation blocked: demand ${demandId} is already approved and stock deducted.`
        );
        return null;
      }

      const decision = String(decisionData.decision || 'APPROVED').trim().toUpperCase();
      const nowIso = new Date().toISOString();

      if (decision === 'APPROVED') {
        const rawItems = Array.isArray(decisionData.approvedItems)
          ? decisionData.approvedItems
          : Array.isArray(existing.items)
          ? existing.items
          : [];
        const approvedItems = rawItems
          .map((it: any) => ({
            source: String(it?.source || 'STOCK_PDR'),
            ref: String(it?.ref || it?.code_article || '').trim(),
            designation: String(it?.designation || it?.ref || 'PDR').trim(),
            quantite: Math.max(0, Number(it?.quantite ?? it?.qty ?? 0) || 0),
            unit: String(it?.unit || it?.unite || 'pcs'),
            emplacement: String(it?.emplacement || ''),
          }))
          .filter((it: any) => Boolean(it.ref && it.quantite > 0));

        if (approvedItems.length === 0) return null;

        const mergeTargetId = String(decisionData.mergeWithMovementId || '').trim();
        const currentMouvements = get().mouvements || [];
        const existingMvtToMerge = mergeTargetId
          ? currentMouvements.find(
              (m: any) =>
                String(m.id || '') === mergeTargetId || String(m.code_bon || '') === mergeTargetId
            )
          : null;

        const finalCodeBonMagasin = String(
          existingMvtToMerge?.code_bon ||
            decisionData.code_bon_magasin ||
            existing.code_bon_tech ||
            `BS-MAG-${Date.now().toString().slice(-4)}`
        ).trim();

        const isBonMismatch =
          finalCodeBonMagasin.toUpperCase() !== String(existing.code_bon_tech || '').trim().toUpperCase();

        const emittedIds: string[] = [];

        if (existingMvtToMerge) {
          // V4 Interactive Merge: link technician's demand (e.g. BS-104) to existing storekeeper movement (e.g. BS-109) WITHOUT double-deducting stock
          const nextMouvements = currentMouvements.map((m: any) => {
            if (
              String(m.id || '') === String(existingMvtToMerge.id || '') &&
              String(m.code_bon || '') === String(existingMvtToMerge.code_bon || '')
            ) {
              return {
                ...m,
                num_bon_saisi_par_tech: existing.code_bon_tech,
                merged_demand_id: existing.id,
                technicien: m.technicien || existing.technicien,
                id_machine_registered: m.id_machine_registered || existing.id_machine_registered,
              };
            }
            return m;
          });
          set({ mouvements: nextMouvements });
          DataGateway.saveMovements(nextMouvements);
          emittedIds.push(String(existingMvtToMerge.id || existingMvtToMerge.code_bon));
        } else if ((decisionData as any).skipStockDeduction !== true) {
          // Normal Approval: emit official movement(s) once and deduct stock
          const stockList = get().rawStock || [];
          const movementsToRecord: any[] = [];

          approvedItems.forEach((item: any, idx: number) => {
            if (isPartAlreadyDeductedByStoreBon(currentMouvements, finalCodeBonMagasin, item.ref)) {
              return;
            }
            const stockMatch = stockList.find(
              (s: any) =>
                String(s.ref || '').trim().toUpperCase() === String(item.ref || '').trim().toUpperCase()
            );
            const stockAvant = Number(stockMatch?.stockActuel ?? stockMatch?.stockInitial ?? 0);
            const seuilMin = Number(stockMatch?.seuil ?? 5);
            const qteNum = Number(item.quantite) || 1;
            const stockApres = stockAvant - qteNum;
            const mvtId = `MVT-SRT-${Date.now()}-${idx}-${Math.floor(100 + Math.random() * 900)}`;
            emittedIds.push(mvtId);

            movementsToRecord.push({
              id: mvtId,
              code_bon: finalCodeBonMagasin,
              num_bon_saisi_par_tech: existing.code_bon_tech,
              merged_demand_id: existing.id,
              source_demand_id: existing.id,
              num_commande: existing.num_commande || 'SORTIE_TERRAIN',
              date: existing.date || nowIso.split('T')[0],
              heure: existing.heure || '10:00',
              timestamp: nowIso,
              ref: item.ref,
              code_article: item.ref,
              designation: item.designation || stockMatch?.designation || item.ref,
              quantite: qteNum,
              stock_avant: stockAvant,
              stock_apres: stockApres,
              seuil_min: seuilMin,
              unit: item.unit || 'pcs',
              unite: item.unit || 'pcs',
              source_category: item.source || 'STOCK_PDR',
              destination_category: 'MACHINE',
              type: existing.type || 'Sortie Interne',
              action_id: existing.action_id || 'CORRECTIVE',
              usage_type: existing.usage_type || 'technician',
              id_zone: existing.id_zone || '',
              id_machine_registered: existing.id_machine_registered || '',
              machine: existing.id_machine_registered || '',
              technicien: existing.technicien || existing.submitted_by_name || 'Technicien',
              id_technician: existing.id_technician || existing.submitted_by_id || '',
              operation: existing.operation || '',
              id_operation: existing.id_operation || '',
              demandeur: existing.technicien || existing.submitted_by_name || 'Technicien',
              commentaire:
                existing.commentaire ||
                `Sortie PDR validée (Bon tech: ${existing.code_bon_tech} → Bon magasin: ${finalCodeBonMagasin})`,
            });
          });

          if (typeof onAddMouvement === 'function') {
            movementsToRecord.forEach((mvt) => {
              try {
                onAddMouvement(mvt);
              } catch (err) {
                Logger.warn('[useGmaoStore] onAddMouvement error in sortie demand approval:', err);
              }
            });
          } else {
            movementsToRecord.forEach((mvt) => {
              try {
                movementRepository.add(mvt);
              } catch (err) {
                Logger.warn('[useGmaoStore] movementRepository.add error in sortie demand approval:', err);
              }
            });
            get().setMouvements((prev) => [...movementsToRecord, ...prev]);
          }
        }

        let updatedDemand: any = null;
        const nextDemands = currentDemands.map((d: any) => {
          if (String(d.id) === String(demandId)) {
            updatedDemand = {
              ...d,
              items: approvedItems,
              code_bon_magasin: finalCodeBonMagasin,
              validation_status: 'APPROVED',
              discrepancy_status: isBonMismatch || existingMvtToMerge ? 'BON_MISMATCH_MERGED' : 'NONE',
              ...(existingMvtToMerge
                ? { merged_with_movement_id: String(existingMvtToMerge.id || existingMvtToMerge.code_bon) }
                : {}),
              validated_by_id: decisionData.validated_by_id || 'admin',
              validated_by_name: decisionData.validated_by_name || 'Magasinier / Admin',
              validated_at: nowIso,
              validation_note: String(decisionData.validation_note ?? d.validation_note ?? '').trim(),
              stock_deducted: true,
              emitted_movement_ids: emittedIds,
            };
            return updatedDemand;
          }
          return d;
        });

        set({ sortieDemands: nextDemands });
        DataGateway.saveSortieDemands(nextDemands);
        get().appendAuditEvent({
          actorId: decisionData.validated_by_id,
          actorName: decisionData.validated_by_name,
          actionType: 'VALIDATION_APPROVED',
          entityType: 'SORTIE_DEMAND',
          entityId: String(demandId),
          before: { validation_status: existing.validation_status, stock_deducted: existing.stock_deducted },
          after: {
            validation_status: 'APPROVED',
            stock_deducted: true,
            code_bon_magasin: finalCodeBonMagasin,
          },
          meta: { summary: `Validation demande sortie PDR ${demandId} (${finalCodeBonMagasin})` },
        });
        return updatedDemand;
      }

      if (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') {
        let updatedDemand: any = null;
        const nextDemands = currentDemands.map((d: any) => {
          if (String(d.id) === String(demandId)) {
            updatedDemand = {
              ...d,
              ...(decisionData.code_bon_magasin
                ? { code_bon_magasin: String(decisionData.code_bon_magasin).trim() }
                : {}),
              validation_status: decision,
              discrepancy_status: 'DISCREPANCY_FLAGGED',
              validated_by_id: decisionData.validated_by_id || 'admin',
              validated_by_name: decisionData.validated_by_name || 'Magasinier / Admin',
              validated_at: nowIso,
              validation_note: String(decisionData.validation_note || '').trim(),
              stock_deducted: false,
            };
            return updatedDemand;
          }
          return d;
        });

        set({ sortieDemands: nextDemands });
        DataGateway.saveSortieDemands(nextDemands);
        get().appendAuditEvent({
          actorId: decisionData.validated_by_id,
          actorName: decisionData.validated_by_name,
          actionType: decision === 'REJECTED' ? 'VALIDATION_REJECTED' : 'VALIDATION_NEEDS_CLARIFICATION',
          entityType: 'SORTIE_DEMAND',
          entityId: String(demandId),
          before: { validation_status: existing.validation_status },
          after: { validation_status: decision, validation_note: decisionData.validation_note || '' },
          meta: { summary: `Décision ${decision} sur demande sortie PDR ${demandId}` },
        });
        return updatedDemand;
      }

      return null;
    },

    // ==========================================
    // 5b. Replenishment & Purchase Orders Slice (المحور 4)
    // ==========================================
    setReplenishmentOrders: (updater) => {
      const prev = get().replenishmentOrders || [];
      const next = resolveUpdate(updater, prev);
      DataGateway.saveReplenishmentOrders(next);
      set({ replenishmentOrders: next });
    },

    handleCreateReplenishmentOrder: async (orderData: Partial<IReplenishmentOrder>) => {
      const current = get().replenishmentOrders || [];
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const seq = String(current.length + 1).padStart(4, '0');
      const numCmd = `BC-${dateStr.replace(/-/g, '')}-${seq}`;

      const newOrder: IReplenishmentOrder = {
        id: `PO-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        numero_commande: numCmd,
        date_creation: dateStr,
        fournisseur: orderData.fournisseur || 'Fournisseur Général',
        statut: 'BROUILLON',
        cree_par: orderData.cree_par || 'Magasinier',
        items: orderData.items || [],
        montant_total_estime: orderData.montant_total_estime || 0,
        notes: orderData.notes || '',
        ...orderData,
      };

      const next = [newOrder, ...current];
      DataGateway.saveReplenishmentOrders(next);
      set({ replenishmentOrders: next });
      get().appendAuditEvent({
        actorName: newOrder.cree_par,
        actionType: 'PO_CREATED',
        entityType: 'REPLENISHMENT_ORDER',
        entityId: newOrder.id,
        before: null,
        after: {
          numero_commande: newOrder.numero_commande,
          fournisseur: newOrder.fournisseur,
          statut: newOrder.statut,
          itemsCount: newOrder.items.length,
          montant_total_estime: newOrder.montant_total_estime,
        },
        meta: { summary: `Création commande ${newOrder.numero_commande} (${newOrder.fournisseur})` },
      });
      return newOrder;
    },

    handleUpdateReplenishmentOrderStatus: async (orderId: string, status: ReplenishmentOrderStatus, metadata?: any) => {
      const current = get().replenishmentOrders || [];
      const prevOrder = current.find((o) => o.id === orderId);
      if (!prevOrder || prevOrder.statut === 'RECU_CONFORME' || prevOrder.statut === 'ANNULE') {
        return;
      }
      const next = current.map((order) => {
        if (order.id !== orderId) return order;
        return {
          ...order,
          statut: status,
          date_commande: status === 'COMMANDE' ? new Date().toISOString().split('T')[0] : order.date_commande,
          ...metadata,
        };
      });
      DataGateway.saveReplenishmentOrders(next);
      set({ replenishmentOrders: next });
      get().appendAuditEvent({
        actionType: status === 'ANNULE' ? 'PO_CANCELLED' : 'PO_STATUS_CHANGED',
        entityType: 'REPLENISHMENT_ORDER',
        entityId: orderId,
        before: { statut: prevOrder.statut },
        after: { statut: status },
        meta: { summary: `Commande ${prevOrder.numero_commande}: ${prevOrder.statut} ➔ ${status}` },
      });
    },

    handleReceiveReplenishmentOrder: async (
      orderId: string,
      receivedItems: { ref: string; quantite_recue: number }[],
      numBonReception?: string,
      recepteur?: string
    ) => {
      const currentOrders = get().replenishmentOrders || [];
      const order = currentOrders.find((o) => o.id === orderId);
      // Guard: prevent double-receipt on terminal orders (RECU_CONFORME or ANNULE)
      if (!order || order.statut === 'RECU_CONFORME' || order.statut === 'ANNULE') return;

      const dateStr = new Date().toISOString().split('T')[0];
      const newMovements: any[] = [];
      const beforeItemsSnapshot = order.items.map((it) => ({
        ref: it.ref,
        quantite_demandee: it.quantite_demandee,
        quantite_recue: it.quantite_recue || 0,
      }));

      let allFullyReceived = true;
      const updatedItems = order.items.map((it) => {
        const match = receivedItems.find((r) => r.ref === it.ref);
        const remainingNeeded = Math.max(0, it.quantite_demandee - (it.quantite_recue || 0));
        const rawAddedQty = match ? Math.max(0, Number(match.quantite_recue) || 0) : 0;
        const addedQty = Math.min(rawAddedQty, remainingNeeded);
        const totalRecue = (it.quantite_recue || 0) + addedQty;
        if (totalRecue < it.quantite_demandee) {
          allFullyReceived = false;
        }

        if (addedQty > 0) {
          newMovements.push({
            id: `MVT-REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            date: dateStr,
            type: 'Entrée',
            action_id: 'reapprovisionnement',
            ref: it.ref,
            quantite: addedQty,
            prix_unitaire: it.prix_unitaire_estime,
            source: 'REAPPRO_COMMANDE',
            code_bon: numBonReception || order.numero_commande,
            observation: `Réception Commande ${order.numero_commande} (${order.fournisseur || 'Fournisseur'})`,
            technicien: recepteur || 'Magasinier',
          });
        }

        return {
          ...it,
          quantite_recue: totalRecue,
        };
      });

      const nextStatus: ReplenishmentOrderStatus = allFullyReceived ? 'RECU_CONFORME' : 'RECEPTION_PARTIELLE';

      const nextOrders = currentOrders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          statut: nextStatus,
          date_reception: dateStr,
          numero_bon_reception: numBonReception || o.numero_bon_reception,
          items: updatedItems,
        };
      });

      DataGateway.saveReplenishmentOrders(nextOrders);

      if (newMovements.length > 0) {
        const currentMouvements = get().mouvements || [];
        const nextMouvements = [...newMovements, ...currentMouvements];
        DataGateway.saveMouvements(nextMouvements);
        movementRepository.bulkReplace(
          nextMouvements as any[],
          buildInitialStockMapFromList(get().rawStock)
        );
        set({
          mouvements: nextMouvements,
          replenishmentOrders: nextOrders,
        });
      } else {
        set({ replenishmentOrders: nextOrders });
      }

      get().appendAuditEvent({
        actorName: recepteur || 'Magasinier',
        actionType: 'PO_RECEIVED',
        entityType: 'REPLENISHMENT_ORDER',
        entityId: orderId,
        before: { statut: order.statut, items: beforeItemsSnapshot },
        after: {
          statut: nextStatus,
          numero_bon_reception: numBonReception || order.numero_bon_reception,
          items: updatedItems.map((it) => ({
            ref: it.ref,
            quantite_demandee: it.quantite_demandee,
            quantite_recue: it.quantite_recue,
          })),
        },
        meta: {
          summary: `Réception commande ${order.numero_commande} ➔ ${nextStatus} (${newMovements.length} entrée(s))`,
        },
      });
    },

    // ==========================================
    // 6. Preventive Slice
    // ==========================================
    preventiveTasks: preventiveInit.tasks,
    preventiveActions: preventiveInit.actions,
    preventiveGuides: preventiveInit.guides,
    preventivePlans: preventiveInit.plans,
    preventiveExecutions: preventiveInit.executions,
    meterReadings: preventiveInit.meterReadings,

    setMeterReadings: (updater) => {
      const next = resolveUpdate(updater, get().meterReadings);
      set({ meterReadings: next });
      DataGateway.saveMeterReadings(next);
    },

    handleRecordMeterReading: (payload: {
      machineId: string;
      valeur: number;
      unite?: MeterUnit | string;
      date_releve?: string;
      releve_par?: string;
      source?: IMeterReading['source'] | any;
      commentaire?: string;
    }) => {
      const result = MeterService.recordReading(
        { ...payload, unite: payload.unite as MeterUnit | undefined },
        get().meterReadings,
        get().machines,
        get().preventiveTasks
      );

      set({
        meterReadings: result.updatedReadings,
        machines: result.updatedMachines,
        preventiveTasks: result.updatedTasks,
      });

      DataGateway.saveMeterReadings(result.updatedReadings);
      DataGateway.saveMachines(result.updatedMachines);
      DataGateway.savePreventiveTasks(result.updatedTasks);

      return result.newReading;
    },

    handleBatchRecordMeterReadings: (readingsPayload: Array<{
      machineId: string;
      valeur: number;
      unite?: MeterUnit;
      date_releve?: string;
      releve_par?: string;
      source?: IMeterReading['source'];
      commentaire?: string;
    }>) => {
      let currentReadings = get().meterReadings;
      let currentMachines = get().machines;
      let currentTasks = get().preventiveTasks;
      const recorded: IMeterReading[] = [];

      for (const item of readingsPayload) {
        if (!item || !item.machineId || isNaN(Number(item.valeur))) continue;
        const res = MeterService.recordReading(
          item,
          currentReadings,
          currentMachines,
          currentTasks
        );
        currentReadings = res.updatedReadings;
        currentMachines = res.updatedMachines;
        currentTasks = res.updatedTasks;
        recorded.push(res.newReading);
      }

      set({
        meterReadings: currentReadings,
        machines: currentMachines,
        preventiveTasks: currentTasks,
      });

      DataGateway.saveMeterReadings(currentReadings);
      DataGateway.saveMachines(currentMachines);
      DataGateway.savePreventiveTasks(currentTasks);

      return recorded;
    },

    setPreventiveTasks: (updater) => {
      const prev = get().preventiveTasks;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventiveTasks', prev, next);
      set({ preventiveTasks: next });
      DataGateway.savePreventiveTasks(next);
    },

    setPreventiveActions: (updater) => {
      const next = resolveUpdate(updater, get().preventiveActions);
      set({ preventiveActions: next });
      DataGateway.savePreventiveActions(next);
    },

    setPreventiveGuides: (updater) => {
      const next = resolveUpdate(updater, get().preventiveGuides);
      set({ preventiveGuides: next });
      DataGateway.savePreventiveGuides(next);
    },

    setPreventivePlans: (updater) => {
      const prev = get().preventivePlans;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventivePlans', prev, next);
      set({ preventivePlans: next });
      DataGateway.savePreventivePlans(next);
    },

    setPreventiveExecutions: (updater) => {
      const prev = get().preventiveExecutions;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventiveExecutions', prev, next);
      set({ preventiveExecutions: next });
      DataGateway.savePreventiveExecutions(next);
    },

    handleUpdateTask: (id, updates) => {
      const next = get().preventiveTasks.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
      );
      set({ preventiveTasks: next });
      DataGateway.savePreventiveTasks(next);
    },

    handleDeleteTask: (id) => {
      recordLocalDeletedIds('preventiveTasks', [id]);
      const next = get().preventiveTasks.filter((t) => t.id !== id);
      set({ preventiveTasks: next });
      DataGateway.savePreventiveTasks(next);
    },

    handleUpdateTaskCounter: (id, newCounterValue) => {
      const targetTask = get().preventiveTasks.find((t) => String(t.id) === String(id));
      const targetMachine = String(targetTask?.id_machine || '').trim().toUpperCase();
      const numericVal = Number(newCounterValue || 0);
      if (!targetMachine || numericVal <= 0) return;

      get().handleRecordMeterReading({
        machineId: targetMachine,
        valeur: numericVal,
        source: 'MANUEL',
        commentaire: `Saisie compteur via tâche ${targetTask?.code || id}`,
      });
    },

    handleMarkTaskDone: (id, validationData) => {
      const currentTasks = get().preventiveTasks;
      const currentExecs = get().preventiveExecutions;
      PreventiveService.saveTasks(currentTasks);
      PreventiveService.saveExecutions(currentExecs);

      const targetTask = currentTasks.find((t) => String(t.id) === String(id));
      const targetMachine = String(targetTask?.id_machine || '').trim().toUpperCase();
      const releveNum = Number(
        validationData?.compteur_releve ?? validationData?.dernier_releve ?? 0
      );

      const updated = PreventiveService.markTaskAsDone(id, validationData);
      const executions = PreventiveService.getExecutions();
      set({ preventiveTasks: updated, preventiveExecutions: executions });
      DataGateway.savePreventiveTasks(updated);
      DataGateway.savePreventiveExecutions(executions);

      // Emit official stock movement(s) when an Admin/Supervisor executes a task directly (APPROVED) with sparesUsed
      const newestExec = Array.isArray(executions) ? executions[0] : null;
      const existingLinkedDiForNewest =
        newestExec?.id
          ? (get().correctiveInterventions || []).find(
              (ci: any) =>
                String(ci?.source_preventive_execution_id || '').trim() ===
                String(newestExec.id).trim()
            )
          : null;
      const resolvedNewestMachineCode = String(
        newestExec?.machineCode || targetMachine || validationData?.machineCode || ''
      ).trim();

      if (
        newestExec &&
        String(newestExec.taskId) === String(id) &&
        newestExec.validation_status === 'APPROVED' &&
        Boolean(validationData?.createFollowUpDi) &&
        !newestExec.generated_di_id &&
        !existingLinkedDiForNewest &&
        resolvedNewestMachineCode
      ) {
        const anomText = String(
          validationData?.followUpDiAnomalie ||
            newestExec.followUpDiAnomalie ||
            newestExec.notes ||
            `Anomalie détectée lors du contrôle préventif (${newestExec.organe || newestExec.taskCode || 'PM'})`
        ).trim();
        const createdDi = get().handleAddDemandeIntervention({
          code_machine: resolvedNewestMachineCode,
          nom_machine: newestExec.machineName || resolvedNewestMachineCode,
          anomalie: anomText,
          travail_a_faire: `Diagnostic et remise en état suite à anomalie préventive sur ${
            newestExec.organe || resolvedNewestMachineCode
          } (Réf PM: ${newestExec.id})`,
          priorite: validationData?.followUpDiPriorite || 'HAUTE',
          urgence: validationData?.followUpDiPriorite || 'Haute',
          id_composant: newestExec.id_composant || '',
          nom_composant: newestExec.organe || '',
          demandeur: newestExec.executorName || 'Superviseur Maintenance',
          source: 'AUTO_DI_PREVENTIF',
          source_preventive_execution_id: newestExec.id,
          source_preventive_task_id: newestExec.taskId || '',
        });
        if (createdDi?.id) {
          newestExec.generated_di_id = String(createdDi.id);
          set({ preventiveExecutions: executions });
          PreventiveService.saveExecutions(executions);
          DataGateway.savePreventiveExecutions(executions);
        }
      } else if (newestExec && existingLinkedDiForNewest?.id && !newestExec.generated_di_id) {
        newestExec.generated_di_id = String(existingLinkedDiForNewest.id);
        set({ preventiveExecutions: executions });
        PreventiveService.saveExecutions(executions);
        DataGateway.savePreventiveExecutions(executions);
      }

      if (
        newestExec &&
        String(newestExec.taskId) === String(id) &&
        newestExec.validation_status === 'APPROVED' &&
        Array.isArray(newestExec.sparesUsed) &&
        newestExec.sparesUsed.length > 0 &&
        validationData?.skipStockDeduction !== true
      ) {
        const currentMouvements = get().mouvements || [];
        const stockList = get().rawStock || [];
        const stockLookup = new Map<string, any>();
        stockList.forEach((s: any) => {
          const r = String(s.ref || s.code_article || '').trim().toUpperCase();
          if (r) stockLookup.set(r, s);
        });

        const prevSparesCost = Number(newestExec.sparesCost || 0);
        let resolvedSparesCost = 0;
        const enrichedSpares: any[] = [];
        const movementsToRecord: any[] = [];
        newestExec.sparesUsed.forEach((pdr: any, idx: number) => {
          const ref = String(pdr?.ref || '').trim();
          const qty = Number(pdr?.qty ?? pdr?.quantite ?? 0);
          if (!ref || !(qty > 0)) return;
          const stockMatch = stockLookup.get(ref.toUpperCase());
          const explicitPrice = Number(pdr?.unitPrice ?? pdr?.prix_unitaire ?? 0);
          const unitPrice =
            explicitPrice > 0
              ? explicitPrice
              : Number(stockMatch?.prix ?? stockMatch?.prix_unitaire ?? 0) || 0;
          resolvedSparesCost += qty * unitPrice;
          enrichedSpares.push({
            ...pdr,
            ref,
            designation: pdr.designation || stockMatch?.designation || ref,
            qty,
            unit: pdr.unit || stockMatch?.unite || 'pcs',
            unitPrice,
          });
          if (isPartAlreadyDeductedByStoreBon(currentMouvements, newestExec.num_bon_saisi_par_tech, ref)) {
            return;
          }
          const suffix = newestExec.sparesUsed.length > 1 ? `-${idx + 1}` : '';
          movementsToRecord.push({
            id: `MVT-PRV-${Date.now()}-${idx}-${Math.floor(100 + Math.random() * 900)}`,
            source_execution_id: String(newestExec.id || ''),
            source_task_id: String(newestExec.taskId || id || ''),
            code_bon: newestExec.num_bon_saisi_par_tech || `BS-PRV-${String(newestExec.id).slice(-6)}${suffix}`,
            num_commande: newestExec.taskCode || 'PREVENTIF',
            date: newestExec.executedAt || new Date().toISOString().split('T')[0],
            heure: '10:00',
            ref,
            code_article: ref,
            designation: pdr.designation || stockMatch?.designation || ref,
            quantite: qty,
            prix_unitaire: unitPrice,
            unit: pdr.unit || stockMatch?.unite || 'pcs',
            unite: pdr.unit || stockMatch?.unite || 'pcs',
            type: 'Sortie Interne',
            action_id: 'PREVENTIVE',
            usage_type: 'technician',
            id_machine_registered: newestExec.machineCode || '',
            machine: newestExec.machineCode || '',
            ...(newestExec.id_composant ? { id_composant: newestExec.id_composant } : {}),
            ...(newestExec.id_part ? { id_part: newestExec.id_part } : {}),
            technicien: newestExec.executorName || 'Technicien',
            demandeur: newestExec.executorName || 'Technicien GMAO',
            commentaire: `Consommation directe sur maintenance préventive ${newestExec.organe || ''} (${newestExec.machineCode || ''})`,
          });
        });

        const execLaborCost =
          (Number(newestExec.durationMinutes || 15) / 60) * Number(newestExec.laborRate ?? 35);
        newestExec.sparesUsed = enrichedSpares;
        newestExec.sparesProposed = enrichedSpares;
        newestExec.sparesCost = Number(resolvedSparesCost.toFixed(2));
        newestExec.totalCost = Number((resolvedSparesCost + execLaborCost).toFixed(2));
        newestExec.emitted_movement_ids = movementsToRecord.map((m) => m.id);
        newestExec.stock_deducted = movementsToRecord.length > 0;
        set({ preventiveExecutions: executions });
        PreventiveService.saveExecutions(executions);
        DataGateway.savePreventiveExecutions(executions);

        const costDelta = Number((newestExec.sparesCost - prevSparesCost).toFixed(2));
        if (costDelta > 0) {
          const nextTasksWithCost = (get().preventiveTasks || []).map((t: any) =>
            String(t.id) === String(id)
              ? { ...t, cout_cumule: Number((Number(t.cout_cumule || 0) + costDelta).toFixed(2)) }
              : t
          );
          set({ preventiveTasks: nextTasksWithCost });
          PreventiveService.saveTasks(nextTasksWithCost);
          DataGateway.savePreventiveTasks(nextTasksWithCost);
        }

        if (movementsToRecord.length > 0) {
          if (typeof validationData?.onAddMouvement === 'function') {
            movementsToRecord.forEach((mvt) => {
              try {
                validationData.onAddMouvement(mvt);
              } catch (err) {
                Logger.warn('[useGmaoStore] onAddMouvement error in direct preventive execution:', err);
              }
            });
          } else {
            movementsToRecord.forEach((mvt) => {
              try {
                movementRepository.add(mvt);
              } catch (err) {
                Logger.warn('[useGmaoStore] movementRepository.add error in direct preventive execution:', err);
              }
            });
            get().setMouvements((prev) => [...movementsToRecord, ...prev]);
          }
        }
      }

      if (targetMachine && releveNum > 0) {
        const dateRealisation =
          validationData?.date_realisation ||
          validationData?.date_execution ||
          new Date().toISOString().split('T')[0];
        get().handleRecordMeterReading({
          machineId: targetMachine,
          valeur: releveNum,
          date_releve: dateRealisation,
          releve_par:
            validationData?.technicien ||
            validationData?.technicien_realisateur ||
            'Technicien GMAO',
          source: 'PREVENTIVE_EXECUTION',
          commentaire: `Relevé enregistré lors de l'exécution préventive (${targetTask?.code || id})`,
        });
      }
    },

    handleReviewPreventiveExecutionValidation: (executionId, decisionData = { decision: 'APPROVED' }, onAddMouvement = null) => {
      const currentExecs = get().preventiveExecutions || [];
      const existingExec = currentExecs.find((e: any) => String(e.id) === String(executionId));
      if (!existingExec) return null;

      const decision = String(decisionData.decision || 'APPROVED').trim().toUpperCase();
      const nowIso = new Date().toISOString();

      if (existingExec.validation_status === 'APPROVED') {
        Logger.warn(`[useGmaoStore] handleReviewPreventiveExecutionValidation blocked: execution ${executionId} is already approved.`);
        return null;
      }

      if (decision === 'APPROVED') {
        const rawSpares = Array.isArray((decisionData as any).approvedSpares)
          ? (decisionData as any).approvedSpares
          : Array.isArray(decisionData.sparesUsed)
          ? decisionData.sparesUsed
          : Array.isArray(decisionData.sparesProposed)
          ? decisionData.sparesProposed
          : Array.isArray(existingExec.sparesProposed)
          ? existingExec.sparesProposed
          : Array.isArray(existingExec.sparesUsed)
          ? existingExec.sparesUsed
          : [];

        const stockList = get().rawStock || [];
        const stockLookup = new Map<string, any>();
        stockList.forEach((s: any) => {
          const r = String(s.ref || s.code_article || '').trim().toUpperCase();
          if (r) stockLookup.set(r, s);
        });

        const approvedSpares = rawSpares
          .map((s: any) => {
            const ref = String(s?.ref || s?.reference || s?.code || '').trim();
            const qty = Number(s?.qty ?? s?.quantite ?? 0);
            const stockMatch = ref ? stockLookup.get(ref.toUpperCase()) : null;
            const explicitPrice = Number(s?.unitPrice ?? s?.prix_unitaire ?? s?.prix ?? 0);
            const unitPrice =
              explicitPrice > 0
                ? explicitPrice
                : Number(stockMatch?.prix ?? stockMatch?.prix_unitaire ?? 0) || 0;
            return {
              ref,
              designation: String(s?.designation || stockMatch?.designation || ref || 'PDR').trim(),
              qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
              unit: String(s?.unit || s?.unite || stockMatch?.unite || 'pcs'),
              unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
            };
          })
          .filter((s: any) => Boolean(s.ref && s.qty > 0));

        const sparesCost = approvedSpares.reduce(
          (sum: number, item: any) => sum + item.qty * (item.unitPrice || 0),
          0
        );
        const durationMinutes = Number(existingExec.durationMinutes || 15);
        const laborRate = Number(existingExec.laborRate ?? 35);
        const laborCost = (durationMinutes / 60) * laborRate;
        const totalCost = Number((sparesCost + laborCost).toFixed(2));

        // Optional Auto-DI on Preventive Anomaly (Idea 1: Boucle fermée Préventif -> Correctif)
        const existingLinkedDi = (get().correctiveInterventions || []).find(
          (ci: any) =>
            String(ci?.source_preventive_execution_id || '').trim() ===
            String(existingExec.id).trim()
        );
        let generatedDiId = String(
          existingExec.generated_di_id || existingLinkedDi?.id || ''
        ).trim();
        const linkedTask = (get().preventiveTasks || []).find(
          (t: any) => String(t.id) === String(existingExec.taskId)
        );
        const resolvedMachineCode = String(
          existingExec.machineCode ||
            existingExec.id_machine ||
            linkedTask?.id_machine ||
            ''
        ).trim();

        if (
          Boolean((decisionData as any).createFollowUpDi) &&
          !generatedDiId &&
          resolvedMachineCode
        ) {
          const anomText = String(
            (decisionData as any).followUpDiAnomalie ||
              existingExec.followUpDiAnomalie ||
              existingExec.notes ||
              `Anomalie détectée lors du contrôle préventif (${existingExec.organe || existingExec.taskCode || 'PM'})`
          ).trim();
          const createdDi = get().handleAddDemandeIntervention({
            code_machine: resolvedMachineCode,
            nom_machine: existingExec.machineName || resolvedMachineCode,
            anomalie: anomText,
            travail_a_faire: `Diagnostic et remise en état suite à anomalie préventive sur ${
              existingExec.organe || resolvedMachineCode
            } (Réf PM: ${existingExec.id})`,
            priorite: (decisionData as any).followUpDiPriorite || existingExec.followUpDiPriorite || 'HAUTE',
            urgence: (decisionData as any).followUpDiPriorite || existingExec.followUpDiPriorite || 'Haute',
            id_composant: existingExec.id_composant || '',
            nom_composant: existingExec.organe || '',
            demandeur:
              decisionData.validated_by_name ||
              (decisionData as any).reviewer_name ||
              existingExec.executorName ||
              'Superviseur Maintenance',
            source: 'AUTO_DI_PREVENTIF',
            source_preventive_execution_id: existingExec.id,
            source_preventive_task_id: existingExec.taskId || '',
          });
          if (createdDi?.id) {
            generatedDiId = createdDi.id;
          }
        }

        let updatedExec: any = null;
        const nextExecs = currentExecs.map((e: any) => {
          if (String(e.id) === String(executionId)) {
            updatedExec = {
              ...e,
              ...(decisionData.notes !== undefined ? { notes: String(decisionData.notes).trim() } : {}),
              ...(generatedDiId ? { generated_di_id: generatedDiId } : {}),
              sparesUsed: approvedSpares,
              sparesProposed: approvedSpares,
              sparesCost: Number(sparesCost.toFixed(2)),
              totalCost,
              status: 'DONE',
              validation_status: 'APPROVED',
              validated_by_id: decisionData.validated_by_id || 'admin',
              validated_by_name: decisionData.validated_by_name || 'Administrateur',
              validated_at: nowIso,
              validation_note: String(
                decisionData.validation_note ?? e.validation_note ?? ''
              ).trim(),
              stock_deducted: true,
            };
            return updatedExec;
          }
          return e;
        });

        const nextTasks = (get().preventiveTasks || []).map((t: any) => {
          if (String(t.id) === String(existingExec.taskId)) {
            const execDateYMD = String(existingExec.executedAt || nowIso).slice(0, 10);
            const previousDue =
              existingExec.scheduledDueDate ||
              t.prochaine_echeance ||
              t.nextDueDate ||
              t.date_prevue ||
              t.date_planifiee ||
              t.dueDate ||
              '';
            const nextDue = computeNextDueDate(execDateYMD, t.frequence || existingExec.frequence);
            const prevCost = Number(t.cout_cumule || 0);
            const nextPlanning =
              t.planning &&
              typeof t.planning === 'object' &&
              existingExec.periodWeek &&
              t.planning[existingExec.periodWeek]
                ? { ...t.planning, [existingExec.periodWeek]: 'DONE' }
                : t.planning;
            return {
              ...t,
              etat: 'Fait',
              validation_status: 'APPROVED',
              last_pending_execution_id: '',
              pieces_proposees: approvedSpares,
              validated_by_id: decisionData.validated_by_id || 'admin',
              validated_by_name: decisionData.validated_by_name || 'Administrateur',
              validated_at: nowIso,
              validation_note: String(
                decisionData.validation_note ?? t.validation_note ?? ''
              ).trim(),
              derniere_realisation: execDateYMD,
              lastExecutedAt: execDateYMD,
              ...(previousDue ? { echeance_precedente: previousDue } : {}),
              prochaine_echeance: nextDue,
              nextDueDate: nextDue,
              cout_cumule: Number((prevCost + totalCost).toFixed(2)),
              planning: nextPlanning,
              updated_at: nowIso,
            };
          }
          return t;
        });

        set({ preventiveExecutions: nextExecs, preventiveTasks: nextTasks });
        PreventiveService.saveExecutions(nextExecs);
        PreventiveService.saveTasks(nextTasks);
        DataGateway.savePreventiveExecutions(nextExecs);
        DataGateway.savePreventiveTasks(nextTasks);

        const currentMouvements = get().mouvements || [];
        const movementsToRecord: any[] = [];
        const emittedIds: string[] = [];
        if (approvedSpares.length > 0 && (decisionData as any).skipStockDeduction !== true) {
          approvedSpares.forEach((pdr: any, idx: number) => {
            if (isPartAlreadyDeductedByStoreBon(currentMouvements, existingExec.num_bon_saisi_par_tech, pdr.ref)) {
              return;
            }
            const suffix = approvedSpares.length > 1 ? `-${idx + 1}` : '';
            const mvtId = `MVT-PRV-${Date.now()}-${idx}-${Math.floor(100 + Math.random() * 900)}`;
            emittedIds.push(mvtId);
            movementsToRecord.push({
              id: mvtId,
              source_execution_id: String(existingExec.id || ''),
              source_task_id: String(existingExec.taskId || ''),
              code_bon: existingExec.num_bon_saisi_par_tech || `BS-PRV-${String(existingExec.id).slice(-6)}${suffix}`,
              num_bon_saisi_par_tech: existingExec.num_bon_saisi_par_tech || '',
              num_commande: existingExec.taskCode || 'PREVENTIF',
              date: existingExec.executedAt || nowIso.split('T')[0],
              heure: '10:00',
              ref: pdr.ref,
              code_article: pdr.ref,
              designation: pdr.designation || pdr.ref,
              quantite: Number(pdr.qty),
              prix_unitaire: Number(pdr.unitPrice) || 0,
              unit: pdr.unit || 'pcs',
              unite: pdr.unit || 'pcs',
              type: 'Sortie Interne',
              action_id: 'PREVENTIVE',
              usage_type: 'technician',
              id_machine_registered: existingExec.machineCode || '',
              machine: existingExec.machineCode || '',
              ...(existingExec.id_composant ? { id_composant: existingExec.id_composant } : {}),
              ...(existingExec.id_part ? { id_part: existingExec.id_part } : {}),
              technicien: existingExec.executorName || 'Technicien',
              demandeur: existingExec.executorName || 'Technicien GMAO',
              commentaire: `Consommation validée sur maintenance préventive ${existingExec.organe || ''} (${existingExec.machineCode || ''})`,
            });
          });
        }

        if (emittedIds.length > 0 && updatedExec) {
          updatedExec.emitted_movement_ids = emittedIds;
        }

        if (movementsToRecord.length > 0) {
            if (typeof onAddMouvement === 'function') {
              movementsToRecord.forEach((mvt) => {
                try {
                  onAddMouvement(mvt);
                } catch (err) {
                  Logger.warn('[useGmaoStore] onAddMouvement error in preventive approval:', err);
                }
              });
            } else {
              movementsToRecord.forEach((mvt) => {
                try {
                  movementRepository.add(mvt);
                } catch (err) {
                  Logger.warn('[useGmaoStore] movementRepository.add error in preventive approval:', err);
                }
              });
              get().setMouvements((prev) => [...movementsToRecord, ...prev]);
          }
        }

        get().appendAuditEvent({
          actorId: decisionData.validated_by_id,
          actorName: decisionData.validated_by_name,
          actionType: 'VALIDATION_APPROVED',
          entityType: 'PREVENTIVE_EXECUTION',
          entityId: String(executionId),
          before: { validation_status: existingExec.validation_status, status: existingExec.status },
          after: {
            validation_status: 'APPROVED',
            status: 'DONE',
            totalCost,
            sparesCount: approvedSpares.length,
          },
          meta: { summary: `Validation exécution préventive ${executionId}` },
        });

        return updatedExec;
      }

      if (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') {
        let updatedExec: any = null;
        const nextExecs = currentExecs.map((e: any) => {
          if (String(e.id) === String(executionId)) {
            updatedExec = {
              ...e,
              ...(Array.isArray(decisionData.sparesProposed)
                ? { sparesProposed: decisionData.sparesProposed }
                : {}),
              status: decision === 'REJECTED' ? 'SKIPPED' : 'PARTIAL',
              validation_status: decision,
              validation_note: String(decisionData.validation_note || '').trim(),
              validated_by_id: decisionData.validated_by_id || 'admin',
              validated_by_name: decisionData.validated_by_name || 'Administrateur',
              validated_at: nowIso,
              stock_deducted: false,
            };
            return updatedExec;
          }
          return e;
        });

        const nextTasks = (get().preventiveTasks || []).map((t: any) => {
          if (String(t.id) === String(existingExec.taskId)) {
            return {
              ...t,
              etat: decision === 'NEEDS_CLARIFICATION' ? 'À clarifier' : 'À faire',
              validation_status: decision,
              validation_note: String(decisionData.validation_note || '').trim(),
              validated_by_id: decisionData.validated_by_id || 'admin',
              validated_by_name: decisionData.validated_by_name || 'Administrateur',
              validated_at: nowIso,
              updated_at: nowIso,
            };
          }
          return t;
        });

        set({ preventiveExecutions: nextExecs, preventiveTasks: nextTasks });
        PreventiveService.saveExecutions(nextExecs);
        PreventiveService.saveTasks(nextTasks);
        DataGateway.savePreventiveExecutions(nextExecs);
        DataGateway.savePreventiveTasks(nextTasks);
        get().appendAuditEvent({
          actorId: decisionData.validated_by_id,
          actorName: decisionData.validated_by_name,
          actionType: decision === 'REJECTED' ? 'VALIDATION_REJECTED' : 'VALIDATION_NEEDS_CLARIFICATION',
          entityType: 'PREVENTIVE_EXECUTION',
          entityId: String(executionId),
          before: { validation_status: existingExec.validation_status },
          after: { validation_status: decision, validation_note: decisionData.validation_note || '' },
          meta: { summary: `Décision ${decision} sur exécution préventive ${executionId}` },
        });
        return updatedExec;
      }

      return null;
    },

    handleDeletePreventiveExecution: (id) => {
      recordLocalDeletedIds('preventiveExecutions', [id]);
      const currentExecs = get().preventiveExecutions || [];
      PreventiveService.saveExecutions(currentExecs);
      const targetExec = currentExecs.find(
        (ex: any) => String(ex.id) === String(id)
      );
      const updated = PreventiveService.deleteExecution(id);
      set({ preventiveExecutions: updated });
      DataGateway.savePreventiveExecutions(updated);

      if (targetExec) {
        const execIdStr = String(targetExec.id || id).trim();
        const shortExecId = execIdStr.slice(-6).toUpperCase();
        const emittedSet = new Set(
          Array.isArray(targetExec.emitted_movement_ids) ? targetExec.emitted_movement_ids : []
        );

        const linkedMovements = (get().mouvements || []).filter((m: any) => {
          if (!m) return false;
          if (String(m.source_execution_id || '').trim() === execIdStr) return true;
          if (emittedSet.has(String(m.id || ''))) return true;
          const codeBon = String(m.code_bon || '').trim().toUpperCase();
          return Boolean(
            shortExecId &&
              (codeBon === `BS-PRV-${shortExecId}` || codeBon.startsWith(`BS-PRV-${shortExecId}-`))
          );
        });

        if (linkedMovements.length > 0) {
          const removeIds = new Set(linkedMovements.map((m: any) => m.id));
          linkedMovements.forEach((m: any) => {
            try {
              movementRepository.remove(m);
            } catch (err) {
              Logger.warn('[useGmaoStore] Failed to remove movement on preventive execution delete:', err);
            }
          });
          get().setMouvements((prev) => (prev || []).filter((m: any) => !removeIds.has(m.id)));
        }

        const totalExecCost = Number(targetExec.totalCost || 0);
        if (targetExec.taskId && totalExecCost > 0 && targetExec.validation_status === 'APPROVED') {
          const nextTasks = (get().preventiveTasks || []).map((t: any) => {
            if (String(t.id) === String(targetExec.taskId)) {
              const prevCumul = Number(t.cout_cumule || 0);
              return {
                ...t,
                cout_cumule: Number(Math.max(0, prevCumul - totalExecCost).toFixed(2)),
                updated_at: new Date().toISOString(),
              };
            }
            return t;
          });
          set({ preventiveTasks: nextTasks });
          PreventiveService.saveTasks(nextTasks);
          DataGateway.savePreventiveTasks(nextTasks);
        }
      }
    },

    handleCreatePlanWithTasks: (planData, taskItems) => {
      PreventiveService.saveTasks(get().preventiveTasks);
      const result = PreventiveService.createPlanWithTasks(planData, taskItems);
      const nextPlans = [result.plan, ...get().preventivePlans];
      const nextTasks = [...result.tasks, ...get().preventiveTasks];
      set({
        preventivePlans: nextPlans,
        preventiveTasks: nextTasks,
      });
      DataGateway.savePreventivePlans(nextPlans);
      DataGateway.savePreventiveTasks(nextTasks);
      return result;
    },

    handleAddAction: (actionData) => {
      PreventiveService.saveActions(get().preventiveActions);
      const updated = PreventiveService.addAction(actionData);
      set({ preventiveActions: updated });
      DataGateway.savePreventiveActions(updated);
      return updated;
    },

    handleUpdateAction: (id, actionData) => {
      PreventiveService.saveActions(get().preventiveActions);
      const updated = PreventiveService.updateAction(id, actionData);
      set({ preventiveActions: updated });
      DataGateway.savePreventiveActions(updated);
      return updated;
    },

    handleDeleteAction: (id) => {
      PreventiveService.saveActions(get().preventiveActions);
      const updated = PreventiveService.deleteAction(id);
      set({ preventiveActions: updated });
      DataGateway.savePreventiveActions(updated);
      return updated;
    },

    handleAddGuide: (guideData) => {
      PreventiveService.saveGuides(get().preventiveGuides);
      const updated = PreventiveService.addGuide(guideData);
      set({ preventiveGuides: updated });
      DataGateway.savePreventiveGuides(updated);
      return updated;
    },

    handleUpdateGuide: (id, guideData) => {
      PreventiveService.saveGuides(get().preventiveGuides);
      const updated = PreventiveService.updateGuide(id, guideData);
      set({ preventiveGuides: updated });
      DataGateway.savePreventiveGuides(updated);
      return updated;
    },

    handleDeleteGuide: (id) => {
      PreventiveService.saveGuides(get().preventiveGuides);
      const updated = PreventiveService.deleteGuide(id);
      set({ preventiveGuides: updated });
      DataGateway.savePreventiveGuides(updated);
      return updated;
    },

    handleResetPreventiveToBaseline: async (ctx = {}) => {
      const { machines = [], skipConfirm = false } = ctx;
      const tasks = get().preventiveTasks;
      const impact = dataIntegrityService.previewClearImpact({
        action: 'RESET_PREVENTIVE_BASELINE',
        machines,
        preventiveTasks: tasks,
        correctiveInterventions: [],
      });

      const msg =
        `Réinitialiser le préventif au baseline seed (${initialTasks.length} tâches) ?\n` +
        `• Tâches actuelles: ${impact.preventiveCount}\n` +
        `• Machines enregistrées: ${impact.machineCount}\n` +
        (impact.warnings?.length ? `\n${impact.warnings.join('\n')}` : '') +
        `\n\nLes machines ne seront PAS modifiées.`;

      if (!skipConfirm && !(await confirmAction({ title: 'Réinitialiser le préventif', message: msg, variant: 'warning' }))) {
        return { cancelled: true };
      }

      set({
        preventiveTasks: initialTasks,
        preventiveActions: initialActions,
        preventiveGuides: initialGuides,
        preventivePlans: [],
      });
      DataGateway.savePreventiveTasks(initialTasks, { machines });
      DataGateway.savePreventiveActions(initialActions);
      DataGateway.savePreventiveGuides(initialGuides);
      DataGateway.savePreventivePlans([]);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preventive_tasks_updated', { detail: initialTasks }));
      }

      const orphans = dataIntegrityService.annotatePreventiveOrphans(initialTasks, machines).filter((t: any) => t._isOrphan);

      return {
        cancelled: false,
        restoredCount: initialTasks.length,
        orphanCountAfter: orphans.length,
      };
    },

    handleClearPreventiveForRealFactory: async (ctx = {}) => {
      const { machines = [], skipConfirm = false } = ctx;
      const tasks = get().preventiveTasks;
      const impact = dataIntegrityService.previewClearImpact({
        action: 'CLEAR_PREVENTIVE',
        machines,
        preventiveTasks: tasks,
        correctiveInterventions: [],
      });

      const msg =
        `Vider TOUTES les tâches préventives pour déploiement usine réelle ?\n` +
        `• ${impact.preventiveCount} tâche(s) seront supprimées.\n` +
        `• Les machines et le correctif ne seront PAS touchés.\n` +
        `\nAction irréversible (sauf backup).`;

      if (!skipConfirm && !(await confirmAction({ title: 'Vider le préventif', message: msg, variant: 'danger' }))) {
        return { cancelled: true };
      }

      DataGateway.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_TASKS);
      DataGateway.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_PLANS);
      DataGateway.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_EXECUTIONS);
      set({
        preventiveTasks: [],
        preventivePlans: [],
        preventiveExecutions: [],
      });
      DataGateway.savePreventiveTasks([]);
      DataGateway.savePreventivePlans([]);
      DataGateway.savePreventiveExecutions([]);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preventive_tasks_updated', { detail: [] }));
        window.dispatchEvent(new CustomEvent('preventive_executions_updated', { detail: [] }));
      }

      return { cancelled: false, clearedCount: impact.preventiveCount };
    },

    // ==========================================
    // 7. Sorties Externe Slice
    // ==========================================
    sortiesExterne: sortiesInit.sorties,

    setSortiesExterne: (updater) => {
      const prev = get().sortiesExterne;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('sortiesExterne', prev, next);
      set({ sortiesExterne: next });
      DataGateway.saveSortiesExterne(next);
    },

    handleAddSortieExterne: (sortieData) => {
      const currentSorties = get().sortiesExterne || [];
      const created = SortieExterneService.addSortie(sortieData, currentSorties);
      const nextSorties = [created, ...currentSorties.filter((s) => s.id !== created.id)];
      const nextWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems,
        created
      );
      const btSync = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions,
        created,
        nextSorties
      );
      set({
        sortiesExterne: nextSorties,
        warehouseItems: nextWarehouse,
        ...(btSync.changed ? { correctiveInterventions: btSync.nextInterventions } : {}),
      });
      DataGateway.saveSortiesExterne(nextSorties);
      DataGateway.saveWarehouseItems(nextWarehouse);
      if (btSync.changed) {
        DataGateway.saveCorrectiveInterventions(btSync.nextInterventions);
      }
      return created;
    },

    handleUpdateSortieExterne: (id, sortieData) => {
      const currentSorties = get().sortiesExterne || [];
      const updated = SortieExterneService.updateSortie(id, sortieData, currentSorties);
      if (!updated) return null;
      const nextSorties = currentSorties.map((s) => (s.id === id ? updated : s));
      const nextWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems,
        updated
      );
      const btSync = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions,
        updated,
        nextSorties
      );
      set({
        sortiesExterne: nextSorties,
        warehouseItems: nextWarehouse,
        ...(btSync.changed ? { correctiveInterventions: btSync.nextInterventions } : {}),
      });
      DataGateway.saveSortiesExterne(nextSorties);
      DataGateway.saveWarehouseItems(nextWarehouse);
      if (btSync.changed) {
        DataGateway.saveCorrectiveInterventions(btSync.nextInterventions);
      }
      return updated;
    },

    handleDeleteSortieExterne: (id) => {
      recordLocalDeletedIds('sortiesExterne', [id]);
      const nextSorties = get().sortiesExterne.filter((s) => s.id !== id);
      SortieExterneService.deleteSortie(id, get().sortiesExterne);
      set({ sortiesExterne: nextSorties });
      DataGateway.saveSortiesExterne(nextSorties);
    },

    handleMarkSortieReturned: (id, returnData) => {
      const currentSorties = get().sortiesExterne || [];
      const updated = SortieExterneService.markAsReturned(id, returnData, currentSorties);
      if (!updated) return null;
      const nextSorties = currentSorties.map((s) => (s.id === id ? updated : s));
      const nextWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems,
        updated
      );
      const btSync = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions,
        updated,
        nextSorties
      );
      set({
        sortiesExterne: nextSorties,
        warehouseItems: nextWarehouse,
        ...(btSync.changed ? { correctiveInterventions: btSync.nextInterventions } : {}),
      });
      DataGateway.saveSortiesExterne(nextSorties);
      DataGateway.saveWarehouseItems(nextWarehouse);
      if (btSync.changed) {
        DataGateway.saveCorrectiveInterventions(btSync.nextInterventions);
      }
      return updated;
    },

    handleMarkSortieMounted: (id, mountData) => {
      const currentSorties = get().sortiesExterne || [];
      const updated = SortieExterneService.markAsMounted(id, mountData, currentSorties);
      if (!updated) return null;
      const nextSorties = currentSorties.map((s) => (s.id === id ? updated : s));
      const nextWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems,
        updated
      );
      const btSync = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions,
        updated,
        nextSorties
      );
      set({
        sortiesExterne: nextSorties,
        warehouseItems: nextWarehouse,
        ...(btSync.changed ? { correctiveInterventions: btSync.nextInterventions } : {}),
      });
      DataGateway.saveSortiesExterne(nextSorties);
      DataGateway.saveWarehouseItems(nextWarehouse);
      if (btSync.changed) {
        DataGateway.saveCorrectiveInterventions(btSync.nextInterventions);
      }
      return updated;
    },

    handleClearSortiesForRealFactory: async () => {
      const count = get().sortiesExterne.length;
      if (count > 0 && !(await confirmAction({ title: 'Supprimer les sorties externes', message: `Supprimer les ${count} sorties externes pour usine réelle ?`, variant: 'danger' }))) {
        return { cancelled: true };
      }
      SortieExterneService.clearAll();
      set({ sortiesExterne: [] });
      DataGateway.saveSortiesExterne([]);
      return { cancelled: false, clearedCount: count };
    },

    handleResetSortiesToBaseline: () => {
      const baseline = SortieExterneService.resetToBaseline();
      set({ sortiesExterne: baseline });
      DataGateway.saveSortiesExterne(baseline);
      return { cancelled: false, count: baseline.length };
    },

    // ==========================================
    // 8. Corrective Nexus Slice
    // ==========================================
    correctiveInterventions: correctiveInit.interventions,
    workshopOrders: correctiveInit.workshopOrders,
    needRequests: correctiveInit.needRequests,
    correctiveActionsByPanne: correctiveInit.actionsByPanne,
    actionsByPanne: correctiveInit.actionsByPanne,
    correctivePanneCategories: correctiveInit.panneCategories,
    panneCategories: correctiveInit.panneCategories,
    correctiveTravauxAFaire: correctiveInit.travauxAFaire,
    travauxAFaire: correctiveInit.travauxAFaire,
    correctiveIntervenants: correctiveInit.intervenants,
    intervenants: correctiveInit.intervenants,
    activeLiveInterventionId: correctiveInit.activeLiveId,

    setCorrectiveInterventions: (updater) => {
      const prev = get().correctiveInterventions;
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('correctiveInterventions', prev, next);
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
    },

    setCorrectiveActionsByPanne: (updater) => {
      const current = get().correctiveActionsByPanne ?? (get() as any).actionsByPanne ?? {};
      const next = resolveUpdate(updater, current);
      set({ correctiveActionsByPanne: next, actionsByPanne: next } as any);
      DataGateway.saveCorrectiveActionsByPanne(next);
    },

    setCorrectivePanneCategories: (updater) => {
      const current = get().correctivePanneCategories ?? (get() as any).panneCategories ?? {};
      const next = resolveUpdate(updater, current);
      set({ correctivePanneCategories: next, panneCategories: next } as any);
      DataGateway.saveCorrectivePanneCategories(next);
    },

    setCorrectiveTravauxAFaire: (updater) => {
      const current = get().correctiveTravauxAFaire ?? (get() as any).travauxAFaire ?? [];
      const next = resolveUpdate(updater, current);
      set({ correctiveTravauxAFaire: next, travauxAFaire: next } as any);
      DataGateway.saveCorrectiveTravaux(next);
    },

    setCorrectiveIntervenants: (updater) => {
      const current = get().correctiveIntervenants ?? (get() as any).intervenants ?? [];
      const next = resolveUpdate(updater, current);
      set({ correctiveIntervenants: next, intervenants: next } as any);
      DataGateway.saveCorrectiveIntervenants(next);
    },

    setActiveLiveInterventionId: (id) => {
      set({ activeLiveInterventionId: id });
      try {
        if (id) {
          storageService.setItem(ACTIVE_LIVE_KEY, id);
        } else {
          storageService.removeItem(ACTIVE_LIVE_KEY);
        }
      } catch {}
    },

    handleGetCorrectiveActionsForPanne: (anomalie) => {
      const actionsByPanne = get().correctiveActionsByPanne ?? (get() as any).actionsByPanne;
      if (!anomalie || !actionsByPanne) return [];
      const anom = String(anomalie).trim();
      if (!anom) return [];
      if (actionsByPanne[anom]) return actionsByPanne[anom];
      const withUnder = anom.replace(/\s+/g, '_');
      if (actionsByPanne[withUnder]) return actionsByPanne[withUnder];
      const withSpace = anom.replace(/_/g, ' ');
      if (actionsByPanne[withSpace]) return actionsByPanne[withSpace];
      const lower = anom.toLowerCase().replace(/_/g, ' ').trim();
      for (const [key, acts] of Object.entries(actionsByPanne)) {
        if (key.toLowerCase().replace(/_/g, ' ').trim() === lower) return acts as string[];
      }
      for (const [key, acts] of Object.entries(actionsByPanne)) {
        const normKey = key.toLowerCase().replace(/_/g, ' ').trim();
        if (normKey.includes(lower) || lower.includes(normKey)) return acts as string[];
      }
      return [];
    },

    handleAddCorrectiveActionForPanne: (panneKey, actionText) => {
      if (!panneKey || !actionText) return;
      const cleanAction = String(actionText).trim();
      if (!cleanAction) return;
      const prev = get().correctiveActionsByPanne ?? (get() as any).actionsByPanne ?? {};
      const existing = prev[panneKey] || [];
      if (existing.includes(cleanAction)) return;
      const updated = { ...prev, [panneKey]: [...existing, cleanAction] };
      set({ correctiveActionsByPanne: updated, actionsByPanne: updated } as any);
      DataGateway.saveCorrectiveActionsByPanne(updated);
    },

    handleUpdateCorrectiveActionForPanne: (panneKey, actionIndex, newActionText) => {
      if (!panneKey || actionIndex < 0 || !newActionText) return;
      const cleanAction = String(newActionText).trim();
      if (!cleanAction) return;
      const prev = get().correctiveActionsByPanne ?? (get() as any).actionsByPanne ?? {};
      const existing = prev[panneKey] || [];
      if (actionIndex >= existing.length) return;
      const updatedList = existing.map((act: string, idx: number) => (idx === actionIndex ? cleanAction : act));
      const updated = { ...prev, [panneKey]: updatedList };
      set({ correctiveActionsByPanne: updated, actionsByPanne: updated } as any);
      DataGateway.saveCorrectiveActionsByPanne(updated);
    },

    handleDeleteCorrectiveActionForPanne: (panneKey, actionIndex) => {
      if (!panneKey || actionIndex < 0) return;
      const prev = get().correctiveActionsByPanne ?? (get() as any).actionsByPanne ?? {};
      const existing = prev[panneKey] || [];
      if (actionIndex >= existing.length) return;
      const updatedList = existing.filter((_: string, idx: number) => idx !== actionIndex);
      const updated = { ...prev };
      if (updatedList.length > 0) {
        updated[panneKey] = updatedList;
      } else {
        delete updated[panneKey];
      }
      set({ correctiveActionsByPanne: updated, actionsByPanne: updated } as any);
      DataGateway.saveCorrectiveActionsByPanne(updated);
    },

    handleAddPanne: (category, panneCode) => {
      if (!category || !panneCode) return;
      const cleanCat = String(category).trim().toUpperCase();
      const cleanCode = String(panneCode).trim();
      if (!cleanCode) return;
      const prev = get().correctivePanneCategories ?? (get() as any).panneCategories ?? {};
      const existingList = prev[cleanCat] || [];
      if (existingList.includes(cleanCode)) return;
      const updated = { ...prev, [cleanCat]: [...existingList, cleanCode] };
      set({ correctivePanneCategories: updated, panneCategories: updated } as any);
      DataGateway.saveCorrectivePanneCategories(updated);
    },

    handleUpdatePanne: (category, oldCode, newCode) => {
      if (!category || !oldCode || !newCode) return;
      const cleanCat = String(category).trim();
      const cleanOld = String(oldCode).trim();
      const cleanNew = String(newCode).trim();
      if (!cleanNew || cleanOld === cleanNew) return;

      const prevCats = get().correctivePanneCategories ?? (get() as any).panneCategories ?? {};
      const list = prevCats[cleanCat] || [];
      const updatedCats = {
        ...prevCats,
        [cleanCat]: list.map((item: string) => (item === cleanOld ? cleanNew : item)),
      };

      const prevActions = get().correctiveActionsByPanne ?? (get() as any).actionsByPanne ?? {};
      let updatedActions = prevActions;
      if (prevActions[cleanOld] && !prevActions[cleanNew]) {
        updatedActions = { ...prevActions, [cleanNew]: prevActions[cleanOld] };
        delete updatedActions[cleanOld];
      }

      set({
        correctivePanneCategories: updatedCats,
        panneCategories: updatedCats,
        correctiveActionsByPanne: updatedActions,
        actionsByPanne: updatedActions,
      } as any);
      DataGateway.saveCorrectivePanneCategories(updatedCats);
      DataGateway.saveCorrectiveActionsByPanne(updatedActions);
    },

    handleDeletePanne: (category, panneCode) => {
      if (!category || !panneCode) return;
      const cleanCat = String(category).trim();
      const cleanCode = String(panneCode).trim();

      const prevCats = get().correctivePanneCategories ?? (get() as any).panneCategories ?? {};
      const list = prevCats[cleanCat] || [];
      const updatedCats = {
        ...prevCats,
        [cleanCat]: list.filter((item: string) => item !== cleanCode),
      };

      const prevActions = get().correctiveActionsByPanne ?? (get() as any).actionsByPanne ?? {};
      const updatedActions = { ...prevActions };
      if (updatedActions[cleanCode]) {
        delete updatedActions[cleanCode];
      }

      set({
        correctivePanneCategories: updatedCats,
        panneCategories: updatedCats,
        correctiveActionsByPanne: updatedActions,
        actionsByPanne: updatedActions,
      } as any);
      DataGateway.saveCorrectivePanneCategories(updatedCats);
      DataGateway.saveCorrectiveActionsByPanne(updatedActions);
    },

    handleAddTravail: (travailText) => {
      if (!travailText) return;
      const cleanText = String(travailText).trim();
      if (!cleanText) return;
      const prev = get().correctiveTravauxAFaire ?? (get() as any).travauxAFaire ?? [];
      if (prev.includes(cleanText)) return;
      const updated = [...prev, cleanText];
      set({ correctiveTravauxAFaire: updated, travauxAFaire: updated } as any);
      DataGateway.saveCorrectiveTravaux(updated);
    },

    handleUpdateTravail: (oldText, newText) => {
      if (!oldText || !newText) return;
      const cleanOld = String(oldText).trim();
      const cleanNew = String(newText).trim();
      if (!cleanNew || cleanOld === cleanNew) return;
      const prev = get().correctiveTravauxAFaire ?? (get() as any).travauxAFaire ?? [];
      const updated = prev.map((item: string) => (item === cleanOld ? cleanNew : item));
      set({ correctiveTravauxAFaire: updated, travauxAFaire: updated } as any);
      DataGateway.saveCorrectiveTravaux(updated);
    },

    handleDeleteTravail: (travailText) => {
      if (!travailText) return;
      const cleanText = String(travailText).trim();
      const prev = get().correctiveTravauxAFaire ?? (get() as any).travauxAFaire ?? [];
      const updated = prev.filter((item: string) => item !== cleanText);
      set({ correctiveTravauxAFaire: updated, travauxAFaire: updated } as any);
      DataGateway.saveCorrectiveTravaux(updated);
    },

    handleResetCorrectiveActions: async () => {
      const baseline = await loadBaselineCorrectiveData();
      if (!baseline) return;
      const actionsByPanne = baseline.actionsByPanne || {};
      const panneCategories = baseline.panneCategories || {};
      const travauxAFaire = baseline.travauxAFaire || [];
      const intervenants = baseline.intervenants || [];

      set({
        correctiveActionsByPanne: actionsByPanne,
        actionsByPanne,
        correctivePanneCategories: panneCategories,
        panneCategories,
        correctiveTravauxAFaire: travauxAFaire,
        travauxAFaire,
        correctiveIntervenants: intervenants,
        intervenants,
      } as any);

      DataGateway.saveCorrectiveActionsByPanne(actionsByPanne);
      DataGateway.saveCorrectivePanneCategories(panneCategories);
      DataGateway.saveCorrectiveTravaux(travauxAFaire);
      DataGateway.saveCorrectiveIntervenants(intervenants);
    },

    handleForceSyncCorrectiveSeed: async () => {
      const baseline = await loadBaselineCorrectiveData();
      if (!baseline) return { interventionsCount: 0 };
      const items = baseline.interventions || [];
      set({ correctiveInterventions: items });
      DataGateway.saveCorrectiveInterventions(items);
      await get().handleResetCorrectiveActions();
      return {
        interventionsCount: items.length,
        pannesCount: Object.values(baseline.panneCategories || {}).reduce((acc: any, curr: any) => acc + (curr?.length || 0), 0),
        categoriesCount: Object.keys(baseline.panneCategories || {}).length,
        travauxCount: (baseline.travauxAFaire || []).length,
        actionsCount: Object.keys(baseline.actionsByPanne || {}).length,
        intervenantsCount: (baseline.intervenants || []).length,
      };
    },

    handleAddDemandeIntervention: (data) => {
      const now = new Date();
      const warehouseList = get().warehouseItems || [];
      const compId = String(data?.id_composant || '').trim();
      const partId = String(data?.id_part || '').trim();
      const matchedComp = compId
        ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === compId)
        : null;
      const matchedPart = partId
        ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === partId)
        : null;

      const newDi = new CorrectiveIntervention({
        ...data,
        id_composant: compId,
        nom_composant:
          data?.nom_composant ||
          matchedComp?.designation ||
          matchedComp?.nom_composant ||
          matchedComp?.nom ||
          '',
        id_part: partId,
        nom_part:
          data?.nom_part ||
          matchedPart?.designation_part ||
          matchedPart?.designation ||
          matchedPart?.nom ||
          '',
        demande_date: data.demande_date || now.toISOString().split('T')[0],
        demande_heure: data.demande_heure || now.toTimeString().slice(0, 5),
        statut: 'DEMANDE',
        action_fermee: 'NON',
        rapport_redige: 'NON',
      }).toJSON();
      const next = [newDi, ...get().correctiveInterventions];
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
      return newDi;
    },

    handleConvertToBt: (id, btDetails = {}) => {
      const target = get().correctiveInterventions.find((item) => item.id === id);
      if (!target) return null;

      const targetStatus = btDetails.statut || 'EN_COURS';
      const validation = WorkOrderStateMachine.validateTransition(target, targetStatus, {
        ...btDetails,
        num_bt: btDetails.num_bt || target.num_bt || 'BT-PENDING',
      });
      if (!validation.valid) {
        Logger.warn('[useGmaoStore] handleConvertToBt transition blocked:', validation.reason);
        return null;
      }

      let convertedItem: any = null;
      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          const num_bt = btDetails.num_bt || item.num_bt || `BT-${Math.floor(1000 + Math.random() * 9000)}`;
          convertedItem = new CorrectiveIntervention({
            ...item,
            ...btDetails,
            num_bt,
            statut: validation.toStatus,
            date_debut: btDetails.date_debut || item.date_debut || new Date().toISOString().split('T')[0],
            heure_debut: btDetails.heure_debut || item.heure_debut || new Date().toTimeString().slice(0, 5),
          }).toJSON();
          return convertedItem;
        }
        return item;
      });
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
      return convertedItem;
    },

    handleStartLiveIntervention: (id) => {
      const target = get().correctiveInterventions.find((item) => item.id === id);
      if (!target) return;

      const validation = WorkOrderStateMachine.validateTransition(target, 'EN_COURS');
      if (!validation.valid) {
        Logger.warn('[useGmaoStore] handleStartLiveIntervention transition blocked:', validation.reason);
        return;
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeNow = now.toTimeString().slice(0, 5);

      get().setActiveLiveInterventionId(id);
      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            statut: 'EN_COURS',
            date_debut: item.date_debut || today,
            heure_debut: item.heure_debut || timeNow,
          };
        }
        return item;
      });
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
    },

    handleSubmitInterventionForValidation: (id, submissionData = {}) => {
      const existing = get().correctiveInterventions.find((item) => item.id === id);
      if (!existing) return null;

      if (
        String(existing.action_fermee || '').trim().toUpperCase() === 'OUI' ||
        String(existing.statut || '').trim().toUpperCase() === 'CLOTURE'
      ) {
        Logger.warn(`[useGmaoStore] handleSubmitInterventionForValidation blocked: intervention ${id} is already closed.`);
        return null;
      }

      const hasAction = Boolean(
        String(
          submissionData.action_realisee ||
          submissionData.travail_a_faire ||
          existing.action_realisee ||
          existing.travail_a_faire ||
          existing.anomalie ||
          ''
        ).trim()
      );
      if (!hasAction) {
        Logger.warn('[useGmaoStore] handleSubmitInterventionForValidation blocked: missing work description.');
        return null;
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeNow = now.toTimeString().slice(0, 5);
      const stockList = get().rawStock || [];
      const stockLookup = new Map<string, any>();
      stockList.forEach((s: any) => {
        const r = String(s.ref || s.code_article || '').trim().toUpperCase();
        if (r) stockLookup.set(r, s);
      });
      const warehouseList = get().warehouseItems || [];

      let updated: any = null;
      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          const dFin = submissionData.date_fin_proposee || submissionData.date_fin || today;
          const hFin = submissionData.heure_fin_proposee || submissionData.heure_fin || timeNow;
          const dDebut =
            item.date_debut ||
            submissionData.date_debut ||
            item.date_demande ||
            item.demande_date ||
            item.date ||
            dFin ||
            today;
          const hDebut = item.heure_debut || submissionData.heure_debut || '08:00';
          const timeCalc = CorrectiveCalculationService.calculateWorkingTime(dDebut, hDebut, dFin, hFin);

          const rawProposed = Array.isArray(submissionData.pieces_proposees)
            ? submissionData.pieces_proposees
            : Array.isArray(submissionData.pieces_utilisees)
            ? submissionData.pieces_utilisees
            : Array.isArray(item.pieces_proposees) && !submissionData.pdr_ref
            ? item.pieces_proposees
            : [];

          const normalizedProposed: Array<{
            ref: string;
            designation: string;
            quantite: number;
            prix_unitaire: number;
            unite: string;
            marque?: string;
            etat_piece?: string;
          }> = [];

          rawProposed.forEach((p: any) => {
            const ref = String(p?.ref || p?.code_article || '').trim();
            const quantite = Number(p?.quantite ?? p?.qte ?? 0);
            if (!ref || !(quantite > 0)) return;
            const stockMatch = stockLookup.get(ref.toUpperCase());
            const existingIdx = normalizedProposed.findIndex(
              (np) => np.ref.toUpperCase() === ref.toUpperCase()
            );
            const prix =
              Number(p?.prix_unitaire ?? p?.prix ?? stockMatch?.prix ?? stockMatch?.prix_unitaire ?? 0) || 0;
            if (existingIdx >= 0) {
              normalizedProposed[existingIdx].quantite += quantite;
            } else {
              normalizedProposed.push({
                ref,
                designation: String(
                  p?.designation || stockMatch?.designation || stockMatch?.nom || ref
                ).trim(),
                quantite,
                prix_unitaire: prix,
                unite: String(p?.unite || stockMatch?.unite || 'Pièce'),
                marque: p?.marque || stockMatch?.marque || submissionData.marque || item.marque || '',
                etat_piece: p?.etat_piece || submissionData.etat_piece || item.etat_piece || 'Neuve',
              });
            }
          });

          const singleRef = String(submissionData.pdr_ref ?? '').trim();
          const singleQty = Number(submissionData.pdr_quantite ?? 0);
          if (singleRef && singleQty > 0) {
            const alreadyIncluded = normalizedProposed.some(
              (np) => np.ref.toUpperCase() === singleRef.toUpperCase()
            );
            if (!alreadyIncluded) {
              const stockMatch = stockLookup.get(singleRef.toUpperCase());
              normalizedProposed.push({
                ref: singleRef,
                designation: String(
                  submissionData.pdr_designation ||
                    stockMatch?.designation ||
                    stockMatch?.nom ||
                    singleRef
                ).trim(),
                quantite: singleQty,
                prix_unitaire:
                  Number(
                    submissionData.pdr_prix ??
                      stockMatch?.prix ??
                      stockMatch?.prix_unitaire ??
                      0
                  ) || 0,
                unite: String(submissionData.pdr_unite || stockMatch?.unite || 'Pièce'),
                marque: submissionData.marque || item.marque || stockMatch?.marque || '',
                etat_piece: submissionData.etat_piece || item.etat_piece || 'Neuve',
              });
            }
          }

          const resolvedCompId = String(submissionData.id_composant ?? item.id_composant ?? '').trim();
          const resolvedPartId = String(submissionData.id_part ?? item.id_part ?? '').trim();
          const matchedComp = resolvedCompId
            ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === resolvedCompId)
            : null;
          const matchedPart = resolvedPartId
            ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === resolvedPartId)
            : null;

          const prevValStatus = String(item.validation_status || '').trim().toUpperCase();
          const isResubmission =
            prevValStatus === 'NEEDS_CLARIFICATION' || prevValStatus === 'REJECTED';
          const resolvedNature = normalizeInterventionNature(
            submissionData.intervention_nature ?? item.intervention_nature
          );

          updated = new CorrectiveIntervention({
            ...item,
            travail_a_faire: submissionData.travail_a_faire ?? item.travail_a_faire ?? '',
            action_realisee: submissionData.action_realisee ?? submissionData.travail_a_faire ?? item.action_realisee ?? '',
            arret_machine: submissionData.arret_machine !== undefined ? Boolean(submissionData.arret_machine) : item.arret_machine,
            temps_arret: submissionData.temps_arret ?? item.temps_arret ?? '',
            marque: submissionData.marque ?? item.marque ?? '',
            etat_piece: submissionData.etat_piece ?? item.etat_piece ?? 'Neuve',
            ...(resolvedNature ? { intervention_nature: resolvedNature as any } : {}),
            ...(submissionData.id_sortie_atelier !== undefined
              ? { id_sortie_atelier: String(submissionData.id_sortie_atelier || '').trim() }
              : {}),
            ...(submissionData.code_sortie_atelier !== undefined
              ? { code_sortie_atelier: String(submissionData.code_sortie_atelier || '').trim() }
              : {}),
            ...(submissionData.cout_atelier !== undefined
              ? { cout_atelier: Number(submissionData.cout_atelier || 0) }
              : {}),
            ...(submissionData.nature_travail_atelier !== undefined
              ? { nature_travail_atelier: String(submissionData.nature_travail_atelier || '').trim() }
              : {}),
            ...(submissionData.prestataire_atelier !== undefined
              ? { prestataire_atelier: String(submissionData.prestataire_atelier || '').trim() }
              : {}),
            ...(isResubmission
              ? {
                  previous_validation_note: String(
                    item.validation_note || item.previous_validation_note || ''
                  ).trim(),
                  previous_validation_status: prevValStatus as any,
                  resubmitted_count: Number(item.resubmitted_count || 0) + 1,
                }
              : {}),
            id_composant: resolvedCompId,
            nom_composant:
              submissionData.nom_composant ||
              item.nom_composant ||
              matchedComp?.designation ||
              matchedComp?.nom_composant ||
              matchedComp?.nom ||
              '',
            id_part: resolvedPartId,
            nom_part:
              submissionData.nom_part ||
              item.nom_part ||
              matchedPart?.designation_part ||
              matchedPart?.designation ||
              matchedPart?.nom ||
              '',
            statut_composant_cloture:
              submissionData.statut_composant_cloture || item.statut_composant_cloture || 'En service',
            // Keep official consumed PDR fields empty until Admin validation
            pdr_ref: '',
            pdr_designation: '',
            pdr_quantite: 0,
            pieces_utilisees: [],
            // Store Technician Field Claim in proposal layer + immutable claim snapshot
            pieces_proposees: normalizedProposed,
            pieces_claimed: normalizedProposed,
            action_realisee_claimed: String(
              submissionData.action_realisee ?? item.action_realisee ?? ''
            ).trim(),
            validated_with_edits: false,
            num_bon_saisi_par_tech: String(
              submissionData.num_bon_saisi_par_tech ?? item.num_bon_saisi_par_tech ?? ''
            ).trim(),
            date_debut: dDebut,
            heure_debut: hDebut,
            date_fin_proposee: dFin,
            heure_fin_proposee: hFin,
            temps_intervention_propose:
              submissionData.temps_intervention_propose ||
              submissionData.temps_intervention_calc ||
              timeCalc.formatted,
            temps_intervention_mins_propose:
              submissionData.temps_intervention_mins_propose ??
              submissionData.temps_intervention_mins ??
              timeCalc.minutes,
            validation_status: 'PENDING_VALIDATION',
            validation_note: '',
            validated_by_id: '',
            validated_by_name: '',
            validated_at: '',
            stock_deducted: false,
            stock_effect: normalizedProposed.length > 0 ? 'RESERVED' : 'NONE',
            submitted_by_id:
              submissionData.submitted_by_id || item.submitted_by_id || item.technicien_matricule || '',
            submitted_by_name:
              submissionData.submitted_by_name || item.submitted_by_name || item.intervenant || 'Technicien',
            submitted_at: submissionData.submitted_at || now.toISOString(),
            action_fermee: 'NON',
            statut: item.statut === 'DEMANDE' ? 'EN_COURS' : item.statut || 'EN_COURS',
          }).toJSON();

          return updated;
        }
        return item;
      });

      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);

      if (get().activeLiveInterventionId === id) {
        get().setActiveLiveInterventionId(null);
      }

      return updated;
    },

    handleReviewInterventionValidation: (id, decisionData = {}, onAddMouvement = null) => {
      const existing = get().correctiveInterventions.find((item) => item.id === id);
      if (!existing) return null;

      const decision = String(decisionData.decision || 'APPROVED').trim().toUpperCase();

      if (decision === 'APPROVED') {
        const claimedPieces = Array.isArray(existing.pieces_claimed)
          ? existing.pieces_claimed
          : Array.isArray(existing.pieces_proposees)
          ? existing.pieces_proposees
          : [];

        const approvedPieces =
          decisionData.pieces_utilisees !== undefined
            ? decisionData.pieces_utilisees
            : decisionData.pieces_proposees !== undefined
            ? decisionData.pieces_proposees
            : Array.isArray(existing.pieces_proposees)
            ? existing.pieces_proposees
            : existing.pieces_utilisees || [];

        const serializePiecesSig = (list: any[]) =>
          (Array.isArray(list) ? list : [])
            .map((p: any) => ({
              ref: String(p?.ref || p?.code_article || '').trim().toUpperCase(),
              qty: Number(p?.quantite ?? p?.qty ?? p?.qte ?? 0),
            }))
            .filter((p) => Boolean(p.ref && p.qty > 0))
            .sort((a, b) => a.ref.localeCompare(b.ref))
            .map((p) => `${p.ref}:${p.qty}`)
            .join('|');

        const claimedAction = String(
          existing.action_realisee_claimed ?? existing.action_realisee ?? ''
        ).trim();
        const finalAction =
          decisionData.action_realisee !== undefined
            ? String(decisionData.action_realisee).trim()
            : claimedAction;

        const claimedNature = normalizeInterventionNature(existing.intervention_nature);
        const finalNature = normalizeInterventionNature(
          decisionData.intervention_nature ?? existing.intervention_nature
        );

        const hasPartsDiff = serializePiecesSig(claimedPieces) !== serializePiecesSig(approvedPieces);
        const hasActionDiff = Boolean(claimedAction && finalAction && claimedAction !== finalAction);
        const hasNatureDiff = Boolean(claimedNature && finalNature && claimedNature !== finalNature);
        const validatedWithEdits =
          Boolean(decisionData.validated_with_edits) ||
          hasPartsDiff ||
          hasActionDiff ||
          hasNatureDiff;

        const closedBt = get().handleClotureIntervention(
          id,
          {
            ...decisionData,
            _fromValidationReview: true,
            ...(finalNature ? { intervention_nature: finalNature } : {}),
            pieces_claimed: claimedPieces,
            action_realisee_claimed: claimedAction,
            validated_with_edits: validatedWithEdits,
            pieces_utilisees: approvedPieces,
            pieces_proposees: approvedPieces,
            date_fin: decisionData.date_fin || existing.date_fin_proposee,
            heure_fin: decisionData.heure_fin || existing.heure_fin_proposee,
            validation_status: 'APPROVED',
            validated_by_id: decisionData.validated_by_id || 'admin',
            validated_by_name: decisionData.validated_by_name || 'Administrateur',
            validated_at: decisionData.validated_at || new Date().toISOString(),
            validation_note:
              decisionData.validation_note !== undefined
                ? String(decisionData.validation_note).trim()
                : existing.validation_note || '',
          },
          onAddMouvement
        );
        if (closedBt) {
          get().appendAuditEvent({
            actorId: decisionData.validated_by_id,
            actorName: decisionData.validated_by_name,
            actionType: 'VALIDATION_APPROVED',
            entityType: 'CORRECTIVE_BT',
            entityId: String(existing.num_bt || id),
            before: { statut: existing.statut, validation_status: existing.validation_status },
            after: {
              statut: closedBt.statut,
              validation_status: 'APPROVED',
              validated_with_edits: validatedWithEdits,
              cout_pdr: closedBt.cout_pdr,
            },
            meta: { summary: `Validation et clôture BT ${existing.num_bt || id}` },
          });
        }
        return closedBt;
      }

      if (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') {
        if (String(existing.action_fermee || '').trim().toUpperCase() === 'OUI') {
          Logger.warn(`[useGmaoStore] handleReviewInterventionValidation blocked: intervention ${id} is already closed.`);
          return null;
        }

        const nowIso = new Date().toISOString();
        const finalNature = normalizeInterventionNature(
          decisionData.intervention_nature ?? existing.intervention_nature
        );
        let updated: any = null;
        const next = get().correctiveInterventions.map((item) => {
          if (item.id === id) {
            updated = new CorrectiveIntervention({
              ...item,
              ...(decisionData.action_realisee !== undefined
                ? { action_realisee: decisionData.action_realisee }
                : {}),
              ...(decisionData.travail_a_faire !== undefined
                ? { travail_a_faire: decisionData.travail_a_faire }
                : {}),
              ...(Array.isArray(decisionData.pieces_proposees)
                ? { pieces_proposees: decisionData.pieces_proposees }
                : {}),
              ...(finalNature ? { intervention_nature: finalNature as any } : {}),
              pieces_claimed: Array.isArray(item.pieces_claimed)
                ? item.pieces_claimed
                : Array.isArray(item.pieces_proposees)
                ? item.pieces_proposees
                : [],
              pieces_utilisees: [],
              stock_deducted: false,
              stock_effect: 'NONE',
              validated_with_edits: false,
              validation_status: decision as any,
              validation_note: String(decisionData.validation_note || '').trim(),
              validated_by_id: decisionData.validated_by_id || 'admin',
              validated_by_name: decisionData.validated_by_name || 'Administrateur',
              validated_at: decisionData.validated_at || nowIso,
              action_fermee: 'NON',
              statut: item.statut === 'CLOTURE' ? 'EN_COURS' : item.statut || 'EN_COURS',
            }).toJSON();
            return updated;
          }
          return item;
        });

        set({ correctiveInterventions: next });
        DataGateway.saveCorrectiveInterventions(next);
        get().appendAuditEvent({
          actorId: decisionData.validated_by_id,
          actorName: decisionData.validated_by_name,
          actionType: decision === 'REJECTED' ? 'VALIDATION_REJECTED' : 'VALIDATION_NEEDS_CLARIFICATION',
          entityType: 'CORRECTIVE_BT',
          entityId: String(existing.num_bt || id),
          before: { statut: existing.statut, validation_status: existing.validation_status },
          after: { statut: updated?.statut, validation_status: decision, validation_note: decisionData.validation_note || '' },
          meta: { summary: `Décision ${decision} sur BT ${existing.num_bt || id}` },
        });
        return updated;
      }

      return null;
    },

    handleClotureIntervention: (id, clotureData = {}, onAddMouvement = null) => {
      const existing = get().correctiveInterventions.find((item) => item.id === id);
      if (!existing) return null;

      // G0 + VAL-2 Single Gate Guard: Technician or Operator field submissions must ALWAYS go through PENDING_VALIDATION
      // Uses explicit actorRole/isTechnician from payload AND active signed session role as defense-in-depth fallback
      const explicitRole = String(clotureData?.actorRole || clotureData?.role || '').trim().toUpperCase();
      const effectiveRole = explicitRole || resolveActiveSessionRole();
      if (
        clotureData?._fromValidationReview !== true &&
        (clotureData?.isTechnician === true ||
          effectiveRole === 'TECHNICIEN' ||
          effectiveRole === 'OPERATEUR')
      ) {
        return get().handleSubmitInterventionForValidation(id, clotureData);
      }

      // Re-closure & FSM guard: never re-close an already closed BT or emit duplicate stock movements
      if (String(existing.action_fermee || '').trim().toUpperCase() === 'OUI') {
        Logger.warn(`[useGmaoStore] handleClotureIntervention blocked: intervention ${id} is already closed.`);
        return null;
      }

      const linkedWorkshopOrders = SortieExterneService.getLinkedOrdersForBt(
        {
          ...existing,
          id_sortie_atelier: clotureData.id_sortie_atelier ?? existing.id_sortie_atelier,
          code_sortie_atelier: clotureData.code_sortie_atelier ?? existing.code_sortie_atelier,
        },
        get().sortiesExterne
      );
      const linkedInternalWorkshopOrders = getLinkedWorkshopOrdersForIntervention(
        {
          ...existing,
          id_bon_atelier: clotureData.id_bon_atelier ?? existing.id_bon_atelier,
          code_bon_atelier: clotureData.code_bon_atelier ?? existing.code_bon_atelier,
        },
        get().workshopOrders
      );
      const hasOpenWorkshopOrder =
        clotureData.hasOpenWorkshopOrder === true ||
        linkedWorkshopOrders.some((s) => SortieExterneService.isWorkshopOrderOpen(s?.etat)) ||
        linkedInternalWorkshopOrders.some((ord) => isWorkshopOrderActive(ord.statut));

      // COR-HANDOFF-P0 Guard: block BT closure if any linked NeedRequest (requires_material !== false) has not reached CLOTURE_FIELD / REJETE / ANNULE
      const explicitlySansMateriel =
        clotureData.requires_material === false ||
        clotureData.sans_materiel === true ||
        existing.requires_material === false ||
        existing.sans_materiel === true;
      const hasOpenNeedRequest =
        !explicitlySansMateriel &&
        (clotureData.hasOpenNeedRequest === true ||
          hasBlockingNeedRequestForIntervention(existing, get().needRequests));

      const validation = WorkOrderStateMachine.validateTransition(existing, 'CLOTURE', {
        ...clotureData,
        hasOpenWorkshopOrder,
        hasOpenNeedRequest,
      });
      if (!validation.valid) {
        Logger.warn('[useGmaoStore] handleClotureIntervention blocked:', validation.reason);
        return null;
      }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeNow = now.toTimeString().slice(0, 5);
      let updated: any = null;
      const movementsToRecord: any[] = [];

      const stockList = get().rawStock || [];
      const stockLookup = new Map<string, any>();
      stockList.forEach((s: any) => {
        const r = String(s.ref || s.code_article || '').trim().toUpperCase();
        if (r) stockLookup.set(r, s);
      });
      const warehouseList = get().warehouseItems || [];

      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          const dFin = clotureData.date_fin || item.date_fin_proposee || today;
          const hFin = clotureData.heure_fin || item.heure_fin_proposee || timeNow;
          const dDebut =
            item.date_debut ||
            clotureData.date_debut ||
            item.date_demande ||
            item.demande_date ||
            item.date ||
            dFin ||
            today;
          const hDebut = item.heure_debut || clotureData.heure_debut || '08:00';
          const timeCalc = CorrectiveCalculationService.calculateWorkingTime(dDebut, hDebut, dFin, hFin);

          // Normalize multi-PDR consumption (pieces_utilisees + fallback to pieces_proposees + backward-compatible single pdr_ref)
          const rawPieces = Array.isArray(clotureData.pieces_utilisees)
            ? clotureData.pieces_utilisees
            : Array.isArray(item.pieces_utilisees) && item.pieces_utilisees.length > 0 && !clotureData.pdr_ref
            ? item.pieces_utilisees
            : Array.isArray(item.pieces_proposees) && item.pieces_proposees.length > 0 && !clotureData.pdr_ref
            ? item.pieces_proposees
            : [];

          const normalizedPieces: Array<{
            ref: string;
            designation: string;
            quantite: number;
            prix_unitaire: number;
            unite: string;
            marque?: string;
            etat_piece?: string;
          }> = [];

          rawPieces.forEach((p: any) => {
            const ref = String(p?.ref || p?.code_article || '').trim();
            const quantite = Number(p?.quantite ?? p?.qte ?? 0);
            if (!ref || !(quantite > 0)) return;
            const stockMatch = stockLookup.get(ref.toUpperCase());
            const existingIdx = normalizedPieces.findIndex(
              (np) => np.ref.toUpperCase() === ref.toUpperCase()
            );
            const prix =
              Number(p?.prix_unitaire ?? p?.prix ?? stockMatch?.prix ?? stockMatch?.prix_unitaire ?? 0) || 0;
            if (existingIdx >= 0) {
              normalizedPieces[existingIdx].quantite += quantite;
            } else {
              normalizedPieces.push({
                ref,
                designation: String(
                  p?.designation || stockMatch?.designation || stockMatch?.nom || ref
                ).trim(),
                quantite,
                prix_unitaire: prix,
                unite: String(p?.unite || stockMatch?.unite || 'Pièce'),
                marque: p?.marque || stockMatch?.marque || clotureData.marque || item.marque || '',
                etat_piece: p?.etat_piece || clotureData.etat_piece || item.etat_piece || 'Neuve',
              });
            }
          });

          // Also merge single pdr_ref if provided and not already in normalizedPieces
          const singleRef = String(
            clotureData.pdr_ref ?? item.pdr_ref ?? item.pdr ?? ''
          ).trim();
          const singleQty = Number(clotureData.pdr_quantite ?? item.pdr_quantite ?? 0);
          if (singleRef && singleQty > 0) {
            const alreadyIncluded = normalizedPieces.some(
              (np) => np.ref.toUpperCase() === singleRef.toUpperCase()
            );
            if (!alreadyIncluded) {
              const stockMatch = stockLookup.get(singleRef.toUpperCase());
              normalizedPieces.push({
                ref: singleRef,
                designation: String(
                  clotureData.pdr_designation ||
                    item.pdr_designation ||
                    stockMatch?.designation ||
                    stockMatch?.nom ||
                    singleRef
                ).trim(),
                quantite: singleQty,
                prix_unitaire:
                  Number(
                    clotureData.pdr_prix ??
                      item.pdr_prix ??
                      stockMatch?.prix ??
                      stockMatch?.prix_unitaire ??
                      0
                  ) || 0,
                unite: String(
                  clotureData.pdr_unite || item.pdr_unite || stockMatch?.unite || 'Pièce'
                ),
                marque: clotureData.marque || item.marque || stockMatch?.marque || '',
                etat_piece: clotureData.etat_piece || item.etat_piece || 'Neuve',
              });
            }
          }

          const totalPdrCost = normalizedPieces.reduce(
            (sum, p) => sum + p.quantite * (p.prix_unitaire || 0),
            0
          );
          const primaryPiece = normalizedPieces[0] || null;
          const primaryWorkshopOrder = linkedWorkshopOrders[0] || null;
          const computedWorkshopCost =
            linkedWorkshopOrders.length > 0
              ? linkedWorkshopOrders.reduce(
                  (sum, s) => sum + (Number(s?.cout_bobinage ?? s?.cout_atelier) || 0),
                  0
                )
              : Number(clotureData.cout_atelier ?? item.cout_atelier ?? 0) || 0;

          const resolvedCompId = String(clotureData.id_composant ?? item.id_composant ?? '').trim();
          const resolvedPartId = String(clotureData.id_part ?? item.id_part ?? '').trim();
          const matchedComp = resolvedCompId
            ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === resolvedCompId)
            : null;
          const matchedPart = resolvedPartId
            ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === resolvedPartId)
            : null;

          const cleanClotureData = { ...clotureData };
          delete cleanClotureData._fromValidationReview;
          delete cleanClotureData.actorRole;
          delete cleanClotureData.isTechnician;
          delete cleanClotureData.hasOpenWorkshopOrder;
          const resolvedClotureNature = normalizeInterventionNature(
            clotureData.intervention_nature ?? item.intervention_nature
          );

          updated = new CorrectiveIntervention({
            ...item,
            ...cleanClotureData,
            ...(resolvedClotureNature ? { intervention_nature: resolvedClotureNature as any } : {}),
            id_sortie_atelier:
              clotureData.id_sortie_atelier ||
              item.id_sortie_atelier ||
              primaryWorkshopOrder?.id ||
              '',
            code_sortie_atelier:
              clotureData.code_sortie_atelier ||
              item.code_sortie_atelier ||
              primaryWorkshopOrder?.code ||
              '',
            cout_atelier: computedWorkshopCost,
            nature_travail_atelier:
              clotureData.nature_travail_atelier ||
              item.nature_travail_atelier ||
              primaryWorkshopOrder?.nature_travail ||
              primaryWorkshopOrder?.type_probleme ||
              '',
            prestataire_atelier:
              clotureData.prestataire_atelier ||
              item.prestataire_atelier ||
              primaryWorkshopOrder?.fournisseur_externe ||
              '',
            id_composant: resolvedCompId,
            nom_composant:
              clotureData.nom_composant ||
              item.nom_composant ||
              matchedComp?.designation ||
              matchedComp?.nom_composant ||
              matchedComp?.nom ||
              '',
            id_part: resolvedPartId,
            nom_part:
              clotureData.nom_part ||
              item.nom_part ||
              matchedPart?.designation_part ||
              matchedPart?.designation ||
              matchedPart?.nom ||
              '',
            pdr_ref: primaryPiece ? primaryPiece.ref : '',
            pdr_designation: primaryPiece
              ? normalizedPieces.length > 1
                ? `${primaryPiece.designation} (+${normalizedPieces.length - 1} réf.)`
                : primaryPiece.designation
              : '',
            pdr_quantite: primaryPiece ? primaryPiece.quantite : 0,
            pdr_prix: primaryPiece ? primaryPiece.prix_unitaire : 0,
            pdr_unite: primaryPiece ? primaryPiece.unite : 'Pièce',
            pieces_utilisees: normalizedPieces,
            pieces_claimed: Array.isArray(clotureData.pieces_claimed)
              ? clotureData.pieces_claimed
              : Array.isArray(item.pieces_claimed)
              ? item.pieces_claimed
              : Array.isArray(item.pieces_proposees)
              ? item.pieces_proposees
              : normalizedPieces,
            validated_with_edits: Boolean(
              clotureData.validated_with_edits ?? item.validated_with_edits ?? false
            ),
            cout_pdr: totalPdrCost,
            pdr_cost: totalPdrCost,
            cout_total: Number((totalPdrCost + computedWorkshopCost).toFixed(2)),
            date_debut: dDebut,
            heure_debut: hDebut,
            date_fin: dFin,
            heure_fin: hFin,
            temps_intervention: timeCalc.formatted,
            temps_intervention_calc: timeCalc.formatted,
            temps_intervention_mins: timeCalc.minutes,
            temps_minutes: timeCalc.minutes,
            validation_status: 'APPROVED',
            stock_deducted: normalizedPieces.length > 0 && clotureData.skipStockDeduction !== true,
            stock_effect:
              normalizedPieces.length > 0 && clotureData.skipStockDeduction !== true
                ? 'APPLIED'
                : 'NONE',
            validated_by_id: clotureData.validated_by_id || item.validated_by_id || 'admin',
            validated_by_name:
              clotureData.validated_by_name || item.validated_by_name || 'Administrateur',
            validated_at: clotureData.validated_at || item.validated_at || now.toISOString(),
            action_fermee: 'OUI',
            statut: 'CLOTURE',
            rapport_redige: 'OUI',
          }).toJSON();

          if (normalizedPieces.length > 0 && clotureData.skipStockDeduction !== true) {
            const currentMouvements = get().mouvements || [];
            const btIdentifier = updated.num_bt || updated.id;
            const emittedIds: string[] = [];
            normalizedPieces.forEach((piece, idx) => {
              if (
                isPartAlreadyDeductedByStoreBon(
                  currentMouvements,
                  updated.num_bon_saisi_par_tech,
                  piece.ref
                )
              ) {
                return;
              }
              const suffix = normalizedPieces.length > 1 ? `-${idx + 1}` : '';
              const mvtId = `MVT-BT-${Date.now()}-${idx}-${Math.floor(100 + Math.random() * 900)}`;
              emittedIds.push(mvtId);
              movementsToRecord.push({
                id: mvtId,
                source_bt_id: String(updated.id || ''),
                source_num_bt: String(btIdentifier || ''),
                code_bon: updated.num_bon_saisi_par_tech || `BS-BT-${btIdentifier}${suffix}`,
                num_bon_saisi_par_tech: updated.num_bon_saisi_par_tech || '',
                ref: piece.ref,
                code_article: piece.ref,
                designation: piece.designation || piece.ref,
                type: 'Sortie',
                quantite: Number(piece.quantite),
                date: dFin,
                machine: updated.code_machine,
                id_machine_registered: updated.code_machine,
                technicien: updated.intervenant || 'Technicien',
                demandeur: updated.intervenant || 'Technicien GMAO',
                prix_unitaire: Number(piece.prix_unitaire) || 0,
                unite: piece.unite || 'Pièce',
                motif: `Consommation BT ${btIdentifier} · Machine: ${updated.code_machine}`,
                observation: `Sortie PDR automatique clôture BT ${btIdentifier} (${updated.anomalie || 'Correctif'})`,
              });
            });
            if (emittedIds.length > 0) {
              updated.emitted_movement_ids = emittedIds;
            }
          }

          return updated;
        }
        return item;
      });

      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);

      if (movementsToRecord.length > 0) {
        if (typeof onAddMouvement === 'function') {
          movementsToRecord.forEach((mvt) => {
            try {
              onAddMouvement(mvt);
            } catch (e) {
              Logger.warn('[useGmaoStore] onAddMouvement error:', e);
            }
          });
        } else {
          movementsToRecord.forEach((mvt) => {
            try {
              movementRepository.add(mvt);
            } catch (err) {
              Logger.warn('[useGmaoStore] Failed to add movement via repository:', err);
            }
          });
          get().setMouvements((prev) => [...movementsToRecord, ...prev]);
        }
      }

      // Optional linked component lifecycle update in Entrepôt (id_composant + statut_composant_cloture)
      const targetCompId = String(updated?.id_composant || '').trim();
      const targetCompStatus = String(
        clotureData?.statut_composant_cloture || updated?.statut_composant_cloture || ''
      ).trim();
      if (targetCompId && targetCompStatus) {
        const btRef = updated?.num_bt || updated?.id || '';
        const dFin = updated?.date_fin || today;
        get().setWarehouseItems((prev) =>
          (prev || []).map((w: any) => {
            const wId = String(w.id_warehouse_item || w.id || w.id_item || '').trim();
            if (wId === targetCompId) {
              return {
                ...w,
                status: targetCompStatus,
                statut: targetCompStatus,
                derniere_intervention_bt: btRef,
                derniere_intervention_date: dFin,
              };
            }
            return w;
          })
        );
      }

      if (get().activeLiveInterventionId === id) {
        get().setActiveLiveInterventionId(null);
      }

      return updated;
    },

    handleUpdateCorrectiveIntervention: (id, patch = {}) => {
      const existing = get().correctiveInterventions.find((item) => item.id === id);
      if (!existing) return;

      if (patch.statut && patch.statut !== existing.statut) {
        const validation = WorkOrderStateMachine.validateTransition(existing, patch.statut, patch);
        if (!validation.valid) {
          Logger.warn('[useGmaoStore] handleUpdateCorrectiveIntervention transition blocked:', validation.reason);
          return;
        }
      }

      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          return new CorrectiveIntervention({
            ...item,
            ...patch,
            ...(patch.statut ? { statut: WorkOrderStateMachine.normalizeStatus(patch.statut) } : {}),
          }).toJSON();
        }
        return item;
      });
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
    },

    handleDeleteCorrectiveIntervention: (id) => {
      recordLocalDeletedIds('correctiveInterventions', [id]);
      const currentInterventions = get().correctiveInterventions || [];
      const targetBt = currentInterventions.find((item) => String(item.id) === String(id));
      const next = currentInterventions.filter((item) => item.id !== id);
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
      if (get().activeLiveInterventionId === id) {
        get().setActiveLiveInterventionId(null);
      }

      if (targetBt) {
        const btIdStr = String(targetBt.id || id).trim();
        const btNumStr = String(targetBt.num_bt || targetBt.id || id).trim().toUpperCase();
        const emittedSet = new Set(
          Array.isArray((targetBt as any).emitted_movement_ids)
            ? (targetBt as any).emitted_movement_ids
            : []
        );

        const linkedMovements = (get().mouvements || []).filter((m: any) => {
          if (!m) return false;
          if (String(m.source_bt_id || '').trim() === btIdStr) return true;
          if (btNumStr && String(m.source_num_bt || '').trim().toUpperCase() === btNumStr) return true;
          if (emittedSet.has(String(m.id || ''))) return true;
          const codeBon = String(m.code_bon || '').trim().toUpperCase();
          return Boolean(
            btNumStr &&
              (codeBon === `BS-BT-${btNumStr}` || codeBon.startsWith(`BS-BT-${btNumStr}-`))
          );
        });

        if (linkedMovements.length > 0) {
          const removeIds = new Set(linkedMovements.map((m: any) => m.id));
          linkedMovements.forEach((m: any) => {
            try {
              movementRepository.remove(m);
            } catch (err) {
              Logger.warn('[useGmaoStore] Failed to remove movement on corrective BT delete:', err);
            }
          });
          get().setMouvements((prev) => (prev || []).filter((m: any) => !removeIds.has(m.id)));
        }
      }
    },

    handleBulkImportCorrective: (importedItems = []) => {
      if (!Array.isArray(importedItems) || importedItems.length === 0) return;
      const validated = importedItems.map((item) => new CorrectiveIntervention(item).toJSON());
      const next = [...validated, ...get().correctiveInterventions];
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
    },

    handleResetCorrectiveToSeed: async (ctx = {}) => {
      const { machines = [], skipConfirm = false } = ctx;
      const baseline = await loadBaselineCorrectiveData();
      const finalItems =
        baseline?.interventions && baseline.interventions.length > 0
          ? baseline.interventions
          : initialInterventions;

      const impact = dataIntegrityService.previewClearImpact({
        action: 'RESET_CORRECTIVE',
        machines,
        preventiveTasks: [],
        correctiveInterventions: get().correctiveInterventions,
      });

      const msg =
        `Réinitialiser le correctif aux données de démonstration (${finalItems.length} intervention(s)) ?\n` +
        `• Interventions actuelles: ${impact.correctiveCount}\n` +
        `• Machines: ${impact.machineCount}\n` +
        `\nLes machines et le préventif ne seront PAS modifiés.`;

      if (!skipConfirm && !(await confirmAction({ title: 'Réinitialiser le correctif', message: msg, variant: 'warning' }))) {
        return { cancelled: true };
      }

      set({ correctiveInterventions: finalItems });
      get().setActiveLiveInterventionId(null);
      DataGateway.saveCorrectiveInterventions(finalItems, { machines });
      await get().handleResetCorrectiveActions();

      const orphans = dataIntegrityService
        .annotateCorrectiveOrphans(finalItems, machines)
        .filter((i: any) => i._isOrphan);

      return {
        cancelled: false,
        restoredCount: finalItems.length,
        orphanCountAfter: orphans.length,
      };
    },

    // Derived Corrective KPIs
    correctiveKpis: () => CorrectiveCalculationService.computeKpis(get().correctiveInterventions),
    correctiveParetoAnomalies: () => CorrectiveCalculationService.computePareto(get().correctiveInterventions, 'anomalie'),
    correctiveParetoMachines: () => CorrectiveCalculationService.computePareto(get().correctiveInterventions, 'code_machine'),
    correctiveParetoTypes: () => CorrectiveCalculationService.computePareto(get().correctiveInterventions, 'type_panne'),
    correctivePreventiveRecommendations: () =>
      CorrectiveCalculationService.detectPreventiveRecommendations(get().correctiveInterventions),

    // ==========================================
    // 8b. Mechanical Workshop Orders (COR-ATELIER-P0)
    // ==========================================
    setWorkshopOrders: (updater) => {
      const prev = get().workshopOrders || [];
      const next = resolveUpdate(updater, prev);
      set({ workshopOrders: next });
      DataGateway.saveWorkshopOrders(next);
    },

    handleCreateWorkshopOrder: (payload) => {
      const actor = resolveActiveActorContext();
      const currentOrders = get().workshopOrders || [];
      const cleanMachine = String(payload?.id_machine || '').trim();
      const cleanDesc = String(payload?.description_travaux || '').trim();
      if (!cleanMachine || !cleanDesc) {
        Logger.warn('[useGmaoStore] handleCreateWorkshopOrder requires id_machine and description_travaux.');
        return null;
      }

      const record = createWorkshopOrderRecord(
        {
          ...payload,
          id_machine: cleanMachine,
          description_travaux: cleanDesc,
          emetteur_user_id: payload.emetteur_user_id || actor.actorId,
          emetteur_name: payload.emetteur_name || actor.actorName,
        },
        currentOrders
      );

      const nextOrders = [record, ...currentOrders];
      set({ workshopOrders: nextOrders });
      DataGateway.saveWorkshopOrders(nextOrders);

      // If linked to an open BT, place the BT in workshop waiting status (EN_ATTENTE_ATELIER -> EN_ATTENTE_PDR in FSM)
      // NEVER close the BT (CLOTURE / action_fermee = 'OUI') when creating a workshop order
      const targetBtKey = String(record.id_bt || '').trim();
      if (targetBtKey) {
        const currentInterventions = get().correctiveInterventions || [];
        let btUpdated = false;
        const nextInterventions = currentInterventions.map((item) => {
          const itemId = String(item.id || '').trim();
          const itemNumBt = String(item.num_bt || '').trim();
          if (
            itemId === targetBtKey ||
            itemId.toUpperCase() === targetBtKey.toUpperCase() ||
            (itemNumBt && itemNumBt.toUpperCase() === targetBtKey.toUpperCase())
          ) {
            const currentStatut = WorkOrderStateMachine.normalizeStatus(item.statut);
            const isClosedOrCancelled =
              currentStatut === 'CLOTURE' ||
              currentStatut === 'ANNULE' ||
              String(item.action_fermee || '').trim().toUpperCase() === 'OUI';
            if (isClosedOrCancelled) return item;

            btUpdated = true;
            // WorkOrderStateMachine maps EN_ATTENTE_ATELIER -> EN_ATTENTE_PDR and keeps action_fermee = 'NON'
            const waitingStatut = WorkOrderStateMachine.normalizeStatus('EN_ATTENTE_ATELIER');
            return new CorrectiveIntervention({
              ...item,
              statut: waitingStatut,
              action_fermee: 'NON',
              id_bon_atelier: record.id,
              code_bon_atelier: record.code_bon,
              statut_bon_atelier: record.statut,
              type_bon_atelier: record.type_demande,
              ...(item.intervention_nature ? {} : { intervention_nature: 'ATELIER' }),
            }).toJSON();
          }
          return item;
        });

        if (btUpdated) {
          set({ correctiveInterventions: nextInterventions });
          DataGateway.saveCorrectiveInterventions(nextInterventions);
        }
      }

      get().appendAuditEvent({
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        actionType: 'WORKSHOP_ORDER_CREATED',
        entityType: 'WORKSHOP_ORDER',
        entityId: record.code_bon,
        before: null,
        after: {
          id: record.id,
          code_bon: record.code_bon,
          type_demande: record.type_demande,
          statut: record.statut,
          id_machine: record.id_machine,
          id_bt: record.id_bt,
          quantite: record.quantite,
        },
        meta: {
          summary: `Émission Bon Atelier ${record.code_bon} (${record.type_demande}) pour machine ${record.id_machine}`,
        },
      });

      return record;
    },

    handleTransitionWorkshopOrderStatus: (orderId, nextStatus, observation) => {
      const currentOrders = get().workshopOrders || [];
      const existing = currentOrders.find(
        (ord) => String(ord.id) === String(orderId) || String(ord.code_bon) === String(orderId)
      );
      if (!existing) {
        return { valid: false, reason: `Bon d'atelier introuvable (${orderId}).` };
      }

      const check = validateWorkshopOrderTransition(existing.statut, nextStatus);
      if (!check.valid || !check.normalizedTarget) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      const updatedOrder: IWorkshopOrder = {
        ...existing,
        statut: check.normalizedTarget,
        date_statut: nowIso,
        ...(observation !== undefined && String(observation).trim()
          ? { observation: String(observation).trim() }
          : {}),
      };

      const nextOrders = currentOrders.map((ord) =>
        ord.id === existing.id ? updatedOrder : ord
      );
      set({ workshopOrders: nextOrders });
      DataGateway.saveWorkshopOrders(nextOrders);

      // Sync linked BT badge metadata without auto-closing the BT (even on RECEPTIONNE_MONTAGE)
      if (updatedOrder.id_bt) {
        const targetBtKey = String(updatedOrder.id_bt).trim().toUpperCase();
        const currentInterventions = get().correctiveInterventions || [];
        let btChanged = false;
        const nextInterventions = currentInterventions.map((item) => {
          const itemId = String(item.id || '').trim().toUpperCase();
          const itemNumBt = String(item.num_bt || '').trim().toUpperCase();
          const itemBonId = String(item.id_bon_atelier || '').trim();
          if (
            itemId === targetBtKey ||
            (itemNumBt && itemNumBt === targetBtKey) ||
            itemBonId === updatedOrder.id
          ) {
            btChanged = true;
            return {
              ...item,
              id_bon_atelier: updatedOrder.id,
              code_bon_atelier: updatedOrder.code_bon,
              statut_bon_atelier: updatedOrder.statut,
              type_bon_atelier: updatedOrder.type_demande,
            };
          }
          return item;
        });

        if (btChanged) {
          set({ correctiveInterventions: nextInterventions });
          DataGateway.saveCorrectiveInterventions(nextInterventions);
        }
      }

      // COR-HANDOFF-P0: When a linked WorkshopOrder reaches RECEPTIONNE_MONTAGE, advance any linked NeedRequest in APPROVISIONNEMENT to RECU_STRUCTURE
      if (updatedOrder.statut === 'RECEPTIONNE_MONTAGE') {
        const currentNeeds = get().needRequests || [];
        let needsChanged = false;
        const nextNeeds = currentNeeds.map((req) => {
          if (
            req &&
            req.statut === 'APPROVISIONNEMENT' &&
            req.canal_appro === 'ATELIER' &&
            (req.id_workshop_order === updatedOrder.id ||
              req.code_workshop_order === updatedOrder.code_bon)
          ) {
            needsChanged = true;
            return {
              ...req,
              statut: 'RECU_STRUCTURE' as NeedRequestStatus,
              date_statut: nowIso,
              timestamps: {
                ...(req.timestamps || {}),
                RECU_STRUCTURE: nowIso,
              },
            };
          }
          return req;
        });
        if (needsChanged) {
          set({ needRequests: nextNeeds });
          DataGateway.saveNeedRequests(nextNeeds);
        }
      }

      const actor = resolveActiveActorContext();
      get().appendAuditEvent({
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        actionType: 'WORKSHOP_ORDER_STATUS_CHANGED',
        entityType: 'WORKSHOP_ORDER',
        entityId: updatedOrder.code_bon,
        before: { statut: existing.statut },
        after: { statut: updatedOrder.statut, date_statut: updatedOrder.date_statut },
        meta: {
          summary: `Transition Bon Atelier ${updatedOrder.code_bon}: ${existing.statut} → ${updatedOrder.statut}`,
        },
      });

      return { valid: true, order: updatedOrder };
    },

    // ==========================================
    // 8c. Need Requests & Field Handoff (COR-HANDOFF-P0)
    // ==========================================
    setNeedRequests: (updater) => {
      const prev = get().needRequests || [];
      const next = typeof updater === 'function' ? updater(prev) : updater;
      set({ needRequests: next });
      DataGateway.saveNeedRequests(next);
    },

    handleCreateNeedRequest: (payload) => {
      const currentNeeds = get().needRequests || [];
      const actor = resolveActiveActorContext();

      // Resolve policy_tags_snapshot from catalog entity if not explicitly provided
      let effectiveSnapshot = payload.policy_tags_snapshot;
      if (!effectiveSnapshot || !Array.isArray(effectiveSnapshot) || effectiveSnapshot.length === 0) {
        const matClass = payload.material_class || 'PDR';
        let foundEntity: any = null;
        if (matClass === 'PDR' && payload.id_ref_pdr) {
          const raw = get().rawStock || [];
          const cleanKey = String(payload.id_ref_pdr).trim().toUpperCase();
          foundEntity = raw.find(
            (r: any) =>
              String(r.ref || r.code_article || '').trim().toUpperCase() === cleanKey ||
              String(r.id || '').trim().toUpperCase() === cleanKey
          );
        } else if (matClass === 'PART' && (payload.id_part || payload.id_ref_pdr)) {
          const parts = get().partDesignations || [];
          const cleanKey = String(payload.id_part || payload.id_ref_pdr).trim().toUpperCase();
          foundEntity = parts.find(
            (p: any) =>
              String(p.ref || p.id_part || '').trim().toUpperCase() === cleanKey ||
              String(p.id || '').trim().toUpperCase() === cleanKey
          );
        } else if (matClass === 'COMPONENT' && payload.id_composant) {
          const wh = get().warehouseItems || [];
          const cleanKey = String(payload.id_composant).trim().toUpperCase();
          foundEntity = wh.find(
            (w: any) =>
              String(w.code || w.ref || w.id_warehouse_item || '').trim().toUpperCase() === cleanKey ||
              String(w.id || '').trim().toUpperCase() === cleanKey
          );
        }
        effectiveSnapshot = getEffectivePolicyTags(foundEntity, matClass);
      }

      try {
        const newNeed = createNeedRequestRecord(
          {
            ...payload,
            policy_tags_snapshot: effectiveSnapshot,
            id_technicien_demandeur:
              payload.id_technicien_demandeur || actor.actorId || 'TECH',
            nom_technicien_demandeur:
              payload.nom_technicien_demandeur || actor.actorName || 'Technicien',
          },
          currentNeeds
        );

        const nextNeeds = [newNeed, ...currentNeeds];
        set({ needRequests: nextNeeds });
        DataGateway.saveNeedRequests(nextNeeds);

        // If linked to an open BT, place BT into EN_ATTENTE_PDR (waiting need handoff) without closing it
        if (newNeed.id_bt) {
          const targetBtKey = String(newNeed.id_bt).trim().toUpperCase();
          const currentInterventions = get().correctiveInterventions || [];
          let btUpdated = false;

          const nextInterventions = currentInterventions.map((item) => {
            const itemId = String(item.id || '').trim().toUpperCase();
            const itemNumBt = String(item.num_bt || '').trim().toUpperCase();
            if (itemId === targetBtKey || (itemNumBt && itemNumBt === targetBtKey)) {
              const isAlreadyClosed =
                String(item.statut || '').toUpperCase() === 'CLOTURE' ||
                String(item.action_fermee || '').toUpperCase() === 'OUI';
              btUpdated = true;
              return {
                ...item,
                id_need_request: newNeed.id,
                code_need_request: newNeed.code_demande,
                statut_need_request: newNeed.statut,
                canal_need_request: null,
                ...(isAlreadyClosed
                  ? {}
                  : {
                      statut: 'EN_ATTENTE_PDR',
                      action_fermee: 'NON',
                    }),
              };
            }
            return item;
          });

          if (btUpdated) {
            set({ correctiveInterventions: nextInterventions });
            DataGateway.saveCorrectiveInterventions(nextInterventions);
          }
        }

        get().appendAuditEvent({
          actorId: newNeed.id_technicien_demandeur || actor.actorId,
          actorName: newNeed.nom_technicien_demandeur || actor.actorName,
          actorRole: actor.actorRole,
          actionType: 'NEED_REQUEST_CREATED',
          entityType: 'NEED_REQUEST',
          entityId: newNeed.code_demande,
          before: null,
          after: {
            code_demande: newNeed.code_demande,
            material_class: newNeed.material_class,
            id_machine: newNeed.id_machine,
            id_bt: newNeed.id_bt,
            quantite: newNeed.quantite,
            statut: newNeed.statut,
            canal_appro: newNeed.canal_appro,
          },
          meta: {
            summary: `Création Demande de Besoin ${newNeed.code_demande} (${newNeed.material_class}) pour machine ${newNeed.id_machine}${
              newNeed.id_bt ? ` [BT: ${newNeed.id_bt}]` : ''
            }`,
          },
        });

        return newNeed;
      } catch (err) {
        Logger.warn('[useGmaoStore] handleCreateNeedRequest error:', err);
        return null;
      }
    },

    handleReviewNeedRequest: (needId, decisionPayload) => {
      const currentNeeds = get().needRequests || [];
      const existing = currentNeeds.find(
        (req) =>
          String(req.id) === String(needId) ||
          String(req.code_demande) === String(needId)
      );
      if (!existing) {
        return { valid: false, reason: `Demande de besoin introuvable (${needId}).` };
      }

      const actor = resolveActiveActorContext();
      const effectiveRole = String(decisionPayload.actorRole || actor.actorRole || 'ADMIN')
        .trim()
        .toUpperCase();
      const isTech = effectiveRole === 'TECHNICIEN' || effectiveRole === 'OPERATEUR';

      const targetStatus = decisionPayload.decision;
      const canalAppro = (decisionPayload.canal_appro ?? existing.canal_appro ?? null) as
        | NeedApproChannel
        | null;

      const check = validateNeedRequestTransition(existing.statut, targetStatus, {
        actorRole: effectiveRole,
        isTechnician: isTech,
        canal_appro: canalAppro,
        existingCanalAppro: existing.canal_appro,
        material_class: existing.material_class,
        motif_rejet: decisionPayload.motif_rejet,
        notes_superviseur: decisionPayload.notes_superviseur,
      });

      if (!check.valid) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      let createdWorkshopOrder: IWorkshopOrder | null = null;
      let linkedWorkshopId = existing.id_workshop_order || null;
      let linkedWorkshopCode = existing.code_workshop_order || null;

      // Coupling with COR-ATELIER-P0: when supervisor approves APPROVISIONNEMENT with canal_appro === 'ATELIER',
      // automatically create and link an IWorkshopOrder if none exists yet.
      if (targetStatus === 'APPROVISIONNEMENT' && canalAppro === 'ATELIER') {
        if (!linkedWorkshopId) {
          const suggestedType =
            suggestWorkshopType(existing.policy_tags_snapshot, existing.material_class) ||
            'REALISATION';
          createdWorkshopOrder = get().handleCreateWorkshopOrder({
            type_demande: decisionPayload.workshopOrderType || suggestedType,
            id_machine: existing.id_machine,
            id_bt: existing.id_bt || null,
            id_di: existing.id_di || null,
            id_composant: existing.id_composant || null,
            id_part: existing.id_part || null,
            quantite: existing.quantite,
            description_travaux: `[${existing.code_demande}] ${existing.description_besoin}`,
            observation: decisionPayload.notes_superviseur || undefined,
            emetteur_section: 'SM',
            emetteur_user_id: decisionPayload.actorId || actor.actorId,
            emetteur_name: decisionPayload.actorName || actor.actorName,
          });
          if (createdWorkshopOrder) {
            linkedWorkshopId = createdWorkshopOrder.id;
            linkedWorkshopCode = createdWorkshopOrder.code_bon;
          }
        }
      }

      const updatedNeed: INeedRequest = {
        ...existing,
        statut: targetStatus,
        canal_appro:
          targetStatus === 'APPROVISIONNEMENT' ? canalAppro : existing.canal_appro ?? canalAppro,
        id_workshop_order: linkedWorkshopId,
        code_workshop_order: linkedWorkshopCode,
        id_sortie_demand:
          decisionPayload.id_sortie_demand !== undefined
            ? decisionPayload.id_sortie_demand
            : existing.id_sortie_demand || null,
        ...(decisionPayload.notes_superviseur !== undefined
          ? { notes_superviseur: String(decisionPayload.notes_superviseur).trim() }
          : {}),
        ...(decisionPayload.motif_rejet !== undefined
          ? { motif_rejet: String(decisionPayload.motif_rejet).trim() }
          : {}),
        date_statut: nowIso,
        timestamps: {
          ...(existing.timestamps || {}),
          ...(existing.statut === 'DEMANDE_TECH' && targetStatus === 'APPROVISIONNEMENT'
            ? { REVUE_SUPERVISEUR: nowIso }
            : {}),
          [targetStatus]: nowIso,
        },
      };

      const nextNeeds = get().needRequests.map((req) =>
        req.id === existing.id ? updatedNeed : req
      );
      set({ needRequests: nextNeeds });
      DataGateway.saveNeedRequests(nextNeeds);

      // Sync parent BT metadata without closing the BT
      if (updatedNeed.id_bt) {
        const targetBtKey = String(updatedNeed.id_bt).trim().toUpperCase();
        const currentInterventions = get().correctiveInterventions || [];
        let btChanged = false;
        const nextInterventions = currentInterventions.map((item) => {
          const itemId = String(item.id || '').trim().toUpperCase();
          const itemNumBt = String(item.num_bt || '').trim().toUpperCase();
          if (itemId === targetBtKey || (itemNumBt && itemNumBt === targetBtKey)) {
            btChanged = true;
            const isClosed =
              String(item.statut || '').toUpperCase() === 'CLOTURE' ||
              String(item.action_fermee || '').toUpperCase() === 'OUI';
            return {
              ...item,
              id_need_request: updatedNeed.id,
              code_need_request: updatedNeed.code_demande,
              statut_need_request: updatedNeed.statut,
              canal_need_request: updatedNeed.canal_appro || null,
              ...(isClosed
                ? {}
                : {
                    statut:
                      targetStatus === 'APPROVISIONNEMENT'
                        ? 'EN_ATTENTE_PDR'
                        : item.statut || 'EN_COURS',
                    action_fermee: 'NON',
                  }),
            };
          }
          return item;
        });

        if (btChanged) {
          set({ correctiveInterventions: nextInterventions });
          DataGateway.saveCorrectiveInterventions(nextInterventions);
        }
      }

      get().appendAuditEvent({
        actorId: decisionPayload.actorId || actor.actorId,
        actorName: decisionPayload.actorName || actor.actorName,
        actorRole: effectiveRole,
        actionType: 'NEED_REQUEST_REVIEWED',
        entityType: 'NEED_REQUEST',
        entityId: updatedNeed.code_demande,
        before: { statut: existing.statut, canal_appro: existing.canal_appro },
        after: {
          statut: updatedNeed.statut,
          canal_appro: updatedNeed.canal_appro,
          id_workshop_order: updatedNeed.id_workshop_order,
        },
        meta: {
          summary: `Revue Demande de Besoin ${updatedNeed.code_demande} : ${existing.statut} ➔ ${updatedNeed.statut}${
            updatedNeed.canal_appro ? ` (Canal: ${updatedNeed.canal_appro})` : ''
          }`,
        },
      });

      return {
        valid: true,
        needRequest: updatedNeed,
        workshopOrder: createdWorkshopOrder,
      };
    },

    handleTransitionNeedRequestStatus: (needId, nextStatus, context = {}) => {
      const currentNeeds = get().needRequests || [];
      const existing = currentNeeds.find(
        (req) =>
          String(req.id) === String(needId) ||
          String(req.code_demande) === String(needId)
      );
      if (!existing) {
        return { valid: false, reason: `Demande de besoin introuvable (${needId}).` };
      }

      const actor = resolveActiveActorContext();
      const effectiveRole = String(context.actorRole || actor.actorRole || 'ADMIN')
        .trim()
        .toUpperCase();
      const isTech =
        context.isTechnician === true ||
        effectiveRole === 'TECHNICIEN' ||
        effectiveRole === 'OPERATEUR';

      const allWorkshopOrders = get().workshopOrders || [];
      const linkedWorkshopOrder = existing.id_workshop_order
        ? allWorkshopOrders.find(
            (w) =>
              w.id === existing.id_workshop_order ||
              w.code_bon === existing.id_workshop_order ||
              w.code_bon === existing.code_workshop_order
          ) || null
        : null;

      const hasOpenWorkshopOrder =
        linkedWorkshopOrder != null && isWorkshopOrderActive(linkedWorkshopOrder.statut);

      const check = validateNeedRequestTransition(existing.statut, nextStatus, {
        actorRole: effectiveRole,
        isTechnician: isTech,
        existingCanalAppro: existing.canal_appro,
        linkedWorkshopOrder,
        hasOpenWorkshopOrder,
        motif_rejet: context.motif_rejet,
        notes_superviseur: context.notes_superviseur,
        observation_pose_essai: context.observation_pose_essai,
      });

      if (!check.valid) {
        return { valid: false, reason: check.reason };
      }

      const nowIso = new Date().toISOString();
      const updatedNeed: INeedRequest = {
        ...existing,
        statut: nextStatus,
        ...(context.observation_pose_essai !== undefined
          ? { observation_pose_essai: String(context.observation_pose_essai).trim() }
          : {}),
        ...(context.notes_superviseur !== undefined
          ? { notes_superviseur: String(context.notes_superviseur).trim() }
          : {}),
        ...(context.motif_rejet !== undefined
          ? { motif_rejet: String(context.motif_rejet).trim() }
          : {}),
        date_statut: nowIso,
        timestamps: {
          ...(existing.timestamps || {}),
          [nextStatus]: nowIso,
        },
      };

      const nextNeeds = currentNeeds.map((req) =>
        req.id === existing.id ? updatedNeed : req
      );
      set({ needRequests: nextNeeds });
      DataGateway.saveNeedRequests(nextNeeds);

      // Sync parent BT metadata (never auto-close the BT)
      if (updatedNeed.id_bt) {
        const targetBtKey = String(updatedNeed.id_bt).trim().toUpperCase();
        const currentInterventions = get().correctiveInterventions || [];
        let btChanged = false;
        const nextInterventions = currentInterventions.map((item) => {
          const itemId = String(item.id || '').trim().toUpperCase();
          const itemNumBt = String(item.num_bt || '').trim().toUpperCase();
          if (itemId === targetBtKey || (itemNumBt && itemNumBt === targetBtKey)) {
            btChanged = true;
            const isClosed =
              String(item.statut || '').toUpperCase() === 'CLOTURE' ||
              String(item.action_fermee || '').toUpperCase() === 'OUI';
            const stillHasBlocking = nextNeeds
              .filter((r) => {
                const rBt = String(r.id_bt || '').trim().toUpperCase();
                return rBt === itemId || rBt === itemNumBt;
              })
              .some((r) => isNeedRequestBlockingBtClosure(r));

            return {
              ...item,
              id_need_request: updatedNeed.id,
              code_need_request: updatedNeed.code_demande,
              statut_need_request: updatedNeed.statut,
              canal_need_request: updatedNeed.canal_appro || null,
              ...(isClosed
                ? {}
                : {
                    statut:
                      !stillHasBlocking && item.statut === 'EN_ATTENTE_PDR'
                        ? 'EN_COURS'
                        : item.statut || 'EN_COURS',
                    action_fermee: 'NON',
                  }),
            };
          }
          return item;
        });

        if (btChanged) {
          set({ correctiveInterventions: nextInterventions });
          DataGateway.saveCorrectiveInterventions(nextInterventions);
        }
      }

      get().appendAuditEvent({
        actorId: context.actorId || actor.actorId,
        actorName: context.actorName || actor.actorName,
        actorRole: effectiveRole,
        actionType: 'NEED_REQUEST_STATUS_CHANGED',
        entityType: 'NEED_REQUEST',
        entityId: updatedNeed.code_demande,
        before: { statut: existing.statut },
        after: { statut: updatedNeed.statut, id_bt: updatedNeed.id_bt },
        meta: {
          summary: `Handoff Besoin ${updatedNeed.code_demande} : ${existing.statut} ➔ ${updatedNeed.statut}`,
        },
      });

      return { valid: true, needRequest: updatedNeed };
    },

    // ==========================================
    // 9. Derived State Getters
    // ==========================================
    stockItems: () => {
      const { rawStock, mouvements } = get();
      return reactiveCalculationEngine.recalculateStockReactive(rawStock, mouvements);
    },

    effectiveDesignations: () => {
      const { designations, rawStock } = get();
      if (
        Array.isArray(designations) &&
        designations.length > 0 &&
        designations.some((d: any) => (d.ref || d.id_designation) && (d.designation || d.libelle))
      ) {
        return designations;
      }
      return (rawStock || []).map((s: any) => ({
        id: s.id,
        ref: s.ref,
        designation: s.designation,
        id_type: s.id_type,
        type: s.type,
        stockInitial: s.stockInitial,
        seuil: s.seuil,
        emplacement: s.emplacement,
      }));
    },

    // ==========================================
    // 10. Global Data Operations
    // ==========================================
    handleLoadDemoData: () =>
      DataGateway.loadDemoData({
        setPdrGroups: get().setPdrGroups,
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
        setWorkshopOrders: get().setWorkshopOrders,
        setAuditEvents: (events: IAuditEvent[]) => set({ auditEvents: events }),
      }),

    handleClearAllForRealFactory: () =>
      DataGateway.clearAllForRealFactory({
        setTypes: get().setTypes,
        setPdrGroups: get().setPdrGroups,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
        setWorkshopOrders: get().setWorkshopOrders,
        setAuditEvents: (events: IAuditEvent[]) => set({ auditEvents: events }),
      }),

    handleLoadDemoSection: (sectionId: string) =>
      DataGateway.loadDemoSection(sectionId, {
        setPdrGroups: get().setPdrGroups,
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    handleClearDemoSection: (sectionId: string) =>
      DataGateway.clearDemoSection(sectionId, {
        setPdrGroups: get().setPdrGroups,
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setGeneralSystemTypes: get().setGeneralSystemTypes,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartGroups: get().setPartGroups,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setSortieDemands: get().setSortieDemands,
        setReplenishmentOrders: get().setReplenishmentOrders,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    // ==========================================
    // 12. Append-Only Enterprise Audit Ledger (AUDIT-LEDGER-P0)
    // ==========================================
    auditEvents: DataGateway.getAuditEvents(),

    appendAuditEvent: (payload) => {
      const actor = resolveActiveActorContext();
      const { event, list } = DataGateway.appendAuditEvent({
        ...payload,
        actorId: payload.actorId || actor.actorId,
        actorName: payload.actorName || actor.actorName,
        actorRole: payload.actorRole || actor.actorRole,
      });
      set({ auditEvents: list });
      return event;
    },

    applyRemoteStateUpdate: (remoteState: Record<string, any>) => {
      if (!remoteState || typeof remoteState !== 'object') return;
      const updates: Record<string, any> = {};

      // Stock
      if (Array.isArray(remoteState.pdrGroups)) updates.pdrGroups = remoteState.pdrGroups;
      if (Array.isArray(remoteState.types)) updates.types = remoteState.types;
      if (Array.isArray(remoteState.rawStock)) updates.rawStock = remoteState.rawStock;
      if (Array.isArray(remoteState.designations)) updates.designations = remoteState.designations;

      // Machines
      if (Array.isArray(remoteState.families)) updates.families = remoteState.families;
      if (Array.isArray(remoteState.templates)) updates.templates = remoteState.templates;
      if (Array.isArray(remoteState.blueprints)) updates.blueprints = remoteState.blueprints;
      if (Array.isArray(remoteState.machines)) updates.machines = normalizeMachinesList(remoteState.machines);
      if (Array.isArray(remoteState.generalSystemTypes)) updates.generalSystemTypes = remoteState.generalSystemTypes;
      if (Array.isArray(remoteState.zones)) updates.zones = remoteState.zones;
      if (Array.isArray(remoteState.machineElementsLedger)) updates.machineElementsLedger = remoteState.machineElementsLedger;

      // Warehouse
      if (Array.isArray(remoteState.warehouseItems)) updates.warehouseItems = remoteState.warehouseItems;
      if (Array.isArray(remoteState.entrepotComponents)) updates.entrepotComponents = remoteState.entrepotComponents;
      if (Array.isArray(remoteState.compGroups)) updates.compGroups = remoteState.compGroups;
      if (Array.isArray(remoteState.compFamilies)) updates.compFamilies = remoteState.compFamilies;
      if (Array.isArray(remoteState.compTemplates)) updates.compTemplates = remoteState.compTemplates;
      if (Array.isArray(remoteState.partGroups)) updates.partGroups = remoteState.partGroups;
      if (Array.isArray(remoteState.partTypes)) updates.partTypes = remoteState.partTypes;
      if (Array.isArray(remoteState.partDesignations)) updates.partDesignations = remoteState.partDesignations;

      // Users
      if (Array.isArray(remoteState.users)) {
        updates.users = remoteState.users;
        updates.technicians = deriveTechnicians(remoteState.users);
        updates.operations = deriveOperations(remoteState.users);
      }
      if (Array.isArray(remoteState.technicians)) updates.technicians = remoteState.technicians;
      if (Array.isArray(remoteState.operations)) updates.operations = remoteState.operations;

      // Movements & Replenishment
      if (Array.isArray(remoteState.mouvements)) updates.mouvements = remoteState.mouvements;
      if (Array.isArray(remoteState.sortieDemands)) updates.sortieDemands = remoteState.sortieDemands;
      if (Array.isArray(remoteState.replenishmentOrders)) updates.replenishmentOrders = remoteState.replenishmentOrders;

      // Preventive
      if (Array.isArray(remoteState.preventiveTasks)) updates.preventiveTasks = remoteState.preventiveTasks;
      if (Array.isArray(remoteState.preventiveActions)) updates.preventiveActions = remoteState.preventiveActions;
      if (Array.isArray(remoteState.preventiveGuides)) updates.preventiveGuides = remoteState.preventiveGuides;
      if (Array.isArray(remoteState.preventivePlans)) updates.preventivePlans = remoteState.preventivePlans;
      if (Array.isArray(remoteState.preventiveExecutions)) updates.preventiveExecutions = remoteState.preventiveExecutions;
      if (Array.isArray(remoteState.meterReadings)) updates.meterReadings = remoteState.meterReadings;

      // Sortie Externe
      if (Array.isArray(remoteState.sortiesExterne)) updates.sortiesExterne = remoteState.sortiesExterne;

      // Audit Events
      if (Array.isArray(remoteState.auditEvents)) updates.auditEvents = remoteState.auditEvents;

      // Corrective
      if (Array.isArray(remoteState.correctiveInterventions)) updates.correctiveInterventions = remoteState.correctiveInterventions;
      if (remoteState.correctiveActionsByPanne && typeof remoteState.correctiveActionsByPanne === 'object') {
        updates.correctiveActionsByPanne = remoteState.correctiveActionsByPanne;
        updates.actionsByPanne = remoteState.correctiveActionsByPanne;
      }
      if (remoteState.correctivePanneCategories && typeof remoteState.correctivePanneCategories === 'object') {
        updates.correctivePanneCategories = remoteState.correctivePanneCategories;
        updates.panneCategories = remoteState.correctivePanneCategories;
      }
      if (Array.isArray(remoteState.correctiveTravauxAFaire)) {
        updates.correctiveTravauxAFaire = remoteState.correctiveTravauxAFaire;
        updates.travauxAFaire = remoteState.correctiveTravauxAFaire;
      }
      if (Array.isArray(remoteState.correctiveIntervenants)) {
        updates.correctiveIntervenants = remoteState.correctiveIntervenants;
        updates.intervenants = remoteState.correctiveIntervenants;
      }
      if (Array.isArray(remoteState.workshopOrders)) {
        updates.workshopOrders = remoteState.workshopOrders;
      }
      if (Array.isArray(remoteState.needRequests)) {
        updates.needRequests = remoteState.needRequests;
      }

      if (Object.keys(updates).length > 0) {
        set(updates);
      }

      if (Array.isArray(remoteState.mouvements) || Array.isArray(remoteState.rawStock)) {
        const effectiveMovements = Array.isArray(remoteState.mouvements)
          ? remoteState.mouvements
          : get().mouvements || [];
        const effectiveRawStock = Array.isArray(remoteState.rawStock)
          ? remoteState.rawStock
          : get().rawStock || [];
        movementRepository.bulkReplace(
          effectiveMovements as any[],
          buildInitialStockMapFromList(effectiveRawStock)
        );
      }
    },
  };
});

if (typeof window !== 'undefined') {
  window.addEventListener('gmao_audit_event_appended', ((e: CustomEvent) => {
    if (Array.isArray(e?.detail?.list)) {
      useGmaoStore.setState({ auditEvents: e.detail.list });
    }
  }) as EventListener);
  window.addEventListener('gmao_audit_events_synced', ((e: CustomEvent) => {
    if (Array.isArray(e?.detail?.list)) {
      useGmaoStore.setState({ auditEvents: e.detail.list });
    }
  }) as EventListener);
}

// Fine-grained slice hooks for optimal re-rendering
export const useStockSlice = () =>
  useGmaoStore((state) => ({
    types: state.types,
    setTypes: state.setTypes,
    pdrGroups: state.pdrGroups,
    setPdrGroups: state.setPdrGroups,
    designations: state.designations,
    setDesignations: state.setDesignations,
    rawStock: state.rawStock,
    setRawStock: state.setRawStock,
  }));

export const useMachineSlice = () =>
  useGmaoStore((state) => ({
    families: state.families,
    setFamilies: state.setFamilies,
    templates: state.templates,
    setTemplates: state.setTemplates,
    blueprints: state.blueprints,
    setBlueprints: state.setBlueprints,
    machines: state.machines,
    setMachines: state.setMachines,
    generalSystemTypes: state.generalSystemTypes,
    setGeneralSystemTypes: state.setGeneralSystemTypes,
    handleAddGeneralSystemType: state.handleAddGeneralSystemType,
    handleToggleGeneralSystemType: state.handleToggleGeneralSystemType,
    zones: state.zones,
    setZones: state.setZones,
    machineElementsLedger: state.machineElementsLedger,
    setMachineElementsLedger: state.setMachineElementsLedger,
    addMachineElement: state.addMachineElement,
    updateMachineElement: state.updateMachineElement,
    deleteMachineElement: state.deleteMachineElement,
    duplicateBOMToTwins: state.duplicateBOMToTwins,
    isValidMachineFamilies: state.isValidMachineFamilies,
    isValidMachineTemplates: state.isValidMachineTemplates,
  }));

export const useWarehouseSlice = () =>
  useGmaoStore((state) => ({
    warehouseItems: state.warehouseItems,
    setWarehouseItems: state.setWarehouseItems,
    entrepotComponents: state.entrepotComponents,
    setEntrepotComponents: state.setEntrepotComponents,
    compGroups: state.compGroups,
    setCompGroups: state.setCompGroups,
    compFamilies: state.compFamilies,
    setCompFamilies: state.setCompFamilies,
    compTemplates: state.compTemplates,
    setCompTemplates: state.setCompTemplates,
    partGroups: state.partGroups,
    setPartGroups: state.setPartGroups,
    partTypes: state.partTypes,
    setPartTypes: state.setPartTypes,
    partDesignations: state.partDesignations,
    setPartDesignations: state.setPartDesignations,
  }));

export const useUserSlice = () =>
  useGmaoStore((state) => ({
    users: state.users,
    setUsers: state.setUsers,
    technicians: state.technicians,
    setTechnicians: state.setTechnicians,
    operations: state.operations,
    setOperations: state.setOperations,
  }));

export const useMovementSlice = () =>
  useGmaoStore((state) => ({
    mouvements: state.mouvements,
    setMouvements: state.setMouvements,
    sortieDemands: state.sortieDemands,
    setSortieDemands: state.setSortieDemands,
    replenishmentOrders: state.replenishmentOrders,
    setReplenishmentOrders: state.setReplenishmentOrders,
    handleCreateReplenishmentOrder: state.handleCreateReplenishmentOrder,
    handleUpdateReplenishmentOrderStatus: state.handleUpdateReplenishmentOrderStatus,
    handleReceiveReplenishmentOrder: state.handleReceiveReplenishmentOrder,
    handleSubmitSortieDemand: state.handleSubmitSortieDemand,
    handleReviewSortieDemandValidation: state.handleReviewSortieDemandValidation,
  }));

export const usePreventiveSlice = () =>
  useGmaoStore((state) => ({
    preventiveTasks: state.preventiveTasks,
    setPreventiveTasks: state.setPreventiveTasks,
    preventiveActions: state.preventiveActions,
    setPreventiveActions: state.setPreventiveActions,
    preventiveGuides: state.preventiveGuides,
    setPreventiveGuides: state.setPreventiveGuides,
    preventivePlans: state.preventivePlans,
    setPreventivePlans: state.setPreventivePlans,
    preventiveExecutions: state.preventiveExecutions,
    setPreventiveExecutions: state.setPreventiveExecutions,
    meterReadings: state.meterReadings,
    setMeterReadings: state.setMeterReadings,
    handleRecordMeterReading: state.handleRecordMeterReading,
    handleBatchRecordMeterReadings: state.handleBatchRecordMeterReadings,
    handleUpdateTask: state.handleUpdateTask,
    handleDeleteTask: state.handleDeleteTask,
    handleUpdateTaskCounter: state.handleUpdateTaskCounter,
    handleMarkTaskDone: state.handleMarkTaskDone,
    handleReviewPreventiveExecutionValidation: state.handleReviewPreventiveExecutionValidation,
    handleDeletePreventiveExecution: state.handleDeletePreventiveExecution,
    handleCreatePlanWithTasks: state.handleCreatePlanWithTasks,
    handleAddAction: state.handleAddAction,
    handleUpdateAction: state.handleUpdateAction,
    handleDeleteAction: state.handleDeleteAction,
    handleAddGuide: state.handleAddGuide,
    handleUpdateGuide: state.handleUpdateGuide,
    handleDeleteGuide: state.handleDeleteGuide,
    handleResetPreventiveToBaseline: state.handleResetPreventiveToBaseline,
    handleClearPreventiveForRealFactory: state.handleClearPreventiveForRealFactory,
  }));

export const useSortieExterneSlice = () =>
  useGmaoStore((state) => ({
    sortiesExterne: state.sortiesExterne,
    setSortiesExterne: state.setSortiesExterne,
    handleAddSortieExterne: state.handleAddSortieExterne,
    handleUpdateSortieExterne: state.handleUpdateSortieExterne,
    handleDeleteSortieExterne: state.handleDeleteSortieExterne,
    handleMarkSortieReturned: state.handleMarkSortieReturned,
    handleMarkSortieMounted: state.handleMarkSortieMounted,
    handleClearSortiesForRealFactory: state.handleClearSortiesForRealFactory,
    handleResetSortiesToBaseline: state.handleResetSortiesToBaseline,
  }));

export const useCorrectiveSlice = () =>
  useGmaoStore((state) => ({
    correctiveInterventions: state.correctiveInterventions,
    setCorrectiveInterventions: state.setCorrectiveInterventions,
    correctiveActionsByPanne: state.correctiveActionsByPanne,
    setCorrectiveActionsByPanne: state.setCorrectiveActionsByPanne,
    correctivePanneCategories: state.correctivePanneCategories,
    setCorrectivePanneCategories: state.setCorrectivePanneCategories,
    correctiveTravauxAFaire: state.correctiveTravauxAFaire,
    setCorrectiveTravauxAFaire: state.setCorrectiveTravauxAFaire,
    correctiveIntervenants: state.correctiveIntervenants,
    setCorrectiveIntervenants: state.setCorrectiveIntervenants,
    activeLiveInterventionId: state.activeLiveInterventionId,
    setActiveLiveInterventionId: state.setActiveLiveInterventionId,
    handleGetCorrectiveActionsForPanne: state.handleGetCorrectiveActionsForPanne,
    handleAddCorrectiveActionForPanne: state.handleAddCorrectiveActionForPanne,
    handleUpdateCorrectiveActionForPanne: state.handleUpdateCorrectiveActionForPanne,
    handleDeleteCorrectiveActionForPanne: state.handleDeleteCorrectiveActionForPanne,
    handleAddPanne: state.handleAddPanne,
    handleUpdatePanne: state.handleUpdatePanne,
    handleDeletePanne: state.handleDeletePanne,
    handleAddTravail: state.handleAddTravail,
    handleUpdateTravail: state.handleUpdateTravail,
    handleDeleteTravail: state.handleDeleteTravail,
    handleResetCorrectiveActions: state.handleResetCorrectiveActions,
    handleForceSyncCorrectiveSeed: state.handleForceSyncCorrectiveSeed,
    handleAddDemandeIntervention: state.handleAddDemandeIntervention,
    handleConvertToBt: state.handleConvertToBt,
    handleStartLiveIntervention: state.handleStartLiveIntervention,
    handleSubmitInterventionForValidation: state.handleSubmitInterventionForValidation,
    handleReviewInterventionValidation: state.handleReviewInterventionValidation,
    handleClotureIntervention: state.handleClotureIntervention,
    handleUpdateCorrectiveIntervention: state.handleUpdateCorrectiveIntervention,
    handleDeleteCorrectiveIntervention: state.handleDeleteCorrectiveIntervention,
    handleBulkImportCorrective: state.handleBulkImportCorrective,
    handleResetCorrectiveToSeed: state.handleResetCorrectiveToSeed,
    correctiveKpis: state.correctiveKpis,
    correctiveParetoAnomalies: state.correctiveParetoAnomalies,
    correctiveParetoMachines: state.correctiveParetoMachines,
    correctiveParetoTypes: state.correctiveParetoTypes,
    correctivePreventiveRecommendations: state.correctivePreventiveRecommendations,
  }));
