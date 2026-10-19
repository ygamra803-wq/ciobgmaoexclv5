import { useState, useMemo, useEffect } from 'react';
import TablePaginationCard from '../../../components/common/TablePaginationCard';
import GmaoIndustrialDataGrid from '../../../components/common/GmaoIndustrialDataGrid';
import { useI18n } from '../../../../i18n/I18nContext';
import {
  Wrench,
  Plus,
  Copy,
  Check,
  LayoutGrid,
  Table,
  ShieldAlert,
  Zap,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';

export default function MatricesActionsTab({
  filteredActionsMatrix = [],
  totalActionsKeysCount = 0,
  copiedIndex = null,
  handleCopyText = () => {},
  formatPanneName = (s) => s,
  onAddDemandeWithPreset = () => {},
  onAddActionForPanne,
  onUpdateActionForPanne,
  onDeleteActionForPanne,
  panneCategories = {},
  showToast,
}) {
  const { t } = useI18n();
  // View mode state: 'excel' (Tableau) | 'grid' (Cartes)
  const [displayMode, setDisplayMode] = useState('excel');

  // Pagination state: Default 20 rows standard
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetPanneForAdd, setTargetPanneForAdd] = useState('');
  const [newActionText, setNewActionText] = useState('');

  const [editingActionItem, setEditingActionItem] = useState(null); // { panneKey, actionIndex, actionText }
  const [actionToDelete, setActionToDelete] = useState(null); // { panneKey, actionIndex, actionText }

  // Extract all available pannes from panneCategories for selection
  const allAvailablePannes = useMemo(() => {
    const list = new Set();
    Object.values(panneCategories || {}).forEach((pannes) => {
      if (Array.isArray(pannes)) {
        pannes.forEach((p) => list.add(p));
      }
    });
    filteredActionsMatrix.forEach(([key]) => list.add(key));
    return Array.from(list).sort();
  }, [panneCategories, filteredActionsMatrix]);

  // Reset to page 1 whenever filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredActionsMatrix.length, pageSize]);

  // Calculate paginated slice
  const totalItems = filteredActionsMatrix.length;
  const effectivePageSize = pageSize === 0 || pageSize === 'ALL' ? (totalItems || 1) : Number(pageSize);
  const totalPages = pageSize === 0 || pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * effectivePageSize;
  const endIndex = pageSize === 0 || pageSize === 'ALL' ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedMatrix = useMemo(() => {
    return filteredActionsMatrix.slice(startIndex, endIndex);
  }, [filteredActionsMatrix, startIndex, endIndex]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Modal Handlers
  const handleOpenAddModal = (defaultPanne = '') => {
    setTargetPanneForAdd(defaultPanne || (allAvailablePannes[0] || ''));
    setNewActionText('');
    setIsAddModalOpen(true);
  };

  const handleSaveAddAction = (e) => {
    e.preventDefault();
    const cleanPanne = targetPanneForAdd.trim();
    const cleanAction = newActionText.trim();
    if (!cleanPanne || !cleanAction) return;

    if (typeof onAddActionForPanne === 'function') {
      onAddActionForPanne(cleanPanne, cleanAction);
      showToast?.(`Action ajoutée à la matrice de "${cleanPanne}" !`, 'success');
    }
    setIsAddModalOpen(false);
    setNewActionText('');
  };

  const handleOpenEditAction = (panneKey, actionIndex, actionText) => {
    setEditingActionItem({ panneKey, actionIndex, actionText });
    setNewActionText(actionText);
  };

  const handleSaveEditAction = (e) => {
    e.preventDefault();
    if (!editingActionItem) return;
    const cleanAction = newActionText.trim();
    if (!cleanAction) return;

    if (typeof onUpdateActionForPanne === 'function') {
      onUpdateActionForPanne(editingActionItem.panneKey, editingActionItem.actionIndex, cleanAction);
      showToast?.('Action corrective mise à jour avec succès !', 'success');
    }
    setEditingActionItem(null);
    setNewActionText('');
  };

  const handleConfirmDeleteAction = () => {
    if (!actionToDelete) return;
    if (typeof onDeleteActionForPanne === 'function') {
      onDeleteActionForPanne(actionToDelete.panneKey, actionToDelete.actionIndex);
      showToast?.('Action corrective supprimée de la matrice.', 'info');
    }
    setActionToDelete(null);
  };

  const formattedMatrix = useMemo(
    () => filteredActionsMatrix.map(([panneKey, actions], idx) => ({ id: panneKey, panneKey, actions, rawIndex: idx })),
    [filteredActionsMatrix]
  );
  const paginatedFormattedMatrix = useMemo(
    () => formattedMatrix.slice(startIndex, endIndex),
    [formattedMatrix, startIndex, endIndex]
  );

  const matrixColumns = useMemo(
    () => [
      {
        key: 'panneKey',
        label: t('corrective.actions.col_panne', 'ANOMALIE / PANNE CIBLÉE'),
        colLetter: 'Col A',
        icon: ShieldAlert,
        render: (item) => {
          const panneKey = item.panneKey;
          const label = formatPanneName(panneKey);
          return (
            <div className="space-y-0.5 max-w-xs">
              <span className="font-mono font-bold text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 block truncate" title={panneKey}>
                {panneKey}
              </span>
              <span className="text-[11px] font-bold text-slate-700 block truncate" title={label}>
                {label}
              </span>
            </div>
          );
        },
      },
      {
        key: 'actions',
        label: t('corrective.actions.col_action', 'ACTIONS & SOLUTIONS TYPES DÉFINIES'),
        colLetter: 'Col B',
        icon: Wrench,
        render: (item) => {
          const panneKey = item.panneKey;
          const actions = item.actions;
          return actions.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {actions.map((act, actIdx) => (
                <div
                  key={actIdx}
                  className="p-1.5 bg-slate-50 rounded-lg border border-slate-200/60 flex items-start justify-between gap-2 group/act"
                >
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="font-mono text-emerald-600 font-bold text-[10px] shrink-0 mt-0.5">
                      #{actIdx + 1}
                    </span>
                    <span className="text-slate-700 text-xs leading-snug">{act}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover/act:opacity-100 transition">
                    <button
                      type="button"
                      onClick={() => handleCopyText(act, `${panneKey}-${actIdx}`)}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded cursor-pointer"
                      title="Copier"
                    >
                      {copiedIndex === `${panneKey}-${actIdx}` ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditAction(panneKey, actIdx, act)}
                      className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-50 rounded cursor-pointer"
                      title={t('corrective.actions.edit_title', 'Modifier')}
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setActionToDelete({ panneKey, actionIndex: actIdx, actionText: act })}
                      className="p-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
                      title={t('corrective.actions.delete_title', 'Supprimer')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-slate-400 italic text-xs">{t('corrective.actions.empty', 'Aucune action définie')}</span>
          );
        },
      },
      {
        key: 'nb_actions',
        label: t('corrective.actions.item_label', 'NB ACTIONS'),
        colLetter: 'Col C',
        icon: Wrench,
        align: 'center',
        render: (item) => (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-emerald-50 text-emerald-900 border border-emerald-200">
            {item.actions.length}
          </span>
        ),
      },
      {
        key: 'actions_gmao',
        label: t('common.actions', 'ACTIONS GMAO'),
        colLetter: 'Col D',
        icon: Zap,
        align: 'center',
        render: (item) => (
          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <button
              type="button"
              onClick={() => handleOpenAddModal(item.panneKey)}
              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10.5px] border border-emerald-200 transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
              title={t('corrective.actions.add_title', 'Ajouter une action à cette anomalie')}
            >
              <Plus className="w-3 h-3" />
              <span>Action</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (typeof onAddDemandeWithPreset === 'function') {
                  onAddDemandeWithPreset({
                    anomalie: item.panneKey,
                    travail_demande: item.actions[0] || '',
                  });
                }
              }}
              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10.5px] transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
              title={t('corrective.pannes.preset_action', 'Créer une Demande d\'Intervention directe')}
            >
              <Plus className="w-3 h-3" />
              <span>DI</span>
            </button>
          </div>
        ),
      },
    ],
    [copiedIndex, formatPanneName, handleCopyText, onAddDemandeWithPreset, t]
  );

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 1. Sub-Header Toolbar */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Result Counter & Range */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Wrench className="w-4 h-4 text-emerald-600" />
            <span>{t('corrective.actions.title', 'Matrices des Actions Correctives')}</span>
          </span>

          <span className="text-slate-300">|</span>

          <span>
            {totalItems > 0 ? (
              t('corrective.actions.display_count', 'Affichage de {{start}} à {{end}} sur {{total}} matrices', {
                start: startIndex + 1,
                end: endIndex,
                total: totalItems,
              })
            ) : (
              t('corrective.actions.empty', 'Aucune matrice trouvée')
            )}
          </span>

          {totalItems < totalActionsKeysCount && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {t('components.group.active_filter_with_counts', 'Filtre actif ({{filtered}} / {{total}})', {
                filtered: totalItems,
                total: totalActionsKeysCount,
              })}
            </span>
          )}
        </div>

        {/* Right: New Action Button + Mode Switch (Grille vs Tableau Excel) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title={t('corrective.actions.add_title', 'Ajouter une nouvelle action corrective')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('corrective.actions.add_button', 'Nouvelle Action')}</span>
          </button>

          <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setDisplayMode('excel')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                displayMode === 'excel'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={t('corrective.pannes.view_table', 'Vue Tableau')}
            >
              <Table className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('corrective.pannes.view_table', 'Tableau Excel')}</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95 ${
                displayMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={t('corrective.pannes.view_cards', 'Vue Cartes')}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-blue-600" />
              <span>{t('corrective.pannes.view_cards', 'Cartes / Grille')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT DISPLAY: EXCEL SPREADSHEET TABLE MODE */}
      {displayMode === 'excel' && (
        <GmaoIndustrialDataGrid
          title="Tableau Actions_Par_Panne • Ordre Excel Row 3 : Anomalie → Solutions Types → Actions"
          icon={<Wrench className="w-4 h-4 text-emerald-600" />}
          excelMapping="N° | Anomalie / Panne (A) | Actions & Solutions Types d'Atelier (B) | Total (C) | Actions (D)"
          bannerColor="emerald"
          columns={matrixColumns}
          data={paginatedFormattedMatrix}
          startIndex={startIndex}
          showRowNumber={true}
          emptyIcon={<Wrench className="w-8 h-8 text-slate-300" />}
          emptyMessage="Aucune matrice d'actions trouvée."
          pagination={{
            currentPage: safeCurrentPage,
            setCurrentPage: handlePageChange,
            pageSize,
            setPageSize,
            totalItems,
            pageSizeOptions: [20, 25, 50, 100, 200, 0],
            color: 'emerald',
            itemLabel: 'matrices',
          }}
        />
      )}

      {/* 3. GRID / CARDS DISPLAY MODE */}
      {displayMode === 'grid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedMatrix.map(([panneKey, actionsList = []], relativeIdx) => {
              const absoluteIdx = startIndex + relativeIdx;
              const formattedKey = formatPanneName(panneKey);
              const count = Array.isArray(actionsList) ? actionsList.length : 0;

              return (
                <div
                  key={panneKey}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 text-xs truncate group-hover:text-emerald-800 transition-colors">
                          {formattedKey}
                        </h4>
                        <span className="font-mono text-[10px] text-slate-400 block truncate">
                          {panneKey}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                        {count} sol.
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-100">
                      <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center justify-between">
                        <span>Solutions Types :</span>
                        <button
                          type="button"
                          onClick={() => handleOpenAddModal(panneKey)}
                          className="text-[10px] font-bold text-emerald-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Ajouter</span>
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {actionsList.map((action, aIdx) => (
                          <div
                            key={aIdx}
                            className="text-[11px] text-slate-700 bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 flex items-center justify-between gap-1 group/act"
                          >
                            <span className="truncate leading-tight">{action}</span>
                            <div className="flex items-center gap-1 opacity-80 group-hover/act:opacity-100 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditAction(panneKey, aIdx, action)}
                                className="p-0.5 rounded hover:bg-white text-slate-400 hover:text-blue-700 cursor-pointer"
                                title="Modifier"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setActionToDelete({ panneKey, actionIndex: aIdx, actionText: action })}
                                className="p-0.5 rounded hover:bg-white text-slate-400 hover:text-rose-700 cursor-pointer"
                                title="Supprimer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopyText(actionsList.join(' | '), absoluteIdx)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 border border-slate-200"
                    >
                      {copiedIndex === absoluteIdx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof onAddDemandeWithPreset === 'function') {
                          onAddDemandeWithPreset({
                            anomalie: panneKey,
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Créer DI</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. EMPTY STATE */}
      {filteredActionsMatrix.length === 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center text-slate-500 shadow-2xs">
          <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-slate-800">Aucune matrice d'actions trouvée.</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => handleOpenAddModal()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
            >
              + Ajouter une Action Corrective
            </button>
          </div>
        </div>
      )}

      {/* 5. FOOTER PAGINATION BAR (For Grid Mode) */}
      {displayMode === 'grid' && (
        <TablePaginationCard
          currentPage={safeCurrentPage}
          setCurrentPage={handlePageChange}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalItems={totalItems}
          pageSizeOptions={[20, 25, 50, 100, 200, 0]}
          color="emerald"
        />
      )}

      {/* 6. MODAL: AJOUTER UNE ACTION CORRECTIVE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Nouvelle Action Corrective</h3>
                  <p className="text-[11px] text-slate-400">Association solution / anomalie</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAddAction} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Anomalie Cible :</label>
                <select
                  value={targetPanneForAdd}
                  onChange={(e) => setTargetPanneForAdd(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:bg-white"
                >
                  {allAvailablePannes.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Action Corrective Recommandée :</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Ex: Remplacement du fusible 16A et contrôle de l'isolement du bobinage"
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 font-medium leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistrer Action</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: MODIFIER UNE ACTION CORRECTIVE */}
      {editingActionItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Modifier l'Action Corrective</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Panne : {editingActionItem.panneKey}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingActionItem(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditAction} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Action Corrective :</label>
                <textarea
                  required
                  rows={3}
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingActionItem(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistrer Modifications</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. MODAL: CONFIRMATION SUPPRESSION ACTION */}
      {actionToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Supprimer cette solution ?</h3>
              <p className="text-xs text-slate-500 mt-1 line-clamp-3">
                "{actionToDelete.actionText}"
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActionToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAction}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-xs cursor-pointer"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
