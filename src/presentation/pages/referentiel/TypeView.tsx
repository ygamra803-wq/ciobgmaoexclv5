import {  useState, useRef, useMemo, useEffect  } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import { useI18n } from '../../../i18n/I18nContext';
import {
  Tag,
  Layers,
  Boxes,
  BadgeCheck,
  BadgePlus,
  Search,
  ArrowRight,
  Package,
  Trash2,
  Edit2,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  Calculator,
  X,
  RotateCcw,
  MoreVertical,
  FileSpreadsheet,
} from 'lucide-react';

export default function TypeView({
  types = [],
  designations = [],
  stockItems = [],
  onAddType,
  onUpdateType,
  onDeleteType,
  onNavigateToStockFiltered,
  onNavigateToDesignationsFiltered,
  onQuickCreateDesignation,
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
  const [form, setForm] = useState({ id_type: '', libelle: '' });
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const safeTypes = Array.isArray(types) ? types : [];

  const autoTypeId = useMemo(() => {
    const nums = safeTypes
      .map((t) => {
        const m = String(t.id_type || '').match(/TYP-(\d+)/i);
        return m ? parseInt(m[1], 10) : 0;
      })
      .filter((n) => !isNaN(n));
    const max = nums.length > 0 ? Math.max(...nums) : 0;
    return `TYP-${String(max + 1).padStart(2, '0')}`;
  }, [safeTypes]);

  const takenTypeNumbers = useMemo(() => {
    const set = new Set();
    safeTypes.forEach((t) => {
      const m = String(t.id_type || '').match(/(\d+)$/);
      if (m) set.add(parseInt(m[1], 10));
    });
    return set;
  }, [safeTypes]);

  useEffect(() => {
    if (showAddModal) {
      setForm((prev) => ({
        ...prev,
        id_type: prev.id_type || autoTypeId,
      }));
    }
  }, [showAddModal, autoTypeId]);

  const filtered = types.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const id = String(t.id_type || '').toLowerCase();
    const lib = String(t.libelle || '').toLowerCase();
    return id.includes(q) || lib.includes(q);
  });

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('id_type');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);

  const sortMenuRef = useRef(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortField, sortOrder]);

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

  const handleTableSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const renderTableSortIcon = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-cyan-600 transition-colors shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-cyan-700 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-700 font-bold shrink-0" />
    );
  };

  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA, valB;
      if (sortField === 'desig_count') {
        const typeValA = String(a?.id_type || a?.type || '').toLowerCase();
        const typeValB = String(b?.id_type || b?.type || '').toLowerCase();
        valA = designations.filter((d) => {
          const dIdType = String(d?.id_type || '').toLowerCase();
          const dType = String(d?.type || '').toLowerCase();
          return Boolean(typeValA && (dIdType === typeValA || dType === typeValA));
        }).length;
        valB = designations.filter((d) => {
          const dIdType = String(d?.id_type || '').toLowerCase();
          const dType = String(d?.type || '').toLowerCase();
          return Boolean(typeValB && (dIdType === typeValB || dType === typeValB));
        }).length;
      } else if (sortField === 'article_count') {
        const typeValA = String(a?.id_type || a?.type || '').toLowerCase();
        const typeValB = String(b?.id_type || b?.type || '').toLowerCase();
        valA = stockItems.filter((s) => {
          const sIdType = String(s?.id_type || '').toLowerCase();
          const sType = String(s?.type || '').toLowerCase();
          return Boolean(typeValA && (sIdType === typeValA || sType === typeValA));
        }).length;
        valB = stockItems.filter((s) => {
          const sIdType = String(s?.id_type || '').toLowerCase();
          const sType = String(s?.type || '').toLowerCase();
          return Boolean(typeValB && (sIdType === typeValB || sType === typeValB));
        }).length;
      } else {
        valA = a[sortField] || '';
        valB = b[sortField] || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortField, sortOrder, designations, stockItems]);

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
      padded.push({ __isEmptyPlaceholder: true, id_type: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedData]);

  const handleExportExcel = () => {
    const headers = ['ID Type', 'Libellé Type PDR', 'Nb Désignations', 'Nb Articles Stock'];
    const rows = filtered.map((t) => [
      t.id_type || t.type || '',
      t.libelle || '',
      designations.filter((d) => (d.id_type || d.type) === (t.id_type || t.type)).length,
      stockItems.filter((s) => (s.id_type || s.type) === (t.id_type || t.type)).length,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `types_pdr_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.id_type || !form.libelle) return;
    onAddType(form);
    setForm({ id_type: '', libelle: '' });
    setShowAddModal(false);
  };

  const typeColumns = useMemo(
    () => [
      {
        key: 'id_type',
        label: t('article_types.col_id', 'ID TYPE'),
        colLetter: 'A',
        icon: Tag,
        sortable: true,
        render: (item) => {
          const typeVal = String(item.id_type || item.libelle || '');
          return (
            <span className="px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-800 border border-cyan-200 text-[11px] font-mono font-bold">
              {typeVal}
            </span>
          );
        },
      },
      {
        key: 'libelle',
        label: t('article_types.col_libelle', 'LIBELLÉ DU TYPE'),
        colLetter: 'B',
        icon: Layers,
        sortable: true,
        render: (item) => {
          const typeVal = String(item.id_type || item.libelle || '');
          return <span className="font-semibold text-slate-800 text-[13px]">{item.libelle || typeVal}</span>;
        },
      },
      {
        key: 'desig_count',
        label: t('article_types.col_desig_count', 'DÉSIGNATIONS LIÉES'),
        colLetter: 'C',
        icon: Boxes,
        sortable: true,
        render: (item) => {
          const typeVal = String(item.id_type || item.libelle || '');
          const desigCount = designations.filter((d) => {
            const dIdType = String(d?.id_type || '').toLowerCase();
            const dType = String(d?.type || '').toLowerCase();
            const typeValLower = typeVal.toLowerCase();
            return Boolean(typeValLower && (dIdType === typeValLower || dType === typeValLower));
          }).length;
          return (
            <button
              onClick={() => onNavigateToDesignationsFiltered && onNavigateToDesignationsFiltered(typeVal)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200 text-xs font-semibold transition group shadow-2xs cursor-pointer"
            >
              <BadgeCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>{desigCount} {t('article_types.desig_unit', 'désignations')}</span>
              <ArrowRight className="w-3 h-3 text-indigo-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'article_count',
        label: t('article_types.col_article_count', 'ARTICLES EN STOCK'),
        colLetter: 'D',
        icon: Package,
        sortable: true,
        render: (item) => {
          const typeVal = String(item.id_type || item.libelle || '');
          const articleCount = stockItems.filter((s) => {
            const sIdType = String(s?.id_type || '').toLowerCase();
            const sType = String(s?.type || '').toLowerCase();
            const typeValLower = typeVal.toLowerCase();
            return Boolean(typeValLower && (sIdType === typeValLower || sType === typeValLower));
          }).length;
          return (
            <button
              onClick={() => onNavigateToStockFiltered && onNavigateToStockFiltered(typeVal)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-50 text-cyan-800 hover:bg-cyan-100 border border-cyan-200 text-xs font-semibold transition group shadow-2xs cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-cyan-600" />
              <span>{articleCount} {t('article_types.article_unit', 'articles')}</span>
              <ArrowRight className="w-3 h-3 text-cyan-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          );
        },
      },
      {
        key: 'actions',
        label: '•••',
        align: 'center',
        headerClassName: 'w-24 text-center font-bold text-slate-400 tracking-widest select-none',
        render: (item) => {
          const typeVal = String(item.id_type || item.libelle || '');
          const desigCount = designations.filter((d) => {
            const dIdType = String(d?.id_type || '').toLowerCase();
            const dType = String(d?.type || '').toLowerCase();
            const typeValLower = typeVal.toLowerCase();
            return Boolean(typeValLower && (dIdType === typeValLower || dType === typeValLower));
          }).length;
          const articleCount = stockItems.filter((s) => {
            const sIdType = String(s?.id_type || '').toLowerCase();
            const sType = String(s?.type || '').toLowerCase();
            const typeValLower = typeVal.toLowerCase();
            return Boolean(typeValLower && (sIdType === typeValLower || sType === typeValLower));
          }).length;

          return (
            <div className="relative inline-flex items-center justify-center action-menu-container">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (onQuickCreateDesignation) {
                      onQuickCreateDesignation(typeVal);
                    } else if (onNavigateToDesignationsFiltered) {
                      onNavigateToDesignationsFiltered(typeVal);
                    }
                    setActiveActionMenuId(null);
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                  title={t('article_types.quick_create_desig_title', 'Créer une Désignation pour ce type')}
                >
                  <BadgePlus className="w-3.5 h-3.5 text-slate-900" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionMenuId(activeActionMenuId === typeVal ? null : typeVal);
                  }}
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === typeVal
                      ? 'bg-slate-100 text-cyan-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={t('article_types.action_options_title', 'Actions et options du type')}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeActionMenuId === typeVal && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t('article_types.action_header', 'Actions Type')}
                    </div>
                    <div className="font-mono font-bold text-xs text-slate-800 truncate mt-0.5">
                      {item.id_type} • {item.libelle || item.id_type}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        if (onQuickCreateDesignation) {
                          onQuickCreateDesignation(typeVal);
                        } else if (onNavigateToDesignationsFiltered) {
                          onNavigateToDesignationsFiltered(typeVal);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 flex items-center justify-between transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <BadgePlus className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
                        <span>{t('article_types.new_designation', 'Nouvelle Désignation')}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-bold border border-emerald-200/60">
                        +
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        if (onNavigateToDesignationsFiltered) {
                          onNavigateToDesignationsFiltered(typeVal);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 flex items-center justify-between transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <BadgeCheck className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                        <span>{t('article_types.view_designations', 'Voir les Désignations')}</span>
                      </div>
                      <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-bold border border-emerald-200/60">
                        {desigCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        if (onNavigateToStockFiltered) {
                          onNavigateToStockFiltered(typeVal);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-cyan-700 hover:bg-cyan-50 flex items-center justify-between transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="w-3.5 h-3.5 text-cyan-600 group-hover:scale-110 transition-transform" />
                        <span>{t('article_types.view_articles', 'Voir Articles du Stock')}</span>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded font-bold border border-emerald-200/60">
                        {articleCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setToEdit({ ...item });
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition cursor-pointer group border-t border-slate-100 mt-1 pt-2"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                      <span>{t('article_types.edit_type', 'Modifier ce Type')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setToDelete(item);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer group"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
                      <span>{t('article_types.delete_type', 'Supprimer ce Type')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [designations, stockItems, activeActionMenuId, t]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-cyan-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-200/90 shadow-[0_4px_12px_rgba(6,182,212,0.12)] flex items-center justify-center text-cyan-700 group-hover/header:scale-105 group-hover/header:border-cyan-400/80 transition-all duration-300 shrink-0">
            <Tag className="w-6 h-6 text-cyan-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {t('article_types.title', "Types d'Articles (Types & Catégories)")}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('article_types.subtitle', "Équivalent des familles pour les machines (ex: Foret, Vis, Roulement). Gérez les types et catégories d'articles de stock.")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('article_types.formulas_button', "Formules Excel (Types d'Articles)")}
          />

          <Action3DButton
            variant="circle"
            color="cyan"
            icon={Tag}
            showAddBadge={true}
            onClick={() => setShowAddModal(true)}
            title={t('article_types.new_type_button', 'Nouveau Type')}
          />
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
                  {filtered.length} / {types.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('article_types.filters_subtitle', 'Référentiel des Familles & Types de Pièces de Rechange • Colonnes A → D')}
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
            {(localSearch || sortField !== 'id_type' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setLocalSearch('');
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
          {/* Search */}
          <div className="relative w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('article_types.search_free', 'RECHERCHE LIBRE')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('article_types.col_a_b', 'Col. A + B')}
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('article_types.search_placeholder', 'Rechercher par code ou libellé (Foret, Vis, Roulement...)...')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sort Dropdown */}
          <div className="w-full relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('article_types.sorting_title', 'TRI DES ENREGISTREMENTS')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('article_types.order_a_z', 'Ordre A-Z')}
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
                  {t('article_types.sort_prefix', 'Tri :')} <b className="font-mono text-slate-900">{sortField.toUpperCase()}</b> (
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
                    <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-600" />
                    {t('article_types.sort_by_title', 'Trier par')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <button
                    onClick={() => handleTableSort('id_type')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_type'
                        ? 'bg-cyan-50 text-cyan-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('article_types.sort_code', 'Code / ID Type (A)')}</span>
                    {sortField === 'id_type' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('libelle')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'libelle'
                        ? 'bg-cyan-50 text-cyan-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('article_types.sort_label', 'Libellé / Nom du Type (B)')}</span>
                    {sortField === 'libelle' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('desig_count')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'desig_count'
                        ? 'bg-cyan-50 text-cyan-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('article_types.sort_desig_count', 'Nb Désignations Liées (C)')}</span>
                    {sortField === 'desig_count' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('article_count')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'article_count'
                        ? 'bg-cyan-50 text-cyan-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('article_types.sort_article_count', 'Nb Articles en Stock (D)')}</span>
                    {sortField === 'article_count' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                      ))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {localSearch && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('article_types.active_filter', 'Filtre actif :')}</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold">
              <Search className="w-3 h-3 text-cyan-600" />
              {t('article_types.active_search_prefix', 'Recherche: ')}&quot;{localSearch}&quot;
              <button
                onClick={() => setLocalSearch('')}
                className="hover:bg-cyan-200/60 p-0.5 rounded-full transition cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}
      </div>

      {/* Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title={t('article_types.grid_title', "Tableau Types d'Articles • Colonnes A → D")}
        icon={<Tag className="w-4 h-4 text-cyan-600" />}
        excelMapping={t('article_types.excel_mapping', 'id_type (A) | libelle (B) | nb_designations (C) | nb_articles (D)')}
        bannerColor="slate"
        columns={typeColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleTableSort}
        renderSortIcon={renderTableSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<Tag className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('article_types.empty_message', "Aucun type d'article trouvé")}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 50, 100, 200, 0],
          color: 'cyan',
          itemLabel: t('article_types.item_label', 'types'),
        }}
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">{t('article_types.add_title', "Nouveau Type d'Article")}</h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('article_types.add_desc', "Créez une catégorie parent (ex: Foret, Vis, Roulement) pour regrouper les désignations.")}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <SequentialCodePicker
                  prefix="TYP-"
                  currentCode={form.id_type}
                  onChangeCode={(newCode) =>
                    setForm((prev) => ({
                      ...prev,
                      id_type: newCode,
                      libelle: prev.libelle || newCode,
                    }))
                  }
                  autoGeneratedCode={autoTypeId}
                  takenNumbers={takenTypeNumbers}
                  label={t('article_types.code_label', 'ID / Code Type (ex: TYP-01)')}
                  helperText={t('article_types.code_helper', 'Code séquentiel du type avec choix libre du numéro ou saisie directe')}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('article_types.libelle_label', 'Libellé du Type')}
                </label>
                <input
                  type="text"
                  placeholder={t('article_types.libelle_placeholder', 'Forêts & Mèches de perçage...')}
                  value={form.libelle}
                  onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
                >
                  {t('common.save', 'Enregistrer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toEdit && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-1">{t('article_types.edit_title', 'Modifier Type')}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateType(toEdit.id_type, toEdit);
                setToEdit(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t('article_types.code_label', 'ID Type')}</label>
                <input
                  type="text"
                  value={toEdit.id_type}
                  disabled
                  className="mt-1 w-full h-10 px-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">{t('article_types.libelle_label', 'Libellé')}</label>
                <input
                  type="text"
                  value={toEdit.libelle}
                  onChange={(e) => setToEdit({ ...toEdit, libelle: e.target.value })}
                  required
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                />
              </div>
              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setToEdit(null)}
                  className="flex-1 h-10 rounded-xl bg-slate-100 text-xs font-medium"
                >
                  {t('common.cancel', 'Annuler')}
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-xs font-semibold"
                >
                  {t('common.save', 'Enregistrer')}
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
              <h3 className="font-bold text-lg text-slate-900">{t('article_types.delete_title', 'Supprimer ce type ?')}</h3>
            </div>
            <p className="text-sm text-center text-slate-600">
              {t('article_types.delete_confirm', 'Confirmez-vous la suppression de {{name}} ?', { name: toDelete.libelle })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setToDelete(null)}
                className="flex-1 h-10 rounded-xl bg-slate-100 text-slate-700 text-xs font-medium"
              >
                {t('common.cancel', 'Annuler')}
              </button>
              <button
                onClick={() => {
                  onDeleteType(toDelete.id_type);
                  setToDelete(null);
                }}
                className="flex-1 h-10 rounded-xl bg-rose-600 text-white text-xs font-semibold"
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
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{t('article_types.formulas_title', "Formules Excel — Types d'Articles")}</h3>
                  <p className="text-xs text-slate-500">{t('article_types.formulas_subtitle', "Formules miroir de l'onglet Types (GMAO)")}</p>
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
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('article_types.formula_desig_title', 'Formule D — Nombre de Désignations')}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">COUNTIF</span>
                </div>
                <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
                  =COUNTIF(Designations!C:C, [@id_type])
                </div>
                <p className="text-[11px] text-slate-500">{t('article_types.formula_desig_desc', 'Compte les désignations de pièces rattachées à ce type.')}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('article_types.formula_stock_title', "Formule E — Nombre d'Articles en Stock")}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">COUNTIF</span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =COUNTIF(Stock_Actuel!D:D, [@id_type])
                </div>
                <p className="text-[11px] text-slate-500">{t('article_types.formula_stock_desc', 'Compte les articles de stock associés à ce type.')}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{t('article_types.formula_sum_title', 'Liaison Stock — Somme Quantité Stock')}</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">SUMIF</span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  =SUMIF(Stock!D:D, [@id_type], Stock!H:H)
                </div>
                <p className="text-[11px] text-slate-500">{t('article_types.formula_sum_desc', "Calcule la somme totale du stock physique pour ce type d'article.")}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">{t('article_types.template_version', 'Modèle GMAO_Light_Template_V2')}</span>
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
