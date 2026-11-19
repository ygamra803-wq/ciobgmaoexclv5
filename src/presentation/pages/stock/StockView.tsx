import { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  Inbox,
  MapPin,
  Package,
  Radio,
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
    showLotCumpModal,
    setShowLotCumpModal,
    showFormulasModal,
    setShowFormulasModal,
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
      {
        key: 'actions',
        label: '•••',
        align: 'center',
        headerClassName: 'min-w-[130px] font-bold text-slate-400 tracking-widest select-none',
      },
    ],
    [t]
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

        <div className="flex items-center gap-2.5 shrink-0 relative">
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
              onClick={() => setShowReplenishmentModal(true)}
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
        onOpenReplenishment={() => setShowReplenishmentModal(true)}
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

      <GmaoIndustrialDataGrid
        title={t('stock.grid_title', 'Tableau Stock_Actuel • Ordre Excel Row 3 : B → K')}
        icon={<Package className="w-4 h-4 text-cyan-600" />}
        excelMapping="N° | Ref (B) | Désignation (C) | Type (D) | Initial (E) | Entrées (F) | Sorties (G) | Actuel (H) | Seuil (I) | Alerte (J) | Emplacement (K)"
        bannerColor="slate"
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
