import { STORAGE_KEYS, LEGACY_KEY_MAP, ALL_LEGACY_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { indexedDBService } from '../infrastructure/database/IndexedDBService';
import { dataIntegrityService } from '../services/dataIntegrityService';
import { sanitizeObject } from '../utils/sanitize';
import { ValidationService } from '../core/validation/ValidationService';
import { AuthService } from '../core/security/AuthService';
import { movementRepository } from './MovementRepository';
import {
  EMPTY_FISCAL_BUDGET,
  DEMO_FISCAL_BUDGET,
  type FiscalBudgetConfig,
} from '../domain/finance/entities/FinancialBudget';

import seedMachines from '../data/machines/seedMachines.json';
import seedGeneralSystemTypes from '../data/machines/seedGeneralSystemTypes.json';
import seedFamilies from '../data/machines/seedFamilies.json';
import seedTemplates from '../data/machines/seedTemplates.json';
import seedBlueprints from '../data/machines/seedBlueprints.json';
import seedZones from '../data/machines/seedZones.json';
import seedMachineBomLedger from '../data/machines/seedMachineBomLedger.json';

import seedStockItems from '../data/stock/seedStockItems.json';
import seedStockTypes from '../data/stock/seedStockTypes.json';
import seedMouvements from '../data/movements/seedMouvements.json';
import seedSortiesExternes from '../data/movements/seedSortiesExternes.json';

import seedPreventiveTasks from '../data/preventive/seedPreventiveTasks.json';
import seedPreventiveActions from '../data/preventive/seedPreventiveActions.json';
import seedPreventiveGuides from '../data/preventive/seedPreventiveGuides.json';

import seedCorrectiveInterventions from '../data/corrective/seedCorrectiveInterventions.json';
import seedActionsByPanne from '../data/corrective/seedActionsByPanne.json';
import seedPanneByCategory from '../data/corrective/seedPanneByCategory.json';
import seedTravailAFaire from '../data/corrective/seedTravailAFaire.json';
import seedIntervenants from '../data/corrective/seedIntervenants.json';

import seedUsers from '../data/users/seedUsers.json';
import seedTechnicians from '../data/users/seedTechnicians.json';
import seedOperations from '../data/users/seedOperations.json';

import seedWarehouseItems from '../data/warehouse/seedWarehouseItems.json';
import seedEntrepotComponents from '../data/warehouse/seedEntrepotComponents.json';
import seedCompGroups from '../data/warehouse/seedCompGroups.json';
import seedCompFamilies from '../data/warehouse/seedCompFamilies.json';
import seedCompTemplates from '../data/warehouse/seedCompTemplates.json';
import seedPartTypes from '../data/warehouse/seedPartTypes.json';
import seedPartDesignations from '../data/warehouse/seedPartDesignations.json';

function buildInitialStockMap(rawStock: any[] = []): Map<string, number> {
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

/**
 * Thin Write Gateway (Single Write Path for all Canonical Entities).
 * Ensures every write targets the canonical STORAGE_KEYS only and supports optional referential checks.
 */
export const DataGateway = {
  /**
   * Sanitizes any incoming entity payload against XSS injection while preserving non-string types.
   */
  sanitizePayload(payload) {
    return sanitizeObject(payload);
  },

  /**
   * Validates an entity using ValidationService when strict validation is requested.
   */
  validateEntity(entityType, item) {
    switch (entityType) {
      case 'stock':
        return ValidationService.validateStockItem(item);
      case 'machine':
        return ValidationService.validateMachine(item);
      case 'movement':
        return ValidationService.validateMovement(item);
      case 'zone':
        return ValidationService.validateZone(item);
      case 'user':
        return ValidationService.validateUser(item);
      default:
        return { valid: true, data: item, errors: [] };
    }
  },

  // ==========================================
  // 1. MACHINES & TOPOLOGY
  // ==========================================
  saveMachines(list = [], { validate = false } = {}) {
    let clean = Array.isArray(list)
      ? list.map((m) => {
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
        })
      : [];
    if (validate) {
      clean = clean.filter((m) => ValidationService.validateMachine(m).valid);
    }
    storageService.setItem(STORAGE_KEYS.MACHINES, clean);
    return clean;
  },

  saveGeneralSystemTypes(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.GENERAL_SYSTEM_TYPES, clean);
    return clean;
  },

  saveFamilies(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.FAMILIES, clean);
    return clean;
  },

  saveTemplates(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.TEMPLATES, clean);
    return clean;
  },

  saveBlueprints(list = []) {
    const clean = Array.isArray(list)
      ? list.map((b) => ({
          ...b,
          preventivePlanItems: Array.isArray(b?.preventivePlanItems) ? b.preventivePlanItems : [],
          commonFailures: Array.isArray(b?.commonFailures) ? b.commonFailures : [],
        }))
      : [];
    storageService.setItem(STORAGE_KEYS.BLUEPRINTS, clean);
    return clean;
  },

  saveZones(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.ZONES, clean);
    return clean;
  },

  saveMachineBom(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.MACHINE_BOM, clean);
    return clean;
  },

  // ==========================================
  // 2. STOCK & MOVEMENTS
  // ==========================================
  saveStock(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.RAW_STOCK, clean);
    return clean;
  },

  saveStockTypes(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.STOCK_TYPES, clean);
    return clean;
  },

  saveDesignations(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.DESIGNATIONS, clean);
    return clean;
  },

  saveMouvements(list = [], { stock = null, strict = false } = {}) {
    let clean = Array.isArray(list) ? list : [];
    if (strict && Array.isArray(stock) && stock.length > 0) {
      const validRefs = new Set(
        stock.map((s) => String(s.ref || '').trim().toUpperCase()).filter(Boolean)
      );
      clean = clean.filter((m) => {
        const ref = String(m.ref || '').trim().toUpperCase();
        return !ref || validRefs.has(ref);
      });
    }
    storageService.setItem(STORAGE_KEYS.MOUVEMENTS, clean);
    return clean;
  },

  saveMovements(list = [], options = {}) {
    return this.saveMouvements(list, options);
  },

  saveSortieDemands(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.SORTIE_DEMANDS, clean);
    return clean;
  },

  // ==========================================
  // 3. PREVENTIVE MAINTENANCE
  // ==========================================
  savePreventiveTasks(list = [], { machines = null, strict = false } = {}) {
    let clean = Array.isArray(list) ? list : [];
    let orphanCount = 0;

    if (Array.isArray(machines) && machines.length > 0) {
      const activeIds = dataIntegrityService.buildActiveMachineIdSet(machines);
      if (strict) {
        const kept = [];
        clean.forEach((t) => {
          const ref = t.id_machine || t.machine_id || t.code_machine;
          if (dataIntegrityService.isOrphanMachineRef(ref, activeIds)) {
            orphanCount++;
          } else {
            kept.push({ ...t, _isOrphan: false });
          }
        });
        clean = kept;
      } else {
        clean = clean.map((t) => {
          const ref = t.id_machine || t.machine_id || t.code_machine;
          const isOrphan = dataIntegrityService.isOrphanMachineRef(ref, activeIds);
          if (isOrphan) orphanCount++;
          return { ...t, _isOrphan: isOrphan };
        });
      }
    }

    storageService.setItem(STORAGE_KEYS.PREVENTIVE_TASKS, clean);
    return { saved: clean, orphanCount };
  },

  savePreventiveActions(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_ACTIONS, clean);
    return clean;
  },

  savePreventiveGuides(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_GUIDES, clean);
    return clean;
  },

  savePreventivePlans(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_PLANS, clean);
    return clean;
  },

  savePreventiveExecutions(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, clean);
    return clean;
  },

  saveMeterReadings(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.METER_READINGS, clean);
    return clean;
  },

  // ==========================================
  // 4. CORRECTIVE MAINTENANCE
  // ==========================================
  saveCorrectiveInterventions(list = [], { machines = null, strict = false } = {}) {
    let clean = Array.isArray(list) ? list : [];
    let orphanCount = 0;

    if (Array.isArray(machines) && machines.length > 0) {
      const activeIds = dataIntegrityService.buildActiveMachineIdSet(machines);
      if (strict) {
        const kept = [];
        clean.forEach((i) => {
          const ref = i.code_machine || i.id_machine || i.machine_id || i.id_machine_registered;
          if (dataIntegrityService.isOrphanMachineRef(ref, activeIds)) {
            orphanCount++;
          } else {
            kept.push({ ...i, _isOrphan: false });
          }
        });
        clean = kept;
      } else {
        clean = clean.map((i) => {
          const ref = i.code_machine || i.id_machine || i.machine_id || i.id_machine_registered;
          const isOrphan = dataIntegrityService.isOrphanMachineRef(ref, activeIds);
          if (isOrphan) orphanCount++;
          return { ...i, _isOrphan: isOrphan };
        });
      }
    }

    storageService.setItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, clean);
    return { saved: clean, orphanCount };
  },

  saveCorrectiveActionsByPanne(dict = {}) {
    const clean = dict && typeof dict === 'object' ? dict : {};
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE, clean);
    return clean;
  },

  saveCorrectivePanneCategories(dict = {}) {
    const clean = dict && typeof dict === 'object' ? dict : {};
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES, clean);
    return clean;
  },

  saveCorrectiveTravaux(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_TRAVAUX, clean);
    return clean;
  },

  saveCorrectiveIntervenants(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_INTERVENANTS, clean);
    return clean;
  },

  // ==========================================
  // 5. PERSONNEL & USERS
  // ==========================================
  savePersonnel(users = [], technicians = null, operations = null) {
    const cleanUsers = Array.isArray(users) ? users : [];
    storageService.setItem(STORAGE_KEYS.PERSONNEL, cleanUsers);
    if (Array.isArray(technicians)) {
      storageService.setItem(STORAGE_KEYS.TECHNICIANS, technicians);
    }
    if (Array.isArray(operations)) {
      storageService.setItem(STORAGE_KEYS.OPERATIONS, operations);
    }
    return cleanUsers;
  },

  saveUsers(users = []) {
    return this.savePersonnel(users);
  },

  saveTechnicians(technicians = []) {
    const clean = Array.isArray(technicians) ? technicians : [];
    storageService.setItem(STORAGE_KEYS.TECHNICIANS, clean);
    return clean;
  },

  saveOperations(operations = []) {
    const clean = Array.isArray(operations) ? operations : [];
    storageService.setItem(STORAGE_KEYS.OPERATIONS, clean);
    return clean;
  },

  // ==========================================
  // 6. WAREHOUSE / ENTREPÔT
  // ==========================================
  saveWarehouseItems(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.WAREHOUSE_ITEMS, clean);
    return clean;
  },

  saveEntrepotComponents(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.ENTREPOT_COMPONENTS, clean);
    return clean;
  },

  saveCompGroups(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.COMP_GROUPS, clean);
    return clean;
  },

  saveCompFamilies(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.COMP_FAMILIES, clean);
    return clean;
  },

  saveCompTemplates(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.COMP_TEMPLATES, clean);
    return clean;
  },

  savePartTypes(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PART_TYPES, clean);
    return clean;
  },

  savePartDesignations(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PART_DESIGNATIONS, clean);
    return clean;
  },

  // ==========================================
  // 7. SORTIE EXTERNE & BOBINAGE
  // ==========================================
  saveSortiesExterne(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.SORTIE_EXTERNE, clean);
    return clean;
  },

  // ==========================================
  // 7b. FINANCIAL BUDGETS & COSTING CONFIG
  // ==========================================
  getFinancialBudget(): FiscalBudgetConfig {
    const startMode = storageService.getItem(STORAGE_KEYS.START_MODE);
    const saved = storageService.getItem(STORAGE_KEYS.FINANCIAL_BUDGETS);
    if (saved && typeof saved === 'object' && typeof saved.fiscalYear === 'number') {
      // FIN-P0: If factory is in empty mode and budget came from a stale demo seed, return zeroed budget
      if (startMode === 'empty' && saved.updatedBy === 'DEMO_SEED') {
        return { ...EMPTY_FISCAL_BUDGET };
      }
      return {
        ...EMPTY_FISCAL_BUDGET,
        ...saved,
        periodMode:
          saved.periodMode === 'MONTHLY' || saved.periodMode === 'QUARTERLY' ? saved.periodMode : 'ANNUAL',
        burnWarningPercent: Math.max(50, Math.min(100, Number(saved.burnWarningPercent ?? 90))),
        budgetChangeLog: Array.isArray(saved.budgetChangeLog) ? saved.budgetChangeLog.slice(0, 5) : [],
      } as FiscalBudgetConfig;
    }
    const isDemo = storageService.getItem(STORAGE_KEYS.DEMO_MODE) === true;
    return isDemo && startMode !== 'empty' ? { ...DEMO_FISCAL_BUDGET } : { ...EMPTY_FISCAL_BUDGET };
  },

  saveFinancialBudget(budget: Partial<FiscalBudgetConfig>, actorName?: string): FiscalBudgetConfig {
    const clean = this.sanitizePayload(budget || {}) as Partial<FiscalBudgetConfig>;
    const prevSaved = storageService.getItem(STORAGE_KEYS.FINANCIAL_BUDGETS) as Partial<FiscalBudgetConfig> | null;

    const fiscalYear = Number(clean.fiscalYear) || new Date().getFullYear();
    const allocatedPreventive = Math.max(0, Number(clean.allocatedPreventive) || 0);
    const allocatedCorrective = Math.max(0, Number(clean.allocatedCorrective) || 0);
    const allocatedExternal = Math.max(0, Number(clean.allocatedExternal) || 0);
    const allocatedSparesStock = Math.max(0, Number(clean.allocatedSparesStock) || 0);
    const periodMode =
      clean.periodMode === 'MONTHLY' || clean.periodMode === 'QUARTERLY' ? clean.periodMode : 'ANNUAL';
    const burnWarningPercent = Math.max(50, Math.min(100, Number(clean.burnWarningPercent ?? 90)));
    const updatedAt = clean.updatedAt || new Date().toISOString();
    const updatedBy = actorName || clean.updatedBy || 'ADMIN';

    const sanitizeSeries = (arr: unknown, len: number): number[] => {
      if (!Array.isArray(arr)) return Array(len).fill(0);
      return Array.from({ length: len }, (_, i) => Math.max(0, Math.round((Number(arr[i]) || 0) * 100) / 100));
    };

    const monthlyAllocations = clean.monthlyAllocations
      ? {
          preventive: sanitizeSeries(clean.monthlyAllocations.preventive, 12),
          corrective: sanitizeSeries(clean.monthlyAllocations.corrective, 12),
          external: sanitizeSeries(clean.monthlyAllocations.external, 12),
          spares: sanitizeSeries(clean.monthlyAllocations.spares, 12),
        }
      : undefined;

    const quarterlyAllocations = clean.quarterlyAllocations
      ? {
          preventive: sanitizeSeries(clean.quarterlyAllocations.preventive, 4),
          corrective: sanitizeSeries(clean.quarterlyAllocations.corrective, 4),
          external: sanitizeSeries(clean.quarterlyAllocations.external, 4),
          spares: sanitizeSeries(clean.quarterlyAllocations.spares, 4),
        }
      : undefined;

    const totalAllocated =
      allocatedPreventive + allocatedCorrective + allocatedExternal + allocatedSparesStock;

    let budgetChangeLog = Array.isArray(clean.budgetChangeLog)
      ? clean.budgetChangeLog
      : Array.isArray(prevSaved?.budgetChangeLog)
      ? prevSaved.budgetChangeLog
      : [];

    if (updatedBy === 'FACTORY_RESET') {
      budgetChangeLog = [];
    } else if (updatedBy !== 'DEMO_SEED') {
      const auditEntry = {
        id: `bgt-log-${Date.now()}`,
        timestamp: updatedAt,
        updatedBy,
        fiscalYear,
        periodMode,
        totalAllocated,
        summary: `Ex. ${fiscalYear} (${periodMode}) — Plafond: ${totalAllocated.toLocaleString('fr-FR')} MAD (Seuil alerte: ${burnWarningPercent}%)`,
      };
      budgetChangeLog = [auditEntry, ...budgetChangeLog].slice(0, 5);
    }

    const next: FiscalBudgetConfig = {
      fiscalYear,
      allocatedPreventive,
      allocatedCorrective,
      allocatedExternal,
      allocatedSparesStock,
      technicianHourlyRate: Math.max(0, Number(clean.technicianHourlyRate ?? EMPTY_FISCAL_BUDGET.technicianHourlyRate)),
      productionDowntimeCostPerHour: Math.max(
        0,
        Number(clean.productionDowntimeCostPerHour ?? EMPTY_FISCAL_BUDGET.productionDowntimeCostPerHour)
      ),
      berThresholdPercent: Math.max(10, Math.min(200, Number(clean.berThresholdPercent) || 70)),
      defaultVatRate: Math.max(0, Math.min(100, Number(clean.defaultVatRate ?? 20))),
      periodMode,
      burnWarningPercent,
      ...(monthlyAllocations ? { monthlyAllocations } : {}),
      ...(quarterlyAllocations ? { quarterlyAllocations } : {}),
      budgetChangeLog,
      updatedAt,
      updatedBy,
    };
    storageService.setItem(STORAGE_KEYS.FINANCIAL_BUDGETS, next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao_financial_budget_updated', { detail: next }));
    }
    return next;
  },

  // ==========================================
  // 8. EXPLICIT DEMO DATA LOADER & FACTORY CLEAR
  // ==========================================
  /**
   * Explicitly loads real stock data.
   */
  initRealStock(setters = {}) {
    this.saveStock(seedStockItems);
    if (setters.setRawStock) setters.setRawStock(seedStockItems);
    // Also update designations if needed, but for now focus on RAW_STOCK
    return { stockCount: seedStockItems.length };
  },

  /**
   * Explicitly loads all documented factory demo seeds into canonical STORAGE_KEYS.
   * Sets DEMO_MODE = true.
   */
  loadDemoData(setters = {}) {
    const derivedDesignations = seedStockItems.map((s) => ({
      id: s.id,
      ref: s.ref,
      designation: s.designation,
      id_type: s.id_type,
      type: s.type,
      stockInitial: s.stockInitial,
      seuil: s.seuil,
      emplacement: s.emplacement,
    }));

    const formattedCompTemplates = seedCompTemplates.map((t, idx) => ({
      ...t,
      id_templates: t.id_templates || t.id_template || t.id_comp_template || `TPL-${idx + 1}`,
    }));

    // 1. Set DEMO_MODE and START_MODE flags explicitly
    storageService.setItem(STORAGE_KEYS.DEMO_MODE, true);
    storageService.setItem(STORAGE_KEYS.START_MODE, 'demo');
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DEMO_MODE, 'true');
      localStorage.setItem(STORAGE_KEYS.START_MODE, 'demo');
    }

    // 2. Write all seeds to canonical STORAGE_KEYS only
    this.saveMachines(seedMachines);
    this.saveGeneralSystemTypes(seedGeneralSystemTypes);
    this.saveFamilies(seedFamilies);
    this.saveTemplates(seedTemplates);
    this.saveBlueprints(seedBlueprints);
    this.saveZones(seedZones);
    this.saveMachineBom(seedMachineBomLedger);

    this.saveStock(seedStockItems);
    this.saveStockTypes(seedStockTypes);
    this.saveDesignations(derivedDesignations);
    this.saveMouvements(seedMouvements);
    movementRepository.bulkReplace(seedMouvements as any[], buildInitialStockMap(seedStockItems));

    this.savePreventiveTasks(seedPreventiveTasks, { machines: seedMachines });
    this.savePreventiveActions(seedPreventiveActions);
    this.savePreventiveGuides(seedPreventiveGuides);
    this.savePreventivePlans([]);
    this.savePreventiveExecutions([]);

    this.saveCorrectiveInterventions(seedCorrectiveInterventions, { machines: seedMachines });
    this.saveCorrectiveActionsByPanne(seedActionsByPanne);
    this.saveCorrectivePanneCategories(seedPanneByCategory);
    this.saveCorrectiveTravaux(seedTravailAFaire);
    this.saveCorrectiveIntervenants(seedIntervenants);

    this.savePersonnel(seedUsers, seedTechnicians, seedOperations);
    try {
      new AuthService().syncTechnicianAccountsFromPersonnel(seedTechnicians, {
        activateByDefault: true,
      });
    } catch {
      /* ignore auth sync error in headless tests */
    }

    this.saveWarehouseItems(seedWarehouseItems);
    this.saveEntrepotComponents(seedEntrepotComponents);
    this.saveCompGroups(seedCompGroups);
    this.saveCompFamilies(seedCompFamilies);
    this.saveCompTemplates(formattedCompTemplates);
    this.savePartTypes(seedPartTypes);
    this.savePartDesignations(seedPartDesignations);

    this.saveSortiesExterne(seedSortiesExternes);
    this.saveFinancialBudget(DEMO_FISCAL_BUDGET, 'DEMO_SEED');

    // 3. Update React state setters if provided
    if (setters.setMachines) setters.setMachines(seedMachines);
    if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes(seedGeneralSystemTypes);
    if (setters.setFamilies) setters.setFamilies(seedFamilies);
    if (setters.setTemplates) setters.setTemplates(seedTemplates);
    if (setters.setBlueprints) setters.setBlueprints(seedBlueprints);
    if (setters.setZones) setters.setZones(seedZones);
    if (setters.setMachineElementsLedger) setters.setMachineElementsLedger(seedMachineBomLedger);

    if (setters.setRawStock) setters.setRawStock(seedStockItems);
    if (setters.setTypes) setters.setTypes(seedStockTypes);
    if (setters.setDesignations) setters.setDesignations(derivedDesignations);
    if (setters.setMouvements) setters.setMouvements(seedMouvements);

    if (setters.setPreventiveTasks) setters.setPreventiveTasks(seedPreventiveTasks);
    if (setters.setPreventiveActions) setters.setPreventiveActions(seedPreventiveActions);
    if (setters.setPreventiveGuides) setters.setPreventiveGuides(seedPreventiveGuides);
    if (setters.setPreventivePlans) setters.setPreventivePlans([]);
    if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);

    if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions(seedCorrectiveInterventions);
    if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne(seedActionsByPanne);
    if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories(seedPanneByCategory);
    if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire(seedTravailAFaire);
    if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants(seedIntervenants);

    if (setters.setUsers) setters.setUsers(seedUsers);
    if (setters.setTechnicians) setters.setTechnicians(seedTechnicians);
    if (setters.setOperations) setters.setOperations(seedOperations);

    if (setters.setWarehouseItems) setters.setWarehouseItems(seedWarehouseItems);
    if (setters.setEntrepotComponents) setters.setEntrepotComponents(seedEntrepotComponents);
    if (setters.setCompGroups) setters.setCompGroups(seedCompGroups);
    if (setters.setCompFamilies) setters.setCompFamilies(seedCompFamilies);
    if (setters.setCompTemplates) setters.setCompTemplates(formattedCompTemplates);
    if (setters.setPartTypes) setters.setPartTypes(seedPartTypes);
    if (setters.setPartDesignations) setters.setPartDesignations(seedPartDesignations);

    if (setters.setSortiesExterne) setters.setSortiesExterne(seedSortiesExternes);

    return {
      machinesCount: seedMachines.length,
      stockCount: seedStockItems.length,
      preventiveCount: seedPreventiveTasks.length,
      correctiveCount: seedCorrectiveInterventions.length,
      movementsCount: seedMouvements.length,
    };
  },

  /**
   * Purges all legacy keys mapped to a given canonical key (or all legacy keys if canonicalKey is null).
   */
  purgeLegacyKeysFor(canonicalKey: string | null = null) {
    const canonicalSet = new Set(Object.values(STORAGE_KEYS));
    const sweepPreventiveExtras = () => {
      try {
        if (typeof localStorage !== 'undefined') {
          const toRemove: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith('gmao_preventive') && !canonicalSet.has(k)) {
              toRemove.push(k);
            }
          }
          toRemove.forEach((k) => storageService.removeItem(k));
        }
      } catch {}
    };

    if (!canonicalKey) {
      for (const legacyKey of ALL_LEGACY_KEYS) {
        storageService.removeItem(legacyKey);
      }
      sweepPreventiveExtras();
      return;
    }
    for (const [legacyKey, mappedCanonical] of Object.entries(LEGACY_KEY_MAP)) {
      if (mappedCanonical === canonicalKey) {
        storageService.removeItem(legacyKey);
      }
    }
    if (canonicalKey.startsWith('gmao_preventive')) {
      sweepPreventiveExtras();
    }
  },

  /**
   * Explicitly clears all operational data for a clean real-factory deployment.
   * Sets DEMO_MODE = false, START_MODE = 'empty', removes FULL_STATE_SNAPSHOT, purges all legacy keys,
   * writes [] to all canonical keys in memory + localStorage + IndexedDB, and clears IndexedDB entity stores.
   */
  clearAllForRealFactory(setters: Record<string, any> = {}) {
    storageService.setItem(STORAGE_KEYS.DEMO_MODE, false);
    storageService.setItem(STORAGE_KEYS.START_MODE, 'empty');
    storageService.removeItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.DEMO_MODE, 'false');
      localStorage.setItem(STORAGE_KEYS.START_MODE, 'empty');
      localStorage.removeItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT);
    }

    // Purge all legacy keys so Stage 2 of loadCollection can never resurrect old data
    this.purgeLegacyKeysFor(null);

    this.saveMachines([]);
    this.saveGeneralSystemTypes([]);
    this.saveFamilies([]);
    this.saveTemplates([]);
    this.saveBlueprints([]);
    this.saveZones([]);
    this.saveMachineBom([]);

    this.saveStock([]);
    this.saveStockTypes([]);
    this.saveDesignations([]);
    this.saveMouvements([]);
    this.saveSortieDemands([]);
    movementRepository.bulkReplace([], new Map());

    this.savePreventiveTasks([]);
    this.savePreventiveActions([]);
    this.savePreventiveGuides([]);
    this.savePreventivePlans([]);
    this.savePreventiveExecutions([]);
    this.saveMeterReadings([]);

    this.saveCorrectiveInterventions([]);
    this.saveCorrectiveActionsByPanne({});
    this.saveCorrectivePanneCategories({});
    this.saveCorrectiveTravaux([]);
    this.saveCorrectiveIntervenants([]);

    this.savePersonnel([], [], []);
    try {
      new AuthService().clearPersonnelAuthAccounts(true);
    } catch {
      /* ignore auth clear error in headless tests */
    }

    this.saveWarehouseItems([]);
    this.saveEntrepotComponents([]);
    this.saveCompGroups([]);
    this.saveCompFamilies([]);
    this.saveCompTemplates([]);
    this.savePartTypes([]);
    this.savePartDesignations([]);

    this.saveSortiesExterne([]);
    this.saveFinancialBudget({ ...EMPTY_FISCAL_BUDGET, updatedAt: new Date().toISOString() }, 'FACTORY_RESET');

    if (setters.setMachines) setters.setMachines([]);
    if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes([]);
    if (setters.setFamilies) setters.setFamilies([]);
    if (setters.setTemplates) setters.setTemplates([]);
    if (setters.setBlueprints) setters.setBlueprints([]);
    if (setters.setZones) setters.setZones([]);
    if (setters.setMachineElementsLedger) setters.setMachineElementsLedger([]);

    if (setters.setRawStock) setters.setRawStock([]);
    if (setters.setTypes) setters.setTypes([]);
    if (setters.setDesignations) setters.setDesignations([]);
    if (setters.setMouvements) setters.setMouvements([]);
    if (setters.setSortieDemands) setters.setSortieDemands([]);

    if (setters.setPreventiveTasks) setters.setPreventiveTasks([]);
    if (setters.setPreventiveActions) setters.setPreventiveActions([]);
    if (setters.setPreventiveGuides) setters.setPreventiveGuides([]);
    if (setters.setPreventivePlans) setters.setPreventivePlans([]);
    if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);

    if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions([]);
    if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne({});
    if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories({});
    if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire([]);
    if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants([]);

    if (setters.setUsers) setters.setUsers([]);
    if (setters.setTechnicians) setters.setTechnicians([]);
    if (setters.setOperations) setters.setOperations([]);

    if (setters.setWarehouseItems) setters.setWarehouseItems([]);
    if (setters.setEntrepotComponents) setters.setEntrepotComponents([]);
    if (setters.setCompGroups) setters.setCompGroups([]);
    if (setters.setCompFamilies) setters.setCompFamilies([]);
    if (setters.setCompTemplates) setters.setCompTemplates([]);
    if (setters.setPartTypes) setters.setPartTypes([]);
    if (setters.setPartDesignations) setters.setPartDesignations([]);

    if (setters.setSortiesExterne) setters.setSortiesExterne([]);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('preventive_tasks_updated', { detail: [] }));
      window.dispatchEvent(new CustomEvent('preventive_executions_updated', { detail: [] }));
    }

    // Return a promise that resolves once IndexedDB batch write + entity store clear completes
    const emptyBatch: Record<string, any> = {
      [STORAGE_KEYS.DEMO_MODE]: false,
      [STORAGE_KEYS.START_MODE]: 'empty',
      [STORAGE_KEYS.MACHINES]: [],
      [STORAGE_KEYS.GENERAL_SYSTEM_TYPES]: [],
      [STORAGE_KEYS.FAMILIES]: [],
      [STORAGE_KEYS.TEMPLATES]: [],
      [STORAGE_KEYS.BLUEPRINTS]: [],
      [STORAGE_KEYS.ZONES]: [],
      [STORAGE_KEYS.MACHINE_BOM]: [],
      [STORAGE_KEYS.RAW_STOCK]: [],
      [STORAGE_KEYS.STOCK_TYPES]: [],
      [STORAGE_KEYS.DESIGNATIONS]: [],
      [STORAGE_KEYS.MOUVEMENTS]: [],
      [STORAGE_KEYS.PREVENTIVE_TASKS]: [],
      [STORAGE_KEYS.PREVENTIVE_ACTIONS]: [],
      [STORAGE_KEYS.PREVENTIVE_GUIDES]: [],
      [STORAGE_KEYS.PREVENTIVE_PLANS]: [],
      [STORAGE_KEYS.PREVENTIVE_EXECUTIONS]: [],
      [STORAGE_KEYS.CORRECTIVE_INTERVENTIONS]: [],
      [STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE]: {},
      [STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES]: {},
      [STORAGE_KEYS.CORRECTIVE_TRAVAUX]: [],
      [STORAGE_KEYS.CORRECTIVE_INTERVENANTS]: [],
      [STORAGE_KEYS.PERSONNEL]: [],
      [STORAGE_KEYS.TECHNICIANS]: [],
      [STORAGE_KEYS.OPERATIONS]: [],
      [STORAGE_KEYS.WAREHOUSE_ITEMS]: [],
      [STORAGE_KEYS.ENTREPOT_COMPONENTS]: [],
      [STORAGE_KEYS.COMP_GROUPS]: [],
      [STORAGE_KEYS.COMP_FAMILIES]: [],
      [STORAGE_KEYS.COMP_TEMPLATES]: [],
      [STORAGE_KEYS.PART_TYPES]: [],
      [STORAGE_KEYS.PART_DESIGNATIONS]: [],
      [STORAGE_KEYS.SORTIE_EXTERNE]: [],
      [STORAGE_KEYS.FINANCIAL_BUDGETS]: { ...EMPTY_FISCAL_BUDGET },
    };

    return Promise.all([
      indexedDBService.removeItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT).catch(() => false),
      indexedDBService.setItemsBatch(emptyBatch).catch(() => false),
      indexedDBService.clear('preventive').catch(() => false),
      indexedDBService.clear('interventions').catch(() => false),
      indexedDBService.clear('movements').catch(() => false),
      indexedDBService.clear('machines').catch(() => false),
      indexedDBService.clear('articles').catch(() => false),
      indexedDBService.clear('warehouse_items').catch(() => false),
      storageService.removeItemsBatchAsync(ALL_LEGACY_KEYS).catch(() => false),
    ]).then(() => ({ cleared: true }));
  },

  /**
   * Loads and applies full server state (from gmao_state.json) directly through canonical keys and React state setters.
   */
  loadFullServerState(serverData: Record<string, any> = {}, setters: Record<string, any> = {}) {
    if (!serverData || typeof serverData !== 'object') return;

    const rawStock = Array.isArray(serverData.rawStock)
      ? serverData.rawStock
      : Array.isArray(serverData.stock)
      ? serverData.stock
      : [];
    const types = Array.isArray(serverData.types) ? serverData.types : [];
    const designations = Array.isArray(serverData.designations) ? serverData.designations : [];
    const machines = Array.isArray(serverData.machines) ? serverData.machines : [];
    const generalSystemTypes = Array.isArray(serverData.generalSystemTypes)
      ? serverData.generalSystemTypes
      : [];
    const families = Array.isArray(serverData.families) ? serverData.families : [];
    const templates = Array.isArray(serverData.templates) ? serverData.templates : [];
    const blueprints = Array.isArray(serverData.blueprints) ? serverData.blueprints : [];
    const zones = Array.isArray(serverData.zones) ? serverData.zones : [];
    const machineElementsLedger = Array.isArray(serverData.machineElementsLedger)
      ? serverData.machineElementsLedger
      : [];
    const mouvements = Array.isArray(serverData.mouvements) ? serverData.mouvements : [];
    const preventiveTasks = Array.isArray(serverData.preventiveTasks) ? serverData.preventiveTasks : [];
    const preventiveActions = Array.isArray(serverData.preventiveActions) ? serverData.preventiveActions : [];
    const preventiveGuides = Array.isArray(serverData.preventiveGuides) ? serverData.preventiveGuides : [];
    const preventivePlans = Array.isArray(serverData.preventivePlans) ? serverData.preventivePlans : [];
    const preventiveExecutions = Array.isArray(serverData.preventiveExecutions) ? serverData.preventiveExecutions : [];
    const correctiveInterventions = Array.isArray(serverData.correctiveInterventions)
      ? serverData.correctiveInterventions
      : [];
    const correctiveActionsByPanne =
      serverData.correctiveActionsByPanne && typeof serverData.correctiveActionsByPanne === 'object'
        ? serverData.correctiveActionsByPanne
        : {};
    const correctivePanneCategories =
      serverData.correctivePanneCategories && typeof serverData.correctivePanneCategories === 'object'
        ? serverData.correctivePanneCategories
        : {};
    const correctiveTravauxAFaire = Array.isArray(serverData.correctiveTravauxAFaire)
      ? serverData.correctiveTravauxAFaire
      : [];
    const correctiveIntervenants = Array.isArray(serverData.correctiveIntervenants)
      ? serverData.correctiveIntervenants
      : [];
    const users = Array.isArray(serverData.users) ? serverData.users : [];
    const technicians = Array.isArray(serverData.technicians) ? serverData.technicians : [];
    const operations = Array.isArray(serverData.operations) ? serverData.operations : [];
    const warehouseItems = Array.isArray(serverData.warehouseItems) ? serverData.warehouseItems : [];
    const entrepotComponents = Array.isArray(serverData.entrepotComponents)
      ? serverData.entrepotComponents
      : [];
    const compGroups = Array.isArray(serverData.compGroups) ? serverData.compGroups : [];
    const compFamilies = Array.isArray(serverData.compFamilies) ? serverData.compFamilies : [];
    const compTemplates = Array.isArray(serverData.compTemplates) ? serverData.compTemplates : [];
    const partTypes = Array.isArray(serverData.partTypes) ? serverData.partTypes : [];
    const partDesignations = Array.isArray(serverData.partDesignations) ? serverData.partDesignations : [];
    const sortiesExterne = Array.isArray(serverData.sortiesExterne) ? serverData.sortiesExterne : [];
    const sortieDemands = Array.isArray(serverData.sortieDemands) ? serverData.sortieDemands : [];

    const hasData =
      rawStock.length > 0 ||
      machines.length > 0 ||
      preventiveTasks.length > 0 ||
      correctiveInterventions.length > 0 ||
      mouvements.length > 0 ||
      sortieDemands.length > 0;

    storageService.setItem(STORAGE_KEYS.DEMO_MODE, false);
    storageService.setItem(STORAGE_KEYS.START_MODE, hasData ? 'custom' : 'empty');

    this.saveStock(rawStock);
    this.saveStockTypes(types);
    this.saveDesignations(designations);
    this.saveMachines(machines);
    this.saveGeneralSystemTypes(generalSystemTypes);
    this.saveFamilies(families);
    this.saveTemplates(templates);
    this.saveBlueprints(blueprints);
    this.saveZones(zones);
    this.saveMachineBom(machineElementsLedger);
    this.saveMouvements(mouvements);
    this.saveSortieDemands(sortieDemands);
    movementRepository.bulkReplace(mouvements as any[], buildInitialStockMap(rawStock));
    this.savePreventiveTasks(preventiveTasks);
    this.savePreventiveActions(preventiveActions);
    this.savePreventiveGuides(preventiveGuides);
    this.savePreventivePlans(preventivePlans);
    this.savePreventiveExecutions(preventiveExecutions);
    this.saveCorrectiveInterventions(correctiveInterventions);
    this.saveCorrectiveActionsByPanne(correctiveActionsByPanne);
    this.saveCorrectivePanneCategories(correctivePanneCategories);
    this.saveCorrectiveTravaux(correctiveTravauxAFaire);
    this.saveCorrectiveIntervenants(correctiveIntervenants);
    this.savePersonnel(users, technicians, operations);
    try {
      const authSvc = new AuthService();
      if (technicians.length > 0) {
        authSvc.syncTechnicianAccountsFromPersonnel(technicians, { activateByDefault: true });
      } else if (!hasData) {
        authSvc.clearPersonnelAuthAccounts(true);
      }
    } catch {
      /* ignore */
    }
    this.saveWarehouseItems(warehouseItems);
    this.saveEntrepotComponents(entrepotComponents);
    this.saveCompGroups(compGroups);
    this.saveCompFamilies(compFamilies);
    this.saveCompTemplates(compTemplates);
    this.savePartTypes(partTypes);
    this.savePartDesignations(partDesignations);
    this.saveSortiesExterne(sortiesExterne);

    if (typeof setters.applyRemoteStateUpdate === 'function') {
      setters.applyRemoteStateUpdate({
        rawStock,
        types,
        designations,
        machines,
        generalSystemTypes,
        families,
        templates,
        blueprints,
        zones,
        machineElementsLedger,
        mouvements,
        sortieDemands,
        preventiveTasks,
        preventiveActions,
        preventiveGuides,
        preventivePlans,
        preventiveExecutions,
        correctiveInterventions,
        correctiveActionsByPanne,
        correctivePanneCategories,
        correctiveTravauxAFaire,
        correctiveIntervenants,
        users,
        technicians,
        operations,
        warehouseItems,
        entrepotComponents,
        compGroups,
        compFamilies,
        compTemplates,
        partTypes,
        partDesignations,
        sortiesExterne,
      });
    } else {
      if (setters.setRawStock) setters.setRawStock(rawStock);
      if (setters.setTypes) setters.setTypes(types);
      if (setters.setDesignations) setters.setDesignations(designations);
      if (setters.setMachines) setters.setMachines(machines);
      if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes(generalSystemTypes);
      if (setters.setFamilies) setters.setFamilies(families);
      if (setters.setTemplates) setters.setTemplates(templates);
      if (setters.setBlueprints) setters.setBlueprints(blueprints);
      if (setters.setZones) setters.setZones(zones);
      if (setters.setMachineElementsLedger) setters.setMachineElementsLedger(machineElementsLedger);
      if (setters.setMouvements) setters.setMouvements(mouvements);
      if (setters.setSortieDemands) setters.setSortieDemands(sortieDemands);
      if (setters.setPreventiveTasks) setters.setPreventiveTasks(preventiveTasks);
      if (setters.setPreventiveActions) setters.setPreventiveActions(preventiveActions);
      if (setters.setPreventiveGuides) setters.setPreventiveGuides(preventiveGuides);
      if (setters.setPreventivePlans) setters.setPreventivePlans(preventivePlans);
      if (setters.setPreventiveExecutions) setters.setPreventiveExecutions(preventiveExecutions);
      if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions(correctiveInterventions);
      if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne(correctiveActionsByPanne);
      if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories(correctivePanneCategories);
      if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire(correctiveTravauxAFaire);
      if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants(correctiveIntervenants);
      if (setters.setUsers) setters.setUsers(users);
      if (setters.setTechnicians) setters.setTechnicians(technicians);
      if (setters.setOperations) setters.setOperations(operations);
      if (setters.setWarehouseItems) setters.setWarehouseItems(warehouseItems);
      if (setters.setEntrepotComponents) setters.setEntrepotComponents(entrepotComponents);
      if (setters.setCompGroups) setters.setCompGroups(compGroups);
      if (setters.setCompFamilies) setters.setCompFamilies(compFamilies);
      if (setters.setCompTemplates) setters.setCompTemplates(compTemplates);
      if (setters.setPartTypes) setters.setPartTypes(partTypes);
      if (setters.setPartDesignations) setters.setPartDesignations(partDesignations);
      if (setters.setSortiesExterne) setters.setSortiesExterne(sortiesExterne);
    }

    return {
      machinesCount: machines.length,
      stockCount: rawStock.length,
      preventiveCount: preventiveTasks.length,
      correctiveCount: correctiveInterventions.length,
      movementsCount: mouvements.length,
    };
  },

  /**
   * Loads factory demo seed data for a specific section (or 'all' for the entire factory).
   * Supported sections: 'all' | 'stock' | 'parc' | 'entrepot' | 'zones' | 'mouvements' | 'preventive' | 'corrective'
   */
  loadDemoSection(section = 'all', setters = {}) {
    if (!section || section === 'all') {
      return this.loadDemoData(setters);
    }

    const derivedDesignations = seedStockItems.map((s) => ({
      id: s.id,
      ref: s.ref,
      designation: s.designation,
      id_type: s.id_type,
      type: s.type,
      stockInitial: s.stockInitial,
      seuil: s.seuil,
      emplacement: s.emplacement,
    }));

    const formattedCompTemplates = seedCompTemplates.map((t, idx) => ({
      ...t,
      id_templates: t.id_templates || t.id_template || t.id_comp_template || `TPL-${idx + 1}`,
    }));

    switch (section) {
      case 'stock':
        this.saveStock(seedStockItems);
        this.saveStockTypes(seedStockTypes);
        this.saveDesignations(derivedDesignations);
        movementRepository.bulkReplace(
          (storageService.getItem(STORAGE_KEYS.MOUVEMENTS) || []) as any[],
          buildInitialStockMap(seedStockItems)
        );
        if (setters.setRawStock) setters.setRawStock(seedStockItems);
        if (setters.setTypes) setters.setTypes(seedStockTypes);
        if (setters.setDesignations) setters.setDesignations(derivedDesignations);
        break;

      case 'parc':
      case 'machines':
        this.saveMachines(seedMachines);
        this.saveGeneralSystemTypes(seedGeneralSystemTypes);
        this.saveFamilies(seedFamilies);
        this.saveTemplates(seedTemplates);
        this.saveBlueprints(seedBlueprints);
        this.saveMachineBom(seedMachineBomLedger);
        if (setters.setMachines) setters.setMachines(seedMachines);
        if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes(seedGeneralSystemTypes);
        if (setters.setFamilies) setters.setFamilies(seedFamilies);
        if (setters.setTemplates) setters.setTemplates(seedTemplates);
        if (setters.setBlueprints) setters.setBlueprints(seedBlueprints);
        if (setters.setMachineElementsLedger) setters.setMachineElementsLedger(seedMachineBomLedger);
        break;

      case 'entrepot':
      case 'warehouse':
        this.saveWarehouseItems(seedWarehouseItems);
        this.saveEntrepotComponents(seedEntrepotComponents);
        this.saveCompGroups(seedCompGroups);
        this.saveCompFamilies(seedCompFamilies);
        this.saveCompTemplates(formattedCompTemplates);
        this.savePartTypes(seedPartTypes);
        this.savePartDesignations(seedPartDesignations);
        if (setters.setWarehouseItems) setters.setWarehouseItems(seedWarehouseItems);
        if (setters.setEntrepotComponents) setters.setEntrepotComponents(seedEntrepotComponents);
        if (setters.setCompGroups) setters.setCompGroups(seedCompGroups);
        if (setters.setCompFamilies) setters.setCompFamilies(seedCompFamilies);
        if (setters.setCompTemplates) setters.setCompTemplates(formattedCompTemplates);
        if (setters.setPartTypes) setters.setPartTypes(seedPartTypes);
        if (setters.setPartDesignations) setters.setPartDesignations(seedPartDesignations);
        break;

      case 'zones':
      case 'users':
        this.saveZones(seedZones);
        this.savePersonnel(seedUsers, seedTechnicians, seedOperations);
        try {
          new AuthService().syncTechnicianAccountsFromPersonnel(seedTechnicians, {
            activateByDefault: true,
          });
        } catch {
          /* ignore */
        }
        if (setters.setZones) setters.setZones(seedZones);
        if (setters.setUsers) setters.setUsers(seedUsers);
        if (setters.setTechnicians) setters.setTechnicians(seedTechnicians);
        if (setters.setOperations) setters.setOperations(seedOperations);
        break;

      case 'mouvements':
      case 'movements':
        this.saveMouvements(seedMouvements);
        this.saveSortiesExterne(seedSortiesExternes);
        movementRepository.bulkReplace(
          seedMouvements as any[],
          buildInitialStockMap(storageService.getItem(STORAGE_KEYS.RAW_STOCK) || [])
        );
        if (setters.setMouvements) setters.setMouvements(seedMouvements);
        if (setters.setSortiesExterne) setters.setSortiesExterne(seedSortiesExternes);
        break;

      case 'preventive':
        this.savePreventiveTasks(seedPreventiveTasks, { machines: seedMachines });
        this.savePreventiveActions(seedPreventiveActions);
        this.savePreventiveGuides(seedPreventiveGuides);
        this.savePreventivePlans([]);
        this.savePreventiveExecutions([]);
        if (setters.setPreventiveTasks) setters.setPreventiveTasks(seedPreventiveTasks);
        if (setters.setPreventiveActions) setters.setPreventiveActions(seedPreventiveActions);
        if (setters.setPreventiveGuides) setters.setPreventiveGuides(seedPreventiveGuides);
        if (setters.setPreventivePlans) setters.setPreventivePlans([]);
        if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);
        break;

      case 'corrective':
        this.saveCorrectiveInterventions(seedCorrectiveInterventions, { machines: seedMachines });
        this.saveCorrectiveActionsByPanne(seedActionsByPanne);
        this.saveCorrectivePanneCategories(seedPanneByCategory);
        this.saveCorrectiveTravaux(seedTravailAFaire);
        this.saveCorrectiveIntervenants(seedIntervenants);
        if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions(seedCorrectiveInterventions);
        if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne(seedActionsByPanne);
        if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories(seedPanneByCategory);
        if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire(seedTravailAFaire);
        if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants(seedIntervenants);
        break;

      default:
        break;
    }

    return { section, loaded: true };
  },

  /**
   * Clears data for a specific section (or 'all' for the entire factory).
   */
  clearDemoSection(section = 'all', setters = {}) {
    if (!section || section === 'all') {
      return this.clearAllForRealFactory(setters);
    }

    switch (section) {
      case 'stock':
        this.saveStock([]);
        this.saveStockTypes([]);
        this.saveDesignations([]);
        movementRepository.bulkReplace(
          (storageService.getItem(STORAGE_KEYS.MOUVEMENTS) || []) as any[],
          new Map()
        );
        if (setters.setRawStock) setters.setRawStock([]);
        if (setters.setTypes) setters.setTypes([]);
        if (setters.setDesignations) setters.setDesignations([]);
        break;

      case 'parc':
      case 'machines':
        this.saveMachines([]);
        this.saveGeneralSystemTypes([]);
        this.saveFamilies([]);
        this.saveTemplates([]);
        this.saveBlueprints([]);
        this.saveMachineBom([]);
        if (setters.setMachines) setters.setMachines([]);
        if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes([]);
        if (setters.setFamilies) setters.setFamilies([]);
        if (setters.setTemplates) setters.setTemplates([]);
        if (setters.setBlueprints) setters.setBlueprints([]);
        if (setters.setMachineElementsLedger) setters.setMachineElementsLedger([]);
        break;

      case 'entrepot':
      case 'warehouse':
        this.saveWarehouseItems([]);
        this.saveEntrepotComponents([]);
        this.saveCompGroups([]);
        this.saveCompFamilies([]);
        this.saveCompTemplates([]);
        this.savePartTypes([]);
        this.savePartDesignations([]);
        if (setters.setWarehouseItems) setters.setWarehouseItems([]);
        if (setters.setEntrepotComponents) setters.setEntrepotComponents([]);
        if (setters.setCompGroups) setters.setCompGroups([]);
        if (setters.setCompFamilies) setters.setCompFamilies([]);
        if (setters.setCompTemplates) setters.setCompTemplates([]);
        if (setters.setPartTypes) setters.setPartTypes([]);
        if (setters.setPartDesignations) setters.setPartDesignations([]);
        break;

      case 'zones':
      case 'users':
        this.saveZones([]);
        this.savePersonnel([], [], []);
        try {
          new AuthService().clearPersonnelAuthAccounts(true);
        } catch {
          /* ignore */
        }
        if (setters.setZones) setters.setZones([]);
        if (setters.setUsers) setters.setUsers([]);
        if (setters.setTechnicians) setters.setTechnicians([]);
        if (setters.setOperations) setters.setOperations([]);
        break;

      case 'mouvements':
      case 'movements':
        this.saveMouvements([]);
        this.saveSortiesExterne([]);
        movementRepository.bulkReplace(
          [],
          buildInitialStockMap(storageService.getItem(STORAGE_KEYS.RAW_STOCK) || [])
        );
        if (setters.setMouvements) setters.setMouvements([]);
        if (setters.setSortiesExterne) setters.setSortiesExterne([]);
        break;

      case 'preventive':
        this.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_TASKS);
        this.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_ACTIONS);
        this.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_GUIDES);
        this.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_PLANS);
        this.purgeLegacyKeysFor(STORAGE_KEYS.PREVENTIVE_EXECUTIONS);
        this.savePreventiveTasks([]);
        this.savePreventiveActions([]);
        this.savePreventiveGuides([]);
        this.savePreventivePlans([]);
        this.savePreventiveExecutions([]);
        this.saveMeterReadings([]);
        if (setters.setPreventiveTasks) setters.setPreventiveTasks([]);
        if (setters.setPreventiveActions) setters.setPreventiveActions([]);
        if (setters.setPreventiveGuides) setters.setPreventiveGuides([]);
        if (setters.setPreventivePlans) setters.setPreventivePlans([]);
        if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);
        if (setters.setMeterReadings) setters.setMeterReadings([]);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('preventive_tasks_updated', { detail: [] }));
          window.dispatchEvent(new CustomEvent('preventive_executions_updated', { detail: [] }));
        }
        indexedDBService
          .setItemsBatch({
            [STORAGE_KEYS.PREVENTIVE_TASKS]: [],
            [STORAGE_KEYS.PREVENTIVE_ACTIONS]: [],
            [STORAGE_KEYS.PREVENTIVE_GUIDES]: [],
            [STORAGE_KEYS.PREVENTIVE_PLANS]: [],
            [STORAGE_KEYS.PREVENTIVE_EXECUTIONS]: [],
          })
          .catch(() => false);
        indexedDBService.clear('preventive').catch(() => false);
        break;

      case 'corrective':
        this.saveCorrectiveInterventions([]);
        this.saveCorrectiveActionsByPanne({});
        this.saveCorrectivePanneCategories({});
        this.saveCorrectiveTravaux([]);
        this.saveCorrectiveIntervenants([]);
        if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions([]);
        if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne({});
        if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories({});
        if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire([]);
        if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants([]);
        break;

      default:
        break;
    }

    return { section, cleared: true };
  },
};

export default DataGateway;
