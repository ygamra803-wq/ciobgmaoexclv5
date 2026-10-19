import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { Engine } from '../../components/common/icons/Engine';
import { CubeIcon } from '../../components/common/icons/CubeIcon';
import { SpokeIcon } from '../../components/common/icons/SpokeIcon';
import { useI18n } from '../../../i18n/I18nContext';
import {
  Search,
  ArrowRight,
  Trash2,
  Edit2,
  Warehouse,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RotateCcw,
  X,
  Calculator,
  MoreVertical,
  Tag,
  FileSpreadsheet,
  Boxes,
  FolderTree,
} from 'lucide-react';

export default function CompTemplateView({
  compGroups = [],
  compTemplates = [],
  compFamilies = [],
  warehouseItems = [],
  groupFilter = '',
  setGroupFilter,
  compTemplateGroupFilter = '',
  setCompTemplateGroupFilter,
  compTemplateFamilyFilter = '',
  setCompTemplateFamilyFilter,
  quickCreateFamily,
  setQuickCreateFamily,
  onReturnToFamilies,
  onAddCompTemplate,
  onUpdateCompTemplate,
  onDeleteCompTemplate,
  onNavigateToCompFamilies,
  onNavigateToEntrepotByTemplate,
  _onNavigateToQuickSortie,
  onNavigateToCompGroups,
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [internalGroupFilter, setInternalGroupFilter] = useState('');
  const activeGroupFilter =
    compTemplateGroupFilter !== undefined && setCompTemplateGroupFilter
      ? compTemplateGroupFilter
      : groupFilter !== undefined && setGroupFilter
      ? groupFilter
      : internalGroupFilter;
  const setActiveGroupFilter = setCompTemplateGroupFilter || setGroupFilter || setInternalGroupFilter;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [sortField, setSortField] = useState('id_templates');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form state
  const [form, setForm] = useState({
    id_templates: '',
    libelle: '',
    id_family: '',
  });

  const handleFamilySelect = useCallback(
    (selectedFamily) => {
      if (!selectedFamily) return;
      const cleanFamily = selectedFamily.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const prefix = cleanFamily.startsWith('FAM')
        ? 'TPL-' + cleanFamily.replace('FAM', '')
        : 'TPL-' + cleanFamily;

      let maxIndex = 0;
      compTemplates.forEach((t) => {
        const tFamily = t.id_family || '';
        const tid = String(t.id_templates || '');
        if (
          tFamily.toLowerCase() === selectedFamily.toLowerCase() ||
          tid.toUpperCase().startsWith(prefix)
        ) {
          const match = tid.match(/\d+$/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxIndex) maxIndex = num;
          }
        }
      });

      const nextNumber = maxIndex + 1;
      const generatedCode = `${prefix}-${String(nextNumber).padStart(2, '0')}`;

      setForm((prev) => ({
        ...prev,
        id_family: selectedFamily,
        id_templates: generatedCode,
      }));
    },
    [compTemplates]
  );

  useEffect(() => {
    if (quickCreateFamily) {
      handleFamilySelect(quickCreateFamily);
      setShowAddModal(true);
    }
  }, [quickCreateFamily, handleFamilySelect]);

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    if (quickCreateFamily) {
      if (setQuickCreateFamily) setQuickCreateFamily(null);
      if (onReturnToFamilies) onReturnToFamilies();
    }
  };

  // Scoped families based on active group
  const availableFamilies = useMemo(() => {
    if (!activeGroupFilter || activeGroupFilter === 'ALL') {
      return compFamilies;
    }
    return compFamilies.filter(
      (f) =>
        f.id_groupe === activeGroupFilter ||
        compGroups.find((g) => g.id === activeGroupFilter || g.code === activeGroupFilter)?.code === f.id_groupe
    );
  }, [compFamilies, activeGroupFilter, compGroups]);

  // Filter
  const filtered = useMemo(() => {
    return compTemplates.filter((t) => {
      const q = search.trim().toLowerCase();
      const matchSearch =
        !q ||
        t.id_templates?.toLowerCase().includes(q) ||
        t.libelle?.toLowerCase().includes(q) ||
        t.id_family?.toLowerCase().includes(q);

      const matchFamily = !compTemplateFamilyFilter || t.id_family === compTemplateFamilyFilter;

      const familyObj = compFamilies.find((f) => f.id_family === t.id_family);
      const matchGroup =
        !activeGroupFilter ||
        activeGroupFilter === 'ALL' ||
        familyObj?.id_groupe === activeGroupFilter ||
        compGroups.find((g) => (g.id === activeGroupFilter || g.code === activeGroupFilter))?.code === familyObj?.id_groupe ||
        compGroups.find((g) => (g.id === activeGroupFilter || g.code === activeGroupFilter))?.id_groupe === familyObj?.id_groupe;

      return matchSearch && matchFamily && matchGroup;
    });
  }, [compTemplates, search, compTemplateFamilyFilter, activeGroupFilter, compFamilies, compGroups]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortOrder]);

  const totalItems = sortedData.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedData =
    pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize);
  const displayedData = useMemo(() => {
    const minRows = 19;
    if (rawDisplayedData.length >= minRows) return rawDisplayedData;
    const padded = [...rawDisplayedData];
    for (let i = 0; i < minRows - rawDisplayedData.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, id_templates: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedData]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-teal-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-teal-700 shrink-0 font-bold" />
    );
  };

  const getSortFieldLabel = (field) => {
    switch (field) {
      case 'id_templates':
        return t('components.template.col_id', 'Code Template');
      case 'groupe':
        return t('components.template.col_group', 'Groupe');
      case 'libelle':
        return t('components.template.col_libelle', 'Libellé / Modèle');
      case 'id_family':
        return t('components.template.col_family', 'Famille');
      case 'warehouse_count':
        return t('components.template.col_warehouse', 'Entrepôt');
      default:
        return field?.toUpperCase() || '';
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.id_templates || !form.libelle || !form.id_family) return;
    onAddCompTemplate({
      ...form,
      id_templates: form.id_templates.trim().toUpperCase(),
    });
    setForm({ id_templates: '', libelle: '', id_family: '' });
    setShowAddModal(false);
  };

  const handleExportExcel = () => {
    const headers = ['ID Désignation', 'Libellé Désignation', 'Type Parent', 'Nb Articles Entrepôt'];
    const rows = filtered.map((t) => [
      t.id_templates || '',
      t.libelle || '',
      t.id_family || '',
      warehouseItems.filter((i) => i.id_templates === t.id_templates).length,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `designations_composants_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const templateColumns = useMemo(
    () => [
      {
        key: 'id_templates',
        label: t('components.template.col_id', 'ID DÉSIGNATION'),
        colLetter: 'A',
        icon: Tag,
        sortable: true,
        render: (item) => {
          const templateId = item.id_templates || item.id_template || item.id_comp_template || '';
          return (
            <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold text-xs">
              {templateId}
            </span>
          );
        },
      },
      {
        key: 'groupe',
        label: t('components.template.col_group', 'GROUPE (NIV 1)'),
        colLetter: '',
        icon: Boxes,
        render: (item) => {
          const fam = compFamilies.find((f) => f.id_family === item.id_family);
          return fam?.id_groupe ? (
            <button
              type="button"
              onClick={() => {
                setActiveGroupFilter(fam.id_groupe);
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition cursor-pointer shadow-2xs"
              title={`Filtrer sur le groupe ${fam.id_groupe}`}
            >
              <Boxes className="w-3 h-3 text-indigo-600 shrink-0" />
              <span>{fam.id_groupe}</span>
            </button>
          ) : (
            <span className="text-slate-400 font-mono text-xs italic">—</span>
          );
        },
      },
      {
        key: 'libelle',
        label: t('components.template.col_libelle', 'MODÈLE / LIBELLÉ'),
        colLetter: 'B',
        icon: CubeIcon,
        sortable: true,
        render: (item) => (
          <span className="font-semibold text-slate-800 text-[13px]">
            {item.libelle}
          </span>
        ),
      },
      {
        key: 'id_family',
        label: t('components.template.col_family', 'FAMILLE (NIV 2)'),
        colLetter: 'C',
        icon: SpokeIcon,
        sortable: true,
        render: (item) => {
          const fam = compFamilies.find((f) => f.id_family === item.id_family);
          return (
            <button
              type="button"
              onClick={() =>
                onNavigateToCompFamilies && onNavigateToCompFamilies(item.id_family)
              }
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold transition cursor-pointer"
              title={t('components.template.view_type_title', 'Voir le type de composants')}
            >
              <Engine className="w-3 h-3 text-teal-600 animate-pulse-slow" />
              <span className="font-mono">{item.id_family}</span>
              {fam && <span className="text-slate-500 font-normal"> ({fam.libelle})</span>}
            </button>
          );
        },
      },
      {
        key: 'warehouse_count',
        label: t('components.template.col_warehouse', 'COMPOSANTS EN ENTREPÔT'),
        colLetter: 'D',
        icon: Warehouse,
        render: (item) => {
          const templateId = item.id_templates || item.id_template || item.id_comp_template || '';
          const cCount = warehouseItems.filter(
            (w) =>
              (w.nature === 'COMPONENT' || w.nature === 'PARTIE') &&
              (w.id_templates === templateId || w.id_template === templateId)
          ).length;
          return (
            <button
              type="button"
              onClick={() =>
                onNavigateToEntrepotByTemplate &&
                onNavigateToEntrepotByTemplate(templateId, item.id_family)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition group shadow-2xs cursor-pointer"
              title={t('components.template.filter_warehouse_title', 'Filtrer Entrepôt sur cette désignation de composant')}
            >
              <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
              <span>{cCount} {t('components.template.component_unit', 'composants')}</span>
              <ArrowRight className="w-3 h-3 text-emerald-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'actions',
        label: '•••',
        colLetter: '',
        align: 'center',
        render: (item) => {
          const templateId = item.id_templates || item.id_template || item.id_comp_template || '';
          return (
            <div className="relative inline-flex items-center justify-center action-menu-container">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToEntrepotByTemplate) {
                      onNavigateToEntrepotByTemplate(templateId, item.id_family);
                    }
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                  title="Filtrer l'entrepôt sur cette désignation de composant"
                >
                  <Warehouse className="w-3.5 h-3.5 text-slate-900" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionMenuId(activeActionMenuId === templateId ? null : templateId);
                  }}
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === templateId
                      ? 'bg-slate-100 text-teal-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Actions et options"
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeActionMenuId === templateId && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Actions Désignation Composant
                    </div>
                    <div className="font-mono font-bold text-xs text-slate-800 truncate mt-0.5">
                      {templateId}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        if (onNavigateToEntrepotByTemplate) {
                          onNavigateToEntrepotByTemplate(templateId, item.id_family);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-teal-700 hover:bg-teal-50 flex items-center gap-2 transition cursor-pointer group"
                    >
                      <Warehouse className="w-3.5 h-3.5 text-teal-600 group-hover:scale-110 transition-transform" />
                      <span>Filtrer l'Entrepôt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setToEdit({ ...item });
                        setForm({
                          id_templates: item.id_templates || '',
                          libelle: item.libelle || '',
                          id_family: item.id_family || '',
                        });
                        setShowAddModal(true);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 transition cursor-pointer group"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                      <span>Modifier la Désignation</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setToDelete(item);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer group"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
                      <span>Supprimer du Référentiel</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [compFamilies, warehouseItems, activeActionMenuId, onNavigateToEntrepotByTemplate, onNavigateToCompFamilies]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-purple-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-purple-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-200/90 shadow-[0_4px_12px_rgba(168,85,247,0.12)] flex items-center justify-center text-purple-700 group-hover/header:scale-105 group-hover/header:border-purple-400/80 transition-all duration-300 shrink-0">
            <CubeIcon className="w-6 h-6 text-purple-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {t('components.template.title', "Désignations de Composants d'Entrepôt")}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('components.template.subtitle', 'Modèles et spécifications standardisés des sous-systèmes stockés en entrepôt rattachés aux Types de Composants.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('components.template.formulas_button', 'Formules Excel (Désignations Composants)')}
          />

          <Action3DButton
            variant="circle"
            color="purple"
            icon={CubeIcon}
            showAddBadge={true}
            onClick={() => {
              const nextIdx = compTemplates.length + 1;
              setForm({
                id_templates: `TPL-CMP${String(nextIdx).padStart(2, '0')}`,
                libelle: '',
                id_family: compFamilies[0]?.id_family || '',
              });
              setShowAddModal(true);
            }}
            title={t('components.template.add_button', 'Nouvelle Désignation')}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('components.template.filter_title', 'Filtres & Recherche Avancée')}
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  {filtered.length} / {compTemplates.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('components.template.filter_subtitle', 'Référentiel des Modèles & Désignations de Composants Entrepôt • Colonnes A → E')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title={t('common.export_excel_title', 'Exporter le tableau vers Excel / CSV')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('components.template.export_excel', 'Export Excel')}</span>
            </button>

            {/* Circular Reset Button */}
            {(search || (activeGroupFilter && activeGroupFilter !== 'ALL') || compTemplateFamilyFilter || sortField !== 'id_templates' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setSearch('');
                  setActiveGroupFilter('');
                  setCompTemplateFamilyFilter && setCompTemplateFamilyFilter('');
                  setSortField('id_templates');
                  setSortOrder('asc');
                }}
                title={t('components.template.reset_filters', 'Réinitialiser tous les filtres actifs')}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Group / Family Filter Notification Banner */}
        {((activeGroupFilter && activeGroupFilter !== 'ALL') || compTemplateFamilyFilter) && (
          <div className="flex items-center justify-between px-4 py-2.5 bg-indigo-50/90 border border-indigo-200/90 rounded-2xl text-xs text-indigo-900 animate-in fade-in shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                <Boxes className="w-3.5 h-3.5" />
              </span>
              <span>
                {t('common.filtered_display', 'Affichage filtré :')}
                {activeGroupFilter && activeGroupFilter !== 'ALL' && (
                  <> Groupe <strong className="font-mono font-bold text-indigo-950 px-1.5 py-0.5 rounded bg-white border border-indigo-200 mx-1">{activeGroupFilter}</strong></>
                )}
                {compTemplateFamilyFilter && (
                  <> • Famille <strong className="font-mono font-bold text-indigo-950 px-1.5 py-0.5 rounded bg-white border border-indigo-200 mx-1">{compTemplateFamilyFilter}</strong></>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {onNavigateToCompGroups && (
                <button
                  onClick={() => onNavigateToCompGroups()}
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:bg-white/80 rounded-lg transition cursor-pointer flex items-center gap-1 border border-indigo-200/60"
                >
                  <FolderTree className="w-3 h-3" />
                  <span>{t('components.template.all_groups', 'Tous les Groupes')}</span>
                </button>
              )}
              <button
                onClick={() => {
                  setActiveGroupFilter('');
                  setCompTemplateFamilyFilter && setCompTemplateFamilyFilter('');
                }}
                className="p-1 hover:bg-indigo-200/60 text-indigo-600 hover:text-indigo-900 rounded-full transition cursor-pointer"
                title={t('common.remove_filters', 'Supprimer les filtres de hiérarchie')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Search */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('components.template.search_label', 'RECHERCHE LIBRE')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('components.template.search_fields', 'Col. A + B')}
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('components.template.search_placeholder', 'Rechercher désignation, modèle...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Groupe Parent (Niv 1) CustomSelect */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('components.template.group_label', 'GROUPE COMPOSANT (NIV 1)')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs">
                {t('components.template.level1_badge', 'Niveau 1')}
              </span>
            </div>
            <CustomSelect
              value={activeGroupFilter || 'ALL'}
              onChange={(val) => {
                setActiveGroupFilter(val === 'ALL' ? '' : val);
                if (compTemplateFamilyFilter && val !== 'ALL') {
                  const currFam = compFamilies.find((f) => f.id_family === compTemplateFamilyFilter);
                  if (currFam && currFam.id_groupe !== val) {
                    setCompTemplateFamilyFilter && setCompTemplateFamilyFilter('');
                  }
                }
              }}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
                  <Boxes className="w-3 h-3" />
                </span>
              }
              options={[
                {
                  value: 'ALL',
                  label: `${t('components.template.group_select_all', 'Tous les Groupes')} (${compGroups.length})`,
                  badge: `${compTemplates.length}`,
                  badgeColor: 'bg-slate-100 text-slate-700 font-bold',
                },
                ...compGroups.map((g, gIdx) => {
                  const grpCode = g.code || g.id || `grp-${gIdx}`;
                  const famCount = compFamilies.filter((f) => f.id_groupe === grpCode || f.id_groupe === g.id).length;
                  return {
                    value: grpCode,
                    label: `${grpCode} - ${g.name || g.libelle}`,
                    badge: `${famCount} fam`,
                    badgeColor: 'bg-indigo-50 text-indigo-800 font-bold',
                  };
                }),
              ]}
            />
          </div>

          {/* Family CustomSelect (Niv 2) */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('components.template.family_label', 'FAMILLE COMPOSANT (NIV 2)')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. C
              </span>
            </div>
            <CustomSelect
              value={compTemplateFamilyFilter || 'ALL'}
              onChange={(val) =>
                setCompTemplateFamilyFilter && setCompTemplateFamilyFilter(val === 'ALL' ? '' : val)
              }
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <SpokeIcon className="w-3 h-3" />
                </span>
              }
              options={[
                {
                  value: 'ALL',
                  label: `${t('components.template.family_select_all', 'Toutes les familles')} (${availableFamilies.length})`,
                  badge: `${compTemplates.length}`,
                  badgeColor: 'bg-slate-100 text-slate-700 font-bold',
                },
                ...availableFamilies.map((f, fIdx) => {
                  const count = compTemplates.filter((t) => t.id_family === f.id_family).length;
                  return {
                    value: f.id_family || `fam-${fIdx}`,
                    label: `${f.id_family || ''} - ${f.libelle || ''}`,
                    badge: `${count}`,
                    badgeColor: 'bg-amber-50 text-amber-800 font-bold',
                  };
                }),
              ]}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('components.template.sort_label', 'TRI DES ENREGISTREMENTS')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {sortOrder === 'asc' ? t('common.filters.order_asc', 'Ordre A-Z') : t('common.filters.order_desc', 'Ordre Z-A')}
              </span>
            </div>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'id_templates' || sortOrder !== 'asc'
                  ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span>
                  {t('common.filters.sort_prefix', 'Tri :')} <b className="font-semibold text-slate-900">{getSortFieldLabel(sortField)}</b> ({sortOrder === 'asc' ? t('common.filters.order_asc_short', 'A→Z') : t('common.filters.order_desc_short', 'Z→A')})
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showSortMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showSortMenu && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-purple-600" />
                    {t('common.filters.sort_by', 'Trier par')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <button
                    onClick={() => {
                      if (sortField === 'id_templates') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('id_templates');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_templates'
                        ? 'bg-purple-50 text-purple-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('components.template.sort_id', 'ID Désignation (A)')}</span>
                    {sortField === 'id_templates' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'libelle') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('libelle');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'libelle'
                        ? 'bg-purple-50 text-purple-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('components.template.sort_libelle', 'Libellé / Modèle (B)')}</span>
                    {sortField === 'libelle' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => {
                      if (sortField === 'id_family') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('id_family');
                        setSortOrder('asc');
                      }
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_family'
                        ? 'bg-purple-50 text-purple-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('components.template.sort_family', 'Type de Composant (C)')}</span>
                    {sortField === 'id_family' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      ))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {(search || (activeGroupFilter && activeGroupFilter !== 'ALL') || compTemplateFamilyFilter) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('common.filters.active_filters', 'Filtres actifs :')}</span>
            {activeGroupFilter && activeGroupFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                <Boxes className="w-3 h-3 text-indigo-600" />
                {t('common.group', 'Groupe')} : {activeGroupFilter}
                <button
                  onClick={() => setActiveGroupFilter('')}
                  className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {compTemplateFamilyFilter && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-xs font-semibold">
                <Tag className="w-3 h-3 text-purple-600" />
                {t('common.family', 'Famille')} : {compTemplateFamilyFilter}
                <button
                  onClick={() => setCompTemplateFamilyFilter && setCompTemplateFamilyFilter('')}
                  className="hover:bg-purple-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Search className="w-3 h-3 text-amber-600" />
                {t('common.filters.search_prefix', 'Recherche :')} &quot;{search}&quot;
                <button
                  onClick={() => setSearch('')}
                  className="hover:bg-amber-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title={t('components.template.grid_title', 'Tableau Désignations de Composants (Entrepôt)')}
        icon={<CubeIcon className="w-4 h-4 text-teal-600" />}
        excelMapping="id_templates (A) | groupe | libelle (B) | id_family (C) | warehouse_items (D)"
        bannerColor="slate"
        columns={templateColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<CubeIcon className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('components.template.empty', 'Aucune désignation de composant trouvée')}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'teal',
          itemLabel: t('components.template.item_label', 'désignations'),
        }}
      />

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('components.template.add_title', 'Nouveau Template de Composant')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('components.template.add_desc', 'Modèle et gabarit technique de composant rattaché à une famille.')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('components.template.code_label', 'Code Template (ex: TPL-MOT-01) *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.id_templates}
                  onChange={(e) => setForm({ ...form, id_templates: e.target.value })}
                  placeholder="ex: TPL-MOT380, TPL-POMVAC"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('components.template.libelle_label', 'Libellé / Désignation du Modèle *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  placeholder={t('components.template.libelle_placeholder', 'ex: Moteur Asynchrone 380V Triphasé 5.5kW')}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('components.template.family_select_label', 'Famille Parente (Niveau 2) *')}
                </label>
                <select
                  required
                  value={form.id_family}
                  onChange={(e) => {
                    const selected = e.target.value;
                    setForm((prev) => ({ ...prev, id_family: selected }));
                    handleFamilySelect(selected);
                  }}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  <option value="">{t('components.template.no_parent_family', '-- Sélectionner une Famille --')}</option>
                  {compFamilies.map((f) => (
                    <option key={f.id_family} value={f.id_family}>
                      {f.id_family} - {f.libelle} {f.id_groupe ? `(${f.id_groupe})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  {t('common.save', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {toEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('components.template.edit_title', 'Modifier le Template de Composant')}
            </h3>
            <p className="text-xs font-mono text-teal-700 mb-4">{toEdit.id_templates}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateCompTemplate(toEdit.id_templates, toEdit);
                setToEdit(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('components.template.libelle_label', 'Libellé / Désignation du Modèle *')}
                </label>
                <input
                  type="text"
                  required
                  value={toEdit.libelle || ''}
                  onChange={(e) => setToEdit({ ...toEdit, libelle: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('components.template.family_select_label', 'Famille Parente (Niveau 2) *')}
                </label>
                <select
                  required
                  value={toEdit.id_family || ''}
                  onChange={(e) => setToEdit({ ...toEdit, id_family: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {compFamilies.map((f) => (
                    <option key={f.id_family} value={f.id_family}>
                      {f.id_family} - {f.libelle} {f.id_groupe ? `(${f.id_groupe})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setToEdit(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 rounded-xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  {t('common.save', 'Mettre à jour')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {toDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('components.template.delete_title', 'Supprimer ce template de composant ?')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('components.template.delete_confirm', 'Confirmez-vous la suppression de {{name}} ?', { name: `${toDelete.id_templates} (${toDelete.libelle})` })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                onClick={() => {
                  onDeleteCompTemplate(toDelete.id_templates);
                  setToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                {t('common.delete', 'Supprimer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Formulas Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{t('components.template.formulas_title', 'Formules Excel — Templates Composants')}</h3>
                  <p className="text-xs text-slate-500">{t('components.template.formulas_subtitle', "Formules miroir de l'onglet Templates Composants (GMAO)")}</p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule C — Liaison Type Parent</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">LIAISON</span>
                </div>
                <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100">
                  =[@id_family] (Clé étrangère vers Comp_Families)
                </div>
                <p className="text-[11px] text-slate-500">Rattache la désignation de composant à son type parent.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule D — Articles Entrepôt Associés</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">COUNTIF</span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =COUNTIF(Warehouse_Items!D:D, [@id_templates])
                </div>
                <p className="text-[11px] text-slate-500">Compte les éléments d'entrepôt configurés avec cette désignation.</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Modèle GMAO_Light_Template_V2</span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                {t('common.close', 'Fermer')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
