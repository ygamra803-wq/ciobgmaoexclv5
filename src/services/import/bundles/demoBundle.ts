import { DataGateway } from '../../../application/DataGateway';
import { useGmaoStore } from '../../../store/useGmaoStore';
import {
  AcceptedStageRecord,
  DemoBundleInput,
  DemoBundleStagingResult,
  ImportCommitPolicy,
  ImportIssue,
  ImportMode,
  ImportReport,
  ImportSourceOrigin,
  UnifiedImportOptions,
} from '../types/unifiedImportTypes';
import { normKey, notifyPipelineCommitSync } from '../pipelineShared';
import { validateAndCommitRefParcBundle } from './refParcBundle';
import { validateAndCommitRefPersonnelBundle } from './refPersonnelBundle';
import { validateAndCommitAssetsMachinesBundle } from './assetsMachinesBundle';
import { validateAndCommitRefPdrBundle } from './refPdrBundle';
import { validateAndCommitPmCatalogBundle } from './pmCatalogBundle';
import { validateAndCommitEntrepotBomBundle } from './entrepotBomBundle';
import { validateAndCommitCmCatalogBundle } from './cmCatalogBundle';

/**
 * Validates and optionally commits a unified `DEMO_BUNDLE` (`Mode C`) in strict causal dependency order:
 * `REF_PARC (01_ZONES -> 03_FAMILIES -> 03_TEMPLATES -> 03_GENERAL_SYSTEM_TYPES)`
 * `-> REF_PERSONNEL (02_PERSONNEL)`
 * `-> ASSETS_MACHINES (03_MACHINES)`
 * `-> REF_PDR (04_PDR_GROUPS -> 04_PDR_TYPES -> 04_PDR_ITEMS)`
 * `-> PM_CATALOG (05_PM_ACTIONS -> 05_PM_GUIDES)`
 * `-> optional ENTREPOT_BOM & CM_CATALOG`
 *
 * Each stage receives the validated staging output of its upstream dependencies, ensuring
 * that Mode C (Demo) obeys the exact same referential integrity and zone normalization laws as Mode B (Import).
 */
export function validateAndCommitDemoBundle(
  input: DemoBundleInput,
  options: UnifiedImportOptions = {}
): ImportReport<DemoBundleStagingResult> {
  const startTime = Date.now();
  const mode: ImportMode = options.mode === 'REPLACE_CATALOG' ? 'REPLACE_CATALOG' : 'MERGE';
  const origin: ImportSourceOrigin = options.origin || 'DEMO_BUNDLE';
  const commitPolicy: ImportCommitPolicy = options.commitPolicy || 'ATOMIC';
  const dryRun = Boolean(options.dryRun);
  const actorRole = normKey(options.actorRole || 'ADMIN');

  const stageOpts: UnifiedImportOptions = {
    ...options,
    mode,
    origin,
    commitPolicy,
    dryRun: true, // Always stage bundles first before atomic commit
    actorRole,
  };

  // Stage 1: REF_PARC
  const parcReport = validateAndCommitRefParcBundle(input?.refParc || {}, {
    ...stageOpts,
    existingZones: options.existingZones ?? [],
    existingFamilies: options.existingFamilies ?? [],
    existingTemplates: options.existingTemplates ?? [],
    existingGeneralSystemTypes: options.existingGeneralSystemTypes ?? [],
    existingMachines: [],
    existingTechnicians: [],
  });

  // Stage 2: REF_PERSONNEL (validated against Stage 1 nextZones)
  const personnelReport = validateAndCommitRefPersonnelBundle(input?.refPersonnel || {}, {
    ...stageOpts,
    existingZones: parcReport.staging.nextZones,
    existingTechnicians: options.existingTechnicians ?? [],
    existingOperations: options.existingOperations ?? [],
    existingUsers: options.existingUsers ?? [],
    existingMachines: [],
    existingPreventiveTasks: [],
    existingCorrectiveInterventions: [],
    existingMouvements: [],
  });

  // Stage 3: ASSETS_MACHINES (validated against Stage 1 REF_PARC + Stage 2 REF_PERSONNEL)
  const machinesReport = validateAndCommitAssetsMachinesBundle(
    input?.assetsMachines || { machines: [] },
    {
      ...stageOpts,
      existingZones: parcReport.staging.nextZones,
      existingFamilies: parcReport.staging.nextFamilies,
      existingTemplates: parcReport.staging.nextTemplates,
      existingGeneralSystemTypes: parcReport.staging.nextGeneralSystemTypes,
      existingTechnicians: personnelReport.staging.nextTechnicians,
      existingUsers: personnelReport.staging.nextUsers,
      existingMachines: options.existingMachines ?? [],
      existingPreventiveTasks: [],
      existingCorrectiveInterventions: [],
      existingMouvements: [],
      existingWarehouseItems: [],
    }
  );

  // Stage 4: REF_PDR (04_PDR_GROUPS -> 04_PDR_TYPES -> 04_PDR_ITEMS)
  const pdrReport = validateAndCommitRefPdrBundle(input?.refPdr || {}, {
    ...stageOpts,
    existingPdrGroups: options.existingPdrGroups ?? [],
    existingStockTypes: options.existingStockTypes ?? [],
    existingStock: options.existingStock ?? [],
    existingMouvements: [],
  });

  // Stage 5: PM_CATALOG (05_PM_ACTIONS -> 05_PM_GUIDES, validated against Stage 4 nextStock)
  const pmCatalogReport = validateAndCommitPmCatalogBundle(input?.pmCatalog || {}, {
    ...stageOpts,
    strictPdrCheck: options.strictPdrCheck ?? false,
    existingPreventiveActions: options.existingPreventiveActions ?? [],
    existingPreventiveGuides: options.existingPreventiveGuides ?? [],
    existingStock: pdrReport.staging.nextStock,
    existingPreventiveTasks: [],
    existingPreventiveExecutions: [],
  });

  // Optional Stage 6: ENTREPOT_BOM
  const entrepotBomReport = input?.entrepotBom
    ? validateAndCommitEntrepotBomBundle(input.entrepotBom, {
        ...stageOpts,
        existingCompGroups: options.existingCompGroups ?? [],
        existingCompFamilies: options.existingCompFamilies ?? [],
        existingCompTemplates: options.existingCompTemplates ?? [],
        existingPartGroups: options.existingPartGroups ?? [],
        existingPartTypes: options.existingPartTypes ?? [],
        existingPartDesignations: options.existingPartDesignations ?? [],
        existingWarehouseItems: [],
        existingEntrepotComponents: [],
        existingMachineElementsLedger: [],
      })
    : null;

  // Optional Stage 7: CM_CATALOG
  const cmCatalogReport = input?.cmCatalog
    ? validateAndCommitCmCatalogBundle(input.cmCatalog, {
        ...stageOpts,
        existingPanneCategories: options.existingPanneCategories ?? {},
        existingActionsByPanne: options.existingActionsByPanne ?? {},
        existingCorrectiveInterventions: [],
      })
    : null;

  const accepted: AcceptedStageRecord[] = [
    ...parcReport.accepted,
    ...personnelReport.accepted,
    ...machinesReport.accepted,
    ...pdrReport.accepted,
    ...pmCatalogReport.accepted,
    ...(entrepotBomReport ? entrepotBomReport.accepted : []),
    ...(cmCatalogReport ? cmCatalogReport.accepted : []),
  ];

  const rejected: ImportIssue[] = [
    ...parcReport.rejected,
    ...personnelReport.rejected,
    ...machinesReport.rejected,
    ...pdrReport.rejected,
    ...pmCatalogReport.rejected,
    ...(entrepotBomReport ? entrepotBomReport.rejected : []),
    ...(cmCatalogReport ? cmCatalogReport.rejected : []),
  ];

  const warnings: ImportIssue[] = [
    ...parcReport.warnings,
    ...personnelReport.warnings,
    ...machinesReport.warnings,
    ...pdrReport.warnings,
    ...pmCatalogReport.warnings,
    ...(entrepotBomReport ? entrepotBomReport.warnings : []),
    ...(cmCatalogReport ? cmCatalogReport.warnings : []),
  ];

  const staging: DemoBundleStagingResult = {
    nextZones: parcReport.staging.nextZones,
    nextFamilies: parcReport.staging.nextFamilies,
    nextTemplates: parcReport.staging.nextTemplates,
    nextGeneralSystemTypes: parcReport.staging.nextGeneralSystemTypes,
    nextTechnicians: personnelReport.staging.nextTechnicians,
    nextOperations: personnelReport.staging.nextOperations,
    nextUsers: personnelReport.staging.nextUsers,
    nextMachines: machinesReport.staging.nextMachines,
    nextGroups: pdrReport.staging.nextGroups,
    nextTypes: pdrReport.staging.nextTypes,
    nextStock: pdrReport.staging.nextStock,
    nextDesignations: pdrReport.staging.nextDesignations,
    nextActions: pmCatalogReport.staging.nextActions,
    nextGuides: pmCatalogReport.staging.nextGuides,
    ...(entrepotBomReport
      ? {
          nextCompGroups: entrepotBomReport.staging.nextCompGroups,
          nextCompFamilies: entrepotBomReport.staging.nextCompFamilies,
          nextCompTemplates: entrepotBomReport.staging.nextCompTemplates,
          nextPartGroups: entrepotBomReport.staging.nextPartGroups,
          nextPartTypes: entrepotBomReport.staging.nextPartTypes,
          nextPartDesignations: entrepotBomReport.staging.nextPartDesignations,
        }
      : {}),
    ...(cmCatalogReport
      ? {
          nextPanneCategories: cmCatalogReport.staging.nextPanneCategories,
          nextActionsByPanne: cmCatalogReport.staging.nextActionsByPanne,
        }
      : {}),
  };

  const success = rejected.length === 0;
  let committed = false;

  if (success && !dryRun) {
    const store = useGmaoStore.getState();

    // Commit in strict dependency order: REF_PARC -> REF_PERSONNEL -> ASSETS_MACHINES -> REF_PDR -> PM_CATALOG (-> ENTREPOT_BOM -> CM_CATALOG)
    DataGateway.saveZones(staging.nextZones);
    DataGateway.saveFamilies(staging.nextFamilies);
    DataGateway.saveTemplates(staging.nextTemplates);
    DataGateway.saveGeneralSystemTypes(staging.nextGeneralSystemTypes);
    store.setZones(staging.nextZones);
    store.setFamilies(staging.nextFamilies);
    store.setTemplates(staging.nextTemplates);
    store.setGeneralSystemTypes(staging.nextGeneralSystemTypes);

    DataGateway.savePersonnel(staging.nextUsers, staging.nextTechnicians, staging.nextOperations);
    store.setUsers(staging.nextUsers);
    store.setTechnicians(staging.nextTechnicians);
    store.setOperations(staging.nextOperations);

    DataGateway.saveMachines(staging.nextMachines);
    store.setMachines(staging.nextMachines);

    DataGateway.savePdrGroups(staging.nextGroups);
    DataGateway.saveStockTypes(staging.nextTypes);
    DataGateway.saveStock(staging.nextStock);
    DataGateway.saveDesignations(staging.nextDesignations);
    store.setPdrGroups(staging.nextGroups);
    store.setTypes(staging.nextTypes);
    store.setRawStock(staging.nextStock);
    store.setDesignations(staging.nextDesignations);

    DataGateway.savePreventiveActions(staging.nextActions);
    DataGateway.savePreventiveGuides(staging.nextGuides);
    store.setPreventiveActions(staging.nextActions);
    store.setPreventiveGuides(staging.nextGuides);

    if (entrepotBomReport) {
      DataGateway.saveCompGroups(entrepotBomReport.staging.nextCompGroups);
      DataGateway.saveCompFamilies(entrepotBomReport.staging.nextCompFamilies);
      DataGateway.saveCompTemplates(entrepotBomReport.staging.nextCompTemplates);
      DataGateway.savePartGroups(entrepotBomReport.staging.nextPartGroups);
      DataGateway.savePartTypes(entrepotBomReport.staging.nextPartTypes);
      DataGateway.savePartDesignations(entrepotBomReport.staging.nextPartDesignations);
      store.setCompGroups(entrepotBomReport.staging.nextCompGroups);
      store.setCompFamilies(entrepotBomReport.staging.nextCompFamilies);
      store.setCompTemplates(entrepotBomReport.staging.nextCompTemplates);
      store.setPartGroups(entrepotBomReport.staging.nextPartGroups);
      store.setPartTypes(entrepotBomReport.staging.nextPartTypes);
      store.setPartDesignations(entrepotBomReport.staging.nextPartDesignations);
    }

    if (cmCatalogReport) {
      DataGateway.saveCorrectivePanneCategories(cmCatalogReport.staging.nextPanneCategories);
      DataGateway.saveCorrectiveActionsByPanne(cmCatalogReport.staging.nextActionsByPanne);
      store.setCorrectivePanneCategories(cmCatalogReport.staging.nextPanneCategories);
      store.setCorrectiveActionsByPanne(cmCatalogReport.staging.nextActionsByPanne);
    }

    committed = true;
    notifyPipelineCommitSync('DEMO_BUNDLE', mode, origin);
  }

  return {
    bundleType: 'DEMO_BUNDLE',
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
    staging,
  };
}
