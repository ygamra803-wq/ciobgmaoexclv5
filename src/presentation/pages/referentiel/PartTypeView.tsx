import { useState, useRef, useMemo, useEffect } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import PageHeaderIcon from '../../components/common/PageHeaderIcon';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import PartInfoIcon from '../../components/common/icons/PartInfoIcon';
import { LayersIcon } from '../../components/common/icons/LayersIcon';
import { useI18n } from '../../../i18n/I18nContext';
import { usePermission } from '../../components/common/PermissionGate';
import {
  Search,
  Tag,
  ArrowRight,
  Trash2,
  Edit2,
  Warehouse,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  X,
  RotateCcw,
  Calculator,
  MoreVertical,
  FileSpreadsheet,
  Boxes,
} from 'lucide-react';

export default function PartTypeView({
  partGroups = [],
  partTypes = [],
  partDesignations = [],
  warehouseItems = [],
  groupFilter: externalGroupFilter,
  setGroupFilter: setExternalGroupFilter,
  onAddPartType,
  onUpdatePartType,
  onDeletePartType,
  onNavigateToPartGroups,
  onNavigateToPartDesignations,
  onNavigateToEntrepotByType,
}) {
  const { t } = useI18n();
  const canCreateStock = usePermission('stock.create');
  const canEditStock = usePermission('stock.edit');
  const canDeleteStock = usePermission('stock.delete');
  const [search, setSearch] = useState('');
  const [localGroupFilter, setLocalGroupFilter] = useState('ALL');
  const activeGroupFilter = externalGroupFilter !== undefined ? externalGroupFilter : localGroupFilter;
  const setActiveGroupFilter = setExternalGroupFilter || setLocalGroupFilter;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);
  const [sortField, setSortField] = useState('id_type');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const partGroupMap = useMemo(() => {
    const map = new Map();
    (partGroups || []).forEach((g) => {
      if (!g) return;
      const gId = String(g.id || g.id_group || g.id_groupe || '').trim();
      const gCode = String(g.code || '').trim();
      if (gId) map.set(gId, g);
      if (gCode) map.set(gCode, g);
    });
    return map;
  }, [partGroups]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form state
  const [form, setForm] = useState({
    id_type: '',
    id_group: '',
    libelle: '',
  });

  // Filter
  const filtered = useMemo(() => {
    return partTypes.filter((item) => {
      const itemGroupKey = String(item.id_group || item.id_groupe || '').trim();
      const resolvedGrp = itemGroupKey ? partGroupMap.get(itemGroupKey) : null;
      const resolvedGrpId = resolvedGrp
        ? String(resolvedGrp.id || resolvedGrp.id_group || resolvedGrp.id_groupe || '')
        : '';

      if (activeGroupFilter && activeGroupFilter !== 'ALL') {
        if (activeGroupFilter === 'UNASSIGNED') {
          if (resolvedGrpId) return false;
        } else if (resolvedGrpId !== activeGroupFilter && itemGroupKey !== activeGroupFilter) {
          return false;
        }
      }

      const q = search.toLowerCase();
      if (!q) return true;
      const grpText = resolvedGrp ? `${resolvedGrp.code || ''} ${resolvedGrp.libelle || ''}`.toLowerCase() : '';
      return (
        item.id_type?.toLowerCase().includes(q) ||
        item.libelle?.toLowerCase().includes(q) ||
        grpText.includes(q)
      );
    });
  }, [partTypes, search, activeGroupFilter, partGroupMap]);

  // Sort
  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';
      if (sortField === 'id_group') {
        const gA = partGroupMap.get(String(a.id_group || a.id_groupe || '').trim());
        const gB = partGroupMap.get(String(b.id_group || b.id_groupe || '').trim());
        valA = gA ? `${gA.code || ''} ${gA.libelle || ''}` : 'zzz';
        valB = gB ? `${gB.code || ''} ${gB.libelle || ''}` : 'zzz';
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortOrder, partGroupMap]);

  const totalItems = sortedData.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedData =
    pageSize === 0 ? sortedData : sortedData.slice(startIndex, startIndex + effectivePageSize);
  const displayedData = rawDisplayedData;

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
      case 'id_type':
        return t('part_types.col_id', 'Code Type');
      case 'libelle':
        return t('part_types.col_libelle', 'Libellé');
      case 'id_group':
        return 'Groupe Part (Niv 1)';
      case 'designations_count':
        return t('part_types.col_count', 'Désignations');
      case 'warehouse_count':
        return t('part_types.col_warehouse', 'Entrepôt');
      default:
        return field?.toUpperCase() || '';
    }
  };

  const handleExportExcel = () => {
    const headers = ['ID Type Part', 'Libellé Type Part', 'Groupe Part (Niv 1)', 'Nb Désignations', 'Nb Articles Entrepôt'];
    const rows = filtered.map((tItem) => {
      const grp = partGroupMap.get(String(tItem.id_group || tItem.id_groupe || '').trim());
      return [
        tItem.id_type || '',
        tItem.libelle || '',
        grp ? `${grp.code} - ${grp.libelle}` : 'Non classé',
        partDesignations.filter((d) => d.id_type === tItem.id_type).length,
        warehouseItems.filter((i) => i.id_type === tItem.id_type).length,
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `types_parts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canCreateStock) return;
    if (!form.id_type || !form.libelle) return;
    const cleanGroupId = form.id_group ? String(form.id_group).trim() : null;
    onAddPartType({
      ...form,
      id_type: form.id_type.trim().toUpperCase(),
      id_group: cleanGroupId,
      id_groupe: cleanGroupId,
    });
    setForm({ id_type: '', id_group: '', libelle: '' });
    setShowAddModal(false);
  };

  const partTypeColumns = useMemo(
    () => [
      {
        key: 'id_type',
        label: t('part_types.col_id', 'ID TYPE'),
        colLetter: 'A',
        icon: Tag,
        sortable: true,
        render: (item) => (
          <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold text-xs">
            {item.id_type}
          </span>
        ),
      },
      {
        key: 'libelle',
        label: t('part_types.col_libelle', 'LIBELLÉ TYPE DE PART'),
        colLetter: 'B',
        icon: LayersIcon,
        sortable: true,
        render: (item) => (
          <span className="font-semibold text-slate-800 text-[13px]">
            {item.libelle}
          </span>
        ),
      },
      {
        key: 'id_group',
        label: 'GROUPE PART (NIV 1)',
        colLetter: 'C',
        icon: Boxes,
        sortable: true,
        render: (item) => {
          const grpKey = String(item.id_group || item.id_groupe || '').trim();
          const grp = grpKey ? partGroupMap.get(grpKey) : null;
          if (!grp) {
            return (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-medium italic">
                Non classé
              </span>
            );
          }
          const grpId = String(grp.id || grp.id_group || grp.id_groupe || '');
          return (
            <button
              type="button"
              onClick={() => setActiveGroupFilter(activeGroupFilter === grpId ? 'ALL' : grpId)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 text-xs font-semibold transition cursor-pointer shadow-2xs"
              title={`Filtrer sur le groupe ${grp.code} — ${grp.libelle}`}
            >
              <Boxes className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              <span className="font-mono font-bold">{grp.code}</span>
              <span className="text-slate-400">•</span>
              <span className="truncate max-w-[160px]">{grp.libelle}</span>
            </button>
          );
        },
      },
      {
        key: 'part_designations',
        label: t('part_types.col_designations', 'DÉSIGNATIONS DE PARTS'),
        colLetter: 'D',
        icon: PartInfoIcon,
        render: (item) => {
          const dCount = partDesignations.filter((d) => d.id_type === item.id_type).length;
          return (
            <button
              type="button"
              onClick={() =>
                onNavigateToPartDesignations && onNavigateToPartDesignations(item.id_type)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-50 text-teal-800 hover:bg-teal-100 border border-teal-200 text-xs font-semibold transition group shadow-2xs cursor-pointer"
              title={t('part_types.view_designations', 'Voir les désignations rattachées à ce type de part')}
            >
              <PartInfoIcon className="w-3.5 h-3.5 text-teal-600" />
              <span>{dCount} {t('part_types.designation_unit', 'désignations')}</span>
              <ArrowRight className="w-3 h-3 text-teal-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'warehouse_parts',
        label: t('part_types.col_warehouse', 'PARTS EN ENTREPÔT'),
        colLetter: 'E',
        icon: Warehouse,
        render: (item) => {
          const pCount = warehouseItems.filter(
            (w) =>
              (w.nature === 'PART' || w.nature === 'COMPOSANT') &&
              w.id_type === item.id_type
          ).length;
          return (
            <button
              type="button"
              onClick={() =>
                onNavigateToEntrepotByType && onNavigateToEntrepotByType(item.id_type)
              }
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition group shadow-2xs cursor-pointer"
              title={t('part_types.filter_warehouse', 'Filtrer Entrepôt sur ce type de part')}
            >
              <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
              <span>{pCount} {t('part_types.part_unit', 'parts')}</span>
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
        render: (item) => (
          <div className="relative inline-flex items-center justify-center action-menu-container">
            <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (onNavigateToPartDesignations) {
                    onNavigateToPartDesignations(item.id_type);
                  }
                }}
                className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                title={t('part_types.view_designations', 'Voir les désignations rattachées')}
              >
                <PartInfoIcon className="w-3.5 h-3.5 text-slate-900" />
              </button>
              {(canEditStock || canDeleteStock) && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionMenuId(activeActionMenuId === item.id_type ? null : item.id_type);
                  }}
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === item.id_type
                      ? 'bg-slate-100 text-teal-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={t('part_types.action_menu_title', 'Actions et options')}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeActionMenuId === item.id_type && (
              <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 p-1.5 animate-in fade-in zoom-in-95 duration-150 text-left">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {t('part_types.action_menu_header', 'Type de Part')}
                  </span>
                  <span className="text-xs font-mono font-bold text-teal-700 truncate block">
                    {item.id_type} — {item.libelle}
                  </span>
                </div>
                {canEditStock && (
                  <button
                    type="button"
                    onClick={() => {
                      setToEdit({
                        ...item,
                        id_group: item.id_group || item.id_groupe || '',
                      });
                      setActiveActionMenuId(null);
                    }}
                    className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-800 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-teal-600" />
                    <span>{t('part_types.menu_edit', 'Modifier ce type')}</span>
                  </button>
                )}
                {canDeleteStock && (
                  <button
                    type="button"
                    onClick={() => {
                      setToDelete(item);
                      setActiveActionMenuId(null);
                    }}
                    className="w-full px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-2.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('part_types.menu_delete', 'Supprimer ce type')}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ),
      },
    ],
    [
      t,
      partGroupMap,
      activeGroupFilter,
      setActiveGroupFilter,
      partDesignations,
      warehouseItems,
      activeActionMenuId,
      onNavigateToPartDesignations,
      onNavigateToEntrepotByType,
      canEditStock,
      canDeleteStock,
    ]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          <PageHeaderIcon icon={LayersIcon} colorClass="text-indigo-700" />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {t('part_types.title', 'Types de Parts d’Entrepôt (Niveau 2)')}
              </h2>
              {onNavigateToPartGroups && (
                <button
                  type="button"
                  onClick={onNavigateToPartGroups}
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 transition cursor-pointer"
                >
                  <Boxes className="w-3 h-3" />
                  <span>Gérer Groupes Parts (Niv 1)</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('part_types.subtitle', 'Nomenclature des types et catégories de pièces gérées au sein du groupe entrepôt (Distinctes du Stock PDR).')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('part_types.formulas_button', 'Formules Excel (Types de Parts)')}
          />

          {canCreateStock && (
            <Action3DButton
              variant="circle"
              color="emerald"
              icon={LayersIcon}
              showAddBadge={true}
              onClick={() => {
                const nextIdx = partTypes.length + 1;
                setForm({
                  id_type: `TYPE-PRT${String(nextIdx).padStart(2, '0')}`,
                  id_group: activeGroupFilter && activeGroupFilter !== 'ALL' && activeGroupFilter !== 'UNASSIGNED' ? activeGroupFilter : '',
                  libelle: '',
                });
                setShowAddModal(true);
              }}
              title={t('part_types.new_type_button', 'Nouveau Type de Part')}
            />
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Header Toolbar: Icon + Title + Count Badge + Excel Export + Circular Reset */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                  {t('common.filters.title', 'Filtres & Recherche Avancée')}
                </span>
                <span className="bg-amber-50 text-amber-800 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border border-amber-200/70 shadow-2xs font-mono">
                  {filtered.length} / {partTypes.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('part_types.filters_subtitle', 'Référentiel des Types de Parts Entrepôt • Colonnes A → E')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Export Excel Button */}
            <button
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200/80 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title={t('common.filters.export_excel', 'Exporter le tableau vers Excel / CSV')}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('common.filters.export_excel', 'Export Excel')}</span>
            </button>

            {/* Circular Reset Button */}
            {(search || (activeGroupFilter && activeGroupFilter !== 'ALL') || sortField !== 'id_type' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setSearch('');
                  setActiveGroupFilter('ALL');
                  setSortField('id_type');
                  setSortOrder('asc');
                }}
                title={t('common.filters.reset_tooltip', 'Réinitialiser tous les filtres actifs')}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          {/* Search */}
          <div className="relative w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.filters.search', 'RECHERCHE LIBRE')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                Col. A + B + C
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('common.filters.search_placeholder', 'Rechercher par ID type, libellé, groupe...')}
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

          {/* Part Group Filter (Niv 1) */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                GROUPE DE PARTS (NIVEAU 1)
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs">
                Col. C
              </span>
            </div>
            <CustomSelect
              value={activeGroupFilter || 'ALL'}
              onChange={(val) => {
                setActiveGroupFilter(val || 'ALL');
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: `Tous les groupes (${partTypes.length})` },
                {
                  value: 'UNASSIGNED',
                  label: `Non classés (${
                    partTypes.filter((pt) => !partGroupMap.has(String(pt.id_group || pt.id_groupe || '').trim())).length
                  })`,
                },
                ...(partGroups || [])
                  .filter((g) => g.is_active !== false)
                  .map((g) => {
                    const gId = String(g.id || g.id_group || g.id_groupe || '');
                    return {
                      value: gId,
                      label: `${g.code} — ${g.libelle}`,
                    };
                  }),
              ]}
              placeholder="Filtrer par Groupe de Parts..."
              icon={Boxes}
            />
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('common.filters.sort_and_order', 'TRI DES ENREGISTREMENTS')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {sortOrder === 'asc' ? t('common.filters.order_asc', 'Ordre A-Z') : t('common.filters.order_desc', 'Ordre Z-A')}
              </span>
            </div>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'id_type' || sortOrder !== 'asc'
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
                    <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                    {t('common.sort_options', 'Trier par')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {[
                    { field: 'id_type', label: t('part_types.col_id', 'ID Type de Part (A)') },
                    { field: 'libelle', label: t('part_types.col_libelle', 'Libellé Type de Part (B)') },
                    { field: 'id_group', label: 'Groupe Part (Niv 1) (C)' },
                  ].map(({ field, label }) => (
                    <button
                      key={field}
                      onClick={() => {
                        if (sortField === field) {
                          setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortField(field);
                          setSortOrder('asc');
                        }
                      }}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                        sortField === field
                          ? 'bg-amber-50 text-amber-800 font-bold'
                          : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>{label}</span>
                      {sortField === field &&
                        (sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ))}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {(search || (activeGroupFilter && activeGroupFilter !== 'ALL')) && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('common.active_filter', 'Filtre actif :')}</span>
            {activeGroupFilter && activeGroupFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                <Boxes className="w-3 h-3 text-teal-600" />
                Groupe:{' '}
                {activeGroupFilter === 'UNASSIGNED'
                  ? 'Non classés'
                  : partGroupMap.get(activeGroupFilter)?.code || activeGroupFilter}
                <button
                  onClick={() => setActiveGroupFilter('ALL')}
                  className="hover:bg-teal-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
                <Search className="w-3 h-3 text-amber-600" />
                {t('common.search_term', 'Recherche:')} &quot;{search}&quot;
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
        title={t('part_types.grid_title', 'Tableau Types de Parts (Entrepôt)')}
        icon={<LayersIcon className="w-4 h-4 text-teal-600" />}
        excelMapping="id_type (A) | libelle (B) | id_group (C) | part_designations (D) | warehouse_parts (E)"
        bannerColor="slate"
        columns={partTypeColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<LayersIcon className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('part_types.empty', 'Aucun type de part trouvé')}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'teal',
          itemLabel: t('part_types.item_label', 'types de part'),
        }}
      />

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('part_types.add_title', 'Nouveau Type de Part')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('part_types.add_desc', "Catégorie de parts d'entrepôt (Niveau 2).")}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Groupe de Parts Parent (Niveau 1)
                </label>
                <select
                  value={form.id_group || ''}
                  onChange={(e) => setForm({ ...form, id_group: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">— Non classé (Aucun groupe) —</option>
                  {(partGroups || [])
                    .filter((g) => g.is_active !== false)
                    .map((g) => {
                      const gId = String(g.id || g.id_group || g.id_groupe || '');
                      return (
                        <option key={gId} value={gId}>
                          {g.code} — {g.libelle}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_types.code_label', 'ID Type (Clé Unique) *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.id_type}
                  onChange={(e) => setForm({ ...form, id_type: e.target.value })}
                  placeholder="ex: TYPE-FIX, TYPE-MEC, TYPE-PNE"
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_types.libelle_label', 'Libellé du Type de Part *')}
                </label>
                <input
                  type="text"
                  required
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  placeholder={t('part_types.libelle_placeholder', 'ex: Fixation & Visserie Industrielle')}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
              {t('part_types.edit_title', 'Modifier Type de Part')}
            </h3>
            <p className="text-xs font-mono text-teal-700 mb-4">{toEdit.id_type}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!canEditStock) return;
                const cleanGroupId = toEdit.id_group ? String(toEdit.id_group).trim() : null;
                onUpdatePartType(toEdit.id_type, {
                  ...toEdit,
                  id_group: cleanGroupId,
                  id_groupe: cleanGroupId,
                });
                setToEdit(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Groupe de Parts Parent (Niveau 1)
                </label>
                <select
                  value={toEdit.id_group || toEdit.id_groupe || ''}
                  onChange={(e) =>
                    setToEdit({
                      ...toEdit,
                      id_group: e.target.value,
                      id_groupe: e.target.value,
                    })
                  }
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">— Non classé (Aucun groupe) —</option>
                  {(partGroups || []).map((g) => {
                    const gId = String(g.id || g.id_group || g.id_groupe || '');
                    return (
                      <option key={gId} value={gId}>
                        {g.code} — {g.libelle}
                        {g.is_active === false ? ' (Inactif)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('part_types.libelle_label', 'Libellé *')}
                </label>
                <input
                  type="text"
                  required
                  value={toEdit.libelle || ''}
                  onChange={(e) => setToEdit({ ...toEdit, libelle: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500"
                />
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
              {t('part_types.delete_title', 'Supprimer ce Type de Part ?')}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('part_types.delete_confirm', 'Confirmez-vous la suppression de {{name}} ?', { name: `${toDelete.id_type} (${toDelete.libelle})` })}
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
                  if (!canDeleteStock) return;
                  onDeletePartType(toDelete.id_type);
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
                  <h3 className="font-black text-slate-900 text-base">{t('part_types.formulas_title', "Formules Excel — Types de Parts d'Entrepôt")}</h3>
                  <p className="text-xs text-slate-500">{t('part_types.formulas_subtitle', "Formules miroir de l'onglet Part_Types (GMAO)")}</p>
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
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule A — Identifiant Unique Type</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">CLE_PRIMAIRE</span>
                </div>
                <div className="font-mono text-xs text-teal-800 font-bold bg-white p-2 rounded-lg border border-teal-100">
                  =[@id_type] (ex: TYPE-PRT01)
                </div>
                <p className="text-[11px] text-slate-500">Clé primaire de classification des pièces d'entrepôt.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule B — Nombre d'articles rattachés</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">COUNTIF</span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =COUNTIF(Part_Designations!D:D, [@id_type])
                </div>
                <p className="text-[11px] text-slate-500">Compte le nombre total de références cataloguées sous ce type dans l'entrepôt.</p>
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
