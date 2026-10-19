import { useState, useMemo, useEffect } from 'react';
import TablePaginationCard from '../../../components/common/TablePaginationCard';
import GmaoIndustrialDataGrid from '../../../components/common/GmaoIndustrialDataGrid';
import { useI18n } from '../../../../i18n/I18nContext';
import {
  Users,
  LayoutGrid,
  Table,
  Plus,
  MapPin,
  Wrench,
  CheckCircle2,
  FileSpreadsheet,
  User,
  Zap,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react';

export default function EquipeIntervenantsTab({
  filteredIntervenants = [],
  totalIntervenantsCount = 0,
  onAddDemandeWithPreset = () => {},
  setSearchQuery: _setSearchQuery = () => {},
  onAddTechnician,
  onUpdateTechnician,
  onDeleteTechnician,
  zones = [],
  showToast,
}) {
  const { t } = useI18n();
  // View mode state: 'excel' (Tableau) | 'grid' (Cartes)
  const [displayMode, setDisplayMode] = useState('excel');

  // Pagination state: Default 20 rows standard
  const [pageSize, setPageSize] = useState(20); // 20, 50, 100, 200, 'ALL'
  const [currentPage, setCurrentPage] = useState(1);

  // CRUD Modals State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState(null);
  const [techToDelete, setTechToDelete] = useState(null);

  // Form State
  const [formId, setFormId] = useState('');
  const [formNom, setFormNom] = useState('');
  const [formZone, setFormZone] = useState('');
  const [formSpecialite, setFormSpecialite] = useState('');

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredIntervenants.length, pageSize]);

  // Calculate paginated slice
  const totalItems = filteredIntervenants.length;
  const effectivePageSize = pageSize === 0 || pageSize === 'ALL' ? (totalItems || 1) : Number(pageSize);
  const totalPages = pageSize === 0 || pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(totalItems / effectivePageSize));

  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * effectivePageSize;
  const endIndex = pageSize === 0 || pageSize === 'ALL' ? totalItems : Math.min(startIndex + effectivePageSize, totalItems);

  const paginatedIntervenants = useMemo(() => {
    return filteredIntervenants.slice(startIndex, endIndex);
  }, [filteredIntervenants, startIndex, endIndex]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Modal Handlers
  const handleOpenAddModal = () => {
    const nextSeq = String((totalIntervenantsCount || 0) + 1).padStart(2, '0');
    setFormId(`TECH-${nextSeq}`);
    setFormNom('');
    const defaultZone = zones.length > 0 ? (zones[0].id_zone || zones[0].nom || 'AFM') : 'Toutes zones';
    setFormZone(defaultZone);
    setFormSpecialite('Maintenance & Dépannage');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (tech) => {
    setEditingTech(tech);
    setFormId(tech.id_technician || tech.id || '');
    setFormNom(tech.nom || tech.name || '');
    setFormZone(tech.id_zone || tech.zone || 'Toutes zones');
    setFormSpecialite(tech.specialite || 'Maintenance & Dépannage');
  };

  const handleSaveAdd = (e) => {
    e.preventDefault();
    const cleanNom = formNom.trim();
    if (!cleanNom) return;

    const newTechnician = {
      id: formId.trim() || `TECH-${Date.now().toString().slice(-4)}`,
      id_technician: formId.trim() || `TECH-${Date.now().toString().slice(-4)}`,
      nom: cleanNom,
      name: cleanNom,
      id_zone: formZone.trim() || 'Toutes zones',
      zone: formZone.trim() || 'Toutes zones',
      specialite: formSpecialite.trim() || 'Maintenance & Dépannage',
      role: 'Technicien',
      status: 'Habilité',
      created_at: new Date().toISOString(),
    };

    if (typeof onAddTechnician === 'function') {
      onAddTechnician(newTechnician);
      showToast?.(`Technicien "${cleanNom}" ajouté avec succès à l'équipe habilitée !`, 'success');
    }
    setIsAddModalOpen(false);
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingTech) return;
    const cleanNom = formNom.trim();
    if (!cleanNom) return;

    const techId = editingTech.id_technician || editingTech.id;
    const updated = {
      ...editingTech,
      nom: cleanNom,
      name: cleanNom,
      id_zone: formZone.trim() || 'Toutes zones',
      zone: formZone.trim() || 'Toutes zones',
      specialite: formSpecialite.trim() || 'Maintenance & Dépannage',
      role: editingTech.role || 'Technicien',
    };

    if (typeof onUpdateTechnician === 'function') {
      onUpdateTechnician(techId, updated);
      showToast?.(`Fiche de "${cleanNom}" mise à jour avec succès !`, 'success');
    }
    setEditingTech(null);
  };

  const handleConfirmDelete = () => {
    if (!techToDelete) return;
    const techId = techToDelete.id_technician || techToDelete.id;
    const techName = techToDelete.nom || techToDelete.name || techId;

    if (typeof onDeleteTechnician === 'function') {
      onDeleteTechnician(techId);
      showToast?.(`Technicien "${techName}" retiré de l'équipe.`, 'info');
    }
    setTechToDelete(null);
  };

  const techColumns = useMemo(
    () => [
      {
        key: 'id_technician',
        label: t('corrective.intervenants.col_id', 'ID TECHNICIEN'),
        colLetter: 'Col A',
        icon: Users,
        align: 'center',
        render: (tech, idx) => {
          const idCode = tech.id_technician || tech.id || `TECH-${String(startIndex + idx + 1).padStart(2, '0')}`;
          return (
            <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-800 font-bold border border-purple-200 text-[10.5px] font-mono whitespace-nowrap">
              {idCode}
            </span>
          );
        },
      },
      {
        key: 'nom',
        label: t('corrective.intervenants.col_nom', 'NOM & PRÉNOM DU TECHNICIEN'),
        colLetter: 'Col B',
        icon: User,
        render: (tech) => {
          const name = tech.nom || tech.name || 'Technicien';
          return (
            <div className="flex items-center gap-2 whitespace-nowrap">
              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 border border-purple-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <span className="font-black text-slate-900 text-xs">{name}</span>
            </div>
          );
        },
      },
      {
        key: 'id_zone',
        label: t('corrective.intervenants.col_zone', 'ZONE / ATELIER'),
        colLetter: 'Col C',
        icon: MapPin,
        render: (tech) => {
          const zone = tech.id_zone || tech.zone || 'Toutes zones';
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-bold text-slate-700 text-xs">{zone}</span>
            </div>
          );
        },
      },
      {
        key: 'specialite',
        label: t('corrective.intervenants.col_specialite', 'SPÉCIALITÉ & COMPÉTENCES'),
        colLetter: 'Col D',
        icon: Wrench,
        render: (tech) => {
          const spec = tech.specialite || 'Maintenance & Dépannage';
          return (
            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-semibold border border-slate-200 text-[11px] whitespace-nowrap">
              {spec}
            </span>
          );
        },
      },
      {
        key: 'total',
        label: t('corrective.intervenants.col_total', 'INTERVENTIONS BT'),
        colLetter: 'Col E',
        icon: FileSpreadsheet,
        align: 'center',
        render: (tech) => {
          const total = tech.total || 0;
          return (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-black bg-indigo-50 text-indigo-900 border border-indigo-200 whitespace-nowrap">
              {total} BT{total > 1 ? 's' : ''}
            </span>
          );
        },
      },
      {
        key: 'statut',
        label: 'STATUT GMAO',
        colLetter: 'Col F',
        icon: CheckCircle2,
        align: 'center',
        render: () => (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Habilité</span>
          </span>
        ),
      },
      {
        key: 'actions',
        label: t('common.actions', 'ACTIONS GMAO'),
        colLetter: 'Col G',
        icon: Zap,
        align: 'center',
        render: (tech) => {
          const name = tech.nom || tech.name || 'Technicien';
          return (
            <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
              <button
                type="button"
                onClick={() => handleOpenEditModal(tech)}
                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer active:scale-95"
                title={t('corrective.intervenants.edit_title', 'Modifier les informations du technicien')}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setTechToDelete(tech)}
                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer active:scale-95"
                title={t('corrective.intervenants.delete_title', 'Supprimer ce technicien de l\'équipe')}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => {
                  if (typeof onAddDemandeWithPreset === 'function') {
                    onAddDemandeWithPreset({
                      intervenant: name,
                    });
                  }
                }}
                className="px-2 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10.5px] transition inline-flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                title="Affecter ce technicien à une nouvelle Demande"
              >
                <Plus className="w-3 h-3" />
                <span>DI</span>
              </button>
            </div>
          );
        },
      },
    ],
    [startIndex, onAddDemandeWithPreset, t]
  );

  return (
    <div className="space-y-4 font-sans select-none">
      {/* 1. Sub-Header Toolbar: Summary on Left & Action Buttons / Mode Switch on Top Right */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Result Counter & Range */}
        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
          <span className="font-bold text-slate-800 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-purple-600" />
            <span>{t('corrective.intervenants.title', 'Équipe Intervenants & Techniciens Habilités')}</span>
          </span>

          <span className="text-slate-300">|</span>

          <span>
            {totalItems > 0 ? (
              t('corrective.intervenants.display_count', 'Affichage de {{start}} à {{end}} sur {{total}} techniciens', {
                start: startIndex + 1,
                end: endIndex,
                total: totalItems,
              })
            ) : (
              t('corrective.intervenants.empty', 'Aucun technicien trouvé')
            )}
          </span>

          {totalItems < totalIntervenantsCount && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {t('components.group.active_filter_with_counts', 'Filtre actif ({{filtered}} / {{total}})', {
                filtered: totalItems,
                total: totalIntervenantsCount,
              })}
            </span>
          )}
        </div>

        {/* Right: New Tech Button + Mode Switch (Grille vs Tableau Excel) */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Nouveau Technicien 3D Button */}
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
            title={t('corrective.intervenants.add_title', 'Ajouter un nouveau technicien')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('corrective.intervenants.add_button', 'Nouveau Technicien')}</span>
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
              <Table className="w-3.5 h-3.5 text-purple-600" />
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
              <LayoutGrid className="w-3.5 h-3.5 text-purple-600" />
              <span>{t('corrective.pannes.view_cards', 'Cartes / Grille')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT DISPLAY: EXCEL SPREADSHEET TABLE MODE */}
      {displayMode === 'excel' && (
        <GmaoIndustrialDataGrid
          title="Tableau Équipe_Intervenants • Ordre Excel Row 3 : A → G"
          icon={<Users className="w-4 h-4 text-purple-600" />}
          excelMapping="N° | ID (A) | Nom (B) | Zone (C) | Spécialité (D) | BTs (E) | Statut (F) | Actions (G)"
          bannerColor="purple"
          columns={techColumns}
          data={paginatedIntervenants}
          startIndex={startIndex}
          showRowNumber={true}
          emptyIcon={<Users className="w-8 h-8 text-slate-300" />}
          emptyMessage="Aucun technicien trouvé pour cette recherche."
          pagination={{
            currentPage: safeCurrentPage,
            setCurrentPage: handlePageChange,
            pageSize,
            setPageSize,
            totalItems,
            pageSizeOptions: [20, 25, 50, 100, 200, 0],
            color: 'purple',
            itemLabel: 'techniciens',
          }}
        />
      )}

      {/* 3. MAIN CONTENT DISPLAY: GRID CARDS MODE */}
      {displayMode === 'grid' && (
        <div className="overflow-y-auto max-h-[65vh] pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start">
            {paginatedIntervenants.map((tech, relativeIdx) => {
              const absoluteIdx = startIndex + relativeIdx;
              const name = tech.nom || tech.name || 'Technicien';
              const idCode = tech.id_technician || tech.id || `TECH-${String(absoluteIdx + 1).padStart(2, '0')}`;
              const total = tech.total || 0;
              const zone = tech.id_zone || tech.zone || 'Toutes zones';
              const spec = tech.specialite || 'Maintenance & Dépannage';

              return (
                <div
                  key={idCode}
                  className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200">
                        {idCode}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Habilité</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-800 border border-purple-300/80 flex items-center justify-center font-black text-sm shadow-2xs">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">{name}</h4>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{zone}</span>
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400">Spécialité :</span>
                        <span className="font-semibold text-slate-800 truncate">{spec}</span>
                      </div>

                      <div className="flex items-center justify-between text-slate-600">
                        <span className="text-[11px] text-slate-400">Total BT Réalisés :</span>
                        <span className="font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
                          {total} interventions
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(tech)}
                        className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer active:scale-95"
                        title="Modifier ce technicien"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setTechToDelete(tech)}
                        className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition cursor-pointer active:scale-95"
                        title="Supprimer ce technicien"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof onAddDemandeWithPreset === 'function') {
                          onAddDemandeWithPreset({
                            intervenant: name,
                          });
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer active:scale-95 shadow-2xs"
                      title="Créer une DI avec ce technicien"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Affecter DI</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. EMPTY STATE */}
      {filteredIntervenants.length === 0 && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-10 text-center text-slate-500 shadow-2xs">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-extrabold text-slate-800">Aucun technicien trouvé pour cette recherche.</p>
          <p className="text-xs text-slate-400 mt-1">Vérifiez les mots-clés saisis.</p>
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
          color="purple"
        />
      )}

      {/* 6. MODAL: NOUVEAU TECHNICIEN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Nouveau Technicien Habilité</h3>
                  <p className="text-[11px] text-slate-400">Ajout au registre central des utilisateurs GMAO</p>
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
                <label className="block font-bold text-slate-700 mb-1">Identifiant Technicien :</label>
                <input
                  type="text"
                  required
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: TECH-06"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom & Prénom :</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Tariq El Amrani"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Zone / Atelier de Rattachement :</label>
                <select
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white"
                >
                  <option value="Toutes zones">Toutes zones d'intervention</option>
                  {zones.map((z) => {
                    const zName = z.id_zone || z.nom || z.code_zone || 'Zone';
                    return (
                      <option key={zName} value={zName}>
                        {zName} {z.nom && z.nom !== zName ? `- ${z.nom}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Spécialité & Compétences :</label>
                <input
                  type="text"
                  value={formSpecialite}
                  onChange={(e) => setFormSpecialite(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Électromécanique & Automatisme"
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
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Enregistrer Technicien</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MODAL: MODIFIER TECHNICIEN */}
      {editingTech && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Modifier le Technicien</h3>
                  <p className="text-[11px] text-slate-400">ID : {formId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTech(null)}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nom & Prénom :</label>
                <input
                  type="text"
                  required
                  value={formNom}
                  onChange={(e) => setFormNom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Zone / Atelier de Rattachement :</label>
                <select
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white"
                >
                  <option value="Toutes zones">Toutes zones d'intervention</option>
                  {zones.map((z) => {
                    const zName = z.id_zone || z.nom || z.code_zone || 'Zone';
                    return (
                      <option key={zName} value={zName}>
                        {zName} {z.nom && z.nom !== zName ? `- ${z.nom}` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Spécialité & Compétences :</label>
                <input
                  type="text"
                  value={formSpecialite}
                  onChange={(e) => setFormSpecialite(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTech(null)}
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

      {/* 8. MODAL: CONFIRMATION SUPPRESSION TECHNICIEN */}
      {techToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Supprimer le technicien ?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Êtes-vous sûr de vouloir retirer <b>{techToDelete.nom || techToDelete.name}</b> ({techToDelete.id_technician || techToDelete.id}) de l'équipe de maintenance ?
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTechToDelete(null)}
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
