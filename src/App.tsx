import {
  useState,
  useRef,
  useEffect,
} from 'react';
import { useGmaoState } from './hooks/useGmaoState';
import { useAppCalculations } from './hooks/useAppCalculations';
import { useAppNavigation } from './hooks/useAppNavigation';
import { useAppExcelOperations } from './hooks/useAppExcelOperations';
import { useAppModals } from './hooks/useAppModals';
import { useAppEntityActions } from './hooks/useAppEntityActions';

import { SplashScreen, LoginScreen } from './presentation/pages/auth';
import OfflineIndicator from './presentation/components/common/OfflineIndicator';
import ErrorBoundary from './presentation/components/common/ErrorBoundary';
import RuntimeErrorModal from './presentation/components/common/RuntimeErrorModal';
import ConfirmDialog from './presentation/components/common/ConfirmDialog';

import { backupService } from './utils/BackupService';
import { Logger } from './core/logger/LoggerService';
import { monitor } from './utils/PerformanceMonitor';

import { useAuth } from './context/AuthContext';
import MainLayout from './presentation/components/layout/MainLayout';
import AppModals from './presentation/modals/AppModals';
import AppRouter from './presentation/router/AppRouter';
import { useAppRouterProps } from './presentation/router/useAppRouterProps';

import { useAppViewController } from './hooks/useAppViewController';
import { DataGateway } from './application/DataGateway';
import MachineQrFieldModal from './presentation/pages/machines/components/MachineQrFieldModal';
import { useAppShell } from './core/shell/shellPolicy';
import MobileShell from './presentation/components/shell/MobileShell';

export default function App() {
  const { user: currentUser, logout } = useAuth();
  const shell = useAppShell();

  // App Controller containing splash screen, toast notifications, active tab persistence, and mobile drawer states
  const {
    showSplash,
    handleSplashComplete,
    toast,
    setToast,
    showToast,
    currentTab,
    setCurrentTab,
    mobileMenuOpen,
    setMobileMenuOpen,
  } = useAppViewController();

  const fileInputRef = useRef(null);

  // Core Data States
  const gmaoState = useGmaoState();
  const {
    types,
    designations,
    families,
    templates,
    blueprints,
    machines,
    warehouseItems,
    entrepotComponents,
    zones,
    technicians,
    operations,
    mouvements,
    sortieDemands,
    rawStock,
    compGroups,
    compFamilies,
    compTemplates,
    partTypes,
    partDesignations,
    preventiveTasks,
    preventiveActions,
    preventiveGuides,
    preventivePlans,
    preventiveExecutions,
    sortiesExterne,
    handleUpdateTask,
    handleDeleteTask,
    handleUpdateTaskCounter,
    handleMarkTaskDone,
    handleReviewPreventiveExecutionValidation,
    handleDeletePreventiveExecution,
    handleCreatePlanWithTasks,
    handleAddAction: handleAddPreventiveAction,
    handleUpdateAction: handleUpdatePreventiveAction,
    handleDeleteAction: handleDeletePreventiveAction,
    handleAddGuide: handleAddPreventiveGuide,
    handleUpdateGuide: handleUpdatePreventiveGuide,
    handleDeleteGuide: handleDeletePreventiveGuide,
    handleResetPreventiveToBaseline,
    handleClearPreventiveForRealFactory,
    handleAddSortieExterne,
    handleUpdateSortieExterne,
    handleDeleteSortieExterne,
    handleMarkSortieReturned,
    handleMarkSortieMounted,
    handleClearSortiesForRealFactory,
    handleResetSortiesToBaseline,
    // Corrective Nexus
    correctiveInterventions,
    correctiveActionsByPanne,
    correctivePanneCategories,
    correctiveTravauxAFaire,
    correctiveIntervenants,
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
    activeLiveInterventionId,
    correctiveKpis,
    correctiveParetoAnomalies,
    correctiveParetoMachines,
    correctiveParetoTypes,
    correctivePreventiveRecommendations,
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
    // Machine BOM Ledger
    machineElementsLedger,
    addMachineElement,
    updateMachineElement,
    deleteMachineElement,
    duplicateBOMToTwins,
    handleLoadDemoData,
    handleClearAllForRealFactory,
    handleLoadDemoSection,
    handleClearDemoSection,
  } = gmaoState;

  // Auto Backup and Performance Monitor Initialization
  const backupDataRef = useRef({});
  const [scannedQrMachine, setScannedQrMachine] = useState<any | null>(null);

  // Detect ?machine_qr=<CODE> on LAN scan to open Fiche Terrain Mobile automatically
  useEffect(() => {
    if (typeof window === 'undefined' || !Array.isArray(machines) || machines.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const qrCode = params.get('machine_qr');
    if (!qrCode) return;

    const cleanCode = qrCode.trim().toUpperCase();
    const matched = machines.find(
      (m: any) =>
        String(m.id_machine_registered || m.id || m.code || '')
          .trim()
          .toUpperCase() === cleanCode
    );
    if (matched) {
      setScannedQrMachine(matched);
      // Clean URL parameter without reloading so closing the modal doesn't re-trigger
      try {
        params.delete('machine_qr');
        const nextQuery = params.toString();
        const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;
        window.history.replaceState({}, '', nextUrl);
      } catch {
        // ignore history error
      }
    }
  }, [machines]);

  // Load real stock if empty ONLY when not in explicit empty factory mode
  useEffect(() => {
    const startMode = localStorage.getItem('gmao_start_mode');
    const demoFlag = localStorage.getItem('gmao_demo_data_loaded_v1');
    if (
      rawStock &&
      rawStock.length === 0 &&
      startMode !== 'empty' &&
      demoFlag !== 'false' &&
      demoFlag === 'true'
    ) {
      DataGateway.initRealStock({ setRawStock: gmaoState.setRawStock });
    }
  }, [rawStock, gmaoState.setRawStock]);

  useEffect(() => {
    backupDataRef.current = {
      currentUser,
      rawStock,
      mouvements,
      machines,
      warehouseItems,
      families,
      templates,
      zones,
      designations,
      types,
      technicians,
      operations,
      preventiveTasks,
      preventiveActions,
      preventiveGuides,
      preventivePlans,
      preventiveExecutions,
      sortiesExterne,
    };
  }, [
    currentUser,
    rawStock,
    mouvements,
    machines,
    warehouseItems,
    families,
    templates,
    zones,
    designations,
    types,
    technicians,
    operations,
    preventiveTasks,
    preventiveActions,
    preventiveGuides,
    preventivePlans,
    preventiveExecutions,
    sortiesExterne,
  ]);

  useEffect(() => {
    Logger.info('Application started');
    monitor.measure('App_Init', () => {
      backupService.startAutoBackup(() => {
        const d = backupDataRef.current || {};
        return {
          Stock_Actuel: d.rawStock,
          Mouvement: d.mouvements,
          Machines_Registered: d.machines,
          Warehouse_Items: d.warehouseItems,
          Families: d.families,
          Templates: d.templates,
          Zones: d.zones,
          Diagnostics: d.designations,
          Types: d.types,
          Technicians: d.technicians,
          Operations: d.operations,
        };
      }, backupDataRef.current?.currentUser?.name || backupDataRef.current?.currentUser?.nom || 'system');
    });

    return () => {
      backupService.stopAutoBackup();
    };
  }, []);

  // Calculations: Real-time stock status, fallbacks, warehouse totals, KPIs
  const {
    stockItems,
    effectiveDesignations,
    effectiveFamilies,
    effectiveTemplates,
    diagnostics,
    warehouseItemsComputed,
    stockKPIs,
  } = useAppCalculations({
    rawStock,
    mouvements,
    designations,
    families,
    templates,
    warehouseItems,
  });

  // Smart Navigation & Filter States
  const { filters, navigation } = useAppNavigation({ setCurrentTab });

  // Modal States
  const modals = useAppModals();

  // Consolidated Entity Actions
  const entityActions = useAppEntityActions({
    gmaoState,
    showToast,
    setCurrentTab,
  });

  // Excel & File System Direct Operations
  const {
    linkedFileName,
    handleExportExcel,
    handleDownloadBlankTemplate,
    exportMasterTopologyWorkbook,
    exportInventoryMaterialsWorkbook,
    exportMovementsUnifiedWorkbook,
    handleImportFile,
    handleDirectFileLink,
    handleDirectSave,
    operationProgress,
  } = useAppExcelOperations({
    state: gmaoState,
    stockItems,
    diagnostics,
    showToast,
    fileInputRef,
  });

  const routerProps = useAppRouterProps({
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
    correctiveActionsByPanne,
    correctivePanneCategories,
    correctiveTravauxAFaire,
    correctiveIntervenants,
    activeLiveInterventionId,
    correctiveKpis,
    correctiveParetoAnomalies,
    correctiveParetoMachines,
    correctiveParetoTypes,
    correctivePreventiveRecommendations,
    modals,
    handlers: {
      ...entityActions,
      handleExportExcel,
      handleDownloadBlankTemplate,
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
    setters: gmaoState,
    showToast,
  });

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!currentUser) {
    return (
      <>
        <LoginScreen />
        <ConfirmDialog />
      </>
    );
  }

  if (shell.resolved === 'mobile') {
    return (
      <ErrorBoundary>
        <MobileShell
          currentUser={currentUser}
          onLogout={() => {
            try {
              localStorage.setItem('gmao_active_tab', 'dashboard');
            } catch {
              /* ignore */
            }
            setCurrentTab('dashboard');
            logout();
          }}
          setCurrentTab={setCurrentTab}
          machines={machines}
          zones={zones}
          stockItems={stockItems}
          technicians={technicians}
          preventiveTasks={preventiveTasks}
          preventiveExecutions={preventiveExecutions}
          correctiveInterventions={correctiveInterventions}
          sortieDemands={sortieDemands}
          mouvements={mouvements}
          activeLiveInterventionId={activeLiveInterventionId}
          onMarkTaskDone={handleMarkTaskDone}
          onAddDemandeIntervention={handleAddDemandeIntervention}
          onStartLiveIntervention={handleStartLiveIntervention}
          onSubmitInterventionForValidation={handleSubmitInterventionForValidation}
          onOpenMachineQrModal={(machineId) => {
            const cleanTarget = String(machineId || '').trim().toUpperCase();
            const found = (machines || []).find(
              (m: any) =>
                String(m.id_machine_registered || m.id || m.code || '')
                  .trim()
                  .toUpperCase() === cleanTarget
            );
            if (found) {
              setScannedQrMachine(found);
            }
          }}
          showToast={showToast}
          toast={toast}
          setToast={setToast}
        />

        <OfflineIndicator />
        <RuntimeErrorModal />
        <ConfirmDialog />

        {scannedQrMachine && (
          <MachineQrFieldModal
            machine={scannedQrMachine}
            initialMode="FICHE_TERRAIN"
            onClose={() => setScannedQrMachine(null)}
            onNavigateToPreventive={() => setCurrentTab('preventive')}
            onNavigateToQuickSortie={(m) => {
              navigation?.handleNavigateToQuickSortieFromMachine?.(m);
            }}
            showToast={showToast}
          />
        )}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <MainLayout
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        filters={filters}
        navigation={navigation}
        counts={{
          stock: stockItems.length,
          types: types.length,
          designations: effectiveDesignations.length,
          diagnostics: effectiveDesignations.length,
          machines: machines.length,
          families: effectiveFamilies.length,
          templates: effectiveTemplates.length,
          blueprints: (blueprints || []).length,
          preventive: (preventiveTasks || []).length,
          preventiveGuides: (preventiveGuides || []).length,
          preventiveActions: (preventiveActions || []).length,
          preventivePlans: (preventivePlans || []).length,
          corrective: (correctiveInterventions || []).length,
          corrective_di: (correctiveInterventions || []).filter(
            (i) => i.statut === 'DEMANDE' || i.statut === 'DEMANDE_CREEE' || i.statut === 'EN_ATTENTE_VALIDATION'
          ).length,
          corrective_bt: (correctiveInterventions || []).filter(
            (i) => i.statut === 'BT_PLANIFIE' || i.statut === 'EN_ATTENTE_PDR' || (i.statut === 'EN_COURS' && i.num_bt)
          ).length,
          corrective_live: (correctiveInterventions || []).filter((i) => i.statut === 'EN_COURS').length,
          corrective_cloture: (correctiveInterventions || []).filter((i) => i.statut === 'CLOTURE').length,
          pendingPreventiveValidation: (preventiveExecutions || []).filter(
            (ex) => ex.validation_status === 'PENDING_VALIDATION'
          ).length,
          pendingCorrectiveValidation: (correctiveInterventions || []).filter(
            (i) => i.validation_status === 'PENDING_VALIDATION' || i.statut === 'EN_ATTENTE_VALIDATION'
          ).length,
          pendingSortieDemands: (sortieDemands || []).filter(
            (d) => d.validation_status === 'PENDING_VALIDATION'
          ).length,
          openBtCount: (correctiveInterventions || []).filter(
            (i) => i.validation_status === 'PENDING_VALIDATION' || i.statut === 'EN_ATTENTE_VALIDATION' || i.statut === 'EN_COURS'
          ).length,
          pendingTasksCount: (preventiveExecutions || []).filter(
            (ex) => ex.validation_status === 'PENDING_VALIDATION'
          ).length,
          ruptureCount: (sortieDemands || []).filter(
            (d) => d.validation_status === 'PENDING_VALIDATION'
          ).length,
          warehouse: warehouseItemsComputed.length,
          entrepot: (entrepotComponents || []).length,
          comp_groups: (compGroups || []).length,
          compGroups: (compGroups || []).length,
          comp_families: (compFamilies || []).length,
          compFamilies: (compFamilies || []).length,
          comp_templates: (compTemplates || []).length,
          compTemplates: (compTemplates || []).length,
          partTypes: (partTypes || []).length,
          partDesignations: (partDesignations || []).length,
          zones: zones.length,
          technicians: technicians.length,
          operations: operations.length,
        }}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        fileInputRef={fileInputRef}
        handleImportFile={handleImportFile}
        handleExportExcel={handleExportExcel}
        exportMasterTopologyWorkbook={exportMasterTopologyWorkbook}
        exportInventoryMaterialsWorkbook={exportInventoryMaterialsWorkbook}
        exportMovementsUnifiedWorkbook={exportMovementsUnifiedWorkbook}
        linkedFileName={linkedFileName}
        onDirectLink={handleDirectFileLink}
        onDirectSave={handleDirectSave}
        stockItems={stockItems}
        machines={machines}
        zones={zones}
        technicians={technicians}
        preventiveTasks={preventiveTasks}
        onMarkTaskDone={handleMarkTaskDone}
        onAddMouvement={entityActions.handleAddMouvement}
        showToast={showToast}
        operationProgress={operationProgress}
      >
        <AppRouter
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          props={routerProps}
        />

        <AppModals
          {...modals}
          types={types}
          stockItems={stockItems}
          effectiveFamilies={effectiveFamilies}
          effectiveTemplates={effectiveTemplates}
          blueprints={blueprints}
          zones={zones}
          technicians={technicians}
          machines={machines}
          operations={operations}
          handleAddArticle={entityActions.handleAddArticle}
          handleAddMachine={entityActions.handleAddMachine}
          handleUpdateMachine={entityActions.handleUpdateMachine}
          handleDeleteMachine={entityActions.handleDeleteMachine}
          handleAddTechnician={entityActions.handleAddTechnician}
          handleAddOperation={entityActions.handleAddOperation}
          handleAddZone={entityActions.handleAddZone}
          setCurrentTab={setCurrentTab}
          toast={toast}
          setToast={setToast}
        />

        {/* 100% Offline Status Indicator */}
        <OfflineIndicator />

        {/* Global Runtime Error System Modal */}
        <RuntimeErrorModal />

        {/* Unified UI-Safe Confirmation Modal */}
        <ConfirmDialog />

        {/* Mobile QR Scan Field Card Modal (?machine_qr=<CODE>) */}
        {scannedQrMachine && (
          <MachineQrFieldModal
            machine={scannedQrMachine}
            initialMode="FICHE_TERRAIN"
            onClose={() => setScannedQrMachine(null)}
            onNavigateToPreventive={() => setCurrentTab('preventive')}
            onNavigateToQuickSortie={(m) => {
              navigation?.handleNavigateToQuickSortieFromMachine?.(m);
            }}
            showToast={showToast}
          />
        )}
      </MainLayout>
    </ErrorBoundary>
  );
}
