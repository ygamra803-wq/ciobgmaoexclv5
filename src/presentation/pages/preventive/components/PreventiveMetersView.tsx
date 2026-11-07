import React, { useState, useMemo } from 'react';
import {
  Gauge,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  History,
  TrendingUp,
  Search,
  Filter,
  ArrowUpRight,
  Sparkles,
  Zap,
  Wrench,
  Check,
  RotateCcw,
  X,
  Calendar,
  User,
} from 'lucide-react';
import { MeterService } from '../../../../application/services/meter/MeterService';
import type { IMeterReading, MeterUnit } from '../../../../types/meter';
import { filterActiveMachines } from '../../../../utils/activeMachines';

interface PreventiveMetersViewProps {
  machines: any[];
  tasks: any[];
  meterReadings: IMeterReading[];
  onRecordReading: (payload: {
    machineId: string;
    valeur: number;
    unite?: MeterUnit;
    date_releve?: string;
    releve_par?: string;
    source?: any;
    commentaire?: string;
  }) => void;
  onBatchRecordReadings: (readingsPayload: any[]) => void;
  onMarkTaskDone?: (taskId: string | number, validationData: any) => void;
  onNavigateToPlanBuilder?: () => void;
  user?: any;
  showToast?: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
}

export const PreventiveMetersView: React.FC<PreventiveMetersViewProps> = ({
  machines = [],
  tasks = [],
  meterReadings = [],
  onRecordReading,
  onBatchRecordReadings,
  onMarkTaskDone,
  onNavigateToPlanBuilder,
  user,
  showToast,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZone, setSelectedZone] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'OVERDUE' | 'WARNING' | 'OK'>('ALL');

  // Modals state
  const [singleReadingModalMachine, setSingleReadingModalMachine] = useState<any | null>(null);
  const [singleReadingValue, setSingleReadingValue] = useState<string>('');
  const [singleReadingUnit, setSingleReadingUnit] = useState<MeterUnit>('Heures');
  const [singleReadingComment, setSingleReadingComment] = useState<string>('');

  const [historyModalMachine, setHistoryModalMachine] = useState<any | null>(null);
  const [showBatchTourModal, setShowBatchTourModal] = useState(false);
  const [batchReadingsState, setBatchReadingsState] = useState<Record<string, string>>({});

  // Active machines
  const activeMachines = useMemo(() => filterActiveMachines(machines), [machines]);

  // Unique zones
  const zones = useMemo(() => {
    const set = new Set<string>();
    activeMachines.forEach((m) => {
      const z = m.id_zone_default || m.id_zone || m.zone;
      if (z) set.add(String(z).trim());
    });
    return Array.from(set).sort();
  }, [activeMachines]);

  // Enrich machines with counter data and evaluations
  const machinesWithCounters = useMemo(() => {
    return activeMachines.map((m) => {
      const mCode = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
      const currentReading = Number(m.compteur_heures ?? m.dernier_releve_compteur ?? 0);
      const defaultUnit: MeterUnit = m.compteur_unite_defaut || 'Heures';

      // Find all counter or hybrid tasks for this machine
      const machTasks = tasks.filter((t) => {
        const tMach = String(t.id_machine || '').trim().toUpperCase();
        const isCounter =
          t.type_declencheur === 'COMPTEUR' ||
          t.type_declencheur === 'HYBRIDE' ||
          Number(t.compteur_seuil_intervalle) > 0;
        return tMach === mCode && isCounter;
      });

      // Evaluate tasks
      const evaluatedTasks = machTasks.map((t) => {
        const evalResult = MeterService.evaluateTaskTrigger(t, currentReading);
        return {
          task: t,
          evaluation: evalResult,
        };
      });

      const hasOverdue = evaluatedTasks.some((item) => item.evaluation.isOverdue && item.task.etat !== 'Fait');
      const hasWarning = evaluatedTasks.some((item) => item.evaluation.isWarning && item.task.etat !== 'Fait');

      let overallStatus: 'OVERDUE' | 'WARNING' | 'OK' = 'OK';
      if (hasOverdue) overallStatus = 'OVERDUE';
      else if (hasWarning) overallStatus = 'WARNING';

      // Get last recorded reading event from ledger
      const lastReadingEvent = meterReadings
        .filter((r) => String(r.machineId || '').trim().toUpperCase() === mCode)
        .sort((a, b) => new Date(b.createdAt || b.date_releve).getTime() - new Date(a.createdAt || a.date_releve).getTime())[0];

      return {
        machine: m,
        code: mCode,
        designation: m.designation || `Machine ${mCode}`,
        zone: m.id_zone_default || m.id_zone || m.zone || 'Atelier',
        currentReading,
        defaultUnit,
        tasks: evaluatedTasks,
        overallStatus,
        lastReadingEvent,
      };
    });
  }, [activeMachines, tasks, meterReadings]);

  // Global KPIs
  const kpis = useMemo(() => {
    let overdueCount = 0;
    let warningCount = 0;
    let monitoredMachines = 0;

    machinesWithCounters.forEach((item) => {
      if (item.currentReading > 0 || item.tasks.length > 0) {
        monitoredMachines++;
      }
      item.tasks.forEach((tItem) => {
        if (tItem.task.etat !== 'Fait') {
          if (tItem.evaluation.isOverdue) overdueCount++;
          else if (tItem.evaluation.isWarning) warningCount++;
        }
      });
    });

    return {
      monitoredMachines,
      overdueCount,
      warningCount,
      totalReadings: meterReadings.length,
    };
  }, [machinesWithCounters, meterReadings]);

  // Filtered machines
  const filteredMachines = useMemo(() => {
    return machinesWithCounters.filter((item) => {
      // Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesCode = item.code.toLowerCase().includes(q);
        const matchesDesig = item.designation.toLowerCase().includes(q);
        if (!matchesCode && !matchesDesig) return false;
      }

      // Zone filter
      if (selectedZone !== 'ALL' && item.zone !== selectedZone) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL' && item.overallStatus !== selectedStatusFilter) {
        return false;
      }

      return true;
    });
  }, [machinesWithCounters, searchTerm, selectedZone, selectedStatusFilter]);

  // Single reading submit
  const handleSaveSingleReading = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleReadingModalMachine) return;
    const val = Number(singleReadingValue);
    if (isNaN(val) || val < 0) {
      showToast?.('Veuillez saisir une valeur numérique positive.', 'warning');
      return;
    }

    onRecordReading({
      machineId: singleReadingModalMachine.code,
      valeur: val,
      unite: singleReadingUnit,
      releve_par: user?.name || user?.nom || 'Technicien',
      source: 'MANUEL',
      commentaire: singleReadingComment.trim() || undefined,
    });

    showToast?.(`Relevé enregistré pour ${singleReadingModalMachine.code}: ${val} ${singleReadingUnit}`, 'success');
    setSingleReadingModalMachine(null);
    setSingleReadingValue('');
    setSingleReadingComment('');
  };

  // Open single reading modal
  const openSingleReadingModal = (item: any) => {
    setSingleReadingModalMachine(item);
    setSingleReadingValue(String(item.currentReading || ''));
    setSingleReadingUnit(item.defaultUnit || 'Heures');
    setSingleReadingComment('');
  };

  // Open Batch Tour Modal
  const openBatchTourModal = () => {
    const initialValues: Record<string, string> = {};
    activeMachines.forEach((m) => {
      const code = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
      const current = Number(m.compteur_heures ?? m.dernier_releve_compteur ?? 0);
      initialValues[code] = current > 0 ? String(current) : '';
    });
    setBatchReadingsState(initialValues);
    setShowBatchTourModal(true);
  };

  // Submit batch tour
  const handleSaveBatchTour = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any[] = [];
    const techName = user?.name || user?.nom || 'Technicien Tournée';
    const today = new Date().toISOString().split('T')[0];

    Object.entries(batchReadingsState).forEach(([mCode, valStr]) => {
      const numericVal = Number(valStr);
      if (!valStr || isNaN(numericVal) || numericVal <= 0) return;

      const currentMach = machinesWithCounters.find((m) => m.code === mCode);
      // Only record if value is different or positive
      if (numericVal !== currentMach?.currentReading) {
        payload.push({
          machineId: mCode,
          valeur: numericVal,
          unite: currentMach?.defaultUnit || 'Heures',
          date_releve: today,
          releve_par: techName,
          source: 'MANUEL',
          commentaire: 'Relevé de tournée systématique',
        });
      }
    });

    if (payload.length === 0) {
      showToast?.('Aucun changement de relevé détecté.', 'info');
      setShowBatchTourModal(false);
      return;
    }

    onBatchRecordReadings(payload);
    showToast?.(`Tournée enregistrée avec succès (${payload.length} machines mises à jour).`, 'success');
    setShowBatchTourModal(false);
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP COCKPIT KPIS                                                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Monitored Machines */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Parc sous Horomètres
            </span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Gauge className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {kpis.monitoredMachines}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              / {activeMachines.length} machines
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Machines avec suivi d&apos;heures ou cycles actifs
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500/20 group-hover:bg-indigo-500 transition-colors" />
        </div>

        {/* KPI 2: Overdue Tasks (Échues au Compteur) */}
        <div
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE')}
          className={`bg-white rounded-2xl border p-4 shadow-sm cursor-pointer transition-all relative overflow-hidden group ${
            selectedStatusFilter === 'OVERDUE'
              ? 'border-rose-400 ring-2 ring-rose-200'
              : 'border-slate-200/90 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>Échues au Compteur</span>
              {kpis.overdueCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
              )}
            </span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-700 font-mono tracking-tight">
              {kpis.overdueCount}
            </span>
            <span className="text-xs text-rose-600 font-medium">tâches à exécuter</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Seuil horaire ou cyclique atteint ou dépassé
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500/30 group-hover:bg-rose-500 transition-colors" />
        </div>

        {/* KPI 3: Threshold Warnings */}
        <div
          onClick={() => setSelectedStatusFilter(selectedStatusFilter === 'WARNING' ? 'ALL' : 'WARNING')}
          className={`bg-white rounded-2xl border p-4 shadow-sm cursor-pointer transition-all relative overflow-hidden group ${
            selectedStatusFilter === 'WARNING'
              ? 'border-amber-400 ring-2 ring-amber-200'
              : 'border-slate-200/90 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
              Alerte Seuil Imminent
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 font-mono tracking-tight">
              {kpis.warningCount}
            </span>
            <span className="text-xs text-amber-600 font-medium">&lt; 10% avant seuil</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            À anticiper lors des prochains arrêts
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/30 group-hover:bg-amber-500 transition-colors" />
        </div>

        {/* KPI 4: Readings Activity Ledger */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Relevés Historisés
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              {kpis.totalReadings}
            </span>
            <span className="text-xs text-emerald-700 font-medium">saisies enregistrées</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Traçabilité immuable avec calcul des deltas
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/20 group-hover:bg-emerald-500 transition-colors" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ACTION BAR & FILTERS                                                   */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher machine (code, désignation)..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Zone Selector */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="text-xs py-2 px-2.5 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">Toutes les zones</option>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          {/* Status Quick Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedStatusFilter === 'ALL'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({machinesWithCounters.length})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('OVERDUE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedStatusFilter === 'OVERDUE'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Échues ({kpis.overdueCount})
            </button>
            <button
              onClick={() => setSelectedStatusFilter('WARNING')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                selectedStatusFilter === 'WARNING'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              Alerte ({kpis.warningCount})
            </button>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Fast Batch Reading Tournee */}
          <button
            type="button"
            onClick={openBatchTourModal}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Tournée de Relevé Rapide</span>
          </button>

          {/* Plan Builder Shortcut */}
          {onNavigateToPlanBuilder && (
            <button
              type="button"
              onClick={onNavigateToPlanBuilder}
              className="px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white text-slate-700 hover:text-slate-900 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Plan Compteur</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MACHINES & COUNTERS GRID                                               */}
      {/* ========================================================================= */}
      {filteredMachines.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
            <Gauge className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Aucune machine correspondante</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Aucun équipement ne correspond aux filtres actifs ou aucun relevé n&apos;est enregistré.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMachines.map((item) => {
            const isOverdue = item.overallStatus === 'OVERDUE';
            const isWarning = item.overallStatus === 'WARNING';

            return (
              <div
                key={item.code}
                className={`bg-white rounded-2xl border transition-all duration-200 p-4 shadow-sm hover:shadow-md flex flex-col justify-between ${
                  isOverdue
                    ? 'border-rose-300 ring-2 ring-rose-100'
                    : isWarning
                    ? 'border-amber-300 ring-2 ring-amber-100'
                    : 'border-slate-200/90'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-sm text-slate-900 tracking-tight">
                          {item.code}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          {item.zone}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 animate-pulse flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Seuil dépassé
                          </span>
                        )}
                        {isWarning && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Alerte seuil
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-semibold text-slate-700 truncate mt-1">
                        {item.designation}
                      </h4>
                    </div>

                    {/* Quick Reading Button */}
                    <button
                      type="button"
                      onClick={() => openSingleReadingModal(item)}
                      title="Saisir un nouveau relevé"
                      className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Main Counter Display */}
                  <div className="mt-3 bg-slate-900 rounded-xl p-3 text-white flex items-center justify-between relative overflow-hidden">
                    <div className="relative z-10">
                      <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
                        Index Horomètre Actuel
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-2xl font-black font-mono tracking-wider text-emerald-400">
                          {item.currentReading.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-300 font-medium">
                          {item.defaultUnit}
                        </span>
                      </div>
                    </div>

                    <div className="relative z-10 text-right">
                      <button
                        type="button"
                        onClick={() => setHistoryModalMachine(item)}
                        className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 justify-end underline decoration-slate-600 transition"
                      >
                        <History className="w-3 h-3" />
                        <span>Historique</span>
                      </button>
                      <span className="text-[10px] text-slate-400 block mt-1">
                        {item.lastReadingEvent
                          ? `Le ${item.lastReadingEvent.date_releve}`
                          : 'Aucun relevé'}
                      </span>
                    </div>

                    {/* Decorative ambient shine */}
                    <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                  </div>

                  {/* Associated Counter Tasks Section */}
                  <div className="mt-3 space-y-2">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 block">
                      Tâches Conditionnelles ({item.tasks.length})
                    </span>

                    {item.tasks.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        Aucun plan conditionnel rattaché à cette machine.
                      </p>
                    ) : (
                      item.tasks.map(({ task, evaluation }) => {
                        const isDone = task.etat === 'Fait';
                        const progressColor = evaluation.isOverdue
                          ? 'bg-rose-500'
                          : evaluation.isWarning
                          ? 'bg-amber-500'
                          : 'bg-indigo-500';

                        return (
                          <div
                            key={task.id}
                            className={`p-2.5 rounded-xl border text-xs transition ${
                              evaluation.isOverdue && !isDone
                                ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                                : evaluation.isWarning && !isDone
                                ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                                : 'bg-slate-50 border-slate-200/80 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-bold truncate max-w-[180px]">
                                {task.composant || task.nom_composant || 'Élément'} · {task.action_code || 'C'}
                              </span>
                              <span className="font-mono text-[10px] font-bold">
                                {evaluation.percentProgress}%
                              </span>
                            </div>

                            {/* Progress bar */}
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mb-1.5">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                                style={{ width: `${Math.min(100, evaluation.percentProgress)}%` }}
                              />
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-500">
                              <span>
                                Seuil: <strong className="font-mono text-slate-700">{evaluation.targetValue} {evaluation.unit}</strong>
                              </span>
                              <span className={evaluation.isOverdue && !isDone ? 'font-bold text-rose-700' : ''}>
                                {evaluation.message}
                              </span>
                            </div>

                            {/* Direct Execute Trigger if Overdue or Warning */}
                            {!isDone && (evaluation.isOverdue || evaluation.isWarning) && onMarkTaskDone && (
                              <button
                                type="button"
                                onClick={() => {
                                  onMarkTaskDone(task.id, {
                                    compteur_releve: item.currentReading,
                                    date_realisation: new Date().toISOString().split('T')[0],
                                    technicien: user?.name || user?.nom || 'Technicien',
                                  });
                                  showToast?.(`Tâche ${task.code || task.id} exécutée avec succès !`, 'success');
                                }}
                                className="mt-2 w-full py-1 px-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-bold text-[10px] flex items-center justify-center gap-1 shadow-2xs transition cursor-pointer"
                              >
                                <Wrench className="w-3 h-3 text-indigo-600" />
                                <span>Valider l&apos;intervention maintenant</span>
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Card Footer Info */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>{item.machine.technician || 'Technicien assigné'}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openSingleReadingModal(item)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-0.5 transition"
                  >
                    <span>Mettre à jour</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SINGLE READING MODAL                                                   */}
      {/* ========================================================================= */}
      {singleReadingModalMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-5 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSingleReadingModalMachine(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Nouveau Relevé d&apos;Horomètre
                </h3>
                <p className="text-xs text-slate-500">
                  {singleReadingModalMachine.code} · {singleReadingModalMachine.designation}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveSingleReading} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valeur relevée ({singleReadingUnit})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    value={singleReadingValue}
                    onChange={(e) => setSingleReadingValue(e.target.value)}
                    placeholder="ex: 4500"
                    className="w-full pl-3 pr-16 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {singleReadingUnit}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                  <span>Précédent: {singleReadingModalMachine.currentReading} {singleReadingUnit}</span>
                  {Number(singleReadingValue) > singleReadingModalMachine.currentReading && (
                    <span className="text-emerald-700 font-bold">
                      +{Number(singleReadingValue) - singleReadingModalMachine.currentReading} {singleReadingUnit}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Unité de mesure
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Heures', 'Cycles', 'Km'] as MeterUnit[]).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setSingleReadingUnit(u)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        singleReadingUnit === u
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-2 ring-indigo-200'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Commentaire / Observation (optionnel)
                </label>
                <textarea
                  rows={2}
                  value={singleReadingComment}
                  onChange={(e) => setSingleReadingComment(e.target.value)}
                  placeholder="ex: Remplacement horomètre, contrôle shift du matin..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSingleReadingModalMachine(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer le relevé</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MACHINE METER HISTORY MODAL                                            */}
      {/* ========================================================================= */}
      {historyModalMachine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-2xl w-full p-5 relative max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setHistoryModalMachine(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-4 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Historique des Relevés Horomètres
                </h3>
                <p className="text-xs text-slate-500">
                  {historyModalMachine.code} · {historyModalMachine.designation}
                </p>
              </div>
            </div>

            {/* Readings list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {meterReadings.filter((r) => String(r.machineId || '').trim().toUpperCase() === historyModalMachine.code).length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Aucun historique de relevé pour cette machine.
                </div>
              ) : (
                meterReadings
                  .filter((r) => String(r.machineId || '').trim().toUpperCase() === historyModalMachine.code)
                  .sort((a, b) => new Date(b.createdAt || b.date_releve).getTime() - new Date(a.createdAt || a.date_releve).getTime())
                  .map((r) => (
                    <div
                      key={r.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-slate-900">
                            {r.valeur.toLocaleString()} {r.unite}
                          </span>
                          {r.delta > 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              +{r.delta} {r.unite}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                            {r.source}
                          </span>
                        </div>
                        {r.commentaire && (
                          <p className="text-[11px] text-slate-500 italic">{r.commentaire}</p>
                        )}
                      </div>

                      <div className="text-right text-[11px] text-slate-500">
                        <span className="block font-medium text-slate-700">{r.date_releve}</span>
                        <span className="block text-[10px] text-slate-400">{r.releve_par}</span>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 mt-4 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setHistoryModalMachine(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. FAST BATCH TOURNEE MODAL                                               */}
      {/* ========================================================================= */}
      {showBatchTourModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full p-5 relative max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowBatchTourModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-3 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Tournée d&apos;Atelier — Relevé Rapide Groupé
                </h3>
                <p className="text-xs text-slate-500">
                  Saisissez les compteurs de toutes vos machines en une seule passe ergonomique.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveBatchTour} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 my-2">
                <div className="grid grid-cols-12 gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <div className="col-span-3">Machine</div>
                  <div className="col-span-3">Désignation / Zone</div>
                  <div className="col-span-3">Index Actuel</div>
                  <div className="col-span-3">Nouveau Relevé</div>
                </div>

                {activeMachines.map((m) => {
                  const mCode = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
                  const current = Number(m.compteur_heures ?? m.dernier_releve_compteur ?? 0);
                  const inputVal = batchReadingsState[mCode] || '';
                  const numInput = Number(inputVal);
                  const delta = numInput > current ? numInput - current : 0;

                  return (
                    <div
                      key={mCode}
                      className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition text-xs"
                    >
                      <div className="col-span-3">
                        <span className="font-mono font-bold text-slate-900">{mCode}</span>
                      </div>
                      <div className="col-span-3 truncate text-slate-600">
                        <span className="block truncate">{m.designation || 'Machine'}</span>
                        <span className="text-[10px] text-slate-400">{m.id_zone_default || m.zone || 'Zone'}</span>
                      </div>
                      <div className="col-span-3 font-mono text-slate-500">
                        {current > 0 ? `${current.toLocaleString()} h` : '—'}
                      </div>
                      <div className="col-span-3 relative">
                        <input
                          type="number"
                          step="any"
                          value={inputVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchReadingsState((prev) => ({ ...prev, [mCode]: val }));
                          }}
                          placeholder={current > 0 ? String(current) : '0'}
                          className="w-full py-1.5 px-2.5 rounded-lg border border-slate-300 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        {delta > 0 && (
                          <span className="absolute -bottom-4 right-1 text-[9px] font-bold text-emerald-700">
                            +{delta} h
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500">
                  {Object.values(batchReadingsState).filter(Boolean).length} machines renseignées
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchTourModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>Valider et Enregistrer la Tournée</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreventiveMetersView;
