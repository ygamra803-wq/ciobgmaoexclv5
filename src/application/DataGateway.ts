import { STORAGE_KEYS, LEGACY_KEY_MAP, ALL_LEGACY_KEYS } from '../infrastructure/persistence/storageKeys';
import { storageService } from '../utils/storageService';
import { indexedDBService } from '../infrastructure/database/IndexedDBService';
import { dataIntegrityService } from '../services/dataIntegrityService';
import { sanitizeObject } from '../utils/sanitize';
import { safeId } from '../utils/safeId';
import { ValidationService } from '../core/validation/ValidationService';
import { AuthService } from '../core/security/AuthService';
import { movementRepository } from './MovementRepository';
import { StockCalculationService } from '../domain/pdr/services/StockCalculationService';
import { sanitizeMachinesHierarchy } from '../utils/assetHierarchy';
import {
  EMPTY_FISCAL_BUDGET,
  DEMO_FISCAL_BUDGET,
  type FiscalBudgetConfig,
  type BudgetPeriodMode,
  type BudgetAuditEntry,
} from '../domain/finance/entities/FinancialBudget';
import type { GmaoStoreSetters } from '../types/store';
import type { IAuditEvent, AuditSnapshot } from '../types/audit';
import {
  exportCmCatalogBundle,
  exportEntrepotBomBundle,
  validateAndCommitAssetsMachinesBundle,
  validateAndCommitCmCatalogBundle,
  validateAndCommitDemoBundle,
  validateAndCommitEntrepotBomBundle,
  validateAndCommitPmCatalogBundle,
  validateAndCommitRefParcBundle,
  validateAndCommitRefPdrBundle,
  validateAndCommitRefPersonnelBundle,
} from '../services/import/unifiedImportPipeline';
import type {
  AssetsMachineRow,
  DemoBundleInput,
  DemoBundleStagingResult,
  ImportReport,
  PmCatalogActionRow,
  PmCatalogGuideRow,
  RefParcFamilyRow,
  RefParcGeneralSystemTypeRow,
  RefParcTemplateRow,
  RefParcZoneRow,
  RefPdrGroupRow,
  RefPdrItemRow,
  RefPdrTypeRow,
  RefPersonnelOperationRow,
  RefPersonnelTechnicianRow,
} from '../services/import/types/unifiedImportTypes';

/** Normalizes arbitrary audit snapshot values into a frozen object record or null before persisting. */
function freezeAuditSnapshot(val: unknown): AuditSnapshot {
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    return Object.freeze({ ...(val as Record<string, unknown>) });
  }
  if (Array.isArray(val)) {
    return Object.freeze({ items: Object.freeze([...val]) });
  }
  return val == null ? null : Object.freeze({ value: val });
}
import type {
  IStockItem,
  IMouvement,
  IType,
  IPartGroup,
  IPartDesignation,
  PdrGroup,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IBlueprint,
  IBlueprintTheoreticalPdr,
  IGeneralSystemType,
  IZone,
  IUserRecord,
  ITechnician,
  IOperation,
  IWarehouseItem,
  IEntrepotComponent,
  ICompGroup,
  ICompFamily,
  ICompTemplate,
  IPartType,
  ISortieDemand,
} from '../types/domain';
import type { IReplenishmentOrder } from '../types/replenishment';
import type {
  MachineElement,
  PreventiveTaskItem,
  IPreventiveActionCatalogItem,
  IPreventiveGuideCatalogItem,
  IPreventivePlanCatalogItem,
  SortieExterneItem,
  CorrectiveInterventionItem,
  CorrectiveIntervenantEntry,
} from '../types/store';
import type { PreventiveExecutionRecord } from '../types/preventive';
import type { IMeterReading } from '../types/meter';
import type { IWorkshopOrder } from '../domain/corrective/workshopOrderService';
import type { INeedRequest } from '../domain/corrective/needRequestService';

import seedMachines from '../data/machines/seedMachines.json';
import seedGeneralSystemTypes from '../data/machines/seedGeneralSystemTypes.json';
import seedFamilies from '../data/machines/seedFamilies.json';
import seedTemplates from '../data/machines/seedTemplates.json';
import seedBlueprints from '../data/machines/seedBlueprints.json';
import seedZones from '../data/zones/seedZones.json';
import seedMachineBomLedger from '../data/machines/seedMachineBomLedger.json';

import seedPdrGroups from '../data/stock/seedPdrGroups.json';
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
import seedPartGroups from '../data/warehouse/seedPartGroups.json';
import seedPartTypes from '../data/warehouse/seedPartTypes.json';
import seedPartDesignations from '../data/warehouse/seedPartDesignations.json';

/**
 * Builds an initial stock lookup map (`ref -> stockInitial`) used to re-prime
 * `movementRepository` during bulk seed or server state synchronization.
 *
 * @param rawStock - Array of stock articles (`IStockItem[]`).
 * @returns Map of trimmed reference strings to numeric `stockInitial` balances.
 */
function buildInitialStockMap(
  rawStock: ReadonlyArray<{ ref?: unknown; Ref?: unknown; stockInitial?: unknown }> = []
): Map<string, number> {
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
 * @namespace DataGateway
 * @description
 * Canonical Single Source of Truth (SSOT) Write & Lifecycle Gateway for CIOB GMAO Nexus v5.0.2.
 *
 * ### Architectural Invariants (`AGENTS.md` §1.1, §1.2, §1.6, §1.7):
 * 1. **Single Write Path:** Every entity mutation persists exclusively through `STORAGE_KEYS`
 *    via `storageService` and `indexedDBService`.
 * 2. **Zero Silent Seed Reinjection:** Empty collections (`[]`) are valid factory states.
 *    Demo data is loaded exclusively via explicit user invocation (`loadDemoData` / `loadDemoSection`).
 *    When `START_MODE === 'empty'`, `clearAllForRealFactory` purges all legacy keys so reload (`F5`) remains `0`.
 * 3. **Referential Integrity & Orphan Tagging:** `savePreventiveTasks`, `saveCorrectiveInterventions`,
 *    and `saveMouvements` support referential validation against registered active machines/stock (`_isOrphan` tagging or strict filtering).
 * 4. **Append-Only Institutional Audit Ledger:** `appendAuditEvent` freezes (`Object.freeze`) `before`/`after`
 *    snapshots and prepends immutable audit entries to `STORAGE_KEYS.AUDIT_EVENTS`.
 */
export const DataGateway = {
  /**
   * Recursively sanitizes an incoming entity payload against XSS/HTML injection
   * while preserving numeric, boolean, and structural types.
   *
   * @param payload - Raw object, array, or primitive payload.
   * @returns Sanitized deep clone of `payload`.
   */
  sanitizePayload(payload) {
    return sanitizeObject(payload);
  },

  /**
   * Validates an entity record against its domain schema in {@link ValidationService}.
   *
   * @param entityType - Domain entity discriminator (`'stock' | 'machine' | 'movement' | 'zone' | 'user'`).
   * @param item - Candidate entity payload to validate.
   * @returns Validation outcome containing `isValid`/`valid`, `errors`, and normalized `data`.
   */
  validateEntity(entityType: string, item: unknown) {
    switch (entityType) {
      case 'stock':
        return ValidationService.validateStockItem(item);
      case 'machine':
        return ValidationService.validateMachine(item);
      case 'movement':
        return ValidationService.validateMovement(item);
      case 'zone': {
        const validatorWithZone = ValidationService as {
          validateZone?: (z: unknown) => { isValid: boolean; errors: string[]; data: unknown };
        };
        if (typeof validatorWithZone.validateZone === 'function') {
          return validatorWithZone.validateZone(item);
        }
        const z = item as { id_zone?: unknown; id?: unknown } | null | undefined;
        return { isValid: Boolean(z && (z.id_zone || z.id)), errors: [], data: item };
      }
      case 'user':
        return ValidationService.validateUser(item);
      default:
        return { valid: true, isValid: true, data: item, errors: [] };
    }
  },

  // ==========================================
  // 1. MACHINES & TOPOLOGY
  // ==========================================
  /**
   * Persists the registered shopfloor machines collection (`STORAGE_KEYS.MACHINES` / Tier 2 Physical Assets).
   * Normalizes `asset_class` (`'PRODUCTION' | 'SYSTEM_GENERAL'`), enforces acyclic `parent_id` line hierarchy
   * via `sanitizeMachinesHierarchy`, and optionally filters invalid records via `ValidationService.validateMachine`.
   *
   * @param list - Array of machine records (`IMachine[]`).
   * @param options - Optional `{ validate?: boolean }` flag.
   * @returns Normalized and persisted array of machines.
   */
  saveMachines(list = [], { validate = false } = {}) {
    let clean = Array.isArray(list)
      ? sanitizeMachinesHierarchy(
          list.map((m) => {
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
        )
      : [];
    if (validate) {
      clean = clean.filter((m) => {
        const res = ValidationService.validateMachine(m) as { isValid?: boolean; valid?: boolean };
        return res.isValid ?? res.valid ?? true;
      });
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

  /**
   * Persists Tier 3 virtual cognitive blueprints (`STORAGE_KEYS.BLUEPRINTS`).
   * Guarantees that `preventivePlanItems` and `commonFailures` are always initialized as arrays.
   * Note: Blueprints are virtual cognitive twins and never own a physical `Zone` or `Technician`.
   *
   * @param list - Array of blueprint records (`IBlueprint[]`).
   * @returns Normalized blueprint array.
   */
  saveBlueprints(
    list: ReadonlyArray<
      Omit<IBlueprint, 'pdr_theoriques'> & {
        pdr_theoriques?: ReadonlyArray<string | IBlueprintTheoreticalPdr>;
      }
    > = []
  ): IBlueprint[] {
    const clean: IBlueprint[] = Array.isArray(list)
      ? list.map((b) => ({
          ...b,
          pdr_theoriques: Array.isArray(b?.pdr_theoriques)
            ? b.pdr_theoriques.map((p): IBlueprintTheoreticalPdr =>
                typeof p === 'string' ? { id_pdr: p, ref: p } : p
              )
            : [],
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
  /**
   * Persists the canonical spare parts catalog (`STORAGE_KEYS.RAW_STOCK`).
   *
   * @param list - Array of stock items (`IStockItem[]`).
   * @returns Persisted stock array.
   */
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

  savePdrGroups(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PDR_GROUPS, clean);
    return clean;
  },

  loadPdrGroups() {
    const data = storageService.getItem(STORAGE_KEYS.PDR_GROUPS);
    return Array.isArray(data) ? data : [];
  },

  saveDesignations(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.DESIGNATIONS, clean);
    return clean;
  },

  /**
   * Persists the stock movement ledger (`STORAGE_KEYS.MOUVEMENTS`).
   * When `strict === true` and `stock` is provided, filters out movements referencing unknown `ref` codes.
   *
   * @param list - Array of stock movement records (`IMouvement[]`).
   * @param options - Optional `{ stock?: IStockItem[] | null, strict?: boolean }` referential filter config.
   * @returns Persisted movement array.
   */
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

  saveReplenishmentOrders(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.REPLENISHMENT_ORDERS, clean);
    return clean;
  },

  // ==========================================
  // 3. PREVENTIVE MAINTENANCE
  // ==========================================
  /**
   * Persists preventive maintenance tasks (`STORAGE_KEYS.PREVENTIVE_TASKS`) with optional
   * referential integrity checking against registered `machines`.
   * - In non-strict mode (`strict: false`), tasks referencing unknown/archived machines are tagged with `_isOrphan: true`.
   * - In strict mode (`strict: true`), orphan tasks are excluded from persistence.
   *
   * @param list - Array of preventive task records (`IPreventiveTask[]`).
   * @param options - Optional `{ machines?: IMachine[] | null, strict?: boolean }`.
   * @returns `{ saved: IPreventiveTask[], orphanCount: number }`.
   */
  savePreventiveTasks(list = [], { machines = null, strict = false } = {}) {
    let clean = Array.isArray(list) ? list : [];
    let orphanCount = 0;

    if (Array.isArray(machines) && (machines.length > 0 || strict)) {
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
  /**
   * Persists corrective maintenance interventions (`DI` / `BT` in `STORAGE_KEYS.CORRECTIVE_INTERVENTIONS`)
   * with optional referential integrity checking against registered `machines`.
   *
   * @param list - Array of corrective intervention records (`ICorrectiveIntervention[]`).
   * @param options - Optional `{ machines?: IMachine[] | null, strict?: boolean }`.
   * @returns `{ saved: ICorrectiveIntervention[], orphanCount: number }`.
   */
  saveCorrectiveInterventions(list = [], { machines = null, strict = false } = {}) {
    let clean = Array.isArray(list) ? list : [];
    let orphanCount = 0;

    if (Array.isArray(machines) && (machines.length > 0 || strict)) {
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

  /**
   * Persists Internal Mechanical Workshop Orders (`Bon de Réalisation / Rectification` — `COR-ATELIER-P0`)
   * to `STORAGE_KEYS.WORKSHOP_ORDERS` (`gmao_workshop_orders_v1`).
   *
   * @param list - Array of workshop order records (`IWorkshopOrder[]`).
   * @returns Persisted workshop orders array.
   */
  saveWorkshopOrders<T = IWorkshopOrder>(list: T[] = []): T[] {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.WORKSHOP_ORDERS, clean);
    return clean;
  },

  /**
   * Persists Need Requests & Handoff records (`COR-HANDOFF-P0`)
   * to `STORAGE_KEYS.NEED_REQUESTS` (`gmao_need_requests_v1`).
   *
   * @param list - Array of need request records (`INeedRequest[]`).
   * @returns Persisted need requests array.
   */
  saveNeedRequests<T = INeedRequest>(list: T[] = []): T[] {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.NEED_REQUESTS, clean);
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

  savePartGroups(list = []) {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.PART_GROUPS, clean);
    return clean;
  },

  loadPartGroups() {
    const data = storageService.getItem(STORAGE_KEYS.PART_GROUPS);
    return Array.isArray(data) ? data : [];
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
  /**
   * Retrieves the active fiscal budget configuration (`STORAGE_KEYS.FINANCIAL_BUDGETS`).
   * Enforces the `FIN-P0` zero-seed invariant: when `START_MODE === 'empty'` and the stored
   * budget originated from `'DEMO_SEED'`, returns a clean `EMPTY_FISCAL_BUDGET`.
   *
   * @returns Normalized {@link FiscalBudgetConfig}.
   */
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

  /**
   * Sanitizes, validates, and persists the fiscal budget configuration (`STORAGE_KEYS.FINANCIAL_BUDGETS`).
   * Automatically records a `BudgetAuditEntry` in `budgetChangeLog` (retaining the latest 5 revisions),
   * appends an immutable `BUDGET_UPDATED` event to `STORAGE_KEYS.AUDIT_EVENTS` (unless triggered by
   * `FACTORY_RESET` or `DEMO_SEED`), and dispatches the `'gmao_financial_budget_updated'` DOM event.
   *
   * @param budget - Partial or complete {@link FiscalBudgetConfig} update payload.
   * @param actorName - Identifier of the administrator or system actor performing the update.
   * @returns Normalized and persisted {@link FiscalBudgetConfig}.
   */
  saveFinancialBudget(budget: Partial<FiscalBudgetConfig>, actorName?: string): FiscalBudgetConfig {
    const clean = this.sanitizePayload(budget || {}) as Partial<FiscalBudgetConfig>;
    const prevSaved = storageService.getItem(STORAGE_KEYS.FINANCIAL_BUDGETS) as Partial<FiscalBudgetConfig> | null;

    const fiscalYear = Number(clean.fiscalYear) || new Date().getFullYear();
    const allocatedPreventive = Math.max(0, Number(clean.allocatedPreventive) || 0);
    const allocatedCorrective = Math.max(0, Number(clean.allocatedCorrective) || 0);
    const allocatedExternal = Math.max(0, Number(clean.allocatedExternal) || 0);
    const allocatedSparesStock = Math.max(0, Number(clean.allocatedSparesStock) || 0);
    const periodMode: BudgetPeriodMode =
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

    let budgetChangeLog: BudgetAuditEntry[] = Array.isArray(clean.budgetChangeLog)
      ? clean.budgetChangeLog
      : Array.isArray(prevSaved?.budgetChangeLog)
      ? prevSaved.budgetChangeLog
      : [];

    if (updatedBy === 'FACTORY_RESET') {
      budgetChangeLog = [];
    } else if (updatedBy !== 'DEMO_SEED') {
      const auditEntry: BudgetAuditEntry = {
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
    if (updatedBy !== 'FACTORY_RESET' && updatedBy !== 'DEMO_SEED') {
      this.appendAuditEvent({
        actorId: updatedBy,
        actorName: updatedBy,
        actorRole: 'ADMIN',
        actionType: 'BUDGET_UPDATED',
        entityType: 'FINANCIAL_BUDGET',
        entityId: String(fiscalYear),
        before: prevSaved
          ? {
              fiscalYear: prevSaved.fiscalYear,
              periodMode: prevSaved.periodMode,
              allocatedPreventive: prevSaved.allocatedPreventive,
              allocatedCorrective: prevSaved.allocatedCorrective,
              allocatedExternal: prevSaved.allocatedExternal,
              allocatedSparesStock: prevSaved.allocatedSparesStock,
            }
          : null,
        after: {
          fiscalYear,
          periodMode,
          totalAllocated,
          allocatedPreventive,
          allocatedCorrective,
          allocatedExternal,
          allocatedSparesStock,
        },
        meta: {
          summary: `Budget Ex. ${fiscalYear} (${periodMode}) mis à jour: ${totalAllocated} MAD`,
        },
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao_financial_budget_updated', { detail: next }));
    }
    return next;
  },

  // ==========================================
  // 7c. APPEND-ONLY ENTERPRISE AUDIT LEDGER (AUDIT-LEDGER-P0)
  // ==========================================
  /**
   * Reads the institutional append-only audit ledger (`STORAGE_KEYS.AUDIT_EVENTS`).
   *
   * @returns Array of immutable audit event records (`IAuditEvent[]`).
   */
  getAuditEvents(): IAuditEvent[] {
    const raw = storageService.getItem(STORAGE_KEYS.AUDIT_EVENTS);
    return Array.isArray(raw) ? (raw as IAuditEvent[]) : [];
  },

  /**
   * Persists the audit events collection to `STORAGE_KEYS.AUDIT_EVENTS` and dispatches
   * `'gmao_audit_events_synced'`.
   *
   * @param list - Array of audit events.
   * @returns Persisted audit events array.
   */
  saveAuditEvents(list: IAuditEvent[] = []): IAuditEvent[] {
    const clean = Array.isArray(list) ? list : [];
    storageService.setItem(STORAGE_KEYS.AUDIT_EVENTS, clean);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao_audit_events_synced', { detail: { list: clean } }));
    }
    return clean;
  },

  /**
   * Constructs an immutable (`Object.freeze`) audit event with frozen `before`, `after`, and `meta`
   * snapshots, prepends it to `STORAGE_KEYS.AUDIT_EVENTS`, and dispatches `'gmao_audit_event_appended'`.
   *
   * @param payload - Audit event descriptor (`actionType`, `entityType`, `entityId`, `before`, `after`, actor details).
   * @returns `{ event, list }` containing the newly frozen event and updated ledger.
   */
  appendAuditEvent(payload: {
    id?: string;
    ts?: string;
    actorId?: string;
    actorName?: string;
    actorRole?: string;
    actionType: string;
    entityType: string;
    entityId: string;
    before: unknown;
    after: unknown;
    meta?: Record<string, unknown>;
  }): { event: IAuditEvent; list: IAuditEvent[] } {
    const current = this.getAuditEvents();
    const safeBefore = freezeAuditSnapshot(payload.before);
    const safeAfter = freezeAuditSnapshot(payload.after);
    const event: IAuditEvent = Object.freeze({
      id: payload.id || safeId('AUD'),
      ts: payload.ts || new Date().toISOString(),
      actorId: String(payload.actorId || payload.actorName || 'SYSTEM').trim(),
      actorName: String(payload.actorName || payload.actorId || 'Système GMAO').trim(),
      actorRole: String(payload.actorRole || 'ADMIN').trim().toUpperCase(),
      actionType: String(payload.actionType || 'MUTATION').trim(),
      entityType: String(payload.entityType || 'ENTITY').trim(),
      entityId: String(payload.entityId || 'UNKNOWN').trim(),
      before: safeBefore,
      after: safeAfter,
      meta: Object.freeze({
        ...(typeof navigator !== 'undefined' && navigator.userAgent ? { userAgent: navigator.userAgent } : {}),
        ...(payload.meta || {}),
      }),
    });
    const next = [event, ...current];
    this.saveAuditEvents(next);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao_audit_event_appended', { detail: { event, list: next } }));
    }
    return { event, list: next };
  },

  // ==========================================
  // 8. EXPLICIT DEMO DATA LOADER & FACTORY CLEAR
  // ==========================================
  /**
   * Explicitly loads canonical factory PDR stock catalog into store and storage
   * through `UnifiedImportPipeline` (`validateAndCommitRefPdrBundle`), rejecting broken FK hierarchies.
   */
  initRealStock(setters: GmaoStoreSetters = {}) {
    const demoBundle = this.getOfficialDemoBundle();
    const pdrReport = validateAndCommitRefPdrBundle(demoBundle.refPdr, {
      mode: 'MERGE',
      origin: 'DEMO_BUNDLE',
      dryRun: true,
      existingPdrGroups: [],
      existingStockTypes: [],
      existingStock: [],
      existingMouvements: [],
    });

    if (!pdrReport.success || pdrReport.rejected.length > 0) {
      const details = pdrReport.rejected
        .slice(0, 3)
        .map((r) => `[${r.stage}] ${r.identifier || r.entity}: ${r.message}`)
        .join(' | ');
      throw new Error(`Échec de validation REF_PDR (initRealStock) : ${details}`);
    }

    const { nextGroups, nextTypes, nextStock, nextDesignations } = pdrReport.staging;
    this.savePdrGroups(nextGroups);
    this.saveStockTypes(nextTypes);
    this.saveStock(nextStock);
    this.saveDesignations(nextDesignations);
    if (setters.setPdrGroups) setters.setPdrGroups(nextGroups);
    if (setters.setTypes) setters.setTypes(nextTypes);
    if (setters.setRawStock) setters.setRawStock(nextStock);
    if (setters.setDesignations) setters.setDesignations(nextDesignations);
    return { stockCount: nextStock.length, pipelineReport: pdrReport };
  },

  /**
   * Builds the canonical multi-stage `DEMO_BUNDLE` (`REF_PARC -> REF_PERSONNEL -> ASSETS_MACHINES -> REF_PDR -> PM_CATALOG`)
   * from the official factory demo seeds owned exclusively by `DataGateway`.
   */
  getOfficialDemoBundle(): DemoBundleInput & { bundleType: 'DEMO_BUNDLE' } {
    return {
      bundleType: 'DEMO_BUNDLE',
      refParc: {
        bundleType: 'REF_PARC',
        zones: seedZones as unknown as RefParcZoneRow[],
        families: seedFamilies as unknown as RefParcFamilyRow[],
        templates: seedTemplates as unknown as RefParcTemplateRow[],
        generalSystemTypes: seedGeneralSystemTypes as unknown as RefParcGeneralSystemTypeRow[],
      },
      refPersonnel: {
        bundleType: 'REF_PERSONNEL',
        technicians: seedTechnicians as unknown as RefPersonnelTechnicianRow[],
        operations: seedOperations as unknown as RefPersonnelOperationRow[],
      },
      assetsMachines: {
        bundleType: 'ASSETS_MACHINES',
        machines: seedMachines as unknown as AssetsMachineRow[],
      },
      refPdr: {
        bundleType: 'REF_PDR',
        groups: seedPdrGroups as unknown as RefPdrGroupRow[],
        types: seedStockTypes as unknown as RefPdrTypeRow[],
        items: seedStockItems as unknown as RefPdrItemRow[],
      },
      pmCatalog: {
        bundleType: 'PM_CATALOG',
        actions: seedPreventiveActions as unknown as PmCatalogActionRow[],
        guides: seedPreventiveGuides as unknown as PmCatalogGuideRow[],
      },
      entrepotBom: exportEntrepotBomBundle({
        compGroups: seedCompGroups,
        compFamilies: seedCompFamilies,
        compTemplates: seedCompTemplates,
        partGroups: seedPartGroups as IPartGroup[],
        partTypes: seedPartTypes,
        partDesignations: seedPartDesignations as IPartDesignation[],
      }),
      cmCatalog: exportCmCatalogBundle({
        panneCategories: seedPanneByCategory,
        actionsByPanne: seedActionsByPanne,
      }),
    };
  },

  /**
   * Explicitly loads all documented factory demo seeds into canonical `STORAGE_KEYS`
   * after validating all Level 2 & Level 1 catalogs/assets (`REF_PARC -> REF_PERSONNEL -> ASSETS_MACHINES -> REF_PDR -> PM_CATALOG`)
   * through `UnifiedImportPipeline` (`validateAndCommitDemoBundle`).
   * Sets `DEMO_MODE = true` and `START_MODE = 'demo'`.
   *
   * @param setters - Optional store setter callbacks to update live React state in-place.
   * @returns Summary counts of loaded seed entities and the unified `pipelineReport`.
   */
  loadDemoData(setters: GmaoStoreSetters = {}): {
    machinesCount: number;
    stockCount: number;
    preventiveCount: number;
    correctiveCount: number;
    movementsCount: number;
    pipelineReport: ImportReport<DemoBundleStagingResult>;
  } {
    // 1. Validate & stage all 5 structured catalog/asset bundles via UnifiedImportPipeline
    const demoBundle = this.getOfficialDemoBundle();
    const pipelineReport = validateAndCommitDemoBundle(demoBundle, {
      mode: 'MERGE',
      origin: 'DEMO_BUNDLE',
      dryRun: true,
      strictPdrCheck: false,
    });

    if (!pipelineReport.success || pipelineReport.rejected.length > 0) {
      const details = pipelineReport.rejected
        .slice(0, 5)
        .map((r) => `[${r.stage}] ${r.identifier || r.entity}: ${r.message}`)
        .join(' | ');
      throw new Error(`Échec de validation du paquet démo (DEMO_BUNDLE) : ${details}`);
    }

    const {
      nextZones,
      nextFamilies,
      nextTemplates,
      nextGeneralSystemTypes,
      nextTechnicians,
      nextOperations,
      nextUsers,
      nextMachines,
      nextGroups: typedPdrGroups,
      nextTypes: typedStockTypes,
      nextStock: stagedStockItems,
      nextDesignations: derivedDesignations,
      nextActions: validatedPreventiveActions,
      nextGuides: validatedPreventiveGuides,
      nextCompGroups: validatedCompGroups,
      nextCompFamilies: validatedCompFamilies,
      nextCompTemplates: validatedCompTemplates,
      nextPartGroups: validatedPartGroups,
      nextPartTypes: validatedPartTypes,
      nextPartDesignations: validatedPartDesignations,
      nextPanneCategories: validatedPanneCategories,
      nextActionsByPanne: validatedActionsByPanne,
    } = pipelineReport.staging;

    // Reconcile movement balances (entrees, sorties, stockActuel) on stagedStockItems from seedStockItems
    const seedBalanceByRef = new Map<
      string,
      { entrees: number; sorties: number; stockActuel: number }
    >();
    for (const s of seedStockItems) {
      const key = String(s.ref || '').trim().toUpperCase();
      if (key) {
        seedBalanceByRef.set(key, {
          entrees: Number(s.entrees) || 0,
          sorties: Number(s.sorties) || 0,
          stockActuel: Number(s.stockActuel) || 0,
        });
      }
    }

    const typedStockItems: IStockItem[] = stagedStockItems.map((item) => {
      const bal = seedBalanceByRef.get(String(item.ref || '').trim().toUpperCase());
      if (!bal) return item;
      return {
        ...item,
        entrees: bal.entrees,
        sorties: bal.sorties,
        stockActuel: bal.stockActuel,
      };
    });

    const typedMovements = seedMouvements as unknown as IMouvement[];

    const formattedCompTemplates = seedCompTemplates.map((t, idx) => {
      const rec = t as Record<string, unknown>;
      return {
        ...t,
        id_templates:
          t.id_templates || t.id_template || (rec.id_comp_template as string | undefined) || `TPL-${idx + 1}`,
      };
    });

    // 2. Set DEMO_MODE and START_MODE flags explicitly via storageService SSOT
    storageService.setItem(STORAGE_KEYS.DEMO_MODE, true);
    storageService.setItem(STORAGE_KEYS.START_MODE, 'demo');

    // 3. Write all validated bundles & operational fixtures to canonical STORAGE_KEYS in strict dependency order:
    // REF_PARC (Zones -> Families -> Templates -> GeneralSystemTypes) -> REF_PERSONNEL -> ASSETS_MACHINES -> Blueprints -> MachineBom
    this.saveZones(nextZones);
    this.saveFamilies(nextFamilies);
    this.saveTemplates(nextTemplates);
    this.saveGeneralSystemTypes(nextGeneralSystemTypes);
    this.savePersonnel(nextUsers, nextTechnicians, nextOperations);
    this.saveMachines(nextMachines);
    const savedBlueprints = this.saveBlueprints(seedBlueprints);
    this.saveMachineBom(seedMachineBomLedger);

    // REF_PDR (Groups -> Types -> Items -> Designations) -> Movements
    this.savePdrGroups(typedPdrGroups);
    this.saveStockTypes(typedStockTypes);
    this.saveStock(typedStockItems);
    this.saveDesignations(derivedDesignations);
    this.saveMouvements(typedMovements);
    this.saveSortieDemands([]);
    this.saveReplenishmentOrders([]);
    movementRepository.bulkReplace(typedMovements, buildInitialStockMap(typedStockItems));

    // PM_CATALOG (Actions -> Guides) -> Preventive Tasks
    this.savePreventiveActions(validatedPreventiveActions);
    this.savePreventiveGuides(validatedPreventiveGuides);
    const { saved: validDemoTasks } = this.savePreventiveTasks(seedPreventiveTasks, {
      machines: nextMachines,
      strict: true,
    });
    this.savePreventivePlans([]);
    this.savePreventiveExecutions([]);
    this.saveMeterReadings([]);

    const finalCompGroups = validatedCompGroups ?? seedCompGroups;
    const finalCompFamilies = validatedCompFamilies ?? seedCompFamilies;
    const finalCompTemplates = validatedCompTemplates ?? formattedCompTemplates;
    const finalPartGroups = validatedPartGroups ?? (seedPartGroups as IPartGroup[]);
    const finalPartTypes = validatedPartTypes ?? seedPartTypes;
    const finalPartDesignations = validatedPartDesignations ?? (seedPartDesignations as IPartDesignation[]);
    const finalPanneCategories = validatedPanneCategories ?? seedPanneByCategory;
    const finalActionsByPanne = validatedActionsByPanne ?? seedActionsByPanne;

    const { saved: validDemoCorrective } = this.saveCorrectiveInterventions(
      seedCorrectiveInterventions,
      {
        machines: nextMachines,
        strict: true,
      }
    );
    this.saveCorrectiveActionsByPanne(finalActionsByPanne);
    this.saveCorrectivePanneCategories(finalPanneCategories);
    this.saveCorrectiveTravaux(seedTravailAFaire);
    this.saveCorrectiveIntervenants(seedIntervenants);
    this.saveWorkshopOrders([]);
    this.saveNeedRequests([]);

    try {
      const authSvc = new AuthService();
      authSvc.syncTechnicianAccountsFromPersonnel(nextTechnicians, {
        activateByDefault: true,
      });
      authSvc.syncOperationAccountsFromPersonnel(nextOperations, {
        activateByDefault: true,
      });
    } catch {
      /* ignore auth sync error in headless tests */
    }

    this.saveWarehouseItems(seedWarehouseItems);
    this.saveEntrepotComponents(seedEntrepotComponents);
    this.saveCompGroups(finalCompGroups);
    this.saveCompFamilies(finalCompFamilies);
    this.saveCompTemplates(finalCompTemplates);
    this.savePartGroups(finalPartGroups);
    this.savePartTypes(finalPartTypes);
    this.savePartDesignations(finalPartDesignations);

    this.saveSortiesExterne(seedSortiesExternes);
    this.saveFinancialBudget(DEMO_FISCAL_BUDGET, 'DEMO_SEED');
    this.saveAuditEvents([]);

    // 4. Update React state setters if provided (preserving exact setter invocation order)
    if (setters.setMachines) setters.setMachines(nextMachines);
    if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes(nextGeneralSystemTypes);
    if (setters.setFamilies) setters.setFamilies(nextFamilies);
    if (setters.setTemplates) setters.setTemplates(nextTemplates);
    if (setters.setBlueprints) setters.setBlueprints(savedBlueprints);
    if (setters.setZones) setters.setZones(nextZones);
    if (setters.setMachineElementsLedger) setters.setMachineElementsLedger(seedMachineBomLedger);

    if (setters.setPdrGroups) setters.setPdrGroups(typedPdrGroups);
    if (setters.setTypes) setters.setTypes(typedStockTypes);
    if (setters.setRawStock) setters.setRawStock(typedStockItems);
    if (setters.setDesignations) setters.setDesignations(derivedDesignations);
    if (setters.setMouvements) setters.setMouvements(typedMovements);
    if (setters.setSortieDemands) setters.setSortieDemands([]);
    if (setters.setReplenishmentOrders) setters.setReplenishmentOrders([]);

    if (setters.setPreventiveTasks) setters.setPreventiveTasks(validDemoTasks);
    if (setters.setPreventiveActions) setters.setPreventiveActions(validatedPreventiveActions);
    if (setters.setPreventiveGuides) setters.setPreventiveGuides(validatedPreventiveGuides);
    if (setters.setPreventivePlans) setters.setPreventivePlans([]);
    if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);
    if (setters.setMeterReadings) setters.setMeterReadings([]);

    if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions(validDemoCorrective);
    if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne(finalActionsByPanne);
    if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories(finalPanneCategories);
    if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire(seedTravailAFaire);
    if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants(seedIntervenants);
    if (setters.setWorkshopOrders) setters.setWorkshopOrders([]);
    if (setters.setNeedRequests) setters.setNeedRequests([]);

    if (setters.setUsers) setters.setUsers(nextUsers);
    if (setters.setTechnicians) setters.setTechnicians(nextTechnicians);
    if (setters.setOperations) setters.setOperations(nextOperations);

    if (setters.setWarehouseItems) setters.setWarehouseItems(seedWarehouseItems);
    if (setters.setEntrepotComponents) setters.setEntrepotComponents(seedEntrepotComponents);
    if (setters.setCompGroups) setters.setCompGroups(finalCompGroups);
    if (setters.setCompFamilies) setters.setCompFamilies(finalCompFamilies);
    if (setters.setCompTemplates) setters.setCompTemplates(finalCompTemplates);
    if (setters.setPartGroups) setters.setPartGroups(finalPartGroups);
    if (setters.setPartTypes) setters.setPartTypes(finalPartTypes);
    if (setters.setPartDesignations) setters.setPartDesignations(finalPartDesignations);

    if (setters.setSortiesExterne) setters.setSortiesExterne(seedSortiesExternes);
    this.saveAuditEvents([]);
    if (setters.setAuditEvents) setters.setAuditEvents([]);

    return {
      machinesCount: nextMachines.length,
      stockCount: typedStockItems.length,
      preventiveCount: validDemoTasks.length,
      correctiveCount: validDemoCorrective.length,
      movementsCount: typedMovements.length,
      pipelineReport,
    };
  },

  /**
   * Purges all legacy storage keys mapped to a given canonical key (or all legacy keys
   * in `ALL_LEGACY_KEYS` when `canonicalKey === null`) to prevent stale data resurrection.
   *
   * @param canonicalKey - Specific canonical `STORAGE_KEYS` value, or `null` to purge all legacy keys.
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
   * Atomically clears all operational data for a clean real-factory deployment (`START_MODE = 'empty'`).
   * Sets `DEMO_MODE = false`, `START_MODE = 'empty'`, removes `FULL_STATE_SNAPSHOT`, purges all legacy keys,
   * writes empty collections (`[]` / `{}`) to all canonical keys in memory, `localStorage`, and `IndexedDB`,
   * and clears all `IndexedDB` object stores.
   *
   * @param setters - Optional store setter callbacks to zero out live React state immediately.
   * @returns Promise resolving to `{ cleared: true }` once all synchronous and asynchronous stores are wiped.
   */
  clearAllForRealFactory(setters: GmaoStoreSetters = {}) {
    storageService.setItem(STORAGE_KEYS.DEMO_MODE, false);
    storageService.setItem(STORAGE_KEYS.START_MODE, 'empty');
    storageService.removeItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT);

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
    this.savePdrGroups([]);
    this.saveDesignations([]);
    this.saveMouvements([]);
    this.saveSortieDemands([]);
    this.saveReplenishmentOrders([]);
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
    this.saveWorkshopOrders([]);
    this.saveNeedRequests([]);

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
    this.savePartGroups([]);
    this.savePartTypes([]);
    this.savePartDesignations([]);

    this.saveSortiesExterne([]);
    this.saveFinancialBudget({ ...EMPTY_FISCAL_BUDGET, updatedAt: new Date().toISOString() }, 'FACTORY_RESET');
    this.saveAuditEvents([]);

    if (setters.setMachines) setters.setMachines([]);
    if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes([]);
    if (setters.setFamilies) setters.setFamilies([]);
    if (setters.setTemplates) setters.setTemplates([]);
    if (setters.setBlueprints) setters.setBlueprints([]);
    if (setters.setZones) setters.setZones([]);
    if (setters.setMachineElementsLedger) setters.setMachineElementsLedger([]);

    if (setters.setRawStock) setters.setRawStock([]);
    if (setters.setTypes) setters.setTypes([]);
    if (setters.setPdrGroups) setters.setPdrGroups([]);
    if (setters.setDesignations) setters.setDesignations([]);
    if (setters.setMouvements) setters.setMouvements([]);
    if (setters.setSortieDemands) setters.setSortieDemands([]);
    if (setters.setReplenishmentOrders) setters.setReplenishmentOrders([]);

    if (setters.setPreventiveTasks) setters.setPreventiveTasks([]);
    if (setters.setPreventiveActions) setters.setPreventiveActions([]);
    if (setters.setPreventiveGuides) setters.setPreventiveGuides([]);
    if (setters.setPreventivePlans) setters.setPreventivePlans([]);
    if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);
    if (setters.setMeterReadings) setters.setMeterReadings([]);

    if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions([]);
    if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne({});
    if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories({});
    if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire([]);
    if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants([]);
    if (setters.setWorkshopOrders) setters.setWorkshopOrders([]);
    if (setters.setNeedRequests) setters.setNeedRequests([]);

    if (setters.setUsers) setters.setUsers([]);
    if (setters.setTechnicians) setters.setTechnicians([]);
    if (setters.setOperations) setters.setOperations([]);

    if (setters.setWarehouseItems) setters.setWarehouseItems([]);
    if (setters.setEntrepotComponents) setters.setEntrepotComponents([]);
    if (setters.setCompGroups) setters.setCompGroups([]);
    if (setters.setCompFamilies) setters.setCompFamilies([]);
    if (setters.setCompTemplates) setters.setCompTemplates([]);
    if (setters.setPartGroups) setters.setPartGroups([]);
    if (setters.setPartTypes) setters.setPartTypes([]);
    if (setters.setPartDesignations) setters.setPartDesignations([]);

    if (setters.setSortiesExterne) setters.setSortiesExterne([]);
    this.saveAuditEvents([]);
    if (setters.setAuditEvents) setters.setAuditEvents([]);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('preventive_tasks_updated', { detail: [] }));
      window.dispatchEvent(new CustomEvent('preventive_executions_updated', { detail: [] }));
    }

    // Return a promise that resolves once IndexedDB batch write + entity store clear completes
    const emptyBatch: Record<string, unknown> = {
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
      [STORAGE_KEYS.PDR_GROUPS]: [],
      [STORAGE_KEYS.DESIGNATIONS]: [],
      [STORAGE_KEYS.MOUVEMENTS]: [],
      [STORAGE_KEYS.SORTIE_DEMANDS]: [],
      [STORAGE_KEYS.REPLENISHMENT_ORDERS]: [],
      [STORAGE_KEYS.PREVENTIVE_TASKS]: [],
      [STORAGE_KEYS.PREVENTIVE_ACTIONS]: [],
      [STORAGE_KEYS.PREVENTIVE_GUIDES]: [],
      [STORAGE_KEYS.PREVENTIVE_PLANS]: [],
      [STORAGE_KEYS.PREVENTIVE_EXECUTIONS]: [],
      [STORAGE_KEYS.METER_READINGS]: [],
      [STORAGE_KEYS.CORRECTIVE_INTERVENTIONS]: [],
      [STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE]: {},
      [STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES]: {},
      [STORAGE_KEYS.CORRECTIVE_TRAVAUX]: [],
      [STORAGE_KEYS.CORRECTIVE_INTERVENANTS]: [],
      [STORAGE_KEYS.WORKSHOP_ORDERS]: [],
      [STORAGE_KEYS.NEED_REQUESTS]: [],
      [STORAGE_KEYS.PERSONNEL]: [],
      [STORAGE_KEYS.TECHNICIANS]: [],
      [STORAGE_KEYS.OPERATIONS]: [],
      [STORAGE_KEYS.WAREHOUSE_ITEMS]: [],
      [STORAGE_KEYS.ENTREPOT_COMPONENTS]: [],
      [STORAGE_KEYS.COMP_GROUPS]: [],
      [STORAGE_KEYS.COMP_FAMILIES]: [],
      [STORAGE_KEYS.COMP_TEMPLATES]: [],
      [STORAGE_KEYS.PART_GROUPS]: [],
      [STORAGE_KEYS.PART_TYPES]: [],
      [STORAGE_KEYS.PART_DESIGNATIONS]: [],
      [STORAGE_KEYS.SORTIE_EXTERNE]: [],
      [STORAGE_KEYS.FINANCIAL_BUDGETS]: { ...EMPTY_FISCAL_BUDGET },
      [STORAGE_KEYS.AUDIT_EVENTS]: [],
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
  loadFullServerState(serverData: Record<string, unknown> = {}, setters: GmaoStoreSetters = {}) {
    if (!serverData || typeof serverData !== 'object') return;

    const rawStock = (
      Array.isArray(serverData.rawStock)
        ? serverData.rawStock
        : Array.isArray(serverData.stock)
        ? serverData.stock
        : []
    ) as IStockItem[];
    const pdrGroups = (Array.isArray(serverData.pdrGroups) ? serverData.pdrGroups : []) as PdrGroup[];
    const types = (Array.isArray(serverData.types) ? serverData.types : []) as IType[];
    const designations = (Array.isArray(serverData.designations)
      ? serverData.designations
      : []) as IPartDesignation[];
    const machines = (Array.isArray(serverData.machines) ? serverData.machines : []) as IMachine[];
    const generalSystemTypes = (Array.isArray(serverData.generalSystemTypes)
      ? serverData.generalSystemTypes
      : []) as IGeneralSystemType[];
    const families = (Array.isArray(serverData.families) ? serverData.families : []) as IMachineFamily[];
    const templates = (Array.isArray(serverData.templates)
      ? serverData.templates
      : []) as IMachineTemplate[];
    const blueprints = (Array.isArray(serverData.blueprints) ? serverData.blueprints : []) as IBlueprint[];
    const zones = (Array.isArray(serverData.zones) ? serverData.zones : []) as IZone[];
    const machineElementsLedger = (Array.isArray(serverData.machineElementsLedger)
      ? serverData.machineElementsLedger
      : []) as MachineElement[];
    const mouvements = (Array.isArray(serverData.mouvements) ? serverData.mouvements : []) as IMouvement[];
    const preventiveTasks = (Array.isArray(serverData.preventiveTasks)
      ? serverData.preventiveTasks
      : []) as PreventiveTaskItem[];
    const preventiveActions = (Array.isArray(serverData.preventiveActions)
      ? serverData.preventiveActions
      : []) as IPreventiveActionCatalogItem[];
    const preventiveGuides = (Array.isArray(serverData.preventiveGuides)
      ? serverData.preventiveGuides
      : []) as IPreventiveGuideCatalogItem[];
    const preventivePlans = (Array.isArray(serverData.preventivePlans)
      ? serverData.preventivePlans
      : []) as IPreventivePlanCatalogItem[];
    const preventiveExecutions = (Array.isArray(serverData.preventiveExecutions)
      ? serverData.preventiveExecutions
      : []) as PreventiveExecutionRecord[];
    const correctiveInterventions = (Array.isArray(serverData.correctiveInterventions)
      ? serverData.correctiveInterventions
      : []) as CorrectiveInterventionItem[];
    const correctiveActionsByPanne = (
      serverData.correctiveActionsByPanne && typeof serverData.correctiveActionsByPanne === 'object'
        ? serverData.correctiveActionsByPanne
        : {}
    ) as Record<string, string[]>;
    const correctivePanneCategories = (
      serverData.correctivePanneCategories && typeof serverData.correctivePanneCategories === 'object'
        ? serverData.correctivePanneCategories
        : {}
    ) as Record<string, string[]>;
    const correctiveTravauxAFaire = (Array.isArray(serverData.correctiveTravauxAFaire)
      ? serverData.correctiveTravauxAFaire
      : []) as string[];
    const correctiveIntervenants = (Array.isArray(serverData.correctiveIntervenants)
      ? serverData.correctiveIntervenants
      : []) as CorrectiveIntervenantEntry[];
    const users = (Array.isArray(serverData.users) ? serverData.users : []) as IUserRecord[];
    const technicians = (Array.isArray(serverData.technicians)
      ? serverData.technicians
      : []) as ITechnician[];
    const operations = (Array.isArray(serverData.operations) ? serverData.operations : []) as IOperation[];
    const warehouseItems = (Array.isArray(serverData.warehouseItems)
      ? serverData.warehouseItems
      : []) as IWarehouseItem[];
    const entrepotComponents = (Array.isArray(serverData.entrepotComponents)
      ? serverData.entrepotComponents
      : []) as IEntrepotComponent[];
    const compGroups = (Array.isArray(serverData.compGroups) ? serverData.compGroups : []) as ICompGroup[];
    const compFamilies = (Array.isArray(serverData.compFamilies)
      ? serverData.compFamilies
      : []) as ICompFamily[];
    const compTemplates = (Array.isArray(serverData.compTemplates)
      ? serverData.compTemplates
      : []) as ICompTemplate[];
    const partGroups = (Array.isArray(serverData.partGroups) ? serverData.partGroups : []) as IPartGroup[];
    const partTypes = (Array.isArray(serverData.partTypes) ? serverData.partTypes : []) as IPartType[];
    const partDesignations = (Array.isArray(serverData.partDesignations)
      ? serverData.partDesignations
      : []) as IPartDesignation[];
    const sortiesExterne = (Array.isArray(serverData.sortiesExterne)
      ? serverData.sortiesExterne
      : []) as SortieExterneItem[];
    const sortieDemands = (Array.isArray(serverData.sortieDemands)
      ? serverData.sortieDemands
      : []) as ISortieDemand[];
    const replenishmentOrders = (Array.isArray(serverData.replenishmentOrders)
      ? serverData.replenishmentOrders
      : []) as IReplenishmentOrder[];
    const meterReadings = (Array.isArray(serverData.meterReadings)
      ? serverData.meterReadings
      : []) as IMeterReading[];
    const auditEvents = (Array.isArray(serverData.auditEvents)
      ? serverData.auditEvents
      : []) as IAuditEvent[];
    const workshopOrders = (Array.isArray(serverData.workshopOrders)
      ? serverData.workshopOrders
      : []) as IWorkshopOrder[];
    const needRequests = (Array.isArray(serverData.needRequests)
      ? serverData.needRequests
      : []) as INeedRequest[];

    const hasData =
      rawStock.length > 0 ||
      machines.length > 0 ||
      preventiveTasks.length > 0 ||
      correctiveInterventions.length > 0 ||
      mouvements.length > 0 ||
      sortieDemands.length > 0 ||
      replenishmentOrders.length > 0 ||
      meterReadings.length > 0 ||
      auditEvents.length > 0;

    storageService.setItem(STORAGE_KEYS.DEMO_MODE, false);
    storageService.setItem(STORAGE_KEYS.START_MODE, hasData ? 'custom' : 'empty');

    this.savePdrGroups(pdrGroups);
    this.saveStockTypes(types);
    this.saveStock(rawStock);
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
    this.saveReplenishmentOrders(replenishmentOrders);
    movementRepository.bulkReplace(mouvements, buildInitialStockMap(rawStock));
    this.savePreventiveTasks(preventiveTasks);
    this.savePreventiveActions(preventiveActions);
    this.savePreventiveGuides(preventiveGuides);
    this.savePreventivePlans(preventivePlans);
    this.savePreventiveExecutions(preventiveExecutions);
    this.saveMeterReadings(meterReadings);
    this.saveAuditEvents(auditEvents);
    this.saveCorrectiveInterventions(correctiveInterventions);
    this.saveCorrectiveActionsByPanne(correctiveActionsByPanne);
    this.saveCorrectivePanneCategories(correctivePanneCategories);
    this.saveCorrectiveTravaux(correctiveTravauxAFaire);
    this.saveCorrectiveIntervenants(correctiveIntervenants);
    this.saveWorkshopOrders(workshopOrders);
    this.saveNeedRequests(needRequests);
    this.savePersonnel(users, technicians, operations);
    try {
      const authSvc = new AuthService();
      if (technicians.length > 0) {
        authSvc.syncTechnicianAccountsFromPersonnel(technicians, { activateByDefault: true });
      }
      if (operations.length > 0) {
        authSvc.syncOperationAccountsFromPersonnel(operations, { activateByDefault: true });
      }
      if (!hasData && technicians.length === 0 && operations.length === 0) {
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
    this.savePartGroups(partGroups);
    this.savePartTypes(partTypes);
    this.savePartDesignations(partDesignations);
    this.saveSortiesExterne(sortiesExterne);

    if (typeof setters.applyRemoteStateUpdate === 'function') {
      setters.applyRemoteStateUpdate({
        pdrGroups,
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
        replenishmentOrders,
        preventiveTasks,
        preventiveActions,
        preventiveGuides,
        preventivePlans,
        preventiveExecutions,
        meterReadings,
        auditEvents,
        correctiveInterventions,
        correctiveActionsByPanne,
        correctivePanneCategories,
        correctiveTravauxAFaire,
        correctiveIntervenants,
        workshopOrders,
        needRequests,
        users,
        technicians,
        operations,
        warehouseItems,
        entrepotComponents,
        compGroups,
        compFamilies,
        compTemplates,
        partGroups,
        partTypes,
        partDesignations,
        sortiesExterne,
      });
    } else {
      if (setters.setPdrGroups) setters.setPdrGroups(pdrGroups);
      if (setters.setTypes) setters.setTypes(types);
      if (setters.setRawStock) setters.setRawStock(rawStock);
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
      if (setters.setReplenishmentOrders) setters.setReplenishmentOrders(replenishmentOrders);
      if (setters.setPreventiveTasks) setters.setPreventiveTasks(preventiveTasks);
      if (setters.setPreventiveActions) setters.setPreventiveActions(preventiveActions);
      if (setters.setPreventiveGuides) setters.setPreventiveGuides(preventiveGuides);
      if (setters.setPreventivePlans) setters.setPreventivePlans(preventivePlans);
      if (setters.setPreventiveExecutions) setters.setPreventiveExecutions(preventiveExecutions);
      if (setters.setMeterReadings) setters.setMeterReadings(meterReadings);
      if (setters.setAuditEvents) setters.setAuditEvents(auditEvents);
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
      if (setters.setPartGroups) setters.setPartGroups(partGroups);
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
  /**
   * Synchronizes ONLY Level 2 Corrective Maintenance Catalogs (`CM_CATALOG`: `panneCategories`,
   * `actionsByPanne`, `travauxAFaire`) in non-destructive `MERGE` mode without touching live
   * `correctiveInterventions` (`DI` / `BT`), `workshopOrders`, `needRequests`, or `intervenants`.
   */
  syncCmCatalogBaseline(setters: GmaoStoreSetters = {}) {
    const demoBundle = this.getOfficialDemoBundle();
    const rawCats = storageService.getItem(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES);
    const existingPanneCategories =
      rawCats && typeof rawCats === 'object' && !Array.isArray(rawCats)
        ? (rawCats as Record<string, string[]>)
        : {};
    const rawActions = storageService.getItem(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE);
    const existingActionsByPanne =
      rawActions && typeof rawActions === 'object' && !Array.isArray(rawActions)
        ? (rawActions as Record<string, string[]>)
        : {};
    const rawInterventions = storageService.getItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS);
    const existingCorrectiveInterventions = Array.isArray(rawInterventions) ? rawInterventions : [];

    const cmReport = validateAndCommitCmCatalogBundle(demoBundle.cmCatalog!, {
      mode: 'MERGE',
      origin: 'DEMO_BUNDLE',
      dryRun: true,
      existingPanneCategories,
      existingActionsByPanne,
      existingCorrectiveInterventions,
    });
    if (!cmReport.success || cmReport.rejected.length > 0) {
      throw new Error(
        `Échec synchronisation CM_CATALOG : ${cmReport.rejected[0]?.message || 'Erreur inconnue'}`
      );
    }

    const { nextPanneCategories, nextActionsByPanne } = cmReport.staging;

    // Non-destructive merge of standard Travaux à Faire with existing custom entries
    const rawExistingTravaux = storageService.getItem(STORAGE_KEYS.CORRECTIVE_TRAVAUX);
    const existingTravaux = Array.isArray(rawExistingTravaux) ? (rawExistingTravaux as string[]) : [];
    const seenTravaux = new Set(existingTravaux.map((t) => String(t || '').trim().toUpperCase()));
    const mergedTravaux = [...existingTravaux];
    for (const seedTravail of seedTravailAFaire) {
      const clean = String(seedTravail || '').trim();
      if (clean && !seenTravaux.has(clean.toUpperCase())) {
        seenTravaux.add(clean.toUpperCase());
        mergedTravaux.push(clean);
      }
    }

    this.saveCorrectiveActionsByPanne(nextActionsByPanne);
    this.saveCorrectivePanneCategories(nextPanneCategories);
    this.saveCorrectiveTravaux(mergedTravaux);

    if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne(nextActionsByPanne);
    if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories(nextPanneCategories);
    if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire(mergedTravaux);

    const pannesCount = Object.values(nextPanneCategories).reduce<number>(
      (acc, arr) => acc + (Array.isArray(arr) ? arr.length : 0),
      0
    );
    const categoriesCount = Object.keys(nextPanneCategories).length;
    const actionsCount = Object.keys(nextActionsByPanne).length;

    this.appendAuditEvent({
      actionType: 'CM_CATALOG_BASELINE_SYNC',
      entityType: 'CATALOG',
      entityId: 'CM_CATALOG',
      before: {
        categoriesCount: Object.keys(existingPanneCategories).length,
        actionsKeysCount: Object.keys(existingActionsByPanne).length,
        travauxCount: existingTravaux.length,
      },
      after: {
        categoriesCount,
        pannesCount,
        actionsCount,
        travauxCount: mergedTravaux.length,
      },
      meta: { mode: 'MERGE', untouchedInterventionsCount: existingCorrectiveInterventions.length },
    });

    return {
      interventionsCount: existingCorrectiveInterventions.length,
      pannesCount,
      categoriesCount,
      travauxCount: mergedTravaux.length,
      actionsCount,
    };
  },

  loadDemoSection(section = 'all', setters: GmaoStoreSetters = {}) {
    if (!section || section === 'all') {
      return this.loadDemoData(setters);
    }

    const demoBundle = this.getOfficialDemoBundle();
    const typedMovements = seedMouvements as unknown as IMouvement[];

    const seedBalanceByRef = new Map<
      string,
      { entrees: number; sorties: number; stockActuel: number }
    >();
    for (const s of seedStockItems) {
      const key = String(s.ref || '').trim().toUpperCase();
      if (key) {
        seedBalanceByRef.set(key, {
          entrees: Number(s.entrees) || 0,
          sorties: Number(s.sorties) || 0,
          stockActuel: Number(s.stockActuel) || 0,
        });
      }
    }

    switch (section) {
      case 'stock': {
        const existingMvts = (
          Array.isArray(storageService.getItem(STORAGE_KEYS.MOUVEMENTS))
            ? storageService.getItem(STORAGE_KEYS.MOUVEMENTS)
            : []
        ) as IMouvement[];
        const pdrReport = validateAndCommitRefPdrBundle(demoBundle.refPdr, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          existingPdrGroups: [],
          existingStockTypes: [],
          existingStock: [],
          existingMouvements: existingMvts,
        });
        if (!pdrReport.success || pdrReport.rejected.length > 0) {
          throw new Error(
            `Échec validation section stock (REF_PDR) : ${pdrReport.rejected[0]?.message || 'Erreur inconnue'}`
          );
        }
        const { nextGroups, nextTypes, nextStock, nextDesignations } = pdrReport.staging;

        // Reconcile stock balances with existing movements so stockActuel = stockInitial + entrees - sorties holds
        const reconciledStock: IStockItem[] =
          existingMvts.length > 0
            ? nextStock.map((item) => {
                if (existingMvts.length === typedMovements.length) {
                  const bal = seedBalanceByRef.get(String(item.ref || '').trim().toUpperCase());
                  if (bal) {
                    return {
                      ...item,
                      entrees: bal.entrees,
                      sorties: bal.sorties,
                      stockActuel: bal.stockActuel,
                    };
                  }
                }
                const calc = StockCalculationService.calculateStockByRef(item, existingMvts);
                return {
                  ...item,
                  entrees: calc.entrees,
                  sorties: calc.sorties,
                  stockActuel: calc.stockActuel,
                  alerte: calc.alerte,
                };
              })
            : nextStock;

        this.savePdrGroups(nextGroups);
        this.saveStockTypes(nextTypes);
        this.saveStock(reconciledStock);
        this.saveDesignations(nextDesignations);
        movementRepository.bulkReplace(existingMvts, buildInitialStockMap(reconciledStock));
        if (setters.setPdrGroups) setters.setPdrGroups(nextGroups);
        if (setters.setTypes) setters.setTypes(nextTypes);
        if (setters.setRawStock) setters.setRawStock(reconciledStock);
        if (setters.setDesignations) setters.setDesignations(nextDesignations);
        break;
      }

      case 'parc':
      case 'machines': {
        const parcReport = validateAndCommitRefParcBundle(demoBundle.refParc, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          existingZones: [],
          existingFamilies: [],
          existingTemplates: [],
          existingGeneralSystemTypes: [],
          existingMachines: [],
          existingTechnicians: [],
        });
        const personnelReport = validateAndCommitRefPersonnelBundle(demoBundle.refPersonnel, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          existingZones: parcReport.staging.nextZones,
          existingTechnicians: [],
          existingOperations: [],
          existingUsers: [],
          existingMachines: [],
          existingPreventiveTasks: [],
          existingCorrectiveInterventions: [],
          existingMouvements: [],
        });
        const machinesReport = validateAndCommitAssetsMachinesBundle(demoBundle.assetsMachines, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          existingZones: parcReport.staging.nextZones,
          existingFamilies: parcReport.staging.nextFamilies,
          existingTemplates: parcReport.staging.nextTemplates,
          existingGeneralSystemTypes: parcReport.staging.nextGeneralSystemTypes,
          existingTechnicians: personnelReport.staging.nextTechnicians,
          existingUsers: personnelReport.staging.nextUsers,
          existingMachines: [],
          existingPreventiveTasks: [],
          existingCorrectiveInterventions: [],
          existingMouvements: [],
          existingWarehouseItems: [],
        });
        if (
          !parcReport.success ||
          !machinesReport.success ||
          parcReport.rejected.length > 0 ||
          machinesReport.rejected.length > 0
        ) {
          const firstErr = parcReport.rejected[0] || machinesReport.rejected[0];
          throw new Error(`Échec validation section parc : ${firstErr?.message || 'Erreur inconnue'}`);
        }
        const { nextZones, nextFamilies, nextTemplates, nextGeneralSystemTypes } = parcReport.staging;
        const { nextMachines } = machinesReport.staging;
        const rawExistingZones = storageService.getItem(STORAGE_KEYS.ZONES);
        const currentZones = Array.isArray(rawExistingZones) ? rawExistingZones : [];
        if (currentZones.length === 0) {
          this.saveZones(nextZones);
          if (setters.setZones) setters.setZones(nextZones);
        }
        this.saveFamilies(nextFamilies);
        this.saveTemplates(nextTemplates);
        this.saveGeneralSystemTypes(nextGeneralSystemTypes);
        this.saveMachines(nextMachines);
        const savedBlueprints = this.saveBlueprints(seedBlueprints);
        this.saveMachineBom(seedMachineBomLedger);
        if (setters.setFamilies) setters.setFamilies(nextFamilies);
        if (setters.setTemplates) setters.setTemplates(nextTemplates);
        if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes(nextGeneralSystemTypes);
        if (setters.setMachines) setters.setMachines(nextMachines);
        if (setters.setBlueprints) setters.setBlueprints(savedBlueprints);
        if (setters.setMachineElementsLedger) setters.setMachineElementsLedger(seedMachineBomLedger);
        break;
      }

      case 'entrepot':
      case 'warehouse': {
        const bomReport = validateAndCommitEntrepotBomBundle(demoBundle.entrepotBom!, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          existingCompGroups: [],
          existingCompFamilies: [],
          existingCompTemplates: [],
          existingPartGroups: [],
          existingPartTypes: [],
          existingPartDesignations: [],
          existingWarehouseItems: [],
          existingEntrepotComponents: [],
          existingMachineElementsLedger: [],
        });
        if (!bomReport.success || bomReport.rejected.length > 0) {
          throw new Error(
            `Échec validation section entrepôt (ENTREPOT_BOM) : ${bomReport.rejected[0]?.message || 'Erreur inconnue'}`
          );
        }
        const {
          nextCompGroups,
          nextCompFamilies,
          nextCompTemplates,
          nextPartGroups,
          nextPartTypes,
          nextPartDesignations,
        } = bomReport.staging;
        this.saveWarehouseItems(seedWarehouseItems);
        this.saveEntrepotComponents(seedEntrepotComponents);
        this.saveCompGroups(nextCompGroups);
        this.saveCompFamilies(nextCompFamilies);
        this.saveCompTemplates(nextCompTemplates);
        this.savePartGroups(nextPartGroups);
        this.savePartTypes(nextPartTypes);
        this.savePartDesignations(nextPartDesignations);
        if (setters.setWarehouseItems) setters.setWarehouseItems(seedWarehouseItems);
        if (setters.setEntrepotComponents) setters.setEntrepotComponents(seedEntrepotComponents);
        if (setters.setCompGroups) setters.setCompGroups(nextCompGroups);
        if (setters.setCompFamilies) setters.setCompFamilies(nextCompFamilies);
        if (setters.setCompTemplates) setters.setCompTemplates(nextCompTemplates);
        if (setters.setPartGroups) setters.setPartGroups(nextPartGroups);
        if (setters.setPartTypes) setters.setPartTypes(nextPartTypes);
        if (setters.setPartDesignations) setters.setPartDesignations(nextPartDesignations);
        break;
      }

      case 'zones':
      case 'users': {
        const parcReport = validateAndCommitRefParcBundle(
          { bundleType: 'REF_PARC', zones: demoBundle.refParc.zones },
          {
            mode: 'MERGE',
            origin: 'DEMO_BUNDLE',
            dryRun: true,
            existingZones: [],
            existingFamilies: [],
            existingTemplates: [],
            existingGeneralSystemTypes: [],
            existingMachines: [],
            existingTechnicians: [],
          }
        );
        const personnelReport = validateAndCommitRefPersonnelBundle(demoBundle.refPersonnel, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          existingZones: parcReport.staging.nextZones,
          existingTechnicians: [],
          existingOperations: [],
          existingUsers: [],
          existingMachines: [],
          existingPreventiveTasks: [],
          existingCorrectiveInterventions: [],
          existingMouvements: [],
        });
        if (
          !parcReport.success ||
          !personnelReport.success ||
          parcReport.rejected.length > 0 ||
          personnelReport.rejected.length > 0
        ) {
          const firstErr = parcReport.rejected[0] || personnelReport.rejected[0];
          throw new Error(`Échec validation section zones/équipes : ${firstErr?.message || 'Erreur inconnue'}`);
        }
        const { nextZones } = parcReport.staging;
        const { nextUsers, nextTechnicians, nextOperations } = personnelReport.staging;
        this.saveZones(nextZones);
        this.savePersonnel(nextUsers, nextTechnicians, nextOperations);
        try {
          const authSvc = new AuthService();
          authSvc.syncTechnicianAccountsFromPersonnel(nextTechnicians, {
            activateByDefault: true,
          });
          authSvc.syncOperationAccountsFromPersonnel(nextOperations, {
            activateByDefault: true,
          });
        } catch {
          /* ignore */
        }
        if (setters.setZones) setters.setZones(nextZones);
        if (setters.setUsers) setters.setUsers(nextUsers);
        if (setters.setTechnicians) setters.setTechnicians(nextTechnicians);
        if (setters.setOperations) setters.setOperations(nextOperations);
        break;
      }

      case 'mouvements':
      case 'movements': {
        const rawExistingStock = storageService.getItem(STORAGE_KEYS.RAW_STOCK);
        const existingStockArr = (
          Array.isArray(rawExistingStock) ? rawExistingStock : []
        ) as IStockItem[];
        this.saveMouvements(typedMovements);
        this.saveSortiesExterne(seedSortiesExternes);
        if (existingStockArr.length > 0) {
          const reconciledStock: IStockItem[] = existingStockArr.map((item) => {
            const bal = seedBalanceByRef.get(String(item.ref || '').trim().toUpperCase());
            if (bal) {
              return {
                ...item,
                entrees: bal.entrees,
                sorties: bal.sorties,
                stockActuel: bal.stockActuel,
              };
            }
            const calc = StockCalculationService.calculateStockByRef(item, typedMovements);
            return {
              ...item,
              entrees: calc.entrees,
              sorties: calc.sorties,
              stockActuel: calc.stockActuel,
              alerte: calc.alerte,
            };
          });
          this.saveStock(reconciledStock);
          movementRepository.bulkReplace(typedMovements, buildInitialStockMap(reconciledStock));
          if (setters.setRawStock) setters.setRawStock(reconciledStock);
        } else {
          movementRepository.bulkReplace(typedMovements, new Map());
        }
        if (setters.setMouvements) setters.setMouvements(typedMovements);
        if (setters.setSortiesExterne) setters.setSortiesExterne(seedSortiesExternes);
        break;
      }

      case 'preventive': {
        const rawExistingStock = storageService.getItem(STORAGE_KEYS.RAW_STOCK);
        const existingStockArr = Array.isArray(rawExistingStock) ? rawExistingStock : [];
        const pmReport = validateAndCommitPmCatalogBundle(demoBundle.pmCatalog, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          strictPdrCheck: false,
          existingPreventiveActions: [],
          existingPreventiveGuides: [],
          existingStock: existingStockArr,
          existingPreventiveTasks: [],
          existingPreventiveExecutions: [],
        });
        if (!pmReport.success || pmReport.rejected.length > 0) {
          throw new Error(
            `Échec validation section préventif (PM_CATALOG) : ${pmReport.rejected[0]?.message || 'Erreur inconnue'}`
          );
        }
        const { nextActions, nextGuides } = pmReport.staging;
        const rawExistingMachines = storageService.getItem(STORAGE_KEYS.MACHINES);
        const machineCtx = Array.isArray(rawExistingMachines) ? rawExistingMachines : [];
        // Strict FK check against currently registered machines so zero orphan tasks are ever injected
        const { saved: validTasks } = this.savePreventiveTasks(seedPreventiveTasks, {
          machines: machineCtx,
          strict: true,
        });
        this.savePreventiveActions(nextActions);
        this.savePreventiveGuides(nextGuides);
        this.savePreventivePlans([]);
        this.savePreventiveExecutions([]);
        if (setters.setPreventiveTasks) setters.setPreventiveTasks(validTasks);
        if (setters.setPreventiveActions) setters.setPreventiveActions(nextActions);
        if (setters.setPreventiveGuides) setters.setPreventiveGuides(nextGuides);
        if (setters.setPreventivePlans) setters.setPreventivePlans([]);
        if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);
        break;
      }

      case 'corrective': {
        const cmReport = validateAndCommitCmCatalogBundle(demoBundle.cmCatalog!, {
          mode: 'MERGE',
          origin: 'DEMO_BUNDLE',
          dryRun: true,
          existingPanneCategories: {},
          existingActionsByPanne: {},
          existingCorrectiveInterventions: [],
        });
        if (!cmReport.success || cmReport.rejected.length > 0) {
          throw new Error(
            `Échec validation section correctif (CM_CATALOG) : ${cmReport.rejected[0]?.message || 'Erreur inconnue'}`
          );
        }
        const { nextPanneCategories, nextActionsByPanne } = cmReport.staging;
        const rawExistingMachines = storageService.getItem(STORAGE_KEYS.MACHINES);
        const machineCtx = Array.isArray(rawExistingMachines) ? rawExistingMachines : [];
        // Strict FK check against currently registered machines so zero orphan BTs/DIs are ever injected
        const { saved: validInterventions } = this.saveCorrectiveInterventions(
          seedCorrectiveInterventions,
          { machines: machineCtx, strict: true }
        );
        this.saveCorrectiveActionsByPanne(nextActionsByPanne);
        this.saveCorrectivePanneCategories(nextPanneCategories);
        this.saveCorrectiveTravaux(seedTravailAFaire);
        this.saveCorrectiveIntervenants(seedIntervenants);
        this.saveWorkshopOrders([]);
        this.saveNeedRequests([]);
        if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions(validInterventions);
        if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne(nextActionsByPanne);
        if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories(nextPanneCategories);
        if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire(seedTravailAFaire);
        if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants(seedIntervenants);
        if (setters.setWorkshopOrders) setters.setWorkshopOrders([]);
        if (setters.setNeedRequests) setters.setNeedRequests([]);
        break;
      }

      default:
        break;
    }

    return { section, loaded: true };
  },

  /**
   * Clears data for a specific section (or 'all' for the entire factory) with full referential
   * and mathematical consistency across dependent collections.
   */
  clearDemoSection(section = 'all', setters: GmaoStoreSetters = {}) {
    if (!section || section === 'all') {
      return this.clearAllForRealFactory(setters);
    }

    switch (section) {
      case 'stock':
        this.saveStock([]);
        this.saveStockTypes([]);
        this.savePdrGroups([]);
        this.saveDesignations([]);
        movementRepository.bulkReplace(
          (Array.isArray(storageService.getItem(STORAGE_KEYS.MOUVEMENTS))
            ? storageService.getItem(STORAGE_KEYS.MOUVEMENTS)
            : []) as IMouvement[],
          new Map()
        );
        if (setters.setRawStock) setters.setRawStock([]);
        if (setters.setTypes) setters.setTypes([]);
        if (setters.setPdrGroups) setters.setPdrGroups([]);
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
        // Prevent dangling orphan tasks/BTs referencing deleted machines
        this.savePreventiveTasks([]);
        this.savePreventivePlans([]);
        this.savePreventiveExecutions([]);
        this.saveMeterReadings([]);
        this.saveCorrectiveInterventions([]);
        this.saveWorkshopOrders([]);
        this.saveNeedRequests([]);
        if (setters.setMachines) setters.setMachines([]);
        if (setters.setGeneralSystemTypes) setters.setGeneralSystemTypes([]);
        if (setters.setFamilies) setters.setFamilies([]);
        if (setters.setTemplates) setters.setTemplates([]);
        if (setters.setBlueprints) setters.setBlueprints([]);
        if (setters.setMachineElementsLedger) setters.setMachineElementsLedger([]);
        if (setters.setPreventiveTasks) setters.setPreventiveTasks([]);
        if (setters.setPreventivePlans) setters.setPreventivePlans([]);
        if (setters.setPreventiveExecutions) setters.setPreventiveExecutions([]);
        if (setters.setMeterReadings) setters.setMeterReadings([]);
        if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions([]);
        if (setters.setWorkshopOrders) setters.setWorkshopOrders([]);
        if (setters.setNeedRequests) setters.setNeedRequests([]);
        break;

      case 'entrepot':
      case 'warehouse':
        this.saveWarehouseItems([]);
        this.saveEntrepotComponents([]);
        this.saveCompGroups([]);
        this.saveCompFamilies([]);
        this.saveCompTemplates([]);
        this.savePartGroups([]);
        this.savePartTypes([]);
        this.savePartDesignations([]);
        if (setters.setWarehouseItems) setters.setWarehouseItems([]);
        if (setters.setEntrepotComponents) setters.setEntrepotComponents([]);
        if (setters.setCompGroups) setters.setCompGroups([]);
        if (setters.setCompFamilies) setters.setCompFamilies([]);
        if (setters.setCompTemplates) setters.setCompTemplates([]);
        if (setters.setPartGroups) setters.setPartGroups([]);
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
      case 'movements': {
        this.saveMouvements([]);
        this.saveSortieDemands([]);
        this.saveReplenishmentOrders([]);
        this.saveSortiesExterne([]);
        const rawExistingStock = storageService.getItem(STORAGE_KEYS.RAW_STOCK);
        const existingStockArr = (
          Array.isArray(rawExistingStock) ? rawExistingStock : []
        ) as IStockItem[];
        const resetStock: IStockItem[] = existingStockArr.map((item) => {
          const calc = StockCalculationService.calculateStockByRef(item, []);
          return {
            ...item,
            entrees: 0,
            sorties: 0,
            stockActuel: calc.stockActuel,
            alerte: calc.alerte,
          };
        });
        if (existingStockArr.length > 0) {
          this.saveStock(resetStock);
          if (setters.setRawStock) setters.setRawStock(resetStock);
        }
        movementRepository.bulkReplace([], buildInitialStockMap(resetStock));
        if (setters.setMouvements) setters.setMouvements([]);
        if (setters.setSortieDemands) setters.setSortieDemands([]);
        if (setters.setReplenishmentOrders) setters.setReplenishmentOrders([]);
        if (setters.setSortiesExterne) setters.setSortiesExterne([]);
        break;
      }

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
            [STORAGE_KEYS.METER_READINGS]: [],
          })
          .catch(() => false);
        indexedDBService.clear('preventive').catch(() => false);
        break;

      case 'corrective':
        this.purgeLegacyKeysFor(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS);
        this.purgeLegacyKeysFor(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE);
        this.purgeLegacyKeysFor(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES);
        this.purgeLegacyKeysFor(STORAGE_KEYS.CORRECTIVE_TRAVAUX);
        this.purgeLegacyKeysFor(STORAGE_KEYS.CORRECTIVE_INTERVENANTS);
        this.saveCorrectiveInterventions([]);
        this.saveCorrectiveActionsByPanne({});
        this.saveCorrectivePanneCategories({});
        this.saveCorrectiveTravaux([]);
        this.saveCorrectiveIntervenants([]);
        this.saveWorkshopOrders([]);
        this.saveNeedRequests([]);
        if (setters.setCorrectiveInterventions) setters.setCorrectiveInterventions([]);
        if (setters.setCorrectiveActionsByPanne) setters.setCorrectiveActionsByPanne({});
        if (setters.setCorrectivePanneCategories) setters.setCorrectivePanneCategories({});
        if (setters.setCorrectiveTravauxAFaire) setters.setCorrectiveTravauxAFaire([]);
        if (setters.setCorrectiveIntervenants) setters.setCorrectiveIntervenants([]);
        if (setters.setWorkshopOrders) setters.setWorkshopOrders([]);
        if (setters.setNeedRequests) setters.setNeedRequests([]);
        indexedDBService.clear('interventions').catch(() => false);
        break;

      default:
        break;
    }

    // Reconcile DEMO_MODE / START_MODE if all core operational tables are now empty
    const coreKeys = [
      STORAGE_KEYS.RAW_STOCK,
      STORAGE_KEYS.MACHINES,
      STORAGE_KEYS.WAREHOUSE_ITEMS,
      STORAGE_KEYS.ZONES,
      STORAGE_KEYS.MOUVEMENTS,
      STORAGE_KEYS.PREVENTIVE_TASKS,
      STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
    ];
    const allEmpty = coreKeys.every((key) => {
      const val = storageService.getItem(key);
      return !Array.isArray(val) || val.length === 0;
    });
    if (allEmpty) {
      storageService.setItem(STORAGE_KEYS.DEMO_MODE, false);
      storageService.setItem(STORAGE_KEYS.START_MODE, 'empty');
    }

    return { section, cleared: true };
  },
};

export default DataGateway;
