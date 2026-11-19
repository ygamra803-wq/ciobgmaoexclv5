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
import { exportTypeBWorkbook } from '../../../utils/safeExcelExport';
import { AvailabilityCalculationService } from '../../../domain/services/AvailabilityCalculationService';
import {
  CorrectiveCalculationService,
  isMachineStoppageFlag,
  type ParetoDimension,
} from '../../../domain/corrective/services/CorrectiveCalculationService';
import { filterActiveMachines, getMachineAssetClass } from '../../../utils/activeMachines';
import PeriodFilterBar from '../../components/common/PeriodFilterBar';
import { type PeriodFilterState, isDateInPeriod } from '../../../utils/datePeriodUtils';
import { useI18n } from '../../../i18n/I18nContext';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { Logger } from '../../../core/logger/LoggerService';

export default function AnalyseCorrectiveTab({
  interventions = [],
  machines: registeredMachines = [],
  stockItems = [],
  technicians = [],
  kpis: _kpis = {},
  paretoAnomalies: _paretoAnomalies = [],
  paretoMachines: _paretoMachines = [],
  preventiveRecommendations: _preventiveRecommendations = [],
  onNavigateToTab,
  onAddPreventiveTask,
  showToast,
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManagePreventive =
    Boolean(user) && AuthorizationService.hasPermission(user, 'preventive.manage');
  const [selectedAssetClass, setSelectedAssetClass] = useState<'ALL' | 'PRODUCTION' | 'SYSTEM_GENERAL'>('ALL');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedTypePanne, setSelectedTypePanne] = useState('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterState>({ preset: 'ALL' });
  const [paretoDimension, setParetoDimension] = useState<ParetoDimension>('COUNT');

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

  const technicianMap = useMemo(() => {
    const map = new Map();
    (technicians || []).forEach((tech: any) => {
      if (!tech) return;
      [tech.id_technician, tech.id, tech.matricule, tech.nom]
        .map((k) => String(k || '').trim().toUpperCase())
        .filter(Boolean)
        .forEach((k) => map.set(k, tech));
    });
    return map;
  }, [technicians]);

  // Zone list from machines and interventions
  const zoneOptions = useMemo(() => {
    const set = new Set<string>();
    (registeredMachines || []).forEach((m: any) => {
      const z = m.id_zone_default || m.id_zone;
      if (z) set.add(String(z));
    });
    (interventions || []).forEach((i: any) => {
      if (i.zone) set.add(String(i.zone));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [registeredMachines, interventions]);

  // Type Panne list
  const typePanneOptions = useMemo(() => {
    const set = new Set<string>();
    (interventions || []).forEach((i: any) => {
      if (i.type_panne) set.add(String(i.type_panne));
    });
    return Array.from(set).sort();
  }, [interventions]);

  // Scoped active machines for accurate OEE / MTBF scheduled hours
  const scopedActiveMachines = useMemo(() => {
    const active = filterActiveMachines(registeredMachines || []);
    return active.filter((m: any) => {
      if (selectedAssetClass !== 'ALL' && getMachineAssetClass(m) !== selectedAssetClass) {
        return false;
      }
      if (selectedZone !== 'ALL') {
        const z = m.id_zone_default || m.id_zone;
        if (z !== selectedZone) return false;
      }
      return true;
    });
  }, [registeredMachines, selectedAssetClass, selectedZone]);

  const activeMachinesForKpi = useMemo(() => {
    if (selectedAssetClass === 'SYSTEM_GENERAL') {
      return scopedActiveMachines;
    }
    const prodOnly = scopedActiveMachines.filter((m: any) => getMachineAssetClass(m) === 'PRODUCTION');
    return prodOnly.length > 0 ? prodOnly : scopedActiveMachines;
  }, [scopedActiveMachines, selectedAssetClass]);

  const availableDates = useMemo(() => {
    return (interventions || []).map(
      (item: any) =>
        item.date_demande || item.demande_date || item.date_debut || item.date_cloture || item.date || item.created_at
    );
  }, [interventions]);

  // Filtered official interventions for deep analytics (excludes cancelled, rejected, and unapproved claims)
  const filteredInterventions = useMemo(() => {
    return (interventions || []).filter((item: any) => {
      const wfStatus = String(item.statut || item.etat || '').trim().toUpperCase();
      const valStatus = String(item.validation_status || '').trim().toUpperCase();
      if (
        wfStatus === 'ANNULE' ||
        wfStatus === 'CANCELLED' ||
        wfStatus === 'EN_ATTENTE_VALIDATION' ||
        valStatus === 'REJECTED' ||
        valStatus === 'PENDING_VALIDATION' ||
        valStatus === 'NEEDS_CLARIFICATION'
      ) {
        return false;
      }

      const itemDate =
        item.date_demande || item.demande_date || item.date_debut || item.date_cloture || item.date || item.created_at;
      if (!isDateInPeriod(itemDate, periodFilter)) return false;

      const m = machineMap.get(String(item.code_machine || item.id_machine || '').trim().toUpperCase());
      if (selectedAssetClass !== 'ALL') {
        const itemAssetClass = item.asset_class
          ? String(item.asset_class).toUpperCase() === 'SYSTEM_GENERAL'
            ? 'SYSTEM_GENERAL'
            : 'PRODUCTION'
          : getMachineAssetClass(m);
        if (itemAssetClass !== selectedAssetClass) return false;
      }
      if (selectedZone !== 'ALL') {
        const itemZone = item.zone || m?.id_zone_default || m?.id_zone || 'Atelier';
        if (itemZone !== selectedZone) return false;
      }
      if (selectedTypePanne !== 'ALL' && item.type_panne !== selectedTypePanne) return false;
      return true;
    });
  }, [interventions, selectedAssetClass, selectedZone, selectedTypePanne, periodFilter, machineMap]);

  // Dynamic 90-day rolling preventive recommendations scoped to current filters
  const dynamicRecommendations = useMemo(() => {
    return CorrectiveCalculationService.detectPreventiveRecommendations(filteredInterventions, {
      windowDays: 90,
      minRecurrences: 3,
    });
  }, [filteredInterventions]);

  // 3D Pareto Anomalies (Frequency | Downtime | TCO Cost)
  const dynamicParetoAnomalies = useMemo(() => {
    return CorrectiveCalculationService.compute3DPareto(
      filteredInterventions,
      'anomalie',
      paretoDimension,
      {
        stockMap,
        machineMap,
        technicianMap,
        limit: 10,
      }
    );
  }, [filteredInterventions, paretoDimension, stockMap, machineMap, technicianMap]);

  // 3D Pareto Machines (Frequency | Downtime | TCO Cost)
  const dynamicParetoMachines = useMemo(() => {
    return CorrectiveCalculationService.compute3DPareto(
      filteredInterventions,
      'code_machine',
      paretoDimension,
      {
        stockMap,
        machineMap,
        technicianMap,
        limit: 10,
      }
    );
  }, [filteredInterventions, paretoDimension, stockMap, machineMap, technicianMap]);

  // Breakdown by Type Panne (E, H, P, M, etc.)
  const typePanneBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredInterventions.forEach((item: any) => {
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
    const counts: Record<string, number> = {};
    filteredInterventions.forEach((item: any) => {
      const t = item.intervenant || 'Non assigné';
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

  // Pareto Breakdown by Organe (Component) & Localisation Structurelle (Part) (P3)
  const organeAndPartBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; kind: 'COMPONENT' | 'PART'; machine: string; count: number }
    >();
    filteredInterventions.forEach((item) => {
      const compId = String(item.id_composant || '').trim();
      const compName = String(item.nom_composant || compId).trim();
      if (compId || compName) {
        const k = `COMP:${(compId || compName).toUpperCase()}`;
        const prev = map.get(k);
        if (prev) {
          prev.count += 1;
        } else {
          map.set(k, {
            key: k,
            label: compName && compId && compName !== compId ? `${compName} (${compId})` : compName || compId,
            kind: 'COMPONENT',
            machine: item.code_machine || '',
            count: 1,
          });
        }
      }
      const partId = String(item.id_part || '').trim();
      const partName = String(item.nom_part || partId).trim();
      if (partId || partName) {
        const k = `PART:${(partId || partName).toUpperCase()}`;
        const prev = map.get(k);
        if (prev) {
          prev.count += 1;
        } else {
          map.set(k, {
            key: k,
            label: partName && partId && partName !== partId ? `${partName} (${partId})` : partName || partId,
            kind: 'PART',
            machine: item.code_machine || '',
            count: 1,
          });
        }
      }
    });
    const total = filteredInterventions.length || 1;
    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        percentage: Math.round((entry.count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredInterventions]);

  // Executive KPI Stats + Industrial TCO Breakdown (ISO / AFNOR NF X 60-010 — zero fabricated defaults)
  const executiveKpis = useMemo(() => {
    const totalInterventions = filteredInterventions.length;
    const closed = filteredInterventions.filter((i) => i.statut === 'CLOTURE').length;
    const arret = filteredInterventions.filter((i) => isMachineStoppageFlag(i)).length;

    let totalDowntimeMinutes = 0;
    let totalPdrCost = 0;
    let totalAtelierCost = 0;
    let totalLaborCost = 0;
    let totalDowntimeLossCost = 0;
    let totalDirectCost = 0;
    let totalTcoCost = 0;

    filteredInterventions.forEach((item) => {
      totalDowntimeMinutes += AvailabilityCalculationService.getDowntimeMinutes(item);

      const breakdown = CorrectiveCalculationService.computeInterventionCostBreakdown(item, {
        stockMap,
        machineMap,
        technicianMap,
      });
      totalPdrCost += breakdown.coutPdr;
      totalAtelierCost += breakdown.coutAtelier;
      totalLaborCost += breakdown.coutMainOeuvre;
      totalDirectCost += breakdown.coutDirectMaintenance;
      totalDowntimeLossCost += breakdown.coutArretProduction;
      totalTcoCost += breakdown.coutTotalTco;
    });

    const machinesWithDowntimeRateCount = activeMachinesForKpi.filter(
      (m: any) => Number(m?.cout_arret_horaire || 0) > 0
    ).length;

    // 1. MTTR via AvailabilityCalculationService
    const mttrHours = AvailabilityCalculationService.calculateMTTR(filteredInterventions);
    const mttrFormatted = AvailabilityCalculationService.formatMTTR(filteredInterventions);

    // 2. Period-scaled scheduled operating hours (Mon-Sat × 8.25h/day)
    const scheduledInfo = AvailabilityCalculationService.calculateScheduledHoursForPeriod(
      activeMachinesForKpi.length,
      periodFilter,
      filteredInterventions
    );
    const totalScheduledHours = scheduledInfo.scheduledHours;

    // 3. MTBF & Operational Availability Rate
    const mtbfCalculatedHours = AvailabilityCalculationService.calculateMTBF(
      filteredInterventions,
      totalScheduledHours
    );
    const availabilityRate = AvailabilityCalculationService.calculateAvailability(
      filteredInterventions,
      totalScheduledHours
    );

    const downtimeHours = Math.floor(totalDowntimeMinutes / 60);
    const downtimeMins = totalDowntimeMinutes % 60;
    const downtimeFormatted = `${downtimeHours}h ${downtimeMins}m`;

    const availabilityStatus =
      availabilityRate >= 95
        ? { label: 'Conforme (≥95%)', colorClass: 'text-emerald-700' }
        : availabilityRate >= 85
        ? { label: 'À surveiller', colorClass: 'text-amber-700' }
        : { label: 'Critique (<85%)', colorClass: 'text-rose-700' };

    const mtbfStatus =
      totalInterventions === 0
        ? { label: '0 panne', colorClass: 'text-slate-500' }
        : mtbfCalculatedHours >= 120
        ? { label: 'Élevée', colorClass: 'text-emerald-700' }
        : mtbfCalculatedHours >= 40
        ? { label: 'Modérée', colorClass: 'text-amber-700' }
        : { label: 'Critique', colorClass: 'text-rose-700' };

    const mttrStatus =
      closed === 0 || mttrHours === 0
        ? { label: 'N/A', colorClass: 'text-slate-500' }
        : mttrHours <= 1
        ? { label: 'Rapide (≤1h)', colorClass: 'text-emerald-700' }
        : mttrHours <= 3
        ? { label: 'Standard', colorClass: 'text-amber-700' }
        : { label: 'Élevé (>3h)', colorClass: 'text-rose-700' };

    const downtimeStatus =
      totalDowntimeMinutes === 0
        ? { label: 'Aucun arrêt', colorClass: 'text-emerald-700' }
        : availabilityRate >= 95
        ? { label: 'Maîtrisé', colorClass: 'text-emerald-700' }
        : availabilityRate >= 85
        ? { label: 'Modéré', colorClass: 'text-amber-700' }
        : { label: 'Critique', colorClass: 'text-rose-700' };

    return {
      total: totalInterventions,
      closed,
      arret,
      mttr: mttrFormatted,
      mtbf: `${mtbfCalculatedHours}h`,
      availability: `${availabilityRate.toFixed(1)}%`,
      downtime: downtimeFormatted,
      pdrCost: Math.round(totalPdrCost),
      atelierCost: Math.round(totalAtelierCost),
      laborCost: Math.round(totalLaborCost),
      directCost: Math.round(totalDirectCost),
      downtimeLossCost: Math.round(totalDowntimeLossCost),
      totalTco: Math.round(totalTcoCost),
      machinesWithDowntimeRateCount,
      workingDays: scheduledInfo.workingDays,
      scheduledHours: totalScheduledHours,
      availabilityStatus,
      mtbfStatus,
      mttrStatus,
      downtimeStatus,
    };
  }, [filteredInterventions, activeMachinesForKpi, periodFilter, stockMap, machineMap, technicianMap]);

  // Generate intelligent preventive task from recommendation
  const handleAdoptRecommendation = (rec) => {
    if (!canManagePreventive) {
      showToast?.('Droits insuffisants pour créer un plan préventif.', 'warning');
      return;
    }
    if (onAddPreventiveTask) {
      const result = onAddPreventiveTask({
        titre: `Maintenance Préventive Ciblée : ${rec.anomalie}`,
        code_machine: rec.code_machine,
        zone: rec.zone || 'Atelier',
        frequence: 'MENSUEL',
        priorite: 'HAUTE',
        description: `Plan préventif généré suite à la détection de ${rec.count} pannes récurrentes (${rec.anomalie}) sur la machine ${rec.code_machine}.`,
      });
      if (result && result.duplicate) {
        showToast?.(
          `Un plan préventif existe déjà pour ${rec.code_machine} (${rec.anomalie})`,
          'info'
        );
      } else {
        showToast?.(
          `Plan préventif créé avec succès pour ${rec.code_machine} (${rec.anomalie})`,
          'success'
        );
      }
      if (onNavigateToTab) {
        onNavigateToTab('preventive');
      }
    }
  };

  const handleExportParetoExcel = () => {
    try {
      const dimLabel =
        paretoDimension === 'COST'
          ? 'Coût TCO (DH)'
          : paretoDimension === 'DOWNTIME'
          ? 'Arrêt (min)'
          : 'Fréquence';

      const formatExportRows = (rows: typeof dynamicParetoAnomalies, labelHeader: string) =>
        rows.map((r, idx) => ({
          Rang: idx + 1,
          [labelHeader]: r.name,
          Dimension_Classement: dimLabel,
          Occurrences: r.count,
          Arret_Minutes: r.downtimeMinutes,
          Cout_PDR_DH: r.coutPdr,
          Cout_Atelier_DH: r.coutAtelier,
          Cout_Main_Oeuvre_DH: r.coutMainOeuvre,
          Perte_Arret_DH: r.downtimeCost,
          Cout_Total_TCO_DH: r.totalCost,
          Part_Pct: r.percentage,
          Cumul_Pct: r.cumulativePercentage,
          Zone_ABC: r.isPareto80 ? 'A (80%)' : 'B/C',
        }));

      exportTypeBWorkbook({
        filename: `Pareto_3D_${paretoDimension}_GMAO_${new Date().toISOString().split('T')[0]}.xlsx`,
        screenName: `Analyse & Pareto 3D (${dimLabel})`,
        sheets: [
          {
            name: 'Pareto_Anomalies_3D',
            jsonRows: formatExportRows(dynamicParetoAnomalies, 'Anomalie'),
          },
          {
            name: 'Pareto_Machines_3D',
            jsonRows: formatExportRows(dynamicParetoMachines, 'Code_Machine'),
          },
        ],
      });

      showToast?.(`Export Excel Pareto 3D (${dimLabel}) généré avec succès (.xlsx)`, 'success');
    } catch (err) {
      Logger.error(err);
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
                {activeMachinesForKpi.length} Machines actives
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">
              Disponibilité Op. ({executiveKpis.workingDays}j) :
            </span>
            <span className={`font-mono font-bold ${executiveKpis.availabilityStatus.colorClass}`}>
              {executiveKpis.availabilityStatus.label}
            </span>
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
                Base {executiveKpis.scheduledHours}h ouvrées
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">Fiabilité parc :</span>
            <span className={`font-mono font-bold ${executiveKpis.mtbfStatus.colorClass}`}>
              {executiveKpis.mtbfStatus.label}
            </span>
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
            <span className={`font-mono font-bold ${executiveKpis.mttrStatus.colorClass}`}>
              {executiveKpis.mttrStatus.label}
            </span>
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
            <span className={`font-mono font-bold ${executiveKpis.downtimeStatus.colorClass}`}>
              {executiveKpis.downtimeStatus.label}
            </span>
          </div>
        </div>

        {/* Coût Global TCO */}
        <div
          data-testid="analyse-tco-kpi-card"
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 hover:border-purple-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(168,85,247,0.12)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group flex flex-col justify-between"
        >
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/10 transition-colors" />
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                Coût Global TCO
              </span>
              <BarChart3 className="w-5 h-5 text-purple-600 shrink-0 group-hover:scale-110 transition-transform" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-purple-600 font-mono tracking-tight">
                {executiveKpis.totalTco.toLocaleString()}
              </span>
              <span className="text-[11px] font-bold text-slate-400 font-mono">DH</span>
            </div>
            <div className="mt-2 text-[10.5px] text-slate-500 flex items-center gap-1 flex-wrap">
              <span className="text-purple-700 font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-mono">
                Direct: {executiveKpis.directCost.toLocaleString()} DH
              </span>
            </div>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10.5px]">
            <span className="text-slate-400 font-medium">PDR + MO + Atelier :</span>
            <span className="font-mono font-bold text-purple-700">
              {executiveKpis.total} BT
            </span>
          </div>
        </div>
      </div>

      {/* 1.25. Ventilation Financière TCO (Direct vs Indirect Production Stoppage) */}
      <div
        data-testid="analyse-tco-breakdown-strip"
        className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        <div className="p-3 rounded-xl bg-cyan-50/70 border border-cyan-200/80">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-800 block">
            Pièces de Rechange (PDR)
          </span>
          <span className="text-lg font-black font-mono text-cyan-950 block mt-0.5">
            {executiveKpis.pdrCost.toLocaleString()} DH
          </span>
          <span className="text-[10px] text-cyan-700">Valorisation stock magasin</span>
        </div>
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
            Main-d&apos;Œuvre Interne
          </span>
          <span className="text-lg font-black font-mono text-amber-950 block mt-0.5">
            {executiveKpis.laborCost.toLocaleString()} DH
          </span>
          <span className="text-[10px] text-amber-700">Heures ouvrées × taux horaire</span>
        </div>
        <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 block">
            Atelier &amp; Sous-traitance
          </span>
          <span className="text-lg font-black font-mono text-indigo-950 block mt-0.5">
            {executiveKpis.atelierCost.toLocaleString()} DH
          </span>
          <span className="text-[10px] text-indigo-700">Bons externes &amp; bobinage</span>
        </div>
        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-800 block">
            Perte d&apos;Arrêt Production
          </span>
          <span className="text-lg font-black font-mono text-rose-950 block mt-0.5">
            {executiveKpis.downtimeLossCost.toLocaleString()} DH
          </span>
          <span className="text-[10px] text-rose-700">
            {executiveKpis.machinesWithDowntimeRateCount > 0
              ? `${executiveKpis.machinesWithDowntimeRateCount} machine(s) tarifée(s)`
              : 'Taux arrêt machine non configuré (0 DH)'}
          </span>
        </div>
      </div>

      {/* 1.5. Period Filter Bar */}
      <PeriodFilterBar
        value={periodFilter}
        onChange={setPeriodFilter}
        availableDates={availableDates}
        filteredCount={filteredInterventions.length}
        totalCount={interventions.length}
      />

      {/* 2. Filter & Export Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 md:p-5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200/80 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-amber-700" />
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
          {/* Asset Class Filter (Production vs Système Général) */}
          <select
            value={selectedAssetClass}
            onChange={(e) => setSelectedAssetClass(e.target.value as 'ALL' | 'PRODUCTION' | 'SYSTEM_GENERAL')}
            aria-label="Filtrer par classe d'équipement"
            className="h-8 px-2.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-700 focus:outline-hidden focus:border-indigo-400 cursor-pointer shadow-2xs"
          >
            <option value="ALL">Toutes Classes (Prod + Sys. Gén.)</option>
            <option value="PRODUCTION">Production uniquement</option>
            <option value="SYSTEM_GENERAL">Système Général uniquement</option>
          </select>

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
          {(selectedAssetClass !== 'ALL' ||
            selectedZone !== 'ALL' ||
            selectedTypePanne !== 'ALL' ||
            periodFilter.preset !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSelectedAssetClass('ALL');
                setSelectedZone('ALL');
                setSelectedTypePanne('ALL');
                setPeriodFilter({ preset: 'ALL' });
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
            title="Exporter les tables Pareto vers Excel (.xlsx) — Type B : Export externe (non réimportable)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Export Pareto (Type B)</span>
          </button>
        </div>
      </div>

      {/* 2.5. 3D Pareto Dimension Selector (COUNT | DOWNTIME | COST) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-sm">
        <div>
          <span className="text-xs font-black uppercase tracking-wider block">
            Analyse Pareto 3D — Axe de Priorisation 80/20
          </span>
          <span className="text-[11px] text-slate-300">
            Basculez entre fréquence, temps d&apos;arrêt et coût global TCO pour cibler les vraies pertes usine.
          </span>
        </div>
        <div
          role="tablist"
          aria-label="Dimension d'analyse Pareto 3D"
          className="inline-flex items-center p-1 rounded-xl bg-slate-800 border border-slate-700 gap-1"
        >
          {(
            [
              { id: 'COUNT', label: 'Fréquence' },
              { id: 'DOWNTIME', label: "Temps d'Arrêt" },
              { id: 'COST', label: 'Coût TCO (DH)' },
            ] as Array<{ id: ParetoDimension; label: string }>
          ).map((dim) => {
            const active = paretoDimension === dim.id;
            return (
              <button
                key={dim.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`pareto-dim-${dim.id}`}
                onClick={() => setParetoDimension(dim.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/70'
                }`}
              >
                {dim.label}
              </button>
            );
          })}
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
                  {paretoDimension === 'COST'
                    ? 'Classement par Coût Global TCO cumulé (Zone Critique A ≤ 80%)'
                    : paretoDimension === 'DOWNTIME'
                    ? "Classement par Temps d'Arrêt machine cumulé (Zone Critique A ≤ 80%)"
                    : 'Classement par fréquence cumulée (Zone Critique A ≤ 80%)'}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-200">
              Loi 80/20
            </span>
          </div>

          <div className="space-y-3">
            {dynamicParetoAnomalies.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Aucune anomalie enregistrée sur le périmètre sélectionné.
              </p>
            ) : (
              dynamicParetoAnomalies.map((item, idx) => {
                const primaryMetricText =
                  paretoDimension === 'COST'
                    ? `${Math.round(item.totalCost).toLocaleString()} DH`
                    : paretoDimension === 'DOWNTIME'
                    ? CorrectiveCalculationService.formatDurationHuman(item.downtimeMinutes)
                    : `${item.count}`;

                return (
                  <div key={`${item.name}-${idx}`} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="truncate max-w-[200px] sm:max-w-xs" title={item.name}>
                          {item.name}
                        </span>
                        {item.isPareto80 && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                            Zone A (80%)
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                        <span className="font-black text-slate-900">{primaryMetricText}</span>
                        <span className="text-slate-400">({item.percentage}%)</span>
                        <span className="font-bold text-rose-700">Cumul: {item.cumulativePercentage}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pl-5">
                      <span>{item.count} BT</span>
                      <span>•</span>
                      <span>Arrêt: {CorrectiveCalculationService.formatDurationHuman(item.downtimeMinutes)}</span>
                      <span>•</span>
                      <span>TCO: {Math.round(item.totalCost).toLocaleString()} DH</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.isPareto80 ? 'bg-gradient-to-r from-rose-500 to-amber-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
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
                  {paretoDimension === 'COST'
                    ? 'Équipements générant le coût global TCO le plus élevé'
                    : paretoDimension === 'DOWNTIME'
                    ? "Équipements concentrant le plus grand temps d'arrêt production"
                    : "Équipements concentrant le plus grand nombre d'interventions"}
                </p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-900 border border-blue-200">
              Parc Machines
            </span>
          </div>

          <div className="space-y-3">
            {dynamicParetoMachines.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                Aucune machine en panne sur le périmètre sélectionné.
              </p>
            ) : (
              dynamicParetoMachines.map((item, idx) => {
                const primaryMetricText =
                  paretoDimension === 'COST'
                    ? `${Math.round(item.totalCost).toLocaleString()} DH`
                    : paretoDimension === 'DOWNTIME'
                    ? CorrectiveCalculationService.formatDurationHuman(item.downtimeMinutes)
                    : `${item.count} pannes`;

                return (
                  <div key={`${item.name}-${idx}`} className="space-y-1 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-mono font-bold text-blue-900 truncate">{item.name}</span>
                        {item.isPareto80 && (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                            Priorité Usine
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                        <span className="font-black text-slate-900">{primaryMetricText}</span>
                        <span className="text-slate-400">({item.percentage}%)</span>
                        <span className="font-bold text-blue-700">Cumul: {item.cumulativePercentage}%</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 pl-5">
                      <span>{item.count} BT</span>
                      <span>•</span>
                      <span>Arrêt: {CorrectiveCalculationService.formatDurationHuman(item.downtimeMinutes)}</span>
                      <span>•</span>
                      <span>TCO: {Math.round(item.totalCost).toLocaleString()} DH</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          item.isPareto80 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-slate-400'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
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

      {/* 4b. Pareto par Organe (Composant) & Localisation Structurelle (Part) */}
      {organeAndPartBreakdown.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Factory className="w-4 h-4 text-indigo-600" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                  Pareto par Organe (Composant) & Localisation Structurelle (Part)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Traçabilité des organes suivis et des sites structurels les plus sollicités
                </p>
              </div>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
              {organeAndPartBreakdown.length} éléments localisés
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {organeAndPartBreakdown.slice(0, 8).map((item) => (
              <div
                key={item.key}
                className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold border ${
                      item.kind === 'COMPONENT'
                        ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {item.kind === 'COMPONENT' ? 'COMPOSANT' : 'PART (SITE)'}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-slate-500">{item.machine}</span>
                </div>
                <div className="font-bold text-slate-900 text-xs truncate" title={item.label}>
                  {item.label}
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono pt-1 border-t border-slate-200/70">
                  <span className="font-black text-indigo-700">{item.count} pannes</span>
                  <span className="text-slate-400">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                Fenêtre glissante de 90 jours : si une machine subit ≥ 3 pannes sur la période récente, le système propose automatiquement une action préventive ciblée.
              </p>
            </div>
          </div>
        </div>

        {dynamicRecommendations.length === 0 ? (
          <div className="bg-white/80 rounded-2xl border border-amber-200/70 p-4 text-xs text-slate-600 font-medium">
            Aucune récurrence critique (≥ 3 pannes sur les 90 derniers jours) détectée sur le périmètre filtré.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {dynamicRecommendations.slice(0, 3).map((rec, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-amber-200/90 p-4 shadow-xs space-y-3 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-black text-slate-900">{rec.code_machine}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-800">
                      {rec.count} récurrences (90j)
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-700 mt-1">
                    Anomalie : <span className="text-amber-800">{rec.anomalie}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    {rec.recommendedAction || rec.recommendation}
                  </p>
                </div>

                {canManagePreventive && (
                  <button
                    type="button"
                    onClick={() => handleAdoptRecommendation(rec)}
                    className="w-full py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-sm shadow-amber-600/25 flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Créer la Tâche Préventive</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
