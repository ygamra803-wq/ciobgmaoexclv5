import { startTransition, useMemo, useCallback } from 'react';

/**
 * Hook to build clean, memoized or structured props for each module in AppRouter.
 * Keeps App.jsx slim, highly readable, and under 300 lines.
 */
export function useAppRouterProps({
  setCurrentTab,
  stockItems,
  machines,
  warehouseItemsComputed,
  mouvements,
  types,
  diagnostics,
  zones,
  technicians,
  operations,
  stockKPIs,
  filters,
  navigation,
  effectiveFamilies,
  effectiveTemplates,
  blueprints,
  compGroups,
  compFamilies,
  compTemplates,
  entrepotComponents,
  partTypes,
  partDesignations,
  rawStock,
  designations,
  families,
  templates,
  machineElementsLedger,
  addMachineElement,
  updateMachineElement,
  deleteMachineElement,
  duplicateBOMToTwins,
  preventiveTasks,
  preventiveActions,
  preventiveGuides,
  preventivePlans,
  preventiveExecutions,
  sortiesExterne,
  correctiveInterventions,
  activeLiveInterventionId,
  correctiveKpis,
  correctiveParetoAnomalies,
  correctiveParetoMachines,
  correctiveParetoTypes,
  correctivePreventiveRecommendations,
  correctiveActionsByPanne,
  correctivePanneCategories,
  correctiveTravauxAFaire,
  correctiveIntervenants,
  modals: {
    setShowAddArticleModal,
    setShowAddMachineModal,
    setShowAddUserModal,
    setAddUserModalType,
    setShowAddZoneModal,
  },
  handlers: {
    handleQuickSortie,
    handleAddMouvement,
    handleUpdateMouvement,
    handleDeleteMouvement,
    handleExportExcel,
    handleDownloadBlankTemplate,
    handleUpdateArticle,
    handleDirectAdjustStock,
    handleAddWarehouseItem,
    handleUpdateWarehouseItem,
    handleDeleteWarehouseItem,
    handleAddType,
    handleUpdateType,
    handleDeleteType,
    handleAddDesignation,
    handleUpdateDesignation,
    handleDeleteDesignation,
    handleAddMachine,
    handleUpdateMachine,
    handleDeleteMachine,
    handleAddCompGroup,
    handleUpdateCompGroup,
    handleDeleteCompGroup,
    handleAddCompFamily,
    handleUpdateCompFamily,
    handleDeleteCompFamily,
    handleAddCompTemplate,
    handleUpdateCompTemplate,
    handleDeleteCompTemplate,
    handleAddPartType,
    handleUpdatePartType,
    handleDeletePartType,
    handleAddPartDesignation,
    handleUpdatePartDesignation,
    handleDeletePartDesignation,
    handleAddFamily,
    handleUpdateFamily,
    handleDeleteFamily,
    handleAddTemplate,
    handleUpdateTemplate,
    handleDeleteTemplate,
    handleAddBlueprint,
    handleUpdateBlueprint,
    handleDeleteBlueprint,
    handleApplyBlueprintPreventivePlan,
    handleAddZone,
    handleUpdateZone,
    handleDeleteZone,
    handleAddTechnician,
    handleUpdateTechnician,
    handleDeleteTechnician,
    handleAddOperation,
    handleUpdateOperation,
    handleDeleteOperation,
    handleUpdateTask,
    handleDeleteTask,
    handleUpdateTaskCounter,
    handleMarkTaskDone,
    handleReviewPreventiveExecutionValidation,
    handleDeletePreventiveExecution,
    handleCreatePlanWithTasks,
    handleAddPreventiveAction,
    handleUpdatePreventiveAction,
    handleDeletePreventiveAction,
    handleAddPreventiveGuide,
    handleUpdatePreventiveGuide,
    handleDeletePreventiveGuide,
    handleResetPreventiveToBaseline,
    handleClearPreventiveForRealFactory,
    handleAddSortieExterne,
    handleUpdateSortieExterne,
    handleDeleteSortieExterne,
    handleMarkSortieReturned,
    handleMarkSortieMounted,
    handleClearSortiesForRealFactory,
    handleResetSortiesToBaseline,
    handleAddDemandeIntervention,
    handleConvertToBt,
    handleStartLiveIntervention,
    handleSubmitInterventionForValidation,
    handleReviewInterventionValidation,
    handleClotureIntervention,
    handleUpdateCorrectiveIntervention,
    handleDeleteCorrectiveIntervention,
    handleBulkImportCorrective,
    handleResetCorrectiveToSeed,
    handleGetCorrectiveActionsForPanne,
    handleAddCorrectiveActionForPanne,
    handleUpdateCorrectiveActionForPanne,
    handleDeleteCorrectiveActionForPanne,
    handleAddPanne,
    handleUpdatePanne,
    handleDeletePanne,
    handleAddTravail,
    handleUpdateTravail,
    handleDeleteTravail,
    handleResetCorrectiveActions,
    handleForceSyncCorrectiveSeed,
    handleLoadDemoData,
    handleClearAllForRealFactory,
    handleLoadDemoSection,
    handleClearDemoSection,
  },
  setters = {},
  showToast,
}) {
  const navigateTo = useCallback((tab) => startTransition(() => setCurrentTab(tab)), [setCurrentTab]);

  return useMemo(() => ({
    dashboard: {
      stockItems,
      machines,
      warehouseItems: warehouseItemsComputed,
      mouvements,
      types,
      diagnostics,
      zones,
      technicians,
      operations,
      stockKPIs,
      preventiveTasks,
      preventiveExecutions,
      correctiveInterventions,
      correctiveKpis,
      onNavigateToStock: () => navigateTo('stock'),
      onNavigateToMachines: () => navigateTo('machines'),
      onNavigateToWarehouse: () => navigateTo('entrepot'),
      onNavigateToSortie: () => navigateTo('sortie'),
      onNavigateToPreventive: () => navigateTo('preventive'),
      onNavigateToCorrective: (targetTab = 'corrective') => navigateTo(typeof targetTab === 'string' ? targetTab : 'corrective'),
      onNavigateToZones: () => navigateTo('zones'),
      onNavigateToUsers: () => navigateTo('utilisateurs'),
      onNavigateToSettings: (targetSubTab?: string) => {
        if (typeof targetSubTab === 'string' && targetSubTab.trim()) {
          localStorage.setItem('gmao_settings_target_tab', targetSubTab.trim());
        }
        navigateTo('settings');
      },
      onNavigateToGuide: () => navigateTo('guide'),
      onNavigateToValidationCenter: () => navigateTo('validation_center'),
      onQuickSortie: handleQuickSortie,
      onAddMouvement: handleAddMouvement,
      onUpdateMouvement: handleUpdateMouvement,
      onDeleteMouvement: handleDeleteMouvement,
      onExportExcel: handleExportExcel,
      showToast: showToast || navigation?.showToast,
    },

    executiveReport: {
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions,
      machines,
      onNavigateToTab: navigateTo,
      showToast: showToast || navigation?.showToast,
    },

    shiftWeeklyReport: {
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions,
      machines,
      onNavigateToTab: navigateTo,
      showToast: showToast || navigation?.showToast,
    },

    validationCenter: {
      stockItems,
      machines,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      onReviewCorrectiveValidation: (id, decisionData, customMvtHandler) =>
        handleReviewInterventionValidation(id, decisionData, customMvtHandler || handleAddMouvement),
      onReviewPreventiveValidation: (id, decisionData, customMvtHandler) =>
        handleReviewPreventiveExecutionValidation(id, decisionData, customMvtHandler || handleAddMouvement),
      onAddMouvement: handleAddMouvement,
      onNavigateToTab: navigateTo,
      showToast: showToast || navigation?.showToast,
    },

    stock: {
      stockItems,
      mouvements,
      stockSearch: filters.stockSearch,
      setStockSearch: filters.setStockSearch,
      stockTypeFilter: filters.stockTypeFilter,
      setStockTypeFilter: filters.setStockTypeFilter,
      stockAlertOnly: filters.stockAlertOnly,
      setStockAlertOnly: filters.setStockAlertOnly,
      types,
      zones,
      machines,
      technicians,
      operations,
      onOpenAddArticle: () => setShowAddArticleModal(true),
      onQuickSortie: handleQuickSortie,
      onAddMouvement: handleAddMouvement,
      onUpdateArticle: handleUpdateArticle,
      onDirectAdjustStock: handleDirectAdjustStock,
      stockKPIs,
      onNavigateToType: navigation.handleNavigateToStockFiltered,
      onNavigateToTypes: () => navigateTo('types'),
      onNavigateToDesignations: navigation.handleNavigateToDesignationsFiltered,
      onNavigateToSortie: () => navigateTo('sortie'),
    },

    sortie: {
      mouvements,
      stockItems,
      warehouseItems: warehouseItemsComputed,
      machineElementsLedger,
      updateMachineElement,
      quickSortiePreset: filters.quickSortiePreset,
      setQuickSortiePreset: filters.setQuickSortiePreset,
      families,
      templates,
      types,
      diagnostics,
      zones,
      machines,
      technicians,
      operations,
      sortiesExterne,
      onAddSortieExterne: handleAddSortieExterne,
      onUpdateSortieExterne: handleUpdateSortieExterne,
      onDeleteSortieExterne: handleDeleteSortieExterne,
      onMarkSortieReturned: handleMarkSortieReturned,
      onMarkSortieMounted: handleMarkSortieMounted,
      onClearSortiesForRealFactory: handleClearSortiesForRealFactory,
      onResetSortiesToBaseline: handleResetSortiesToBaseline,
      onAddMouvement: handleAddMouvement,
      onUpdateMouvement: handleUpdateMouvement,
      onDeleteMouvement: handleDeleteMouvement,
      onDirectAdjustStock: handleDirectAdjustStock,
      onAddWarehouseItem: handleAddWarehouseItem,
      onUpdateWarehouseItem: handleUpdateWarehouseItem,
      onOpenAddArticle: () => setShowAddArticleModal(true),
      onOpenAddMachine: () => setShowAddMachineModal(true),
      onOpenAddZone: () => setShowAddZoneModal(true),
      onOpenAddTech: () => {
        setAddUserModalType('TECHNICIEN');
        setShowAddUserModal(true);
      },
      onOpenAddChef: () => {
        setAddUserModalType('RESPONSABLE');
        setShowAddUserModal(true);
      },
      onOpenAddOperator: () => {
        setAddUserModalType('OPERATEUR');
        setShowAddUserModal(true);
      },
      onNavigateToWarehouse: () => navigateTo('entrepot'),
      onNavigateToStockFilteredByRef: navigation.handleNavigateToStockFilteredByRef,
      showToast: showToast || navigation?.showToast,
    },

    entrepot: {
      warehouseItems: warehouseItemsComputed,
      entrepotComponents,
      mouvements,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
      zones,
      machines,
      technicians,
      whSearch: filters.whSearch,
      setWhSearch: filters.setWhSearch,
      whFamilyFilter: filters.whFamilyFilter,
      setWhFamilyFilter: filters.setWhFamilyFilter,
      whTemplateFilter: filters.whTemplateFilter,
      setWhTemplateFilter: filters.setWhTemplateFilter,
      whTypeFilter: filters.whTypeFilter,
      setWhTypeFilter: filters.setWhTypeFilter,
      whNatureFilter: filters.whNatureFilter,
      setWhNatureFilter: filters.setWhNatureFilter,
      onAddWarehouseItem: handleAddWarehouseItem,
      onUpdateWarehouseItem: handleUpdateWarehouseItem,
      onDeleteWarehouseItem: handleDeleteWarehouseItem,
      onAddMouvement: handleAddMouvement,
      onUpdateFamily: handleUpdateCompFamily,
      onNavigateToFamily: navigation.handleNavigateToCompFamilies,
      onNavigateToCompFamilies: navigation.handleNavigateToCompFamilies,
      onNavigateToTemplate: (tplId) => {
        if (tplId) filters.setWhSearch(tplId);
        navigateTo('comp_templates');
      },
      onNavigateToCompTemplates: navigation.handleNavigateToCompTemplates,
      onNavigateToType: navigation.handleNavigateToPartTypes,
      onNavigateToPartTypes: navigation.handleNavigateToPartTypes,
      onNavigateToDiag: navigation.handleNavigateToPartDesignations,
      onNavigateToPartDesignations: navigation.handleNavigateToPartDesignations,
      onNavigateToEntrepotByPart: navigation.handleNavigateToEntrepotByPart,
      onNavigateToZone: navigation.handleNavigateToZoneById || (() => navigateTo('zones')),
      onNavigateToMachine:
        navigation.handleNavigateToMachineById ||
        ((mId) => {
          if (mId) filters.setMchSearch(mId);
          navigateTo('machines');
        }),
      showToast: showToast || navigation?.showToast,
    },

    types: {
      types,
      designations: diagnostics || designations,
      stockItems,
      onAddType: handleAddType,
      onUpdateType: handleUpdateType,
      onDeleteType: handleDeleteType,
      onNavigateToStockFiltered: navigation.handleNavigateToStockFiltered,
      onNavigateToDesignationsFiltered: navigation.handleNavigateToDesignationsFiltered,
      onQuickCreateDesignation: navigation.handleNavigateToCreateDesignationForType,
    },

    designations: {
      designations: diagnostics || designations,
      types,
      stockItems,
      desigTypeFilter: filters.diagTypeFilter,
      setDesigTypeFilter: filters.setDiagTypeFilter,
      quickCreateType: filters.quickCreateDesignationType,
      setQuickCreateType: filters.setQuickCreateDesignationType,
      onReturnToTypes: () => navigateTo('types'),
      onAddDesignation: handleAddDesignation,
      onUpdateDesignation: handleUpdateDesignation,
      onDeleteDesignation: handleDeleteDesignation,
      onOpenAddTypeModal: () => navigateTo('types'),
      onNavigateToStockFilteredByRef: navigation.handleNavigateToStockFilteredByRef,
      onNavigateToStockFilteredByType: navigation.handleNavigateToStockFiltered,
      onNavigateToQuickSortie: navigation.handleNavigateToQuickSortieFromDesignation,
    },

    machines: {
      machines,
      families: effectiveFamilies,
      effectiveFamilies,
      templates: effectiveTemplates,
      effectiveTemplates,
      blueprints,
      zones,
      technicians,
      stockItems,
      warehouseItems: warehouseItemsComputed,
      mouvements,
      search: filters.mchSearch,
      setSearch: filters.setMchSearch,
      mchSearch: filters.mchSearch,
      setMchSearch: filters.setMchSearch,
      mchFamilyFilter: filters.mchFamilyFilter,
      setMchFamilyFilter: filters.setMchFamilyFilter,
      mchTemplateFilter: filters.mchTemplateFilter,
      setMchTemplateFilter: filters.setMchTemplateFilter,
      mchZoneFilter: filters.mchZoneFilter,
      setMchZoneFilter: filters.setMchZoneFilter,
      onAddMachine: handleAddMachine,
      onUpdateMachine: handleUpdateMachine,
      onDeleteMachine: handleDeleteMachine,
      onOpenAddMachine: () => setShowAddMachineModal(true),
      onNavigateToFamily: navigation.handleNavigateToFamilyFiltered,
      onNavigateToTemplate: navigation.handleNavigateToTemplatesFiltered,
      onNavigateToZone: navigation.handleNavigateToZoneById,
      onNavigateToBlueprints: navigation.handleNavigateToBlueprintsFiltered,
      onNavigateToQuickSortie: navigation.handleNavigateToQuickSortieFromMachine,
      onNavigateToPreventive: (machId) => {
        if (typeof machId === 'string' && machId.trim()) {
          try {
            localStorage.setItem('gmao_preventive_target_machine', machId.trim());
          } catch {
            // ignore storage errors
          }
        }
        navigateTo('preventive');
      },
      showToast: showToast || navigation?.showToast,
    },

    compGroups: {
      compGroups,
      compFamilies,
      compTemplates,
      entrepotComponents,
      warehouseItems: warehouseItemsComputed,
      onAddCompGroup: handleAddCompGroup,
      onUpdateCompGroup: handleUpdateCompGroup,
      onDeleteCompGroup: handleDeleteCompGroup,
      onNavigateToCompFamilies: navigation.handleNavigateToCompFamiliesByGroup,
      onNavigateToCompTemplates: navigation.handleNavigateToCompTemplatesByGroup,
    },

    compFamilies: {
      compGroups,
      compFamilies,
      compTemplates,
      entrepotComponents,
      warehouseItems: warehouseItemsComputed,
      groupFilter: filters.compFamilyGroupFilter,
      setGroupFilter: filters.setCompFamilyGroupFilter,
      search: filters.whSearch,
      setSearch: filters.setWhSearch,
      onAddCompFamily: handleAddCompFamily,
      onUpdateCompFamily: handleUpdateCompFamily,
      onDeleteCompFamily: handleDeleteCompFamily,
      onNavigateToCompTemplates: navigation.handleNavigateToCompTemplates,
      onQuickCreateCompTemplate: navigation.handleNavigateToCreateCompTemplateForFamily,
      onNavigateToEntrepotByFamily: (familyId) => navigation.handleNavigateToEntrepotByComp(familyId, 'ALL'),
      onNavigateToCompGroups: navigation.handleNavigateToCompGroups,
    },

    compTemplates: {
      compGroups,
      compTemplates,
      compFamilies,
      entrepotComponents,
      warehouseItems: warehouseItemsComputed,
      search: filters.whSearch,
      setSearch: filters.setWhSearch,
      groupFilter: filters.compTemplateGroupFilter,
      setGroupFilter: filters.setCompTemplateGroupFilter,
      compTemplateGroupFilter: filters.compTemplateGroupFilter,
      setCompTemplateGroupFilter: filters.setCompTemplateGroupFilter,
      familyFilter: filters.compTemplateFamilyFilter,
      setFamilyFilter: filters.setCompTemplateFamilyFilter,
      compTemplateFamilyFilter: filters.compTemplateFamilyFilter,
      setCompTemplateFamilyFilter: filters.setCompTemplateFamilyFilter,
      quickCreateFamily: filters.quickCreateCompTemplateFamily,
      setQuickCreateFamily: filters.setQuickCreateCompTemplateFamily,
      onReturnToFamilies: () => navigateTo('comp_families'),
      onAddCompTemplate: handleAddCompTemplate,
      onUpdateCompTemplate: handleUpdateCompTemplate,
      onDeleteCompTemplate: handleDeleteCompTemplate,
      onOpenAddFamilyModal: () => navigateTo('comp_families'),
      onNavigateToEntrepotByTemplate:
        navigation.handleNavigateToEntrepotByTemplate ||
        ((tplId, famId) => navigation.handleNavigateToEntrepotByComp(famId, tplId)),
      onNavigateToCompFamilies: navigation.handleNavigateToCompFamilies,
      onNavigateToQuickSortie: navigation.handleNavigateToQuickSortieFromCompTemplate,
      onNavigateToCompGroups: navigation.handleNavigateToCompGroups,
    },

    partTypes: {
      partTypes,
      partDesignations,
      warehouseItems: warehouseItemsComputed,
      search: filters.whSearch,
      setSearch: filters.setWhSearch,
      onAddPartType: handleAddPartType,
      onUpdatePartType: handleUpdatePartType,
      onDeletePartType: handleDeletePartType,
      onNavigateToPartDesignations: navigation.handleNavigateToPartDesignations,
      onNavigateToEntrepotByType: navigation.handleNavigateToEntrepotByType,
    },

    partDesignations: {
      partDesignations,
      partTypes,
      warehouseItems: warehouseItemsComputed,
      search: filters.whSearch,
      setSearch: filters.setWhSearch,
      partDesignationTypeFilter: filters.partDesignationTypeFilter,
      setPartDesignationTypeFilter: filters.setPartDesignationTypeFilter,
      onAddPartDesignation: handleAddPartDesignation,
      onUpdatePartDesignation: handleUpdatePartDesignation,
      onDeletePartDesignation: handleDeletePartDesignation,
      onNavigateToPartTypes: navigation.handleNavigateToPartTypes,
      onNavigateToEntrepotByPart: navigation.handleNavigateToEntrepotByPart,
      onNavigateToEntrepotByType: navigation.handleNavigateToEntrepotByType,
      onNavigateToQuickSortie: navigation.handleNavigateToQuickSortieFromPartDesignation,
    },

    families: {
      families: effectiveFamilies,
      templates: effectiveTemplates,
      machines,
      search: filters.whSearch,
      setSearch: filters.setWhSearch,
      onAddFamily: handleAddFamily,
      onUpdateFamily: handleUpdateFamily,
      onDeleteFamily: handleDeleteFamily,
      onNavigateToTemplatesFiltered: navigation.handleNavigateToTemplatesFiltered,
      onQuickCreateTemplate: navigation.handleNavigateToCreateTemplateForFamily,
      onNavigateToMachinesByFamily: navigation.handleNavigateToMachinesByFamily,
    },

    templates: {
      templates: effectiveTemplates,
      families: effectiveFamilies,
      machines,
      search: filters.whSearch,
      setSearch: filters.setWhSearch,
      templateFamilyFilter: filters.templateFamilyFilter,
      setTemplateFamilyFilter: filters.setTemplateFamilyFilter,
      quickCreateTemplateFamily: filters.quickCreateTemplateFamily,
      setQuickCreateTemplateFamily: filters.setQuickCreateTemplateFamily,
      onAddTemplate: handleAddTemplate,
      onUpdateTemplate: handleUpdateTemplate,
      onDeleteTemplate: handleDeleteTemplate,
      onOpenAddFamilyModal: () => navigateTo('families'),
      onNavigateToMachinesByTemplate: navigation.handleNavigateToMachinesByTemplate,
      onNavigateToFamilyFiltered: navigation.handleNavigateToFamilyFiltered,
      onNavigateToBlueprints: navigation.handleNavigateToBlueprintsFiltered,
      onQuickCreateBlueprint: navigation.handleNavigateToCreateBlueprintForTemplate,
    },

    blueprints: {
      blueprints,
      templates: effectiveTemplates,
      families: effectiveFamilies,
      machines,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
      stockItems,
      warehouseItems: warehouseItemsComputed,
      mouvements,
      quickCreateBlueprintPreset: filters.quickCreateBlueprintPreset,
      setQuickCreateBlueprintPreset: filters.setQuickCreateBlueprintPreset,
      blueprintFamilyFilter: filters.blueprintFamilyFilter,
      setBlueprintFamilyFilter: filters.setBlueprintFamilyFilter,
      blueprintTemplateFilter: filters.blueprintTemplateFilter,
      setBlueprintTemplateFilter: filters.setBlueprintTemplateFilter,
      onAddBlueprint: handleAddBlueprint,
      onUpdateBlueprint: handleUpdateBlueprint,
      onDeleteBlueprint: handleDeleteBlueprint,
      onApplyBlueprintPreventivePlan: handleApplyBlueprintPreventivePlan,
      preventiveActions,
      preventiveTasks,
      onOpenAddFamilyModal: () => navigateTo('families'),
      onOpenAddTemplateModal: () => navigateTo('templates'),
      onNavigateToMachinesByTemplate: navigation.handleNavigateToMachinesByTemplate,
      onNavigateToFamily: navigation.handleNavigateToFamilyFiltered,
      onNavigateToTemplate: navigation.handleNavigateToTemplatesFiltered,
      onNavigateToTab: navigateTo,
    },

    zones: {
      zones,
      machines,
      technicians,
      operations,
      warehouseItems: warehouseItemsComputed,
      search: filters.whSearch,
      setSearch: filters.setWhSearch,
      onAddZone: handleAddZone,
      onUpdateZone: handleUpdateZone,
      onDeleteZone: handleDeleteZone,
      onNavigateToTechs: navigation.handleNavigateToTechsByZone,
      onNavigateToOps: navigation.handleNavigateToOpsByZone,
      onNavigateToMachines: navigation.handleNavigateToMachinesByZone,
      onOpenAddZoneModal: () => setShowAddZoneModal(true),
      showToast: showToast || navigation?.showToast,
    },

    utilisateurs: {
      technicians,
      operations,
      zones,
      mouvements,
      techZoneFilter: filters.techZoneFilter,
      setTechZoneFilter: filters.setTechZoneFilter,
      opZoneFilter: filters.opZoneFilter,
      setOpZoneFilter: filters.setOpZoneFilter,
      onAddTechnician: handleAddTechnician,
      onUpdateTechnician: handleUpdateTechnician,
      onDeleteTechnician: handleDeleteTechnician,
      onAddOperation: handleAddOperation,
      onUpdateOperation: handleUpdateOperation,
      onDeleteOperation: handleDeleteOperation,
      onOpenAddArticle: () => setShowAddArticleModal(true),
      onOpenAddMachine: () => setShowAddMachineModal(true),
      onOpenAddZone: () => setShowAddZoneModal(true),
      onOpenAddZoneModal: () => setShowAddZoneModal(true),
      showToast: showToast || navigation?.showToast,
      onOpenAddTechModal: () => {
        setAddUserModalType('TECHNICIEN');
        setShowAddUserModal(true);
      },
      onOpenAddRespModal: () => {
        setAddUserModalType('RESPONSABLE');
        setShowAddUserModal(true);
      },
      onOpenAddOpModal: () => {
        setAddUserModalType('OPERATEUR');
        setShowAddUserModal(true);
      },
    },

    settings: {
      rawStock,
      setRawStock: setters.setRawStock,
      stockItems,
      machines,
      setMachines: setters.setMachines,
      mouvements,
      setMouvements: setters.setMouvements,
      types,
      setTypes: setters.setTypes,
      designations,
      setDesignations: setters.setDesignations,
      zones,
      setZones: setters.setZones,
      technicians,
      setTechnicians: setters.setTechnicians,
      operations,
      setOperations: setters.setOperations,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
      families: effectiveFamilies,
      setFamilies: setters.setFamilies,
      templates: effectiveTemplates,
      setTemplates: setters.setTemplates,
      warehouseItems: warehouseItemsComputed,
      sortiesExterne,
      preventiveTasks,
      setPreventiveTasks: setters.setPreventiveTasks,
      correctiveInterventions,
      setCorrectiveInterventions: setters.setCorrectiveInterventions,
      machineElementsLedger,
      setMachineElementsLedger: setters.setMachineElementsLedger,
      onResetCorrective: handleResetCorrectiveToSeed,
      onBulkImportCorrective: handleBulkImportCorrective,
      onLoadDemoData: handleLoadDemoData,
      onClearAllForRealFactory: handleClearAllForRealFactory,
      onLoadDemoSection: handleLoadDemoSection,
      onClearDemoSection: handleClearDemoSection,
      onExportExcel: handleExportExcel,
      onDownloadBlankTemplate: handleDownloadBlankTemplate,
      onNavigateToWarehouse: () => navigateTo('entrepot'),
      showToast,
    },

    nexus: {
      types,
      diagnostics,
      families: effectiveFamilies,
      templates: effectiveTemplates,
      blueprints,
      zones,
      technicians,
      operations,
      machines,
      stockItems,
      compFamilies,
      compTemplates,
      partTypes,
      partDesignations,
      warehouseItems: warehouseItemsComputed,
      mouvements,
      machineElementsLedger,
      preventiveTasks,
      correctiveInterventions,
      onAddMachineElement: addMachineElement,
      onUpdateMachineElement: updateMachineElement,
      onDeleteMachineElement: deleteMachineElement,
      onDuplicateBOMToTwins: duplicateBOMToTwins,
      onNavigateToQuickSortie: navigation.handleNavigateToQuickSortieFromNexus,
      setQuickSortiePreset: filters.setQuickSortiePreset,
      onCreateCorrectiveFromNexus: (machine, element) => {
        if (!machine || !element || typeof handleAddDemandeIntervention !== 'function') return;
        const machineId = String(machine.id_machine_registered || machine.id || '').trim();
        const zoneId = machine.id_zone_default || machine.id_zone || 'Atelier';
        const techName =
          element.technicien && element.technicien !== 'tech'
            ? element.technicien
            : machine.technician || machine.technicien_responsable || 'Technicien';
        const isComp = element.element_type === 'COMPONENT';
        const isPart = element.element_type === 'PART';
        const parentKey = String(element.parent_component_key || '').trim();
        const priorite =
          element.criticalite === 'CRITIQUE'
            ? 'Urgente'
            : element.criticalite === 'MAJEURE'
            ? 'Haute'
            : 'Normale';

        handleAddDemandeIntervention({
          code_machine: machineId,
          id_machine: machineId,
          id_zone: zoneId,
          zone: zoneId,
          technicien: techName,
          demandeur: `Nexus BOM (${techName})`,
          priorite,
          type_panne: isComp ? 'Électromécanique' : 'Mécanique',
          id_composant: isComp ? element.ref_element : parentKey || undefined,
          nom_composant: isComp
            ? element.designation || element.ref_element
            : parentKey || undefined,
          id_part: isPart ? element.ref_element : undefined,
          nom_part: isPart ? element.designation || element.ref_element : undefined,
          anomalie: `Intervention BOM Nexus : ${element.ref_element} — ${element.designation || 'Élément monté'} (${element.statut || 'Usure'})`,
          travail_a_faire:
            element.element_type === 'PDR'
              ? `Contrôler et remplacer la pièce PDR ${element.ref_element} (${element.designation || ''}) montée sur ${element.emplacement_machine || parentKey || machineId}.`
              : `Inspecter / réviser l'organe ${element.ref_element} (${element.designation || ''}) sur ${machineId}.`,
        });
      },
      onCreatePreventiveFromNexus: (machine, element) => {
        if (!machine || !element || typeof handleCreatePlanWithTasks !== 'function') {
          return { skipped: true };
        }
        const machineId = String(machine.id_machine_registered || machine.id || '').trim();
        const composantLabel = `${element.designation || element.ref_element} (${element.ref_element})`;
        const alreadyExists = (preventiveTasks || []).some(
          (t) =>
            String(t.id_machine || '').trim().toUpperCase() === machineId.toUpperCase() &&
            (String(t.composant || '').trim().toLowerCase() === composantLabel.toLowerCase() ||
              String(t.pdr_ref || '').trim().toUpperCase() ===
                String(element.ref_element || '').trim().toUpperCase())
        );
        if (alreadyExists) {
          return { skipped: true, reason: 'ALREADY_EXISTS', composantLabel };
        }

        const zoneId = machine.id_zone_default || machine.id_zone || 'Atelier';
        const techName =
          element.technicien && element.technicien !== 'tech'
            ? element.technicien
            : machine.technician || machine.technicien_responsable || 'Technicien';
        const maxH = Number(element.duree_vie_estimee_heures) || 5000;
        const frequence = maxH <= 1000 ? 'Hebdo' : maxH <= 3000 ? 'Mensuel' : 'Trimestriel';
        const isComp = element.element_type === 'COMPONENT';
        const isPart = element.element_type === 'PART';
        const parentKey = String(element.parent_component_key || '').trim();

        handleCreatePlanWithTasks(
          {
            id_machine: machineId,
            nom_machine: machine.designation || machine.nom || `Machine ${machineId}`,
            id_zone: zoneId,
            id_technicien: techName,
            semaine_cible: 'S1',
            description: `Surveillance préventive BOM Nexus pour ${element.ref_element} sur ${machineId}`,
          },
          [
            {
              composant: composantLabel,
              id_composant: isComp ? element.ref_element : parentKey || undefined,
              nom_composant: isComp
                ? element.designation || element.ref_element
                : parentKey || undefined,
              id_part: isPart ? element.ref_element : undefined,
              nom_part: isPart ? element.designation || element.ref_element : undefined,
              action_code: element.element_type === 'PDR' ? 'C' : 'V',
              frequence,
              duree_estimee: '20 min',
              priorite: element.criticalite === 'CRITIQUE' ? 'Haute' : 'Moyenne',
              consigne: `Contrôler l'usure (RUL max ${maxH}h) de ${element.ref_element} (${element.designation || ''}) à l'emplacement : ${element.emplacement_machine || parentKey || 'Machine'}.`,
              pdr_requises:
                element.element_type === 'PDR'
                  ? [
                      {
                        ref: element.ref_element,
                        nom: element.designation || element.ref_element,
                        designation: element.designation || element.ref_element,
                        quantite: Math.max(1, Number(element.qte_montee) || 1),
                      },
                    ]
                  : [],
            },
          ]
        );
        return { skipped: false, frequence, composantLabel };
      },
      onNavigate: navigateTo,
      showToast,
    },

    preventive: {
      tasks: preventiveTasks,
      actions: preventiveActions,
      guides: preventiveGuides,
      plans: preventivePlans,
      executions: preventiveExecutions,
      onUpdateTask: handleUpdateTask,
      onDeleteTask: handleDeleteTask,
      onUpdateTaskCounter: handleUpdateTaskCounter,
      onMarkTaskDone: handleMarkTaskDone,
      onReviewPreventiveExecution: (executionId, decisionData) =>
        handleReviewPreventiveExecutionValidation?.(
          executionId,
          decisionData,
          handleAddMouvement
        ),
      onDeleteExecution: handleDeletePreventiveExecution,
      onCreatePlanWithTasks: handleCreatePlanWithTasks,
      onAddAction: handleAddPreventiveAction,
      preventiveRecommendations: correctivePreventiveRecommendations,
      onAdoptRecommendation: (rec) => {
        const machineId = String(rec?.machine || rec?.code_machine || '').trim().toUpperCase();
        if (!machineId) return { skipped: true };
        const anomClean = String(rec?.anomalie || rec?.titre || 'inspection_generale')
          .replace(/^Maintenance Préventive Ciblée\s*:\s*/i, '')
          .replace(/_/g, ' ')
          .trim();
        const composantName = `Contrôle ${anomClean}`;
        const alreadyExists = (preventiveTasks || []).some(
          (t) =>
            String(t.id_machine || '').trim().toUpperCase() === machineId &&
            String(t.composant || '').trim().toLowerCase() === composantName.toLowerCase()
        );
        const toastFn = showToast || navigation?.showToast;
        if (alreadyExists) {
          toastFn?.(`Une routine préventive "${composantName}" existe déjà pour ${machineId}.`, 'info');
          return { skipped: true };
        }
        const matchedMachine = (machines || []).find(
          (m) => String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase() === machineId
        );
        const zoneId = matchedMachine?.id_zone_default || matchedMachine?.id_zone || rec?.zone || 'Atelier';
        const techName =
          matchedMachine?.technician ||
          matchedMachine?.technicien_responsable ||
          matchedMachine?.technicien ||
          'Technicien';
        const freq = rec?.suggestedIntervalDays && Number(rec.suggestedIntervalDays) <= 10 ? 'Hebdo' : 'Mensuel';
        if (typeof handleCreatePlanWithTasks === 'function') {
          handleCreatePlanWithTasks(
            {
              id_machine: machineId,
              nom_machine: matchedMachine?.designation || `Machine ${machineId}`,
              id_zone: zoneId,
              id_technicien: techName,
              semaine_cible: 'S1',
              description: rec?.recommendation || rec?.description || `Routine anti-récidive (${anomClean}) pour ${machineId}`,
            },
            [
              {
                composant: composantName,
                action_code: 'C',
                frequence: freq,
                duree_estimee: '20 min',
                priorite: 'Haute',
                consigne: rec?.recommendedAction || rec?.description || `Contrôle préventif systématique (${anomClean})`,
              },
            ]
          );
        }
        if (typeof handleAddPreventiveAction === 'function') {
          handleAddPreventiveAction({
            code: 'C',
            libelle: `${composantName} (${machineId})`,
            description: rec?.recommendedAction || rec?.description || '',
            type_maintenance: 'Préventif',
            frequence_defaut: freq === 'Hebdo' ? '1S' : '1M',
          });
        }
        toastFn?.(`Routine préventive "${composantName}" planifiée pour ${machineId} (${freq}).`, 'success');
        return { skipped: false, machineId, composant: composantName };
      },
      onResetToBaseline: (ctx) => handleResetPreventiveToBaseline({ machines, ...ctx }),
      onClearPreventiveForRealFactory: (ctx) => handleClearPreventiveForRealFactory({ machines, ...ctx }),
      machines,
      blueprints,
      zones,
      technicians,
      stockItems,
      warehouseItems: warehouseItemsComputed,
      mouvements,
      onAddMouvement: handleAddMouvement,
      onDirectAdjustStock: handleDirectAdjustStock,
      onUpdateMachine: handleUpdateMachine,
      showToast: showToast || navigation?.showToast,
      onNavigateToMachine: (machId) => {
        if (navigation?.handleNavigateToMachineById) {
          navigation.handleNavigateToMachineById(machId);
        } else {
          navigateTo('machines');
        }
      },
      onNavigateToReferentiel: () => navigateTo('preventive_referentiel'),
      onCreateCorrective: (taskOrPayload = {}, btData = {}) => {
        if (typeof handleAddDemandeIntervention === 'function') {
          const { id: preventiveTaskId, etat: _etat, statut: _statut, ...restTask } = taskOrPayload || {};
          handleAddDemandeIntervention({
            ...restTask,
            ...btData,
            id_tache_preventive: preventiveTaskId || undefined,
            code_machine:
              btData?.code_machine ||
              taskOrPayload?.code_machine ||
              taskOrPayload?.id_machine ||
              taskOrPayload?.machine ||
              '',
            anomalie:
              btData?.anomalie ||
              btData?.description ||
              taskOrPayload?.anomalie ||
              taskOrPayload?.description ||
              taskOrPayload?.composant ||
              'Anomalie détectée en préventif',
            travail_a_faire:
              btData?.description ||
              taskOrPayload?.consigne ||
              `Intervention corrective suite au contrôle ${taskOrPayload?.composant || ''}`,
            priorite: String(btData?.priorite || taskOrPayload?.priorite || 'HAUTE').toUpperCase(),
            demandeur:
              btData?.demandeur ||
              taskOrPayload?.demandeur ||
              taskOrPayload?.technicien ||
              taskOrPayload?.responsable ||
              'Maintenance Préventive',
          });
        }
        const toastFn = showToast || navigation?.showToast;
        if (toastFn) {
          toastFn(
            `DI Corrective créée depuis le préventif (${taskOrPayload?.id_machine || taskOrPayload?.code_machine || ''}) !`,
            'info'
          );
        }
      },
    },

    preventiveReferentiel: {
      tasks: preventiveTasks,
      actions: preventiveActions,
      guides: preventiveGuides,
      plans: preventivePlans,
      onAddAction: handleAddPreventiveAction,
      onUpdateAction: handleUpdatePreventiveAction,
      onDeleteAction: handleDeletePreventiveAction,
      onAddGuide: handleAddPreventiveGuide,
      onUpdateGuide: handleUpdatePreventiveGuide,
      onDeleteGuide: handleDeletePreventiveGuide,
      onCreatePlanWithTasks: handleCreatePlanWithTasks,
      onResetToBaseline: (ctx) => handleResetPreventiveToBaseline({ machines, ...ctx }),
      onClearPreventiveForRealFactory: (ctx) => handleClearPreventiveForRealFactory({ machines, ...ctx }),
      machines,
      zones,
      technicians,
      stockItems,
      warehouseItems: warehouseItemsComputed,
      blueprints,
      compTemplates,
      compFamilies,
      mouvements,
      onAddMouvement: handleAddMouvement,
      onDirectAdjustStock: handleDirectAdjustStock,
      showToast: showToast || navigation?.showToast,
      onNavigateToMainView: () => navigateTo('preventive'),
      preventiveRecommendations: correctivePreventiveRecommendations,
    },

    corrective: {
      interventions: correctiveInterventions,
      activeLiveId: activeLiveInterventionId,
      setActiveLiveId: handleStartLiveIntervention,
      kpis: correctiveKpis,
      paretoAnomalies: correctiveParetoAnomalies,
      paretoMachines: correctiveParetoMachines,
      paretoTypes: correctiveParetoTypes,
      preventiveRecommendations: correctivePreventiveRecommendations,
      actionsByPanne: correctiveActionsByPanne,
      panneCategories: correctivePanneCategories,
      travauxAFaire: correctiveTravauxAFaire,
      intervenants: correctiveIntervenants,
      getActionsForPanne: handleGetCorrectiveActionsForPanne,
      onAddActionForPanne: handleAddCorrectiveActionForPanne,
      onUpdateActionForPanne: handleUpdateCorrectiveActionForPanne,
      onDeleteActionForPanne: handleDeleteCorrectiveActionForPanne,
      onAddPanne: handleAddPanne,
      onUpdatePanne: handleUpdatePanne,
      onDeletePanne: handleDeletePanne,
      onAddTravail: handleAddTravail,
      onUpdateTravail: handleUpdateTravail,
      onDeleteTravail: handleDeleteTravail,
      onResetActionsToSeed: handleResetCorrectiveActions,
      onForceSyncSeed: handleForceSyncCorrectiveSeed,
      onAddDemande: handleAddDemandeIntervention,
      onConvertToBt: handleConvertToBt,
      onStartLive: handleStartLiveIntervention,
      onSubmitForValidation: handleSubmitInterventionForValidation,
      onReviewValidation: (id, decisionData, customMvtHandler) =>
        handleReviewInterventionValidation(id, decisionData, customMvtHandler || handleAddMouvement),
      onClotureIntervention: (id, clotureData, customMvtHandler) =>
        handleClotureIntervention(id, clotureData, customMvtHandler || handleAddMouvement),
      onUpdateIntervention: handleUpdateCorrectiveIntervention,
      onDeleteIntervention: handleDeleteCorrectiveIntervention,
      onBulkImport: handleBulkImportCorrective,
      onResetToSeed: (ctx) => handleResetCorrectiveToSeed({ machines, ...ctx }),
      machines,
      blueprints,
      zones,
      technicians,
      onAddTechnician: handleAddTechnician,
      onUpdateTechnician: handleUpdateTechnician,
      onDeleteTechnician: handleDeleteTechnician,
      stockItems,
      warehouseItems: warehouseItemsComputed,
      onAddMouvement: handleAddMouvement,
      onAddPreventiveTask: (recOrTask) => {
        const machineId = String(recOrTask?.code_machine || recOrTask?.machine || '').trim().toUpperCase();
        if (!machineId || typeof handleCreatePlanWithTasks !== 'function') {
          return { created: false };
        }
        const anomClean = String(recOrTask?.anomalie || recOrTask?.titre || 'inspection_generale')
          .replace(/^Maintenance Préventive Ciblée\s*:\s*/i, '')
          .replace(/_/g, ' ')
          .trim();
        const composantName = `Contrôle ${anomClean}`;
        const alreadyExists = (preventiveTasks || []).some(
          (t) =>
            String(t.id_machine || '').trim().toUpperCase() === machineId &&
            String(t.composant || '').trim().toLowerCase() === composantName.toLowerCase()
        );
        if (alreadyExists) {
          return { created: false, duplicate: true };
        }
        const matchedMachine = (machines || []).find(
          (m) => String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase() === machineId
        );
        const zoneId = matchedMachine?.id_zone_default || matchedMachine?.id_zone || recOrTask?.zone || 'Atelier';
        const resolvedTech = matchedMachine?.technician || matchedMachine?.technicien || 'Technicien';
        handleCreatePlanWithTasks(
          {
            id_machine: machineId,
            nom_machine: matchedMachine?.designation || `Machine ${machineId}`,
            id_zone: zoneId,
            id_technicien: resolvedTech,
            semaine_cible: 'S1',
            description: recOrTask?.description || `Plan préventif ciblé (${anomClean}) pour ${machineId}`,
          },
          [
            {
              composant: composantName,
              action_code: 'C',
              frequence: 'Mensuel',
              duree_estimee: '20 min',
              priorite: 'Haute',
              consigne: recOrTask?.description || `Contrôle préventif systématique (${anomClean})`,
            },
          ]
        );
        return { created: true };
      },
      showToast: showToast || navigation?.showToast,
      onNavigateToTab: navigateTo,
    },

    guide: {},
  }), [
    stockItems,
    machines,
    warehouseItemsComputed,
    mouvements,
    types,
    diagnostics,
    zones,
    technicians,
    operations,
    stockKPIs,
    filters,
    navigation,
    effectiveFamilies,
    effectiveTemplates,
    blueprints,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    rawStock,
    designations,
    families,
    templates,
    navigateTo,
    handleQuickSortie,
    handleAddMouvement,
    handleUpdateMouvement,
    handleDeleteMouvement,
    handleExportExcel,
    handleUpdateArticle,
    handleDirectAdjustStock,
    handleAddWarehouseItem,
    handleUpdateWarehouseItem,
    handleDeleteWarehouseItem,
    handleAddType,
    handleUpdateType,
    handleDeleteType,
    handleAddDesignation,
    handleUpdateDesignation,
    handleDeleteDesignation,
    handleAddMachine,
    handleUpdateMachine,
    handleDeleteMachine,
    handleAddCompGroup,
    handleUpdateCompGroup,
    handleDeleteCompGroup,
    handleAddCompFamily,
    handleUpdateCompFamily,
    handleDeleteCompFamily,
    handleAddCompTemplate,
    handleUpdateCompTemplate,
    handleDeleteCompTemplate,
    handleAddPartType,
    handleUpdatePartType,
    handleDeletePartType,
    handleAddPartDesignation,
    handleUpdatePartDesignation,
    handleDeletePartDesignation,
    handleAddZone,
    handleUpdateZone,
    handleDeleteZone,
    handleAddTechnician,
    handleUpdateTechnician,
    handleDeleteTechnician,
    handleAddOperation,
    handleUpdateOperation,
    handleDeleteOperation,
    preventiveTasks,
    preventiveActions,
    preventiveGuides,
    preventivePlans,
    preventiveExecutions,
    handleUpdateTask,
    handleMarkTaskDone,
    handleReviewPreventiveExecutionValidation,
    handleDeletePreventiveExecution,
    handleCreatePlanWithTasks,
    handleAddPreventiveAction,
    handleUpdatePreventiveAction,
    handleDeletePreventiveAction,
    handleAddPreventiveGuide,
    handleUpdatePreventiveGuide,
    handleDeletePreventiveGuide,
    handleResetPreventiveToBaseline,
    handleClearPreventiveForRealFactory,
    sortiesExterne,
    handleAddSortieExterne,
    handleUpdateSortieExterne,
    handleDeleteSortieExterne,
    handleMarkSortieReturned,
    handleMarkSortieMounted,
    handleClearSortiesForRealFactory,
    handleResetSortiesToBaseline,
    correctiveInterventions,
    activeLiveInterventionId,
    correctiveKpis,
    correctiveParetoAnomalies,
    correctiveParetoMachines,
    correctiveParetoTypes,
    correctivePreventiveRecommendations,
    correctiveActionsByPanne,
    correctivePanneCategories,
    correctiveTravauxAFaire,
    correctiveIntervenants,
    handleAddDemandeIntervention,
    handleConvertToBt,
    handleStartLiveIntervention,
    handleClotureIntervention,
    handleUpdateCorrectiveIntervention,
    handleDeleteCorrectiveIntervention,
    handleBulkImportCorrective,
    handleResetCorrectiveToSeed,
    setShowAddArticleModal,
    setShowAddMachineModal,
    setShowAddUserModal,
    setAddUserModalType,
    setShowAddZoneModal,
  ]);
}
