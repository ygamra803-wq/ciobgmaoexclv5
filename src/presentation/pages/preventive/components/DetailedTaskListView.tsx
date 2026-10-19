import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import PropTypes from 'prop-types';
import {
  List,
  Factory,
  Layers,
  Wrench,
  Clock,
  Calendar,
  User,
  DollarSign,
  Printer,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Zap,
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
 * DetailedTaskListView - Dedicated Component for the Operational List View (Vue Tableau Détaillé)
 * Provides 60fps Virtual Scrolling for large task lists (1,000+ items) in BOTH Grouped & Flat modes.
 */
export default function DetailedTaskListView({
  tasks = [],
  machines = [],
  initialPageSize = 20,
  initialGroupByMachine = true,
  onOpenValidate = () => {},
  onOpenCorrective = () => {},
  onOpenPrint = () => {},
  onSwitchView = () => {},
  hasActiveFilters = false,
  clearAllFilters = () => {},
}) {
  const { t } = useI18n();
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [groupByMachine, setGroupByMachine] = useState(initialGroupByMachine);
  const [collapsedMachines, setCollapsedMachines] = useState({});

  // Machine lookup map for Strict Relational Engine (Single Source of Truth)
  const machineMap = useMemo(() => {
    const map = new Map();
    (machines || []).forEach((m) => {
      const code = String(m.code_machine || m.id_machine_registered || m.id || '').trim().toUpperCase();
      if (code) map.set(code, m);
    });
    return map;
  }, [machines]);

  // 1. Sort tasks primarily by machine ID, then by component & action
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const machA = String(a.id_machine || '').toUpperCase();
      const machB = String(b.id_machine || '').toUpperCase();
      const compMach = machA.localeCompare(machB, undefined, { numeric: true });
      if (compMach !== 0) return compMach;

      const compA = String(a.composant || '').toUpperCase();
      const compB = String(b.composant || '').toUpperCase();
      return compA.localeCompare(compB);
    });
  }, [tasks]);

  // Toggle machine collapse in grouped mode
  const toggleMachineCollapse = (machineId) => {
    setCollapsedMachines((prev) => ({
      ...prev,
      [machineId]: !prev[machineId],
    }));
  };

  // Pagination calculations on sorted tasks
  const totalItems = sortedTasks.length;
  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
  const startIndex = (currentPage - 1) * effectivePageSize;

  const rawDisplayedTasks = useMemo(() => {
    if (pageSize === 0) return sortedTasks;
    return sortedTasks.slice(startIndex, startIndex + effectivePageSize);
  }, [sortedTasks, pageSize, startIndex, effectivePageSize]);

  // Group displayed tasks into consecutive machine sections with dynamic relational lookup
  const machineGroups = useMemo(() => {
    const groups = [];
    let currentGroup = null;

    rawDisplayedTasks.forEach((task, index) => {
      const mId = task.id_machine || 'AUTRE';
      if (!currentGroup || currentGroup.id_machine !== mId) {
        const registeredMach = machineMap.get(String(mId).trim().toUpperCase());
        const resolvedName = registeredMach?.nom || registeredMach?.designation || task.nom_machine || mId;
        const resolvedZone = registeredMach?.id_zone || registeredMach?.zone || task.id_zone || task.zone || 'Non définie';

        currentGroup = {
          id_machine: mId,
          nom_machine: resolvedName,
          zone: resolvedZone,
          machineEntity: registeredMach,
          tasks: [],
          startIndex: startIndex + index,
        };
        groups.push(currentGroup);
      }
      currentGroup.tasks.push(task);
    });

    return groups;
  }, [rawDisplayedTasks, startIndex, machineMap]);

  // Unified Flat Row Representation for both Grouped and Continuous display modes
  const flattenedVirtualRows = useMemo(() => {
    if (!groupByMachine) {
      return rawDisplayedTasks.map((tItem, idx) => ({
        type: 'TASK',
        key: tItem.id || `flat-task-${startIndex + idx}`,
        task: tItem,
        rowNumber: startIndex + idx + 1,
        idx,
        estimatedHeight: 52,
      }));
    }

    const rows = [];
    machineGroups.forEach((group) => {
      const isCollapsed = Boolean(collapsedMachines[group.id_machine]);
      const doneCount = group.tasks.filter((t) => t.etat === 'Fait').length;
      const lateCount = group.tasks.filter((t) => t.etat === 'En retard').length;
      const pendingCount = group.tasks.filter((t) => t.etat === 'À faire').length;

      rows.push({
        type: 'GROUP_HEADER',
        key: `group-hdr-${group.id_machine}`,
        group,
        isCollapsed,
        doneCount,
        lateCount,
        pendingCount,
        estimatedHeight: 46,
      });

      if (!isCollapsed) {
        group.tasks.forEach((tItem, idx) => {
          rows.push({
            type: 'GROUP_TASK',
            key: tItem.id || `grp-task-${group.id_machine}-${idx}`,
            task: tItem,
            group,
            rowNumber: group.startIndex + idx + 1,
            idx,
            estimatedHeight: 52,
          });
        });
      }
    });

    return rows;
  }, [groupByMachine, rawDisplayedTasks, machineGroups, collapsedMachines, startIndex]);

  // Virtual Scrolling State & Dynamic Measurement
  const scrollContainerRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(540);
  const averageRowHeight = 52;
  const overscanCount = 8;

  // Active virtual scrolling whenever rows count exceeds threshold (35 items)
  const isVirtualized = flattenedVirtualRows.length > 35;

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !isVirtualized) return;
    const updateHeight = () => {
      if (el.clientHeight > 0) setViewportHeight(el.clientHeight);
    };
    updateHeight();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateHeight);
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, [isVirtualized, flattenedVirtualRows.length]);

  // Reset scroll offset on page or grouping change
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
      setScrollTop(0);
    }
  }, [currentPage, pageSize, groupByMachine]);

  const virtualTaskWindow = useMemo(() => {
    const totalCount = flattenedVirtualRows.length;
    if (!isVirtualized || totalCount === 0) {
      return {
        visibleRows: flattenedVirtualRows,
        startOffsetIndex: 0,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
    }

    const rawStart = Math.floor(scrollTop / averageRowHeight);
    const visibleCount = Math.ceil(viewportHeight / averageRowHeight);
    const startOffsetIndex = Math.max(0, rawStart - overscanCount);
    const endOffsetIndex = Math.min(totalCount, rawStart + visibleCount + overscanCount);

    return {
      visibleRows: flattenedVirtualRows.slice(startOffsetIndex, endOffsetIndex),
      startOffsetIndex,
      topSpacerHeight: startOffsetIndex * averageRowHeight,
      bottomSpacerHeight: Math.max(0, (totalCount - endOffsetIndex) * averageRowHeight),
    };
  }, [isVirtualized, flattenedVirtualRows, scrollTop, viewportHeight, averageRowHeight, overscanCount]);

  const renderTaskCells = (tItem, rowNumber, isGrouped = false) => {
    const actionMeta = ACTION_PILL_MAP[tItem.action_code] || {
      bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      dot: 'bg-indigo-600',
      label: tItem.action_code,
    };
    const localizedStatus =
      tItem.etat === 'Fait'
        ? t('preventive.table.status.done', 'Fait')
        : tItem.etat === 'En retard'
        ? t('preventive.table.status.late', 'En retard')
        : t('preventive.table.status.todo', 'À faire');

    return (
      <Fragment>
        <td className="py-2.5 px-3 text-center font-mono text-[11px] font-bold text-slate-400 border-r border-slate-200/70 select-none">
          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
            #{rowNumber}
          </span>
        </td>

        <td className="py-2.5 px-3.5 border-r border-slate-200/70">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
              <Factory className="w-3 h-3" />
            </div>
            <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-slate-900 block text-xs truncate">
                {tItem.id_machine}
              </span>
              {!isGrouped && (
                <span className="text-[11px] text-slate-500 truncate block">
                  {tItem.nom_machine || tItem.id_machine}
                </span>
              )}
              {tItem._isOrphan && (
                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-0.5 shrink-0">
                  <AlertTriangle className="w-2.5 h-2.5" /> Orphelin
                </span>
              )}
              {!isGrouped && (tItem.id_zone || tItem.zone) && (
                <span className="px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9.5px] font-bold shrink-0 ml-auto">
                  {tItem.id_zone || tItem.zone}
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="py-2.5 px-3.5 border-r border-slate-200/70">
          <div className="flex items-start gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="font-bold text-slate-900 block text-xs">{tItem.composant}</span>
              {tItem.consigne && (
                <span className="text-[11px] text-slate-500 block max-w-xs truncate">{tItem.consigne}</span>
              )}
            </div>
          </div>
        </td>

        <td className="py-2.5 px-3 text-center border-r border-slate-200/70 whitespace-nowrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-bold text-[10.5px] border ${actionMeta.bg}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${actionMeta.dot || 'bg-indigo-600'}`} />
            {tItem.action_code}
          </span>
        </td>

        <td className="py-2.5 px-3 font-semibold text-slate-700 border-r border-slate-200/70 whitespace-nowrap">
          <div className="flex items-center gap-1 text-[11px]">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{tItem.frequence || 'Périodique'}</span>
          </div>
        </td>

        <td className="py-2.5 px-3 font-mono text-slate-700 font-semibold border-r border-slate-200/70 whitespace-nowrap">
          <div className="flex items-center gap-1 text-[11px]">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{tItem.prochaine_echeance || tItem.semaine_cible || 'S1'}</span>
          </div>
        </td>

        <td className="py-2.5 px-3 font-semibold text-slate-800 border-r border-slate-200/70 whitespace-nowrap">
          <div className="flex items-center gap-1 text-[11px]">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{tItem.responsable || t('common.technician', 'Non assigné')}</span>
          </div>
        </td>

        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 border-r border-slate-200/70 whitespace-nowrap">
          {Number(tItem.cout_cumule || 0).toFixed(2)} DT
        </td>

        <td className="py-2.5 px-3 text-center border-r border-slate-200/70 whitespace-nowrap">
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${STATUT_BADGES[tItem.etat] || ''}`}>
            {localizedStatus}
          </span>
        </td>

        <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenPrint(tItem)}
              className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition cursor-pointer"
              title={t('preventive.buttons.print_wo', "Imprimer l'Ordre de Travail (OT)")}
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onOpenCorrective(tItem)}
              className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition cursor-pointer"
              title={t('preventive.buttons.create_corrective_bt', "Déclencher un BT Correctif en cas d'anomalie")}
            >
              BT
            </button>
            <button
              type="button"
              onClick={() => onOpenValidate(tItem)}
              className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer"
            >
              {t('common.confirm', 'Valider')}
            </button>
          </div>
        </td>
      </Fragment>
    );
  };

  return (
    <div className="space-y-4 animate-view-transition">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out">
        {/* Top Info Header Bar with View Controls */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 bg-slate-50/50 gap-3">
          {/* Left Title & Status Badges */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-600" />
              <span className="font-bold text-slate-800 text-[13px]">
                {t('preventive.table.detailed_list_title', 'Tableau Détaillé des Tâches Préventives (Groupé par Machine)')}
              </span>
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
              {totalItems} {t('preventive.table.ordered_tasks_count', '{{count}} tâche(s) ordonnée(s)', { count: totalItems })}
            </span>
            {isVirtualized && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                <Zap className="w-3 h-3 text-emerald-600" />
                <span>Virtual 60fps</span>
              </span>
            )}
          </div>

          {/* Right Controls: Grouping Toggle + 3D Circular Switch Button */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Toggle Grouping Display Mode */}
            <button
              type="button"
              onClick={() => setGroupByMachine((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition border cursor-pointer ${
                groupByMachine
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs hover:bg-indigo-100'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title={t('preventive.table.toggle_grouping', 'Basculer entre la vue groupée par machine et la vue continue')}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
              <span>{groupByMachine ? t('preventive.table.banners_active', 'Bannières Machine Actives') : t('preventive.table.continuous_view', 'Vue Continue')}</span>
            </button>

            {/* 3D Circular Switch Buttons on the RIGHT */}
            <ViewSwitchButtonGroup
              currentView="list"
              onSwitchView={onSwitchView}
            />
          </div>
        </div>

        {/* Detailed Operational Table Viewport */}
        <div
          ref={scrollContainerRef}
          onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
          className="overflow-x-auto max-h-[64vh] overflow-y-auto"
        >
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 z-20 shadow-2xs select-none">
              <tr>
                <th className="py-3 px-3 text-center w-12 text-slate-500 font-mono text-[10px] bg-slate-200/70 border-r border-slate-200">
                  {t('preventive.table.col_num', 'N°')}
                </th>
                <th className="py-3 px-3.5 min-w-[150px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_machine_zone', 'MACHINE & ZONE')}</span>
                  </div>
                </th>
                <th className="py-3 px-3.5 min-w-[180px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_composant_instructions', 'COMPOSANT & INSTRUCTIONS')}</span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[90px] text-center border-r border-slate-200">
                  <div className="flex items-center justify-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_action', 'ACTION')}</span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[85px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_frequence', 'FRÉQ.')}</span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[90px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_echeance', 'ÉCHÉANCE')}</span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[110px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_responsable', 'RESPONSABLE')}</span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[90px] border-r border-slate-200">
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{t('preventive.table.col_cout', 'COÛT (DT)')}</span>
                  </div>
                </th>
                <th className="py-3 px-3 min-w-[90px] text-center border-r border-slate-200">
                  <span>{t('preventive.table.col_statut', 'STATUT')}</span>
                </th>
                <th className="py-3 px-3.5 text-center min-w-[120px]">
                  <span>{t('preventive.table.col_actions', 'ACTIONS')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80">
              {totalItems === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 text-xs">
                    <div className="max-w-md mx-auto space-y-2">
                      <List className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-bold text-slate-600">{t('preventive.table.empty_tasks', 'Aucune tâche trouvée')}</p>
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
                <>
                  {/* Top Virtual Spacer */}
                  {isVirtualized && virtualTaskWindow.topSpacerHeight > 0 && (
                    <tr aria-hidden="true" style={{ height: virtualTaskWindow.topSpacerHeight }} className="border-0 p-0 m-0 select-none">
                      <td colSpan={10} style={{ height: virtualTaskWindow.topSpacerHeight, padding: 0, border: 0, margin: 0, lineHeight: 0 }} />
                    </tr>
                  )}

                  {/* Rendered Windowed Rows */}
                  {virtualTaskWindow.visibleRows.map((virtualRow) => {
                    if (virtualRow.type === 'GROUP_HEADER') {
                      const { group, isCollapsed, doneCount, lateCount, pendingCount } = virtualRow;
                      return (
                        <tr
                          key={virtualRow.key}
                          className="bg-slate-100/95 hover:bg-slate-200/80 border-t-2 border-b border-slate-300 transition-colors"
                        >
                          <td colSpan={10} className="py-2.5 px-4">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => toggleMachineCollapse(group.id_machine)}
                                className="flex items-center gap-2.5 text-left cursor-pointer group/btn"
                              >
                                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                                  <Factory className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-black text-slate-900 font-mono text-sm tracking-tight">
                                      {group.id_machine}
                                    </span>
                                    <span className="text-slate-600 font-bold text-xs">
                                      — {group.nom_machine}
                                    </span>
                                    <span className="px-2 py-0.2 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                      {group.zone}
                                    </span>
                                  </div>
                                </div>
                                <span className="ml-1 text-slate-400 group-hover/btn:text-slate-700">
                                  {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </span>
                              </button>

                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-white text-slate-700 border border-slate-300 shadow-2xs font-mono">
                                  {group.tasks.length} {t('preventive.table.tasks_count', '{{count}} tâche(s)', { count: group.tasks.length })}
                                </span>
                                {pendingCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {pendingCount} {t('preventive.table.status.todo', 'à faire')}
                                  </span>
                                )}
                                {doneCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    {doneCount} {t('preventive.table.status.done', 'fait')}
                                  </span>
                                )}
                                {lateCount > 0 && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" />
                                    {lateCount} {t('preventive.table.status.late', 'en retard')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    // TASK or GROUP_TASK row
                    const { task: tItem, rowNumber } = virtualRow;
                    return (
                      <tr
                        key={virtualRow.key}
                        className={`even:bg-slate-50/40 odd:bg-white hover:bg-indigo-50/50 border-b border-slate-200/70 transition-colors ${
                          tItem.etat === 'En retard' ? 'bg-rose-50/20' : ''
                        }`}
                      >
                        {renderTaskCells(tItem, rowNumber, virtualRow.type === 'GROUP_TASK')}
                      </tr>
                    );
                  })}

                  {/* Bottom Virtual Spacer */}
                  {isVirtualized && virtualTaskWindow.bottomSpacerHeight > 0 && (
                    <tr aria-hidden="true" style={{ height: virtualTaskWindow.bottomSpacerHeight }} className="border-0 p-0 m-0 select-none">
                      <td colSpan={10} style={{ height: virtualTaskWindow.bottomSpacerHeight, padding: 0, border: 0, margin: 0, lineHeight: 0 }} />
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Standardized Table Pagination Footer */}
      <TablePaginationCard
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        totalItems={totalItems}
        pageSizeOptions={[20, 50, 100, 200, 0]}
        color="indigo"
        itemLabel={t('preventive.tabs.list', 'tâches')}
      />
    </div>
  );
}

DetailedTaskListView.propTypes = {
  tasks: PropTypes.array,
  machines: PropTypes.array,
  onOpenValidate: PropTypes.func,
  onOpenCorrective: PropTypes.func,
  onOpenPrint: PropTypes.func,
  onSwitchView: PropTypes.func,
  hasActiveFilters: PropTypes.bool,
  clearAllFilters: PropTypes.func,
};
