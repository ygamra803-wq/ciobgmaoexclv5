import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Eye,
  Printer,
  SlidersHorizontal,
  RotateCcw,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Clock,
  Wrench,
  CheckCircle,
  Package,
  AlertTriangle,
  Layers,
  FileText,
  User,
  Factory,
  ChevronDown,
  Radio,
  Calendar,
} from 'lucide-react';
import { CorrectiveCalculationService } from '../../../domain/corrective/services/CorrectiveCalculationService';
import * as XLSX from 'xlsx';
import CustomSelect from '../../components/common/CustomSelect';
import GmaoIndustrialDataGrid from '../../components/common/GmaoIndustrialDataGrid';
import { useI18n } from '../../../i18n/I18nContext';

export default function ClotureRapportsTab({
  interventions = [],
  machines: registeredMachines = [],
  stockItems = [],
  technicians = [],
  onUpdateIntervention: _onUpdateIntervention,
  showToast,
}) {
  const { t } = useI18n();
  const resolveTechNom = (item) => {
    if (item.technicien_matricule) {
      const found = (technicians || []).find(
        (t) => (t.id_technician || t.id) === item.technicien_matricule
      );
      if (found) return found.nom;
    }
    return item.intervenant || 'm_hammed';
  };

  const resolvePdrDisplay = (item) => {
    const ref = item.pdr_ref || item.pdr;
    if (!ref) return null;
    const stockFound = (stockItems || []).find((s) => s.ref === ref || s.code_article === ref);
    return {
      ref,
      designation: stockFound ? (stockFound.designation || stockFound.nom) : (item.pdr_designation || ref),
    };
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('ALL');
  const [selectedTech, setSelectedTech] = useState('ALL');
  const [selectedTypePanne, setSelectedTypePanne] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL'); // 'ALL', 'CLOTURE', 'ARRET', 'PDR'
  const [previewItem, setPreviewItem] = useState(null);

  // Sorting & Pagination State
  const [sortField, setSortField] = useState('date_demande');
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

  // O(1) Relational Lookup Maps
  const stockMap = useMemo(() => {
    const map = new Map();
    (stockItems || []).forEach((s) => {
      const ref = s.ref || s.code_article;
      if (ref) map.set(String(ref).trim().toUpperCase(), s);
    });
    return map;
  }, [stockItems]);

  const machineMap = useMemo(() => {
    const map = new Map();
    (registeredMachines || []).forEach((m) => {
      const id = m.id_machine_registered || m.id;
      if (id) map.set(String(id).trim().toUpperCase(), m);
    });
    return map;
  }, [registeredMachines]);

  // Machine options
  const machines = useMemo(() => {
    const set = new Set();
    (registeredMachines || []).forEach((m) => {
      const id = m.id_machine_registered || m.id || m.code;
      if (id) set.add(id);
    });
    interventions.forEach((item) => {
      if (item.code_machine) set.add(item.code_machine);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [interventions, registeredMachines]);

  // Tech options
  const techs = useMemo(() => {
    const set = new Set();
    interventions.forEach((item) => {
      if (item.intervenant) set.add(item.intervenant);
    });
    return Array.from(set).sort();
  }, [interventions]);

  // Types Panne
  const typesPanne = useMemo(() => {
    const set = new Set();
    interventions.forEach((item) => {
      if (item.type_panne) set.add(item.type_panne);
    });
    return Array.from(set).sort();
  }, [interventions]);

  // KPI Metrics
  const kpiStats = useMemo(() => {
    const total = interventions.length;
    const closed = interventions.filter((i) => i.statut === 'CLOTURE' || i.temps_intervention_calc).length;
    const arret = interventions.filter((i) => i.arret_machine === true || i.arret_machine === 'OUI').length;
    const withPdr = interventions.filter((i) => Boolean(i.pdr || i.pdr_ref)).length;

    // MTTR calculation
    let totalMinutes = 0;
    let countMinutes = 0;
    interventions.forEach((i) => {
      const minutes =
        i.temps_minutes ||
        (i.temps_intervention_calc ? CorrectiveCalculationService.timeStringToMinutes(i.temps_intervention_calc) : 0);
      if (minutes > 0) {
        totalMinutes += minutes;
        countMinutes++;
      }
    });

    const avgMinutes = countMinutes > 0 ? Math.round(totalMinutes / countMinutes) : 45;
    const mttrFormatted = CorrectiveCalculationService.minutesToTimeString(avgMinutes);

    return { total, closed, arret, withPdr, avgMinutes, mttrFormatted };
  }, [interventions]);

  // Filtered interventions
  const filteredInterventions = useMemo(() => {
    return interventions.filter((item) => {
      if (selectedStatus === 'CLOTURE' && item.statut !== 'CLOTURE') return false;
      if (selectedStatus === 'ARRET' && !item.arret_machine) return false;
      if (selectedStatus === 'PDR' && !item.pdr && !item.pdr_ref) return false;

      if (selectedMachine !== 'ALL' && item.code_machine !== selectedMachine) return false;
      if (selectedTech !== 'ALL' && item.intervenant !== selectedTech) return false;
      if (selectedTypePanne !== 'ALL' && item.type_panne !== selectedTypePanne) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const code = String(item.code_machine || '').toLowerCase();
        const bt = String(item.num_bt || '').toLowerCase();
        const anom = String(item.anomalie || '').toLowerCase();
        const desc = String(item.travail_a_faire || item.action_realisee || '').toLowerCase();
        const tech = String(item.intervenant || '').toLowerCase();
        const pdr = String(item.pdr || item.pdr_ref || '').toLowerCase();
        if (
          !code.includes(term) &&
          !bt.includes(term) &&
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
  }, [interventions, selectedStatus, selectedMachine, selectedTech, selectedTypePanne, searchTerm]);

  // Sorting
  const sortedInterventions = useMemo(() => {
    const list = [...filteredInterventions];
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
  }, [filteredInterventions, sortField, sortOrder]);

  // Pagination
  const totalItems = sortedInterventions.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const rawDisplayed =
    pageSize === 0 ? sortedInterventions : sortedInterventions.slice(startIndex, startIndex + effectivePageSize);

  // Table row padding (20-row standard)
  const displayedInterventions = useMemo(() => {
    const minRows = 20;
    if (rawDisplayed.length >= minRows) return rawDisplayed;
    const padded = [...rawDisplayed];
    for (let i = 0; i < minRows - rawDisplayed.length; i++) {
      padded.push({ __isEmptyPlaceholder: true, id: `empty-${i}` });
    }
    return padded;
  }, [rawDisplayed]);

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
      <ArrowUp className="w-3 h-3 text-emerald-700 shrink-0 font-bold" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-700 shrink-0 font-bold" />
    );
  };

  const hasActiveFilters =
    selectedStatus !== 'ALL' ||
    selectedMachine !== 'ALL' ||
    selectedTech !== 'ALL' ||
    selectedTypePanne !== 'ALL' ||
    Boolean(searchTerm);

  const clearAllFilters = () => {
    setSelectedStatus('ALL');
    setSelectedMachine('ALL');
    setSelectedTech('ALL');
    setSelectedTypePanne('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleExportFilteredExcel = () => {
    try {
      const headers = [
        'N° BT (B)',
        'Machine (A)',
        'Demandeur',
        'Date Demande (C)',
        'Intervenant (D)',
        'Début (E)',
        'Fin (F)',
        'Temps Calculé (G)',
        'Arrêt Machine (H)',
        'Type Panne (I)',
        'Anomalie (J)',
        'Action / Travail Réalisé (K)',
        'PDR Utilisée (L)',
        'Marque (M)',
        'État (N)',
      ];
      const dataRows = filteredInterventions.map((item) => [
        item.num_bt || '',
        item.code_machine || '',
        item.demandeur || 'Production',
        item.date_demande || '',
        item.intervenant || '',
        `${item.date_debut || ''} ${item.heure_debut || ''}`.trim(),
        `${item.date_fin || ''} ${item.heure_fin || ''}`.trim(),
        item.temps_intervention_calc || item.temps_intervention || '',
        item.arret_machine ? 'OUI' : 'NON',
        item.type_panne || '',
        item.anomalie || '',
        item.action_realisee || item.travail_a_faire || '',
        item.pdr || item.pdr_ref || '',
        item.marque || '',
        item.etat_piece || 'Neuve',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rapport_Correctif_Filtre');
      XLSX.writeFile(wb, `Rapport_Correctif_${new Date().toISOString().split('T')[0]}.xlsx`);

      showToast?.('Export Excel du rapport filtré généré avec succès (.xlsx)', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Erreur lors de l\'export Excel', 'error');
    }
  };

  const reportColumns = useMemo(
    () => [
      {
        key: 'num_bt',
        label: 'N° BT',
        colLetter: 'Col B',
        icon: Wrench,
        sortable: true,
        render: (item) => (
          <div className="flex items-center gap-2 whitespace-nowrap">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-black text-[10px] border border-emerald-200/60 shadow-2xs font-mono">
              BT
            </span>
            <span className="font-bold text-emerald-900 font-mono">
              {item.num_bt || `BT-${String(item.id || 'OK').slice(-4)}`}
            </span>
          </div>
        ),
      },
      {
        key: 'code_machine',
        label: 'Machine',
        colLetter: 'Col A',
        icon: Factory,
        sortable: true,
        render: (item) => (
          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold whitespace-nowrap">
            {item.code_machine}
          </span>
        ),
      },
      {
        key: 'intervenant',
        label: 'Intervenant',
        colLetter: 'Col D',
        icon: User,
        sortable: true,
        render: (item) => (
          <div className="flex items-center gap-1.5 whitespace-nowrap min-w-[140px]">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-800">{resolveTechNom(item)}</span>
          </div>
        ),
      },
      {
        key: 'date_demande',
        label: 'Date Demande',
        colLetter: 'Col C',
        icon: Calendar,
        sortable: true,
        render: (item) => (
          <span className="font-semibold text-slate-800 font-mono whitespace-nowrap">
            {item.date_demande || item.date || '2026-03-24'}
          </span>
        ),
      },
      {
        key: 'temps_intervention_calc',
        label: 'Temps Ouvré',
        colLetter: 'Col G',
        icon: Clock,
        sortable: true,
        render: (item) => (
          <div className="flex items-center gap-1.5 font-mono font-bold text-emerald-700 whitespace-nowrap">
            <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{item.temps_intervention_calc || item.temps_intervention || '00:45'}</span>
          </div>
        ),
      },
      {
        key: 'arret_machine',
        label: 'Arrêt (H)',
        icon: AlertTriangle,
        align: 'center',
        sortable: true,
        render: (item) => {
          const isArret = item.arret_machine === true || item.arret_machine === 'OUI';
          return isArret ? (
            <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-purple-100 text-purple-800 border border-purple-200 font-mono shadow-2xs">
              ARRÊT
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full font-bold text-[10.5px] bg-slate-100 text-slate-500 font-mono">
              NON
            </span>
          );
        },
      },
      {
        key: 'type_panne',
        label: 'Type',
        colLetter: 'Col I',
        icon: Layers,
        sortable: true,
        render: (item) => (
          <span className="px-2.5 py-1 rounded-md font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
            {item.type_panne || 'M'}
          </span>
        ),
      },
      {
        key: 'anomalie',
        label: 'Anomalie',
        colLetter: 'Col J',
        icon: Radio,
        sortable: true,
        render: (item) => (
          <span className="font-bold text-slate-900 max-w-xs truncate block" title={item.anomalie}>
            {item.anomalie || 'court_circuit'}
          </span>
        ),
      },
      {
        key: 'action_realisee',
        label: 'Travail Réalisé',
        colLetter: 'Col K',
        icon: FileText,
        render: (item) => (
          <span className="text-slate-700 max-w-xs truncate block" title={item.action_realisee || item.travail_a_faire}>
            {item.action_realisee || item.travail_a_faire || 'Dépannage et remise en route'}
          </span>
        ),
      },
      {
        key: 'pdr',
        label: 'PDR & Marque',
        colLetter: 'Col L/M',
        icon: Package,
        render: (item) => {
          const pdrObj = resolvePdrDisplay(item);
          return pdrObj ? (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200 text-xs font-mono font-bold shadow-2xs"
              title={pdrObj.designation}
            >
              <Package className="w-3 h-3 text-cyan-600 shrink-0" />
              <span className="truncate">
                {pdrObj.ref} {item.marque ? `(${item.marque})` : ''}
              </span>
            </span>
          ) : (
            <span className="text-slate-300 font-mono text-[11px]">—</span>
          );
        },
      },
      {
        key: 'actions',
        label: 'Fiche',
        icon: Eye,
        align: 'center',
        headerClassName: 'w-24 text-center whitespace-nowrap',
        render: (item) => (
          <button
            onClick={() => setPreviewItem(item)}
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-600 hover:text-emerald-800 transition cursor-pointer shadow-2xs active:scale-95"
            title="Consulter la fiche technique d'intervention"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
        ),
      },
    ],
    [technicians, stockItems]
  );

  return (
    <div className="space-y-6">
      {/* 1. Top 4 Primary KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Interventions Clôturées */}
        <div
          onClick={() => setSelectedStatus('ALL')}
          className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            selectedStatus === 'ALL'
              ? 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-md'
              : 'border-slate-200/90 hover:border-emerald-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(16,185,129,0.12)] hover:-translate-y-1'
          }`}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                {t('corrective.cloture.closed_summary')}
              </span>
              <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 font-mono tracking-tight group-hover:text-emerald-600 transition-colors">
                {kpiStats.total}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">interventions</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                Feuille Rapport Excel
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Clôturées à 100% :</span>
            <span className="font-mono font-bold text-emerald-700">{kpiStats.closed} validées</span>
          </div>
        </div>

        {/* MTTR Moyen */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 hover:border-blue-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(59,130,246,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                MTTR Moyen (Maintenabilité)
              </span>
              <Clock className="w-6 h-6 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-600 font-mono tracking-tight">
                {kpiStats.mttrFormatted}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">/ panne</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                {kpiStats.avgMinutes} min temps ouvré
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Formule :</span>
            <span className="font-mono font-bold text-blue-700">Σ Temps / N</span>
          </div>
        </div>

        {/* Pannes avec Arrêt Machine */}
        <div
          onClick={() => setSelectedStatus('ARRET')}
          className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            selectedStatus === 'ARRET'
              ? 'border-purple-400 ring-2 ring-purple-400/30 shadow-md'
              : 'border-slate-200/90 hover:border-purple-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(168,85,247,0.12)] hover:-translate-y-1'
          }`}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                Arrêts Machine Traités
              </span>
              <AlertTriangle className="w-6 h-6 text-purple-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-purple-600 font-mono tracking-tight">
                {kpiStats.arret}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">arrêts</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-mono">
                Col H Excel
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Impact sur parc :</span>
            <span className="font-mono font-bold text-purple-700">
              {kpiStats.total ? Math.round((kpiStats.arret / kpiStats.total) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Total PDR Consommées */}
        <div
          onClick={() => setSelectedStatus('PDR')}
          className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group cursor-pointer flex flex-col justify-between ${
            selectedStatus === 'PDR'
              ? 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-md'
              : 'border-slate-200/90 hover:border-cyan-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(6,182,212,0.12)] hover:-translate-y-1'
          }`}
        >
          <div className="absolute -top-10 -right-10 w-28 h-28 bg-cyan-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-cyan-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider">
                PDR Utilisées & Sorties
              </span>
              <Package className="w-6 h-6 text-cyan-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-600 font-mono tracking-tight">
                {kpiStats.withPdr}
              </span>
              <span className="text-xs font-bold text-slate-400 font-mono">pièces</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
              <span className="text-cyan-700 font-bold bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 font-mono">
                Col L/M/N Excel
              </span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 font-medium">Déstockage :</span>
            <span className="font-mono font-bold text-cyan-700">Automatique</span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Search Card (Unified Mature Light UI Design System) */}
      <div className="relative z-30 bg-white border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-200/80 flex items-center justify-center text-emerald-700 shadow-2xs">
              <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {t('common.filters.title')}
                </span>
                <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-lg text-xs font-bold border border-emerald-200/70 shadow-2xs">
                  {filteredInterventions.length} rapport{filteredInterventions.length > 1 ? 's' : ''} affiché{filteredInterventions.length > 1 ? 's' : ''} / {interventions.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Miroir direct de la feuille Excel <b>Rapport (Col A → N)</b> • Historique usine complet
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleExportFilteredExcel}
              className="h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter le rapport filtré vers Excel (.xlsx)"
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

        {/* Quick Presets */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mr-1">
            <CheckCircle className="w-3 h-3 text-slate-400" />
            Filtres Rapides :
          </span>
          {[
            {
              key: 'ALL',
              label: 'Tous les Rapports',
              count: interventions.length,
              activeBg: 'bg-slate-900 text-white shadow-xs',
              colorDot: null,
            },
            {
              key: 'CLOTURE',
              label: 'Clôturés Validés',
              count: kpiStats.closed,
              activeBg: 'bg-emerald-600 text-white shadow-xs',
              colorDot: 'bg-emerald-500',
            },
            {
              key: 'ARRET',
              label: 'Avec Arrêt Machine',
              count: kpiStats.arret,
              activeBg: 'bg-purple-600 text-white shadow-xs',
              colorDot: 'bg-purple-500',
            },
            {
              key: 'PDR',
              label: 'Avec PDR Utilisée',
              count: kpiStats.withPdr,
              activeBg: 'bg-cyan-600 text-white shadow-xs',
              colorDot: 'bg-cyan-500',
            },
          ].map((preset) => {
            const isActive = selectedStatus === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => {
                  setSelectedStatus(preset.key);
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
                placeholder="BT, machine, PDR..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pl-9 pr-7 rounded-xl border border-slate-200 bg-slate-50/70 text-xs font-semibold focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
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

          {/* 2. Machine Filter (Col. A) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Machine</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200/80">
                Col. A
              </span>
            </div>
            <CustomSelect
              value={selectedMachine}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-amber-100 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-2xs">
                  <Factory className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setSelectedMachine(val);
                setCurrentPage(1);
              }}
              searchable
              options={[
                { value: 'ALL', label: `Toutes les Machines (${machines.length})` },
                ...machines.map((m) => ({
                  value: m,
                  label: m,
                })),
              ]}
            />
          </div>

          {/* 3. Intervenant Filter (Col. D) */}
          <div>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Intervenant</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                Col. D
              </span>
            </div>
            <CustomSelect
              value={selectedTech}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-blue-100 border border-blue-300/80 flex items-center justify-center text-blue-700 shadow-2xs">
                  <User className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setSelectedTech(val);
                setCurrentPage(1);
              }}
              searchable
              options={[
                { value: 'ALL', label: `Tous les Techniciens (${techs.length})` },
                ...techs.map((t) => ({
                  value: t,
                  label: t,
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
              value={selectedTypePanne}
              prefixIcon={
                <span className="w-5 h-5 rounded-md bg-cyan-100 border border-cyan-300/80 flex items-center justify-center text-cyan-700 shadow-2xs">
                  <Layers className="w-3 h-3" />
                </span>
              }
              onChange={(val) => {
                setSelectedTypePanne(val);
                setCurrentPage(1);
              }}
              options={[
                { value: 'ALL', label: `Tous Types (${typesPanne.length})` },
                ...typesPanne.map((tp) => ({
                  value: tp,
                  label: `Type ${tp}`,
                })),
              ]}
            />
          </div>

          {/* 5. Sort Menu Button & Popover */}
          <div className="relative" ref={sortMenuRef}>
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <span>Tri & Ordre</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                Col. A→N
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSortMenu(!showSortMenu)}
              className={`w-full h-9 px-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-between cursor-pointer ${
                showSortMenu || sortField !== 'date_demande' || sortOrder !== 'desc'
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
                  <span>A→N</span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs max-h-60 overflow-y-auto pr-0.5">
                  {[
                    { key: 'num_bt', label: 'N° BT (Col. B)' },
                    { key: 'code_machine', label: 'Machine (Col. A)' },
                    { key: 'intervenant', label: 'Intervenant (Col. D)' },
                    { key: 'date_demande', label: 'Date Demande (Col. C)' },
                    { key: 'temps_intervention_calc', label: 'Temps Calculé (Col. G)' },
                    { key: 'type_panne', label: 'Type Panne (Col. I)' },
                    { key: 'anomalie', label: 'Anomalie (Col. J)' },
                    { key: 'action_realisee', label: 'Travail Réalisé (Col. K)' },
                    { key: 'pdr', label: 'PDR Utilisée (Col. L)' },
                    { key: 'arret_machine', label: 'Arrêt Machine (Col. H)' },
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
              {selectedStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-[11px] border border-emerald-200">
                  <span>Filtre: {selectedStatus}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStatus('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-emerald-950 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedMachine !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 font-bold text-[11px] border border-amber-200">
                  <span>Machine: {selectedMachine}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMachine('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-amber-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedTech !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700 font-bold text-[11px] border border-blue-200">
                  <span>Tech: {selectedTech}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTech('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-blue-900 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {selectedTypePanne !== 'ALL' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-700 font-bold text-[11px] border border-cyan-200">
                  <span>Type: {selectedTypePanne}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTypePanne('ALL');
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
        title="Tableau Rapport_Correctif • Ordre Excel Row 3 : A → N"
        icon={<FileSpreadsheet className="w-4 h-4 text-emerald-600" />}
        excelMapping="N° | N° BT (B) | Machine (A) | Intervenant (D) | Date (C) | Temps Ouvré (G) | Arrêt (H) | Type (I) | Anomalie (J) | Travail Réalisé (K) | PDR (L/M) | Fiche"
        bannerColor="emerald"
        columns={reportColumns}
        data={displayedInterventions}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={toggleSort}
        renderSortIcon={renderSortIcon}
        startIndex={startIndex}
        showRowNumber={true}
        emptyIcon={<FileSpreadsheet className="w-8 h-8 text-slate-300" />}
        emptyMessage="Aucun rapport d'intervention trouvé pour les filtres sélectionnés."
        pagination={{
          currentPage,
          setCurrentPage,
          pageSize,
          setPageSize,
          totalItems,
          pageSizeOptions: [20, 25, 50, 100, 200, 0],
          color: 'emerald',
          itemLabel: 'rapports',
        }}
      />

      {/* Technical Report Preview Modal */}
      {previewItem && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-300/80 flex items-center justify-center text-emerald-700 shadow-xs">
                  <FileText className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Fiche Technique de Rapport d'Intervention
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Bon de Travail : <b>{previewItem.num_bt || 'BT-4825'}</b> • Machine : <b>{previewItem.code_machine}</b>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer shadow-2xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs text-slate-700">
              {(() => {
                const targetMach = machineMap.get(String(previewItem.code_machine || '').trim().toUpperCase());
                const machDesignation = targetMach?.designation || previewItem.code_machine;
                const machZone = targetMach?.id_zone_default || targetMach?.id_zone || 'Atelier';

                const pdrRefKey = String(previewItem.pdr_ref || previewItem.pdr || '').trim().toUpperCase();
                const stockItem = pdrRefKey ? stockMap.get(pdrRefKey) : null;
                const pdrDesignation = stockItem?.designation || stockItem?.nom || previewItem.pdr_designation || previewItem.pdr || 'Aucune PDR utilisée';
                const stockDispo = stockItem ? (stockItem.stockActuel ?? stockItem.stock_actuel ?? stockItem.quantite ?? 0) : null;

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Machine & Zone</span>
                        <span className="font-mono font-bold text-slate-900 text-sm block">{previewItem.code_machine}</span>
                        <span className="text-[11px] text-slate-500 font-medium truncate block">{machDesignation} · {machZone}</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Intervenant</span>
                        <span className="font-bold text-slate-900 block">{previewItem.intervenant || 'Rachid'}</span>
                        <span className="text-[11px] text-slate-500 font-medium">Technicien GMAO</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Temps Ouvré</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm block">
                          {previewItem.temps_intervention_calc || previewItem.temps_intervention || '00:45'}
                        </span>
                        <span className="text-[11px] text-slate-400">Durée réelle</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Arrêt Machine</span>
                        <span className="font-bold text-purple-700 block">
                          {previewItem.arret_machine ? 'OUI (Arrêt usine)' : 'NON'}
                        </span>
                        <span className="text-[11px] text-slate-400">Impact ligne</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                      <span className="text-[10.5px] font-extrabold text-amber-950 uppercase tracking-wider block">
                        Diagnostic Panne & Anomalie Constatée
                      </span>
                      <div className="font-medium text-slate-900">
                        <b>Type {previewItem.type_panne || 'M'} :</b> {previewItem.anomalie || 'court_circuit'}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        <b>Travail Réalisé :</b> {previewItem.action_realisee || previewItem.travail_a_faire || 'Intervention standard'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-cyan-50/60 border border-cyan-200/80 space-y-2">
                      <span className="text-[10.5px] font-extrabold text-cyan-950 uppercase tracking-wider block">
                        Pièce de Rechange (PDR) Consommée & Magasin
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          {previewItem.pdr_ref || previewItem.pdr ? (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-300">
                                {previewItem.pdr_ref || previewItem.pdr}
                              </span>
                              <span className="font-bold text-slate-900">
                                {pdrDesignation}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Aucune PDR utilisée pour ce dépannage</span>
                          )}
                        </div>
                        {previewItem.marque && (
                          <span className="font-mono bg-white px-2 py-0.5 rounded border border-cyan-200 text-cyan-800 shrink-0">
                            Marque: {previewItem.marque}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-cyan-100/60">
                        <span>État de la pièce : <b>{previewItem.etat_piece || 'Neuve'}</b></span>
                        {stockDispo !== null && (
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            Stock Actuel en Magasin: {stockDispo}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 font-bold text-xs text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer la Fiche</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer shadow-xs"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
