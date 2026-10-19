import { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Factory,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  X,
  Printer,
  ChevronDown,
  ChevronUp,
  Search,
  DollarSign,
} from 'lucide-react';
import ViewSwitchButtonGroup from './ViewSwitchButtonGroup';

const MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const DAYS_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_FULL_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const ACTION_PILL_MAP = {
  C: { bg: 'bg-blue-500/10 text-blue-800 border-blue-200/80', dot: 'bg-blue-600', label: 'Contrôle' },
  N: { bg: 'bg-emerald-500/10 text-emerald-800 border-emerald-200/80', dot: 'bg-emerald-600', label: 'Nettoyage' },
  G: { bg: 'bg-amber-500/10 text-amber-800 border-amber-200/80', dot: 'bg-amber-600', label: 'Graissage' },
  V: { bg: 'bg-indigo-500/10 text-indigo-800 border-indigo-200/80', dot: 'bg-indigo-600', label: 'Vidange' },
  R: { bg: 'bg-purple-500/10 text-purple-800 border-purple-200/80', dot: 'bg-purple-600', label: 'Réglage' },
  S: { bg: 'bg-rose-500/10 text-rose-800 border-rose-200/80', dot: 'bg-rose-600', label: 'Sécurité' },
  L: { bg: 'bg-cyan-500/10 text-cyan-800 border-cyan-200/80', dot: 'bg-cyan-600', label: 'Lubrification' },
};

/**
 * Enhanced Monthly & Weekly Calendar View for Preventive Maintenance
 * Provides:
 * - High-end UI with 3D elevation and fluid interactions
 * - Monthly Grid & Weekly Focus Modes
 * - Workload Density Heatmap (Low, Medium, High load)
 * - Quick Technician & Machine filtering
 * - Detailed slide-out Day Inspector with direct validation, anomaly triggering, and OT batch print
 */
export default function MonthlyCalendarView({
  tasks = [],
  machines = [],
  onOpenValidate = () => {},
  onOpenCorrective = () => {},
  onOpenPrint = () => {},
  onSwitchView = () => {},
}) {
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // 0 - 11
  const [calendarMode, setCalendarMode] = useState('month'); // 'month' | 'week'
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0); // 0..4 within current month
  const [techFilter, setTechFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDayDetail, setActiveDayDetail] = useState(null); // { dateStr, dayNum, machines: [...] }
  const [expandedMachineInDrawer, setExpandedMachineInDrawer] = useState({});

  // Machine lookup map for Strict Relational Engine (Single Source of Truth)
  const masterMachineMap = useMemo(() => {
    const map = new Map();
    (machines || []).forEach((m) => {
      const code = String(m.code_machine || m.id_machine_registered || m.id || '').trim().toUpperCase();
      if (code) map.set(code, m);
    });
    return map;
  }, [machines]);

  // Helper to get ISO week number from date
  const getISOWeek = (d) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    return (
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
      )
    );
  };

  // Distinct technicians list for filtering
  const techniciansList = useMemo(() => {
    const set = new Set();
    tasks.forEach((t) => {
      if (t.responsable && t.responsable !== 'Non assigné') {
        set.add(t.responsable);
      }
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Filter tasks based on local calendar filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (techFilter !== 'ALL' && t.responsable !== techFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const m = (t.id_machine || '').toLowerCase();
        const nom = (t.nom_machine || '').toLowerCase();
        const comp = (t.composant || '').toLowerCase();
        const cons = (t.consigne || '').toLowerCase();
        const tech = (t.responsable || '').toLowerCase();
        if (!m.includes(q) && !nom.includes(q) && !comp.includes(q) && !cons.includes(q) && !tech.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [tasks, techFilter, searchTerm]);

  // Compute Days for the selected Month
  const calendarGrid = useMemo(() => {
    const firstDay = new Date(selectedYear, selectedMonth, 1);
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0);
    const totalDays = lastDay.getDate();

    // Day of week for day 1 (0: Sun, 1: Mon, ... 6: Sat) -> Convert to Monday = 0
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];

    // Blank cells before month start
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ isBlank: true, key: `blank-${i}` });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(selectedYear, selectedMonth, d);
      const isoDateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isoWeek = `S${getISOWeek(dateObj)}`;
      const isToday = isoDateStr === todayStr;
      const dayOfWeekIndex = (dateObj.getDay() + 6) % 7; // 0: Lun..6: Dim

      // Find tasks mapped to this exact date OR mapped to this ISO week
      const matchingTasks = filteredTasks.filter((t) => {
        if (t.prochaine_echeance === isoDateStr) return true;
        if (t.planning && t.planning[isoWeek]) {
          const taskHash = Math.abs(
            (t.id || t.code || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
          );
          const assignedDayOffset = (taskHash % 5); // Mon=0 to Fri=4
          return dayOfWeekIndex === assignedDayOffset;
        }
        return false;
      });

      // Group tasks by distinct machines
      const machineMap = {};
      let totalEstMinutes = 0;
      let totalCostDT = 0;

      matchingTasks.forEach((task) => {
        const mId = task.id_machine || 'AUTRE';
        if (!machineMap[mId]) {
          machineMap[mId] = {
            id_machine: mId,
            nom_machine: task.nom_machine || mId,
            zone: task.id_zone || task.zone || '',
            tasks: [],
            totalTasks: 0,
            hasLate: false,
            hasDone: false,
            hasPending: false,
          };
        }
        machineMap[mId].tasks.push(task);
        machineMap[mId].totalTasks += 1;
        if (task.etat === 'En retard') machineMap[mId].hasLate = true;
        else if (task.etat === 'Fait') machineMap[mId].hasDone = true;
        else machineMap[mId].hasPending = true;

        // Estimated minutes parsing
        const rawDur = String(task.duree_estimee || '20 min');
        const numMinutes = parseInt(rawDur.replace(/[^0-9]/g, ''), 10) || 20;
        totalEstMinutes += numMinutes;
        totalCostDT += Number(task.cout_cumule || 0);
      });

      const distinctMachines = Object.values(machineMap);
      const totalTasksCount = matchingTasks.length;
      const totalMachinesCount = distinctMachines.length;
      const lateCount = matchingTasks.filter((t) => t.etat === 'En retard').length;
      const doneCount = matchingTasks.filter((t) => t.etat === 'Fait').length;

      // Workload Level: 0: None, 1: Low (1-2), 2: Normal (3-5), 3: High (6+)
      let workloadLevel = 'none';
      if (totalTasksCount > 0) {
        if (totalTasksCount <= 2) workloadLevel = 'low';
        else if (totalTasksCount <= 5) workloadLevel = 'normal';
        else workloadLevel = 'high';
      }

      days.push({
        isBlank: false,
        key: `day-${d}`,
        dayNumber: d,
        dayOfWeekIndex,
        dayName: DAYS_NAMES[dayOfWeekIndex],
        dayFullName: DAYS_FULL_NAMES[dayOfWeekIndex],
        isoDateStr,
        isoWeek,
        isToday,
        tasks: matchingTasks,
        machines: distinctMachines,
        totalMachinesCount,
        totalTasksCount,
        lateCount,
        doneCount,
        totalEstMinutes,
        totalCostDT,
        workloadLevel,
      });
    }

    return days;
  }, [selectedYear, selectedMonth, filteredTasks]);

  // Weeks slices for Weekly Focus Mode
  const monthWeeks = useMemo(() => {
    const realDays = calendarGrid.filter((c) => !c.isBlank);
    const weeks = [];
    let currentW = [];
    let currentWeekNum = null;

    realDays.forEach((day) => {
      if (currentWeekNum === null || currentWeekNum !== day.isoWeek) {
        if (currentW.length > 0) {
          weeks.push({
            isoWeek: currentWeekNum,
            days: currentW,
          });
        }
        currentW = [];
        currentWeekNum = day.isoWeek;
      }
      currentW.push(day);
    });

    if (currentW.length > 0) {
      weeks.push({
        isoWeek: currentWeekNum,
        days: currentW,
      });
    }

    return weeks;
  }, [calendarGrid]);

  // Monthly summary stats
  const monthStats = useMemo(() => {
    let totalScheduledTasks = 0;
    const distinctMachinesSet = new Set();
    let totalLate = 0;
    let totalDone = 0;
    let totalMinutes = 0;
    let totalCost = 0;

    calendarGrid.forEach((cell) => {
      if (!cell.isBlank) {
        totalScheduledTasks += cell.totalTasksCount;
        cell.machines.forEach((m) => distinctMachinesSet.add(m.id_machine));
        totalLate += cell.lateCount;
        totalDone += cell.doneCount;
        totalMinutes += cell.totalEstMinutes;
        totalCost += cell.totalCostDT;
      }
    });

    const completionRate =
      totalScheduledTasks > 0 ? Math.round((totalDone / totalScheduledTasks) * 100) : 100;

    return {
      totalTasks: totalScheduledTasks,
      distinctMachines: distinctMachinesSet.size,
      totalLate,
      totalDone,
      totalHours: (totalMinutes / 60).toFixed(1),
      totalCost: totalCost.toFixed(2),
      completionRate,
    };
  }, [calendarGrid]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedYear(now.getFullYear());
    setSelectedMonth(now.getMonth());
  };

  const toggleMachineDrawer = (mId) => {
    setExpandedMachineInDrawer((prev) => ({
      ...prev,
      [mId]: !prev[mId],
    }));
  };

  // Active week in week mode
  const activeWeekData = monthWeeks[selectedWeekIndex] || monthWeeks[0] || { days: [] };

  return (
    <div className="space-y-4 animate-view-transition">
      {/* 1. TOP CARD CONTAINER WITH INTEGRATED CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
        {/* Top Info Header Bar with View Controls & Mode Toggle */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/50 gap-3">
          {/* Left Title & Status Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-teal-600" />
              <span className="font-bold text-slate-800 text-[13px]">
                Planning Calendrier Mensuel des Interventions
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
              {monthStats.totalTasks} Tâche{monthStats.totalTasks > 1 ? 's' : ''} ce mois
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
              {monthStats.distinctMachines} Machines
            </span>
          </div>

          {/* Right Controls: Mode Toggle (Month / Week) + 3D Circular Switch Button */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode: Month Grid vs Week Focus */}
            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setCalendarMode('month')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  calendarMode === 'month'
                    ? 'bg-white text-teal-900 shadow-xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                Vue Mois
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('week')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  calendarMode === 'week'
                    ? 'bg-white text-teal-900 shadow-xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                }`}
              >
                Focus Semaine
              </button>
            </div>

            {/* 3D Circular Switch Buttons on the RIGHT */}
            <ViewSwitchButtonGroup
              currentView="calendar"
              onSwitchView={onSwitchView}
            />
          </div>
        </div>

        {/* Navigation, Date Switcher & Quick Filters Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3 bg-white">
          {/* Month / Year Navigator */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/80 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition cursor-pointer"
                title="Mois Précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3.5 py-1 font-black text-slate-900 text-sm md:text-base min-w-[150px] text-center tracking-tight font-sans">
                {MONTHS_FR[selectedMonth]} {selectedYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs transition cursor-pointer"
                title="Mois Suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleToday}
              className="h-8 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200/90 text-teal-800 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
            >
              Aujourd'hui
            </button>

            {calendarMode === 'week' && monthWeeks.length > 0 && (
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 px-1.5">Semaine :</span>
                {monthWeeks.map((w, idx) => (
                  <button
                    key={w.isoWeek}
                    type="button"
                    onClick={() => setSelectedWeekIndex(idx)}
                    className={`px-2 py-0.5 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                      selectedWeekIndex === idx
                        ? 'bg-teal-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    {w.isoWeek}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Filters: Technician & Search */}
          <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
            {/* Filter by Tech */}
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={techFilter}
                onChange={(e) => setTechFilter(e.target.value)}
                className="h-8 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-teal-500 cursor-pointer"
              >
                <option value="ALL">Tous les techniciens</option>
                {techniciansList.map((tech) => (
                  <option key={tech} value={tech}>
                    {tech}
                  </option>
                ))}
              </select>
            </div>

            {/* Quick Search */}
            <div className="relative flex-1 md:w-48">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer machine / organe..."
                className="h-8 w-full pl-8 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-teal-500 transition"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 2. KPI SNAPSHOT MINI-RIBBON */}
        <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Conformes :</span>
              <b className="text-emerald-700 font-mono font-bold">
                {monthStats.totalDone} / {monthStats.totalTasks} ({monthStats.completionRate}%)
              </b>
            </div>

            {monthStats.totalLate > 0 && (
              <div className="flex items-center gap-1.5 font-medium text-rose-700 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>En Retard :</span>
                <b className="font-mono font-bold">{monthStats.totalLate}</b>
              </div>
            )}

            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Charge estimée :</span>
              <b className="text-indigo-900 font-mono font-bold">{monthStats.totalHours} h</b>
            </div>

            <div className="flex items-center gap-1.5 font-medium text-slate-600">
              <DollarSign className="w-3.5 h-3.5 text-amber-600" />
              <span>Coût cumulé :</span>
              <b className="text-amber-900 font-mono font-bold">{monthStats.totalCost} DT</b>
            </div>
          </div>

          {/* Workload Legend */}
          <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-medium">
            <span className="text-slate-400">Charge :</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Faible (1-2)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Normale (3-5)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> Élevée (6+)
            </span>
          </div>
        </div>

        {/* 3. CALENDAR CONTENT: MONTH VIEW OR WEEK FOCUS */}
        {calendarMode === 'month' ? (
          // ==================== MODE 1: FULL MONTH GRID ====================
          <div className="overflow-x-auto">
            {/* Days of Week Column Header */}
            <div className="grid grid-cols-7 bg-slate-100/90 border-b border-slate-200 text-center py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-700 min-w-[700px]">
              {DAYS_NAMES.map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`${idx >= 5 ? 'text-slate-400 bg-slate-200/40' : 'text-slate-700'}`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 auto-rows-fr gap-px bg-slate-200/80 min-w-[700px]">
              {calendarGrid.map((cell) => {
                if (cell.isBlank) {
                  return (
                    <div
                      key={cell.key}
                      className="bg-slate-50/50 min-h-[115px] md:min-h-[130px] p-2 text-slate-300"
                    />
                  );
                }

                const hasMachines = cell.totalMachinesCount > 0;
                const isSelectedDay = activeDayDetail?.isoDateStr === cell.isoDateStr;

                // Density Bar Colors
                const densityBadgeColor =
                  cell.workloadLevel === 'high'
                    ? 'bg-purple-100 text-purple-900 border-purple-300'
                    : cell.workloadLevel === 'normal'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-emerald-100 text-emerald-900 border-emerald-300';

                return (
                  <div
                    key={cell.key}
                    onClick={() => {
                      if (hasMachines) {
                        setActiveDayDetail(cell);
                        setExpandedMachineInDrawer({});
                      }
                    }}
                    className={`min-h-[115px] md:min-h-[130px] p-2 transition-all flex flex-col justify-between group relative ${
                      cell.isToday
                        ? 'bg-teal-50/40 hover:bg-teal-50/80 ring-2 ring-teal-500 ring-inset'
                        : isSelectedDay
                        ? 'bg-teal-100/60 ring-2 ring-teal-600 ring-inset'
                        : hasMachines
                        ? 'bg-white hover:bg-slate-50/90 cursor-pointer'
                        : 'bg-white/80'
                    }`}
                  >
                    {/* Day Header with Number & ISO Week */}
                    <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black font-mono shadow-2xs ${
                            cell.isToday
                              ? 'bg-teal-600 text-white'
                              : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                          }`}
                        >
                          {cell.dayNumber}
                        </span>
                        {cell.isToday && (
                          <span className="text-[9px] font-bold text-teal-700 uppercase tracking-tight hidden sm:inline">
                            Aujourd'hui
                          </span>
                        )}
                        {hasMachines && (
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-mono font-bold border hidden sm:inline-block ${densityBadgeColor}`}
                            title={`Charge: ${cell.totalTasksCount} tâches (${cell.totalEstMinutes} min)`}
                          >
                            {cell.workloadLevel === 'high' ? 'Charge +' : cell.workloadLevel === 'normal' ? 'Normale' : 'Légère'}
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] font-mono font-bold text-slate-400">
                        {cell.isoWeek}
                      </span>
                    </div>

                    {/* Day Content Badges */}
                    <div className="my-1.5 space-y-1.5 flex-1">
                      {hasMachines ? (
                        <>
                          {/* Main Machine Summary Pill */}
                          <div
                            className={`px-2 py-1 rounded-xl text-xs font-bold border transition-all flex items-center justify-between shadow-2xs ${
                              cell.lateCount > 0
                                ? 'bg-rose-50 border-rose-200 text-rose-900'
                                : cell.doneCount === cell.totalTasksCount
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-teal-50 border-teal-200 text-teal-900 group-hover:border-teal-400'
                            }`}
                          >
                            <span className="flex items-center gap-1 truncate">
                              <Factory className="w-3.5 h-3.5 shrink-0 text-teal-700" />
                              <span className="text-[11px] font-black">
                                {cell.totalMachinesCount} {cell.totalMachinesCount > 1 ? 'Mach.' : 'Mach.'}
                              </span>
                            </span>
                            <span className="px-1.5 py-0.2 rounded-md bg-white/90 text-teal-950 font-mono text-[10px] font-bold border border-teal-200/50">
                              {cell.totalTasksCount} T
                            </span>
                          </div>

                          {/* Mini Preview of Machine Codes */}
                          <div className="flex flex-wrap gap-1 max-h-[38px] overflow-hidden">
                            {cell.machines.slice(0, 2).map((m) => {
                              const isAllDone = m.tasks.every((t) => t.etat === 'Fait');
                              const isLate = m.hasLate;

                              return (
                                <span
                                  key={m.id_machine}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9.5px] font-mono font-semibold border truncate max-w-[85px] ${
                                    isLate
                                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                                      : isAllDone
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isLate ? 'bg-rose-600' : isAllDone ? 'bg-emerald-600' : 'bg-teal-600'
                                    }`}
                                  />
                                  {m.id_machine}
                                </span>
                              );
                            })}
                            {cell.machines.length > 2 && (
                              <span className="text-[9px] font-bold text-slate-400 self-center">
                                +{cell.machines.length - 2}
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <span className="text-[10px] text-slate-300 font-medium select-none">
                            -
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Footer Micro Indicators */}
                    {hasMachines && (
                      <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-100">
                        <span className="truncate">
                          {cell.lateCount > 0 ? (
                            <b className="text-rose-600">{cell.lateCount} en retard</b>
                          ) : cell.doneCount > 0 ? (
                            <span className="text-emerald-600 font-bold">{cell.doneCount} faites</span>
                          ) : (
                            <span>{cell.totalEstMinutes} min</span>
                          )}
                        </span>
                        <span className="text-teal-600 font-bold group-hover:underline text-[10px]">
                          Inspecter →
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // ==================== MODE 2: WEEKLY FOCUS EXPANDED ====================
          <div className="p-4 overflow-x-auto">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 min-w-[900px]">
              {activeWeekData.days.map((day) => {
                const hasTasks = day.totalTasksCount > 0;

                return (
                  <div
                    key={day.key}
                    className={`rounded-2xl border p-3 flex flex-col justify-between transition-all ${
                      day.isToday
                        ? 'bg-teal-50/30 border-teal-400 shadow-sm ring-1 ring-teal-400'
                        : hasTasks
                        ? 'bg-white border-slate-200 hover:border-teal-300 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200/70'
                    }`}
                  >
                    {/* Day Top Bar */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                          {day.dayFullName}
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          {day.dayNumber} {MONTHS_FR[selectedMonth]}
                        </span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          hasTasks
                            ? 'bg-teal-100 text-teal-900 border border-teal-200'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {day.totalTasksCount} T
                      </span>
                    </div>

                    {/* Day Task List Direct Cards */}
                    <div className="py-2 space-y-2 flex-1 max-h-[380px] overflow-y-auto pr-1">
                      {hasTasks ? (
                        day.tasks.map((task, tIdx) => {
                          const actionMeta = ACTION_PILL_MAP[task.action_code] || {
                            bg: 'bg-teal-50 text-teal-800 border-teal-200',
                            label: task.action_code,
                          };

                          return (
                            <div
                              key={task.id || `week-t-${tIdx}`}
                              className="p-2 rounded-xl bg-slate-50/90 border border-slate-200/80 hover:bg-white hover:border-teal-300 hover:shadow-xs transition space-y-1.5 group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-xs text-slate-900">
                                  {task.id_machine}
                                </span>
                                <span
                                  className={`px-1.5 py-0.2 rounded font-mono font-bold text-[9.5px] border ${actionMeta.bg}`}
                                >
                                  {task.action_code}
                                </span>
                              </div>

                              <p className="text-[11px] font-semibold text-slate-800 line-clamp-1">
                                {task.composant}
                              </p>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/60">
                                <span className="truncate max-w-[70px]">
                                  {task.responsable || 'Non assigné'}
                                </span>
                                <span className="font-mono font-bold text-slate-700">
                                  {task.duree_estimee || '20m'}
                                </span>
                              </div>

                              {/* Direct Micro Actions */}
                              <div className="flex items-center justify-end gap-1 pt-1 opacity-90 group-hover:opacity-100">
                                <button
                                  type="button"
                                  onClick={() => onOpenPrint(task)}
                                  className="p-1 rounded bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 cursor-pointer"
                                  title="Imprimer OT"
                                >
                                  <Printer className="w-3 h-3" />
                                </button>
                                {task.etat !== 'Fait' && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenValidate(task)}
                                    className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                                  >
                                    Valider
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="h-32 flex flex-col items-center justify-center text-slate-300 text-xs">
                          <span>Aucune tâche</span>
                        </div>
                      )}
                    </div>

                    {/* Day Bottom Actions */}
                    {hasTasks && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveDayDetail(day);
                          setExpandedMachineInDrawer({});
                        }}
                        className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-900 border border-slate-200 text-xs font-bold transition cursor-pointer text-center"
                      >
                        Inspecter le jour ({day.totalTasksCount})
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. SLIDE-OUT DETAIL INSPECTOR MODAL FOR SELECTED DAY */}
      {/* ========================================================================= */}
      {activeDayDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-mono font-black text-base shadow-md">
                  {activeDayDetail.dayNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-black text-slate-900 tracking-tight font-sans">
                      Planning Préventif : {activeDayDetail.isoDateStr} ({activeDayDetail.isoWeek})
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-teal-100 text-teal-950 border border-teal-200">
                      {activeDayDetail.totalMachinesCount} Machine{activeDayDetail.totalMachinesCount > 1 ? 's' : ''} · {activeDayDetail.totalTasksCount} Tâche{activeDayDetail.totalTasksCount > 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Interventions programmées · Charge totale : <b>{activeDayDetail.totalEstMinutes} min</b> ({Number(activeDayDetail.totalCostDT).toFixed(2)} DT)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Batch Print All OT for this day */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-8 px-3 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  title="Imprimer l'ordre de mission quotidien"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Imprimer Jour</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveDayDetail(null)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition cursor-pointer shadow-2xs"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body: Grouped List by Machine */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {activeDayDetail.machines.map((mach) => {
                const targetMachObj = masterMachineMap.get(mach.id_machine);
                const displayNom = mach.nom_machine || targetMachObj?.designation || targetMachObj?.nom || '';
                const displayZone = mach.zone || targetMachObj?.id_zone_default || targetMachObj?.id_zone || '';
                const isExpanded = expandedMachineInDrawer[mach.id_machine] !== false; // expanded by default
                const machDoneCount = mach.tasks.filter((t) => t.etat === 'Fait').length;

                return (
                  <div
                    key={mach.id_machine}
                    className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
                  >
                    {/* Machine Accordion Header */}
                    <div
                      onClick={() => toggleMachineDrawer(mach.id_machine)}
                      className="p-3.5 bg-slate-50/90 hover:bg-teal-50/40 border-b border-slate-100 flex items-center justify-between gap-3 cursor-pointer transition select-none"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shadow-2xs">
                          <Factory className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-slate-900 text-sm">
                              {mach.id_machine}
                            </span>
                            {displayNom && (
                              <span className="text-xs font-semibold text-slate-600">
                                - {displayNom}
                              </span>
                            )}
                            {displayZone && (
                              <span className="px-2 py-0.2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                {displayZone}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {mach.tasks.length} intervention{mach.tasks.length > 1 ? 's' : ''} ({machDoneCount} faite{machDoneCount > 1 ? 's' : ''})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {mach.hasLate && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10.5px] font-bold border border-rose-300">
                            En retard
                          </span>
                        )}
                        <span className="p-1 rounded-md text-slate-400 hover:text-slate-700">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </span>
                      </div>
                    </div>

                    {/* Tasks List for this machine */}
                    {isExpanded && (
                      <div className="p-3 divide-y divide-slate-100 space-y-2">
                        {mach.tasks.map((task) => {
                          const actionMeta = ACTION_PILL_MAP[task.action_code] || {
                            bg: 'bg-teal-100 text-teal-900 border-teal-200',
                            dot: 'bg-teal-600',
                            label: task.action_code,
                          };

                          return (
                            <div
                              key={task.id}
                              className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${actionMeta.bg}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${actionMeta.dot || 'bg-teal-600'}`} />
                                    {task.action_code || 'PRV'} - {actionMeta.label || ''}
                                  </span>
                                  <span className="font-bold text-slate-900">
                                    {task.composant || 'Organe principal'}
                                  </span>
                                  <span className="text-slate-400 text-[11px]">
                                    ({task.frequence || 'Périodique'})
                                  </span>
                                </div>
                                <p className="text-slate-500 text-[11.5px] leading-relaxed">
                                  {task.consigne || task.observations || task.type_intervention || 'Inspection et contrôle systématique.'}
                                </p>
                                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    {task.responsable || 'Non assigné'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    {task.duree_estimee || '20 min'}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-slate-400" />
                                    {Number(task.cout_cumule || 0).toFixed(2)} DT
                                  </span>
                                </div>
                              </div>

                              {/* Task Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                {onOpenPrint && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenPrint(task)}
                                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer shadow-2xs"
                                    title="Imprimer Bon de Travail (OT)"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onOpenCorrective && task.etat === 'En retard' && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenCorrective(task)}
                                    className="px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition cursor-pointer shadow-2xs"
                                  >
                                    Déclencher BT
                                  </button>
                                )}
                                {onOpenValidate && task.etat !== 'Fait' && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenValidate(task)}
                                    className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs active:scale-95 flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    Valider
                                  </button>
                                )}
                                {task.etat === 'Fait' && (
                                  <span className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Fait
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Sélectionnez une intervention pour la valider ou générer son ordre de travail.</span>
              <button
                type="button"
                onClick={() => setActiveDayDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold transition cursor-pointer"
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
