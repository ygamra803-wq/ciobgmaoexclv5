import { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { CubeIcon } from '../../components/common/icons/CubeIcon';
import {
  FileSpreadsheet,
  Layers,
  Search,
  Check,
  RotateCcw,
  Trash2,
  Package,
  TrendingDown,
  TrendingUp,
  Settings,
  Truck,
  Boxes,
  X,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CalendarRange,
  ArrowUpAZ,
  ArrowDownAZ,
  Factory,
  ShoppingCart,
  Edit2,
  Activity,
  Hash,
  Inbox,
  UserCheck,
  Flame,
  CheckCircle2,
  MapPin,
  Tag,
  Barcode,
  User,
  Shield,
  FileText,
  Calendar,
  Clock,
  MessageSquare,
  Gauge,
  ShieldCheck,
  Puzzle,
  Printer,
  MoreVertical,
  Wrench,
} from 'lucide-react';
import MovementVoucherModal from '../../components/warehouse/MovementVoucherModal';
import { usePermission } from '../../components/common/PermissionGate';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import PeriodFilterBar from '../../components/common/PeriodFilterBar';
import { type PeriodFilterState, isDateInPeriod } from '../../../utils/datePeriodUtils';
import {
  getSmartOtCommande,
  getSmartFluxType,
  resolveArticleInfo,
  resolveDestinationInfo,
  resolveIntervenantInfo,
  resolveStockEquation,
  TableFilterSelect,
} from './mouvementsJournalResolvers';

export {
  getSmartOtCommande,
  getSmartFluxType,
  resolveArticleInfo,
  resolveDestinationInfo,
  resolveIntervenantInfo,
  resolveStockEquation,
};

/**
 * Full-featured Journal Mouvements Table Component
 */
export default function MouvementsJournalTable({
  mouvements = [],
  stockItems = [],
  warehouseItems = [],
  machines = [],
  zones = [],
  technicians = [],
  operations = [],
  onUpdateMouvement,
  onDeleteMouvement,
}: any) {
  // Table Filtering States
  const [tableFilterType, setTableFilterType] = useState('ALL');
  const [tableFilterSource, setTableFilterSource] = useState('ALL');
  const [tableFilterAction, setTableFilterAction] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>({ preset: 'ALL' });
  const [tableDatePreset, setTableDatePreset] = useState('ALL');
  const [tableDateFrom, setTableDateFrom] = useState('');
  const [tableDateTo, setTableDateTo] = useState('');
  const [localTableSearchText, setLocalTableSearchText] = useState('');

  const availableMovementDates = useMemo(() => {
    return mouvements.map((m: any) => m.date);
  }, [mouvements]);

  // Table Sorting States
  const [tableSortField, setTableSortField] = useState('date');
  const [tableSortOrder, setTableSortOrder] = useState('desc');
  const [showTableSortMenu, setShowTableSortMenu] = useState(false);
  const tableSortMenuRef = useRef<any>(null);

  // Pagination State & Page Size
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Voucher Modal State
  const [voucherModalMvt, setVoucherModalMvt] = useState<any>(null);

  // RBAC Permission checks
  const canDeleteMovement = usePermission('movement.delete');
  const canEditMovement = usePermission('movement.edit');

  // Edit / Delete Movement Modals & Action Menu Popover
  const [editingMovement, setEditingMovement] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const [deletingMovement, setDeletingMovement] = useState<any>(null);
  const [activeActionMenuId, setActiveActionMenuId] = useState<any>(null);

  // Click outside listener for sort menu and action popovers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (tableSortMenuRef.current && !tableSortMenuRef.current.contains(event.target)) {
        setShowTableSortMenu(false);
      }
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter Movements
  const filteredMouvements = useMemo(() => {
    return mouvements.filter((m) => {
      const smartFlux = getSmartFluxType(m);

      // Type / Flux Filter
      if (tableFilterType !== 'ALL') {
        if (smartFlux !== tableFilterType) return false;
      }

      // Source Filter
      if (tableFilterSource !== 'ALL') {
        const artInfo = resolveArticleInfo(m, { stockItems, warehouseItems });
        if (artInfo.sourceCat !== tableFilterSource) return false;
      }

      // Action Filter
      if (tableFilterAction !== 'ALL') {
        if (String(m.action_id || '').toUpperCase() !== tableFilterAction.toUpperCase()) {
          return false;
        }
      }

      // Date Range Filter (P1 Unified Factory Period)
      if (!isDateInPeriod(m.date, periodFilter)) {
        return false;
      }

      // Local Text Search (Omni search across all columns)
      if (localTableSearchText.trim()) {
        const q = localTableSearchText.trim().toLowerCase();
        const smartOt = String(getSmartOtCommande(m) || '').toLowerCase();
        const smartFluxLower = String(smartFlux || '').toLowerCase();

        const matchesOt =
          smartOt.includes(q) || (q === 'inconnu' && smartOt === 'inconnu');
        const matchesFlux =
          smartFluxLower.includes(q) ||
          (q === 'sortie' && smartFluxLower.includes('sortie')) ||
          (q === 'entrée' && smartFluxLower.includes('entrée')) ||
          (q === 'entree' && smartFluxLower.includes('entrée'));

        const artInfo = resolveArticleInfo(m, { stockItems, warehouseItems });
        const matchesArticle =
          String(artInfo.ref || '').toLowerCase().includes(q) ||
          String(artInfo.designation || '').toLowerCase().includes(q) ||
          String(artInfo.type || '').toLowerCase().includes(q);

        const destInfo = resolveDestinationInfo(m, { machines, zones, technicians, operations });
        const matchesDestination =
          String(destInfo.title || '').toLowerCase().includes(q) ||
          String(destInfo.category || '').toLowerCase().includes(q) ||
          String(destInfo.code || '').toLowerCase().includes(q);

        const intervInfo = resolveIntervenantInfo(m, { technicians, operations });
        const matchesIntervenant =
          String(intervInfo.name || '').toLowerCase().includes(q) ||
          String(intervInfo.role || '').toLowerCase().includes(q) ||
          String(intervInfo.id || '').toLowerCase().includes(q);

        const matches =
          matchesOt ||
          matchesFlux ||
          matchesArticle ||
          matchesDestination ||
          matchesIntervenant ||
          String(m.code_bon || '').toLowerCase().includes(q) ||
          String(m.action_id || '').toLowerCase().includes(q) ||
          String(m.technicien || '').toLowerCase().includes(q) ||
          String(m.operation || '').toLowerCase().includes(q) ||
          String(m.commentaire || '').toLowerCase().includes(q);

        if (!matches) return false;
      }

      return true;
    });
  }, [
    mouvements,
    tableFilterType,
    tableFilterSource,
    tableFilterAction,
    periodFilter,
    localTableSearchText,
    stockItems,
    warehouseItems,
    machines,
    zones,
    technicians,
    operations,
  ]);

  // Sort Movements
  const sortedMouvements = useMemo(() => {
    return [...filteredMouvements].sort((a, b) => {
      let valA = a[tableSortField];
      let valB = b[tableSortField];

      if (tableSortField === 'num_commande') {
        valA = String(getSmartOtCommande(a) || '').toLowerCase();
        valB = String(getSmartOtCommande(b) || '').toLowerCase();
      } else if (tableSortField === 'type') {
        valA = String(getSmartFluxType(a) || '').toLowerCase();
        valB = String(getSmartFluxType(b) || '').toLowerCase();
      } else if (tableSortField === 'ref') {
        valA = String(resolveArticleInfo(a, { stockItems, warehouseItems }).ref || '').toLowerCase();
        valB = String(resolveArticleInfo(b, { stockItems, warehouseItems }).ref || '').toLowerCase();
      } else if (tableSortField === 'id_machine_registered' || tableSortField === 'destination') {
        valA = String(resolveDestinationInfo(a, { machines, zones, technicians, operations }).title || '').toLowerCase();
        valB = String(resolveDestinationInfo(b, { machines, zones, technicians, operations }).title || '').toLowerCase();
      } else if (tableSortField === 'technicien' || tableSortField === 'intervenant') {
        valA = String(resolveIntervenantInfo(a, { technicians, operations }).name || '').toLowerCase();
        valB = String(resolveIntervenantInfo(b, { technicians, operations }).name || '').toLowerCase();
      } else if (tableSortField === 'quantite') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }

      if (valA < valB) return tableSortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return tableSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [
    filteredMouvements,
    tableSortField,
    tableSortOrder,
    stockItems,
    warehouseItems,
    machines,
    zones,
    technicians,
    operations,
  ]);

  // Pagination Slice
  const totalItems = sortedMouvements.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const displayedMouvements = useMemo(() => {
    return pageSize === 0 ? sortedMouvements : sortedMouvements.slice(startIndex, startIndex + effectivePageSize);
  }, [sortedMouvements, startIndex, effectivePageSize, pageSize]);

  // Reset to page 1 on filter/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    tableFilterType,
    tableFilterSource,
    tableFilterAction,
    tableDatePreset,
    tableDateFrom,
    tableDateTo,
    localTableSearchText,
    tableSortField,
    tableSortOrder,
    pageSize,
  ]);

  const handleTableSort = (field) => {
    if (tableSortField === field) {
      setTableSortOrder(tableSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setTableSortField(field);
      setTableSortOrder('asc');
    }
  };

  const mvtColumns = useMemo(
    () => [
      { key: 'date', label: 'DATE / BON', colLetter: 'A', icon: FileText, sortable: true },
      { key: 'num_commande', label: 'N° OT / CDE / RÉF', colLetter: 'Col B', icon: Hash, sortable: true },
      { key: 'type', label: 'TYPE FLUX', colLetter: 'B', icon: Layers, sortable: true },
      { key: 'source_category', label: 'SOURCE', colLetter: 'C', icon: Boxes, align: 'center', sortable: true },
      { key: 'ref', label: 'ARTICLE', colLetter: 'D', icon: Package, sortable: true },
      { key: 'quantite', label: 'QTÉ', colLetter: 'E', icon: Activity, align: 'right', sortable: true },
      { key: 'action_id', label: 'TYPE INTERVENTION', colLetter: 'F', icon: Wrench, sortable: true },
      { key: 'id_machine_registered', label: 'DESTINATION', colLetter: 'G', icon: Factory, sortable: true },
      { key: 'technicien', label: 'INTERVENANT', colLetter: 'H', icon: User, sortable: true },
      { key: 'commentaire', label: 'COMMENTAIRE', colLetter: 'I', icon: MessageSquare, sortable: true },
      { key: 'statut', label: 'STATUT', colLetter: 'J', icon: CheckCircle2, align: 'center' },
      { key: 'actions', label: '•••', align: 'center', headerClassName: 'w-16 text-center' },
    ],
    []
  );

  const renderTableSortIcon = (field) => {
    if (tableSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />;
    }
    return tableSortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-indigo-600 font-bold shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-600 font-bold shrink-0" />
    );
  };

  // Badge renderers
  const renderFluxBadge = (m) => {
    const smartFlux = getSmartFluxType(m);
    switch (smartFlux) {
      case 'Sortie Interne':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-rose-50 text-rose-700 border border-rose-200">
            <TrendingDown className="w-3 h-3 text-rose-600 shrink-0" />
            <span>Sortie Interne</span>
          </span>
        );
      case 'Entrée Interne':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-cyan-50 text-cyan-800 border border-cyan-200">
            <TrendingUp className="w-3 h-3 text-cyan-600 shrink-0" />
            <span>Entrée Interne</span>
          </span>
        );
      case 'Bon de Sortie':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-purple-50 text-purple-700 border border-purple-200">
            <Truck className="w-3 h-3 text-purple-600 shrink-0" />
            <span>Bon de Sortie (Ext.)</span>
          </span>
        );
      case 'Entrée Externe':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Inbox className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Entrée Externe</span>
          </span>
        );
      case 'COMMANDE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
            <ShoppingCart className="w-3 h-3 text-amber-600 shrink-0" />
            <span>Commande</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold text-[11px] bg-slate-100 text-slate-700">
            {smartFlux}
          </span>
        );
    }
  };

  const renderActionBadge = (m) => {
    const act = String(m.action_id || '').toUpperCase();
    if (act === 'CORRECTIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
          <Flame className="w-3 h-3 text-rose-600 shrink-0" />
          <span>Corrective</span>
        </span>
      );
    }
    if (act === 'PREVENTIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Préventive</span>
        </span>
      );
    }
    if (act === 'AMELIORATIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
          <Settings className="w-3 h-3 text-amber-600 shrink-0" />
          <span>Amélioration</span>
        </span>
      );
    }
    if (act === 'USAGE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
          <UserCheck className="w-3 h-3 text-purple-600 shrink-0" />
          <span>Usage Personnel</span>
        </span>
      );
    }
    if (act === 'REAPPRO') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <Inbox className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Réappro</span>
        </span>
      );
    }
    if (act === 'RETOUR') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
          <RotateCcw className="w-3 h-3 text-cyan-600 shrink-0" />
          <span>Retour Atelier</span>
        </span>
      );
    }
    if (act === 'REPARATION_EXTERNE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
          <Truck className="w-3 h-3 text-purple-600 shrink-0" />
          <span>Rép. Extérieure</span>
        </span>
      );
    }
    if (act === 'ETALONNAGE_CONTROLE' || act === 'ETALONNAGE' || act === 'CONTROLE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
          <Gauge className="w-3 h-3 text-blue-600 shrink-0" />
          <span>Étalonnage</span>
        </span>
      );
    }
    if (act === 'GARANTIE_ECHANGE' || act === 'GARANTIE' || act === 'ECHANGE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>Garantie/Échange</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 text-slate-700">
        {m.action_id || 'Autre'}
      </span>
    );
  };

  // Export Filtered Movements to Excel
  const handleExportFilteredMovements = () => {
    const exportRows = sortedMouvements.map((m, idx) => {
      const artInfo = resolveArticleInfo(m, { stockItems, warehouseItems });
      const destInfo = resolveDestinationInfo(m, { machines, zones, technicians, operations });
      const intervInfo = resolveIntervenantInfo(m, { technicians, operations });
      const eq = resolveStockEquation(m, { stockItems, warehouseItems });
      return {
        'N°': idx + 1,
        'Code Bon (A)': m.code_bon || '',
        'Date (A)': m.date || '',
        'Heure (A)': m.heure || '',
        'N° OT / Cde (A)': getSmartOtCommande(m),
        'Type Flux (B)': getSmartFluxType(m),
        'Source (C)': artInfo.sourceCat,
        'Type Article (D)': artInfo.type,
        'Désignation (D)': artInfo.designation,
        'Référence (D)': artInfo.ref,
        'Quantité (E)': m.quantite || 0,
        'Équation Stock (E)': `${eq.stockAvant} ${eq.operator} ${eq.qte} = ${eq.stockApres}`,
        'Type Intervention (F)': m.action_id || '',
        'Destination Catégorie (G)': destInfo.category,
        'Destination Titre (G)': destInfo.title,
        'Destination Code (G)': destInfo.code,
        'Intervenant Rôle (H)': intervInfo.role,
        'Intervenant Nom (H)': intervInfo.name,
        'Intervenant ID (H)': intervInfo.id,
        'Commentaire (I)': m.commentaire || '',
        'Statut (J)': m.statut || 'Effectué',
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Journal_Mouvements');
    XLSX.writeFile(wb, `Journal_Mouvements_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-3">
      {/* Enhanced History Toolbar & Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              <span>Journal des Mouvements ({filteredMouvements.length} / {mouvements.length})</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Excel Twin Colonnes A→J • Traçabilité complète multi-critères
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportFilteredMovements}
              className="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Exporter Excel</span>
            </button>

            {(tableFilterType !== 'ALL' ||
              tableFilterSource !== 'ALL' ||
              tableFilterAction !== 'ALL' ||
              periodFilter.preset !== 'ALL' ||
              localTableSearchText) && (
              <button
                type="button"
                onClick={() => {
                  setTableFilterType('ALL');
                  setTableFilterSource('ALL');
                  setTableFilterAction('ALL');
                  setPeriodFilter({ preset: 'ALL' });
                  setLocalTableSearchText('');
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-2.5 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar with CustomSelects, Column Letters, and Sort Popover */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 pt-3 border-t border-slate-100 items-end text-xs">
          {/* Flux Filter (B) */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filtrer par Flux (B)
            </label>
            <TableFilterSelect
              value={tableFilterType}
              onChange={(val) => setTableFilterType(val)}
              icon={<Layers className="w-3.5 h-3.5 text-indigo-600" />}
              options={[
                { value: 'ALL', label: 'Tous les Types de Flux' },
                {
                  value: 'Sortie Interne',
                  label: '[B] Sortie Interne',
                  badge: 'Interne',
                  icon: <TrendingDown className="w-3.5 h-3.5 text-rose-600" />,
                },
                {
                  value: 'Entrée Interne',
                  label: '[B] Entrée Interne',
                  badge: 'Interne',
                  icon: <TrendingUp className="w-3.5 h-3.5 text-cyan-600" />,
                },
                {
                  value: 'Bon de Sortie',
                  label: '[B] Bon de Sortie (Ext.)',
                  badge: 'Externe',
                  icon: <Truck className="w-3.5 h-3.5 text-purple-600" />,
                },
                {
                  value: 'Entrée Externe',
                  label: '[B] Entrée Externe (Réappro)',
                  badge: 'Externe',
                  icon: <Inbox className="w-3.5 h-3.5 text-emerald-600" />,
                },
                {
                  value: 'COMMANDE',
                  label: '[B] Commandes en Attente',
                  badge: 'Achat',
                  icon: <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />,
                },
              ]}
            />
          </div>

          {/* Source Filter (C) */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filtrer par Source (C)
            </label>
            <TableFilterSelect
              value={tableFilterSource}
              onChange={(val) => setTableFilterSource(val)}
              icon={<Boxes className="w-3.5 h-3.5 text-amber-600" />}
              options={[
                { value: 'ALL', label: 'Toutes les Sources' },
                {
                  value: 'STOCK_PDR',
                  label: '[C] Catalogue PDR',
                  icon: <Package className="w-3.5 h-3.5 text-emerald-600" />,
                },
                {
                  value: 'WAREHOUSE_PARTIE',
                  label: '[C] Machine Twin (Partie)',
                  icon: <Layers className="w-3.5 h-3.5 text-purple-600" />,
                },
                {
                  value: 'WAREHOUSE_COMPOSANT',
                  label: '[C] Composant Révisé',
                  icon: <CubeIcon className="w-3.5 h-3.5 text-indigo-600" />,
                },
              ]}
            />
          </div>

          {/* Action Filter (F) */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Filtrer par Action (F)
            </label>
            <TableFilterSelect
              value={tableFilterAction}
              onChange={(val) => setTableFilterAction(val)}
              icon={<Activity className="w-3.5 h-3.5 text-blue-600" />}
              options={[
                { value: 'ALL', label: 'Toutes les Actions' },
                { value: 'CORRECTIVE', label: '[F] Corrective' },
                { value: 'PREVENTIVE', label: '[F] Préventive' },
                { value: 'AMELIORATIVE', label: '[F] Amélioration' },
                { value: 'USAGE', label: '[F] Usage Personnel' },
                { value: 'REAPPRO', label: '[F] Réapprovisionnement' },
                { value: 'RETOUR', label: '[F] Retour Atelier' },
                { value: 'REPARATION_EXTERNE', label: '[F] Réparation Extérieure' },
                { value: 'ETALONNAGE_CONTROLE', label: '[F] Étalonnage / Contrôle' },
                { value: 'GARANTIE_ECHANGE', label: '[F] Garantie / Échange' },
              ]}
            />
          </div>

          {/* Sort By Dropdown Menu (Tri & Colonne) */}
          <div className="sm:col-span-2 relative" ref={tableSortMenuRef}>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Tri & Colonne
            </label>
            <button
              type="button"
              onClick={() => setShowTableSortMenu(!showTableSortMenu)}
              className={`w-full h-8 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showTableSortMenu || tableSortField !== 'date' || tableSortOrder !== 'desc'
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-1 ring-indigo-200 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
              title="Options de tri par colonne"
            >
              <div className="flex items-center gap-1.5 truncate">
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="truncate">
                  Tri : <b className="font-mono text-slate-900">{tableSortField.slice(0, 6).toUpperCase()}</b> (
                  {tableSortOrder === 'asc' ? 'A→Z' : 'Z→A'})
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-slate-400 transition-transform shrink-0 ${
                  showTableSortMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Sort Popover Menu */}
            {showTableSortMenu && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-1 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                    Trier par (Sort By)
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Colonnes A→I</span>
                </div>

                {/* Sort Field Options */}
                <div className="grid grid-cols-2 gap-1.5 text-xs">
                  {[
                    { key: 'date', label: 'Date / Bon (A)' },
                    { key: 'num_commande', label: 'N° OT / Commande' },
                    { key: 'type', label: 'Type Flux (B)' },
                    { key: 'source_category', label: 'Source (C)' },
                    { key: 'ref', label: 'Article (D)' },
                    { key: 'quantite', label: 'Quantité (E)' },
                    { key: 'action_id', label: 'Intervention (F)' },
                    { key: 'id_machine_registered', label: 'Destination (G)' },
                    { key: 'technicien', label: 'Intervenant (H)' },
                    { key: 'commentaire', label: 'Commentaire (I)' },
                  ].map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => handleTableSort(col.key)}
                      className={`px-2 py-1.5 rounded-lg border text-left font-medium text-[11px] flex items-center justify-between transition cursor-pointer ${
                        tableSortField === col.key
                          ? 'bg-indigo-50 text-indigo-900 border-indigo-300 font-bold'
                          : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{col.label}</span>
                      {tableSortField === col.key &&
                        (tableSortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3 text-indigo-600 shrink-0" />
                        ) : (
                          <ArrowDown className="w-3 h-3 text-indigo-600 shrink-0" />
                        ))}
                    </button>
                  ))}
                </div>

                {/* Sort Order Selector */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTableSortOrder('asc')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      tableSortOrder === 'asc'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowUpAZ className="w-3.5 h-3.5" />
                    <span>Croissant (A-Z)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTableSortOrder('desc')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                      tableSortOrder === 'desc'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowDownAZ className="w-3.5 h-3.5" />
                    <span>Décroissant (Z-A)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Global Search Input */}
          <div className="sm:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Recherche Instantanée
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={localTableSearchText}
                onChange={(e) => setLocalTableSearchText(e.target.value)}
                placeholder="Bon, OT, Réf, Machine, Zone..."
                className="w-full h-8 pl-8 pr-7 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              {localTableSearchText && (
                <button
                  type="button"
                  onClick={() => setLocalTableSearchText('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Unified Period Filter Bar (P1 Factory Memory) */}
        <div className="pt-2 border-t border-slate-100">
          <PeriodFilterBar
            value={periodFilter}
            onChange={(next) => {
              setPeriodFilter(next);
              setCurrentPage(1);
            }}
            availableDates={availableMovementDates}
            filteredCount={sortedMouvements.length}
            totalCount={mouvements.length}
          />
        </div>
      </div>

      {/* Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title="Tableau Mouvements_Journal • Colonnes A → J"
        icon={<FileSpreadsheet className="w-4 h-4 text-indigo-600" />}
        excelMapping="date_bon (A) | type_flux (B) | source (C) | article (D) | quantite (E) | action (F) | destination (G) | intervenant (H) | commentaire (I) | statut (J)"
        bannerColor="indigo"
        columns={mvtColumns}
        data={displayedMouvements}
        sortField={tableSortField}
        sortOrder={tableSortOrder}
        onSort={handleTableSort}
        renderSortIcon={renderTableSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<FileSpreadsheet className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun mouvement trouvé pour les critères sélectionnés."
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [25, 50, 100, 200, 0],
          color: 'indigo',
          itemLabel: 'mouvements',
        }}
        renderRow={(m, idx, rowNumber) => {
          const realIndex = startIndex + idx;

          // Smart Article Lookup (Type, Désignation, Réf, Source)
          const artInfo = resolveArticleInfo(m, { stockItems, warehouseItems });
          const sourceCat = artInfo.sourceCat;

          // Smart Destination Lookup (Zone, Machine Registered, Emplacement, INCONNU)
          const destInfo = resolveDestinationInfo(m, { machines, zones, technicians, operations });

          return (
            <tr
              key={`mvt-row-${m.id || 'm'}-${m.code_bon || 'bon'}-${realIndex}`}
              className="even:bg-slate-50/70 odd:bg-white hover:bg-indigo-50/40 transition-colors border-b border-slate-100"
            >
              <td className="py-2 px-3 text-center font-mono text-[10.5px] font-bold text-slate-400">
                {rowNumber}
              </td>

                      {/* DATE / BON / HEURE (A): Code Bon on top with FileText icon, Date in middle with Calendar icon, Time on bottom with Clock icon */}
                      <td className="py-2.5 px-3 whitespace-nowrap min-w-[130px]">
                        <div className="flex flex-col gap-0.5">
                          {/* Top: Code Bon */}
                          <div className="flex items-center gap-1.5 font-mono font-bold text-indigo-950 text-[11px]">
                            <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{m.code_bon || 'BON-000'}</span>
                          </div>
                          {/* Middle: Date */}
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{m.date || '----/--/--'}</span>
                          </div>
                          {/* Bottom: Heure (Auto/Enregistré) */}
                          {(() => {
                            let timeVal = m.heure ? String(m.heure).trim() : '';
                            if (!timeVal && m.timestamp) {
                              try {
                                const dt = new Date(m.timestamp);
                                if (!isNaN(dt.getTime())) {
                                  timeVal = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                                }
                              } catch {
                                // ignore
                              }
                            }
                            if (!timeVal) {
                              timeVal = '08:30';
                            }
                            return (
                              <div className="flex items-center gap-1.5 text-[9.5px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3 text-indigo-500/70 shrink-0" />
                                <span>{timeVal}</span>
                              </div>
                            );
                          })()}
                        </div>
                      </td>

                      {/* N° OT / COMMANDE / RÉF */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {(() => {
                          const smartOt = getSmartOtCommande(m);
                          if (smartOt === 'INCONNU') {
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10.5px] font-medium bg-slate-100 text-slate-400 border border-slate-200"
                                title="Non renseigné dans l'enregistrement (null / inconnu)"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                                INCONNU
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[11px] text-indigo-950 bg-indigo-50/80 border border-indigo-200/80">
                              <Hash className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span>{smartOt}</span>
                            </span>
                          );
                        })()}
                      </td>

                      <td className="py-2 px-2.5 whitespace-nowrap">
                        {renderFluxBadge(m)}
                      </td>

                      {/* Source with pure, clean offline SVG icon */}
                      <td className="py-2 px-2.5 text-center whitespace-nowrap">
                        {sourceCat === 'WAREHOUSE_PARTIE' ? (
                          <div className="inline-flex items-center gap-1.5 text-purple-600" title="Machine Twin (Partie)">
                            <Layers className="w-4 h-4 text-purple-600 shrink-0" />
                            <span className="text-[10.5px] font-semibold text-purple-700">Partie</span>
                          </div>
                        ) : sourceCat === 'WAREHOUSE_COMPOSANT' ? (
                          <div className="inline-flex items-center gap-1.5 text-indigo-600" title="Composant Révisé">
                            <Puzzle className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="text-[10.5px] font-semibold text-indigo-700">Composant</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-emerald-600" title="Catalogue PDR (Stock)">
                            <Package className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="text-[10.5px] font-semibold text-emerald-700">Stock PDR</span>
                          </div>
                        )}
                      </td>

                      {/* ARTICLE (D): Type (top lighter), Désignation (middle prominent), Réf (bottom mono/robot) with clean offline SVG icons */}
                      <td className="py-2.5 px-3 min-w-[220px]">
                        <div className="flex flex-col gap-0.5">
                          {/* Top: Type / Catégorie with Tag icon */}
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase text-slate-400">
                            <Tag className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[190px]" title={artInfo.type}>
                              {artInfo.type}
                            </span>
                          </div>

                          {/* Middle: Désignation with Package icon */}
                          <div className="flex items-start gap-1.5">
                            <Package className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <span className="text-[12px] font-bold text-slate-900 leading-snug break-words">
                              {artInfo.designation}
                            </span>
                          </div>

                          {/* Bottom: Réf Code with Barcode icon in font-mono */}
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-indigo-700 tracking-wider">
                            <Barcode className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                            <span>{artInfo.ref}</span>
                          </div>
                        </div>
                      </td>

                      {/* QTÉ (E): Mathematical Equation [Stock Avant] [ - / + ] [Qte] = [Stock Après] */}
                      <td className="py-2 px-2.5 whitespace-nowrap text-right min-w-[130px]">
                        {(() => {
                          const eq = resolveStockEquation(m, { stockItems, warehouseItems });
                          return (
                            <div
                              className="inline-flex items-center justify-end font-mono text-[11.5px] leading-none select-text gap-0.5 bg-slate-50/90 px-2 py-1 rounded-md border border-slate-200/90 shadow-2xs group-hover:border-slate-300 transition"
                              title={`Stock initial : ${eq.stockAvant} | Mouvement : ${eq.operator}${eq.qte} | Solde résultant : ${eq.stockApres} (Seuil : ${eq.seuilMin})`}
                            >
                              {/* Stock Avant (Black) */}
                              <span className="text-slate-900 font-bold" title="Stock avant opération">
                                {eq.stockAvant}
                              </span>

                              {/* Operator (- Red / + Green) */}
                              <span className={`px-0.5 ${eq.operatorClass}`}>
                                {eq.operator}
                              </span>

                              {/* Quantité mouvement (- Red / + Green) */}
                              <span className={`font-bold ${eq.qteClass}`} title="Quantité de la transaction">
                                {eq.qte}
                              </span>

                              {/* Equal Sign (Neutral slate) */}
                              <span className="text-slate-400 font-normal px-0.5">
                                =
                              </span>

                              {/* Stock Après (0 -> Red, < seuil -> Amber, >= seuil -> Black) */}
                              <span className={eq.apresClass} title={`Nouveau stock : ${eq.stockApres}`}>
                                {eq.stockApres}
                              </span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* TYPE INTERVENTION / ACTION */}
                      <td className="py-2 px-3 whitespace-nowrap">
                        {renderActionBadge(m)}
                      </td>

                      {/* DESTINATION (G): Unified 3-Layer Design (Zone/Cat -> Machine/Target -> Code/Emplacement) with clean offline SVG icons */}
                      <td className="py-2.5 px-3 min-w-[210px]">
                        <div className="flex flex-col gap-0.5">
                          {/* Top: Category / Zone with MapPin icon */}
                          <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase text-slate-400">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span
                              className="truncate max-w-[190px]"
                              title={destInfo.category}
                            >
                              {destInfo.category}
                            </span>
                          </div>

                          {/* Middle: Prominent Machine Name / Target with Factory icon */}
                          <div className="flex items-start gap-1.5">
                            <Factory className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                            <span
                              className={`text-[12px] font-bold leading-snug break-words ${
                                destInfo.isUnknown
                                  ? 'text-slate-500 font-medium inline-flex items-center gap-1.5'
                                  : 'text-slate-900'
                              }`}
                            >
                              {destInfo.isUnknown ? (
                                <>
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                                  <span>{destInfo.title}</span>
                                </>
                              ) : (
                                destInfo.title
                              )}
                            </span>
                          </div>

                          {/* Bottom: Machine Code / Emplacement with Barcode icon in font-mono */}
                          <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider">
                            <Barcode
                              className={`w-3.5 h-3.5 shrink-0 ${
                                destInfo.isUnknown ? 'text-slate-400' : 'text-indigo-500'
                              }`}
                            />
                            <span
                              className={
                                destInfo.isUnknown ? 'text-slate-400 font-medium' : 'text-indigo-700'
                              }
                            >
                              {destInfo.code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* INTERVENANT (H): Unified 3-Layer Design (Rôle -> Nom -> ID) with clean offline SVG icons */}
                      <td className="py-2.5 px-3 min-w-[190px]">
                        {(() => {
                          const intervInfo = resolveIntervenantInfo(m, { technicians, operations });
                          return (
                            <div className="flex flex-col gap-0.5">
                              {/* Top: Rôle / Type de profil with Shield icon */}
                              <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase text-slate-400">
                                <Shield className="w-3 h-3 text-slate-400 shrink-0" />
                                <span
                                  className="truncate max-w-[180px]"
                                  title={intervInfo.role}
                                >
                                  {intervInfo.role}
                                </span>
                              </div>

                              {/* Middle: Nom du compte / Personne with User icon */}
                              <div className="flex items-start gap-1.5">
                                <User className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                <span
                                  className={`text-[12px] font-bold leading-snug break-words ${
                                    intervInfo.isUnknown
                                      ? 'text-slate-500 font-medium inline-flex items-center gap-1.5'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {intervInfo.isUnknown ? (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0"></span>
                                      <span>INCONNU</span>
                                    </>
                                  ) : (
                                    intervInfo.name
                                  )}
                                </span>
                              </div>

                              {/* Bottom: ID / Code unique with Barcode icon in font-mono */}
                              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold tracking-wider">
                                <Barcode
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    intervInfo.isUnknown ? 'text-slate-400' : 'text-indigo-500'
                                  }`}
                                />
                                <span
                                  className={
                                    intervInfo.isUnknown ? 'text-slate-400 font-medium' : 'text-indigo-700'
                                  }
                                >
                                  {intervInfo.id}
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* COMMENTAIRE (I): With MessageSquare icon and clean null badge if empty */}
                      <td className="py-2.5 px-3 text-[11px] max-w-[160px]">
                        {(() => {
                          const rawComment = m.commentaire ? String(m.commentaire).trim() : '';
                          if (!rawComment) {
                            return (
                              <span
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9.5px] font-semibold bg-slate-100 text-slate-400 border border-slate-200"
                                title="Aucun commentaire renseigné (null)"
                              >
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                null
                              </span>
                            );
                          }
                          return (
                            <div
                              className="flex items-start gap-1.5 text-slate-700 text-[11px] leading-snug"
                              title={rawComment}
                            >
                              <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                              <span className="truncate max-w-[135px] font-medium">{rawComment}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* STATUT (J): Lifecycle status of the transaction */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        {m.type === 'COMMANDE' || m.type === 'Bon de Sortie' ? (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase ${
                              m.type === 'COMMANDE'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-purple-50 text-purple-800 border border-purple-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                m.type === 'COMMANDE' ? 'bg-amber-500' : 'bg-purple-500'
                              }`}
                            ></span>
                            {m.type === 'COMMANDE' ? 'En attente' : 'En réparation'}
                          </span>
                        ) : m.type === 'Entrée Externe' && m.action_id !== 'ACHAT_DIRECT' ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                            Livré
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium text-slate-500 bg-slate-50 border border-slate-200">
                            <Check className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            Effectué
                          </span>
                        )}
                      </td>

                      {/* ACTION COLUMN: Combined 3-dots action menu popover card */}
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <div className="relative inline-flex items-center justify-center action-menu-container">
                          <div className="inline-flex rounded-xl border border-slate-200 bg-white shadow-2xs overflow-hidden">
                            {/* Quick Print Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setVoucherModalMvt(m);
                                setActiveActionMenuId(null);
                              }}
                              className="p-1.5 bg-white hover:bg-slate-100/80 text-slate-800 hover:text-black transition flex items-center justify-center cursor-pointer border-r border-slate-200"
                              title="Imprimer le bon officiel (A4)"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-900" />
                            </button>

                            {/* 3-dots Toggle Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const mvtId = m.id || m.code_bon || `mvt-${m.ref}-${m.date}`;
                                setActiveActionMenuId(activeActionMenuId === mvtId ? null : mvtId);
                              }}
                              className={`p-1.5 hover:bg-slate-100 transition cursor-pointer ${
                                activeActionMenuId === (m.id || m.code_bon || `mvt-${m.ref}-${m.date}`)
                                  ? 'bg-slate-100 text-indigo-600 font-bold'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                              title="Actions et options du mouvement"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Popover Action Menu Card */}
                          {activeActionMenuId === (m.id || m.code_bon || `mvt-${m.ref}-${m.date}`) && (
                            <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
                              {/* Card Header */}
                              <div className="px-3 py-2 border-b border-slate-100 mb-1 bg-slate-50/80 rounded-xl">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                                  <span>Actions Mouvement</span>
                                  <span className="font-mono text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                                    {getSmartFluxType(m)}
                                  </span>
                                </div>
                                <div className="font-mono font-bold text-xs text-slate-800 truncate mt-0.5">
                                  {m.code_bon || 'Bon-001'} • OT: {getSmartOtCommande(m)}
                                </div>
                              </div>

                              {/* Menu Items */}
                              <div className="space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVoucherModalMvt(m);
                                    setActiveActionMenuId(null);
                                  }}
                                  className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 flex items-center justify-between transition cursor-pointer group"
                                >
                                  <div className="flex items-center gap-2">
                                    <Printer className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                                    <span>Imprimer le Bon Officiel (A4)</span>
                                  </div>
                                  <span className="text-[9.5px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded font-bold border border-indigo-200/60">
                                    PDF
                                  </span>
                                </button>

                                {canEditMovement && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      setEditingMovement(m);
                                      const curOt = getSmartOtCommande(m);
                                      const curFlux = getSmartFluxType(m);
                                      const artInfo = resolveArticleInfo(m, { stockItems, warehouseItems });
                                      setEditFormData({
                                        ...m,
                                        type: curFlux,
                                        num_commande: curOt !== 'INCONNU' ? curOt : '',
                                        quantite: m.quantite ?? 1,
                                        technicien: m.technicien || '',
                                        id_machine_registered: m.id_machine_registered || '',
                                        id_zone: m.id_zone || '',
                                        commentaire: m.commentaire || '',
                                        date: m.date || new Date().toISOString().split('T')[0],
                                        action_id: m.action_id || 'CORRECTIVE',
                                        designation: artInfo.designation,
                                      });
                                    }}
                                    className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-2 transition cursor-pointer group"
                                  >
                                    <Edit2 className="w-3.5 h-3.5 text-blue-600 group-hover:scale-110 transition-transform" />
                                    <span>Modifier ce mouvement</span>
                                  </button>
                                )}

                                {canDeleteMovement && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      setDeletingMovement(m);
                                    }}
                                    className="w-full px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-2 transition cursor-pointer group border-t border-slate-100 mt-1 pt-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600 group-hover:scale-110 transition-transform" />
                                    <span>Supprimer le mouvement</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }}
      />

      {/* EDIT MOVEMENT MODAL */}
      {editingMovement && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Modifier le mouvement</h3>
                  <p className="text-xs text-slate-500">Mise à jour en temps réel avec recalcul du stock</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMovement(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Read-only Context Summary */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1 font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Bon (A) :</span>
                <span className="font-bold text-indigo-950">{editingMovement.code_bon}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Article (D) :</span>
                <span className="font-bold text-slate-800">{editingMovement.ref}</span>
              </div>
              {editFormData.designation && (
                <div className="flex justify-between items-center text-[11px] font-sans">
                  <span className="text-slate-500">Désignation :</span>
                  <span className="text-slate-700 truncate max-w-[280px]">{editFormData.designation}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Type de Flux (B) :</span>
                <div>{renderFluxBadge({ ...editingMovement, type: editFormData.type || editingMovement.type })}</div>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Type de Flux (B)
                </label>
                <select
                  value={editFormData.type || 'Sortie Interne'}
                  onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="Sortie Interne">Sortie Interne</option>
                  <option value="Entrée Interne">Entrée Interne</option>
                  <option value="Bon de Sortie">Bon de Sortie (Ext.)</option>
                  <option value="Entrée Externe">Entrée Externe (Réappro)</option>
                  <option value="COMMANDE">COMMANDE (Achat)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Date de l&apos;opération
                </label>
                <input
                  type="date"
                  value={editFormData.date || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Heure de l&apos;opération
                </label>
                <input
                  type="time"
                  value={editFormData.heure || '08:30'}
                  onChange={(e) => setEditFormData({ ...editFormData, heure: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white font-semibold font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  N° OT / Commande / Réf
                </label>
                <input
                  type="text"
                  value={editFormData.num_commande || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, num_commande: e.target.value })}
                  placeholder="Ex: OT-2026-042 (ou vide = INCONNU)"
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Quantité (Qté)
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={editFormData.quantite ?? 1}
                  onChange={(e) => setEditFormData({ ...editFormData, quantite: Number(e.target.value) || 0 })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Action (Nature)
                </label>
                <select
                  value={editFormData.action_id || 'CORRECTIVE'}
                  onChange={(e) => setEditFormData({ ...editFormData, action_id: e.target.value })}
                  className="w-full h-8 px-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="CORRECTIVE">Maintenance Corrective</option>
                  <option value="PREVENTIVE">Maintenance Préventive</option>
                  <option value="AMELIORATIVE">Amélioration</option>
                  <option value="USAGE">Usage Personnel</option>
                  <option value="REAPPRO">Réapprovisionnement</option>
                  <option value="RETOUR">Retour Atelier</option>
                  <option value="REPARATION_EXTERNE">Réparation Extérieure</option>
                  <option value="ETALONNAGE_CONTROLE">Étalonnage / Contrôle</option>
                  <option value="GARANTIE_ECHANGE">Garantie / Échange</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Intervenant (Technicien)
                </label>
                <input
                  type="text"
                  list="table-edit-mvt-techs"
                  value={editFormData.technicien || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, technicien: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Nom du technicien"
                />
                <datalist id="table-edit-mvt-techs">
                  {technicians.map((t) => (
                    <option key={t.id || t.nom} value={t.nom || t.id} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Machine de destination
                </label>
                <select
                  value={editFormData.id_machine_registered || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, id_machine_registered: e.target.value })}
                  className="w-full h-8 px-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Aucune machine / Non spécifiée (INCONNU)</option>
                  {machines.map((mc) => (
                    <option key={mc.id_machine_registered} value={mc.id_machine_registered}>
                      {mc.id_machine_registered} - {mc.designation}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Zone industrielle
                </label>
                <select
                  value={editFormData.id_zone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, id_zone: e.target.value })}
                  className="w-full h-8 px-2 rounded-xl border border-slate-200 bg-white font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Aucune zone</option>
                  {zones.map((z) => (
                    <option key={z.id_zone || z} value={z.id_zone || z}>
                      {z.id_zone || z} - {z.libelle || ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Commentaire / Observation (I)
                </label>
                <textarea
                  rows={2}
                  value={editFormData.commentaire || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, commentaire: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Notes, motif ou diagnostic..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingMovement(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateMouvement && editingMovement) {
                    const rawOt = editFormData.num_commande ? String(editFormData.num_commande).trim() : '';
                    const finalOt = rawOt !== '' ? rawOt : 'INCONNU';
                    onUpdateMouvement(editingMovement.id, {
                      ...editingMovement,
                      ...editFormData,
                      type: editFormData.type || editingMovement.type || 'Sortie Interne',
                      num_commande: finalOt,
                      quantite: Number(editFormData.quantite) || editingMovement.quantite,
                    });
                    setEditingMovement(null);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Enregistrer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MOVEMENT MODAL */}
      {deletingMovement && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Supprimer le mouvement</h3>
                <p className="text-xs text-slate-500">Le stock sera recalculé automatiquement.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span>Bon :</span>
                <b className="text-indigo-950">{deletingMovement.code_bon}</b>
              </div>
              <div className="flex justify-between">
                <span>Article :</span>
                <b>{deletingMovement.ref}</b>
              </div>
              <div className="flex justify-between">
                <span>Quantité :</span>
                <b>{deletingMovement.quantite} pcs</b>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMovement(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteMouvement && deletingMovement) {
                    onDeleteMouvement(deletingMovement.id);
                    setDeletingMovement(null);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVEMENT VOUCHER MODAL */}
      {voucherModalMvt && (
        <MovementVoucherModal
          isOpen={Boolean(voucherModalMvt)}
          onClose={() => setVoucherModalMvt(null)}
          movement={voucherModalMvt}
          articleInfo={resolveArticleInfo(voucherModalMvt, { stockItems, warehouseItems })}
          destinationInfo={resolveDestinationInfo(voucherModalMvt, { machines, zones, technicians, operations })}
          intervenantInfo={resolveIntervenantInfo(voucherModalMvt, { technicians, operations })}
          equationInfo={resolveStockEquation(voucherModalMvt, { stockItems, warehouseItems })}
        />
      )}
    </div>
  );
}
