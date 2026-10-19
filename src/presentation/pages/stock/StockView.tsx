import { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import AnimatedPage from '../../components/common/AnimatedPage';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import QuickMovementModal from '../warehouse/QuickMovementModal';
import EditArticleModal from './EditArticleModal';
import { StockItem } from '../../../core/domain';
import StockKPIBar from './components/StockKPIBar';
import { multiTokenSearch } from '../../../utils/searchUtils';
import { usePermission } from '../../components/common/PermissionGate';
import Action3DButton from '../../components/common/Action3DButton';
import FormulasModalButton from '../../components/common/FormulasModalButton';
import IndustrialFilterCard, { FilterField, FilterSearchInput } from '../../components/common/IndustrialFilterCard';
import { useI18n } from '../../../i18n/I18nContext';
import { contextMenu } from '../../../services/ContextMenuService';
import { Logger } from '../../../core/logger/LoggerService';
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  ChevronDown,
  Tag,
  MapPin,
  TrendingDown,
  TrendingUp,
  Boxes,
  X,
  Radio,
  MoreVertical,
  Edit,
  Inbox,
  Calculator,
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

export default function StockView({
  stockItems: propStockItems = [],
  stockSearch = '',
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
  onQuickSortie: _onQuickSortie = () => {},
  onAddMouvement = () => {},
  onUpdateArticle = () => {},
  onDirectAdjustStock = () => {},
  stockKPIs = { total: 0, alertes: 0, ruptures: 0, ok: 0, totalSorties: 0, totalEntrees: 0 },
  onNavigateToType: _onNavigateToType = () => {},
}) {
  const { t } = useI18n();
  const stockItems = propStockItems || [];
  
  const [stockEmplacementFilter, setStockEmplacementFilter] = useState('ALL');

  const emplacements = useMemo(() => {
    const set = new Set();
    (stockItems || []).forEach((item) => {
      if (item.emplacement) set.add(item.emplacement);
    });
    return Array.from(set).sort();
  }, [stockItems]);

  const deferredStockSearch = useDeferredValue(stockSearch);
  const filteredStock = useMemo(() => {
    if (!stockItems || stockItems.length === 0) return [];

    return stockItems.filter((item) => {
      // Filter by type
      if (stockTypeFilter !== 'ALL') {
        const itemType = (item.id_type || item.type || '').toString();
        if (itemType !== stockTypeFilter) {
          return false;
        }
      }

      // Filter by emplacement
      if (stockEmplacementFilter !== 'ALL') {
        if (item.emplacement !== stockEmplacementFilter) {
          return false;
        }
      }

      // Filter by alert status
      const domainItem = new StockItem(item);
      if (stockAlertOnly && domainItem.getCriticite() === 'OK') {
        return false;
      }

      // Filter by search
      if (deferredStockSearch) {
        return multiTokenSearch(item, ['ref', 'designation', 'emplacement', 'type', 'id_type'], deferredStockSearch);
      }

      return true;
    });
  }, [stockItems, stockTypeFilter, stockEmplacementFilter, stockAlertOnly, deferredStockSearch]);

  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('type');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeKpiFilter, setActiveKpiFilter] = useState('ALL'); // ALL | 'OK' | 'ALERTE' | 'RUPTURE'
  const [showFormulasModal, setShowFormulasModal] = useState(false);

  // Dropdown actions popover menu state for table rows
  const [activeActionMenuRef, setActiveActionMenuRef] = useState(null);

  // Modals state
  const [quickModalState, setQuickModalState] = useState({
    isOpen: false,
    article: null,
    initialFlow: 'Sortie Interne',
    initialAction: 'CORRECTIVE',
  });

  const [editArticleModalState, setEditArticleModalState] = useState({
    isOpen: false,
    article: null,
  });

  const canEditStock = usePermission('stock.edit');

  const sortMenuRef = useRef(null);

  // Debounce state for high-performance stock searching
  const [localSearch, setLocalSearch] = useState(stockSearch);

  // Sync from parent in case a smart link modifies stockSearch externally
  useEffect(() => {
    setLocalSearch(stockSearch);
  }, [stockSearch]);

  // Debounce propagation of search input to setStockSearch
  useEffect(() => {
    const handler = setTimeout(() => {
      setStockSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch, setStockSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [stockSearch, stockTypeFilter, stockAlertOnly, activeKpiFilter, sortField, sortOrder]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target)) {
        setShowSortMenu(false);
      }
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuRef(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Pre-filter with active KPI status card if clicked
  const effectiveFiltered = useMemo(() => {
    if (activeKpiFilter === 'ALL') return filteredStock;
    return filteredStock.filter((item) => item.alerte === activeKpiFilter);
  }, [filteredStock, activeKpiFilter]);

  const sortStock = useCallback((items) => {
    if (!sortField || !items || items.length === 0) return items || [];
    const list = [...items];
    const isAsc = sortOrder === 'asc';

    return list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'alerte') {
        const priority = { RUPTURE: 0, ALERTE: 1, OK: 2 };
        valA = priority[a.alerte] ?? 3;
        valB = priority[b.alerte] ?? 3;
        if (valA !== valB) return isAsc ? valA - valB : valB - valA;
      } else if (
        ['stockInitial', 'entrees', 'sorties', 'stockActuel', 'seuil'].includes(sortField)
      ) {
        valA = Number(valA || 0);
        valB = Number(valB || 0);
        if (valA !== valB) return isAsc ? valA - valB : valB - valA;
      } else if (sortField === 'type') {
        const typeComp = String(a.type || a.id_type || '').localeCompare(
          String(b.type || b.id_type || ''),
          undefined,
          { sensitivity: 'base' }
        );
        if (typeComp !== 0) return isAsc ? typeComp : -typeComp;
        return String(a.ref || '').localeCompare(String(b.ref || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      } else {
        const strComp = String(valA || '').localeCompare(String(valB || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (strComp !== 0) return isAsc ? strComp : -strComp;
      }

      // Secondary sort by ref numeric
      return String(a.ref || '').localeCompare(String(b.ref || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [sortField, sortOrder]);

  const sortedStock = useMemo(() => {
    return sortStock(effectiveFiltered);
  }, [effectiveFiltered, sortStock]);

  const totalItems = sortedStock.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedStock =
    pageSize === 0 ? sortedStock : sortedStock.slice(startIndex, startIndex + effectivePageSize);
  const displayedStock = useMemo(() => {
    const minRows = 20;
    if (rawDisplayedStock.length >= minRows) return rawDisplayedStock;
    const padded = [...rawDisplayedStock];
    for (let i = 0; i < minRows - rawDisplayedStock.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, ref: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedStock]);


  const renderSortIcon = (field) => {
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

  const hasActiveFilters =
    stockTypeFilter !== 'ALL' ||
    stockEmplacementFilter !== 'ALL' ||
    stockAlertOnly ||
    activeKpiFilter !== 'ALL' ||
    localSearch ||
    sortField !== 'type' ||
    sortOrder !== 'asc';

  const clearAllFilters = () => {
    setStockTypeFilter('ALL');
    setStockEmplacementFilter('ALL');
    setStockAlertOnly(false);
    setActiveKpiFilter('ALL');
    setLocalSearch('');
    setSortField('type');
    setSortOrder('asc');
  };

  const stockFilterPresets = useMemo(() => [
    {
      key: 'ALL',
      label: t('common.filters.all'),
      count: stockItems.length,
      activeBg: 'bg-slate-900 text-white shadow-xs',
      onClick: () => {
        setActiveKpiFilter('ALL');
        setStockAlertOnly(false);
      },
      isActive: activeKpiFilter === 'ALL' && !stockAlertOnly,
    },
    {
      key: 'OK',
      label: t('stock.status_ok', 'Stock Normal'),
      count: stockKPIs.ok || 0,
      activeBg: 'bg-emerald-600 text-white shadow-xs',
      colorDot: 'bg-emerald-500',
      onClick: () => {
        setActiveKpiFilter('OK');
        setStockAlertOnly(false);
      },
      isActive: activeKpiFilter === 'OK',
    },
    {
      key: 'ALERTE',
      label: t('stock.status_alert', 'Alerte Seuil'),
      count: stockKPIs.alertes || 0,
      activeBg: 'bg-amber-600 text-white shadow-xs',
      colorDot: 'bg-amber-500',
      onClick: () => {
        setActiveKpiFilter('ALERTE');
        setStockAlertOnly(false);
      },
      isActive: activeKpiFilter === 'ALERTE',
    },
    {
      key: 'RUPTURE',
      label: t('stock.status_rupture', 'Rupture Stock'),
      count: stockKPIs.ruptures || 0,
      activeBg: 'bg-rose-600 text-white shadow-xs',
      colorDot: 'bg-rose-500',
      onClick: () => {
        setActiveKpiFilter('RUPTURE');
        setStockAlertOnly(false);
      },
      isActive: activeKpiFilter === 'RUPTURE',
    },
    {
      key: 'ALL_ALERTS',
      label: t('stock.all_alerts', 'Toutes Alertes'),
      count: (stockKPIs.ruptures || 0) + (stockKPIs.alertes || 0),
      activeBg: 'bg-violet-600 text-white shadow-xs',
      colorDot: 'bg-violet-500',
      onClick: () => {
        setStockAlertOnly(true);
        setActiveKpiFilter('ALL');
      },
      isActive: stockAlertOnly && activeKpiFilter === 'ALL',
    },
  ], [stockItems.length, stockKPIs, activeKpiFilter, stockAlertOnly, setActiveKpiFilter, setStockAlertOnly, t]);

  const activeStockFilterChips = useMemo(() => {
    const chips = [];
    if (localSearch) {
      chips.push({
        key: 'search',
        label: `${t('common.filters.search')}: "${localSearch}"`,
        onRemove: () => {
          setLocalSearch('');
          setStockSearch('');
        },
      });
    }
    if (stockTypeFilter !== 'ALL') {
      chips.push({
        key: 'type',
        label: `${t('stock.piece_type', 'Type')}: ${stockTypeFilter}`,
        onRemove: () => setStockTypeFilter('ALL'),
      });
    }
    if (activeKpiFilter !== 'ALL') {
      chips.push({
        key: 'state',
        label: `${t('common.filters.state')} ${activeKpiFilter}`,
        onRemove: () => setActiveKpiFilter('ALL'),
      });
    }
    if (stockAlertOnly && activeKpiFilter === 'ALL') {
      chips.push({
        key: 'alerts',
        label: t('stock.all_alerts', 'Toutes Alertes'),
        onRemove: () => setStockAlertOnly(false),
      });
    }
    if (stockEmplacementFilter !== 'ALL') {
      chips.push({
        key: 'emplacement',
        label: `${t('stock.emplacement', 'Emplacement')}: ${stockEmplacementFilter}`,
        onRemove: () => setStockEmplacementFilter('ALL'),
      });
    }
    return chips;
  }, [localSearch, stockTypeFilter, activeKpiFilter, stockAlertOnly, stockEmplacementFilter, setStockSearch, setActiveKpiFilter, setStockTypeFilter, setStockAlertOnly, setStockEmplacementFilter, t]);

  const handleExportExcel = () => {
    try {
      const headers = [
        'REF (B)',
        'DÉSIGNATION (C)',
        'TYPE (D)',
        'STOCK INITIAL (E)',
        'ENTRÉES (F)',
        'SORTIES (G)',
        'STOCK ACTUEL (H)',
        'SEUIL (I)',
        'ALERTE (J)',
        'EMPLACEMENT (K)',
      ];
      const rows = effectiveFiltered.map((item) => [
        item.ref || '',
        item.designation || '',
        item.type || item.id_type || '',
        item.stockInitial || 0,
        item.entrees || 0,
        item.sorties || 0,
        item.stockActuel || 0,
        item.seuil || 0,
        item.alerte || '',
        item.emplacement || '',
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [
          headers.join(';'),
          ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')),
        ].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `GMAO_Stock_Actuel_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      Logger.error('Export error in StockView:', e);
    }
  };

  const handleOpenQuickModal = (item, flow, action) => {
    setQuickModalState({
      isOpen: true,
      article: item,
      initialFlow: flow,
      initialAction: action,
    });
    setActiveActionMenuRef(null);
  };

  const handleOpenEditArticle = (item) => {
    setEditArticleModalState({
      isOpen: true,
      article: item,
    });
    setActiveActionMenuRef(null);
  };

  const handleRowContextMenu = (e, item) => {
    contextMenu.show(
      e,
      [
        {
          id: 'edit',
          label: t('stock.context.edit', 'Modifier l’article'),
          onClick: () => handleOpenEditArticle(item),
        },
        {
          id: 'quick-sortie',
          label: t('stock.context.quick_sortie', 'Sortie directe (Sortie PDR)'),
          onClick: () => handleOpenQuickModal(item, 'Sortie', 'CORRECTIVE'),
        },
        {
          id: 'quick-entree',
          label: t('stock.context.quick_entree', 'Entrée directe (Réapprovisionnement)'),
          onClick: () => handleOpenQuickModal(item, 'Entrée', 'REAPPRO'),
        },
        { separator: true },
        {
          id: 'copy-ref',
          label: t('stock.context.copy_ref', { ref: item.ref }),
          onClick: () => {
            if (navigator.clipboard) {
              navigator.clipboard.writeText(item.ref);
            }
          },
        },
      ],
      `Article: ${item.ref}`
    );
  };

  const stockColumns = useMemo(
    () => [
      {
        key: 'ref',
        label: t('stock.fields.ref', 'REF'),
        colLetter: 'B',
        icon: Tag,
        sortable: true,
      },
      {
        key: 'designation',
        label: t('stock.fields.designation', 'DÉSIGNATION'),
        colLetter: 'C',
        icon: Package,
        sortable: true,
        headerClassName: 'min-w-[220px]',
      },
      {
        key: 'type',
        label: t('stock.fields.type', 'TYPE'),
        colLetter: 'D',
        icon: Boxes,
        sortable: true,
      },
      {
        key: 'stockInitial',
        label: t('stock.fields.initial', 'INITIAL'),
        colLetter: 'E',
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
        sortable: true,
        align: 'right',
      },
      {
        key: 'seuil',
        label: t('stock.fields.threshold', 'SEUIL'),
        colLetter: 'I',
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
      {/* Top Banner (BDR Light GMAO Header Card with 3D Tactile Elevation) */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden group/header">
        {/* Subtle Ambient Gradient Background Highlight */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none group-hover/header:bg-cyan-500/10 transition-colors duration-500" />

        <div className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 relative">
          {/* 3D Elevated Page Badge Icon */}
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent border border-cyan-200/90 shadow-[0_4px_12px_rgba(6,182,212,0.12)] flex items-center justify-center text-cyan-700 group-hover/header:scale-105 group-hover/header:border-cyan-400/80 transition-all duration-300 shrink-0">
            <Package className="w-6 h-6 text-cyan-700 transition-transform duration-300 group-hover/header:scale-110" />
          </div>

          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{t('stock.title_full', 'Stock Actuel & Catalogue Pièces de Rechange (PDR)')}</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
              {t('stock.banner_desc', 'Tableau central miroir de Stock_Actuel (Excel B → K). Calcul temps réel : Stock Actuel = Initial (E) + Entrées (F) - Sorties (G) avec menu d\'actions et flux directs.')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 relative">
          {/* 3D Formula Circular Trigger Button */}
          <FormulasModalButton
            onClick={() => setShowFormulasModal(true)}
            title={t('stock.formulas_button', 'Formules Excel (Col. B → K)')}
          />

          {/* 3D Primary Add Article Button */}
          <Action3DButton
            variant="circle"
            color="cyan"
            icon={Package}
            showAddBadge={true}
            onClick={onOpenAddArticle}
            title={t('stock.new_article_button', 'Nouvel Article')}
          />
        </div>
      </div>

      {/* KPI Cards Bar (Interactive Clickable Filters) */}
      <StockKPIBar
        stockItems={stockItems}
        stockKPIs={stockKPIs}
        types={types}
        activeKpiFilter={activeKpiFilter}
        setActiveKpiFilter={setActiveKpiFilter}
        stockAlertOnly={stockAlertOnly}
        setStockAlertOnly={setStockAlertOnly}
      />

      {/* 4. Central Unified Industrial Filter & Search Card */}
      <IndustrialFilterCard
        title={t('common.filters.title')}
        subtitle={t('stock.filters_subtitle', 'Catalogue Pièces de Rechange • Liaisons Excel Colonnes B → K')}
        color="cyan"
        filteredCount={effectiveFiltered.length}
        totalCount={stockItems.length}
        hasActiveFilters={hasActiveFilters}
        onReset={clearAllFilters}
        onExportExcel={handleExportExcel}
        exportLabel={t('common.filters.export_excel')}
        presets={stockFilterPresets}
        presetsLabel={t('common.filters.state')}
        activeFilters={activeStockFilterChips}
        onClearAll={clearAllFilters}
      >
        {/* 5-Column Multi-Criteria Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
          {/* 1. Omni-Text Search */}
          <FilterSearchInput
            value={localSearch}
            onChange={setLocalSearch}
            onClear={() => {
              setLocalSearch('');
              setStockSearch('');
            }}
            placeholder={t('stock.search_placeholder', 'Ref, désignation, emplacement...')}
            colBadge="Col. B+C"
            colBadgeColor="slate"
            focusRingColor="focus:ring-cyan-500"
            className="w-full sm:col-span-2 lg:col-span-1"
          />

          {/* 2. Type de Pièce (Col. D) */}
          <FilterField label={t('stock.piece_type', 'Type de Pièce')} colBadge="Col. D" colBadgeColor="cyan">
            <CustomSelect
              value={stockTypeFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-cyan-100 border border-cyan-300/80 flex items-center justify-center text-cyan-700 shadow-2xs">
                  <Boxes className="w-3 h-3" />
                </span>
              }
              onChange={(val) => setStockTypeFilter(val)}
              options={[
                { value: 'ALL', label: `${t('stock.all_types', 'Tous les Types')} (${types.length})` },
                ...types.map((tItem) => {
                  const val = typeof tItem === 'string' ? tItem : tItem.id_type || tItem.libelle;
                  const label = typeof tItem === 'string' ? tItem : tItem.libelle || tItem.id_type;
                  return {
                    value: val,
                    label: `${label}`,
                  };
                }),
              ]}
            />
          </FilterField>

          {/* 3. État / Alerte (Col. J) */}
          <FilterField label={t('stock.state_alert', 'État / Alerte')} colBadge="Col. J" colBadgeColor="amber">
            <CustomSelect
              value={activeKpiFilter !== 'ALL' ? activeKpiFilter : stockAlertOnly ? 'ALL_ALERTS' : 'ALL'}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <AlertTriangle className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                if (val === 'ALL') {
                  setActiveKpiFilter('ALL');
                  setStockAlertOnly(false);
                } else if (val === 'ALL_ALERTS') {
                  setActiveKpiFilter('ALL');
                  setStockAlertOnly(true);
                } else {
                  setActiveKpiFilter(val);
                  setStockAlertOnly(false);
                }
              }}
              options={[
                { value: 'ALL', label: t('stock.all_states', 'Tous États') },
                { value: 'OK', label: t('stock.state_ok', '🟢 Stock Normal (OK)') },
                { value: 'ALERTE', label: t('stock.state_alert_opt', '🟡 Alerte Seuil') },
                { value: 'RUPTURE', label: t('stock.state_rupture_opt', '🔴 Rupture de Stock') },
                { value: 'ALL_ALERTS', label: t('stock.all_alerts', '⚡ Toutes Alertes') },
              ]}
            />
          </FilterField>

          {/* 4. Emplacement (Col. K) */}
          <FilterField label={t('stock.emplacement', 'Emplacement')} colBadge="Col. K" colBadgeColor="purple">
            <CustomSelect
              value={stockEmplacementFilter}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-purple-100 border border-purple-300/80 flex items-center justify-center text-purple-700 shadow-2xs">
                  <MapPin className="w-3 h-3" />
                </span>
              }
              onChange={(val) => setStockEmplacementFilter(val)}
              options={[
                { value: 'ALL', label: t('stock.all_emplacements', 'Tous Emplacements') },
                ...emplacements.map((emp) => ({
                  value: emp,
                  label: emp,
                })),
              ]}
            />
          </FilterField>

          {/* 5. Sort Menu Button & Popover */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>{t('common.filters.sort_and_order', 'Tri & Ordre')}</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Col. B→K
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'type' || sortOrder !== 'asc'
                  ? 'bg-indigo-50/80 text-indigo-950 border-indigo-300 ring-1 ring-indigo-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span className="truncate">
                  {t('common.filters.sort_prefix', 'Tri :')} <b className="font-mono text-slate-900">{sortField.slice(0, 10).toUpperCase()}</b> (
                  {sortOrder === 'asc' ? t('common.filters.asc', 'A→Z') : t('common.filters.desc', 'Z→A')})
                </span>
              </div>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${showSortMenu ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Sort Popover Menu */}
            {showSortMenu && (
              <div className="absolute right-0 mt-1 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-2.5 space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>{t('common.filters.sort_columns_title', 'Sélectionner la Colonne de Tri')}</span>
                  <span>B→K</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                  {[
                    { key: 'ref', label: t('stock.columns.ref', 'REF (Col. B)') },
                    { key: 'designation', label: t('stock.columns.designation', 'Désignation (Col. C)') },
                    { key: 'type', label: t('stock.columns.type', 'Type de Pièce (Col. D)') },
                    { key: 'stockInitial', label: t('stock.columns.initial', 'Stock Initial (Col. E)') },
                    { key: 'entrees', label: t('stock.columns.entrees', 'Entrées Réappro (Col. F)') },
                    { key: 'sorties', label: t('stock.columns.sorties', 'Sorties Totales (Col. G)') },
                    { key: 'stockActuel', label: t('stock.columns.actuel', 'Stock Actuel (Col. H)') },
                    { key: 'seuil', label: t('stock.columns.seuil', 'Seuil Critique (Col. I)') },
                    { key: 'alerte', label: t('stock.columns.alerte', 'Alerte & État (Col. J)') },
                    { key: 'emplacement', label: t('stock.columns.emplacement', 'Emplacement (Col. K)') },
                  ].map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => {
                        handleSort(col.key);
                        setShowSortMenu(false);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-left font-medium text-[11px] flex items-center justify-between transition cursor-pointer ${
                        sortField === col.key
                          ? 'bg-indigo-50 text-indigo-950 border-indigo-300 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <span>{col.label}</span>
                      {sortField === col.key && (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="w-3.5 h-3.5 text-indigo-700" />
                        ) : (
                          <ArrowDown className="w-3.5 h-3.5 text-indigo-700" />
                        )
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </IndustrialFilterCard>

      {/* Unified Industrial Data Grid */}
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
        renderRow={(item, idx) => {
          const rowNum = startIndex + idx + 1;
          if (item.__isEmptyPlaceholder) {
            return (
              <tr key={`empty-stock-${rowNum}-${idx}`} className="border-b border-slate-100 bg-white/40 select-none">
                <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-300 bg-slate-100/40 border-r border-slate-200/80">
                  {rowNum}
                </td>
                <td colSpan={11} className="py-3 px-3 text-center text-slate-300 font-mono text-[11px]">
                  —
                </td>
              </tr>
            );
          }
                  const domainItem = new StockItem(item);
                  const typeObj = types.find(
                    (t) => t.id_type === item.id_type || t.libelle === item.type
                  );
                  const isMenuOpen = activeActionMenuRef === item.ref;

                  return (
                    <tr
                      key={`stock-row-${item.id || item.ref || 'stk'}-${rowNum}`}
                      onContextMenu={(e) => handleRowContextMenu(e, item)}
                      className="even:bg-slate-50/70 odd:bg-white hover:bg-cyan-50/40 border-b border-slate-200/70 transition-colors"
                    >
                      {/* Row N° Column */}
                      <td className="py-3 px-3 text-center font-mono text-[11px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0">
                        {rowNum}
                      </td>

                      {/* Ref */}
                      <td className="py-3 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                          {item.ref}
                        </span>
                      </td>

                      {/* Désignation */}
                      <td className="py-3 px-3.5 font-bold text-slate-900 whitespace-nowrap">
                        {item.designation}
                      </td>

                      {/* Type (Badge) */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <button
                          onClick={() => {
                            const filterVal = item.type || item.id_type;
                            if (filterVal) {
                              setStockTypeFilter(filterVal);
                            }
                          }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer shadow-2xs ${getTypeStyle(item.type)}`}
                          title={t('stock.filter_by_type_tooltip', 'Filtrer par ce Type')}
                        >
                          <span>{item.type || (typeObj ? typeObj.libelle : item.id_type)}</span>
                        </button>
                      </td>

                      {/* Initial (E) */}
                      <td className="py-3 px-2.5 text-right font-mono text-slate-600">
                        {item.stockInitial}
                      </td>

                      {/* Entrées (F) */}
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-emerald-700">
                        {item.entrees > 0 ? `+${item.entrees}` : '0'}
                      </td>

                      {/* Sorties (G) */}
                      <td className="py-3 px-2.5 text-right font-mono font-bold text-rose-700">
                        {item.sorties > 0 ? `-${item.sorties}` : '0'}
                      </td>

                      {/* Actuel (H) */}
                      <td className="py-3 px-2.5 text-right font-mono font-black text-slate-900 text-sm">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          {domainItem.getActuel()}
                        </span>
                      </td>

                      {/* Seuil (I) */}
                      <td className="py-3 px-2.5 text-right font-mono text-slate-500 font-semibold">
                        {domainItem.getSeuilAlerte()}
                      </td>

                      {/* Alerte Badge (J) */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {domainItem.getCriticite() === 'RUPTURE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-300">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{t('stock.status_rupture', 'RUPTURE')}</span>
                          </span>
                        )}
                        {domainItem.getCriticite() === 'ALERTE' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-300">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{t('stock.status_alert', 'ALERTE')}</span>
                          </span>
                        )}
                        {domainItem.getCriticite() === 'OK' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('stock.status_ok', 'OK')}</span>
                          </span>
                        )}
                      </td>

                      {/* Emplacement (K) */}
                      <td className="py-3 px-3.5 font-mono text-slate-700 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                          <MapPin className="w-3 h-3 text-purple-500" />
                          <span>{item.emplacement || t('stock.not_assigned', 'Non assigné')}</span>
                        </span>
                      </td>

                      {/* Quick Actions & Flux Menu (PDR Specialized) */}
                      <td className="py-3 px-3.5 text-center whitespace-nowrap action-menu-container relative">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Primary Fast Button: Quick Sortie */}
                          <button
                            onClick={() => handleOpenQuickModal(item, 'Sortie Interne', 'CORRECTIVE')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                            title={t('stock.quick_sortie_title', 'Sortie Rapide / Intervention')}
                          >
                            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                            <span>{t('stock.actions.quick_sortie', 'Sortie')}</span>
                          </button>

                          {/* Quick Dropdown Actions Button */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() =>
                                setActiveActionMenuRef(isMenuOpen ? null : item.ref)
                              }
                              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition cursor-pointer ${
                                isMenuOpen
                                  ? 'bg-cyan-100 text-cyan-900 border-cyan-400 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                              title={t('stock.actions_menu_title', 'Menu des Flux & Actions rapides')}
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 p-2 space-y-1 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                                <div className="px-2.5 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                  <span>{t('stock.flux_menu_header', 'FLUX & ACTIONS PDR')}</span>
                                  <span className="font-mono text-cyan-800">{item.ref}</span>
                                </div>

                                {/* 1. Sortie Interne */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickModal(item, 'Sortie Interne', 'CORRECTIVE')}
                                  className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-950 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                                    <TrendingDown className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="font-bold">{t('stock.actions.quick_sortie', 'Sortie Interne')}</div>
                                    <div className="text-[10px] text-slate-400">{t('stock.actions.quick_sortie_sub', 'Corrective, Préventive, Usage')}</div>
                                  </div>
                                </button>

                                {/* 2. Entrée Interne */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickModal(item, 'Entrée Interne', 'RETOUR')}
                                  className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-950 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-cyan-100 flex items-center justify-center text-cyan-600 shrink-0">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="font-bold">{t('stock.actions.quick_entree', 'Entrée Interne')}</div>
                                    <div className="text-[10px] text-slate-400">{t('stock.actions.quick_entree_sub', 'Retour Atelier, Récupération')}</div>
                                  </div>
                                </button>

                                {/* 3. Entrée Externe (Réapprovisionnement) */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickModal(item, 'Entrée Externe', 'REAPPRO')}
                                  className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-950 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                    <Inbox className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="font-bold">{t('stock.actions.external_entree', 'Entrée Externe')}</div>
                                    <div className="text-[10px] text-slate-400">{t('stock.actions.external_entree_sub', 'Réappro Fournisseur (+ Qté)')}</div>
                                  </div>
                                </button>

                                {/* 4. Ajustement Inventaire & Recalibrage */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenQuickModal(item, 'Ajustement', 'INVENTAIRE')}
                                  className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-950 flex items-center gap-2 transition cursor-pointer"
                                >
                                  <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                  </div>
                                  <div>
                                    <div className="font-bold">{t('stock.actions.adjust_stock', 'Ajuster le Stock')}</div>
                                    <div className="text-[10px] text-slate-400">{t('stock.actions.adjust_stock_sub', 'Corriger valeur réelle / écart')}</div>
                                  </div>
                                </button>

                                {canEditStock && (
                                  <div className="border-t border-slate-100 my-1 pt-1">
                                    {/* 5. Modifier la fiche Article */}
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditArticle(item)}
                                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 transition cursor-pointer"
                                    >
                                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                                        <Edit className="w-3.5 h-3.5" />
                                      </div>
                                      <div>
                                        <div className="font-bold text-slate-800">{t('stock.actions.edit_article', 'Modifier l\'Article')}</div>
                                        <div className="text-[10px] text-slate-400">{t('stock.actions.edit_article_sub', 'Désignation, Seuil, Emplacement')}</div>
                                      </div>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                }}
      />

      {/* Quick Movement & Flux Modal */}
      <QuickMovementModal
        isOpen={quickModalState.isOpen}
        onClose={() => setQuickModalState({ isOpen: false, article: null, initialFlow: 'Sortie Interne', initialAction: 'CORRECTIVE' })}
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

      {/* Edit Article Modal */}
      <EditArticleModal
        isOpen={editArticleModalState.isOpen}
        onClose={() => setEditArticleModalState({ isOpen: false, article: null })}
        article={editArticleModalState.article}
        types={types}
        onUpdateArticle={onUpdateArticle}
        onOpenAddTypeModal={onOpenAddArticle}
      />

      {/* Excel Formulas Preview Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <span>Formules Excel Miroir — Stock_Actuel</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Colonnes B → K
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Règles de calcul et formules automatiques synchronisées avec le modèle GMAO_Light_Template_V2
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content: 4 Formula Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Formule F */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-blue-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">Formule F : Entrées</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100/80 text-blue-800 border border-blue-200 shrink-0">
                    Col. [F] (+)
                  </span>
                </div>
                <div className="font-mono text-xs text-blue-800 font-bold bg-white p-2 rounded-lg border border-blue-100">
                  =SUMIFS(Mvt[Qté], Mvt[Type], "Entrée")
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Calcule la somme automatique de toutes les entrées et réapprovisionnements validés.
                </p>
              </div>

              {/* Formule G */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-rose-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <TrendingDown className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span className="truncate">Formule G : Sorties</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-rose-100/80 text-rose-800 border border-rose-200 shrink-0">
                    Col. [G] (−)
                  </span>
                </div>
                <div className="font-mono text-xs text-rose-800 font-bold bg-white p-2 rounded-lg border border-rose-100">
                  =SUMIFS(Mvt[Qté], Mvt[Type], "Sortie")
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Calcule le cumul des pièces consommées sur les bons de travail et interventions.
                </p>
              </div>

              {/* Formule H */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-emerald-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">Formule H : Stock Actuel</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200 shrink-0">
                    Col. [H] = E+F−G
                  </span>
                </div>
                <div className="font-mono text-xs text-emerald-800 font-bold bg-white p-2 rounded-lg border border-emerald-100">
                  = Initial (E) + Entrées (F) - Sorties (G)
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Détermine le solde physique disponible à l’instant T dans le magasin.
                </p>
              </div>

              {/* Formule J */}
              <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 flex flex-col justify-between gap-2 hover:border-amber-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 truncate">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Formule J : Statut Alerte</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100/80 text-amber-800 border border-amber-200 shrink-0">
                    Col. [J] Statut
                  </span>
                </div>
                <div className="font-mono text-xs text-amber-800 font-bold bg-white p-2 rounded-lg border border-amber-100">
                  =IF(H&lt;=0, "RUPTURE", IF(H&lt;=I, "ALERTE", "OK"))
                </div>
                <p className="text-[10.5px] text-slate-500 leading-tight">
                  Évalue si le stock atteint la rupture (≤ 0) ou passe en dessous du seuil d’alerte (≤ Seuil I).
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Conforme à 100% avec le fichier Excel modèle <span className="font-mono text-slate-600">GMAO_Light_Template_V2</span>
              </span>
              <button
                onClick={() => setShowFormulasModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatedPage>
  );
}
