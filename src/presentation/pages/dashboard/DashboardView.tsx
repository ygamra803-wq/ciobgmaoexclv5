import AnimatedPage from '../../components/common/AnimatedPage';
import ServerSyncConflictModal from '../../components/common/ServerSyncConflictModal';
import FactoryOnboardingWizard from '../../components/common/FactoryOnboardingWizard';
import DashboardKPIs from './components/DashboardKPIs';
import {
  DashboardPurchaseOrderModal,
  DashboardFormulasModal,
  type OrderActorOption,
  type OrderStockArticleOption,
} from './components/DashboardModals';
import {
  DashboardLogisticsAndAnalyticsSection,
  DashboardTechQuickAccessHub,
} from './components/DashboardLogisticsAndAnalyticsSection';
import { TechnicianDashboardPanel } from './components/TechnicianDashboardPanel';
import { DashboardHeaderBanner } from './components/DashboardHeaderBanner';
import { DashboardTrustAndRadarStrip } from './components/DashboardTrustAndRadarStrip';
import { DashboardExecutiveAndQuickNav } from './components/DashboardExecutiveAndQuickNav';
import { DashboardWatchlistAndFeed } from './components/DashboardWatchlistAndFeed';
import {
  useDashboardController,
  type DashboardViewProps,
} from './hooks/useDashboardController';

export default function DashboardView(props: DashboardViewProps) {
  const {
    onNavigateToStock,
    onNavigateToMachines,
    onNavigateToWarehouse,
    onNavigateToSortie,
    onNavigateToPreventive,
    onNavigateToCorrective,
    onNavigateToZones,
    onNavigateToUsers,
    onNavigateToSettings,
    onNavigateToGuide,
    onNavigateToValidationCenter,
    onQuickSortie,
    onDeleteMouvement,
    onExportExcel,
    showToast,
  } = props;

  const ctrl = useDashboardController(props);

  return (
    <AnimatedPage className="space-y-6 select-none font-sans">
      <DashboardHeaderBanner
        t={ctrl.t}
        isTechUser={ctrl.isTechUser}
        isStoreManager={ctrl.isStoreManager}
        isOperatorRole={ctrl.isOperatorRole}
        isViewerRole={ctrl.isViewerRole}
        techBadgeLabel={ctrl.techScope.badgeLabel}
        canManageSettings={ctrl.canManageSettings}
        canCreateMovement={ctrl.canCreateMovement}
        canExportData={ctrl.canExportData}
        canAccessPreventiveTab={ctrl.canAccessPreventiveTab}
        canAccessCorrectiveTab={ctrl.canAccessCorrectiveTab}
        canAccessCorrectiveDiTab={ctrl.canAccessCorrectiveDiTab}
        canAccessSortieTab={ctrl.canAccessSortieTab}
        onToggleOnboarding={() => ctrl.setForceShowOnboarding((prev) => !prev)}
        onOpenFormulas={() => ctrl.setShowFormulasModal(true)}
        onOpenNewOrder={ctrl.handleOpenNewOrder}
        onNavigateToPreventive={onNavigateToPreventive}
        onNavigateToCorrective={onNavigateToCorrective}
        onNavigateToSortie={onNavigateToSortie}
        onExportExcel={onExportExcel}
      />

      {ctrl.isTechUser ? (
        <TechnicianDashboardPanel
          techScope={ctrl.techScope}
          correctiveInterventions={ctrl.correctiveInterventions}
          onNavigateToPreventive={onNavigateToPreventive}
          onNavigateToCorrective={onNavigateToCorrective}
          onNavigateToSortie={onNavigateToSortie}
          t={ctrl.t}
        />
      ) : (
        <div className="space-y-5">
          {ctrl.canManageSettings && (
            <FactoryOnboardingWizard
              onNavigateToZones={onNavigateToZones}
              onNavigateToMachines={onNavigateToMachines}
              onNavigateToUsers={onNavigateToUsers}
              onNavigateToPreventive={onNavigateToPreventive}
              showToast={showToast}
              forceOpen={ctrl.forceShowOnboarding}
              onCloseForceOpen={() => ctrl.setForceShowOnboarding(false)}
            />
          )}

          <DashboardTrustAndRadarStrip
            t={ctrl.t}
            syncTrust={ctrl.syncTrust}
            isSyncBusy={ctrl.isSyncBusy}
            canSyncLan={ctrl.canSyncLan}
            canAccessSettingsTab={ctrl.canAccessSettingsTab}
            canAccessValidationCenterTab={ctrl.canAccessValidationCenterTab}
            canAccessCorrectiveBtTab={ctrl.canAccessCorrectiveBtTab}
            canAccessPreventiveTab={ctrl.canAccessPreventiveTab}
            canAccessSortieTab={ctrl.canAccessSortieTab}
            referentialAudit={ctrl.referentialAudit}
            validationQueues={ctrl.validationQueues}
            validationRadar={ctrl.validationRadar}
            isRadarExpanded={ctrl.isRadarExpanded}
            onToggleRadar={() => ctrl.setIsRadarExpanded((prev) => !prev)}
            onOpenConflictModal={() => ctrl.setShowConflictModal(true)}
            onQuickLanMerge={ctrl.handleQuickLanMerge}
            onNavigateToSettings={onNavigateToSettings}
            onNavigateToValidationCenter={onNavigateToValidationCenter}
            onNavigateToCorrective={onNavigateToCorrective}
            onNavigateToPreventive={onNavigateToPreventive}
            onNavigateToSortie={onNavigateToSortie}
          />

          <ServerSyncConflictModal
            isOpen={ctrl.canSyncLan && ctrl.showConflictModal && Boolean(ctrl.syncTrust.unresolvedConflict)}
            conflict={ctrl.syncTrust.unresolvedConflict}
            onSmartMerge={ctrl.handleQuickLanMerge}
            onForcePushLocal={ctrl.handleForcePushConflict}
            onForcePullServer={ctrl.handleForcePullConflict}
            onCancel={() => ctrl.setShowConflictModal(false)}
            isProcessing={ctrl.isSyncBusy}
          />

          <DashboardKPIs
            stockKPIs={ctrl.stockKPIs}
            types={ctrl.types}
            machineHealth={ctrl.machineHealth}
            onNavigateToStock={ctrl.canAccessStockTab ? onNavigateToStock : undefined}
            onNavigateToMachines={ctrl.canAccessMachinesTab ? onNavigateToMachines : undefined}
          />

          <DashboardExecutiveAndQuickNav
            t={ctrl.t}
            executiveMaintenanceSummary={ctrl.executiveMaintenanceSummary}
            machineHealth={ctrl.machineHealth}
            pendingOrdersCount={ctrl.pendingOrders.length}
            pendingExternalRepairsCount={ctrl.pendingExternalRepairs.length}
            canAccessPreventiveTab={ctrl.canAccessPreventiveTab}
            canAccessCorrectiveTab={ctrl.canAccessCorrectiveTab}
            canAccessCorrectiveDiTab={ctrl.canAccessCorrectiveDiTab}
            canAccessCorrectiveBtTab={ctrl.canAccessCorrectiveBtTab}
            canAccessCorrectiveLiveTab={ctrl.canAccessCorrectiveLiveTab}
            canAccessCorrectiveClotureTab={ctrl.canAccessCorrectiveClotureTab}
            canAccessCorrectiveAnalyticsTab={ctrl.canAccessCorrectiveAnalyticsTab}
            canAccessSortieTab={ctrl.canAccessSortieTab}
            canAccessStockTab={ctrl.canAccessStockTab}
            canAccessMachinesTab={ctrl.canAccessMachinesTab}
            canAccessEntrepotTab={ctrl.canAccessEntrepotTab}
            canAccessZonesTab={ctrl.canAccessZonesTab}
            canAccessUsersTab={ctrl.canAccessUsersTab}
            canAccessSettingsTab={ctrl.canAccessSettingsTab}
            onNavigateToPreventive={onNavigateToPreventive}
            onNavigateToCorrective={onNavigateToCorrective}
            onNavigateToSortie={onNavigateToSortie}
            onNavigateToStock={onNavigateToStock}
            onNavigateToMachines={onNavigateToMachines}
            onNavigateToWarehouse={onNavigateToWarehouse}
            onNavigateToZones={onNavigateToZones}
            onNavigateToUsers={onNavigateToUsers}
            onNavigateToSettings={onNavigateToSettings}
          />

          <DashboardWatchlistAndFeed
            t={ctrl.t}
            alertAndRuptureItems={ctrl.alertAndRuptureItems}
            isWatchlistReady={ctrl.isWatchlistReady}
            mouvements={ctrl.mouvements}
            stockItems={ctrl.stockItems}
            isReadOnlyUser={ctrl.isReadOnlyUser}
            canCreateMovement={ctrl.canCreateMovement}
            canAccessStockTab={ctrl.canAccessStockTab}
            canAccessSortieTab={ctrl.canAccessSortieTab}
            onNavigateToStock={onNavigateToStock}
            onNavigateToSortie={onNavigateToSortie}
            onOpenOrderForArticle={ctrl.handleOpenOrderForArticle}
            onQuickSortie={onQuickSortie}
          />

          <DashboardLogisticsAndAnalyticsSection
            t={ctrl.t}
            isOperatorRole={ctrl.isOperatorRole}
            isReadOnlyUser={ctrl.isReadOnlyUser}
            canCreateMovement={ctrl.canCreateMovement}
            canEditMovement={ctrl.canEditMovement}
            canDeleteMovement={ctrl.canDeleteMovement}
            canAccessSortieTab={ctrl.canAccessSortieTab}
            canAccessStockTab={ctrl.canAccessStockTab}
            canAccessMachinesTab={ctrl.canAccessMachinesTab}
            allOrders={ctrl.allOrders}
            pendingOrders={ctrl.pendingOrders}
            completedOrders={ctrl.completedOrders}
            displayedOrders={ctrl.displayedOrders}
            orderFilterTab={ctrl.orderFilterTab}
            setOrderFilterTab={ctrl.setOrderFilterTab}
            stockItems={ctrl.stockItems}
            handleOpenNewOrder={ctrl.handleOpenNewOrder}
            handleValidateReception={ctrl.handleValidateReception}
            onDeleteMouvement={onDeleteMouvement}
            pendingExternalRepairs={ctrl.pendingExternalRepairs}
            overdueRepairs={ctrl.overdueRepairs}
            todayStr={ctrl.todayStr}
            onNavigateToSortie={onNavigateToSortie}
            onNavigateToStock={onNavigateToStock}
            onNavigateToMachines={onNavigateToMachines}
            mouvements={ctrl.mouvements}
            actionStats={ctrl.actionStats}
            topConsumedArticles={ctrl.topConsumedArticles}
            machineHealth={ctrl.machineHealth}
          />
        </div>
      )}

      {ctrl.isTechUser && (
        <DashboardTechQuickAccessHub
          canAccessPreventiveTab={ctrl.canAccessPreventiveTab}
          onNavigateToPreventive={onNavigateToPreventive}
          canAccessCorrectiveTab={ctrl.canAccessCorrectiveTab}
          onNavigateToCorrective={onNavigateToCorrective}
          canAccessStockTab={ctrl.canAccessStockTab}
          onNavigateToStock={onNavigateToStock}
          canAccessSortieTab={ctrl.canAccessSortieTab}
          onNavigateToSortie={onNavigateToSortie}
          canAccessMachinesTab={ctrl.canAccessMachinesTab}
          onNavigateToMachines={onNavigateToMachines}
          canAccessGuideTab={ctrl.canAccessGuideTab}
          onNavigateToGuide={onNavigateToGuide}
        />
      )}

      <DashboardPurchaseOrderModal
        open={ctrl.showOrderModal && ctrl.canCreateMovement}
        selectedArticleForOrder={ctrl.selectedArticleForOrder}
        orderForm={ctrl.orderForm}
        setOrderForm={ctrl.setOrderForm}
        stockItems={ctrl.stockItems as OrderStockArticleOption[]}
        activeTechnicians={ctrl.activeTechnicians as OrderActorOption[]}
        activeOperationsChefs={ctrl.activeOperationsChefs as OrderActorOption[]}
        onClose={() => ctrl.setShowOrderModal(false)}
        onSubmit={ctrl.handleSubmitOrder}
      />

      <DashboardFormulasModal
        open={ctrl.showFormulasModal}
        formulaTab={ctrl.formulaTab}
        setFormulaTab={ctrl.setFormulaTab}
        onClose={() => ctrl.setShowFormulasModal(false)}
      />
    </AnimatedPage>
  );
}
