import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import CustomSelect from '../../components/common/CustomSelect';
import SequentialCodePicker from '../../components/common/SequentialCodePicker';
import { useI18n } from '../../../i18n/I18nContext';
import {
  BadgeCheck,
  Layers,
  Boxes,
  MapPin,
  Package,
  Search,
  Tag,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit2,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  Calculator,
  X,
  RotateCcw,
  MoreVertical,
  Warehouse,
  FileSpreadsheet,
} from 'lucide-react';

const TYPE_STYLES = {
  Foret: 'bg-amber-50 text-amber-700 border-amber-200',
  Tenaille: 'bg-slate-100 text-slate-700 border-slate-200',
  Cheville: 'bg-violet-50 text-violet-700 border-violet-200',
  Poinçon: 'bg-rose-50 text-rose-700 border-rose-200',
  Vis: 'bg-blue-50 text-blue-700 border-blue-200',
  Raccord: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  Roulement: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Courroie: 'bg-orange-50 text-orange-700 border-orange-200',
  Capteur: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  teflon: 'bg-teal-50 text-teal-700 border-teal-200',
};

function getTypeStyle(typeStr) {
  if (!typeStr) return 'bg-cyan-50 text-cyan-800 border-cyan-200';
  const clean = String(typeStr).trim();
  const key = Object.keys(TYPE_STYLES).find((k) => k.toLowerCase() === clean.toLowerCase());
  return TYPE_STYLES[key] || 'bg-cyan-50 text-cyan-800 border-cyan-200';
}

export default function DesignationView({
  designations = [],
  types = [],
  stockItems = [],
  desigTypeFilter = 'ALL',
  setDesigTypeFilter,
  quickCreateType,
  setQuickCreateType,
  onReturnToTypes,
  onAddDesignation,
  onUpdateDesignation,
  onDeleteDesignation,
  onOpenAddTypeModal,
  onNavigateToStockFilteredByRef,
  _onNavigateToQuickSortie,
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
  const [toEdit, setToEdit] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [form, setForm] = useState({
    id_type: '',
    ref: '',
    designation: '',
    stockInitial: 5,
    seuil: 3,
    emplacement: '',
  });

  const handleTypeSelect = useCallback(
    (selectedType) => {
      if (!selectedType) return;
      const prefix =
        selectedType
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .slice(0, 10) || 'REF';

      // Find highest index among designations & stockItems for this prefix
      let maxIndex = 0;

      designations.forEach((d) => {
        const dType = d.id_type || d.type || '';
        const r = String(d.ref || d.id_designation || '');
        if (
          dType.toLowerCase() === selectedType.toLowerCase() ||
          r.toUpperCase().startsWith(prefix)
        ) {
          const match = r.match(/\d+$/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxIndex) maxIndex = num;
          }
        }
      });

      stockItems.forEach((s) => {
        const sType = s.id_type || s.type || '';
        const r = String(s.ref || '');
        if (
          sType.toLowerCase() === selectedType.toLowerCase() ||
          r.toUpperCase().startsWith(prefix)
        ) {
          const match = r.match(/\d+$/);
          if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxIndex) maxIndex = num;
          }
        }
      });

      const nextNumber = maxIndex + 1;
      const generatedRef = `${prefix}${String(nextNumber).padStart(3, '0')}`;

      setForm((prev) => ({
        ...prev,
        id_type: selectedType,
        ref: generatedRef,
      }));
    },
    [designations, stockItems]
  );

  useEffect(() => {
    if (quickCreateType) {
      handleTypeSelect(quickCreateType);
      setShowAddModal(true);
    }
  }, [quickCreateType, handleTypeSelect]);

  // Filtered and sorted designations
  const filtered = designations
    .filter((d) => {
      if (desigTypeFilter !== 'ALL') {
        const targetType = String(desigTypeFilter).trim().toLowerCase();
        const dType = String(d.id_type || d.type || '').trim().toLowerCase();
        if (dType !== targetType) {
          return false;
        }
      }
      if (search) {
        const q = search.toLowerCase();
        const r = String(d.ref || d.id_designation || d.id_diag || '').toLowerCase();
        const name = String(d.designation || d.libelle || d.nom || '').toLowerCase();
        const t = String(d.id_type || d.type || '').toLowerCase();
        return r.includes(q) || name.includes(q) || t.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const refA = String(a.ref || a.id_designation || a.id_diag || '');
      const refB = String(b.ref || b.id_designation || b.id_diag || '');
      return refA.localeCompare(refB, undefined, { numeric: true, sensitivity: 'base' });
    });

  const diagPrefix = useMemo(() => {
    if (!form.id_type) return 'REF-';
    const clean = form.id_type
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    return clean ? `${clean}-` : 'REF-';
  }, [form.id_type]);

  const takenDiagNumbers = useMemo(() => {
    const set = new Set();
    const prefixNoDash = diagPrefix.replace(/-$/, '');
    const checkItem = (r, itemType) => {
      const str = String(r || '').toUpperCase();
      if (
        str.startsWith(prefixNoDash) ||
        (itemType && itemType.toLowerCase() === (form.id_type || '').toLowerCase())
      ) {
        const match = str.match(/(\d+)$/);
        if (match) set.add(parseInt(match[1], 10));
      }
    };
    (designations || []).forEach((d) =>
      checkItem(d.ref || d.id_designation || d.id_diag, d.id_type || d.type)
    );
    (stockItems || []).forEach((s) => checkItem(s.ref, s.id_type || s.type));
    return set;
  }, [diagPrefix, form.id_type, designations, stockItems]);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('id_diag');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState(null);

  const sortMenuRef = useRef(null);

  const [prevFilterKey, setPrevFilterKey] = useState(() => `${search}_${desigTypeFilter}_${sortField}_${sortOrder}`);
  const currentFilterKey = `${search}_${desigTypeFilter}_${sortField}_${sortOrder}`;
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setCurrentPage(1);
  }

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

  const getItemDerivedData = (item) => {
    const itemRefKey = String(item.ref || item.id_designation || item.id_diag || '').trim().toLowerCase();
    const itemDesigKey = String(item.designation || item.libelle || item.nom || '').trim().toLowerCase();

    const stockMatch = stockItems.find((s) => {
      const sRef = String(s.ref || '').trim().toLowerCase();
      const sDesig = String(s.designation || '').trim().toLowerCase();
      if (itemRefKey && sRef === itemRefKey) return true;
      if (itemDesigKey && sDesig === itemDesigKey) return true;
      return false;
    });

    const currentStock = stockMatch ? stockMatch.stockActuel : (item.stockActuel != null ? item.stockActuel : item.stockInitial || 0);
    const threshold = stockMatch ? stockMatch.seuil : item.seuil || 3;
    const alertStatus = stockMatch
      ? stockMatch.alerte
      : currentStock <= 0
        ? 'RUPTURE'
        : currentStock <= threshold
          ? 'ALERTE'
          : 'OK';
    const location = stockMatch ? stockMatch.emplacement : item.emplacement || 'A1-R1';
    const typeName = item.id_type || item.type || (stockMatch ? stockMatch.type || stockMatch.id_type : 'Standard');
    const refDisplay = item.ref || item.id_designation || item.id_diag || (stockMatch ? stockMatch.ref : 'N/A');
    const desigDisplay = item.designation || item.libelle || item.nom || (stockMatch ? stockMatch.designation : 'Sans désignation');

    return { stockMatch, currentStock, alertStatus, location, typeName, refDisplay, desigDisplay };
  };

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
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 font-bold shrink-0" />
    );
  };

  const sortedData = useMemo(() => {
    if (!sortField) return filtered;
    return [...filtered].sort((a, b) => {
      let valA, valB;
      const dataA = getItemDerivedData(a);
      const dataB = getItemDerivedData(b);

      if (sortField === 'ref') {
        valA = String(dataA.refDisplay || '').toLowerCase();
        valB = String(dataB.refDisplay || '').toLowerCase();
      } else if (sortField === 'designation') {
        valA = String(dataA.desigDisplay || '').toLowerCase();
        valB = String(dataB.desigDisplay || '').toLowerCase();
      } else if (sortField === 'id_type') {
        valA = String(dataA.typeName || '').toLowerCase();
        valB = String(dataB.typeName || '').toLowerCase();
      } else if (sortField === 'stockActuel') {
        valA = Number(dataA.currentStock) || 0;
        valB = Number(dataB.currentStock) || 0;
      } else if (sortField === 'alerte') {
        valA = String(dataA.alertStatus || '').toLowerCase();
        valB = String(dataB.alertStatus || '').toLowerCase();
      } else if (sortField === 'emplacement') {
        valA = String(dataA.location || '').toLowerCase();
        valB = String(dataB.location || '').toLowerCase();
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
  }, [filtered, sortField, sortOrder, stockItems]);

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
      padded.push({ __isEmptyPlaceholder: true, id_diag: `empty-${i}`, ref: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedData]);

  const handleExportExcel = () => {
    const headers = ['Référence', 'Désignation PDR', 'Type Parent', 'Stock Actuel', 'Seuil Alerte', 'Emplacement'];
    const rows = filtered.map((d) => {
      const data = getItemDerivedData(d);
      return [
        data.refDisplay || '',
        data.desigDisplay || '',
        data.typeName || '',
        data.currentStock != null ? data.currentStock : '',
        data.threshold != null ? data.threshold : '',
        data.location || '',
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `designations_pdr_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    if (quickCreateType) {
      if (setQuickCreateType) setQuickCreateType(null);
      if (onReturnToTypes) onReturnToTypes();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.id_type || !form.designation) return;

    onAddDesignation(form);
    setForm({
      id_type: '',
      ref: '',
      designation: '',
      stockInitial: 5,
      seuil: 3,
      emplacement: '',
    });
    setShowAddModal(false);
    if (quickCreateType && setQuickCreateType) {
      setQuickCreateType(null);
    }
  };

  const designationColumns = useMemo(
    () => [
      {
        key: 'ref',
        label: t('designation_articles.col_ref', 'REF / CODE'),
        colLetter: 'A',
        icon: Tag,
        sortable: true,
        render: (item) => {
          const refDisplay = item.ref || item.id_designation || item.id_diag || 'N/A';
          return (
            <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11.5px] font-mono font-bold text-slate-900">
              {refDisplay}
            </span>
          );
        },
      },
      {
        key: 'designation',
        label: t('designation_articles.col_designation', 'DÉSIGNATION'),
        colLetter: 'B',
        icon: Package,
        sortable: true,
        render: (item) => {
          const desigDisplay = item.designation || item.libelle || item.nom || 'Sans désignation';
          return <span className="font-semibold text-slate-900 text-[13px]">{desigDisplay}</span>;
        },
      },
      {
        key: 'id_type',
        label: t('designation_articles.col_type', 'TYPE PARENT'),
        colLetter: 'C',
        icon: Layers,
        sortable: true,
        render: (item) => {
          const typeName = item.id_type || item.type || 'Standard';
          return (
            <button
              type="button"
              onClick={() => setDesigTypeFilter(typeName)}
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold transition ${getTypeStyle(typeName)}`}
              title={t('designation_articles.filter_type_title', 'Filtrer par ce Type')}
            >
              <Tag className="w-3 h-3 opacity-70" />
              <span>{typeName}</span>
            </button>
          );
        },
      },
      {
        key: 'stockActuel',
        label: t('designation_articles.col_stock', 'STOCK ACTUEL'),
        colLetter: 'D',
        icon: Boxes,
        sortable: true,
        align: 'right',
        render: (item) => {
          const itemRefKey = String(item.ref || item.id_designation || item.id_diag || '').trim().toLowerCase();
          const itemDesigKey = String(item.designation || item.libelle || item.nom || '').trim().toLowerCase();
          const stockMatch = stockItems.find((s) => {
            const sRef = String(s.ref || '').trim().toLowerCase();
            const sDesig = String(s.designation || '').trim().toLowerCase();
            if (itemRefKey && sRef === itemRefKey) return true;
            if (itemDesigKey && sDesig === itemDesigKey) return true;
            return false;
          });
          const currentStock = stockMatch ? stockMatch.stockActuel : (item.stockActuel != null ? item.stockActuel : item.stockInitial || 0);
          return <span className="font-mono font-bold text-slate-800 text-[13px]">{currentStock}</span>;
        },
      },
      {
        key: 'alerte',
        label: t('designation_articles.col_status', 'ÉTAT'),
        colLetter: 'E',
        icon: AlertTriangle,
        sortable: true,
        align: 'center',
        render: (item) => {
          const itemRefKey = String(item.ref || item.id_designation || item.id_diag || '').trim().toLowerCase();
          const itemDesigKey = String(item.designation || item.libelle || item.nom || '').trim().toLowerCase();
          const stockMatch = stockItems.find((s) => {
            const sRef = String(s.ref || '').trim().toLowerCase();
            const sDesig = String(s.designation || '').trim().toLowerCase();
            if (itemRefKey && sRef === itemRefKey) return true;
            if (itemDesigKey && sDesig === itemDesigKey) return true;
            return false;
          });
          const currentStock = stockMatch ? stockMatch.stockActuel : (item.stockActuel != null ? item.stockActuel : item.stockInitial || 0);
          const threshold = stockMatch ? stockMatch.seuil : item.seuil || 3;
          const alertStatus = stockMatch
            ? stockMatch.alerte
            : currentStock <= 0
              ? 'RUPTURE'
              : currentStock <= threshold
                ? 'ALERTE'
                : 'OK';

          return (
            <>
              {alertStatus === 'RUPTURE' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                  <XCircle className="w-3 h-3" />
                  <span>{t('designation_articles.status_rupture', 'RUPTURE')}</span>
                </span>
              )}
              {alertStatus === 'ALERTE' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{t('designation_articles.status_alert', 'ALERTE')}</span>
                </span>
              )}
              {alertStatus === 'OK' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{t('designation_articles.status_ok', 'OK')}</span>
                </span>
              )}
            </>
          );
        },
      },
      {
        key: 'emplacement',
        label: t('designation_articles.col_location', 'EMPLACEMENT'),
        colLetter: 'F',
        icon: MapPin,
        sortable: true,
        render: (item) => {
          const itemRefKey = String(item.ref || item.id_designation || item.id_diag || '').trim().toLowerCase();
          const itemDesigKey = String(item.designation || item.libelle || item.nom || '').trim().toLowerCase();
          const stockMatch = stockItems.find((s) => {
            const sRef = String(s.ref || '').trim().toLowerCase();
            const sDesig = String(s.designation || '').trim().toLowerCase();
            if (itemRefKey && sRef === itemRefKey) return true;
            if (itemDesigKey && sDesig === itemDesigKey) return true;
            return false;
          });
          const location = stockMatch ? stockMatch.emplacement : item.emplacement || 'A1-R1';
          return <span className="font-mono text-slate-500 text-[11px]">{location}</span>;
        },
      },
      {
        key: 'actions',
        label: '•••',
        colLetter: '',
        align: 'center',
        render: (item) => {
          const refDisplay = item.ref || item.id_designation || item.id_diag || '';
          const desigDisplay = item.designation || item.libelle || item.nom || '';
          const uniqueRowKey = item.id || item.ref || item.id_designation || item.id_diag;
          const itemRefKey = String(item.ref || item.id_designation || item.id_diag || '').trim().toLowerCase();
          const itemDesigKey = String(item.designation || item.libelle || item.nom || '').trim().toLowerCase();
          const stockMatch = stockItems.find((s) => {
            const sRef = String(s.ref || '').trim().toLowerCase();
            const sDesig = String(s.designation || '').trim().toLowerCase();
            if (itemRefKey && sRef === itemRefKey) return true;
            if (itemDesigKey && sDesig === itemDesigKey) return true;
            return false;
          });
          const currentStock = stockMatch ? stockMatch.stockActuel : (item.stockActuel != null ? item.stockActuel : item.stockInitial || 0);

          return (
            <div className="relative inline-flex items-center justify-center action-menu-container">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (onNavigateToStockFilteredByRef) {
                      onNavigateToStockFilteredByRef(refDisplay || desigDisplay);
                    }
                  }}
                  className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                  title={t('designation_articles.filter_stock_title', 'Filtrer le Stock Actuel sur cet article')}
                >
                  <Warehouse className="w-3.5 h-3.5 text-slate-900" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveActionMenuId(activeActionMenuId === uniqueRowKey ? null : uniqueRowKey);
                  }}
                  className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                    activeActionMenuId === uniqueRowKey
                      ? 'bg-slate-100 text-cyan-700 font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title={t('article_types.action_options_title', 'Actions et options de la désignation')}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeActionMenuId === uniqueRowKey && (
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                  <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t('designation_articles.action_header', 'Actions Désignation PDR')}
                    </div>
                    <div className="font-mono font-bold text-xs text-slate-800 truncate mt-0.5">
                      {refDisplay} • {desigDisplay}
                    </div>
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        if (onNavigateToStockFilteredByRef) {
                          onNavigateToStockFilteredByRef(refDisplay || desigDisplay);
                        }
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-cyan-700 hover:bg-cyan-50 flex items-center gap-2 transition cursor-pointer group"
                    >
                      <Warehouse className="w-3.5 h-3.5 text-cyan-600 group-hover:scale-110 transition-transform" />
                      <span>{t('designation_articles.filter_stock_action', 'Filtrer le Stock Actuel ({{count}})', { count: currentStock })}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveActionMenuId(null);
                        setToEdit(item);
                        setForm({
                          id_type: item.id_type || item.type || '',
                          ref: item.ref || item.id_designation || item.id_diag || '',
                          designation: item.designation || item.libelle || item.nom || '',
                          stockInitial: item.stockInitial || currentStock || 5,
                          seuil: item.seuil || 3,
                          emplacement: item.emplacement || 'A1-R1',
                        });
                        setShowAddModal(true);
                      }}
                      className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-2 transition cursor-pointer group"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                      <span>{t('designation_articles.edit_designation', 'Modifier la Désignation')}</span>
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
                      <span>{t('designation_articles.delete_designation', 'Supprimer du Référentiel')}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [stockItems, activeActionMenuId, onNavigateToStockFilteredByRef, t]
  );

  return (
    <AnimatedPage className="space-y-4">
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-indigo-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent border border-indigo-200/90 shadow-[0_4px_12px_rgba(99,102,241,0.12)] flex items-center justify-center text-indigo-700 group-hover/header:scale-105 group-hover/header:border-indigo-400/80 transition-all duration-300 shrink-0">
            <BadgeCheck className="w-6 h-6 text-indigo-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              {t('designation_articles.title', "Désignations d'Articles")}
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('designation_articles.subtitle', "Catalogue d'articles de stock et pièces de rechange rattachés à un type parent (ex: Foret Beton Ø12 → Foret).")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('designation_articles.formulas_button', "Formules Excel (Désignations Articles)")}
          />

          <Action3DButton
            variant="circle"
            color="indigo"
            icon={BadgeCheck}
            showAddBadge={true}
            onClick={() => {
              const initialType =
                desigTypeFilter !== 'ALL'
                  ? desigTypeFilter
                  : types[0]?.id_type || types[0] || 'Foret';
              handleTypeSelect(initialType);
              setShowAddModal(true);
            }}
            title={t('designation_articles.new_designation_button', 'Nouvelle Désignation')}
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
                  {filtered.length} / {designations.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                {t('designation_articles.filters_subtitle', 'Référentiel des Désignations & Articles PDR • Colonnes A → F')}
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
            {(localSearch || desigTypeFilter !== 'ALL' || sortField !== 'ref' || sortOrder !== 'asc') && (
              <button
                onClick={() => {
                  setLocalSearch('');
                  setDesigTypeFilter('ALL');
                  setSortField('ref');
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          {/* Search */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('article_types.search_free', 'RECHERCHE LIBRE')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('designation_articles.col_a_b', 'Col. A+B')}
              </span>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs pointer-events-none z-10">
                <Search className="w-3 h-3" />
              </span>
              <input
                type="text"
                placeholder={t('designation_articles.search_placeholder', 'Rechercher par Ref (FORET001) ou Désignation...')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              />
              {localSearch && (
                <button
                  onClick={() => setLocalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Type Filter Select */}
          <div className="w-full">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-800">
                {t('designation_articles.type_parent_label', 'TYPE PARENT')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('designation_articles.col_c', 'Col. C')}
              </span>
            </div>
            <CustomSelect
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
                  <Tag className="w-3 h-3" />
                </span>
              }
              value={desigTypeFilter}
              onChange={(val) => setDesigTypeFilter(val)}
              options={[
                {
                  value: 'ALL',
                  label: `${t('designation_articles.all_types', "Tous les types d'articles")} (${types.length})`,
                  badge: `${designations.length}`,
                  badgeColor: 'bg-slate-100 text-slate-700 font-bold',
                },
                ...types.map((t) => {
                  const val = typeof t === 'string' ? t : t.id_type || t.libelle;
                  const label = typeof t === 'string' ? t : t.libelle || t.id_type;
                  const targetValLower = String(val).trim().toLowerCase();
                  const count = designations.filter((d) => {
                    const dt = String(d.id_type || d.type || '').trim().toLowerCase();
                    return dt === targetValLower;
                  }).length;
                  return {
                    value: val,
                    label: label,
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
                {t('designation_articles.sorting_title', 'TRI DES ENREGISTREMENTS')}
              </label>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {t('article_types.order_a_z', 'Ordre A-Z')}
              </span>
            </div>
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-10 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'ref' || sortOrder !== 'asc'
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
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    {t('designation_articles.sort_by_title', 'Trier par')}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  <button
                    onClick={() => handleTableSort('ref')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'ref'
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('designation_articles.sort_ref', 'Référence / Code (A)')}</span>
                    {sortField === 'ref' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('designation')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'designation'
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('designation_articles.sort_designation', 'Désignation / Nom (B)')}</span>
                    {sortField === 'designation' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('id_type')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'id_type'
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('designation_articles.sort_type', 'Type Parent (C)')}</span>
                    {sortField === 'id_type' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('stockActuel')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'stockActuel'
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('designation_articles.sort_stock', 'Stock Actuel (D)')}</span>
                    {sortField === 'stockActuel' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('alerte')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'alerte'
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('designation_articles.sort_alert', 'État & Alerte (E)')}</span>
                    {sortField === 'alerte' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ))}
                  </button>

                  <button
                    onClick={() => handleTableSort('emplacement')}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg font-medium transition cursor-pointer ${
                      sortField === 'emplacement'
                        ? 'bg-indigo-50 text-indigo-800 font-bold'
                        : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>{t('designation_articles.sort_location', 'Emplacement (F)')}</span>
                    {sortField === 'emplacement' &&
                      (sortOrder === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      ))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {(localSearch || desigTypeFilter !== 'ALL') && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('article_types.active_filter', 'Filtre actif :')}</span>
            {localSearch && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold">
                <Search className="w-3 h-3 text-indigo-600" />
                {t('article_types.active_search_prefix', 'Recherche: ')}&quot;{localSearch}&quot;
                <button
                  onClick={() => setLocalSearch('')}
                  className="hover:bg-indigo-200/60 p-0.5 rounded-full transition cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {desigTypeFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-800 text-xs font-semibold">
                <Tag className="w-3 h-3 text-cyan-600" />
                Type: {desigTypeFilter}
                <button
                  onClick={() => setDesigTypeFilter('ALL')}
                  className="hover:bg-cyan-200/60 p-0.5 rounded-full transition cursor-pointer"
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
        title={t('designation_articles.grid_title', "Tableau Désignations d'Articles • Colonnes A → F")}
        icon={<BadgeCheck className="w-4 h-4 text-indigo-600" />}
        excelMapping={t('designation_articles.excel_mapping', 'ref (A) | designation (B) | type (C) | stockActuel (D) | alerte (E) | emplacement (F)')}
        bannerColor="slate"
        columns={designationColumns}
        data={displayedData}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleTableSort}
        renderSortIcon={renderTableSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<BadgeCheck className="w-8 h-8 text-slate-300" />}
        emptyMessage={t('designation_articles.empty_message', "Aucune désignation trouvée")}
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'cyan',
          itemLabel: t('designation_articles.item_label', 'désignations'),
        }}
      />

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 relative">
            <button
              type="button"
              onClick={handleCloseAddModal}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              title={t('common.close', 'Fermer')}
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-bold text-base text-slate-900 mb-1">
              {t('designation_articles.add_title', "Nouvelle Désignation d'Article")}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('designation_articles.add_desc', "Désignation d'article associée à un Type parent (ex: FORET001 → Foret Beton Ø12).")}
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {t('designation_articles.type_parent_label', 'Type Parent')}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      onOpenAddTypeModal();
                    }}
                    className="text-[11px] font-semibold text-cyan-600 hover:underline"
                  >
                    + {t('article_types.new_type_button', 'Créer un Type')}
                  </button>
                </div>
                <CustomSelect
                  value={form.id_type}
                  onChange={(val) => handleTypeSelect(val)}
                  options={types.map((t) => {
                    const val = typeof t === 'string' ? t : t.id_type || t.libelle;
                    const label = typeof t === 'string' ? t : t.libelle || t.id_type;
                    return {
                      value: val,
                      label: label,
                    };
                  })}
                  placeholder="-- Sélectionner un Type --"
                />
              </div>

              <div>
                <SequentialCodePicker
                  prefix={diagPrefix}
                  currentCode={form.ref}
                  onChangeCode={(newCode) => setForm((prev) => ({ ...prev, ref: newCode }))}
                  autoGeneratedCode={form.ref}
                  takenNumbers={takenDiagNumbers}
                  padLength={3}
                  label={t('designation_articles.code_label', 'ID / Code Référence Article (B)')}
                  helperText={t('designation_articles.code_helper', 'Génération séquentielle selon le Type parent ou sélection libre')}
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  {t('designation_articles.designation_label', "Désignation d'Article")}
                </label>
                <input
                  type="text"
                  placeholder={t('designation_articles.designation_placeholder', 'Foret Beton Ø12, Cheville Ø10...')}
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t('designation_articles.stock_initial_label', 'Stock Initial')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.stockInitial}
                    onChange={(e) => setForm({ ...form, stockInitial: Number(e.target.value) })}
                    className="mt-1 w-full h-9 px-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t('designation_articles.threshold_label', 'Seuil')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.seuil}
                    onChange={(e) => setForm({ ...form, seuil: Number(e.target.value) })}
                    className="mt-1 w-full h-9 px-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-center font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t('designation_articles.location_label', 'Emplacement')}
                  </label>
                  <input
                    type="text"
                    placeholder="A1-R02"
                    value={form.emplacement}
                    onChange={(e) => setForm({ ...form, emplacement: e.target.value })}
                    className="mt-1 w-full h-9 px-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="flex-1 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium cursor-pointer"
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
            <h3 className="font-bold text-base text-slate-900 mb-1">{t('designation_articles.edit_title', 'Modifier Désignation')}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateDesignation(toEdit.ref, toEdit);
                setToEdit(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-[11px] font-bold text-slate-500">
                  {t('designation_articles.code_label', 'ID / Réf (Désignation)')}
                </label>
                <input
                  type="text"
                  value={toEdit.ref}
                  disabled
                  className="mt-1 w-full h-10 px-3 rounded-xl bg-slate-100 text-slate-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">
                  {t('designation_articles.designation_label', 'Désignation (Libellé)')}
                </label>
                <input
                  type="text"
                  value={toEdit.designation}
                  onChange={(e) => setToEdit({ ...toEdit, designation: e.target.value })}
                  required
                  className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">
                  {t('designation_articles.type_parent_label', 'Type de Pièce / Article')}
                </label>
                <CustomSelect
                  value={toEdit.id_type || toEdit.type}
                  onChange={(val) => setToEdit({ ...toEdit, id_type: val, type: val })}
                  options={types.map((t) => ({
                    value: t.id_type,
                    label: `${t.libelle} (${t.id_type})`,
                  }))}
                  placeholder="-- Sélectionner le type --"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-500">
                    {t('designation_articles.stock_initial_label', 'Stock Initial (Opt)')}
                  </label>
                  <input
                    type="number"
                    value={toEdit.stockInitial || 0}
                    onChange={(e) => setToEdit({ ...toEdit, stockInitial: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500">{t('designation_articles.threshold_label', 'Seuil Alerte')}</label>
                  <input
                    type="number"
                    value={toEdit.seuil || 0}
                    onChange={(e) => setToEdit({ ...toEdit, seuil: e.target.value })}
                    className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500">{t('designation_articles.location_label', 'Emplacement')}</label>
                <input
                  type="text"
                  value={toEdit.emplacement || ''}
                  onChange={(e) => setToEdit({ ...toEdit, emplacement: e.target.value })}
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
              <h3 className="font-bold text-lg text-slate-900">{t('designation_articles.delete_title', 'Supprimer la désignation ?')}</h3>
            </div>
            <p className="text-sm text-center text-slate-600">
              {t('designation_articles.delete_confirm', 'Confirmez-vous la suppression de {{name}} ?', { name: toDelete.ref })}
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
                  onDeleteDesignation(toDelete.ref);
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
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">{t('designation_articles.formulas_title', "Formules Excel — Désignations d'Articles")}</h3>
                  <p className="text-xs text-slate-500">{t('designation_articles.formulas_subtitle', "Formules miroir de l'onglet Désignations (GMAO)")}</p>
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
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule Type Parente</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-100 text-cyan-800">Liaison [C]</span>
                </div>
                <div className="font-mono text-xs text-cyan-800 font-bold bg-white p-2 rounded-lg border border-cyan-100">
                  =[@id_type] (Clé Type)
                </div>
                <p className="text-[11px] text-slate-500">Rattache chaque désignation au type d'article parent.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Formule Nb Articles Stock</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">COUNTIF [D]</span>
                </div>
                <div className="font-mono text-xs text-indigo-800 font-bold bg-white p-2 rounded-lg border border-indigo-100">
                  =COUNTIF(Stock_Actuel!C:C, [@designation])
                </div>
                <p className="text-[11px] text-slate-500">Compte les occurrences de la désignation dans le stock.</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/90 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quantité Totale en Stock</span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">SUMIF [E]</span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  =SUMIF(Stock!C:C, [@designation], Stock!H:H)
                </div>
                <p className="text-[11px] text-slate-500">Calcule la somme des quantités en stock pour cette désignation.</p>
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
