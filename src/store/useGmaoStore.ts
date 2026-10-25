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
import { confirmAction } from '../utils/confirmAction';

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
import { WorkOrderStateMachine } from '../domain/corrective/services/WorkOrderStateMachine';
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
    allowDemoFallback: false,
    demoSeed: [],
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
    allowDemoFallback: false,
    demoSeed: [],
  });
  const executions = loadCollection(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, {
    allowDemoFallback: false,
    demoSeed: [],
  });
  return { actions, guides, plans, tasks, executions };
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
      const targetTask = get().preventiveTasks.find((t) => String(t.id) === String(id));
      const targetMachine = String(targetTask?.id_machine || '').trim().toUpperCase();
      const numericVal = Number(newCounterValue || 0);
      const nowIso = new Date().toISOString();

      const next = get().preventiveTasks.map((t) => {
        const isSameTask = String(t.id) === String(id);
        const isSameMachine =
          targetMachine && String(t.id_machine || '').trim().toUpperCase() === targetMachine;
        if (isSameTask || isSameMachine) {
          return {
            ...t,
            dernier_releve: numericVal,
            compteur_actuel: numericVal,
            updated_at: nowIso,
          };
        }
        return t;
      });
      set({ preventiveTasks: next });
      DataGateway.savePreventiveTasks(next);

      if (targetMachine && numericVal > 0) {
        const today = nowIso.split('T')[0];
        const nextMachines = (get().machines || []).map((m: any) => {
          const mCode = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
          if (mCode === targetMachine) {
            return {
              ...m,
              compteur_heures: numericVal,
              dernier_releve_compteur: numericVal,
              date_releve_compteur: today,
            };
          }
          return m;
        });
        set({ machines: nextMachines });
        DataGateway.saveMachines(nextMachines);
      }
    },

    handleMarkTaskDone: (id, validationData) => {
      const targetTask = get().preventiveTasks.find((t) => String(t.id) === String(id));
      const targetMachine = String(targetTask?.id_machine || '').trim().toUpperCase();
      const releveNum = Number(
        validationData?.compteur_releve ?? validationData?.dernier_releve ?? 0
      );

      const updated = PreventiveService.markTaskAsDone(id, validationData);
      const executions = PreventiveService.getExecutions();
      set({ preventiveTasks: updated, preventiveExecutions: executions });
      DataGateway.savePreventiveTasks(updated);
      DataGateway.savePreventiveExecutions(executions);

      if (targetMachine && releveNum > 0) {
        const dateRealisation =
          validationData?.date_realisation ||
          validationData?.date_execution ||
          new Date().toISOString().split('T')[0];
        const nextMachines = (get().machines || []).map((m: any) => {
          const mCode = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
          if (mCode === targetMachine) {
            return {
              ...m,
              compteur_heures: releveNum,
              dernier_releve_compteur: releveNum,
              date_releve_compteur: dateRealisation,
            };
          }
          return m;
        });
        set({ machines: nextMachines });
        DataGateway.saveMachines(nextMachines);
      }
    },

    handleDeletePreventiveExecution: (id) => {
      const updated = PreventiveService.deleteExecution(id);
      set({ preventiveExecutions: updated });
      DataGateway.savePreventiveExecutions(updated);
    },

    handleCreatePlanWithTasks: (planData, taskItems) => {
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

    handleClearSortiesForRealFactory: async () => {
      const count = get().sortiesExterne.length;
      if (count > 0 && !(await confirmAction({ title: 'Supprimer les sorties externes', message: `Supprimer les ${count} sorties externes pour usine réelle ?`, variant: 'danger' }))) {
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
      const next = resolveUpdate(updater, get().correctiveInterventions);
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
        console.warn('[useGmaoStore] handleConvertToBt transition blocked:', validation.reason);
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
        console.warn('[useGmaoStore] handleStartLiveIntervention transition blocked:', validation.reason);
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
        console.warn(`[useGmaoStore] handleSubmitInterventionForValidation blocked: intervention ${id} is already closed.`);
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
        console.warn('[useGmaoStore] handleSubmitInterventionForValidation blocked: missing work description.');
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
          const dDebut = item.date_debut || submissionData.date_debut || today;
          const hDebut = item.heure_debut || submissionData.heure_debut || '08:00';
          const dFin = submissionData.date_fin_proposee || submissionData.date_fin || today;
          const hFin = submissionData.heure_fin_proposee || submissionData.heure_fin || timeNow;
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

          updated = new CorrectiveIntervention({
            ...item,
            travail_a_faire: submissionData.travail_a_faire ?? item.travail_a_faire ?? '',
            action_realisee: submissionData.action_realisee ?? submissionData.travail_a_faire ?? item.action_realisee ?? '',
            arret_machine: submissionData.arret_machine !== undefined ? Boolean(submissionData.arret_machine) : item.arret_machine,
            temps_arret: submissionData.temps_arret ?? item.temps_arret ?? '',
            marque: submissionData.marque ?? item.marque ?? '',
            etat_piece: submissionData.etat_piece ?? item.etat_piece ?? 'Neuve',
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
            // Store Technician Field Claim in proposal layer
            pieces_proposees: normalizedProposed,
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
        const approvedPieces =
          decisionData.pieces_utilisees !== undefined
            ? decisionData.pieces_utilisees
            : decisionData.pieces_proposees !== undefined
            ? decisionData.pieces_proposees
            : Array.isArray(existing.pieces_proposees)
            ? existing.pieces_proposees
            : existing.pieces_utilisees || [];

        return get().handleClotureIntervention(
          id,
          {
            ...decisionData,
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
      }

      if (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') {
        if (String(existing.action_fermee || '').trim().toUpperCase() === 'OUI') {
          console.warn(`[useGmaoStore] handleReviewInterventionValidation blocked: intervention ${id} is already closed.`);
          return null;
        }

        const nowIso = new Date().toISOString();
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
        return updated;
      }

      return null;
    },

    handleClotureIntervention: (id, clotureData = {}, onAddMouvement = null) => {
      const existing = get().correctiveInterventions.find((item) => item.id === id);
      if (!existing) return null;

      // Re-closure & FSM guard: never re-close an already closed BT or emit duplicate stock movements
      if (String(existing.action_fermee || '').trim().toUpperCase() === 'OUI') {
        console.warn(`[useGmaoStore] handleClotureIntervention blocked: intervention ${id} is already closed.`);
        return null;
      }

      const validation = WorkOrderStateMachine.validateTransition(existing, 'CLOTURE', clotureData);
      if (!validation.valid) {
        console.warn('[useGmaoStore] handleClotureIntervention blocked:', validation.reason);
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
          const dDebut = item.date_debut || clotureData.date_debut || today;
          const hDebut = item.heure_debut || clotureData.heure_debut || '08:00';
          const dFin = clotureData.date_fin || item.date_fin_proposee || today;
          const hFin = clotureData.heure_fin || item.heure_fin_proposee || timeNow;
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

          const resolvedCompId = String(clotureData.id_composant ?? item.id_composant ?? '').trim();
          const resolvedPartId = String(clotureData.id_part ?? item.id_part ?? '').trim();
          const matchedComp = resolvedCompId
            ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === resolvedCompId)
            : null;
          const matchedPart = resolvedPartId
            ? warehouseList.find((w: any) => String(w.id_warehouse_item || w.id || w.id_item || '').trim() === resolvedPartId)
            : null;

          updated = new CorrectiveIntervention({
            ...item,
            ...clotureData,
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
            cout_pdr: totalPdrCost,
            pdr_cost: totalPdrCost,
            date_debut: dDebut,
            heure_debut: hDebut,
            date_fin: dFin,
            heure_fin: hFin,
            temps_intervention: timeCalc.formatted,
            temps_intervention_calc: timeCalc.formatted,
            temps_intervention_mins: timeCalc.minutes,
            temps_minutes: timeCalc.minutes,
            validation_status: 'APPROVED',
            validated_by_id: clotureData.validated_by_id || item.validated_by_id || 'admin',
            validated_by_name:
              clotureData.validated_by_name || item.validated_by_name || 'Administrateur',
            validated_at: clotureData.validated_at || item.validated_at || now.toISOString(),
            action_fermee: 'OUI',
            statut: 'CLOTURE',
            rapport_redige: 'OUI',
          }).toJSON();

          if (normalizedPieces.length > 0) {
            const btIdentifier = updated.num_bt || updated.id;
            normalizedPieces.forEach((piece, idx) => {
              const suffix = normalizedPieces.length > 1 ? `-${idx + 1}` : '';
              movementsToRecord.push({
                id: `MVT-BT-${Date.now()}-${idx}-${Math.floor(100 + Math.random() * 900)}`,
                code_bon: `BS-BT-${btIdentifier}${suffix}`,
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
              console.warn('[useGmaoStore] onAddMouvement error:', e);
            }
          });
        } else {
          movementsToRecord.forEach((mvt) => {
            try {
              movementRepository.add(mvt);
            } catch (err) {
              console.warn('[useGmaoStore] Failed to add movement via repository:', err);
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
          console.warn('[useGmaoStore] handleUpdateCorrectiveIntervention transition blocked:', validation.reason);
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
