import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useDeferredValue,
  type MouseEvent,
} from 'react';
import { StockItem } from '../../../../core/domain';
import { multiTokenSearch } from '../../../../utils/searchUtils';
import { usePermission } from '../../../components/common/PermissionGate';
import { useI18n } from '../../../../i18n/I18nContext';
import { contextMenu, type ContextMenuItem } from '../../../../services/ContextMenuService';
import { Logger } from '../../../../core/logger/LoggerService';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import {
  computeReservedStockMap,
  computeStockReorderAlerts,
} from '../../../../core/security/validationReconciliation';
import {
  listPdrTypesByGroup,
  listStockItemsByGroupType,
  resolvePdrHierarchy,
} from '../../../../domain/stock/pdrHierarchyService';
import type {
  IMachine,
  IMouvement,
  IOperation,
  IStockItem,
  ITechnician,
  IType,
  IZone,
  PdrGroup,
} from '../../../../types/domain';

export interface StockKPIsSummary {
  total: number;
  alertes: number;
  ruptures: number;
  ok: number;
  totalSorties: number;
  totalEntrees: number;
}

export interface StockQuickModalState {
  isOpen: boolean;
  article: IStockItem | null;
  initialFlow: string;
  initialAction: string;
}

export interface StockEditModalState {
  isOpen: boolean;
  article: IStockItem | null;
}

export interface StockViewProps {
  stockItems?: IStockItem[];
  stockSearch?: string;
  setStockSearch?: (val: string) => void;
  stockTypeFilter?: string;
  setStockTypeFilter?: (val: string) => void;
  stockAlertOnly?: boolean;
  setStockAlertOnly?: (val: boolean) => void;
  types?: IType[];
  zones?: IZone[];
  machines?: IMachine[];
  technicians?: ITechnician[];
  operations?: IOperation[];
  mouvements?: IMouvement[];
  onOpenAddArticle?: () => void;
  onQuickSortie?: (...args: unknown[]) => void;
  onAddMouvement?: (mvt: Partial<IMouvement>) => void;
  onUpdateArticle?: (...args: unknown[]) => void;
  onDirectAdjustStock?: (...args: unknown[]) => void;
  stockKPIs?: StockKPIsSummary;
  onNavigateToType?: (...args: unknown[]) => void;
  onNavigateToPdrGroups?: () => void;
  pdrGroups?: PdrGroup[];
  setPdrGroups?: (groups: PdrGroup[]) => void;
}

const DEFAULT_KPIS: StockKPIsSummary = {
  total: 0,
  alertes: 0,
  ruptures: 0,
  ok: 0,
  totalSorties: 0,
  totalEntrees: 0,
};

export function isArchivedStockArticle(
  item: Partial<IStockItem> | Record<string, unknown> | null | undefined
): boolean {
  if (!item || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  const statusUpper = String(rec.statut || rec.status || '').trim().toUpperCase();
  return (
    rec.is_active === false ||
    rec.actif === false ||
    rec.archived === true ||
    statusUpper === 'ARCHIVE' ||
    statusUpper === 'ARCHIVEE' ||
    statusUpper === 'ARCHIVED'
  );
}

export function useStockViewController({
  stockItems: propStockItems = [],
  stockSearch = '',
  setStockSearch = () => {},
  stockTypeFilter = 'ALL',
  setStockTypeFilter = () => {},
  stockAlertOnly = false,
  setStockAlertOnly = () => {},
  types = [],
  stockKPIs = DEFAULT_KPIS,
  pdrGroups: propPdrGroups = [],
  setPdrGroups: propSetPdrGroups,
}: StockViewProps) {
  const { t } = useI18n();
  const stockItems = useMemo(() => propStockItems || [], [propStockItems]);
  const storePdrGroups = useGmaoStore((s) => s.pdrGroups);
  const setStorePdrGroups = useGmaoStore((s) => s.setPdrGroups);
  const effectivePdrGroups = useMemo(
    () => (propPdrGroups && propPdrGroups.length > 0 ? propPdrGroups : storePdrGroups || []),
    [propPdrGroups, storePdrGroups]
  );
  const effectiveSetPdrGroups = propSetPdrGroups || setStorePdrGroups;

  const [stockGroupFilter, setStockGroupFilter] = useState('ALL');
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showPdrExcelModal, setShowPdrExcelModal] = useState(false);
  const [showReorderPanel, setShowReorderPanel] = useState(false);
  const [showReplenishmentModal, setShowReplenishmentModal] = useState(false);
  const [showLotCumpModal, setShowLotCumpModal] = useState(false);
  const [showFormulasModal, setShowFormulasModal] = useState(false);
  const [stockEmplacementFilter, setStockEmplacementFilter] = useState('ALL');
  const [stockCriticiteFilter, setStockCriticiteFilter] = useState('ALL');
  const [stockDomaineFilter, setStockDomaineFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState('type');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [activeKpiFilter, setActiveKpiFilter] = useState('ALL');
  const [activeActionMenuRef, setActiveActionMenuRef] = useState<string | null>(null);

  const [quickModalState, setQuickModalState] = useState<StockQuickModalState>({
    isOpen: false,
    article: null,
    initialFlow: 'Sortie Interne',
    initialAction: 'CORRECTIVE',
  });

  const [editArticleModalState, setEditArticleModalState] = useState<StockEditModalState>({
    isOpen: false,
    article: null,
  });

  const canEditStock = usePermission('stock.edit');
  const canCreateStock = usePermission('stock.create');
  const canCreateMovement = usePermission('movement.create');

  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [localSearch, setLocalSearch] = useState(stockSearch);

  useEffect(() => {
    setLocalSearch(stockSearch);
  }, [stockSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setStockSearch(localSearch);
    }, 200);
    return () => clearTimeout(handler);
  }, [localSearch, setStockSearch]);

  useEffect(() => {
    setCurrentPage(1);
  }, [stockSearch, stockTypeFilter, stockAlertOnly, activeKpiFilter, sortField, sortOrder]);

  useEffect(() => {
    function handleClickOutside(event: globalThis.MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (sortMenuRef.current && target && !sortMenuRef.current.contains(target)) {
        setShowSortMenu(false);
      }
      if (target && !target.closest('.action-menu-container')) {
        setActiveActionMenuRef(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const availableTypes = useMemo(
    () => listPdrTypesByGroup(types, stockGroupFilter),
    [types, stockGroupFilter]
  );

  const storeCorrective = useGmaoStore((s) => s.correctiveInterventions);
  const storePreventiveExecs = useGmaoStore((s) => s.preventiveExecutions);
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands);
  const storePreventiveTasks = useGmaoStore((s) => s.preventiveTasks);

  const reservedStockMap = useMemo(
    () =>
      computeReservedStockMap({
        correctiveInterventions: storeCorrective,
        preventiveExecutions: storePreventiveExecs,
        sortieDemands: storeSortieDemands,
        preventiveTasks: storePreventiveTasks,
      }),
    [storeCorrective, storePreventiveExecs, storeSortieDemands, storePreventiveTasks]
  );

  const getReservedEntry = useCallback(
    (ref?: string) => {
      const key = String(ref || '').trim().toUpperCase();
      return key ? reservedStockMap.get(key) || null : null;
    },
    [reservedStockMap]
  );

  const activeOnlyStockItems = useMemo(
    () => stockItems.filter((item) => !isArchivedStockArticle(item)),
    [stockItems]
  );

  const archivedStockCount = useMemo(
    () => stockItems.filter((item) => isArchivedStockArticle(item)).length,
    [stockItems]
  );

  const reservedSummary = useMemo(() => {
    let articlesCount = 0;
    let totalUnits = 0;
    let riskCount = 0;
    for (const item of activeOnlyStockItems) {
      const entry = getReservedEntry(item.ref);
      if (entry && entry.reservedQty > 0) {
        articlesCount += 1;
        totalUnits += entry.reservedQty;
        const domainItem = new StockItem(item);
        const netDispo = domainItem.getActuel() - entry.reservedQty;
        if (netDispo <= domainItem.getSeuilAlerte()) {
          riskCount += 1;
        }
      }
    }
    return { articlesCount, totalUnits, riskCount };
  }, [activeOnlyStockItems, getReservedEntry]);

  const reorderAlerts = useMemo(
    () =>
      computeStockReorderAlerts({
        stockItems: activeOnlyStockItems,
        reservedStockMap,
      }),
    [activeOnlyStockItems, reservedStockMap]
  );

  const emplacements = useMemo(() => {
    const set = new Set<string>();
    activeOnlyStockItems.forEach((item) => {
      if (item.emplacement) set.add(String(item.emplacement));
    });
    return Array.from(set).sort();
  }, [activeOnlyStockItems]);

  const deferredStockSearch = useDeferredValue(stockSearch);
  const filteredStock = useMemo(() => {
    if (!stockItems.length) return [];

    const sourceList =
      activeKpiFilter === 'ARCHIVE'
        ? stockItems.filter((item) => isArchivedStockArticle(item))
        : activeOnlyStockItems;

    const baseGroupFiltered = listStockItemsByGroupType(
      sourceList,
      types,
      stockGroupFilter,
      stockTypeFilter
    );

    return baseGroupFiltered.filter((item) => {
      if (stockEmplacementFilter !== 'ALL' && item.emplacement !== stockEmplacementFilter) {
        return false;
      }
      if (stockCriticiteFilter !== 'ALL') {
        const itemCrit = String(item.criticite || 'B').trim().toUpperCase();
        if (itemCrit !== stockCriticiteFilter) return false;
      }
      if (stockDomaineFilter !== 'ALL') {
        const hierarchy = resolvePdrHierarchy(item, effectivePdrGroups, types);
        const effDomaine = String(
          item.domaine_technique ||
            hierarchy.type?.domaine_technique ||
            hierarchy.group?.domaine_technique ||
            ''
        )
          .trim()
          .toUpperCase();
        if (effDomaine !== stockDomaineFilter) return false;
      }
      const domainItem = new StockItem(item);
      if (stockAlertOnly && domainItem.getCriticite() === 'OK') {
        return false;
      }
      if (deferredStockSearch) {
        return multiTokenSearch(
          item,
          [
            'ref',
            'designation',
            'emplacement',
            'type',
            'id_type',
            'id_group',
            'ref_constructeur',
            'code_equivalents',
            'domaine_technique',
            'unite_mesure',
            'criticite',
          ],
          deferredStockSearch
        );
      }
      return true;
    });
  }, [
    stockItems,
    activeOnlyStockItems,
    activeKpiFilter,
    types,
    effectivePdrGroups,
    stockGroupFilter,
    stockTypeFilter,
    stockEmplacementFilter,
    stockCriticiteFilter,
    stockDomaineFilter,
    stockAlertOnly,
    deferredStockSearch,
  ]);

  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortField(field);
        setSortOrder('asc');
      }
    },
    [sortField]
  );

  const effectiveFiltered = useMemo(() => {
    if (activeKpiFilter === 'ALL' || activeKpiFilter === 'ARCHIVE') return filteredStock;
    if (activeKpiFilter === 'RESERVED') {
      return filteredStock.filter((item) => {
        const entry = getReservedEntry(item.ref);
        return Boolean(entry && entry.reservedQty > 0);
      });
    }
    return filteredStock.filter((item) => item.alerte === activeKpiFilter);
  }, [filteredStock, activeKpiFilter, getReservedEntry]);

  const sortedStock = useMemo(() => {
    if (!sortField || !effectiveFiltered.length) return effectiveFiltered;
    const list = [...effectiveFiltered];
    const isAsc = sortOrder === 'asc';
    const alertPriority: Record<string, number> = { RUPTURE: 0, ALERTE: 1, OK: 2 };

    return list.sort((a, b) => {
      const recA = a as unknown as Record<string, unknown>;
      const recB = b as unknown as Record<string, unknown>;
      let valA = recA[sortField];
      let valB = recB[sortField];

      if (sortField === 'alerte') {
        const pA = alertPriority[String(a.alerte || '')] ?? 3;
        const pB = alertPriority[String(b.alerte || '')] ?? 3;
        if (pA !== pB) return isAsc ? pA - pB : pB - pA;
      } else if (
        ['stockInitial', 'entrees', 'sorties', 'stockActuel', 'seuil'].includes(sortField)
      ) {
        const nA = Number(valA || 0);
        const nB = Number(valB || 0);
        if (nA !== nB) return isAsc ? nA - nB : nB - nA;
      } else if (sortField === 'type') {
        const typeComp = String(a.type || a.id_type || '').localeCompare(
          String(b.type || b.id_type || ''),
          undefined,
          { sensitivity: 'base' }
        );
        if (typeComp !== 0) return isAsc ? typeComp : -typeComp;
      } else {
        const strComp = String(valA || '').localeCompare(String(valB || ''), undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (strComp !== 0) return isAsc ? strComp : -strComp;
      }

      return String(a.ref || '').localeCompare(String(b.ref || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [effectiveFiltered, sortField, sortOrder]);

  const totalItems = sortedStock.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const displayedStock =
    pageSize === 0 ? sortedStock : sortedStock.slice(startIndex, startIndex + effectivePageSize);

  const hasActiveFilters = Boolean(
    stockGroupFilter !== 'ALL' ||
      stockTypeFilter !== 'ALL' ||
      stockEmplacementFilter !== 'ALL' ||
      stockCriticiteFilter !== 'ALL' ||
      stockDomaineFilter !== 'ALL' ||
      stockAlertOnly ||
      activeKpiFilter !== 'ALL' ||
      localSearch ||
      sortField !== 'type' ||
      sortOrder !== 'asc'
  );

  const clearAllFilters = useCallback(() => {
    setStockGroupFilter('ALL');
    setStockTypeFilter('ALL');
    setStockEmplacementFilter('ALL');
    setStockCriticiteFilter('ALL');
    setStockDomaineFilter('ALL');
    setStockAlertOnly(false);
    setActiveKpiFilter('ALL');
    setLocalSearch('');
    setSortField('type');
    setSortOrder('asc');
  }, [setStockTypeFilter, setStockAlertOnly]);

  const stockFilterPresets = useMemo(
    () => [
      {
        key: 'ALL',
        label: t('common.filters.all'),
        count: activeOnlyStockItems.length,
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
      {
        key: 'RESERVED',
        label: 'Réservé (Maker-Checker)',
        count: reservedSummary.articlesCount,
        activeBg: 'bg-purple-700 text-white shadow-xs',
        colorDot: 'bg-purple-500',
        onClick: () => {
          setActiveKpiFilter(activeKpiFilter === 'RESERVED' ? 'ALL' : 'RESERVED');
          setStockAlertOnly(false);
        },
        isActive: activeKpiFilter === 'RESERVED',
      },
      ...(archivedStockCount > 0
        ? [
            {
              key: 'ARCHIVE',
              label: 'Archivés',
              count: archivedStockCount,
              activeBg: 'bg-slate-600 text-white shadow-xs',
              colorDot: 'bg-slate-400',
              onClick: () => {
                setActiveKpiFilter(activeKpiFilter === 'ARCHIVE' ? 'ALL' : 'ARCHIVE');
                setStockAlertOnly(false);
              },
              isActive: activeKpiFilter === 'ARCHIVE',
            },
          ]
        : []),
    ],
    [
      activeOnlyStockItems.length,
      archivedStockCount,
      stockKPIs,
      activeKpiFilter,
      stockAlertOnly,
      reservedSummary.articlesCount,
      setStockAlertOnly,
      t,
    ]
  );

  const activeStockFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
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
    if (stockGroupFilter !== 'ALL') {
      const grp = effectivePdrGroups.find((g) => g.id === stockGroupFilter);
      chips.push({
        key: 'group',
        label: `Groupe: ${grp ? grp.code : stockGroupFilter === 'UNCLASSIFIED' ? 'Non classé' : stockGroupFilter}`,
        onRemove: () => setStockGroupFilter('ALL'),
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
    if (stockCriticiteFilter !== 'ALL') {
      chips.push({
        key: 'criticite',
        label: `Criticité: Classe ${stockCriticiteFilter}`,
        onRemove: () => setStockCriticiteFilter('ALL'),
      });
    }
    if (stockDomaineFilter !== 'ALL') {
      chips.push({
        key: 'domaine',
        label: `Domaine: ${stockDomaineFilter}`,
        onRemove: () => setStockDomaineFilter('ALL'),
      });
    }
    return chips;
  }, [
    localSearch,
    stockGroupFilter,
    effectivePdrGroups,
    stockTypeFilter,
    activeKpiFilter,
    stockAlertOnly,
    stockEmplacementFilter,
    stockCriticiteFilter,
    stockDomaineFilter,
    setStockSearch,
    setStockTypeFilter,
    setStockAlertOnly,
    t,
  ]);

  const handleExportExcel = useCallback(() => {
    try {
      const headers = [
        'REF (B)',
        'DÉSIGNATION (C)',
        'TYPE (D)',
        'DOMAINE TECHNIQUE',
        'UNITÉ MESURE',
        'CRITICITÉ (ABC)',
        'RÉF CONSTRUCTEUR',
        'CODES ÉQUIVALENTS',
        'DÉLAI APPRO (J)',
        'POLICY TAGS',
        'STOCK INITIAL (E)',
        'ENTRÉES (F)',
        'SORTIES (G)',
        'STOCK ACTUEL (H)',
        'SEUIL (I)',
        'ALERTE (J)',
        'EMPLACEMENT (K)',
      ];
      const rows = effectiveFiltered.map((item) => {
        const hierarchy = resolvePdrHierarchy(item, effectivePdrGroups, types);
        const effDomaine =
          item.domaine_technique ||
          hierarchy.type?.domaine_technique ||
          hierarchy.group?.domaine_technique ||
          '';
        return [
          item.ref || '',
          item.designation || '',
          item.type || item.id_type || '',
          effDomaine,
          item.unite_mesure || item.unite || 'PCS',
          item.criticite || 'B',
          item.ref_constructeur || '',
          item.code_equivalents || '',
          item.delai_appro_jours ?? '',
          (item.policy_tags && item.policy_tags.length > 0 ? item.policy_tags : ['REPLACING']).join(
            '|'
          ),
          item.stockInitial || 0,
          item.entrees || 0,
          item.sorties || 0,
          item.stockActuel || 0,
          item.seuil || 0,
          item.alerte || '',
          item.emplacement || '',
        ];
      });
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
  }, [effectiveFiltered, effectivePdrGroups, types]);

  const handleOpenQuickModal = useCallback((item: IStockItem, flow: string, action: string) => {
    setQuickModalState({
      isOpen: true,
      article: item,
      initialFlow: flow,
      initialAction: action,
    });
    setActiveActionMenuRef(null);
  }, []);

  const handleOpenEditArticle = useCallback((item: IStockItem) => {
    setEditArticleModalState({
      isOpen: true,
      article: item,
    });
    setActiveActionMenuRef(null);
  }, []);

  const handleRowContextMenu = useCallback(
    (e: MouseEvent<HTMLTableRowElement>, item: IStockItem) => {
      const menuItems: ContextMenuItem[] = [];
      if (canEditStock) {
        menuItems.push({
          id: 'edit',
          label: t('stock.context.edit', 'Modifier l’article'),
          onClick: () => handleOpenEditArticle(item),
        });
      }
      if (canCreateMovement) {
        menuItems.push(
          {
            id: 'quick-sortie',
            label: t('stock.context.quick_sortie', 'Sortie directe (Sortie PDR)'),
            onClick: () => handleOpenQuickModal(item, 'Sortie', 'CORRECTIVE'),
          },
          {
            id: 'quick-entree',
            label: t('stock.context.quick_entree', 'Entrée directe (Réapprovisionnement)'),
            onClick: () => handleOpenQuickModal(item, 'Entrée', 'REAPPRO'),
          }
        );
      }
      if (menuItems.length > 0) {
        menuItems.push({ id: 'sep-1', label: '', separator: true });
      }
      menuItems.push({
        id: 'copy-ref',
        label: t('stock.context.copy_ref', { ref: item.ref }),
        onClick: () => {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(item.ref);
          }
        },
      });
      contextMenu.show(e, menuItems, `Article: ${item.ref}`);
    },
    [canEditStock, canCreateMovement, handleOpenEditArticle, handleOpenQuickModal, t]
  );

  return {
    t,
    stockItems,
    effectivePdrGroups,
    effectiveSetPdrGroups,
    availableTypes,
    reservedSummary,
    getReservedEntry,
    reorderAlerts,
    emplacements,
    stockGroupFilter,
    setStockGroupFilter,
    stockEmplacementFilter,
    setStockEmplacementFilter,
    stockCriticiteFilter,
    setStockCriticiteFilter,
    stockDomaineFilter,
    setStockDomaineFilter,
    localSearch,
    setLocalSearch,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    sortField,
    sortOrder,
    showSortMenu,
    setShowSortMenu,
    sortMenuRef,
    activeKpiFilter,
    setActiveKpiFilter,
    activeActionMenuRef,
    setActiveActionMenuRef,
    showGroupsModal,
    setShowGroupsModal,
    showPdrExcelModal,
    setShowPdrExcelModal,
    showReorderPanel,
    setShowReorderPanel,
    showReplenishmentModal,
    setShowReplenishmentModal,
    showLotCumpModal,
    setShowLotCumpModal,
    showFormulasModal,
    setShowFormulasModal,
    quickModalState,
    setQuickModalState,
    editArticleModalState,
    setEditArticleModalState,
    canEditStock,
    canCreateStock,
    canCreateMovement,
    effectiveFiltered,
    displayedStock,
    totalItems,
    startIndex,
    hasActiveFilters,
    clearAllFilters,
    stockFilterPresets,
    activeStockFilterChips,
    handleSort,
    handleExportExcel,
    handleOpenQuickModal,
    handleOpenEditArticle,
    handleRowContextMenu,
  };
}
