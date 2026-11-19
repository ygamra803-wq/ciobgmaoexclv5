import { useCallback } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AnimatedPage from '../../components/common/AnimatedPage';
import QuickMovementModal from './QuickMovementModal';
import TablePaginationCard from '../../components/common/TablePaginationCard';
import ComponentsTable from './components/ComponentsTable';
import PartsTable from './components/PartsTable';
import { EntrepotDeleteModal, EntrepotFormulasModal } from './components/EntrepotModals';
import { EntrepotDetailsModal } from './components/EntrepotDetailsModal';
import { EntrepotFormModals } from './components/EntrepotFormModals';
import { EntrepotHeaderAndKpis } from './components/EntrepotHeaderAndKpis';
import { EntrepotFilterBar } from './components/EntrepotFilterBar';
import {
  useEntrepotController,
  type EntrepotViewProps,
} from './hooks/useEntrepotController';

export default function EntrepotView(props: EntrepotViewProps) {
  const {
    setWhSearch,
    onAddMouvement,
    onNavigateToFamily,
    onNavigateToTemplate,
    onNavigateToPartGroups,
    onNavigateToType,
    onNavigateToPartTypes,
    onNavigateToDiag,
    onNavigateToZone,
    onNavigateToMachine,
  } = props;

  const ctrl = useEntrepotController(props);

  const renderSortIcon = useCallback(
    (field: string) => {
      if (ctrl.sortField !== field) {
        return (
          <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
        );
      }
      return ctrl.sortOrder === 'asc' ? (
        <ArrowUp className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
      ) : (
        <ArrowDown className="w-3 h-3 text-cyan-700 shrink-0 font-bold" />
      );
    },
    [ctrl.sortField, ctrl.sortOrder]
  );

  return (
    <AnimatedPage className="space-y-4">
      <EntrepotHeaderAndKpis
        t={ctrl.t}
        totalWarehouseCount={ctrl.warehouseItems.length}
        activeWarehouseTab={ctrl.activeWarehouseTab}
        onTabSwitch={ctrl.handleTabSwitch}
        canCreateStock={ctrl.canCreateStock}
        onOpenFormulas={() => ctrl.setShowFormulasModal(true)}
        onOpenAddModal={ctrl.handleOpenAddModal}
        kpis={ctrl.kpis}
        activeKpiFilter={ctrl.activeKpiFilter}
        setActiveKpiFilter={ctrl.setActiveKpiFilter}
        currentNatureFilter={ctrl.currentNatureFilter}
        changeNatureFilter={ctrl.changeNatureFilter}
      />

      <EntrepotFilterBar
        t={ctrl.t}
        filteredCount={ctrl.filteredItems.length}
        totalCount={ctrl.warehouseItems.length}
        hasActiveFilters={ctrl.hasActiveFilters}
        onReset={ctrl.clearAllFilters}
        onExportExcel={ctrl.handleExportExcel}
        presets={ctrl.entrepotFilterPresets}
        activeFilters={ctrl.activeEntrepotFilterChips}
        activeWarehouseTab={ctrl.activeWarehouseTab}
        localSearch={ctrl.localSearch}
        setLocalSearch={ctrl.setLocalSearch}
        setWhSearch={setWhSearch}
        currentNatureFilter={ctrl.currentNatureFilter}
        changeNatureFilter={ctrl.changeNatureFilter}
        setActiveKpiFilter={ctrl.setActiveKpiFilter}
        currentPartGroupFilter={ctrl.currentPartGroupFilter}
        changePartGroupFilter={ctrl.changePartGroupFilter}
        effectivePartGroups={ctrl.effectivePartGroups}
        currentTypeFilter={ctrl.currentTypeFilter}
        changeTypeFilter={ctrl.changeTypeFilter}
        types={ctrl.types}
        currentFamilyFilter={ctrl.currentFamilyFilter}
        changeFamilyFilter={ctrl.changeFamilyFilter}
        changeTemplateFilter={ctrl.changeTemplateFilter}
        families={ctrl.families}
        currentRattachementFilter={ctrl.currentRattachementFilter}
        changeRattachementFilter={ctrl.changeRattachementFilter}
        sortMenuRef={ctrl.sortMenuRef}
        showSortMenu={ctrl.showSortMenu}
        setShowSortMenu={ctrl.setShowSortMenu}
        sortField={ctrl.sortField}
        sortOrder={ctrl.sortOrder}
        handleSort={ctrl.handleSort}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={`warehouse-table-${ctrl.activeWarehouseTab}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {ctrl.activeWarehouseTab === 'COMPONENTS' ? (
            <ComponentsTable
              displayedData={ctrl.rawDisplayedData}
              rawLength={ctrl.rawDisplayedData.length}
              isTableReady={ctrl.isTableReady}
              startIndex={ctrl.startIndex}
              sortField={ctrl.sortField}
              sortOrder={ctrl.sortOrder}
              handleSort={ctrl.handleSort}
              renderSortIcon={renderSortIcon}
              families={ctrl.families}
              templates={ctrl.templates}
              zones={ctrl.zones}
              machines={ctrl.machines}
              machineMotorCounts={ctrl.machineMotorCounts}
              activeActionMenuId={ctrl.activeActionMenuId}
              setActiveActionMenuId={ctrl.setActiveActionMenuId}
              handleOpenQuickModal={ctrl.handleOpenQuickModal}
              setSelectedDetails={ctrl.setSelectedDetails}
              handleOpenEditModal={ctrl.handleOpenEditModal}
              setToDelete={ctrl.setToDelete}
              canCreateMovement={ctrl.canCreateMovement}
              canEditStock={ctrl.canEditStock}
              canDeleteStock={ctrl.canDeleteStock}
              onNavigateToFamily={onNavigateToFamily}
              onNavigateToTemplate={onNavigateToTemplate}
              onNavigateToMachine={onNavigateToMachine}
              onNavigateToZone={onNavigateToZone}
              handleOpenAddModal={ctrl.canCreateStock ? ctrl.handleOpenAddModal : undefined}
            />
          ) : (
            <PartsTable
              displayedData={ctrl.rawDisplayedData}
              rawLength={ctrl.rawDisplayedData.length}
              isTableReady={ctrl.isTableReady}
              startIndex={ctrl.startIndex}
              sortField={ctrl.sortField}
              sortOrder={ctrl.sortOrder}
              handleSort={ctrl.handleSort}
              renderSortIcon={renderSortIcon}
              partGroups={ctrl.effectivePartGroups}
              types={ctrl.types}
              diagnostics={ctrl.diagnostics}
              zones={ctrl.zones}
              machines={ctrl.machines}
              activeActionMenuId={ctrl.activeActionMenuId}
              setActiveActionMenuId={ctrl.setActiveActionMenuId}
              handleOpenQuickModal={ctrl.handleOpenQuickModal}
              setSelectedDetails={ctrl.setSelectedDetails}
              handleOpenEditModal={ctrl.handleOpenEditModal}
              setToDelete={ctrl.setToDelete}
              canCreateMovement={ctrl.canCreateMovement}
              canEditStock={ctrl.canEditStock}
              canDeleteStock={ctrl.canDeleteStock}
              onNavigateToPartGroups={onNavigateToPartGroups}
              onNavigateToType={onNavigateToType}
              onNavigateToPartTypes={onNavigateToPartTypes}
              onNavigateToDiag={onNavigateToDiag}
              onNavigateToMachine={onNavigateToMachine}
              onNavigateToZone={onNavigateToZone}
              handleOpenAddModal={ctrl.canCreateStock ? ctrl.handleOpenAddModal : undefined}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <TablePaginationCard
        currentPage={ctrl.currentPage}
        setCurrentPage={ctrl.setCurrentPage}
        pageSize={ctrl.pageSize}
        setPageSize={ctrl.setPageSize}
        totalItems={ctrl.totalItems}
        pageSizeOptions={[25, 50, 100, 200, 0]}
        color={ctrl.activeWarehouseTab === 'COMPONENTS' ? 'blue' : 'indigo'}
        itemLabel={
          ctrl.activeWarehouseTab === 'COMPONENTS'
            ? ctrl.t('entrepot.table.item_label_components')
            : ctrl.t('entrepot.table.item_label_parts')
        }
      />

      <EntrepotFormModals
        showAddModal={ctrl.showAddModal}
        onCloseAddModal={() => ctrl.setShowAddModal(false)}
        addForm={ctrl.addForm}
        setAddForm={ctrl.setAddForm}
        onSubmitAdd={ctrl.handleSubmitAdd}
        onAddNatureSwitch={ctrl.handleAddNatureSwitch}
        onAddFamilyChange={ctrl.handleAddFamilyChange}
        onAddFamilyPrefixChange={ctrl.handleAddFamilyPrefixChange}
        onAddTemplateChange={ctrl.handleAddTemplateChange}
        onAddTypeChange={ctrl.handleAddTypeChange}
        onAddDiagChange={ctrl.handleAddDiagChange}
        onCascadeFamilyPrefixUpdate={ctrl.handleCascadeFamilyPrefixUpdate}
        toEdit={ctrl.toEdit}
        onCloseEditModal={() => ctrl.setToEdit(null)}
        editForm={ctrl.editForm}
        setEditForm={ctrl.setEditForm}
        onSubmitEdit={ctrl.handleSubmitEdit}
        families={ctrl.families}
        templates={ctrl.templates}
        availableAddTemplates={ctrl.availableAddTemplates}
        types={ctrl.types}
        diagnostics={ctrl.diagnostics}
        availableAddDiags={ctrl.availableAddDiags}
        familyComponentCodes={ctrl.familyComponentCodes}
        zones={ctrl.zones}
        machines={ctrl.machines}
        activeTechnicians={ctrl.activeTechnicians}
        t={ctrl.t}
      />

      <EntrepotDeleteModal
        open={Boolean(ctrl.toDelete)}
        onCancel={() => ctrl.setToDelete(null)}
        onConfirm={ctrl.handleConfirmDelete}
        t={ctrl.t}
      />

      <EntrepotDetailsModal
        selectedDetails={ctrl.selectedDetails}
        onClose={() => ctrl.setSelectedDetails(null)}
        t={ctrl.t}
      />

      <QuickMovementModal
        isOpen={ctrl.quickModalState.isOpen}
        onClose={() => ctrl.setQuickModalState((prev) => ({ ...prev, isOpen: false }))}
        article={ctrl.quickModalState.article}
        initialFlow={ctrl.quickModalState.initialFlow}
        initialAction={ctrl.quickModalState.initialAction}
        zones={ctrl.zones}
        machines={ctrl.machines}
        technicians={ctrl.activeTechnicians}
        mouvements={ctrl.mouvements}
        onAddMouvement={onAddMouvement}
      />

      <EntrepotFormulasModal
        open={ctrl.showFormulasModal}
        onClose={() => ctrl.setShowFormulasModal(false)}
        t={ctrl.t}
      />
    </AnimatedPage>
  );
}
