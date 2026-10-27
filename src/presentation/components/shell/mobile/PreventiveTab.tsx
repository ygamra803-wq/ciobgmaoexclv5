import { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  X,
  Plus,
  Trash2,
  Search,
  Package,
  FileText,
} from 'lucide-react';
import { getTechnicianDisplayName } from '../../../../core/security/technicianScope';

export type MobilePrevFilter = 'TODO' | 'OVERDUE' | 'CLARIFY' | 'PENDING' | 'DONE' | 'ALL';

interface ProposedSpareRow {
  ref: string;
  designation: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

interface PreventiveTabProps {
  currentUser: any;
  technicians: any[];
  techScope: any;
  stockItems: any[];
  initialFilter?: MobilePrevFilter;
  initialTaskToExecute?: any | null;
  onClearInitialTask?: () => void;
  onMarkTaskDone: (id: string, validationData: any) => void;
  onOpenMachineQrModal?: (machineId: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

export default function PreventiveTab({
  currentUser,
  technicians = [],
  techScope,
  stockItems = [],
  initialFilter = 'TODO',
  initialTaskToExecute = null,
  onClearInitialTask,
  onMarkTaskDone,
  onOpenMachineQrModal,
  showToast,
}: PreventiveTabProps) {
  const [prevFilter, setPrevFilter] = useState<MobilePrevFilter>(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // Execution Sheet State
  const [selectedTaskForExec, setSelectedTaskForExec] = useState<any | null>(null);
  const [execNotes, setExecNotes] = useState('');
  const [execDuration, setExecDuration] = useState('20');
  const [execNumBon, setExecNumBon] = useState('');
  const [execCompteur, setExecCompteur] = useState('');
  const [proposedSpares, setProposedSpares] = useState<ProposedSpareRow[]>([]);
  const [pickerRef, setPickerRef] = useState('');
  const [pickerQty, setPickerQty] = useState('1');

  useEffect(() => {
    setPrevFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    if (initialTaskToExecute) {
      handleOpenExecSheet(initialTaskToExecute);
      onClearInitialTask?.();
    }
  }, [initialTaskToExecute]);

  const myTasks = techScope?.myPreventiveTasks || [];
  const overdueTasks = techScope?.overdueTasks || [];
  const thisWeekTasks = techScope?.thisWeekTasks || [];
  const todoTasks = techScope?.todoTasks || [];
  const clarifyTasks = techScope?.needsClarificationPreventive || [];
  const pendingValTasks = techScope?.pendingValidationPreventive || [];
  const doneTasks = techScope?.doneTasks || [];

  const overdueIdSet = useMemo(
    () => new Set(overdueTasks.map((t: any) => String(t.id))),
    [overdueTasks]
  );
  const thisWeekIdSet = useMemo(
    () => new Set(thisWeekTasks.map((t: any) => String(t.id))),
    [thisWeekTasks]
  );
  const clarifyIdSet = useMemo(
    () => new Set(clarifyTasks.map((t: any) => String(t.id))),
    [clarifyTasks]
  );
  const pendingIdSet = useMemo(
    () => new Set(pendingValTasks.map((t: any) => String(t.id))),
    [pendingValTasks]
  );
  const doneIdSet = useMemo(
    () => new Set(doneTasks.map((t: any) => String(t.id))),
    [doneTasks]
  );

  const filteredTasks = useMemo(() => {
    let base: any[] = [];
    if (prevFilter === 'OVERDUE') {
      base = overdueTasks;
    } else if (prevFilter === 'CLARIFY') {
      base = clarifyTasks;
    } else if (prevFilter === 'PENDING') {
      base = pendingValTasks;
    } else if (prevFilter === 'DONE') {
      base = doneTasks;
    } else if (prevFilter === 'TODO') {
      const combined = [...clarifyTasks, ...overdueTasks, ...todoTasks];
      base = combined.filter(
        (t, idx, arr) => arr.findIndex((x) => String(x.id) === String(t.id)) === idx
      );
    } else {
      base = myTasks;
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((t: any) => {
      const machine = String(t.id_machine || t.machine || '').toLowerCase();
      const nomMachine = String(t.nom_machine || '').toLowerCase();
      const title = String(t.tache || t.intitule || t.consigne || t.organe || '').toLowerCase();
      return machine.includes(q) || nomMachine.includes(q) || title.includes(q);
    });
  }, [
    prevFilter,
    searchQuery,
    myTasks,
    overdueTasks,
    todoTasks,
    clarifyTasks,
    pendingValTasks,
    doneTasks,
  ]);

  const handleOpenExecSheet = (task: any) => {
    setSelectedTaskForExec(task);
    setExecNotes(task.observations_validation || task.observations || '');
    setExecDuration(
      String(
        parseInt(String(task.duree_reelle || task.duree_estimee_min || task.duree_estimee || 20), 10) ||
          20
      )
    );
    setExecNumBon(task.num_bon_saisi_par_tech || '');
    setExecCompteur(
      task.compteur_actuel || task.dernier_releve
        ? String(task.compteur_actuel || task.dernier_releve)
        : ''
    );

    // Pre-populate spares from pieces_proposees or pdr_requises or single pdr_ref
    const initialSpares: ProposedSpareRow[] = [];
    const existingList =
      Array.isArray(task.pieces_proposees) && task.pieces_proposees.length > 0
        ? task.pieces_proposees
        : Array.isArray(task.pdr_requises) && task.pdr_requises.length > 0
        ? task.pdr_requises
        : task.pdr_ref
        ? [
            {
              ref: task.pdr_ref,
              designation: task.pdr_designation || task.pdr_ref,
              qty: Number(task.pdr_quantite || 1),
            },
          ]
        : [];

    existingList.forEach((p: any) => {
      const ref = String(p?.ref || p?.reference || p?.code || '').trim();
      if (!ref) return;
      const stockMatch = stockItems.find(
        (s) => String(s.ref || '').trim().toUpperCase() === ref.toUpperCase()
      );
      initialSpares.push({
        ref,
        designation: String(p?.designation || p?.nom || stockMatch?.designation || ref).trim(),
        qty: Math.max(1, Number(p?.qty ?? p?.quantite ?? 1)),
        unit: String(p?.unit || p?.unite || stockMatch?.unite || 'pcs'),
        unitPrice: Number(
          p?.unitPrice ?? p?.prix_unitaire ?? stockMatch?.prix ?? stockMatch?.prix_unitaire ?? 0
        ),
      });
    });

    setProposedSpares(initialSpares);
    setPickerRef('');
    setPickerQty('1');
  };

  const handleAddSpareRow = () => {
    const cleanRef = pickerRef.trim();
    if (!cleanRef) return;
    const qtyNum = Math.max(1, Number(pickerQty) || 1);
    const matchedStock = stockItems.find(
      (s) => String(s.ref || '').trim().toUpperCase() === cleanRef.toUpperCase()
    );

    setProposedSpares((prev) => {
      const idx = prev.findIndex((p) => p.ref.toUpperCase() === cleanRef.toUpperCase());
      if (idx >= 0) {
        return prev.map((item, i) => (i === idx ? { ...item, qty: item.qty + qtyNum } : item));
      }
      return [
        ...prev,
        {
          ref: cleanRef,
          designation: matchedStock?.designation || cleanRef,
          qty: qtyNum,
          unit: matchedStock?.unite || 'pcs',
          unitPrice: Number(matchedStock?.prix || matchedStock?.prix_unitaire || 0),
        },
      ];
    });
    setPickerRef('');
    setPickerQty('1');
  };

  const handleRemoveSpareRow = (refToRemove: string) => {
    setProposedSpares((prev) => prev.filter((p) => p.ref !== refToRemove));
  };

  const handleSubmitPreventiveExec = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForExec) return;

    // Also include currently selected pickerRef if user selected a part without clicking "+"
    const finalSpares = [...proposedSpares];
    if (pickerRef.trim()) {
      const cleanRef = pickerRef.trim();
      const qtyNum = Math.max(1, Number(pickerQty) || 1);
      const matchedStock = stockItems.find(
        (s) => String(s.ref || '').trim().toUpperCase() === cleanRef.toUpperCase()
      );
      const existingIdx = finalSpares.findIndex(
        (p) => p.ref.toUpperCase() === cleanRef.toUpperCase()
      );
      if (existingIdx >= 0) {
        finalSpares[existingIdx] = {
          ...finalSpares[existingIdx],
          qty: finalSpares[existingIdx].qty + qtyNum,
        };
      } else {
        finalSpares.push({
          ref: cleanRef,
          designation: matchedStock?.designation || cleanRef,
          qty: qtyNum,
          unit: matchedStock?.unite || 'pcs',
          unitPrice: Number(matchedStock?.prix || matchedStock?.prix_unitaire || 0),
        });
      }
    }

    const techName =
      getTechnicianDisplayName(currentUser, technicians) ||
      currentUser?.personnelName ||
      currentUser?.name ||
      currentUser?.nom ||
      'Technicien';
    const techId = String(
      currentUser?.personnelId ||
        currentUser?.code ||
        currentUser?.id_technician ||
        currentUser?.id ||
        'tech'
    );
    const durationNum = Math.max(1, Number(execDuration) || 20);
    const compteurNum = Number(execCompteur || 0);

    // Strictly Maker-Checker: submitForValidation = true, validation_status = 'PENDING_VALIDATION'
    // Zero direct stock movement (sparesUsed remains empty in ExecutionService until Admin approves)
    onMarkTaskDone(selectedTaskForExec.id, {
      date_realisation: new Date().toISOString().split('T')[0],
      technicien: techName,
      technicien_realisateur: techName,
      executorName: techName,
      id_technician: techId,
      submitForValidation: true,
      validation_status: 'PENDING_VALIDATION',
      submitted_by_id: techId,
      submitted_by_name: techName,
      submitted_at: new Date().toISOString(),
      durationMinutes: durationNum,
      duree_reelle: `${durationNum} min`,
      observations: execNotes.trim() || 'Exécution préventive réalisée sur le terrain',
      notes: execNotes.trim() || 'Exécution préventive réalisée sur le terrain',
      usedPDR: finalSpares,
      sparesProposed: finalSpares,
      num_bon_saisi_par_tech: execNumBon.trim(),
      ...(compteurNum > 0 ? { compteur_releve: compteurNum } : {}),
    });

    setSelectedTaskForExec(null);
    showToast?.(
      'Exécution transmise pour validation responsable (En attente validation — sans déduction stock immédiate).',
      'success'
    );
  };

  return (
    <div data-testid="mobile-tab-preventive" className="space-y-3">
      {/* Header & Filter Pills */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Mes Tâches Préventives ({filteredTasks.length})</span>
          </h2>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
            Total assigné : {myTasks.length}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer par code machine ou intitulé..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs text-slate-800"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            {
              id: 'TODO',
              label: `À faire (${overdueTasks.length + todoTasks.length})`,
              activeClass: 'bg-indigo-600 text-white',
            },
            {
              id: 'OVERDUE',
              label: `En retard (${overdueTasks.length})`,
              activeClass: 'bg-rose-600 text-white',
            },
            {
              id: 'CLARIFY',
              label: `À clarifier (${clarifyTasks.length})`,
              activeClass: 'bg-amber-600 text-white',
            },
            {
              id: 'PENDING',
              label: `En attente val. (${pendingValTasks.length})`,
              activeClass: 'bg-purple-600 text-white',
            },
            {
              id: 'DONE',
              label: `Fait (${doneTasks.length})`,
              activeClass: 'bg-emerald-600 text-white',
            },
            {
              id: 'ALL',
              label: `Toutes (${myTasks.length})`,
              activeClass: 'bg-slate-900 text-white',
            },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPrevFilter(f.id as MobilePrevFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                prevFilter === f.id
                  ? f.activeClass
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Task Cards List or Explicit Empty State */}
      {myTasks.length === 0 ? (
        <div
          data-testid="preventive-empty-assigned"
          className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2"
        >
          <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
          <div className="text-sm font-black text-slate-900">Aucune tâche assignée</div>
          <p className="text-xs text-slate-500">
            Aucune tâche préventive n'est actuellement rattachée à votre matricule technicien.
          </p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <div className="text-sm font-bold text-slate-800">Aucune tâche dans ce filtre</div>
          <p className="text-xs text-slate-500">
            Changez de filtre ci-dessus pour consulter vos autres tâches préventives.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTasks.map((task: any) => {
            const taskIdStr = String(task.id);
            const isOverdue = overdueIdSet.has(taskIdStr);
            const isThisWeek = thisWeekIdSet.has(taskIdStr);
            const isClarify = clarifyIdSet.has(taskIdStr);
            const isPending = pendingIdSet.has(taskIdStr);
            const isDone = doneIdSet.has(taskIdStr);
            const machineCode = task.id_machine || task.machine || 'MACHINE';

            return (
              <div
                key={task.id}
                data-testid={`mobile-prev-card-${task.id}`}
                className={`bg-white rounded-2xl p-4 border shadow-2xs space-y-3 ${
                  isClarify
                    ? 'border-rose-400 ring-1 ring-rose-200'
                    : isOverdue
                    ? 'border-rose-200'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => onOpenMachineQrModal?.(machineCode)}
                        className="font-mono text-sm font-black text-slate-900 hover:text-indigo-700 underline decoration-dotted cursor-pointer"
                        title="Ouvrir Fiche Terrain Machine"
                      >
                        {machineCode}
                      </button>

                      {isClarify && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono text-[10px] font-black">
                          À CLARIFIER
                        </span>
                      )}
                      {isOverdue && !isClarify && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono text-[10px] font-bold">
                          EN RETARD
                        </span>
                      )}
                      {!isOverdue && isThisWeek && !isPending && !isDone && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono text-[10px] font-bold">
                          CETTE SEMAINE
                        </span>
                      )}
                      {!isOverdue && !isThisWeek && !isPending && !isDone && !isClarify && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-bold">
                          À FAIRE
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-mono text-[10px] font-bold">
                          EN ATTENTE VALIDATION
                        </span>
                      )}
                      {isDone && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                          FAIT
                        </span>
                      )}
                    </div>

                    <div className="text-xs font-bold text-slate-900">
                      {task.tache || task.intitule || task.consigne || 'Inspection préventive'}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                      {(task.organe || task.composant) && (
                        <span>Organe : {task.organe || task.composant}</span>
                      )}
                      {task.prochaine_echeance && (
                        <span className="font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {task.prochaine_echeance}
                        </span>
                      )}
                    </div>
                  </div>

                  <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-bold shrink-0">
                    {task.frequence || task.periodicite || 'Hebdo'}
                  </span>
                </div>

                {/* Supervisor Clarification Note if NEEDS_CLARIFICATION / REJECTED */}
                {task.validation_note && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2 text-xs text-rose-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-black">Demande de précision Admin : </span>
                      <span>{task.validation_note}</span>
                    </div>
                  </div>
                )}

                {/* Proposed Spares Summary if Pending Validation */}
                {Array.isArray(task.pieces_proposees) && task.pieces_proposees.length > 0 && (
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-1.5 flex-wrap text-[11px] text-slate-700 font-mono">
                    <Package className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>PDR déclarées :</span>
                    {task.pieces_proposees.map((p: any, idx: number) => (
                      <span
                        key={`${p.ref}-${idx}`}
                        className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold"
                      >
                        {p.ref} ×{p.qty ?? p.quantite ?? 1}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Footer & Touch Action */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                  <span className="text-[11px] text-slate-500 font-mono">
                    Durée est. : {task.duree_estimee_min || task.duree_estimee || 20} min
                  </span>

                  <button
                    type="button"
                    onClick={() => handleOpenExecSheet(task)}
                    data-testid={`mobile-prev-exec-btn-${task.id}`}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                      isClarify
                        ? 'bg-rose-600 hover:bg-rose-500 text-white'
                        : isPending
                        ? 'bg-purple-700 hover:bg-purple-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isClarify
                        ? 'Corriger & Soumettre'
                        : isPending
                        ? 'Modifier soumission'
                        : 'Valider / Soumettre'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MAKER-CHECKER EXECUTION BOTTOM SHEET */}
      {selectedTaskForExec && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <form
            onSubmit={handleSubmitPreventiveExec}
            data-testid="mobile-prev-exec-sheet"
            className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-white rounded-3xl p-5 space-y-4 shadow-2xl border border-slate-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-black text-indigo-700">
                    {selectedTaskForExec.id_machine || selectedTaskForExec.machine}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 font-mono text-[10px] font-bold">
                    Maker-Checker
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 mt-0.5">
                  {selectedTaskForExec.tache ||
                    selectedTaskForExec.intitule ||
                    "Valider l'exécution préventive"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTaskForExec(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedTaskForExec.validation_note && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <span className="font-black">Note du responsable : </span>
                {selectedTaskForExec.validation_note}
              </div>
            )}

            <div className="space-y-3">
              {/* Observations */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Observations / Rapport d'inspection
                </label>
                <textarea
                  rows={2}
                  value={execNotes}
                  onChange={(e) => setExecNotes(e.target.value)}
                  placeholder="Contrôle conforme, graissage effectué, nettoyage..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Duration & Optional Meter Reading */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Durée réelle (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={execDuration}
                    onChange={(e) => setExecDuration(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Relevé compteur (opt.)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={execCompteur}
                    onChange={(e) => setExecCompteur(e.target.value)}
                    placeholder="Heures / cycles"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Multi-PDR Proposal Section */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-800 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Pièces (PDR) utilisées (sans déduction directe)</span>
                  </label>
                  <span className="text-[10px] font-mono text-slate-500">
                    {proposedSpares.length} réf.
                  </span>
                </div>

                {proposedSpares.length > 0 && (
                  <div className="space-y-1.5">
                    {proposedSpares.map((sp) => (
                      <div
                        key={sp.ref}
                        className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-black text-slate-900">{sp.ref}</span>
                          <span className="text-slate-500 ml-1.5 truncate">{sp.designation}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-bold text-indigo-700">
                            ×{sp.qty} {sp.unit}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSpareRow(sp.ref)}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Retirer cette pièce"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <select
                    value={pickerRef}
                    onChange={(e) => setPickerRef(e.target.value)}
                    aria-label="Choisir une référence PDR"
                    className="flex-1 min-w-0 rounded-xl border border-slate-300 px-2.5 py-2 text-xs font-mono bg-white"
                  >
                    <option value="">— Ajouter une PDR du stock —</option>
                    {stockItems.map((s) => (
                      <option key={s.ref} value={s.ref}>
                        {s.ref} — {s.designation} (Dispo: {s.stockActuel})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={pickerQty}
                    onChange={(e) => setPickerQty(e.target.value)}
                    aria-label="Quantité PDR"
                    className="w-16 rounded-xl border border-slate-300 px-2 py-2 text-xs font-mono text-center bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddSpareRow}
                    disabled={!pickerRef}
                    className="p-2 rounded-xl bg-indigo-600 disabled:bg-slate-200 text-white cursor-pointer shrink-0"
                    title="Ajouter la pièce"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Optional N° Bon Magasin */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>N° Bon de sortie magasin (optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={execNumBon}
                    onChange={(e) => setExecNumBon(e.target.value)}
                    placeholder="Ex: BS-2026-042"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-mono bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTaskForExec(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                data-testid="mobile-prev-submit-btn"
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Soumettre (À valider)</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
