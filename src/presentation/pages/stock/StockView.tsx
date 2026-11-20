import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  ClipboardCheck,
  Inbox,
  MapPin,
  Package,
  Radio,
  RotateCcw,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import AnimatedPage from '../../components/common/AnimatedPage';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import QuickMovementModal from '../warehouse/QuickMovementModal';
import EditArticleModal from './EditArticleModal';
import StockKPIBar from './components/StockKPIBar';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import StockReplenishmentModal from './components/StockReplenishmentModal';
import PdrGroupsModal from './components/PdrGroupsModal';
import PdrCatalogExcelModal from './components/PdrCatalogExcelModal';
import StockLotCumpModal from './components/StockLotCumpModal';
import StockFormulasModal from './components/StockFormulasModal';
import { StockAlertBanners } from './components/StockAlertBanners';
import { StockCockpitBar } from './components/StockCockpitBar';
import { StockFilterPanel } from './components/StockFilterPanel';
import { StockDataGridRow } from './components/StockDataGridRow';
import { useStockViewController, type StockViewProps } from './hooks/useStockViewController';
import type { IStockItem, StockType } from '../../../types/domain';

export type { StockViewProps };

export default function StockView(props: StockViewProps) {
  const {
    setStockSearch = () => {},
    stockTypeFilter = 'ALL',
    setStockTypeFilter = () => {},
    stockAlertOnly = false,
    setStockAlertOnly = () => {},
    types = [],
    zones = [],
    machines = [],
    technicians = [],
    operations = [],
    mouvements = [],
    onOpenAddArticle = () => {},
    onAddMouvement = () => {},
    onUpdateArticle = () => {},
    onDirectAdjustStock = () => {},
    stockKPIs = { total: 0, alertes: 0, ruptures: 0, ok: 0, totalSorties: 0, totalEntrees: 0 },
    onNavigateToPdrGroups,
  } = props;

  const ctrl = useStockViewController(props);
  const {
    t,
    stockItems,
    effectivePdrGroups,
    effectiveSetPdrGroups,
    availableTypes,
    reservedSummary,
    getReservedEntry,
    reorderAlerts,
    emplacements,
    stockGroupFilter,
    setStockGroupFilter,
    stockEmplacementFilter,
    setStockEmplacementFilter,
    stockCriticiteFilter,
    setStockCriticiteFilter,
    stockDomaineFilter,
    setStockDomaineFilter,
    localSearch,
    setLocalSearch,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    sortField,
    sortOrder,
    showSortMenu,
    setShowSortMenu,
    sortMenuRef,
    activeKpiFilter,
    setActiveKpiFilter,
    activeActionMenuRef,
    setActiveActionMenuRef,
    showGroupsModal,
    setShowGroupsModal,
    showPdrExcelModal,
    setShowPdrExcelModal,
    showReorderPanel,
    setShowReorderPanel,
    showReplenishmentModal,
    setShowReplenishmentModal,
    replenishmentInitialTab,
    openReplenishmentModal,
    showLotCumpModal,
    setShowLotCumpModal,
    showFormulasModal,
    setShowFormulasModal,
    cockpitMetrics,
    handleNavigateToSortieValidation,
    isInventoryMode,
    inventoryCounts,
    inventoryReason,
    setInventoryReason,
    inventorySummary,
    handleToggleInventoryMode,
    handleChangeInventoryCount,
    handleCommitBatchInventory,
    quickModalState,
    setQuickModalState,
    editArticleModalState,
    setEditArticleModalState,
    canEditStock,
    canCreateStock,
    canCreateMovement,
    effectiveFiltered,
    displayedStock,
    totalItems,
    startIndex,
    hasActiveFilters,
    clearAllFilters,
    stockFilterPresets,
    activeStockFilterChips,
    handleSort,
    handleExportExcel,
    handleOpenQuickModal,
    handleOpenEditArticle,
    handleRowContextMenu,
  } = ctrl;

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
      );
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
    );
  };

  const stockColumns = useMemo(
    () => [
      { key: 'ref', label: t('stock.fields.ref', 'REF'), colLetter: 'B', icon: Tag, sortable: true },
      {
        key: 'designation',
        label: t('stock.fields.designation', 'DÉSIGNATION'),
        colLetter: 'C',
        icon: Package,
        sortable: true,
        headerClassName: 'min-w-[220px]',
      },
      { key: 'type', label: t('stock.fields.type', 'TYPE'), colLetter: 'D', icon: Boxes, sortable: true },
      {
        key: 'stockInitial',
        label: t('stock.fields.initial', 'INITIAL'),
        colLetter: 'E',
        icon: Inbox,
        sortable: true,
        align: 'right',
      },
      {
        key: 'entrees',
        label: t('stock.fields.entrees', 'ENTRÉES'),
        colLetter: 'F',
        icon: TrendingUp,
        sortable: true,
        align: 'right',
      },
      {
        key: 'sorties',
        label: t('stock.fields.sorties', 'SORTIES'),
        colLetter: 'G',
        icon: TrendingDown,
        sortable: true,
        align: 'right',
      },
      {
        key: 'stockActuel',
        label: t('stock.fields.current', 'ACTUEL'),
        colLetter: 'H',
        icon: CheckCircle2,
        sortable: true,
        align: 'right',
      },
      {
        key: 'seuil',
        label: t('stock.fields.threshold', 'SEUIL'),
        colLetter: 'I',
        icon: AlertTriangle,
        sortable: true,
        align: 'right',
      },
      {
        key: 'alerte',
        label: t('stock.fields.alert', 'ALERTE'),
        colLetter: 'J',
        icon: Radio,
        sortable: true,
        align: 'center',
      },
      {
        key: 'emplacement',
        label: t('stock.fields.emplacement', 'EMPLACEMENT'),
        colLetter: 'K',
        icon: MapPin,
        sortable: true,
      },
      ...(isInventoryMode
        ? [
            {
              key: 'inventoryCounted',
              label: 'QTÉ COMPTÉE',
              icon: ClipboardCheck,
              align: 'right',
              headerClassName: 'bg-indigo-100/80 text-indigo-950 border-l border-indigo-200',
            },
            {
              key: 'inventoryEcart',
              label: 'ÉCART / VALEUR',
              align: 'right',
              headerClassName: 'bg-indigo-100/80 text-indigo-950',
            },
          ]
        : []),
      {
        key: 'actions',
        label: '•••',
        align: 'center',
        headerClassName: 'min-w-[130px] font-bold text-slate-400 tracking-widest select-none',
      },
    ],
    [t, isInventoryMode]
  );

  return (
    <AnimatedPage className="space-y-5">
      {/* Top Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-cyan-500/10 transition-colors duration-500" />
        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={Package} colorClass="text-cyan-700" />
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{t('stock.title_full', 'Stock Actuel & Catalogue Pièces de Rechange (PDR)')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t(
                'stock.banner_desc',
                "Tableau central miroir de Stock_Actuel (Excel B → K). Calcul temps réel : Stock Actuel = Initial (E) + Entrées (F) - Sorties (G) avec menu d'actions et flux directs."
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative flex-wrap">
          {canEditStock && (
            <button
              type="button"
              onClick={handleToggleInventoryMode}
              data-testid="btn-toggle-batch-inventory"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition cursor-pointer shadow-2xs border ${
                isInventoryMode
                  ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300'
                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200'
              }`}
              title="Activer la saisie directe du comptage physique par rayon ou classe ABC"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>{isInventoryMode ? 'Inventaire Actif' : 'Inventaire Physique'}</span>
            </button>
          )}
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('stock.formulas_button', 'Formules Excel (Col. B → K)')}
          />
          <Action3DButton
            variant="circle"
            color="primary"
            icon={Boxes}
            onClick={() => setShowLotCumpModal(true)}
            title="Multi-Emplacements (Bins), Lots & Péremption (FEFO/FIFO) & Valorisation CUMP"
          />
          {canEditStock && (
            <Action3DButton
              variant="circle"
              color="warning"
              icon={ShoppingCart}
              badgeCount={reorderAlerts.totalAlertCount > 0 ? reorderAlerts.totalAlertCount : undefined}
              onClick={() => openReplenishmentModal('BASKET')}
              title="Réapprovisionnement PDR & Commandes Fournisseurs"
            />
          )}
          {canCreateStock && (
            <Action3DButton
              variant="circle"
              color="accent"
              icon={Package}
              showAddBadge={true}
              onClick={onOpenAddArticle}
              title={t('stock.new_article_button', 'Nouvel Article')}
            />
          )}
        </div>
      </div>

      {/* Phase C1: Storekeeper & Owner Live Cockpit */}
      <StockCockpitBar
        metrics={cockpitMetrics}
        activeKpiFilter={activeKpiFilter}
        canEditStock={canEditStock}
        onFilterClasseARuptures={() => {
          setActiveKpiFilter(activeKpiFilter === 'RUPTURE_CLASS_A' ? 'ALL' : 'RUPTURE_CLASS_A');
          setStockAlertOnly(false);
        }}
        onFilterDeadStock90d={() => {
          setActiveKpiFilter(activeKpiFilter === 'DEAD_STOCK_90D' ? 'ALL' : 'DEAD_STOCK_90D');
          setStockAlertOnly(false);
        }}
        onNavigatePendingDemands={handleNavigateToSortieValidation}
        onOpenActivePOs={() => openReplenishmentModal('ORDERS')}
      />

      <StockKPIBar
        stockItems={stockItems}
        stockKPIs={stockKPIs}
        types={types}
        activeKpiFilter={activeKpiFilter}
        setActiveKpiFilter={setActiveKpiFilter}
        stockAlertOnly={stockAlertOnly}
        setStockAlertOnly={setStockAlertOnly}
      />

      <StockAlertBanners
        reservedSummary={reservedSummary}
        reorderAlerts={reorderAlerts}
        activeKpiFilter={activeKpiFilter}
        setActiveKpiFilter={setActiveKpiFilter}
        stockAlertOnly={stockAlertOnly}
        setStockAlertOnly={setStockAlertOnly}
        canEditStock={canEditStock}
        showReorderPanel={showReorderPanel}
        setShowReorderPanel={setShowReorderPanel}
        onOpenReplenishment={() => openReplenishmentModal('BASKET')}
      />

      <StockFilterPanel
        t={t}
        stockItems={stockItems}
        filteredCount={effectiveFiltered.length}
        effectivePdrGroups={effectivePdrGroups}
        types={types}
        availableTypes={availableTypes}
        emplacements={emplacements}
        localSearch={localSearch}
        setLocalSearch={setLocalSearch}
        setStockSearch={setStockSearch}
        stockGroupFilter={stockGroupFilter}
        setStockGroupFilter={setStockGroupFilter}
        stockTypeFilter={stockTypeFilter}
        setStockTypeFilter={setStockTypeFilter}
        activeKpiFilter={activeKpiFilter}
        setActiveKpiFilter={setActiveKpiFilter}
        stockAlertOnly={stockAlertOnly}
        setStockAlertOnly={setStockAlertOnly}
        stockEmplacementFilter={stockEmplacementFilter}
        setStockEmplacementFilter={setStockEmplacementFilter}
        stockCriticiteFilter={stockCriticiteFilter}
        setStockCriticiteFilter={setStockCriticiteFilter}
        stockDomaineFilter={stockDomaineFilter}
        setStockDomaineFilter={setStockDomaineFilter}
        sortField={sortField}
        sortOrder={sortOrder}
        showSortMenu={showSortMenu}
        setShowSortMenu={setShowSortMenu}
        sortMenuRef={sortMenuRef}
        handleSort={handleSort}
        hasActiveFilters={hasActiveFilters}
        clearAllFilters={clearAllFilters}
        handleExportExcel={handleExportExcel}
        stockFilterPresets={stockFilterPresets}
        activeStockFilterChips={activeStockFilterChips}
        canEditStock={canEditStock}
        onOpenPdrExcelModal={() => setShowPdrExcelModal(true)}
        onOpenGroupsModal={() => setShowGroupsModal(true)}
      />

      {/* Phase C2: Batch Physical Inventory Confirmation Bar */}
      {isInventoryMode && canEditStock && (
        <div
          data-testid="batch-inventory-bar"
          className="bg-indigo-50/95 border-2 border-indigo-300 rounded-2xl p-4 shadow-sm space-y-3"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                    Mode J — Inventaire Physique Rapide (Batch)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-white text-indigo-900 border border-indigo-200">
                    {inventorySummary.countedRowsCount} saisi(s) • {inventorySummary.modifiedCount} écart(s)
                  </span>
                  {inventorySummary.modifiedCount > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold border ${
                        inventorySummary.netValueDeltaMad >= 0
                          ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          : 'bg-rose-100 text-rose-900 border-rose-300'
                      }`}
                    >
                      Impact net : {inventorySummary.netValueDeltaMad >= 0 ? '+' : ''}
                      {inventorySummary.netValueDeltaMad.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      DH ({inventorySummary.netUnitsDelta >= 0 ? '+' : ''}
                      {inventorySummary.netUnitsDelta} u.)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-indigo-900/80 mt-0.5">
                  Saisissez directement la <b>Qté Comptée</b> dans la grille (utilisez les filtres Emplacement ou Classe A si besoin). Toutes les régularisations sont enregistrées en mouvements d&apos;inventaire tracés dans <code>AUDIT_EVENTS</code>.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
              <input
                type="text"
                value={inventoryReason}
                onChange={(e) => setInventoryReason(e.target.value)}
                placeholder="Motif de l'inventaire (ex: Comptage Rayon MAG-A1)..."
                data-testid="inv-reason-input"
                className="h-9 px-3 rounded-xl border border-indigo-300 bg-white text-xs font-semibold text-slate-900 min-w-[240px] focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleToggleInventoryMode}
                className="h-9 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Quitter</span>
              </button>
              <button
                type="button"
                disabled={inventorySummary.modifiedCount === 0}
                onClick={handleCommitBatchInventory}
                data-testid="btn-commit-batch-inventory"
                className={`h-9 px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition ${
                  inventorySummary.modifiedCount > 0
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Valider {inventorySummary.modifiedCount} Régularisation(s)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <GmaoIndustrialDataGrid
        title={t('stock.grid_title', 'Tableau Stock_Actuel • Ordre Excel Row 3 : B → K')}
        icon={<Package className="w-4 h-4 text-cyan-600" />}
        excelMapping="N° | Ref (B) | Désignation (C) | Type (D) | Initial (E) | Entrées (F) | Sorties (G) | Actuel (H) | Seuil (I) | Alerte (J) | Emplacement (K)"
        bannerColor="slate"
        minWidth={isInventoryMode ? 'min-w-[1180px]' : 'min-w-[980px]'}
        columns={stockColumns}
        data={displayedStock}
        isLoading={false}
        loadingRowsCount={8}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<Package className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('stock.empty_message', 'Aucun article trouvé')}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 50, 100, 200, 0],
          color: 'cyan',
          itemLabel: t('stock.items_label', 'articles'),
        }}
        renderRow={(item: IStockItem, idx: number) => {
          const rowNum = startIndex + idx + 1;
          const refKey = String(item.ref || '').trim().toUpperCase();
          return (
            <StockDataGridRow
              key={`stock-row-${item.id || item.ref || 'stk'}-${rowNum}`}
              t={t}
              item={item}
              rowNum={rowNum}
              types={types}
              effectivePdrGroups={effectivePdrGroups}
              reservedEntry={getReservedEntry(item.ref)}
              isMenuOpen={activeActionMenuRef === item.ref}
              canCreateMovement={canCreateMovement}
              canEditStock={canEditStock}
              onToggleMenu={setActiveActionMenuRef}
              onContextMenu={handleRowContextMenu}
              onFilterDomaine={setStockDomaineFilter}
              onFilterType={setStockTypeFilter}
              onOpenQuickModal={handleOpenQuickModal}
              onOpenEditArticle={handleOpenEditArticle}
              isInventoryMode={isInventoryMode}
              inventoryCountStr={inventoryCounts[refKey]}
              onChangeInventoryCount={handleChangeInventoryCount}
            />
          );
        }}
      />

      <QuickMovementModal
        isOpen={quickModalState.isOpen}
        onClose={() =>
          setQuickModalState({
            isOpen: false,
            article: null,
            initialFlow: 'Sortie Interne',
            initialAction: 'CORRECTIVE',
          })
        }
        article={quickModalState.article}
        initialFlow={quickModalState.initialFlow}
        initialAction={quickModalState.initialAction}
        zones={zones}
        machines={machines}
        technicians={technicians}
        operations={operations}
        mouvements={mouvements}
        onAddMouvement={onAddMouvement}
        onDirectAdjustStock={onDirectAdjustStock}
      />

      <EditArticleModal
        isOpen={editArticleModalState.isOpen}
        onClose={() => setEditArticleModalState({ isOpen: false, article: null })}
        article={editArticleModalState.article}
        types={types}
        pdrGroups={effectivePdrGroups}
        onUpdateArticle={onUpdateArticle}
        onOpenAddTypeModal={onOpenAddArticle}
      />

      <PdrGroupsModal
        isOpen={showGroupsModal}
        onClose={() => setShowGroupsModal(false)}
        pdrGroups={effectivePdrGroups}
        onSaveGroups={(nextGroups) => effectiveSetPdrGroups(nextGroups)}
        types={types}
        stockItems={stockItems}
        onNavigateToPdrGroups={onNavigateToPdrGroups}
      />

      <PdrCatalogExcelModal
        isOpen={showPdrExcelModal}
        onClose={() => setShowPdrExcelModal(false)}
        pdrGroups={effectivePdrGroups}
        types={types as StockType[]}
        rawStock={stockItems}
        mouvements={mouvements}
        canEditStock={canEditStock}
      />

      <StockFormulasModal isOpen={showFormulasModal} onClose={() => setShowFormulasModal(false)} />

      {showReplenishmentModal && canEditStock && (
        <StockReplenishmentModal
          onClose={() => setShowReplenishmentModal(false)}
          reorderAlerts={reorderAlerts}
          initialTab={replenishmentInitialTab}
          showToast={props.showToast}
        />
      )}

      {showLotCumpModal && (
        <StockLotCumpModal
          stockItems={stockItems}
          mouvements={mouvements}
          onAddMouvement={canCreateStock ? onAddMouvement : undefined}
          onClose={() => setShowLotCumpModal(false)}
        />
      )}
    </AnimatedPage>
  );
}
