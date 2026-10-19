import { useState, useMemo, useEffect } from 'react';
import {
  Factory,
  MapPin,
  Layers,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Printer,
  User,
  Search,
} from 'lucide-react';
import ViewSwitchButtonGroup from './ViewSwitchButtonGroup';

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
 * Grouped Machines Preventive View (Vue Machines & Tâches Associées)
 * Consolidates multiple tasks into a single high-level Machine Row with an expandable
 * sub-table containing all associated preventive tasks for that specific machine.
 */
export default function GroupedMachinesView({
  tasks = [],
  machines = [],
  onOpenValidate = null,
  _onOpenCorrective = null,
  onOpenPrint = null,
  _onNavigateToMachine = null,
  onSwitchView = () => {},
}) {
  const [expandedMachines, setExpandedMachines] = useState({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);

  // Machine lookup map for Strict Relational Engine (Single Source of Truth)
  const machineMap = useMemo(() => {
    const map = new Map();
    (machines || []).forEach((m) => {
      const code = String(m.code_machine || m.id_machine_registered || m.id || '').trim().toUpperCase();
      if (code) map.set(code, m);
    });
    return map;
  }, [machines]);

  // Group filtered tasks by machine with dynamic relational resolution
  const groupedData = useMemo(() => {
    const groups = {};

    tasks.forEach((task) => {
      const mId = task.id_machine || 'AUTRE';
      if (!groups[mId]) {
        const registeredMach = machineMap.get(String(mId).trim().toUpperCase());
        const resolvedName = registeredMach?.nom || registeredMach?.designation || task.nom_machine || mId;
        const resolvedZone = registeredMach?.id_zone || registeredMach?.zone || task.id_zone || task.zone || 'Non définie';

        groups[mId] = {
          id_machine: mId,
          nom_machine: resolvedName,
          zone: resolvedZone,
          machineEntity: registeredMach,
          tasks: [],
          totalEstimatedMinutes: 0,
          totalCost: 0,
          countDone: 0,
          countLate: 0,
          countPending: 0,
        };
      }

      groups[mId].tasks.push(task);
      if (task.etat === 'Fait') groups[mId].countDone += 1;
      else if (task.etat === 'En retard') groups[mId].countLate += 1;
      else groups[mId].countPending += 1;

      // Calculate cost & time
      groups[mId].totalCost += Number(task.cout_cumule || 0);
      const minMatch = String(task.duree_estimee || '').match(/(\d+)\s*min/i);
      const hrMatch = String(task.duree_estimee || '').match(/(\d+)\s*h/i);
      let mins = 20;
      if (minMatch) mins = parseInt(minMatch[1], 10);
      else if (hrMatch) mins = parseInt(hrMatch[1], 10) * 60;
      groups[mId].totalEstimatedMinutes += mins;
    });

    return Object.values(groups).sort((a, b) =>
      a.id_machine.localeCompare(b.id_machine, undefined, { numeric: true })
    );
  }, [tasks]);

  // Filter grouped data if local quick search is typed
  const filteredGroups = useMemo(() => {
    if (!localSearch.trim()) return groupedData;
    const q = localSearch.toLowerCase();
    return groupedData.filter(
      (g) =>
        g.id_machine.toLowerCase().includes(q) ||
        g.nom_machine.toLowerCase().includes(q) ||
        g.zone.toLowerCase().includes(q) ||
        g.tasks.some(
          (t) =>
            (t.composant && t.composant.toLowerCase().includes(q)) ||
            (t.action_code && t.action_code.toLowerCase().includes(q)) ||
            (t.responsable && t.responsable.toLowerCase().includes(q))
        )
    );
  }, [groupedData, localSearch]);

  // Reset page to 1 when search or tasks change
  useEffect(() => {
    setCurrentPage(1);
  }, [localSearch, tasks.length]);

  // Pagination math
  const totalMachines = filteredGroups.length;
  const effectivePageSize = pageSize === 0 ? totalMachines : pageSize;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalMachines / effectivePageSize));
  const startIndex = (currentPage - 1) * effectivePageSize;
  const displayedGroups = useMemo(() => {
    if (pageSize === 0) return filteredGroups;
    return filteredGroups.slice(startIndex, startIndex + effectivePageSize);
  }, [filteredGroups, pageSize, startIndex, effectivePageSize]);

  const toggleExpand = (mId) => {
    setExpandedMachines((prev) => ({
      ...prev,
      [mId]: !prev[mId],
    }));
  };

  const toggleExpandAll = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const newMap = {};
    filteredGroups.forEach((g) => {
      newMap[g.id_machine] = nextState;
    });
    setExpandedMachines(newMap);
  };

  return (
    <div className="space-y-4 animate-view-transition">
      {/* Top Controls Bar for Grouped View */}
      <div className="bg-white rounded-2xl border border-slate-200 px-5 py-3.5 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
            <Factory className="w-4.5 h-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900 text-sm">
                Vue Synthétique par Machine
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                {totalMachines} Machine{totalMachines > 1 ? 's' : ''}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {tasks.length} Tâches Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
              Affichage fluide paginé des équipements industriels avec leurs gammes d'interventions associées.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Quick Machine Search inside view */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Filtrer machines..."
              className="pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 transition w-36 sm:w-48"
            />
          </div>

          <button
            type="button"
            onClick={toggleExpandAll}
            className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
          >
            {allExpanded ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Tout Réduire</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Tout Déployer</span>
              </>
            )}
          </button>

          {/* 3D Circular Switch Buttons on the RIGHT */}
          <ViewSwitchButtonGroup
            currentView="grouped"
            onSwitchView={onSwitchView}
          />
        </div>
      </div>

      {/* Machine Accordion Cards List Container */}
      <div className="space-y-3 min-h-[300px]">
        {totalMachines === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 shadow-2xs">
            <Factory className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-bold text-slate-700">Aucune machine ne correspond aux critères.</p>
            <p className="text-xs text-slate-400 mt-1">Modifiez vos filtres ou la recherche rapide.</p>
          </div>
        ) : (
          displayedGroups.map((group) => {
            const isExpanded = !!expandedMachines[group.id_machine] || allExpanded;
            const progress =
              group.tasks.length > 0
                ? Math.round((group.countDone / group.tasks.length) * 100)
                : 0;

            const totalHours = Math.floor(group.totalEstimatedMinutes / 60);
            const remainingMins = group.totalEstimatedMinutes % 60;
            const timeFormatted =
              totalHours > 0 ? `${totalHours}h ${remainingMins}m` : `${remainingMins}m`;

            return (
              <div
                key={group.id_machine}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.08)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.12)] transition-all overflow-hidden"
              >
                {/* Machine Summary Row (Header) */}
                <div
                  onClick={() => toggleExpand(group.id_machine)}
                  className="p-4 bg-slate-50/70 hover:bg-indigo-50/40 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer transition select-none"
                >
                  {/* Left: Machine Identification */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shadow-2xs shrink-0">
                      <Factory className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-slate-900 text-sm md:text-base">
                          {group.id_machine}
                        </span>
                        <span className="text-xs md:text-sm font-bold text-slate-700 truncate">
                          {group.nom_machine}
                        </span>
                        {group.zone && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10.5px] font-bold flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600" />
                            {group.zone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="font-medium">
                          <b>{group.tasks.length}</b> tâche{group.tasks.length > 1 ? 's' : ''} préventive{group.tasks.length > 1 ? 's' : ''}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-slate-600 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Temps estimé : {timeFormatted}
                        </span>
                        {group.totalCost > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-amber-700 font-bold font-mono">
                              {group.totalCost.toFixed(2)} DT
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Progress & Status Badges */}
                  <div className="flex items-center gap-3 shrink-0 self-end lg:self-auto">
                    {/* Progress Bar */}
                    <div className="w-28 sm:w-36 space-y-1">
                      <div className="flex items-center justify-between text-[10.5px] font-mono font-bold text-slate-500">
                        <span>Progression</span>
                        <span className={progress === 100 ? 'text-emerald-600 font-black' : ''}>
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            progress === 100
                              ? 'bg-emerald-500'
                              : progress > 0
                              ? 'bg-indigo-600'
                              : 'bg-slate-300'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-1.5">
                      {group.countLate > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          {group.countLate} En retard
                        </span>
                      )}
                      {group.countDone > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          {group.countDone} Faite{group.countDone > 1 ? 's' : ''}
                        </span>
                      )}
                      {group.countPending > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                          {group.countPending} À faire
                        </span>
                      )}
                    </div>

                    <div className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Sub-Table of Tasks for this Machine */}
                {isExpanded && (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-100/80 text-slate-700 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 select-none">
                        <tr>
                          <th className="py-2.5 px-3 min-w-[140px]">Organe / Composant</th>
                          <th className="py-2.5 px-2.5 text-center min-w-[80px]">Action</th>
                          <th className="py-2.5 px-3 min-w-[90px]">Fréquence</th>
                          <th className="py-2.5 px-3 min-w-[95px]">Échéance</th>
                          <th className="py-2.5 px-3 min-w-[110px]">Responsable</th>
                          <th className="py-2.5 px-3 min-w-[180px]">Consignes & Mode Opératoire</th>
                          <th className="py-2.5 px-3 text-center min-w-[85px]">Statut</th>
                          <th className="py-2.5 px-3 text-right min-w-[120px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {group.tasks.map((task, idx) => {
                          const actionMeta = ACTION_PILL_MAP[task.action_code] || {
                            bg: 'bg-slate-100 text-slate-800 border-slate-200',
                            dot: 'bg-slate-500',
                            label: task.action_code,
                          };

                          return (
                            <tr
                              key={task.id || idx}
                              className={`hover:bg-indigo-50/30 transition-colors ${
                                task.etat === 'En retard' ? 'bg-rose-50/30' : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                <div className="flex items-center gap-1.5">
                                  <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>{task.composant || 'Organe principal'}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-2.5 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold border ${actionMeta.bg}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${actionMeta.dot}`} />
                                  {task.action_code}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                                {task.frequence || 'Périodique'}
                              </td>

                              <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">
                                {task.prochaine_echeance || 'Planifié'}
                              </td>

                              <td className="py-2.5 px-3 text-slate-600">
                                <div className="flex items-center gap-1">
                                  <User className="w-3 h-3 text-slate-400" />
                                  <span>{task.responsable || 'Non assigné'}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                                {task.consigne || task.observations || task.type_intervention || '-'}
                              </td>

                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    task.etat === 'Fait'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : task.etat === 'En retard'
                                      ? 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}
                                >
                                  {task.etat || 'À faire'}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {onOpenPrint && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenPrint(task)}
                                      className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
                                      title="Imprimer Ordre de Travail"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                  {onOpenValidate && task.etat !== 'Fait' && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenValidate(task)}
                                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      Valider
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating 3D Pagination & Summary Footer Card */}
      {totalMachines > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">Machines par page :</span>
            <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              {[6, 12, 24, 48, 0].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    pageSize === size
                      ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                  }`}
                >
                  {size === 0 ? 'Toutes' : size}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-xs font-semibold text-slate-500">
              Affichage de <b className="text-slate-900">{totalMachines === 0 ? 0 : startIndex + 1}</b> à{' '}
              <b className="text-slate-900">{Math.min(startIndex + effectivePageSize, totalMachines)}</b>{' '}
              sur <b className="text-slate-900">{totalMachines}</b> machines
            </div>

            {pageSize !== 0 && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Précédent
                </button>
                <span className="px-2 font-mono text-xs font-bold text-slate-600">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold transition cursor-pointer"
                >
                  Suivant
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
