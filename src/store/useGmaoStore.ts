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
import { dataIntegrityService } from '../services/dataIntegrityService';
import { reactiveCalculationEngine } from '../services/reactiveCalculationEngine';
import { loadBaselineCorrectiveData } from '../utils/baselineCorrective';

import initialStockSeed from '../data/stock/seedStockItems.json';
import initialStockTypes from '../data/stock/seedStockTypes.json';
import initialFamilies from '../data/machines/seedFamilies.json';
import initialTemplates from '../data/machines/seedTemplates.json';
import initialBlueprints from '../data/machines/seedBlueprints.json';
import initialMachines from '../data/machines/seedMachines.json';
import initialZones from '../data/machines/seedZones.json';
import initialMachineBomLedger from '../data/machines/seedMachineBomLedger.json';
import initialWarehouseItems from '../data/warehouse/seedWarehouseItems.json';
import initialCompGroups from '../data/warehouse/seedCompGroups.json';
import initialCompFamilies from '../data/warehouse/seedCompFamilies.json';
import initialCompTemplates from '../data/warehouse/seedCompTemplates.json';
import initialEntrepotComponents from '../data/warehouse/seedEntrepotComponents.json';
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
import SortieExterneService, { INITIAL_SORTIES_BOBINAGE } from '../application/services/SortieExterneService';
import { CorrectiveIntervention } from '../domain/corrective/entities/CorrectiveIntervention';
import { CorrectiveCalculationService } from '../domain/corrective/services/CorrectiveCalculationService';
import { movementRepository } from '../application/MovementRepository';

const ACTIVE_LIVE_KEY = STORAGE_KEYS.CORRECTIVE_ACTIVE_LIVE;

function resolveUpdate<T>(updater: T | ((prev: T) => T), current: T): T {
  return typeof updater === 'function' ? (updater as (prev: T) => T)(current) : updater;
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
  return { types, rawStock, designations };
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
    allowDemoFallback: true,
    demoSeed: initialBlueprints,
  });
  const machines = loadCollection(STORAGE_KEYS.MACHINES, {
    allowDemoFallback: true,
    demoSeed: initialMachines,
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
  return { families, templates, blueprints, machines, zones, machineElementsLedger };
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
  return { mouvements };
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
    allowDemoFallback: true,
    demoSeed: initialTasks,
  });
  const executions = loadCollection(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  return { actions, guides, plans, tasks, executions };
}

function getInitialSorties() {
  const sorties = loadCollection(STORAGE_KEYS.SORTIE_EXTERNE, {
    allowDemoFallback: true,
    demoSeed: INITIAL_SORTIES_BOBINAGE,
  });
  return { sorties };
}

function getInitialCorrective() {
  const interventions = loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, {
    allowDemoFallback: true,
    demoSeed: initialInterventions,
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
  const activeLiveId = storageService.getItem(ACTIVE_LIVE_KEY) || null;
  return {
    interventions,
    actionsByPanne,
    panneCategories,
    travauxAFaire,
    intervenants,
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

    setTypes: (updater) => {
      const next = resolveUpdate(updater, get().types);
      set({ types: next });
      DataGateway.saveStockTypes(next);
    },

    setRawStock: (updater) => {
      const next = resolveUpdate(updater, get().rawStock);
      set({ rawStock: next });
      DataGateway.saveStock(next);
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
      const next = resolveUpdate(updater, get().machines);
      set({ machines: next });
      DataGateway.saveMachines(next);
    },

    setZones: (updater) => {
      const next = resolveUpdate(updater, get().zones);
      set({ zones: next });
      DataGateway.saveZones(next);
    },

    setMachineElementsLedger: (updater) => {
      const next = resolveUpdate(updater, get().machineElementsLedger);
      set({ machineElementsLedger: next });
      DataGateway.saveMachineBom(next);
    },

    addMachineElement: (element) => {
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
      const next = get().machineElementsLedger.filter((item) => item.id !== id);
      set({ machineElementsLedger: next });
      DataGateway.saveMachineBom(next);
    },

    duplicateBOMToTwins: (sourceMachineId, targetMachineIds = []) => {
      const prev = get().machineElementsLedger;
      const sourceElements = prev.filter((e) => e.id_machine_registered === sourceMachineId);
      if (sourceElements.length === 0 || !Array.isArray(targetMachineIds) || targetMachineIds.length === 0) {
        return;
      }
      const cloned: any[] = [];
      targetMachineIds.forEach((targetId) => {
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
    partTypes: warehouseInit.partTypes,
    partDesignations: warehouseInit.partDesignations,

    setWarehouseItems: (updater) => {
      const next = resolveUpdate(updater, get().warehouseItems);
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
      const next = resolveUpdate(updater, get().users).filter(isRealPersonnelUser);
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
      set({ operations: cleanNext });
      DataGateway.saveOperations(cleanNext);
    },

    // ==========================================
    // 5. Movements Slice
    // ==========================================
    mouvements: movementsInit.mouvements,

    setMouvements: (updater) => {
      const next = resolveUpdate(updater, get().mouvements);
      set({ mouvements: next });
      DataGateway.saveMovements(next);
    },

    // ==========================================
    // 6. Preventive Slice
    // ==========================================
    preventiveTasks: preventiveInit.tasks,
    preventiveActions: preventiveInit.actions,
    preventiveGuides: preventiveInit.guides,
    preventivePlans: preventiveInit.plans,
    preventiveExecutions: preventiveInit.executions,

    setPreventiveTasks: (updater) => {
      const next = resolveUpdate(updater, get().preventiveTasks);
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
      const next = resolveUpdate(updater, get().preventivePlans);
      set({ preventivePlans: next });
      DataGateway.savePreventivePlans(next);
    },

    setPreventiveExecutions: (updater) => {
      const next = resolveUpdate(updater, get().preventiveExecutions);
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
      const next = get().preventiveTasks.filter((t) => t.id !== id);
      set({ preventiveTasks: next });
      DataGateway.savePreventiveTasks(next);
    },

    handleUpdateTaskCounter: (id, newCounterValue) => {
      const next = get().preventiveTasks.map((t) =>
        t.id === id ? { ...t, dernier_releve: Number(newCounterValue || 0), updated_at: new Date().toISOString() } : t
      );
      set({ preventiveTasks: next });
      DataGateway.savePreventiveTasks(next);
    },

    handleMarkTaskDone: (id, validationData) => {
      const updated = PreventiveService.markTaskAsDone(id, validationData);
      const executions = PreventiveService.getExecutions();
      set({ preventiveTasks: updated, preventiveExecutions: executions });
    },

    handleDeletePreventiveExecution: (id) => {
      const updated = PreventiveService.deleteExecution(id);
      set({ preventiveExecutions: updated });
    },

    handleCreatePlanWithTasks: (planData, taskItems) => {
      const result = PreventiveService.createPlanWithTasks(planData, taskItems);
      set({
        preventivePlans: [result.plan, ...get().preventivePlans],
        preventiveTasks: [...result.tasks, ...get().preventiveTasks],
      });
      return result;
    },

    handleAddAction: (actionData) => {
      const updated = PreventiveService.addAction(actionData);
      set({ preventiveActions: updated });
      return updated;
    },

    handleUpdateAction: (id, actionData) => {
      const updated = PreventiveService.updateAction(id, actionData);
      set({ preventiveActions: updated });
      return updated;
    },

    handleDeleteAction: (id) => {
      const updated = PreventiveService.deleteAction(id);
      set({ preventiveActions: updated });
      return updated;
    },

    handleAddGuide: (guideData) => {
      const updated = PreventiveService.addGuide(guideData);
      set({ preventiveGuides: updated });
      return updated;
    },

    handleUpdateGuide: (id, guideData) => {
      const updated = PreventiveService.updateGuide(id, guideData);
      set({ preventiveGuides: updated });
      return updated;
    },

    handleDeleteGuide: (id) => {
      const updated = PreventiveService.deleteGuide(id);
      set({ preventiveGuides: updated });
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

      if (!skipConfirm && typeof window !== 'undefined' && !window.confirm(msg)) {
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

    handleClearPreventiveForRealFactory: (ctx = {}) => {
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

      if (!skipConfirm && typeof window !== 'undefined' && !window.confirm(msg)) {
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
      const next = resolveUpdate(updater, get().sortiesExterne);
      set({ sortiesExterne: next });
      DataGateway.saveSortiesExterne(next);
    },

    handleAddSortieExterne: (sortieData) => {
      const created = SortieExterneService.addSortie(sortieData);
      set({ sortiesExterne: [created, ...get().sortiesExterne] });
      return created;
    },

    handleUpdateSortieExterne: (id, sortieData) => {
      const updated = SortieExterneService.updateSortie(id, sortieData);
      set({ sortiesExterne: get().sortiesExterne.map((s) => (s.id === id ? updated : s)) });
      return updated;
    },

    handleDeleteSortieExterne: (id) => {
      SortieExterneService.deleteSortie(id);
      set({ sortiesExterne: get().sortiesExterne.filter((s) => s.id !== id) });
    },

    handleMarkSortieReturned: (id, returnData) => {
      const updated = SortieExterneService.markAsReturned(id, returnData);
      set({ sortiesExterne: get().sortiesExterne.map((s) => (s.id === id ? updated : s)) });
      return updated;
    },

    handleMarkSortieMounted: (id, mountData) => {
      const updated = SortieExterneService.markAsMounted(id, mountData);
      set({ sortiesExterne: get().sortiesExterne.map((s) => (s.id === id ? updated : s)) });
      return updated;
    },

    handleClearSortiesForRealFactory: () => {
      const count = get().sortiesExterne.length;
      if (count > 0 && typeof window !== 'undefined' && !window.confirm(`Supprimer les ${count} sorties externes pour usine réelle ?`)) {
        return { cancelled: true };
      }
      SortieExterneService.clearAll();
      set({ sortiesExterne: [] });
      return { cancelled: false, clearedCount: count };
    },

    handleResetSortiesToBaseline: () => {
      SortieExterneService.resetToBaseline();
      set({ sortiesExterne: INITIAL_SORTIES_BOBINAGE });
      return { cancelled: false, count: INITIAL_SORTIES_BOBINAGE.length };
    },

    // ==========================================
    // 8. Corrective Nexus Slice
    // ==========================================
    correctiveInterventions: correctiveInit.interventions,
    actionsByPanne: correctiveInit.actionsByPanne,
    panneCategories: correctiveInit.panneCategories,
    travauxAFaire: correctiveInit.travauxAFaire,
    intervenants: correctiveInit.intervenants,
    activeLiveInterventionId: correctiveInit.activeLiveId,

    setCorrectiveInterventions: (updater) => {
      const next = resolveUpdate(updater, get().correctiveInterventions);
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
    },

    setCorrectiveActionsByPanne: (updater) => {
      const next = resolveUpdate(updater, get().actionsByPanne);
      set({ actionsByPanne: next });
      DataGateway.saveCorrectiveActionsByPanne(next);
    },

    setCorrectivePanneCategories: (updater) => {
      const next = resolveUpdate(updater, get().panneCategories);
      set({ panneCategories: next });
      DataGateway.saveCorrectivePanneCategories(next);
    },

    setCorrectiveTravauxAFaire: (updater) => {
      const next = resolveUpdate(updater, get().travauxAFaire);
      set({ travauxAFaire: next });
      DataGateway.saveCorrectiveTravaux(next);
    },

    setCorrectiveIntervenants: (updater) => {
      const next = resolveUpdate(updater, get().intervenants);
      set({ intervenants: next });
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
      const actionsByPanne = get().actionsByPanne;
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
        if (key.toLowerCase().replace(/_/g, ' ').trim() === lower) return acts;
      }
      for (const [key, acts] of Object.entries(actionsByPanne)) {
        const normKey = key.toLowerCase().replace(/_/g, ' ').trim();
        if (normKey.includes(lower) || lower.includes(normKey)) return acts;
      }
      return [];
    },

    handleAddCorrectiveActionForPanne: (panneKey, actionText) => {
      if (!panneKey || !actionText) return;
      const cleanAction = String(actionText).trim();
      if (!cleanAction) return;
      const prev = get().actionsByPanne;
      const existing = prev[panneKey] || [];
      if (existing.includes(cleanAction)) return;
      const updated = { ...prev, [panneKey]: [...existing, cleanAction] };
      set({ actionsByPanne: updated });
      DataGateway.saveCorrectiveActionsByPanne(updated);
    },

    handleUpdateCorrectiveActionForPanne: (panneKey, actionIndex, newActionText) => {
      if (!panneKey || actionIndex < 0 || !newActionText) return;
      const cleanAction = String(newActionText).trim();
      if (!cleanAction) return;
      const prev = get().actionsByPanne;
      const existing = prev[panneKey] || [];
      if (actionIndex >= existing.length) return;
      const updatedList = existing.map((act, idx) => (idx === actionIndex ? cleanAction : act));
      const updated = { ...prev, [panneKey]: updatedList };
      set({ actionsByPanne: updated });
      DataGateway.saveCorrectiveActionsByPanne(updated);
    },

    handleDeleteCorrectiveActionForPanne: (panneKey, actionIndex) => {
      if (!panneKey || actionIndex < 0) return;
      const prev = get().actionsByPanne;
      const existing = prev[panneKey] || [];
      if (actionIndex >= existing.length) return;
      const updatedList = existing.filter((_, idx) => idx !== actionIndex);
      const updated = { ...prev };
      if (updatedList.length > 0) {
        updated[panneKey] = updatedList;
      } else {
        delete updated[panneKey];
      }
      set({ actionsByPanne: updated });
      DataGateway.saveCorrectiveActionsByPanne(updated);
    },

    handleAddPanne: (category, panneCode) => {
      if (!category || !panneCode) return;
      const cleanCat = String(category).trim().toUpperCase();
      const cleanCode = String(panneCode).trim();
      if (!cleanCode) return;
      const prev = get().panneCategories;
      const existingList = prev[cleanCat] || [];
      if (existingList.includes(cleanCode)) return;
      const updated = { ...prev, [cleanCat]: [...existingList, cleanCode] };
      set({ panneCategories: updated });
      DataGateway.saveCorrectivePanneCategories(updated);
    },

    handleUpdatePanne: (category, oldCode, newCode) => {
      if (!category || !oldCode || !newCode) return;
      const cleanCat = String(category).trim();
      const cleanOld = String(oldCode).trim();
      const cleanNew = String(newCode).trim();
      if (!cleanNew || cleanOld === cleanNew) return;

      const prevCats = get().panneCategories;
      const list = prevCats[cleanCat] || [];
      const updatedCats = {
        ...prevCats,
        [cleanCat]: list.map((item) => (item === cleanOld ? cleanNew : item)),
      };

      const prevActions = get().actionsByPanne;
      let updatedActions = prevActions;
      if (prevActions[cleanOld] && !prevActions[cleanNew]) {
        updatedActions = { ...prevActions, [cleanNew]: prevActions[cleanOld] };
        delete updatedActions[cleanOld];
      }

      set({ panneCategories: updatedCats, actionsByPanne: updatedActions });
      DataGateway.saveCorrectivePanneCategories(updatedCats);
      DataGateway.saveCorrectiveActionsByPanne(updatedActions);
    },

    handleDeletePanne: (category, panneCode) => {
      if (!category || !panneCode) return;
      const cleanCat = String(category).trim();
      const cleanCode = String(panneCode).trim();

      const prevCats = get().panneCategories;
      const list = prevCats[cleanCat] || [];
      const updatedCats = {
        ...prevCats,
        [cleanCat]: list.filter((item) => item !== cleanCode),
      };

      const prevActions = get().actionsByPanne;
      const updatedActions = { ...prevActions };
      if (updatedActions[cleanCode]) {
        delete updatedActions[cleanCode];
      }

      set({ panneCategories: updatedCats, actionsByPanne: updatedActions });
      DataGateway.saveCorrectivePanneCategories(updatedCats);
      DataGateway.saveCorrectiveActionsByPanne(updatedActions);
    },

    handleAddTravail: (travailText) => {
      if (!travailText) return;
      const cleanText = String(travailText).trim();
      if (!cleanText) return;
      const prev = get().travauxAFaire;
      if (prev.includes(cleanText)) return;
      const updated = [...prev, cleanText];
      set({ travauxAFaire: updated });
      DataGateway.saveCorrectiveTravaux(updated);
    },

    handleUpdateTravail: (oldText, newText) => {
      if (!oldText || !newText) return;
      const cleanOld = String(oldText).trim();
      const cleanNew = String(newText).trim();
      if (!cleanNew || cleanOld === cleanNew) return;
      const updated = get().travauxAFaire.map((item) => (item === cleanOld ? cleanNew : item));
      set({ travauxAFaire: updated });
      DataGateway.saveCorrectiveTravaux(updated);
    },

    handleDeleteTravail: (travailText) => {
      if (!travailText) return;
      const cleanText = String(travailText).trim();
      const updated = get().travauxAFaire.filter((item) => item !== cleanText);
      set({ travauxAFaire: updated });
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
        actionsByPanne,
        panneCategories,
        travauxAFaire,
        intervenants,
      });

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
      const newDi = new CorrectiveIntervention({
        ...data,
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
      let convertedItem: any = null;
      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          const num_bt = btDetails.num_bt || `BT-${Math.floor(1000 + Math.random() * 9000)}`;
          convertedItem = new CorrectiveIntervention({
            ...item,
            ...btDetails,
            num_bt,
            statut: 'EN_COURS',
            date_debut: btDetails.date_debut || new Date().toISOString().split('T')[0],
            heure_debut: btDetails.heure_debut || new Date().toTimeString().slice(0, 5),
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

    handleClotureIntervention: (id, clotureData = {}, onAddMouvement = null) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const timeNow = now.toTimeString().slice(0, 5);
      let updated: any = null;

      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          const dDebut = item.date_debut || clotureData.date_debut || today;
          const hDebut = item.heure_debut || clotureData.heure_debut || '08:00';
          const dFin = clotureData.date_fin || today;
          const hFin = clotureData.heure_fin || timeNow;
          const timeCalc = CorrectiveCalculationService.calculateWorkingTime(dDebut, hDebut, dFin, hFin);

          updated = new CorrectiveIntervention({
            ...item,
            ...clotureData,
            date_debut: dDebut,
            heure_debut: hDebut,
            date_fin: dFin,
            heure_fin: hFin,
            temps_intervention: timeCalc.formatted,
            temps_intervention_mins: timeCalc.minutes,
            action_fermee: 'OUI',
            statut: 'CLOTURE',
            rapport_redige: 'OUI',
          }).toJSON();

          if (updated.pdr_ref && Number(updated.pdr_quantite) > 0) {
            const btIdentifier = updated.num_bt || updated.id;
            const mvt: any = {
              id: `MVT-BT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
              code_bon: `BS-BT-${btIdentifier}`,
              ref: updated.pdr_ref,
              code_article: updated.pdr_ref,
              designation: updated.pdr_designation || updated.pdr_ref,
              type: 'Sortie',
              quantite: Number(updated.pdr_quantite),
              date: dFin,
              machine: updated.code_machine,
              id_machine_registered: updated.code_machine,
              technicien: updated.intervenant || 'Technicien',
              demandeur: updated.intervenant || 'Technicien GMAO',
              prix_unitaire: Number(updated.pdr_prix) || 0,
              unite: updated.pdr_unite || 'Pièce',
              motif: `Consommation BT ${btIdentifier} · Machine: ${updated.code_machine}`,
              observation: `Sortie PDR automatique clôture BT ${btIdentifier} (${updated.anomalie || 'Correctif'})`,
            };

            try {
              movementRepository.add(mvt);
            } catch (err) {
              console.warn('[useGmaoStore] Failed to add movement via repository:', err);
            }

            if (typeof onAddMouvement === 'function') {
              try {
                onAddMouvement(mvt);
              } catch (e) {
                console.warn('[useGmaoStore] onAddMouvement error:', e);
              }
            }
          }

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

    handleUpdateCorrectiveIntervention: (id, patch = {}) => {
      const next = get().correctiveInterventions.map((item) => {
        if (item.id === id) {
          return new CorrectiveIntervention({ ...item, ...patch }).toJSON();
        }
        return item;
      });
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
    },

    handleDeleteCorrectiveIntervention: (id) => {
      const next = get().correctiveInterventions.filter((item) => item.id !== id);
      set({ correctiveInterventions: next });
      DataGateway.saveCorrectiveInterventions(next);
      if (get().activeLiveInterventionId === id) {
        get().setActiveLiveInterventionId(null);
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

      if (!skipConfirm && typeof window !== 'undefined' && !window.confirm(msg)) {
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
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    handleClearAllForRealFactory: () =>
      DataGateway.clearAllForRealFactory({
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    handleLoadDemoSection: (sectionId: string) =>
      DataGateway.loadDemoSection(sectionId, {
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    handleClearDemoSection: (sectionId: string) =>
      DataGateway.clearDemoSection(sectionId, {
        setTypes: get().setTypes,
        setDesignations: get().setDesignations,
        setRawStock: get().setRawStock,
        setFamilies: get().setFamilies,
        setTemplates: get().setTemplates,
        setBlueprints: get().setBlueprints,
        setMachines: get().setMachines,
        setZones: get().setZones,
        setMachineElementsLedger: get().setMachineElementsLedger,
        setWarehouseItems: get().setWarehouseItems,
        setEntrepotComponents: get().setEntrepotComponents,
        setCompGroups: get().setCompGroups,
        setCompFamilies: get().setCompFamilies,
        setCompTemplates: get().setCompTemplates,
        setPartTypes: get().setPartTypes,
        setPartDesignations: get().setPartDesignations,
        setUsers: get().setUsers,
        setTechnicians: get().setTechnicians,
        setOperations: get().setOperations,
        setMouvements: get().setMouvements,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setSortiesExterne: get().setSortiesExterne,
        setCorrectiveInterventions: get().setCorrectiveInterventions,
        setCorrectiveActionsByPanne: get().setCorrectiveActionsByPanne,
        setCorrectivePanneCategories: get().setCorrectivePanneCategories,
        setCorrectiveTravauxAFaire: get().setCorrectiveTravauxAFaire,
        setCorrectiveIntervenants: get().setCorrectiveIntervenants,
      }),

    applyRemoteStateUpdate: (remoteState: Record<string, any>) => {
      if (!remoteState || typeof remoteState !== 'object') return;
      const updates: Record<string, any> = {};

      // Stock
      if (Array.isArray(remoteState.types)) updates.types = remoteState.types;
      if (Array.isArray(remoteState.rawStock)) updates.rawStock = remoteState.rawStock;
      if (Array.isArray(remoteState.designations)) updates.designations = remoteState.designations;

      // Machines
      if (Array.isArray(remoteState.families)) updates.families = remoteState.families;
      if (Array.isArray(remoteState.templates)) updates.templates = remoteState.templates;
      if (Array.isArray(remoteState.blueprints)) updates.blueprints = remoteState.blueprints;
      if (Array.isArray(remoteState.machines)) updates.machines = remoteState.machines;
      if (Array.isArray(remoteState.zones)) updates.zones = remoteState.zones;
      if (Array.isArray(remoteState.machineElementsLedger)) updates.machineElementsLedger = remoteState.machineElementsLedger;

      // Warehouse
      if (Array.isArray(remoteState.warehouseItems)) updates.warehouseItems = remoteState.warehouseItems;
      if (Array.isArray(remoteState.entrepotComponents)) updates.entrepotComponents = remoteState.entrepotComponents;
      if (Array.isArray(remoteState.compGroups)) updates.compGroups = remoteState.compGroups;
      if (Array.isArray(remoteState.compFamilies)) updates.compFamilies = remoteState.compFamilies;
      if (Array.isArray(remoteState.compTemplates)) updates.compTemplates = remoteState.compTemplates;
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

      // Movements
      if (Array.isArray(remoteState.mouvements)) updates.mouvements = remoteState.mouvements;

      // Preventive
      if (Array.isArray(remoteState.preventiveTasks)) updates.preventiveTasks = remoteState.preventiveTasks;
      if (Array.isArray(remoteState.preventiveActions)) updates.preventiveActions = remoteState.preventiveActions;
      if (Array.isArray(remoteState.preventiveGuides)) updates.preventiveGuides = remoteState.preventiveGuides;
      if (Array.isArray(remoteState.preventivePlans)) updates.preventivePlans = remoteState.preventivePlans;
      if (Array.isArray(remoteState.preventiveExecutions)) updates.preventiveExecutions = remoteState.preventiveExecutions;

      // Sortie Externe
      if (Array.isArray(remoteState.sortiesExterne)) updates.sortiesExterne = remoteState.sortiesExterne;

      // Corrective
      if (Array.isArray(remoteState.correctiveInterventions)) updates.correctiveInterventions = remoteState.correctiveInterventions;
      if (remoteState.correctiveActionsByPanne && typeof remoteState.correctiveActionsByPanne === 'object') {
        updates.correctiveActionsByPanne = remoteState.correctiveActionsByPanne;
      }
      if (remoteState.correctivePanneCategories && typeof remoteState.correctivePanneCategories === 'object') {
        updates.correctivePanneCategories = remoteState.correctivePanneCategories;
      }
      if (Array.isArray(remoteState.correctiveTravauxAFaire)) updates.correctiveTravauxAFaire = remoteState.correctiveTravauxAFaire;
      if (Array.isArray(remoteState.correctiveIntervenants)) updates.correctiveIntervenants = remoteState.correctiveIntervenants;

      if (Object.keys(updates).length > 0) {
        set(updates);
      }
    },
  };
});

// Fine-grained slice hooks for optimal re-rendering
export const useStockSlice = () =>
  useGmaoStore((state) => ({
    types: state.types,
    setTypes: state.setTypes,
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
    handleUpdateTask: state.handleUpdateTask,
    handleDeleteTask: state.handleDeleteTask,
    handleUpdateTaskCounter: state.handleUpdateTaskCounter,
    handleMarkTaskDone: state.handleMarkTaskDone,
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
