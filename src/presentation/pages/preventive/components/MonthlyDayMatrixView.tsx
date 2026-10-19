import { useState, useMemo, useCallback, Fragment } from 'react';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Printer,
  Wrench,
  Factory,
  Layers,
  Sparkles,
  FileSpreadsheet,
  RotateCcw,
  Check,
  Calendar as CalendarIcon,
  User,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import ViewSwitchButtonGroup from './ViewSwitchButtonGroup';
import { Logger } from '../../../../core/logger/LoggerService';

const MONTH_NAMES = [
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

const SHORT_DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

const ACTION_PILL_MAP = {
  C: { bg: 'bg-blue-50 text-blue-800 border-blue-300', dot: 'bg-blue-600', label: 'Contrôle' },
  N: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', dot: 'bg-emerald-600', label: 'Nettoyage' },
  G: { bg: 'bg-amber-50 text-amber-800 border-amber-300', dot: 'bg-amber-600', label: 'Graissage' },
  V: { bg: 'bg-indigo-50 text-indigo-800 border-indigo-300', dot: 'bg-indigo-600', label: 'Vidange' },
  R: { bg: 'bg-purple-50 text-purple-800 border-purple-300', dot: 'bg-purple-600', label: 'Réglage' },
  S: { bg: 'bg-rose-50 text-rose-800 border-rose-300', dot: 'bg-rose-600', label: 'Sécurité' },
  L: { bg: 'bg-cyan-50 text-cyan-800 border-cyan-300', dot: 'bg-cyan-600', label: 'Lubrification' },
  E: { bg: 'bg-orange-50 text-orange-800 border-orange-300', dot: 'bg-orange-600', label: 'Échange' },
};

const STATUT_BADGES = {
  'À faire': 'bg-blue-50 text-blue-700 border-blue-200',
  'Fait': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'En retard': 'bg-rose-50 text-rose-700 border-rose-200',
};

function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function getISOWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * MonthlyDayMatrixView - Clean Single-Card Excel Light UI mirroring MatrixWeeksView & StockView Table
 * High performance pagination (25/50/100/200/All) to handle 1,175+ tasks smoothly without freezing.
 * Uses tasks already filtered by TabMainView's global filters.
 */
export default function MonthlyDayMatrixView({
  tasks = [],
  onOpenValidate = () => {},
  onOpenCorrective = () => {},
  onOpenPrint = () => {},
  onSwitchView = () => {},
  hasActiveFilters = false,
  clearAllFilters = () => {},
}) {
  const today = useMemo(() => new Date(), []);
  const [selectedYear, setSelectedYear] = useState(() => today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => today.getMonth());
  const [sortField, setSortField] = useState('nom_machine');
  const [sortOrder, setSortOrder] = useState('asc');
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);

  // Available Years
  const availableYears = useMemo(() => {
    const cy = today.getFullYear();
    return [cy - 1, cy, cy + 1, cy + 2];
  }, [today]);

  // Days list in selected month
  const monthDays = useMemo(() => {
    const totalDays = getDaysInMonth(selectedYear, selectedMonth);
    const days = [];
    for (let day = 1; day <= totalDays; day++) {
      const dateObj = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday =
        today.getFullYear() === selectedYear &&
        today.getMonth() === selectedMonth &&
        today.getDate() === day;
      const weekNumber = getISOWeekNumber(dateObj);

      days.push({
        dayNumber: day,
        dateObj,
        dayOfWeek,
        dayNameShort: SHORT_DAYS_FR[dayOfWeek],
        isWeekend,
        isToday,
        weekNumber,
        weekKey: `S${weekNumber}`,
      });
    }
    return days;
  }, [selectedYear, selectedMonth, today]);

  // Navigate Months
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
    setCurrentPage(1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
    setCurrentPage(1);
  };

  const handleCurrentMonth = () => {
    setSelectedYear(today.getFullYear());
    setSelectedMonth(today.getMonth());
    setCurrentPage(1);
  };

  // Helper to determine if a task is scheduled on a day
  const getTaskActionForDay = useCallback(
    (task, dayInfo) => {
      const actionCode = (task.action_code || 'C').toUpperCase();
      const planning = task.planning || {};

      // 1. Direct echeance date match
      if (task.prochaine_echeance) {
        const echeanceDate = new Date(task.prochaine_echeance);
        if (
          !isNaN(echeanceDate.getTime()) &&
          echeanceDate.getFullYear() === selectedYear &&
          echeanceDate.getMonth() === selectedMonth &&
          echeanceDate.getDate() === dayInfo.dayNumber
        ) {
          return {
            hasAction: true,
            code: actionCode,
            isDone: task.etat === 'Fait',
            isOverdue: task.etat === 'En retard',
          };
        }
      }

      // 2. Direct jour_mois match
      if (task.jour_mois && Number(task.jour_mois) === dayInfo.dayNumber) {
        return {
          hasAction: true,
          code: actionCode,
          isDone: task.etat === 'Fait',
          isOverdue: task.etat === 'En retard',
        };
      }

      // 3. Week Matrix match
      const weekVal = planning[dayInfo.weekKey];
      if (weekVal) {
        const freq = (task.frequence || '').toLowerCase();
        if (freq.includes('quotidien') || freq.includes('jour')) {
          if (!dayInfo.isWeekend) {
            return {
              hasAction: true,
              code: typeof weekVal === 'string' ? weekVal : actionCode,
              isDone: task.etat === 'Fait',
              isOverdue: task.etat === 'En retard',
            };
          }
        }
        if (freq.includes('hebdo')) {
          if (dayInfo.dayOfWeek === 3) {
            return {
              hasAction: true,
              code: typeof weekVal === 'string' ? weekVal : actionCode,
              isDone: task.etat === 'Fait',
              isOverdue: task.etat === 'En retard',
            };
          }
        }
        if (dayInfo.dayOfWeek === 2) {
          return {
            hasAction: true,
            code: typeof weekVal === 'string' ? weekVal : actionCode,
            isDone: task.etat === 'Fait',
            isOverdue: task.etat === 'En retard',
          };
        }
      }

      return null;
    },
    [selectedYear, selectedMonth]
  );

  // Group tasks by Machine
  const machineGroups = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const machineKey = task.id_machine || task.nom_machine || 'AUTRE';
      if (!map.has(machineKey)) {
        map.set(machineKey, {
          id: machineKey,
          id_machine: task.id_machine || machineKey,
          nom_machine: task.nom_machine || machineKey,
          id_zone: task.id_zone || task.zone || '',
          tasks: [],
        });
      }
      map.get(machineKey).tasks.push(task);
    });

    const groups = Array.from(map.values());

    // Sort inner tasks within each machine group
    groups.forEach((group) => {
      group.tasks.sort((a, b) => {
        let valA = a[sortField] || a.composant || '';
        let valB = b[sortField] || b.composant || '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    });

    // Sort machine groups
    groups.sort((a, b) => {
      let valA;
      let valB;
      if (sortField === 'nom_machine' || sortField === 'id_machine') {
        valA = a[sortField] || '';
        valB = b[sortField] || '';
      } else {
        valA = a.tasks[0]?.[sortField] || a.nom_machine || '';
        valB = b.tasks[0]?.[sortField] || b.nom_machine || '';
      }
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return groups;
  }, [tasks, sortField, sortOrder]);

  // Expanded machines state (Set of machine IDs)
  const [expandedMachines, setExpandedMachines] = useState(() => new Set());

  const toggleMachine = useCallback((machineId) => {
    setExpandedMachines((prev) => {
      const next = new Set(prev);
      if (next.has(machineId)) {
        next.delete(machineId);
      } else {
        next.add(machineId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedMachines(new Set(machineGroups.map((g) => g.id)));
  }, [machineGroups]);

  const collapseAll = useCallback(() => {
    setExpandedMachines(new Set());
  }, []);

  // Pagination Math based on Machine Groups (User Request: 20 machines per page)
  const totalMachines = machineGroups.length;
  const totalTasks = tasks.length;
  const effectivePageSize = pageSize === 0 ? totalMachines : pageSize;
  const totalPages = pageSize === 0 ? 1 : Math.ceil(totalMachines / effectivePageSize) || 1;
  const startIndex = (currentPage - 1) * effectivePageSize;
  const displayedMachineGroups = useMemo(() => {
    if (pageSize === 0) return machineGroups;
    return machineGroups.slice(startIndex, startIndex + effectivePageSize);
  }, [machineGroups, pageSize, startIndex, effectivePageSize]);

  const allDisplayedExpanded = useMemo(() => {
    if (displayedMachineGroups.length === 0) return false;
    return displayedMachineGroups.every((g) => expandedMachines.has(g.id));
  }, [displayedMachineGroups, expandedMachines]);

  const toggleAllDisplayed = useCallback(() => {
    if (allDisplayedExpanded) {
      collapseAll();
    } else {
      expandAll();
    }
  }, [allDisplayedExpanded, collapseAll, expandAll]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

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

  // CSV Export for Excel
  const handleExportExcel = () => {
    try {
      const dayHeaders = monthDays.map((d) => `J${d.dayNumber} (${d.dayNameShort})`);
      const headers = [
        'Code',
        'Machine ID',
        'Nom Machine',
        'Zone',
        'Organe / Composant',
        'Action Code',
        'Action Libellé',
        'Périodicité',
        'Technicien',
        'Statut',
        ...dayHeaders,
      ];

      const allExportTasks = machineGroups.flatMap((g) => g.tasks);
      const rows = allExportTasks.map((t) => {
        const dayCells = monthDays.map((d) => {
          const act = getTaskActionForDay(t, d);
          return act ? act.code : '';
        });

        return [
          t.code || '',
          t.id_machine || '',
          t.nom_machine || '',
          t.id_zone || '',
          t.composant || '',
          t.action_code || 'C',
          t.action_libelle || '',
          t.frequence || '',
          t.responsable || '',
          t.etat || 'À faire',
          ...dayCells,
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
      link.setAttribute(
        'download',
        `Planning_Preventif_Mensuel_${MONTH_NAMES[selectedMonth]}_${selectedYear}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      Logger.error('Export error in MonthlyDayMatrixView:', e);
    }
  };

  return (
    <div className="space-y-4 animate-view-transition">
      {/* MAIN TABLE CARD (Unified Excel Light UI with Sticky Header, Month Controls & Zebra Rows) */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
        {/* Table Controls Sub-Header: Clean, Unified & Balanced */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/50 gap-3">
          {/* Left: Title + Machine/Task Count Badge + Expand/Collapse All Button */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-cyan-600" />
              <span className="font-bold text-slate-800 text-[13px]">
                Planning Préventif Mensuel (J1 → J{monthDays.length})
              </span>
            </div>

            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-cyan-50 text-cyan-800 border border-cyan-200">
              {totalMachines} Machine{totalMachines > 1 ? 's' : ''} ({totalTasks} Tâche{totalTasks > 1 ? 's' : ''})
            </span>

            {/* Expand / Collapse All Toggle Button */}
            <button
              type="button"
              onClick={toggleAllDisplayed}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title={allDisplayedExpanded ? 'Tout replier en 1 ligne par machine' : 'Tout déplier pour voir toutes les tâches'}
            >
              {allDisplayedExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tout replier</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Tout déplier</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Unified Month/Year Controller + Export + View Switcher */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Unified Month & Year Navigator */}
            <div className="inline-flex items-center bg-white rounded-xl border border-slate-200 shadow-2xs p-0.5 gap-1">
              {/* Prev Month Button */}
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title="Mois précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Month Dropdown */}
              <div className="flex items-center gap-1 pl-1">
                <CalendarIcon className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="h-7 px-1.5 rounded-lg bg-transparent text-xs font-bold text-slate-800 cursor-pointer focus:outline-none hover:bg-slate-50 transition"
                  title="Sélectionner le mois"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Year Dropdown */}
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-7 px-1.5 rounded-lg bg-transparent text-xs font-semibold text-slate-600 cursor-pointer focus:outline-none hover:bg-slate-50 transition border-l border-slate-200 pl-2"
                title="Sélectionner l'année"
              >
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>

              {/* Next Month Button */}
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                title="Mois suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* Today Quick Reset */}
              <button
                type="button"
                onClick={handleCurrentMonth}
                className="h-7 px-2 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-800 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer border border-cyan-200/80 ml-0.5"
                title="Revenir au mois courant"
              >
                <RotateCcw className="w-3 h-3 text-cyan-600" />
                <span>Auj.</span>
              </button>
            </div>

            {/* Export Excel Button */}
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-8 px-3 rounded-xl border border-emerald-300/90 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
              title="Exporter le planning mensuel au format Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
              <span>Export Excel</span>
            </button>

            {/* View Switcher */}
            <div className="pl-1 border-l border-slate-200">
              <ViewSwitchButtonGroup
                currentView="monthly_grid"
                onSwitchView={onSwitchView}
              />
            </div>
          </div>
        </div>

        <div className="max-h-[62vh] overflow-y-auto overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1280px]">
            <thead className="sticky top-0 bg-slate-100 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200 z-10 shadow-2xs select-none">
              <tr>
                {/* Row N° Column Header */}
                <th className="py-3 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/60 border-r border-slate-200 shrink-0 sticky left-0 z-20">
                  N°
                </th>

                {/* Machine Column Header */}
                <th
                  onClick={() => handleSort('nom_machine')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group border-r border-slate-200 min-w-[180px]"
                  title="Cliquer pour trier par Machine"
                >
                  <div className="flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>MACHINE</span>
                    {renderSortIcon('nom_machine')}
                  </div>
                </th>

                {/* Organe Column Header */}
                <th
                  onClick={() => handleSort('composant')}
                  className="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-200/80 transition group border-r border-slate-200 min-w-[160px]"
                  title="Cliquer pour trier par Organe"
                >
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>ORGANE / COMPOSANT</span>
                    {renderSortIcon('composant')}
                  </div>
                </th>

                {/* Action Column Header */}
                <th
                  onClick={() => handleSort('action_code')}
                  className="py-3 px-2.5 cursor-pointer select-none hover:bg-slate-200/80 transition group border-r border-slate-200 min-w-[110px]"
                  title="Cliquer pour trier par Action"
                >
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>ACTION</span>
                    {renderSortIcon('action_code')}
                  </div>
                </th>

                {/* Périodicité Header */}
                <th
                  onClick={() => handleSort('frequence')}
                  className="py-3 px-2.5 cursor-pointer select-none hover:bg-slate-200/80 transition group border-r border-slate-200 min-w-[90px]"
                  title="Cliquer pour trier par Périodicité"
                >
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>FRÉQ.</span>
                    {renderSortIcon('frequence')}
                  </div>
                </th>

                {/* Technicien Header */}
                <th
                  onClick={() => handleSort('responsable')}
                  className="py-3 px-2.5 cursor-pointer select-none hover:bg-slate-200/80 transition group border-r border-slate-200 min-w-[110px]"
                  title="Cliquer pour trier par Technicien"
                >
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>TECH.</span>
                    {renderSortIcon('responsable')}
                  </div>
                </th>

                {/* Statut Header */}
                <th
                  onClick={() => handleSort('etat')}
                  className="py-3 px-2.5 text-center cursor-pointer select-none hover:bg-slate-200/80 transition group border-r border-slate-200 min-w-[85px]"
                  title="Cliquer pour trier par Statut"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>STATUT</span>
                    {renderSortIcon('etat')}
                  </div>
                </th>

                {/* OT Actions Column */}
                <th className="py-3 px-2 text-center border-r-2 border-slate-300 min-w-[90px]">
                  <span>OT</span>
                </th>

                {/* Day Columns Header (1 to 28/29/30/31) */}
                {monthDays.map((day) => (
                  <th
                    key={day.dayNumber}
                    className={`py-2 px-1 text-center min-w-[34px] max-w-[38px] border-r border-slate-200 font-mono transition-colors ${
                      day.isToday
                        ? 'bg-cyan-600 text-white font-black ring-1 ring-cyan-400'
                        : day.isWeekend
                        ? 'bg-slate-200/70 text-slate-600'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex flex-col items-center leading-none">
                      <span className="text-[9px] uppercase font-bold opacity-80">
                        {day.dayNameShort}
                      </span>
                      <span className="text-xs font-black mt-0.5">{day.dayNumber}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-200/80">
              {displayedMachineGroups.length === 0 ? (
                <tr>
                  <td
                    colSpan={8 + monthDays.length}
                    className="py-12 text-center text-slate-400 bg-slate-50/50"
                  >
                    <div className="max-w-md mx-auto space-y-2">
                      <CalendarRange className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="font-bold text-slate-700 text-sm">
                        Aucune machine correspondante
                      </p>
                      <p className="text-xs text-slate-400">
                        Ajustez vos filtres ou sélectionnez un autre mois.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-bold shadow-2xs hover:bg-cyan-700 transition cursor-pointer"
                        >
                          Effacer les filtres
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedMachineGroups.map((group, groupIdx) => {
                  const groupRowNum = startIndex + groupIdx + 1;
                  const isExpanded = expandedMachines.has(group.id);

                  return (
                    <Fragment key={`group-${group.id}`}>
                      {/* Main Machine Accordion Row (1 row per machine when collapsed) */}
                      <tr
                        onClick={() => toggleMachine(group.id)}
                        className={`cursor-pointer transition-all duration-150 select-none ${
                          isExpanded
                            ? 'bg-cyan-50/70 hover:bg-cyan-100/60 border-l-4 border-l-cyan-600 shadow-2xs'
                            : 'even:bg-slate-50/60 odd:bg-white hover:bg-slate-100/70 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Machine Row N° */}
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-500 bg-slate-100/50 border-r border-slate-200 shrink-0 sticky left-0 z-10">
                          {groupRowNum}
                        </td>

                        {/* Machine Column: Chevron + ID + Nom Machine + Tasks Count */}
                        <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMachine(group.id);
                              }}
                              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-cyan-700 hover:bg-cyan-100/80 transition cursor-pointer shrink-0"
                              title={isExpanded ? 'Replier cette machine' : 'Déplier les tâches de cette machine'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-cyan-700" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-cyan-950 font-black shrink-0">
                              {group.id_machine}
                            </span>

                            <span className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                              {group.nom_machine}
                            </span>

                            <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-100/80 text-cyan-900 border border-cyan-200 shrink-0">
                              {group.tasks.length} tâche{group.tasks.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>

                        {/* Organe / Composant Summary */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-xs">
                          {group.tasks.length === 1 ? (
                            <span className="text-slate-800 font-semibold truncate max-w-[140px] block">
                              {group.tasks[0].composant || 'Général'}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">
                              {group.tasks.length} composants associés
                            </span>
                          )}
                        </td>

                        {/* Action Code Summary Badges */}
                        <td className="py-2 px-2 border-r border-slate-200">
                          <div className="flex items-center gap-1 flex-wrap">
                            {Array.from(
                              new Set(
                                group.tasks.map((t) =>
                                  (t.action_code || 'C').toUpperCase()
                                )
                              )
                            )
                              .slice(0, 3)
                              .map((code) => {
                                const pDef =
                                  ACTION_PILL_MAP[code] || ACTION_PILL_MAP.C;
                                return (
                                  <span
                                    key={code}
                                    className={`w-5 h-5 rounded flex items-center justify-center font-mono font-black text-[10px] border ${pDef.bg}`}
                                    title={pDef.label}
                                  >
                                    {code}
                                  </span>
                                );
                              })}
                            {new Set(
                              group.tasks.map((t) => t.action_code || 'C')
                            ).size > 3 && (
                              <span className="text-[10px] text-slate-400 font-bold">
                                ...
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Périodicité Summary */}
                        <td className="py-2.5 px-2 border-r border-slate-200 font-mono text-[10.5px] text-slate-600">
                          {group.tasks.length === 1 ? (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-[10px]">
                              {group.tasks[0].frequence || 'Mensuel'}
                            </span>
                          ) : (
                            <span className="text-slate-400">Multiple</span>
                          )}
                        </td>

                        {/* Technicien Summary */}
                        <td className="py-2.5 px-2 border-r border-slate-200 text-xs text-slate-700">
                          {group.tasks.length === 1 ? (
                            <span className="truncate max-w-[90px] block font-semibold">
                              {group.tasks[0].responsable || 'Non assigné'}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Équipe</span>
                          )}
                        </td>

                        {/* Statut Summary */}
                        <td className="py-2 px-2 text-center border-r border-slate-200">
                          {(() => {
                            const lateCount = group.tasks.filter(
                              (t) => t.etat === 'En retard'
                            ).length;
                            const doneCount = group.tasks.filter(
                              (t) => t.etat === 'Fait'
                            ).length;
                            if (lateCount > 0) {
                              return (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  {lateCount} retard{lateCount > 1 ? 's' : ''}
                                </span>
                              );
                            }
                            if (doneCount === group.tasks.length) {
                              return (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Terminé
                                </span>
                              );
                            }
                            return (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {doneCount}/{group.tasks.length} fait
                              </span>
                            );
                          })()}
                        </td>

                        {/* Details / Collapse Button */}
                        <td className="py-1.5 px-1.5 text-center border-r-2 border-slate-300">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMachine(group.id);
                            }}
                            className="text-[11px] font-bold text-cyan-700 hover:text-cyan-900 transition hover:underline cursor-pointer"
                          >
                            {isExpanded ? 'Réduire' : 'Détails'}
                          </button>
                        </td>

                        {/* Day Columns Cells for Machine Group (1 to 31) */}
                        {monthDays.map((day) => {
                          const dayActions = group.tasks
                            .map((t) => ({
                              task: t,
                              act: getTaskActionForDay(t, day),
                            }))
                            .filter((item) => item.act && item.act.hasAction);

                          const hasAny = dayActions.length > 0;
                          const allDone =
                            hasAny && dayActions.every((item) => item.act.isDone);
                          const hasLate =
                            hasAny &&
                            dayActions.some((item) => item.act.isOverdue);

                          return (
                            <td
                              key={day.dayNumber}
                              className={`py-1 px-0.5 text-center min-w-[34px] max-w-[38px] border-r border-slate-200 transition-colors ${
                                day.isToday
                                  ? 'bg-cyan-50/60 font-bold'
                                  : day.isWeekend
                                  ? 'bg-slate-100/50'
                                  : ''
                              }`}
                              onClick={(e) => {
                                if (hasAny && !isExpanded) {
                                  e.stopPropagation();
                                  toggleMachine(group.id);
                                }
                              }}
                            >
                              {hasAny ? (
                                dayActions.length === 1 ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenValidate(dayActions[0].task);
                                    }}
                                    className={`w-6 h-6 mx-auto rounded-md flex items-center justify-center text-[11px] font-mono font-black border transition-all cursor-pointer shadow-2xs hover:scale-110 active:scale-95 ${
                                      dayActions[0].act.isDone
                                        ? 'bg-emerald-600 text-white border-emerald-700'
                                        : dayActions[0].act.isOverdue
                                        ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                        : (
                                            ACTION_PILL_MAP[
                                              dayActions[0].act.code
                                            ] || ACTION_PILL_MAP.C
                                          ).bg
                                    }`}
                                    title={`J${day.dayNumber}: [${dayActions[0].act.code}] ${group.nom_machine} (${dayActions[0].task.composant || 'Général'}). Cliquer pour valider.`}
                                  >
                                    {dayActions[0].act.isDone ? (
                                      <Check className="w-3 h-3" />
                                    ) : (
                                      dayActions[0].act.code
                                    )}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMachine(group.id);
                                    }}
                                    className={`w-6 h-6 mx-auto rounded-md flex items-center justify-center text-[10.5px] font-mono font-black border transition-all cursor-pointer shadow-2xs hover:scale-110 active:scale-95 ${
                                      allDone
                                        ? 'bg-emerald-600 text-white border-emerald-700'
                                        : hasLate
                                        ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                        : 'bg-cyan-700 text-white border-cyan-800'
                                    }`}
                                    title={`J${day.dayNumber}: ${dayActions.length} actions prévues sur cette machine. Cliquer pour afficher les détails.`}
                                  >
                                    {allDone ? (
                                      <Check className="w-3 h-3" />
                                    ) : (
                                      dayActions.length
                                    )}
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-300 text-[10px] select-none">
                                  ·
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Expanded Sub-Rows: Detailed Task Lines for this Machine */}
                      {isExpanded &&
                        group.tasks.map((task, taskIdx) => {
                          const actionCode = (
                            task.action_code || 'C'
                          ).toUpperCase();
                          const actionDef =
                            ACTION_PILL_MAP[actionCode] || ACTION_PILL_MAP.C;
                          const statutClass =
                            STATUT_BADGES[task.etat] ||
                            'bg-slate-100 text-slate-700 border-slate-200';

                          return (
                            <tr
                              key={
                                task.id ||
                                task.code ||
                                `task-sub-${group.id}-${taskIdx}`
                              }
                              className="bg-slate-50/70 hover:bg-cyan-50/40 border-b border-slate-200/70 transition-colors"
                            >
                              {/* Sub-row N° */}
                              <td className="py-2 px-3 text-center font-mono text-[10px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0 sticky left-0 z-10">
                                <span className="text-slate-500">
                                  {groupRowNum}.{taskIdx + 1}
                                </span>
                              </td>

                              {/* Machine Column: Indented Connector */}
                              <td className="py-2 px-3.5 border-r border-slate-200/80 whitespace-nowrap pl-6">
                                <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                                  <span className="text-cyan-600 font-bold">
                                    └─
                                  </span>
                                  <span className="text-[11px] text-slate-600 font-medium truncate max-w-[130px]">
                                    Tâche {taskIdx + 1}/{group.tasks.length}
                                  </span>
                                </div>
                              </td>

                              {/* Organe / Composant */}
                              <td className="py-2 px-3.5 border-r border-slate-200/80 font-semibold text-slate-800 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-900 truncate max-w-[140px]">
                                    {task.composant || 'Général'}
                                  </span>
                                  {task.code && (
                                    <span className="text-[10px] font-mono text-slate-400">
                                      ({task.code})
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Action */}
                              <td className="py-2 px-2.5 border-r border-slate-200/80">
                                <div
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-bold ${actionDef.bg}`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${actionDef.dot}`}
                                  />
                                  <span className="font-mono font-black">
                                    {actionCode}
                                  </span>
                                  <span className="text-[10.5px] truncate max-w-[65px]">
                                    {task.action_libelle || actionDef.label}
                                  </span>
                                </div>
                              </td>

                              {/* Périodicité */}
                              <td className="py-2 px-2.5 border-r border-slate-200/80 font-mono text-[11px] text-slate-700">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-[10.5px]">
                                  {task.frequence || 'Mensuel'}
                                </span>
                              </td>

                              {/* Technicien */}
                              <td className="py-2 px-2.5 border-r border-slate-200/80 text-xs text-slate-700 font-semibold">
                                <span className="truncate max-w-[100px] block">
                                  {task.responsable || 'Non assigné'}
                                </span>
                              </td>

                              {/* Statut */}
                              <td className="py-1.5 px-2 text-center border-r border-slate-200/80">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${statutClass}`}
                                >
                                  {task.etat || 'À faire'}
                                </span>
                              </td>

                              {/* OT Action Buttons */}
                              <td className="py-1.5 px-1.5 text-center border-r-2 border-slate-300">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenValidate(task)}
                                    className="w-6 h-6 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-600 hover:text-white flex items-center justify-center transition cursor-pointer shadow-2xs"
                                    title="Valider intervention & Déstocker PDR"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenCorrective(task)}
                                    className="w-6 h-6 rounded-md bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-600 hover:text-white flex items-center justify-center transition cursor-pointer shadow-2xs"
                                    title="Créer Bon de Travail correctif"
                                  >
                                    <Wrench className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenPrint(task)}
                                    className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-800 hover:text-white flex items-center justify-center transition cursor-pointer shadow-2xs"
                                    title="Imprimer Bon de Travail"
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>

                              {/* Day Columns Cells (1 to 31) */}
                              {monthDays.map((day) => {
                                const act = getTaskActionForDay(task, day);

                                return (
                                  <td
                                    key={day.dayNumber}
                                    className={`py-1 px-0.5 text-center min-w-[34px] max-w-[38px] border-r border-slate-200/80 transition-colors ${
                                      day.isToday
                                        ? 'bg-cyan-50/60 font-bold'
                                        : day.isWeekend
                                        ? 'bg-slate-100/50'
                                        : ''
                                    }`}
                                  >
                                    {act && act.hasAction ? (
                                      <button
                                        type="button"
                                        onClick={() => onOpenValidate(task)}
                                        className={`w-6 h-6 mx-auto rounded-md flex items-center justify-center text-[11px] font-mono font-black border transition-all cursor-pointer shadow-2xs hover:scale-110 active:scale-95 ${
                                          act.isDone
                                            ? 'bg-emerald-600 text-white border-emerald-700'
                                            : act.isOverdue
                                            ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                                            : actionDef.bg
                                        }`}
                                        title={`Jour ${day.dayNumber} ${MONTH_NAMES[selectedMonth]}: Action [${act.code}] - ${task.nom_machine} (${task.composant || 'Général'}). Cliquer pour valider.`}
                                      >
                                        {act.isDone ? (
                                          <Check className="w-3 h-3" />
                                        ) : (
                                          act.code
                                        )}
                                      </button>
                                    ) : (
                                      <span className="text-slate-300 text-[10px] select-none">
                                        ·
                                      </span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </tbody>

            {/* Summary Footer Row */}
            <tfoot className="bg-slate-100 font-mono font-bold text-slate-700 border-t-2 border-slate-300">
              <tr>
                <td
                  colSpan={8}
                  className="py-2.5 px-3 text-right uppercase tracking-wider text-[11px] text-slate-800 border-r-2 border-slate-300"
                >
                  Total Actions / Jour :
                </td>
                {monthDays.map((day) => {
                  let count = 0;
                  tasks.forEach((t) => {
                    const act = getTaskActionForDay(t, day);
                    if (act && act.hasAction) count++;
                  });

                  return (
                    <td
                      key={day.dayNumber}
                      className={`py-2 px-1 text-center text-xs font-black border-r border-slate-200 ${
                        count > 0
                          ? 'text-cyan-900 bg-cyan-100 font-mono'
                          : 'text-slate-400'
                      }`}
                    >
                      {count > 0 ? count : '0'}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 4. PAGINATION FOOTER (Machine Groups Standard) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">
            Machines par page :
          </span>
          <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
            {[20, 50, 100, 200, 0].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  pageSize === size
                    ? 'bg-white text-cyan-900 shadow-xs border border-slate-200/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
              >
                {size === 0 ? 'Tout' : size}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-xs font-semibold text-slate-500">
            Affichage <b className="text-slate-900">{totalMachines === 0 ? 0 : startIndex + 1}</b> à{' '}
            <b className="text-slate-900">
              {Math.min(startIndex + effectivePageSize, totalMachines)}
            </b>{' '}
            sur <b className="text-slate-900">{totalMachines}</b> machines{' '}
            <span className="text-slate-400">({totalTasks} tâches au total)</span>
          </div>

          {pageSize !== 0 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 3 + i;
                    if (pageNum + (4 - i) > totalPages) {
                      pageNum = totalPages - 4 + i;
                    }
                  }
                  if (pageNum < 1 || pageNum > totalPages) return null;

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-cyan-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                <span>Suivant</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
