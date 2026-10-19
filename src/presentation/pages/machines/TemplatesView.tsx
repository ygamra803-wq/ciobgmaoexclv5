import {  useState, useRef, useMemo, useEffect  } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { HubIcon } from '../../components/common/icons/HubIcon';
import { CategoryIcon } from '../../components/common/icons/CategoryIcon';
import {
  Plus,
  Search,
  ArrowRight,
  Cpu,
  Trash2,
  Edit2,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  RotateCcw,
  ArrowDown,
  ArrowUp,
  Calculator,
  X,
  MoreVertical,
  FileSpreadsheet,
} from 'lucide-react';
import { BlueprintPlusIcon } from '../../components/common/icons/BlueprintPlusIcon';
import { useI18n } from '../../../i18n/I18nContext';

export default function TemplatesView({
  templates,
  families,
  machines,
  templateFamilyFilter,
  setTemplateFamilyFilter,
  quickCreateTemplateFamily,
  setQuickCreateTemplateFamily,
  onAddTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onOpenAddFamilyModal,
  onNavigateToMachinesByTemplate,
  onNavigateToFamilyFiltered,
  onNavigateToBlueprints,
  onQuickCreateBlueprint,
}) {
  const { t } = useI18n();
  const [localSearch, setLocalSearch] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [form, setForm] = useState({
    id_templates: '',
    libelle: '',
    id_family: families[0]?.id_family || '',
  });
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => {
    if (quickCreateTemplateFamily) {
      setForm((prev) => ({
        ...prev,
        id_family: quickCreateTemplateFamily,
        id_templates: prev.id_templates || `TPL-${String(quickCreateTemplateFamily).toUpperCase()}`,
      }));
      setShowAddModal(true);
    }
  }, [quickCreateTemplateFamily]);

  const filtered = templates.filter((t) => {
    if (templateFamilyFilter !== 'ALL' && t.id_family !== templateFamilyFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(t?.id_templates || '').toLowerCase().includes(q) ||
      String(t?.libelle || '').toLowerCase().includes(q) ||
      String(t?.id_family || '').toLowerCase().includes(q)
    );
  });

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('id_templates');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const sortMenuRef = useRef(null);

  // Active Action Menu Popover
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, templateFamilyFilter, sortField, sortOrder]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition shrink-0" />
      );
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-amber-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-amber-700 shrink-0 font-bold" />
    );
  };

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
    // Standard Excel Twin Table: minRows = 19 (1 header + 19 body rows = 20 total)
    const minRows = 19;
    if (rawDisplayedData.length >= minRows) return rawDisplayedData;
    const padded = [...rawDisplayedData];
    for (let i = 0; i < minRows - rawDisplayedData.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, id_templates: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedData]);

  const templateColumns = useMemo(
    () => [
      {
        key: 'id_templates',
        label: t('machines.template.col_id', 'CODE TEMPLATE (B)'),
        colLetter: 'B',
        icon: CategoryIcon,
        sortable: true,
      },
      {
        key: 'libelle',
        label: t('machines.template.col_libelle', 'LIBELLÉ DU TEMPLATE (C)'),
        colLetter: 'C',
        icon: Cpu,
        sortable: true,
        headerClassName: 'min-w-[200px]',
      },
      {
        key: 'id_family',
        label: t('machines.template.col_family', 'FAMILLE PARENTE (D)'),
        colLetter: 'D',
        icon: HubIcon,
        sortable: true,
        headerClassName: 'min-w-[170px]',
      },
      {
        key: 'nb_machines',
        label: t('machines.template.col_machines', 'NB MACHINES (F)'),
        colLetter: 'E',
        icon: Cpu,
        align: 'center',
      },
      {
        key: 'actions',
        label: '•••',
        align: 'center',
        headerClassName: 'w-24 font-bold text-slate-400 tracking-widest',
      },
    ],
    [t]
  );

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    if (quickCreateTemplateFamily && setQuickCreateTemplateFamily) {
      setQuickCreateTemplateFamily(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.id_templates || !form.libelle || !form.id_family) return;
    onAddTemplate(form);
    setForm({ id_templates: '', libelle: '', id_family: families[0]?.id_family || '' });
    setShowAddModal(false);
    if (quickCreateTemplateFamily && setQuickCreateTemplateFamily) {
      setQuickCreateTemplateFamily(null);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      t('machines.template.col_id', 'ID Template'),
      t('machines.template.col_libelle', 'Désignation'),
      t('machines.template.col_family', 'Famille Parente'),
      t('machines.template.col_blueprints', 'Nb Blueprints'),
      t('machines.template.col_machines', 'Nb Machines'),
    ];
    const rows = filtered.map((t) => [
      t.id_templates || '',
      t.libelle || '',
      t.familyLibelle ? `${t.familyLibelle} (${t.id_family})` : t.id_family || '',
      t.blueprintCount ?? 0,
      t.machineCount ?? 0,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `templates_machines_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-amber-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/90 shadow-[0_4px_12px_rgba(245,158,11,0.12)] flex items-center justify-center text-amber-700 group-hover/header:scale-105 group-hover/header:border-amber-400/80 transition-all duration-300 shrink-0">
            <CategoryIcon className="w-6 h-6 text-amber-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {t('machines.template.title')}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('machines.template.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('machines.template.formulas_button', 'Formules Excel (Templates de Machines)')}
          />

          <Action3DButton
            variant="circle"
            color="amber"
            icon={CategoryIcon}
            showAddBadge={true}
            onClick={() => {
              setForm({ id_templates: '', libelle: '', id_family: families[0]?.id_family || '' });
              setShowAddModal(true);
            }}
            title={t('machines.template.new_template_button', 'Nouveau Template')}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar: Title + Count Badge + Excel Export + Circular Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('common.filters.title')}
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  {filtered.length} / {templates.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('machines.template.filters_subtitle', 'Référentiel des Modèles / Templates de Machines • Colonnes B → E')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title={t('common.filters.export_excel')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('common.filters.export_excel')}</span>
            </button>

            {/* Circular Reset Button */}
            {(localSearch || search || templateFamilyFilter !== 'ALL' || sortField !== 'id_templates' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setLocalSearch('');
                  setSearch('');
                  setTemplateFamilyFilter('ALL');
                  setSortField('id_templates');
                  setSortOrder('asc');
                }}
                title={t('common.filters.reset_tooltip')}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Search */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.filters.search')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. B + C
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('machines.template.search_placeholder')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {localSearch && (
                <button
                  onClick={() => {
                    setLocalSearch('');
                    setSearch('');
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Family Filter Select */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('machines.template.family_select_label')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. D
              </span>
            </div>
            <CustomSelect
              value={templateFamilyFilter}
              onChange={(val) => setTemplateFamilyFilter(val)}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <HubIcon className="w-3 h-3" />
                </span>
              }
              options={[
                {
                  value: 'ALL',
                  label: `${t('machines.blueprint.all_families')} (${families.length})`,
                  badge: `${templates.length}`,
                  badgeColor: 'bg-slate-100 text-slate-700 font-bold',
                },
                ...families.map((f) => {
                  const count = templates.filter((t) => t.id_family === f.id_family).length;
                  return {
                    value: f.id_family,
                    label: `${f.libelle} (${f.id_family})`,
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
                {t('common.filters.sort')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {sortOrder === 'asc' ? 'A→Z' : 'Z→A'}
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
                  {t('common.filters.sort_prefix')} <b className="font-mono text-slate-900">{sortField.toUpperCase()}</b> (
                  {sortOrder === 'asc' ? 'A→Z' : 'Z→A'})
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
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                    Trier par
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
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Modèle ID (B)</span>
                    {sortField === 'id_templates' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
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
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('machines.template.col_libelle')}</span>
                    {sortField === 'libelle' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
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
                        ? 'bg-amber-50 text-amber-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('machines.template.col_family')}</span>
                    {sortField === 'id_family' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      ))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {(search || templateFamilyFilter !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('common.filters.active_filters')}</span>
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Search className="w-3 h-3 text-amber-600" />
                {search}
                <button
                  onClick={() => {
                    setLocalSearch('');
                    setSearch('');
                  }}
                  className="hover:bg-amber-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {templateFamilyFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <SlidersHorizontal className="w-3 h-3 text-amber-600" />
                {templateFamilyFilter}
                <button
                  onClick={() => setTemplateFamilyFilter('ALL')}
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
        title={t('machines.template.grid_title', 'Tableau Templates • Colonnes B → E')}
        icon={<CategoryIcon className="w-4 h-4 text-amber-600" />}
        excelMapping={t('machines.template.excel_mapping', 'id_templates (B) | libelle (C) | id_family (D) | nb_machines (E)')}
        bannerColor="slate"
        columns={templateColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        renderRow={(tItem, idx) => {
          const rowNum = startIndex + idx + 1;
          if (tItem.__isEmptyPlaceholder) {
            return (
              <tr key={`empty-${idx}`} className="border-b border-slate-100 bg-white/40 select-none">
                <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-300 bg-slate-100/40 border-r border-slate-200/80">
                  {rowNum}
                </td>
                <td colSpan={5} className="py-3 px-4 text-center text-slate-300 font-mono text-[11px]">
                  —
                </td>
              </tr>
            );
          }
          const fam = families.find((f) => f.id_family === tItem.id_family);
          const mCount = machines.filter((m) => m.id_templates === tItem.id_templates).length;

          return (
            <tr
              key={tItem.id_templates}
              className="even:bg-slate-50/80 odd:bg-white hover:bg-slate-100/70 border-b border-slate-200/70 transition-colors"
            >
              {/* Row N° Column */}
              <td className="py-3 px-3 text-center font-mono text-[11px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0">
                {rowNum}
              </td>
              <td className="py-3 px-4 font-mono font-bold text-slate-900">
                <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                  {tItem.id_templates}
                </span>
              </td>
              <td className="py-3 px-4 font-semibold text-slate-800 text-[13px]">
                {tItem.libelle}
              </td>
              <td className="py-3 px-4">
                <button
                  onClick={() => onNavigateToFamilyFiltered(tItem.id_family)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-mono font-bold hover:bg-cyan-100 transition cursor-pointer"
                >
                  <HubIcon className="w-3 h-3 text-cyan-600" />
                  <span>{fam?.libelle ? `${fam.libelle} (${tItem.id_family})` : tItem.id_family}</span>
                </button>
              </td>
              <td className="py-3 px-4 text-center">
                <button
                  onClick={() => onNavigateToMachinesByTemplate(tItem.id_family, tItem.id_templates)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 text-xs font-semibold transition group shadow-2xs cursor-pointer"
                >
                  <Cpu className="w-3.5 h-3.5 text-amber-600" />
                  <span>{mCount} {t('machines.template.machine_unit', 'machines')}</span>
                  <ArrowRight className="w-3 h-3 text-amber-600 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </td>
              {/* Actions (•••) */}
              <td className="py-3 px-3.5 text-center whitespace-nowrap">
                <div className="relative inline-flex items-center justify-center action-menu-container">
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                    <button
                      type="button"
                      onClick={() => {
                        if (onQuickCreateBlueprint) {
                          onQuickCreateBlueprint(tItem.id_family, tItem.id_templates);
                        } else if (onNavigateToBlueprints) {
                          onNavigateToBlueprints(tItem.id_family, tItem.id_templates);
                        }
                        setActiveActionMenuId(null);
                      }}
                      className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                    >
                      <BlueprintPlusIcon className="w-3.5 h-3.5 text-slate-900" />
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(activeActionMenuId === tItem.id_templates ? null : tItem.id_templates);
                      }}
                      className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                        activeActionMenuId === tItem.id_templates
                          ? 'bg-slate-100 text-amber-700 font-bold'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {activeActionMenuId === tItem.id_templates && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-1.5 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-0.5">
                      <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          {t('machines.template.title')}
                        </span>
                        <span className="font-mono text-xs font-bold text-amber-700 block truncate">
                          {tItem.id_templates} • {tItem.libelle}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          if (onQuickCreateBlueprint) {
                            onQuickCreateBlueprint(tItem.id_family, tItem.id_templates);
                          } else if (onNavigateToBlueprints) {
                            onNavigateToBlueprints(tItem.id_family, tItem.id_templates);
                          }
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <BlueprintPlusIcon className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{t('machines.blueprint.new_blueprint_button')} ({tItem.id_templates})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          onNavigateToFamilyFiltered(tItem.id_family);
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-cyan-50 hover:text-cyan-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <HubIcon className="w-3.5 h-3.5 text-cyan-600" />
                        <span>{t('machines.template.col_family')} ({tItem.id_family})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          onNavigateToMachinesByTemplate(tItem.id_family, tItem.id_templates);
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-amber-50 hover:text-amber-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <Cpu className="w-3.5 h-3.5 text-amber-600" />
                        <span>{t('machines.template.col_machines')} ({mCount})</span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          setToEdit({ ...tItem });
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                        <span>{t('machines.template.edit_title')}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveActionMenuId(null);
                          setToDelete(tItem);
                        }}
                        className="w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        <span>{t('machines.template.delete_title')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </td>
            </tr>
          );
        }}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'amber',
          itemLabel: t('machines.template.item_label', 'templates'),
        }}
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('machines.template.add_title')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('machines.template.add_desc')}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('machines.template.code_label')}
                </label>
                <input
                  type="text"
                  placeholder="TPL-HYD200"
                  value={form.id_templates}
                  onChange={(e) => setForm({ ...form, id_templates: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono font-bold uppercase"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('machines.template.libelle_label')}
                </label>
                <input
                  type="text"
                  placeholder={t('machines.template.libelle_placeholder')}
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('machines.template.family_select_label')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      onOpenAddFamilyModal();
                    }}
                    className="text-[11px] text-cyan-700 hover:text-cyan-900 font-semibold inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{t('machines.family.new_family_button')}</span>
                  </button>
                </div>
                <CustomSelect
                  value={form.id_family}
                  onChange={(val) => setForm({ ...form, id_family: val })}
                  options={families.map((f) => ({
                    value: f.id_family,
                    label: `${f.libelle} (${f.id_family})`,
                  }))}
                  placeholder="-- Choisir Famille --"
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">{t('machines.template.edit_title')}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateTemplate(toEdit.id_templates, toEdit);
                setToEdit(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t('machines.template.code_label')}</label>
                <input
                  type="text"
                  value={toEdit.id_templates}
                  disabled
                  className="mt-1 w-full h-10 px-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">{t('machines.template.libelle_label')}</label>
                <input
                  type="text"
                  value={toEdit.libelle}
                  onChange={(e) => setToEdit({ ...toEdit, libelle: e.target.value })}
                  required
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">{t('machines.template.family_select_label')}</label>
                <CustomSelect
                  value={toEdit.id_family}
                  onChange={(val) => setToEdit({ ...toEdit, id_family: val })}
                  options={families.map((f) => ({
                    value: f.id_family,
                    label: `${f.libelle} (${f.id_family})`,
                  }))}
                />
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setToEdit(null)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 text-xs font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {toDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
            <div className="flex flex-col items-center text-center">
              <AlertTriangle className="w-8 h-8 text-rose-600 mb-2" />
              <h3 className="font-bold text-lg text-slate-900">{t('machines.template.delete_title')}</h3>
            </div>
            <p className="text-sm text-center text-slate-600">
              {t('machines.template.delete_confirm', { name: toDelete.libelle })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  onDeleteTemplate(toDelete.id_templates);
                  setToDelete(null);
                }}
                className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                {t('common.delete')}
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
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{t('machines.template.formulas_title')}</h3>
                  <p className="text-xs text-slate-500">{t('machines.template.formulas_subtitle')}</p>
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
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule C — Famille Parente</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">LIAISON</span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =[@id_family]
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule D — Nb Machines Total</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">COUNTIF</span>
                </div>
                <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
                  =COUNTIF(Machines!E:E, [@id_templates])
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">Modèle GMAO_Light_Template_V2</span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
