import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Wrench,
  Play,
  CheckCircle,
  User,
  Package,
  Search,
  SlidersHorizontal,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Layers,
  Factory,
  ChevronDown,
  AlertTriangle,
  FileText,
  Radio,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import PeriodFilterBar from '../../components/common/PeriodFilterBar';
import { type PeriodFilterState, isDateInPeriod } from '../../../utils/datePeriodUtils';
import { useI18n } from '../../../i18n/I18nContext';
import { dataIntegrityService } from '../../../services/dataIntegrityService';

export default function BonsTravailTab({
  interventions = [],
  machines = [],
  onStartLive,
  onUpdateIntervention: _onUpdateIntervention,
  onNavigateToTab,
  stockItems = [],
  technicians = [],
  intervenants = [],
  panneCategories: _panneCategories = {},
  actionsByPanne: _actionsByPanne = {},
  travauxAFaire: _travauxAFaire = [],
  showToast,
}) {
  const { t } = useI18n();
  const resolveTechNom = (bt) => {
    if (bt.technicien_matricule) {
      const found = (technicians || []).find(
        (t) => (t.id_technician || t.id) === bt.technicien_matricule
      );
      if (found) return found.nom;
    }
    return bt.intervenant || 'Non assigné';
  };

  const resolvePdrDisplay = (bt) => {
    const ref = bt.pdr_ref || bt.pdr;
    if (!ref) return null;
    const item = (stockItems || []).find((s) => s.ref === ref || s.code_article === ref);
    return {
      ref,
      designation: item ? (item.designation || item.nom) : (bt.pdr_designation || ref),
    };
  };
  const [filterStatus, setFilterStatus] = useState('EN_COURS'); // 'ALL', 'EN_COURS', 'CLOTURE', 'WITH_PDR'
  const [filterTech, setFilterTech] = useState('ALL');
  const [filterMachine, setFilterMachine] = useState('ALL');
  const [filterTypePanne, setFilterTypePanne] = useState('ALL');
  const [orphanFilter, setOrphanFilter] = useState('ALL'); // 'ALL' | 'ORPHAN_ONLY' | 'LINKED_ONLY'
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>({ preset: 'ALL' });
  const [searchTerm, setSearchTerm] = useState('');

  // Sorting & Pagination State
  const [sortField, setSortField] = useState('num_bt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // BTs are interventions that have a num_bt
  const bts = useMemo(() => {
    return interventions.filter((item) => Boolean(item.num_bt));
  }, [interventions]);

  // Annotate BTs with orphan status
  const btsWithOrphan = useMemo(
    () => dataIntegrityService.annotateCorrectiveOrphans(bts, machines),
    [bts, machines]
  );

  const orphanCount = useMemo(
    () => btsWithOrphan.filter((b) => b._isOrphan).length,
    [btsWithOrphan]
  );

  // All technicians present in BTs + configured intervenants
  const availableTechs = useMemo(() => {
    const set = new Set();
    bts.forEach((b) => {
      if (b.intervenant) set.add(b.intervenant);
    });
    (intervenants || []).forEach((i) => {
      const nom = i.nom || i.name;
      if (nom) set.add(nom);
    });
    (technicians || []).forEach((t) => {
      const nom = t.nom || t.name;
      if (nom) set.add(nom);
    });
    return Array.from(set).sort();
  }, [bts, intervenants, technicians]);

  // All machines present in BTs + registered machines from SSOT (excluding archived for creation/selection)
  const availableMachines = useMemo(() => {
    const set = new Set();
    if (Array.isArray(machines)) {
      machines
        .filter((m) => {
          const statusNorm = String(m?.status || m?.statut || '').trim().toUpperCase();
          return (
            statusNorm !== 'ARCHIVEE' &&
            statusNorm !== 'ARCHIVÉE' &&
            statusNorm !== 'ARCHIVED' &&
            m?.is_active !== false &&
            m?.actif !== false
          );
        })
        .forEach((m) => {
          const id = m.id_machine_registered || m.id || m.code;
          if (id) set.add(id);
        });
    }
    bts.forEach((b) => {
      if (b.code_machine) set.add(b.code_machine);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [bts, machines]);

  // All types of panne present in BTs
  const availableTypesPanne = useMemo(() => {
    const set = new Set();
    bts.forEach((b) => {
      if (b.type_panne) set.add(b.type_panne);
    });
    return Array.from(set).sort();
  }, [bts]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const total = bts.length;
    const inProgress = bts.filter((b) => b.statut === 'EN_COURS' || b.statut === 'BT_PLANIFIE').length;
    const closed = bts.filter((b) => b.statut === 'CLOTURE').length;
    const withPdr = bts.filter((b) => Boolean(b.pdr || b.pdr_ref)).length;

    return { total, inProgress, closed, withPdr };
  }, [bts]);

  // Filtered BTs
  const filteredBts = useMemo(() => {
    return btsWithOrphan.filter((bt) => {
      if (
        filterStatus === 'EN_COURS' &&
        bt.statut !== 'EN_COURS' &&
        bt.statut !== 'BT_PLANIFIE' &&
        bt.statut !== 'DEMANDE'
      )
        return false;
      if (filterStatus === 'CLOTURE' && bt.statut !== 'CLOTURE') return false;
      if (filterStatus === 'WITH_PDR' && !bt.pdr && !bt.pdr_ref) return false;

      if (filterTech !== 'ALL' && bt.intervenant !== filterTech) return false;
      if (filterMachine !== 'ALL' && bt.code_machine !== filterMachine) return false;
      if (filterTypePanne !== 'ALL' && bt.type_panne !== filterTypePanne) return false;
      if (orphanFilter === 'ORPHAN_ONLY' && !bt._isOrphan) return false;
      if (orphanFilter === 'LINKED_ONLY' && bt._isOrphan) return false;

      // Period Filter (P1 Factory Memory)
      const btDate = bt.date_demande || bt.date || bt.date_cloture || bt.created_at;
      if (!isDateInPeriod(btDate, periodFilter)) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const num = String(bt.num_bt || '').toLowerCase();
        const machine = String(bt.code_machine || '').toLowerCase();
        const anom = String(bt.anomalie || '').toLowerCase();
        const desc = String(bt.travail_a_faire || bt.action_realisee || '').toLowerCase();
        const tech = String(bt.intervenant || '').toLowerCase();
        const pdr = String(bt.pdr || bt.pdr_ref || '').toLowerCase();
        if (
          !num.includes(term) &&
          !machine.includes(term) &&
          !anom.includes(term) &&
          !desc.includes(term) &&
          !tech.includes(term) &&
          !pdr.includes(term)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [btsWithOrphan, filterStatus, filterTech, filterMachine, filterTypePanne, orphanFilter, periodFilter, searchTerm]);

  // Available dates for PeriodFilterBar
  const availableBtDates = useMemo(() => {
    return bts.map((b) => b.date_demande || b.date || b.date_cloture || b.created_at);
  }, [bts]);

  // Sorting
  const sortedBts = useMemo(() => {
    const list = [...filteredBts];
    list.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredBts, sortField, sortOrder]);

  // Pagination
  const totalItems = sortedBts.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayedBts =
    pageSize === 0 ? sortedBts : sortedBts.slice(startIndex, startIndex + effectivePageSize);

  // Table row padding (20-row standard)
  const displayedBts = useMemo(() => {
    const minRows = 20;
    if (rawDisplayedBts.length >= minRows) return rawDisplayedBts;
    const padded = [...rawDisplayedBts];
    for (let i = 0; i < minRows - rawDisplayedBts.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, id: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayedBts]);

  const toggleSort = (field) => {
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
      <ArrowUp className="w-3 h-3 text-blue-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-700 shrink-0 font-bold" />
    );
  };

  const hasActiveFilters =
    filterStatus !== 'ALL' ||
    filterTech !== 'ALL' ||
    filterMachine !== 'ALL' ||
    filterTypePanne !== 'ALL' ||
    orphanFilter !== 'ALL' ||
    periodFilter.preset !== 'ALL' ||
    Boolean(searchTerm);

  const clearAllFilters = () => {
    setFilterStatus('ALL');
    setFilterTech('ALL');
    setFilterMachine('ALL');
    setFilterTypePanne('ALL');
    setOrphanFilter('ALL');
    setPeriodFilter({ preset: 'ALL' });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleStartLiveIntervention = (bt) => {
    onStartLive(bt.id);
    showToast?.(`Intervention Live démarrée pour ${bt.num_bt} (${bt.code_machine})`, 'success');
    if (onNavigateToTab) {
      onNavigateToTab('corrective_live');
    }
  };

  const handleExportFilteredExcel = () => {
    try {
      const headers = [
        'N° BT (B)',
        'Machine (A)',
        'Intervenant (D)',
        'Date Demande (C)',
        'Heure Début (E)',
        'Type Panne (I)',
        'Anomalie (J)',
        'Travail à Faire (K)',
        'PDR (L)',
        'Statut',
      ];
      const dataRows = filteredBts.map((item) => [
        item.num_bt || '',
        item.code_machine || '',
        item.intervenant || '',
        item.date_demande || '',
        item.heure_debut || '',
        item.type_panne || '',
        item.anomalie || '',
        item.travail_a_faire || '',
        item.pdr || item.pdr_ref || '',
        item.statut || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bons_de_Travail');
      XLSX.writeFile(wb, `Bons_de_Travail_Export_${new Date().toISOString().split('T')[0]}.xlsx`);

      showToast?.('Export Excel des Bons de Travail généré avec succès (.xlsx)', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Erreur lors de l\'export Excel', 'error');
    }
  };

  const btColumns = useMemo(
    () => [
      {
        key: 'num_bt',
        label: 'N° BT',
        colLetter: 'Col B',
        icon: Wrench,
        sortable: true,
        render: (bt) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center font-black text-[10px] border border-blue-200/60 shadow-2xs font-mono">
              BT
            </span>
            <span className="font-bold text-blue-900 font-mono">{bt.num_bt}</span>
          </div>
        ),
      },
      {
        key: 'code_machine',
        label: 'Machine',
        colLetter: 'Col A',
        icon: Factory,
        sortable: true,
        render: (bt) => (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold whitespace-nowrap">
              {bt.code_machine}
            </span>
            {bt._isOrphan && (
              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-bold" title="Machine introuvable ou archivée">
                Orphelin
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'intervenant',
        label: 'Intervenant',
        colLetter: 'Col D',
        icon: User,
        sortable: true,
        render: (bt) => (
          <div className="flex items-center gap-1.5 whitespace-nowrap min-w-[150px]">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">{resolveTechNom(bt)}</span>
          </div>
        ),
      },
      {
        key: 'type_panne',
        label: 'Type',
        colLetter: 'Col I',
        icon: Layers,
        sortable: true,
        render: (bt) => (
          <span className="px-2.5 py-1 rounded-md font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
            {bt.type_panne || 'M'}
          </span>
        ),
      },
      {
        key: 'anomalie',
        label: 'Anomalie',
        colLetter: 'Col J',
        icon: AlertTriangle,
        sortable: true,
        render: (bt) => (
          <span className="font-bold text-slate-900 max-w-xs truncate block" title={bt.anomalie}>
            {bt.anomalie || 'court_circuit'}
          </span>
        ),
      },
      {
        key: 'travail_a_faire',
        label: 'Travail à Faire',
        colLetter: 'Col K',
        icon: FileText,
        render: (bt) => (
          <span className="text-slate-700 max-w-xs truncate block" title={bt.travail_a_faire}>
            {bt.travail_a_faire || bt.action_realisee || 'Intervention standard'}
          </span>
        ),
      },
      {
        key: 'pdr',
        label: 'PDR Prévue',
        colLetter: 'Col L',
        icon: Package,
        render: (bt) => {
          const pdrObj = resolvePdrDisplay(bt);
          return pdrObj ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-mono font-bold shadow-2xs"
              title={pdrObj.designation}
            >
              <Package className="w-3 h-3 text-cyan-600 shrink-0" />
              <span className="truncate">{pdrObj.ref}</span>
            </span>
          ) : (
            <span className="text-slate-300 font-mono text-[11px]">—</span>
          );
        },
      },
      {
        key: 'statut',
        label: 'Statut',
        icon: Radio,
        align: 'center',
        sortable: true,
        render: (bt) => {
          const isClosed = bt.statut === 'CLOTURE';
          return isClosed ? (
            <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono shadow-2xs">
              CLÔTURÉ
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-blue-100 text-blue-900 border border-blue-300 font-mono animate-pulse shadow-2xs">
              EN COURS
            </span>
          );
        },
      },
      {
        key: 'actions',
        label: 'Action Directe',
        icon: Play,
        align: 'center',
        headerClassName: 'w-36 text-center whitespace-nowrap',
        render: (bt) => {
          const isClosed = bt.statut === 'CLOTURE';
          return !isClosed ? (
            <button
              onClick={() => handleStartLiveIntervention(bt)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer shadow-2xs active:scale-95"
              title="Lancer le Chrono Live et déduire automatiquement les pauses"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Chrono Live</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 font-mono font-bold text-xs shadow-2xs">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              {bt.temps_intervention_calc || bt.temps_intervention || '00:45'}
            </span>
          );
        },
      },
    ],
    [technicians, stockItems]
  );

  return (
    <div className="space-y-6">
      {/* 1. Top 4 Primary KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total BTs */}
        <div
          onClick={() => setFilterStatus('ALL')}
          className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            filterStatus === 'ALL'
              ? 'border-blue-400 ring-2 ring-blue-400/30 shadow-md'
              : 'border-slate-200/90 hover:border-blue-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(59,130,246,0.12)] hover:-translate-y-1'
          }`}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                Total Bons de Travail (BT)
              </span>
              <Wrench className="w-6 h-6 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-blue-600 transition-colors">
                {kpiStats.total}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">ordres</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                Col B Excel
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Historique usine :</span>
            <span className="font-mono font-bold text-blue-700">Complet</span>
          </div>
        </div>

        {/* BTs En Cours */}
        <div
          onClick={() => setFilterStatus('EN_COURS')}
          className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            filterStatus === 'EN_COURS'
              ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-md'
              : 'border-slate-200/90 hover:border-amber-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(245,158,11,0.12)] hover:-translate-y-1'
          }`}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {t('corrective.bt.title')}
              </span>
              <Play className="w-6 h-6 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-600 font-mono tracking-tight">
                {kpiStats.inProgress}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">interventions</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono animate-pulse">
                Chrono Live disponible
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Techniciens mobilisés :</span>
            <span className="font-mono font-bold text-amber-700">{availableTechs.length} actifs</span>
          </div>
        </div>

        {/* BTs Clôturés */}
        <div
          onClick={() => setFilterStatus('CLOTURE')}
          className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            filterStatus === 'CLOTURE'
              ? 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-md'
              : 'border-slate-200/90 hover:border-emerald-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(16,185,129,0.12)] hover:-translate-y-1'
          }`}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                BTs Clôturés & Validés
              </span>
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
                {kpiStats.closed}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">dépannages OK</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                Temps calculé & PDR déstockée
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Taux résolution :</span>
            <span className="font-mono font-bold text-emerald-700">
              {kpiStats.total ? Math.round((kpiStats.closed / kpiStats.total) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Avec PDR */}
        <div
          onClick={() => setFilterStatus('WITH_PDR')}
          className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            filterStatus === 'WITH_PDR'
              ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-md'
              : 'border-slate-200/90 hover:border-cyan-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(6,182,212,0.12)] hover:-translate-y-1'
          }`}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-cyan-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                Consommation PDR
              </span>
              <Package className="w-6 h-6 text-cyan-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-600 font-mono tracking-tight">
                {kpiStats.withPdr}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">avec pièces</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-cyan-700 font-bold bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 font-mono">
                Liaison Stock Automatique
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Impact magasin :</span>
            <span className="font-mono font-bold text-cyan-700">Sorties PDR</span>
          </div>
        </div>
      </div>

      {/* 1.5. Period Filter Bar (P1 Factory Memory) */}
      <PeriodFilterBar
        value={periodFilter}
        onChange={(next) => {
          setPeriodFilter(next);
          setCurrentPage(1);
        }}
        availableDates={availableBtDates}
        filteredCount={sortedBts.length}
        totalCount={bts.length}
      />

      {/* 2. Filter & Search Card (Unified Mature Light UI Design System) */}
      <div className="relative z-30 bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-200/80 flex items-center justify-center text-blue-700 shadow-2xs">
              <SlidersHorizontal className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {t('common.filters.title')}
                </span>
                <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold border border-blue-200/70 shadow-2xs">
                  {filteredBts.length} BT{filteredBts.length > 1 ? 's' : ''} affiché{filteredBts.length > 1 ? 's' : ''} / {bts.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Ordres de Réparation • Lancement direct du Chronomètre d'Atelier
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportFilteredExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter les BTs filtrés vers Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="w-8 h-8 rounded-full border border-rose-200/80 bg-rose-50 hover:bg-rose-100 text-rose-700 transition flex items-center justify-center cursor-pointer shadow-2xs active:scale-95 animate-in fade-in"
                title="Réinitialiser tous les filtres actifs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Status Presets */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
            <Wrench className="w-3 h-3 text-slate-400" />
            État BT :
          </span>
          {[
            {
              key: 'ALL',
              label: 'Tous les BTs',
              count: bts.length,
              activeBg: 'bg-slate-900 text-white shadow-xs',
              colorDot: null,
            },
            {
              key: 'EN_COURS',
              label: 'En Cours',
              count: kpiStats.inProgress,
              activeBg: 'bg-amber-600 text-white shadow-xs',
              colorDot: 'bg-amber-500',
            },
            {
              key: 'CLOTURE',
              label: 'Clôturés',
              count: kpiStats.closed,
              activeBg: 'bg-emerald-600 text-white shadow-xs',
              colorDot: 'bg-emerald-500',
            },
            {
              key: 'WITH_PDR',
              label: 'Avec PDR',
              count: kpiStats.withPdr,
              activeBg: 'bg-cyan-600 text-white shadow-xs',
              colorDot: 'bg-cyan-500',
            },
          ].map((preset) => {
            const isActive = filterStatus === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setFilterStatus(preset.key);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? preset.activeBg
                    : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60'
                }`}
              >
                {preset.colorDot && (
                  <span
                    className={`w-2 h-2 rounded-full ${preset.colorDot} ${
                      isActive ? 'ring-2 ring-white/50' : ''
                    }`}
                  />
                )}
                <span>{preset.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200/60'
                  }`}
                >
                  {preset.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Orphan Filter Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs no-scrollbar pt-2 border-t border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1 shrink-0">
            <AlertTriangle className="w-3 h-3 text-amber-500" />
            Intégrité Machine :
          </span>
          {[
            { key: 'ALL', label: 'Toutes', count: btsWithOrphan.length },
            { key: 'LINKED_ONLY', label: 'Liées (Actives)', count: btsWithOrphan.length - orphanCount },
            { key: 'ORPHAN_ONLY', label: `Orphelines (${orphanCount})`, count: orphanCount, highlight: orphanCount > 0 },
          ].map((preset) => {
            const isSelected = orphanFilter === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setOrphanFilter(preset.key);
                  setCurrentPage(1);
                }}
                className={`h-7 px-2.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isSelected
                    ? preset.highlight
                      ? 'bg-amber-600 text-white font-bold shadow-xs'
                      : 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'bg-slate-100/80 hover:bg-slate-200 text-slate-700 border border-slate-200/60 font-medium'
                }`}
              >
                <span>{preset.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200/60'
                }`}>
                  {preset.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 5-Column Multi-Criteria Filter Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
          {/* 1. Omni-Text Search */}
          <div className="w-full sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Recherche</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                Col. B+A
              </span>
            </div>
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs pointer-events-none">
                <Search className="w-3 h-3" />
              </div>
              <input
                type="text"
                placeholder="N° BT, machine, PDR..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-7 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Technicien Filter (Col. D) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Intervenant</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                Col. D
              </span>
            </div>
            <CustomSelect
              value={filterTech}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-blue-100 border border-blue-300/80 flex items-center justify-center text-blue-700 shadow-2xs">
                  <User className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setFilterTech(val);
                setCurrentPage(1);
              }}
              searchable
              options={[
                { value: 'ALL', label: `Tous les Techniciens (${availableTechs.length})` },
                ...availableTechs.map((tech) => ({
                  value: tech,
                  label: tech,
                })),
              ]}
            />
          </div>

          {/* 3. Machine Filter (Col. A) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Machine</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                Col. A
              </span>
            </div>
            <CustomSelect
              value={filterMachine}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Factory className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setFilterMachine(val);
                setCurrentPage(1);
              }}
              searchable
              options={[
                { value: 'ALL', label: `Toutes les Machines (${availableMachines.length})` },
                ...availableMachines.map((m) => ({
                  value: m,
                  label: m,
                })),
              ]}
            />
          </div>

          {/* 4. Type Panne Filter (Col. I) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Type de Panne</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200/80">
                Col. I
              </span>
            </div>
            <CustomSelect
              value={filterTypePanne}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-cyan-100 border border-cyan-300/80 flex items-center justify-center text-cyan-700 shadow-2xs">
                  <Layers className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setFilterTypePanne(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: `Tous Types (${availableTypesPanne.length})` },
                ...availableTypesPanne.map((cat) => ({
                  value: cat,
                  label: `Type ${cat}`,
                })),
              ]}
            />
          </div>

          {/* 5. Sort Menu Button & Popover */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Tri & Ordre</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Col. B→L
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'num_bt' || sortOrder !== 'desc'
                  ? 'bg-indigo-50/80 text-indigo-950 border-indigo-300 ring-1 ring-indigo-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-300/80 flex items-center justify-center text-indigo-700 shrink-0 shadow-2xs">
                  <ArrowUpDown className="w-3 h-3" />
                </span>
                <span className="truncate">
                  Tri : <b className="font-mono text-slate-900">{sortField.slice(0, 10).toUpperCase()}</b> (
                  {sortOrder === 'asc' ? 'A→Z' : 'Z→A'})
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
                  <span>Sélectionner la Colonne de Tri</span>
                  <span>B→L</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                  {[
                    { key: 'num_bt', label: 'N° BT (Col. B)' },
                    { key: 'code_machine', label: 'Machine (Col. A)' },
                    { key: 'intervenant', label: 'Intervenant (Col. D)' },
                    { key: 'date_demande', label: 'Date Demande (Col. C)' },
                    { key: 'heure_debut', label: 'Heure Début (Col. E)' },
                    { key: 'type_panne', label: 'Type Panne (Col. I)' },
                    { key: 'anomalie', label: 'Anomalie (Col. J)' },
                    { key: 'travail_a_faire', label: 'Travail à Faire (Col. K)' },
                    { key: 'pdr', label: 'PDR Utilisée (Col. L)' },
                    { key: 'statut', label: 'Statut BT' },
                  ].map((col) => (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => {
                        toggleSort(col.key);
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

        {/* Active Filter Chips Bar */}
        {hasActiveFilters && (
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-slate-400 text-[11px] uppercase tracking-wider">
                Filtres actifs :
              </span>
              {searchTerm && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-bold text-[11px] border border-slate-200">
                  <span>Recherche: &quot;{searchTerm}&quot;</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="hover:text-rose-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 font-bold text-[11px] border border-blue-200">
                  <span>Statut: {filterStatus}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-blue-950 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterTech !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-[11px] border border-indigo-200">
                  <span>Tech: {filterTech}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTech('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-indigo-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterMachine !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
                  <span>Machine: {filterMachine}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMachine('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-amber-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {filterTypePanne !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-700 font-bold text-[11px] border border-cyan-200">
                  <span>Type: {filterTypePanne}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterTypePanne('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-cyan-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={clearAllFilters}
              className="text-slate-400 hover:text-rose-600 font-semibold text-[11px] transition cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Tout effacer</span>
            </button>
          </div>
        )}
      </div>

      {/* 3. Unified Industrial Data Grid */}
      <GmaoIndustrialDataGrid
        title="Tableau Bons_de_Travail • Ordre Excel Row 3 : B → L"
        icon={<FileSpreadsheet className="w-4 h-4 text-blue-600" />}
        excelMapping="N° | N° BT (B) | Machine (A) | Intervenant (D) | Type (I) | Anomalie (J) | Travail (K) | PDR (L) | Statut | Action"
        bannerColor="blue"
        columns={btColumns}
        data={displayedBts}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={toggleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<Wrench className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun Bon de Travail (BT) trouvé pour les filtres sélectionnés."
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 25, 50, 100, 200, 0],
          color: 'blue',
          itemLabel: 'bons',
        }}
      />
    </div>
  );
}
