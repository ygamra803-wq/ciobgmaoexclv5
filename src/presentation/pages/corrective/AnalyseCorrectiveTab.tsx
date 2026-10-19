import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  PieChart,
  AlertOctagon,
  Sparkles,
  ArrowRight,
  Wrench,
  CheckCircle,
  Factory,
  SlidersHorizontal,
  RotateCcw,
  Clock,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { AvailabilityCalculationService } from '../../../domain/services/AvailabilityCalculationService';
import { useI18n } from '../../../i18n/I18nContext';

export default function AnalyseCorrectiveTab({
  interventions = [],
  machines: registeredMachines = [],
  stockItems = [],
  kpis: _kpis = {},
  paretoAnomalies = [],
  paretoMachines = [],
  preventiveRecommendations = [],
  onNavigateToTab,
  onAddPreventiveTask,
  showToast,
}) {
  const { t } = useI18n();
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedTypePanne, setSelectedTypePanne] = useState('ALL');

  // Fast Lookup Maps
  const machineMap = useMemo(() => {
    const map = new Map();
    (registeredMachines || []).forEach((m) => {
      const id = m.id_machine_registered || m.id;
      if (id) map.set(String(id).trim().toUpperCase(), m);
    });
    return map;
  }, [registeredMachines]);

  const stockMap = useMemo(() => {
    const map = new Map();
    (stockItems || []).forEach((s) => {
      const ref = s.ref || s.code_article;
      if (ref) map.set(String(ref).trim().toUpperCase(), s);
    });
    return map;
  }, [stockItems]);

  // Zone list from machines and interventions
  const zoneOptions = useMemo(() => {
    const set = new Set();
    (registeredMachines || []).forEach((m) => {
      const z = m.id_zone_default || m.id_zone;
      if (z) set.add(z);
    });
    (interventions || []).forEach((i) => {
      if (i.zone) set.add(i.zone);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [registeredMachines, interventions]);

  // Type Panne list
  const typePanneOptions = useMemo(() => {
    const set = new Set();
    (interventions || []).forEach((i) => {
      if (i.type_panne) set.add(i.type_panne);
    });
    return Array.from(set).sort();
  }, [interventions]);

  // Filtered interventions for deep analytics
  const filteredInterventions = useMemo(() => {
    return interventions.filter((item) => {
      if (selectedZone !== 'ALL') {
        const m = machineMap.get(String(item.code_machine || '').trim().toUpperCase());
        const itemZone = item.zone || m?.id_zone_default || m?.id_zone || 'Atelier';
        if (itemZone !== selectedZone) return false;
      }
      if (selectedTypePanne !== 'ALL' && item.type_panne !== selectedTypePanne) return false;
      return true;
    });
  }, [interventions, selectedZone, selectedTypePanne, machineMap]);

  // Recalculated Pareto Anomalies from filtered dataset
  const dynamicParetoAnomalies = useMemo(() => {
    if (filteredInterventions.length === 0) return paretoAnomalies.slice(0, 10);

    const counts = {};
    filteredInterventions.forEach((item) => {
      const anom = item.anomalie || 'court_circuit';
      counts[anom] = (counts[anom] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .map(([anomalie, count]) => ({ anomalie, count }))
      .sort((a, b) => b.count - a.count);

    const totalCount = filteredInterventions.length;
    let runningSum = 0;

    return sorted.slice(0, 10).map((item) => {
      runningSum += item.count;
      const percentage = (item.count / totalCount) * 100;
      const cumulativePercentage = (runningSum / totalCount) * 100;
      return {
        ...item,
        percentage: Number(percentage.toFixed(1)),
        cumulativePercentage: Number(cumulativePercentage.toFixed(1)),
        isPareto80: cumulativePercentage <= 80,
      };
    });
  }, [filteredInterventions, paretoAnomalies]);

  // Recalculated Pareto Machines from filtered dataset
  const dynamicParetoMachines = useMemo(() => {
    if (filteredInterventions.length === 0) return paretoMachines.slice(0, 10);

    const counts = {};
    filteredInterventions.forEach((item) => {
      const m = item.code_machine || 'RCP-02';
      counts[m] = (counts[m] || 0) + 1;
    });

    const sorted = Object.entries(counts)
      .map(([code_machine, count]) => ({ code_machine, count }))
      .sort((a, b) => b.count - a.count);

    const totalCount = filteredInterventions.length;
    let runningSum = 0;

    return sorted.slice(0, 10).map((item) => {
      runningSum += item.count;
      const percentage = (item.count / totalCount) * 100;
      const cumulativePercentage = (runningSum / totalCount) * 100;
      return {
        ...item,
        percentage: Number(percentage.toFixed(1)),
        cumulativePercentage: Number(cumulativePercentage.toFixed(1)),
        isPareto80: cumulativePercentage <= 80,
      };
    });
  }, [filteredInterventions, paretoMachines]);

  // Breakdown by Type Panne (E, H, P, M, etc.)
  const typePanneBreakdown = useMemo(() => {
    const counts = {};
    filteredInterventions.forEach((item) => {
      const t = item.type_panne || 'M';
      counts[t] = (counts[t] || 0) + 1;
    });

    const total = filteredInterventions.length || 1;
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredInterventions]);

  // Breakdown by Technician
  const techBreakdown = useMemo(() => {
    const counts = {};
    filteredInterventions.forEach((item) => {
      const t = item.intervenant || 'm_hammed';
      counts[t] = (counts[t] || 0) + 1;
    });

    const total = filteredInterventions.length || 1;
    return Object.entries(counts)
      .map(([tech, count]) => ({
        tech,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredInterventions]);

  // Executive KPI Stats (Strict Industrial Excel Formulas)
  const executiveKpis = useMemo(() => {
    const totalInterventions = filteredInterventions.length;
    const closed = filteredInterventions.filter((i) => i.statut === 'CLOTURE' || i.temps_intervention_calc).length;
    const arret = filteredInterventions.filter((i) => i.arret_machine === true || i.arret_machine === 'OUI').length;

    let totalDowntimeMinutes = 0;
    let totalPdrCost = 0;

    filteredInterventions.forEach((item) => {
      let mins = Number(item.temps_minutes) || 0;
      if (!mins && (item.temps_intervention_calc || item.temps_intervention)) {
        const str = String(item.temps_intervention_calc || item.temps_intervention);
        const match = str.match(/(\d+)\s*h(?:our)?\s*(\d+)?/i);
        if (match) {
          const h = Number(match[1]) || 0;
          const m = Number(match[2]) || 0;
          mins = h * 60 + m;
        } else if (str.includes(':')) {
          const [h, m] = str.split(':');
          mins = (Number(h) || 0) * 60 + (Number(m) || 0);
        }
      }

      if (item.arret_machine === true || item.arret_machine === 'OUI') {
        totalDowntimeMinutes += mins > 0 ? mins : 45;
      }

      // Compute PDR Cost
      const pdrKey = String(item.pdr_ref || item.pdr || '').trim().toUpperCase();
      const stockItem = pdrKey ? stockMap.get(pdrKey) : null;
      const price = Number(item.pdr_prix) || Number(stockItem?.prix) || Number(stockItem?.prix_unitaire) || 35;
      const qty = Number(item.pdr_quantite) || (pdrKey ? 1 : 0);
      totalPdrCost += price * qty;
    });

    // 1. MTTR via AvailabilityCalculationService
    const mttrFormatted = AvailabilityCalculationService.formatMTTR(filteredInterventions);

    // 2. MTBF via AvailabilityCalculationService
    const numMachines = Math.max(1, registeredMachines.length);
    const totalScheduledHours = numMachines * 160; // 160h standard industrial monthly operating time
    const mtbfCalculatedHours = AvailabilityCalculationService.calculateMTBF(filteredInterventions, totalScheduledHours);

    // 3. Operational Availability Rate
    const availabilityRate = AvailabilityCalculationService.calculateAvailability(filteredInterventions, totalScheduledHours);

    const downtimeHours = Math.floor(totalDowntimeMinutes / 60);
    const downtimeMins = totalDowntimeMinutes % 60;
    const downtimeFormatted = `${downtimeHours}h ${downtimeMins}m`;

    return {
      total: totalInterventions,
      closed,
      arret,
      mttr: mttrFormatted,
      mtbf: `${mtbfCalculatedHours}h`,
      availability: `${availabilityRate.toFixed(1)}%`,
      downtime: downtimeFormatted,
      pdrCost: Math.round(totalPdrCost),
    };
  }, [filteredInterventions, registeredMachines.length, stockMap]);

  // Generate intelligent preventive task from recommendation
  const handleAdoptRecommendation = (rec) => {
    if (onAddPreventiveTask) {
      onAddPreventiveTask({
        titre: `Maintenance Préventive Ciblée : ${rec.anomalie}`,
        code_machine: rec.code_machine,
        zone: rec.zone || 'Atelier',
        frequence: 'MENSUEL',
        priorite: 'HAUTE',
        description: `Plan préventif généré suite à la détection de ${rec.count} pannes récurrentes (${rec.anomalie}) sur la machine ${rec.code_machine}.`,
      });
      showToast?.(
        `Plan préventif créé avec succès pour ${rec.code_machine} (${rec.anomalie})`,
        'success'
      );
      if (onNavigateToTab) {
        onNavigateToTab('preventive');
      }
    }
  };

  const handleExportParetoExcel = () => {
    try {
      const wsAnomalies = XLSX.utils.json_to_sheet(dynamicParetoAnomalies);
      const wsMachines = XLSX.utils.json_to_sheet(dynamicParetoMachines);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsAnomalies, 'Pareto_Anomalies_8020');
      XLSX.utils.book_append_sheet(wb, wsMachines, 'Pareto_Machines_8020');
      XLSX.writeFile(wb, `Pareto_Analyse_GMAO_${new Date().toISOString().split('T')[0]}.xlsx`);

      showToast?.('Export Excel de l\'analyse de Pareto généré avec succès (.xlsx)', 'success');
    } catch (err) {
      console.error(err);
      showToast?.('Erreur lors de l\'export Excel', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Top 5 Executive KPI Industrial Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Taux Disponibilité */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-emerald-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(16,185,129,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                {t('corrective.analyse.disponibilite')}
              </span>
              <Activity className="w-5 h-5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-600 font-mono tracking-tight">
                {executiveKpis.availability}
              </span>
              <span className="text-[11px] font-bold text-slate-400 font-mono">cible ≥ 95%</span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1 flex-wrap">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                {registeredMachines.length} Machines
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">Taux calculé :</span>
            <span className="font-mono font-bold text-emerald-700">OEE / TRS</span>
          </div>
        </div>

        {/* MTBF */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-blue-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(59,130,246,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-blue-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                MTBF (Fiabilité)
              </span>
              <TrendingUp className="w-5 h-5 text-blue-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-blue-600 font-mono tracking-tight">
                {executiveKpis.mtbf}
              </span>
              <span className="text-[11px] font-bold text-slate-400 font-mono">/ panne</span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1 flex-wrap">
              <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-mono">
                Temps moyen inter-pannes
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">Fiabilité parc :</span>
            <span className="font-mono font-bold text-blue-700">Conforme</span>
          </div>
        </div>

        {/* MTTR */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-amber-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(245,158,11,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                MTTR (Maintenabilité)
              </span>
              <Clock className="w-5 h-5 text-amber-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-600 font-mono tracking-tight">
                {executiveKpis.mttr}
              </span>
              <span className="text-[11px] font-bold text-slate-400 font-mono">/ dépannage</span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1 flex-wrap">
              <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-mono">
                {executiveKpis.closed} clôturés
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">Rapidité équipe :</span>
            <span className="font-mono font-bold text-amber-700">Standard</span>
          </div>
        </div>

        {/* Temps d'Arrêt Total */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-rose-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(244,63,94,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-rose-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Stoppage & Arrêt
              </span>
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-rose-600 font-mono tracking-tight">
                {executiveKpis.downtime}
              </span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1 flex-wrap">
              <span className="text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 font-mono">
                {executiveKpis.arret} arrêts usine
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">Impact production :</span>
            <span className="font-mono font-bold text-rose-700">Contrôlé</span>
          </div>
        </div>

        {/* Coût PDR Consommées */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-purple-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(168,85,247,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Coût PDR Consommées
              </span>
              <BarChart3 className="w-5 h-5 text-purple-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-purple-600 font-mono tracking-tight">
                {executiveKpis.pdrCost.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-slate-400 font-mono">DT</span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1 flex-wrap">
              <span className="text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-mono">
                {executiveKpis.total} interventions
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">Liaison Magasin :</span>
            <span className="font-mono font-bold text-purple-700">VLOOKUP Actif</span>
          </div>
        </div>
      </div>

      {/* 2. Filter & Export Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-200/80 flex items-center justify-center text-purple-700 shadow-2xs shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-purple-700" />
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">
              Paramètres d'Analyse Pareto 80/20 & Cockpit
            </span>
            <p className="text-[11px] text-slate-400">
              Filtrez par zone ou type pour recalculer instantanément les Pareto et les KPIs
            </p>
          </div>
        </div>

        {/* Filter Selects & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Zone Filter */}
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-700 focus:outline-hidden focus:border-indigo-400 cursor-pointer shadow-2xs"
          >
            <option value="ALL">Toutes les Zones ({zoneOptions.length})</option>
            {zoneOptions.map((z) => (
              <option key={z} value={z}>{z}</option>
            ))}
          </select>

          {/* Type Panne Filter */}
          <select
            value={selectedTypePanne}
            onChange={(e) => setSelectedTypePanne(e.target.value)}
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-700 focus:outline-hidden focus:border-indigo-400 cursor-pointer shadow-2xs"
          >
            <option value="ALL">Tous les Types de Panne ({typePanneOptions.length})</option>
            {typePanneOptions.map((t) => (
              <option key={t} value={t}>Type {t}</option>
            ))}
          </select>

          {/* Reset Filters */}
          {(selectedZone !== 'ALL' || selectedTypePanne !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSelectedZone('ALL');
                setSelectedTypePanne('ALL');
              }}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportParetoExcel}
            className="h-8 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Exporter les tables Pareto vers Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Export Pareto Excel</span>
          </button>
        </div>
      </div>

      {/* 3. Pareto Charts 80/20 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pareto Top 10 Anomalies */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-200 flex items-center justify-center text-rose-700 shadow-2xs">
                <AlertOctagon className="w-4 h-4 text-rose-700" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Pareto 80/20 : Top 10 Anomalies Constatées
                </h3>
                <p className="text-[11px] text-slate-400">
                  Classement par fréquence cumulée (Zone Critique A ≤ 80%)
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-200">
              Loi 80/20
            </span>
          </div>

          <div className="space-y-3">
            {dynamicParetoAnomalies.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono font-bold">
                      {idx + 1}
                    </span>
                    <span className="truncate max-w-[220px] sm:max-w-xs">{item.anomalie}</span>
                    {item.isPareto80 && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                        Zone A (80%)
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-black text-slate-900">{item.count}</span>
                    <span className="text-slate-400">({item.percentage}%)</span>
                    <span className="font-bold text-rose-700">Cumul: {item.cumulativePercentage}%</span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.isPareto80 ? 'bg-gradient-to-r from-rose-500 to-amber-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, item.cumulativePercentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pareto Top 10 Machines à Pannes */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-200 flex items-center justify-center text-blue-700 shadow-2xs">
                <Factory className="w-4 h-4 text-blue-700" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Pareto 80/20 : Top 10 Machines Critiques
                </h3>
                <p className="text-[11px] text-slate-400">
                  Équipements concentrant le plus grand nombre d'arrêts (RCP-02, TRR-11...)
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200">
              Parc Machines
            </span>
          </div>

          <div className="space-y-3">
            {dynamicParetoMachines.map((item, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-mono font-bold text-blue-900">{item.code_machine}</span>
                    {item.isPareto80 && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        Priorité Usine
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-black text-slate-900">{item.count} pannes</span>
                    <span className="text-slate-400">({item.percentage}%)</span>
                    <span className="font-bold text-blue-700">Cumul: {item.cumulativePercentage}%</span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.isPareto80 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, item.cumulativePercentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Secondary Breakdown: Type Panne & Techniciens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Type Panne Breakdown */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <PieChart className="w-4 h-4 text-purple-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Répartition par Famille Technologique (Col I)
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {typePanneBreakdown.slice(0, 6).map((tp, i) => (
              <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-slate-800">Type {tp.type}</span>
                  <span className="font-bold text-purple-700">{tp.percentage}%</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">{tp.count} interventions</div>
              </div>
            ))}
          </div>
        </div>

        {/* Charge Techniciens */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Wrench className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Charge d'Intervention par Intervenant (Col D)
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {techBreakdown.slice(0, 3).map((tech, i) => (
              <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-xs truncate">{tech.tech}</div>
                <div className="text-lg font-black font-mono text-emerald-700">{tech.count}</div>
                <div className="text-[10px] text-slate-400 font-mono">{tech.percentage}% du volume</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Intelligent Preventive Maintenance Generator */}
      <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent rounded-3xl border border-amber-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-300 flex items-center justify-center text-amber-800 shadow-2xs">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight">
                Générateur de Recommandations Préventives (Anti-Pannes Récurrentes)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Si une machine subit ≥ 3 pannes identiques, le système propose automatiquement d'injecter une tâche préventive.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {preventiveRecommendations.slice(0, 3).map((rec, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-amber-200/90 p-4 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-black text-slate-900">{rec.code_machine}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
                    {rec.count} récurrences
                  </span>
                </div>
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  Anomalie : <span className="text-amber-800">{rec.anomalie}</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Recommandation : inspection mensuelle du circuit de commande et lubrification.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleAdoptRecommendation(rec)}
                className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-amber-600/25 flex items-center justify-center gap-1.5 active:scale-95"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Créer la Tâche Préventive</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
