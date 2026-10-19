import { useState, useMemo, useRef, useCallback, Fragment } from 'react';
import {
  Calendar,
  Layers,
  Wrench,
  Clock,
  User,
  Activity,
  Printer,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Grid,
} from 'lucide-react';
import ViewSwitchButtonGroup from './ViewSwitchButtonGroup';
import TablePaginationCard from '../../../components/common/TablePaginationCard';
import { useI18n } from '../../../../i18n/I18nContext';

const ACTION_PILL_MAP = {
  C: { bg: 'bg-blue-500/10 text-blue-800 border-blue-200/80', dot: 'bg-blue-600', label: 'Contrôle' },
  N: { bg: 'bg-emerald-500/10 text-emerald-800 border-emerald-200/80', dot: 'bg-emerald-600', label: 'Nettoyage' },
  G: { bg: 'bg-amber-500/10 text-amber-800 border-amber-200/80', dot: 'bg-amber-600', label: 'Graissage' },
  V: { bg: 'bg-indigo-500/10 text-indigo-800 border-indigo-200/80', dot: 'bg-indigo-600', label: 'Vidange' },
  R: { bg: 'bg-purple-500/10 text-purple-800 border-purple-200/80', dot: 'bg-purple-600', label: 'Réglage' },
  S: { bg: 'bg-rose-500/10 text-rose-800 border-rose-200/80', dot: 'bg-rose-600', label: 'Sécurité' },
  L: { bg: 'bg-cyan-500/10 text-cyan-800 border-cyan-200/80', dot: 'bg-cyan-600', label: 'Lubrification' },
};

const STATUT_BADGES = {
  'À faire': 'bg-blue-50 text-blue-700 border-blue-200 shadow-2xs',
  'Fait': 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs',
  'En retard': 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs animate-pulse',
};

/**
 * MatrixWeeksView - Dedicated Component for 52-Week Preventive Matrix (Vue Matrice 52 Semaines)
 * Follows the Collapsible Parent-Grouped Table/Matrix Pattern (Excel Light Accordion Standard)
 */
export default function MatrixWeeksView({
  tasks = [],
  machines = [],
  weekRange = 'ALL',
  onWeekRangeChange = () => {},
  currentWeekNumber = 1,
  onOpenValidate = () => {},
  onOpenPrint = () => {},
  onSwitchView = () => {},
  hasActiveFilters = false,
  clearAllFilters = () => {},
}) {
  const { t } = useI18n();
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedMachines, setExpandedMachines] = useState(() => new Set());
  const matrixScrollContainerRef = useRef(null);

  // Machine lookup map for Strict Relational Engine (Single Source of Truth)
  const machineMap = useMemo(() => {
    const map = new Map();
    (machines || []).forEach((m) => {
      const code = String(m.code_machine || m.id_machine_registered || m.id || '').trim().toUpperCase();
      if (code) map.set(code, m);
    });
    return map;
  }, [machines]);

  // Weeks list based on current week range selection
  const matrixWeeks = useMemo(() => {
    if (weekRange === 'S1-S16') return Array.from({ length: 16 }, (_, i) => `S${i + 1}`);
    if (weekRange === 'S17-S32') return Array.from({ length: 16 }, (_, i) => `S${i + 17}`);
    if (weekRange === 'S33-S52') return Array.from({ length: 20 }, (_, i) => `S${i + 33}`);
    return Array.from({ length: 52 }, (_, i) => `S${i + 1}`);
  }, [weekRange]);

  // Group tasks by Machine with dynamic relational resolution
  const machineGroups = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      const machineKey = task.id_machine || task.nom_machine || 'AUTRE';
      if (!map.has(machineKey)) {
        const registeredMach = machineMap.get(String(machineKey).trim().toUpperCase());
        const resolvedName = registeredMach?.nom || registeredMach?.designation || task.nom_machine || machineKey;
        const resolvedZone = registeredMach?.id_zone || registeredMach?.zone || task.id_zone || task.zone || '';

        map.set(machineKey, {
          id: machineKey,
          id_machine: task.id_machine || machineKey,
          nom_machine: resolvedName,
          id_zone: resolvedZone,
          machineEntity: registeredMach,
          tasks: [],
        });
      }
      map.get(machineKey).tasks.push(task);
    });

    const groups = Array.from(map.values());

    // Sort machine groups alphabetically by nom_machine / id_machine
    groups.sort((a, b) => {
      const nameA = (a.nom_machine || a.id_machine || '').toLowerCase();
      const nameB = (b.nom_machine || b.id_machine || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return groups;
  }, [tasks, machineMap]);

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

  // Pagination calculations based on Machine Groups (20 machines per page)
  const totalMachines = machineGroups.length;
  const totalTasks = tasks.length;
  const effectivePageSize = pageSize === 0 ? totalMachines : pageSize;
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


  return (
    <div className="space-y-4 animate-view-transition">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
        {/* Table Controls Sub-Header with Week Range Quick Buttons & Switch to List */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/50 gap-3">
          {/* Left Title & Status Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Grid className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-slate-800 text-[13px]">
                {t('preventive.table.matrix_afnor_title', 'Matrice Hebdomadaire AFNOR (52 Semaines)')}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
              {totalMachines} {t('common.machine', 'Machine')}{totalMachines > 1 ? 's' : ''} ({totalTasks} {t('preventive.table.tasks_count', '{{count}} tâches', { count: totalTasks })})
            </span>
            {currentWeekNumber && (
              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                {t('preventive.table.current_week', 'Semaine courante : {{week}}', { week: `S${currentWeekNumber}` })}
              </span>
            )}

            {/* Quick Batch Toggle Button (Déplier / Replier Tout) */}
            <button
              type="button"
              onClick={toggleAllDisplayed}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
              title={allDisplayedExpanded ? t('preventive.table.collapse_all', 'Tout replier') : t('preventive.table.expand_all', 'Tout déplier')}
            >
              {allDisplayedExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t('preventive.table.collapse_all', 'Tout replier')}</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{t('preventive.table.expand_all', 'Tout déplier')}</span>
                </>
              )}
            </button>
          </div>

          {/* Right: Week Range Selector + 3D Circular Switch Button */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-600 mr-1 hidden sm:inline">{t('preventive.table.range', 'Plage :')}</span>
              <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 shadow-2xs">
                {[
                  { label: t('preventive.table.range_all', 'Tous (S1-S52)'), val: 'ALL' },
                  { label: 'S1-S16', val: 'S1-S16' },
                  { label: 'S17-S32', val: 'S17-S32' },
                  { label: 'S33-S52', val: 'S33-S52' },
                ].map((tab) => (
                  <button
                    key={tab.val}
                    type="button"
                    onClick={() => onWeekRangeChange(tab.val)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      weekRange === tab.val
                        ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/50'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D Circular Switch Buttons on the RIGHT */}
            <ViewSwitchButtonGroup
              currentView="matrix"
              onSwitchView={onSwitchView}
            />
          </div>
        </div>

        {/* Matrix Table with Horizontal Scroll */}
        <div ref={matrixScrollContainerRef} className="overflow-x-auto max-h-[62vh] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 z-20 shadow-2xs select-none">
              <tr>
                {/* Row Index */}
                <th className="py-3 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/70 border-r border-slate-200 sticky left-0 z-30">
                  {t('preventive.table.col_num', 'N°')}
                </th>

                {/* Machine (A) */}
                <th className="py-3 px-3.5 min-w-[170px] sticky left-12 z-30 bg-slate-100 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                  <span>{t('preventive.table.col_machine', 'MACHINE (A)')}</span>
                </th>

                {/* Zone (B) */}
                <th className="py-3 px-3 min-w-[70px] border-r border-slate-200">
                  <span>{t('preventive.table.col_zone', 'ZONE (B)')}</span>
                </th>

                {/* Composant (C) */}
                <th className="py-3 px-3.5 min-w-[170px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_composant', 'COMPOSANT (C)')}</span>
                  </div>
                </th>

                {/* Action (D) */}
                <th className="py-3 px-3 min-w-[85px] text-center border-r border-slate-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_action', 'ACTION (D)')}</span>
                  </div>
                </th>

                {/* Fréquence (E) */}
                <th className="py-3 px-3 min-w-[85px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_frequence', 'FRÉQ. (E)')}</span>
                  </div>
                </th>

                {/* S1-S52 Matrix Columns (F) */}
                {matrixWeeks.map((week) => {
                  const isCurrent = week === `S${currentWeekNumber}`;
                  return (
                    <th
                      key={week}
                      className={`py-2 px-1 text-center font-mono text-[11px] min-w-[36px] border-r border-slate-200/80 transition-colors ${
                        isCurrent ? 'bg-indigo-600 text-white font-black' : 'bg-slate-100 text-slate-700'
                      }`}
                      title={isCurrent ? `Semaine en cours (${week})` : `Semaine ${week}`}
                    >
                      {week}
                    </th>
                  );
                })}

                {/* Responsable (G) */}
                <th className="py-3 px-3 min-w-[110px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_responsable', 'RESP. (G)')}</span>
                  </div>
                </th>

                {/* Statut (H) */}
                <th className="py-3 px-3 min-w-[95px] text-center border-r border-slate-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_statut', 'STATUT (H)')}</span>
                  </div>
                </th>

                {/* Actions Menu */}
                <th className="py-3 px-3.5 text-center min-w-[100px] font-bold text-slate-400 tracking-widest select-none" title={t('preventive.table.col_actions', 'ACTIONS')}>
                  •••
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {displayedMachineGroups.length === 0 ? (
                <tr>
                  <td colSpan={matrixWeeks.length + 9} className="p-12 text-center text-slate-400 text-xs">
                    <div className="max-w-md mx-auto space-y-2">
                      <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600">{t('preventive.table.empty_tasks', 'Aucune machine trouvée')}</p>
                      <p className="text-[11px] text-slate-400">
                        {t('preventive.table.empty_tasks_sub', 'Ajustez vos critères de recherche ou vos filtres.')}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={clearAllFilters}
                          className="mt-2 px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 cursor-pointer"
                        >
                          {t('preventive.table.reset_filters', 'Réinitialiser les filtres')}
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
                    <Fragment key={`mat-group-${group.id}`}>
                      {/* Machine Accordion Summary Row */}
                      <tr
                        onClick={() => toggleMachine(group.id)}
                        className={`cursor-pointer transition-all duration-150 select-none ${
                          isExpanded
                            ? 'bg-indigo-50/70 hover:bg-indigo-100/60 border-l-4 border-l-indigo-600 shadow-2xs'
                            : 'even:bg-slate-50/60 odd:bg-white hover:bg-slate-100/70 border-l-4 border-l-transparent'
                        }`}
                      >
                        {/* Machine Row N° */}
                        <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-500 bg-slate-100/50 border-r border-slate-200 shrink-0 sticky left-0 z-10">
                          {groupRowNum}
                        </td>

                        {/* Machine Column: Chevron + ID + Nom Machine + Tasks Count */}
                        <td className="py-2.5 px-3 border-r border-slate-200 whitespace-nowrap sticky left-12 z-10 bg-inherit shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMachine(group.id);
                              }}
                              className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-indigo-700 hover:bg-indigo-100/80 transition cursor-pointer shrink-0"
                              title={isExpanded ? 'Replier cette machine' : 'Déplier les tâches de cette machine'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-indigo-700" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-indigo-950 font-black shrink-0">
                              {group.id_machine}
                            </span>

                            <span className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                              {group.nom_machine}
                            </span>

                            <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-100/80 text-indigo-900 border border-indigo-200 shrink-0">
                              {group.tasks.length} tâche{group.tasks.length > 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>

                        {/* Zone */}
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px]">
                            {group.id_zone || group.tasks[0]?.id_zone || 'AFM'}
                          </span>
                        </td>

                        {/* Composant Summary */}
                        <td className="py-2.5 px-3.5 border-r border-slate-200 text-xs">
                          {group.tasks.length === 1 ? (
                            <span className="text-slate-800 font-semibold truncate max-w-[160px] block">
                              {group.tasks[0].composant || 'Général'}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[11px]">
                              {group.tasks.length} composants associés
                            </span>
                          )}
                        </td>

                        {/* Action Badges Summary */}
                        <td className="py-2 px-2 text-center border-r border-slate-200">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {Array.from(new Set(group.tasks.map((t) => (t.action_code || 'C').toUpperCase())))
                              .slice(0, 3)
                              .map((code) => {
                                const pDef = ACTION_PILL_MAP[code] || ACTION_PILL_MAP.C;
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
                            {new Set(group.tasks.map((t) => t.action_code || 'C')).size > 3 && (
                              <span className="text-[10px] text-slate-400 font-bold">...</span>
                            )}
                          </div>
                        </td>

                        {/* Fréquence Summary */}
                        <td className="py-2.5 px-3 text-slate-600 border-r border-slate-200 whitespace-nowrap">
                          {group.tasks.length === 1 ? (
                            <span className="font-bold text-slate-700 block text-xs">{group.tasks[0].frequence}</span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">Multiple</span>
                          )}
                        </td>

                        {/* Week Cells S1-S52 (Group rollup) */}
                        {matrixWeeks.map((week) => {
                          const weekActions = group.tasks
                            .map((t) => ({
                              task: t,
                              val: t.planning && t.planning[week],
                            }))
                            .filter((item) => Boolean(item.val));

                          const hasAny = weekActions.length > 0;
                          const allDone = hasAny && weekActions.every((item) => item.val === 'DONE');
                          const hasLate = hasAny && weekActions.some((item) => item.task.etat === 'En retard');

                          return (
                            <td
                              key={week}
                              className="p-1 text-center border-r border-slate-200/60 font-mono text-[11px]"
                              onClick={(e) => {
                                if (hasAny && !isExpanded) {
                                  e.stopPropagation();
                                  toggleMachine(group.id);
                                }
                              }}
                            >
                              {hasAny ? (
                                weekActions.length === 1 ? (
                                  weekActions[0].val === 'DONE' ? (
                                    <span
                                      className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] mx-auto shadow-2xs cursor-default"
                                      title={`Réalisée en ${week}`}
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenValidate(weekActions[0].task);
                                      }}
                                      className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10.5px] mx-auto transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xs ${
                                        weekActions[0].task.etat === 'En retard'
                                          ? 'bg-rose-600 text-white animate-pulse shadow-rose-200'
                                          : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-600 hover:text-white border border-indigo-200'
                                      }`}
                                      title={`${weekActions[0].task.action_code} sur ${group.nom_machine} (${weekActions[0].task.composant || 'Général'}) - Cliquer pour valider`}
                                    >
                                      {weekActions[0].val}
                                    </button>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleMachine(group.id);
                                    }}
                                    className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10.5px] mx-auto transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xs ${
                                      allDone
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : hasLate
                                        ? 'bg-rose-600 text-white animate-pulse shadow-rose-200'
                                        : 'bg-indigo-700 text-white shadow-2xs'
                                    }`}
                                    title={`${weekActions.length} actions prévues en ${week}. Cliquer pour déplier les détails.`}
                                  >
                                    {allDone ? '✓' : weekActions.length}
                                  </button>
                                )
                              ) : (
                                <span className="text-slate-300 text-[10px] select-none">•</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Responsable Summary */}
                        <td className="py-2.5 px-3 font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                          {group.tasks.length === 1 ? (
                            <span className="font-semibold text-slate-800 text-xs truncate max-w-[100px] block">
                              {group.tasks[0].responsable || t('common.technician', 'Technicien')}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">{t('preventive.filters.badges.assigned', 'Équipe')}</span>
                          )}
                        </td>

                        {/* Statut Summary */}
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                          {(() => {
                            const lateCount = group.tasks.filter((t) => t.etat === 'En retard').length;
                            const doneCount = group.tasks.filter((t) => t.etat === 'Fait').length;
                            if (lateCount > 0) {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  {lateCount} {t('preventive.table.status.late', 'En retard')}
                                </span>
                              );
                            }
                            if (doneCount === group.tasks.length) {
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {t('preventive.table.status.done', 'Terminé')}
                                </span>
                              );
                            }
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                {doneCount}/{group.tasks.length} {t('preventive.table.status.done', 'fait')}
                              </span>
                            );
                          })()}
                        </td>

                        {/* Details / Collapse Button */}
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleMachine(group.id);
                            }}
                            className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 transition hover:underline cursor-pointer"
                          >
                            {isExpanded ? t('common.close', 'Réduire') : t('common.edit', 'Détails')}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Rows for Tasks of this Machine */}
                      {isExpanded &&
                        group.tasks.map((task, taskIdx) => {
                          const statusBadge = STATUT_BADGES[task.etat] || STATUT_BADGES['À faire'];
                          const localizedStatus = task.etat === 'Fait'
                            ? t('preventive.table.status.done', 'Fait')
                            : task.etat === 'En retard'
                            ? t('preventive.table.status.late', 'En retard')
                            : t('preventive.table.status.todo', 'À faire');

                          const actionConfig = ACTION_PILL_MAP[task.action_code] || {
                            bg: 'bg-slate-100 text-slate-800 border-slate-200',
                            dot: 'bg-slate-500',
                            label: 'Autre',
                          };

                          return (
                            <tr
                              key={task.id || `sub-task-${group.id}-${taskIdx}`}
                              className="bg-slate-50/70 hover:bg-indigo-50/40 border-b border-slate-200/70 transition-colors"
                            >
                              {/* Sub-row N° */}
                              <td className="py-2 px-3 text-center font-mono text-[10px] font-bold text-slate-400 bg-slate-100/40 border-r border-slate-200/80 shrink-0 sticky left-0 z-10">
                                <span className="text-slate-500">
                                  {groupRowNum}.{taskIdx + 1}
                                </span>
                              </td>

                              {/* Machine Column: Indented Connector */}
                              <td className="py-2 px-3.5 border-r border-slate-200/80 whitespace-nowrap pl-6 sticky left-12 z-10 bg-slate-50/70 shadow-[2px_0_5px_rgba(0,0,0,0.04)]">
                                <div className="flex items-center gap-1.5 text-slate-400 font-mono text-xs">
                                  <span className="text-indigo-600 font-bold">└─</span>
                                  <span className="text-[11px] text-slate-600 font-medium truncate max-w-[130px]">
                                    {t('preventive.tabs.list', 'Tâche')} {taskIdx + 1}/{group.tasks.length}
                                  </span>
                                </div>
                              </td>

                              {/* Zone */}
                              <td className="py-2 px-3 font-mono text-slate-500 border-r border-slate-200/80 text-[11px]">
                                {task.id_zone || group.id_zone || 'AFM'}
                              </td>

                              {/* Composant */}
                              <td className="py-2 px-3.5 font-medium text-slate-800 border-r border-slate-200/80">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-800 text-xs">{task.composant}</span>
                                  {task.is_global_machine && (
                                    <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded border border-emerald-200">
                                      Globale
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10.5px] text-slate-400 block truncate max-w-[180px] mt-0.5">
                                  {task.type_intervention}
                                </span>
                              </td>

                              {/* Action Code */}
                              <td className="py-2 px-3 text-center border-r border-slate-200/80 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black font-mono border ${actionConfig.bg}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${actionConfig.dot}`} />
                                  <span>{task.action_code}</span>
                                </span>
                              </td>

                              {/* Fréquence */}
                              <td className="py-2 px-3 text-slate-600 border-r border-slate-200/80 whitespace-nowrap">
                                <span className="font-bold text-slate-700 block text-xs">{task.frequence}</span>
                                <span className={`text-[9.5px] font-mono font-bold uppercase ${
                                  task.mode_calcul_recurrence === 'GLISSANT' ? 'text-indigo-600' : 'text-slate-400'
                                }`}>
                                  {task.mode_calcul_recurrence === 'GLISSANT' ? '⚡ Gliss.' : '📅 Fixe'}
                                </span>
                              </td>

                              {/* Week Cells S1-S52 */}
                              {matrixWeeks.map((week) => {
                                const cellVal = task.planning && task.planning[week];
                                const isDone = cellVal === 'DONE';
                                const hasAction = Boolean(cellVal);

                                return (
                                  <td
                                    key={week}
                                    className="p-1 text-center border-r border-slate-200/60 font-mono text-[11px]"
                                  >
                                    {isDone ? (
                                      <span
                                        className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center font-black text-[11px] mx-auto shadow-2xs cursor-default"
                                        title={`${t('preventive.table.status.done', 'Fait')} (${week})`}
                                      >
                                        ✓
                                      </span>
                                    ) : hasAction ? (
                                      <button
                                        type="button"
                                        onClick={() => onOpenValidate(task)}
                                        className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10.5px] mx-auto transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-2xs ${
                                          task.etat === 'En retard'
                                            ? 'bg-rose-600 text-white animate-pulse shadow-rose-200'
                                            : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-600 hover:text-white border border-indigo-200'
                                        }`}
                                        title={`${task.action_code} (${task.composant}) - ${t('buttons.validate_task', 'Valider')}`}
                                      >
                                        {cellVal}
                                      </button>
                                    ) : (
                                      <span className="text-slate-300 text-[10px] select-none">•</span>
                                    )}
                                  </td>
                                );
                              })}

                              {/* Responsable */}
                              <td className="py-2 px-3 font-medium text-slate-700 border-r border-slate-200/80 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-semibold text-slate-800 text-xs truncate max-w-[100px]">
                                    {task.responsable || t('common.technician', 'Technicien')}
                                  </span>
                                </div>
                              </td>

                              {/* Statut */}
                              <td className="py-2 px-3 text-center border-r border-slate-200/80 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-block ${statusBadge}`}>
                                  {localizedStatus}
                                </span>
                              </td>

                              {/* Actions Quick Menu */}
                              <td className="py-2 px-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onOpenPrint(task)}
                                    className="w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition shadow-2xs cursor-pointer"
                                    title={t('preventive.buttons.print_wo', 'Imprimer OT')}
                                  >
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                  {task.etat !== 'Fait' && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenValidate(task)}
                                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs hover:shadow-xs cursor-pointer active:scale-95"
                                      title={t('preventive.buttons.validate_execution', 'Valider')}
                                    >
                                      {t('common.confirm', 'Valider')}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standardized Table Pagination Footer (Identical to Designation) */}
      <TablePaginationCard
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={totalMachines}
        pageSizeOptions={[25, 50, 100, 200, 0]}
        color="indigo"
        itemLabel="machines"
      />
    </div>
  );
}

