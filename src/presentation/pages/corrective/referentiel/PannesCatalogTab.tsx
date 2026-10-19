import { useState, useMemo, useEffect } from 'react';
import TablePaginationCard from '../../../components/common/TablePaginationCard';
import GmaoIndustrialDataGrid from '../../../components/common/GmaoIndustrialDataGrid';
import { useI18n } from '../../../../i18n/I18nContext';
import {
  ShieldAlert,
  Plus,
  LayoutGrid,
  Table,
  BookOpen,
  Wrench,
  Radio,
  Zap,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';

export default function PannesCatalogTab({
  filteredPannes = [],
  totalPannesCount: _totalPannesCount = 0,
  selectedCategory = 'ALL',
  CATEGORY_META = {},
  expandedPanne = null,
  setExpandedPanne: _setExpandedPanne = () => {},
  onAddDemandeWithPreset = () => {},
  setSearchQuery = () => {},
  setSelectedCategory = () => {},
  onAddPanne,
  onUpdatePanne,
  onDeletePanne,
  showToast,
}) {
  const { t } = useI18n();
  // View mode state: 'excel' (Tableau) | 'grid' (Cartes)
  const [displayMode, setDisplayMode] = useState('excel');

  // Pagination state: Default 20 rows standard
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // CRUD Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPanne, setEditingPanne] = useState(null);
  const [panneToDelete, setPanneToDelete] = useState(null);

  // Form fields
  const [formCategory, setFormCategory] = useState('E');
  const [formCode, setFormCode] = useState('');

  // Reset to page 1 whenever filter or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredPannes.length, pageSize, selectedCategory]);

  // Calculate paginated slice
  const totalItems = filteredPannes.length;
  const effectivePageSize = pageSize === 0 || pageSize === 'ALL' ? (totalItems || 1) : Number(pageSize);
  const totalPages = pageSize === 0 || pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * effectivePageSize;
  const endIndex = pageSize === 0 || pageSize === 'ALL' ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedPannes = useMemo(() => {
    return filteredPannes.slice(startIndex, endIndex);
  }, [filteredPannes, startIndex, endIndex]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Handlers for Add/Edit/Delete
  const handleOpenAddModal = () => {
    setFormCategory(selectedCategory !== 'ALL' ? selectedCategory : 'E');
    setFormCode('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (panne) => {
    setEditingPanne(panne);
    setFormCategory(panne.category);
    setFormCode(panne.code);
  };

  const handleSaveAdd = (e) => {
    e.preventDefault();
    const cleanCode = formCode.trim().replace(/\s+/g, '_').toUpperCase();
    if (!cleanCode) return;

    if (typeof onAddPanne === 'function') {
      onAddPanne(formCategory, cleanCode);
      showToast?.(`Anomalie "${cleanCode}" ajoutée avec succès au catalogue (${formCategory}) !`, 'success');
    }
    setIsAddModalOpen(false);
    setFormCode('');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingPanne) return;
    const cleanCode = formCode.trim().replace(/\s+/g, '_').toUpperCase();
    if (!cleanCode) return;

    if (typeof onUpdatePanne === 'function') {
      onUpdatePanne(editingPanne.category, editingPanne.code, cleanCode);
      showToast?.(`Anomalie mise à jour en "${cleanCode}" !`, 'success');
    }
    setEditingPanne(null);
    setFormCode('');
  };

  const handleConfirmDelete = () => {
    if (!panneToDelete) return;
    if (typeof onDeletePanne === 'function') {
      onDeletePanne(panneToDelete.category, panneToDelete.code);
      showToast?.(`Anomalie "${panneToDelete.code}" supprimée du catalogue.`, 'info');
    }
    setPanneToDelete(null);
  };

  const categoryKeys = Object.keys(CATEGORY_META).length > 0
    ? Object.keys(CATEGORY_META)
    : ['E', 'M', 'H', 'P', 'E_M', 'E_H', 'E_P', 'M_P', 'M_H', 'AUTRE'];

  const panneColumns = useMemo(
    () => [
      {
        key: 'category',
        label: t('corrective.pannes.col_category', 'CATÉGORIE'),
        colLetter: 'Col A',
        icon: ShieldAlert,
        align: 'center',
        render: (panne) => {
          const meta = CATEGORY_META[panne.category] || {
            label: panne.category,
            color: 'bg-slate-100 text-slate-800 border-slate-300',
          };
          return (
            <span className={`px-2.5 py-0.5 rounded-md text-[10.5px] font-bold border ${meta.color} whitespace-nowrap`}>
              {panne.category} • {t(`corrective.categories.${panne.category}`, meta.label)}
            </span>
          );
        },
      },
      {
        key: 'code',
        label: t('corrective.pannes.col_code', 'CODE ANOMALIE'),
        colLetter: 'Col B',
        icon: Radio,
        align: 'center',
        render: (panne) => (
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-bold border border-slate-200 text-[11px] font-mono whitespace-nowrap">
            {panne.code}
          </span>
        ),
      },
      {
        key: 'name',
        label: t('designations.col_name', 'DÉSIGNATION / LIBELLÉ DE LA PANNE'),
        colLetter: 'Col C',
        icon: BookOpen,
        render: (panne) => (
          <span className="font-black text-slate-900 text-xs">
            {panne.name}
          </span>
        ),
      },
      {
        key: 'actions_types',
        label: t('corrective.pannes.col_actions', 'SOLUTIONS & ACTIONS TYPES'),
        colLetter: 'Col D',
        icon: Wrench,
        render: (panne) => {
          const hasActions = panne.actions && panne.actions.length > 0;
          return hasActions ? (
            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
              {panne.actions.map((act, actIdx) => (
                <div
                  key={actIdx}
                  className="text-[11px] text-slate-700 bg-amber-50/60 p-1 rounded-lg border border-amber-200/50 flex items-start gap-1"
                >
                  <span className="text-amber-700 font-bold">•</span>
                  <span className="leading-tight">{act}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[10.5px] text-slate-400 italic">{t('corrective.actions.empty', 'Aucune action définie')}</span>
          );
        },
      },
      {
        key: 'actions_gmao',
        label: t('common.actions', 'ACTIONS GMAO'),
        colLetter: 'Col E',
        icon: Zap,
        align: 'center',
        render: (panne) => (
          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <button
              type="button"
              onClick={() => {
                if (typeof onAddDemandeWithPreset === 'function') {
                  onAddDemandeWithPreset({
                    type_panne: panne.category,
                    anomalie: panne.code,
                  });
                }
              }}
              className="px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10.5px] transition inline-flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
              title={t('corrective.pannes.preset_action', 'Créer une Demande d\'Intervention directe')}
            >
              <Plus className="w-3 h-3" />
              <span>DI</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenEditModal(panne)}
              className="p-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition cursor-pointer border border-slate-200/80"
              title={t('corrective.pannes.edit_title', 'Modifier le code de l\'anomalie')}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setPanneToDelete(panne)}
              className="p-1 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition cursor-pointer border border-slate-200/80"
              title={t('corrective.pannes.delete_title', 'Supprimer cette anomalie du catalogue')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ),
      },
    ],
    [CATEGORY_META, onAddDemandeWithPreset, t]
  );

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 1. Sub-Header Toolbar: Summary on Left & Action Buttons / Mode Switch on Right */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Result Counter & Category Info */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>{t('corrective.pannes.title', 'Référentiel des Pannes & Anomalies')}</span>
          </span>

          <span className="text-slate-300">|</span>

          <span>
            {totalItems > 0 ? (
              t('corrective.pannes.display_count', 'Affichage de {{start}} à {{end}} sur {{total}} pannes cataloguées', {
                start: startIndex + 1,
                end: endIndex,
                total: totalItems,
              })
            ) : (
              t('corrective.pannes.empty', 'Aucune anomalie trouvée')
            )}
          </span>

          {selectedCategory !== 'ALL' && (
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              {t('corrective.pannes.col_category', 'Catégorie')} : {selectedCategory} ({t(`corrective.categories.${selectedCategory}`, CATEGORY_META[selectedCategory]?.label || selectedCategory)})
            </span>
          )}
        </div>

        {/* Right: New Panne Button + Mode Switch (Grille vs Tableau Excel) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Add Panne Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title={t('corrective.pannes.add_title', "Ajouter une nouvelle anomalie")}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('corrective.pannes.add_button', 'Nouvelle Panne')}</span>
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
              <Table className="w-3.5 h-3.5 text-amber-600" />
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
          title="Tableau Pannes_Cataloguées • Ordre Excel Row 3 : A → E"
          icon={<ShieldAlert className="w-4 h-4 text-amber-600" />}
          excelMapping="N° | Catégorie (A) | Code Anomalie (B) | Désignation / Libellé (C) | Solutions Types (D) | Actions (E)"
          bannerColor="amber"
          columns={panneColumns}
          data={paginatedPannes}
          startIndex={startIndex}
          showRowNumber={true}
          emptyIcon={<ShieldAlert className="w-8 h-8 text-slate-300" />}
          emptyMessage="Aucune anomalie trouvée pour cette recherche."
          pagination={{
            currentPage: safeCurrentPage,
            setCurrentPage: handlePageChange,
            pageSize,
            setPageSize,
            totalItems,
            pageSizeOptions: [20, 25, 50, 100, 200, 0],
            color: 'amber',
            itemLabel: 'pannes',
          }}
        />
      )}

      {/* 3. GRID / CARDS DISPLAY MODE */}
      {displayMode === 'grid' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedPannes.map((panne) => {
              const meta = CATEGORY_META[panne.category] || {
                label: panne.category,
                color: 'bg-slate-100 text-slate-800 border-slate-300',
              };
              const isExpanded = expandedPanne === panne.id;
              const hasActions = panne.actions && panne.actions.length > 0;

              return (
                <div
                  key={panne.id}
                  className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${meta.color}`}>
                        {panne.category} • {t(`corrective.categories.${panne.category}`, meta.label)}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {panne.code}
                      </span>
                    </div>

                    <h4 className="font-black text-slate-900 text-sm leading-snug group-hover:text-amber-800 transition-colors">
                      {panne.name}
                    </h4>

                    {hasActions && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-emerald-600" />
                          <span>Actions Recommandées ({panne.actions.length}) :</span>
                        </div>
                        <ul className="space-y-1">
                          {(isExpanded ? panne.actions : panne.actions.slice(0, 2)).map((act, idx) => (
                            <li
                              key={idx}
                              className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200/50 flex items-start gap-1.5"
                            >
                              <span className="text-amber-600 font-bold">•</span>
                              <span className="leading-tight">{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(panne)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 transition cursor-pointer border border-slate-200/80"
                        title="Modifier l'anomalie"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPanneToDelete(panne)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 transition cursor-pointer border border-slate-200/80"
                        title="Supprimer l'anomalie"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof onAddDemandeWithPreset === 'function') {
                          onAddDemandeWithPreset({
                            type_panne: panne.category,
                            anomalie: panne.code,
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                      title="Créer une Demande d'Intervention directe"
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
      {filteredPannes.length === 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center text-slate-500 shadow-2xs">
          <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-slate-800">Aucune anomalie trouvée pour cette recherche.</p>
          <p className="text-xs text-slate-400 mt-1">Vérifiez les mots-clés ou réinitialisez le filtre de catégorie.</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('ALL');
              }}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
            >
              Réinitialiser les filtres
            </button>
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs active:scale-95"
            >
              + Ajouter une Panne
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
          color="amber"
        />
      )}

      {/* 6. MODAL: AJOUTER UNE PANNE */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Nouvelle Anomalie / Panne</h3>
                  <p className="text-[11px] text-slate-400">Ajout au référentiel des 282+ pannes</p>
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

            <form onSubmit={handleSaveAdd} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Catégorie Technique :</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:bg-white"
                >
                  {categoryKeys.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat} - {t(`corrective.categories.${cat}`, CATEGORY_META[cat]?.label || cat)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Code Anomalie (Identifiant Unique) :</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: COURT_CIRCUIT_MOTEUR"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Les espaces seront automatiquement convertis en tirets bas (_).
                </p>
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
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Ajouter au Référentiel</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: MODIFIER UNE PANNE */}
      {editingPanne && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Modifier l'Anomalie</h3>
                  <p className="text-[11px] text-slate-400">Catégorie : {editingPanne.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPanne(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Code Anomalie :</label>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPanne(null)}
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

      {/* 8. MODAL: CONFIRMATION SUPPRESSION PANNE */}
      {panneToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Supprimer l'anomalie ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir supprimer l'anomalie <b className="font-mono text-slate-800">{panneToDelete.code}</b> ({panneToDelete.category}) ?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPanneToDelete(null)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
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
