import { useState, useMemo, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  X,
  Check,
  Layers,
  MapPin,
  User,
  Calendar,
  Package,
  ClipboardCheck,
} from 'lucide-react';
import { getMachineAssetClass } from '../../../../utils/activeMachines';
import { useGmaoStore } from '../../../../store/useGmaoStore';

export type RoundPointOutcome = 'CONFORME' | 'ANOMALIE' | 'PDR';

export interface RoundPointState {
  selected: boolean;
  outcome: RoundPointOutcome;
  anomalyNote: string;
  triggerCorrectiveDi: boolean;
  pdrRef: string;
  pdrQty: number;
  numBon: string;
}

interface SystemGeneralRoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: any[];
  machines: any[];
  zones: any[];
  technicians: any[];
  stockItems: any[];
  isTechUser?: boolean;
  defaultTechName?: string;
  onMarkTaskDone: (taskId: string, validationData: any) => void;
  onCreateCorrective?: (task: any, btData: any) => void;
  showToast?: (msg: string, type?: string) => void;
}

export default function SystemGeneralRoundModal({
  isOpen,
  onClose,
  tasks = [],
  machines = [],
  zones = [],
  technicians = [],
  stockItems = [],
  isTechUser = false,
  defaultTechName = '',
  onMarkTaskDone,
  onCreateCorrective,
  showToast,
}: SystemGeneralRoundModalProps) {
  const generalSystemTypes = useGmaoStore((s) => s.generalSystemTypes) || [];

  const [selectedSysType, setSelectedSysType] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [onlyDueTasks, setOnlyDueTasks] = useState<boolean>(false);
  const [roundDate, setRoundDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [roundTech, setRoundTech] = useState<string>(defaultTechName || '');
  const [durationPerPoint, setDurationPerPoint] = useState<string>('10 min');
  const [globalBonNumber, setGlobalBonNumber] = useState<string>('');
  const [pointStates, setPointStates] = useState<Record<string, RoundPointState>>({});

  useEffect(() => {
    if (defaultTechName && !roundTech) {
      setRoundTech(defaultTechName);
    }
  }, [defaultTechName, roundTech]);

  // Build machine lookup map
  const machineMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const m of machines || []) {
      const id = String(m?.id_machine_registered || m?.id || m?.code || '').trim();
      if (id) {
        map.set(id, m);
        map.set(id.toUpperCase(), m);
      }
    }
    return map;
  }, [machines]);

  // Filter tasks belonging to SYSTEM_GENERAL machines
  const sysGenTasks = useMemo(() => {
    return (tasks || []).filter((t) => {
      const m =
        machineMap.get(t.id_machine) ||
        machineMap.get(String(t.id_machine || '').trim().toUpperCase());
      return getMachineAssetClass(m) === 'SYSTEM_GENERAL';
    });
  }, [tasks, machineMap]);

  const filteredRoundTasks = useMemo(() => {
    return sysGenTasks.filter((t) => {
      const m =
        machineMap.get(t.id_machine) ||
        machineMap.get(String(t.id_machine || '').trim().toUpperCase());
      if (selectedSysType !== 'ALL') {
        const mSysType = String(m?.id_general_system_type || '');
        if (mSysType !== selectedSysType) return false;
      }
      if (selectedZone !== 'ALL') {
        const tZone = String(t.id_zone || m?.id_zone_default || m?.id_zone || '').trim();
        if (tZone !== selectedZone) return false;
      }
      if (onlyDueTasks) {
        if (t.etat === 'Fait' || t.validation_status === 'PENDING_VALIDATION') return false;
      }
      return true;
    });
  }, [sysGenTasks, machineMap, selectedSysType, selectedZone, onlyDueTasks]);

  // Initialize pointStates when filteredRoundTasks changes
  useEffect(() => {
    setPointStates((prev) => {
      const next = { ...prev };
      for (const t of filteredRoundTasks) {
        if (!next[t.id]) {
          const isAlreadyDone =
            t.etat === 'Fait' || t.validation_status === 'PENDING_VALIDATION';
          next[t.id] = {
            selected: !isAlreadyDone,
            outcome: 'CONFORME',
            anomalyNote: '',
            triggerCorrectiveDi: true,
            pdrRef: '',
            pdrQty: 1,
            numBon: '',
          };
        }
      }
      return next;
    });
  }, [filteredRoundTasks]);

  if (!isOpen) return null;

  const updatePoint = (taskId: string, patch: Partial<RoundPointState>) => {
    setPointStates((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || {
          selected: true,
          outcome: 'CONFORME',
          anomalyNote: '',
          triggerCorrectiveDi: true,
          pdrRef: '',
          pdrQty: 1,
          numBon: '',
        }),
        ...patch,
      },
    }));
  };

  const handleSelectAllConforme = () => {
    const next: Record<string, RoundPointState> = { ...pointStates };
    for (const t of filteredRoundTasks) {
      next[t.id] = {
        ...(next[t.id] || {
          anomalyNote: '',
          triggerCorrectiveDi: true,
          pdrRef: '',
          pdrQty: 1,
          numBon: '',
        }),
        selected: true,
        outcome: 'CONFORME',
      };
    }
    setPointStates(next);
  };

  const selectedTasksList = filteredRoundTasks.filter((t) => pointStates[t.id]?.selected);
  const conformeCount = selectedTasksList.filter(
    (t) => pointStates[t.id]?.outcome === 'CONFORME'
  ).length;
  const anomalieCount = selectedTasksList.filter(
    (t) => pointStates[t.id]?.outcome === 'ANOMALIE'
  ).length;
  const pdrCount = selectedTasksList.filter((t) => pointStates[t.id]?.outcome === 'PDR').length;

  const handleSubmitRound = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTasksList.length === 0) {
      showToast?.('Veuillez sélectionner au moins un point de contrôle à valider.', 'warning');
      return;
    }

    let completedCount = 0;
    let triggeredDiCount = 0;

    for (const task of selectedTasksList) {
      const st = pointStates[task.id];
      if (!st) continue;

      let usedPDR: any[] = [];
      if (st.outcome === 'PDR' && st.pdrRef) {
        const matchedStock = (stockItems || []).find(
          (s) => String(s.ref || '').toLowerCase() === st.pdrRef.toLowerCase()
        );
        usedPDR = [
          {
            id_article: matchedStock?.id_article || `PDR-${st.pdrRef}`,
            reference: matchedStock?.ref || st.pdrRef,
            designation: matchedStock?.designation || st.pdrRef,
            quantite: Math.max(1, Number(st.pdrQty || 1)),
            unite: matchedStock?.unite || 'Pièce',
            prix_unitaire: Number(matchedStock?.prix_unitaire || 0),
          },
        ];
      }

      const observations =
        st.outcome === 'ANOMALIE'
          ? `[RONDE SYSTÈME GÉNÉRAL - ANOMALIE] ${
              st.anomalyNote || `Anomalie constatée sur ${task.composant || task.id_machine}`
            }`
          : st.outcome === 'PDR'
          ? `[RONDE SYSTÈME GÉNÉRAL - PDR UTILISÉE] Contrôle effectué avec remplacement PDR (${st.pdrRef} x${st.pdrQty}).`
          : `[RONDE SYSTÈME GÉNÉRAL - CONFORME] Inspection périodique conforme (${task.composant || task.id_machine}).`;

      onMarkTaskDone(task.id, {
        date_realisation: roundDate,
        technicien: roundTech || task.responsable || 'Technicien',
        duree_reelle: durationPerPoint || '10 min',
        taux_horaire: 35,
        observations,
        usedPDR,
        num_bon_saisi_par_tech: st.numBon || globalBonNumber || '',
        mode_calcul_recurrence: 'FIXE',
      });
      completedCount += 1;

      if (st.outcome === 'ANOMALIE' && st.triggerCorrectiveDi && onCreateCorrective) {
        onCreateCorrective(task, {
          description:
            st.anomalyNote ||
            `Anomalie détectée durant la ronde Système Général sur ${task.composant} (${task.id_machine}).`,
          priorite: 'Haute',
          demandeur: roundTech || 'Ronde Système Général',
        });
        triggeredDiCount += 1;
      }
    }

    showToast?.(
      `Ronde Système Général enregistrée : ${completedCount} point(s) validé(s)${
        triggeredDiCount > 0 ? `, ${triggeredDiCount} DI corrective(s) ouverte(s)` : ''
      }.`,
      'success'
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-950 via-indigo-900 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 flex items-center justify-center shadow-inner">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black tracking-tight">
                  Mode Ronde — Inspection Groupée Système Général
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/30 text-indigo-100 border border-indigo-400/40">
                  {filteredRoundTasks.length} point(s) de contrôle
                </span>
              </div>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Validez en lot vos rondes sécurité incendie (SYS-SEC), air comprimé (SYS-AIR), eau & utilités en un seul écran.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
            title="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter & Round Context Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3 shrink-0 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* 1. Type de Système Général */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Layers className="w-3 h-3 text-indigo-600" />
                <span>Type Système Général</span>
              </label>
              <select
                value={selectedSysType}
                onChange={(e) => setSelectedSysType(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">Tous les Systèmes ({sysGenTasks.length})</option>
                {generalSystemTypes.map((st: any) => (
                  <option key={st.id} value={st.id}>
                    {st.code ? `${st.code} • ` : ''}
                    {st.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Zone */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <MapPin className="w-3 h-3 text-purple-600" />
                <span>Zone / Secteur</span>
              </label>
              <select
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:border-indigo-500 outline-none"
              >
                <option value="ALL">Toutes les Zones</option>
                {(zones || []).map((z: any) => {
                  const zCode = z.code_zone || z.code || z.id_zone;
                  return (
                    <option key={zCode} value={zCode}>
                      {zCode} • {z.libelle}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 3. Technicien */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <User className="w-3 h-3 text-emerald-600" />
                <span>Inspecteur / Technicien</span>
              </label>
              <input
                type="text"
                value={roundTech}
                onChange={(e) => setRoundTech(e.target.value)}
                disabled={isTechUser && Boolean(defaultTechName)}
                placeholder="Nom du technicien..."
                list="round-tech-list"
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 disabled:bg-slate-100"
              />
              <datalist id="round-tech-list">
                {(technicians || []).map((t: any) => (
                  <option key={t.id_technician || t.nom} value={t.nom} />
                ))}
              </datalist>
            </div>

            {/* 4. Date de Ronde */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-cyan-600" />
                <span>Date d&apos;Inspection</span>
              </label>
              <input
                type="date"
                value={roundDate}
                onChange={(e) => setRoundDate(e.target.value)}
                className="w-full h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800"
              />
            </div>

            {/* 5. Durée Moyenne / Point */}
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Durée / Point & N° Bon Global
              </label>
              <div className="flex items-center gap-1.5">
                <select
                  value={durationPerPoint}
                  onChange={(e) => setDurationPerPoint(e.target.value)}
                  className="w-24 h-9 px-2 rounded-xl border border-slate-200 bg-white text-xs font-mono font-bold text-slate-800"
                >
                  <option value="5 min">5 min</option>
                  <option value="10 min">10 min</option>
                  <option value="15 min">15 min</option>
                  <option value="20 min">20 min</option>
                  <option value="30 min">30 min</option>
                </select>
                <input
                  type="text"
                  value={globalBonNumber}
                  onChange={(e) => setGlobalBonNumber(e.target.value)}
                  placeholder="N° Bon (opt.)"
                  className="flex-1 min-w-0 h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quick Batch Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyDueTasks}
                  onChange={(e) => setOnlyDueTasks(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Masquer les points déjà validés ce mois</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllConforme}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tout marquer Conforme ✅ ({filteredRoundTasks.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Checklist Body */}
        <form onSubmit={handleSubmitRound} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
            {filteredRoundTasks.length === 0 ? (
              <div className="py-12 px-4 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="text-sm font-bold text-slate-700">
                  Aucune tâche préventive Système Général trouvée pour ce filtre
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Assurez-vous que vos équipements de sécurité / utilités (Extincteurs, Compresseurs, Pompes) sont classés en « Système Général » dans le Parc Machines et disposent de tâches préventives.
                </p>
              </div>
            ) : (
              filteredRoundTasks.map((task, idx) => {
                const m =
                  machineMap.get(task.id_machine) ||
                  machineMap.get(String(task.id_machine || '').trim().toUpperCase());
                const sysTypeObj = generalSystemTypes.find(
                  (st: any) => st.id === m?.id_general_system_type
                );
                const st: RoundPointState = pointStates[task.id] || {
                  selected: true,
                  outcome: 'CONFORME',
                  anomalyNote: '',
                  triggerCorrectiveDi: true,
                  pdrRef: '',
                  pdrQty: 1,
                  numBon: '',
                };

                return (
                  <div
                    key={task.id || idx}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      !st.selected
                        ? 'bg-slate-50/60 border-slate-200 opacity-60'
                        : st.outcome === 'ANOMALIE'
                        ? 'bg-rose-50/40 border-rose-300 shadow-2xs'
                        : st.outcome === 'PDR'
                        ? 'bg-amber-50/40 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-indigo-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      {/* Left: Checkbox + Equipment & Task Info */}
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={st.selected}
                          onChange={(e) => updatePoint(task.id, { selected: e.target.checked })}
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md font-mono font-black text-xs bg-indigo-50 text-indigo-900 border border-indigo-200">
                              {task.id_machine}
                            </span>
                            {sysTypeObj && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                {sysTypeObj.code || sysTypeObj.id} • {sysTypeObj.name}
                              </span>
                            )}
                            <span className="font-bold text-xs text-slate-900 truncate">
                              {m?.designation || task.nom_machine || task.id_machine}
                            </span>
                            <span className="text-[10.5px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              Zone: {task.id_zone || m?.id_zone_default || 'Usine'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-1 flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-indigo-950">
                              Point : {task.composant || 'Contrôle Général'}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500">
                              {task.consigne || task.type_intervention || 'Vérification visuelle et fonctionnelle'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: 3 Instant Outcome Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() =>
                            updatePoint(task.id, { selected: true, outcome: 'CONFORME' })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                            st.selected && st.outcome === 'CONFORME'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Conforme ✅</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            updatePoint(task.id, { selected: true, outcome: 'ANOMALIE' })
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                            st.selected && st.outcome === 'ANOMALIE'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-rose-50 hover:text-rose-800'
                          }`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Anomalie ⚠️</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updatePoint(task.id, { selected: true, outcome: 'PDR' })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
                            st.selected && st.outcome === 'PDR'
                              ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>PDR utilisée 🔧</span>
                        </button>
                      </div>
                    </div>

                    {/* Inline Expansion for ANOMALIE */}
                    {st.selected && st.outcome === 'ANOMALIE' && (
                      <div className="mt-3 pt-2.5 border-t border-rose-200/80 flex flex-col sm:flex-row items-start sm:items-center gap-2.5 text-xs">
                        <input
                          type="text"
                          value={st.anomalyNote}
                          onChange={(e) => updatePoint(task.id, { anomalyNote: e.target.value })}
                          placeholder="Décrire l'anomalie constatée (ex: Manomètre hors zone verte, fuite soupape, goupille absente...)"
                          className="flex-1 w-full h-8 px-3 rounded-xl border border-rose-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-100/80 text-rose-900 font-bold text-[11px] shrink-0 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={st.triggerCorrectiveDi}
                            onChange={(e) =>
                              updatePoint(task.id, { triggerCorrectiveDi: e.target.checked })
                            }
                            className="rounded border-rose-400 text-rose-600"
                          />
                          <span>Créer DI Corrective auto.</span>
                        </label>
                      </div>
                    )}

                    {/* Inline Expansion for PDR UTILISÉE */}
                    {st.selected && st.outcome === 'PDR' && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="sm:col-span-1 flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <select
                            value={st.pdrRef}
                            onChange={(e) => updatePoint(task.id, { pdrRef: e.target.value })}
                            className="w-full h-8 px-2.5 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold text-slate-800"
                          >
                            <option value="">— Choisir Pièce PDR (Stock) —</option>
                            {(stockItems || []).map((item: any) => (
                              <option key={item.ref} value={item.ref}>
                                {item.ref} — {item.designation} (Stock: {item.stockActuel})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-amber-900 shrink-0">Qté:</span>
                          <input
                            type="number"
                            min={1}
                            value={st.pdrQty}
                            onChange={(e) =>
                              updatePoint(task.id, { pdrQty: Math.max(1, Number(e.target.value)) })
                            }
                            className="w-20 h-8 px-2.5 rounded-xl border border-amber-300 bg-white text-xs font-mono font-bold"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-amber-900 shrink-0">N° Bon:</span>
                          <input
                            type="text"
                            value={st.numBon}
                            onChange={(e) => updatePoint(task.id, { numBon: e.target.value })}
                            placeholder={globalBonNumber || 'Ex: BS-2026-104'}
                            className="flex-1 h-8 px-2.5 rounded-xl border border-amber-300 bg-white text-xs font-mono"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="font-bold text-slate-700">
                Sélectionnés : <b className="font-mono text-indigo-700">{selectedTasksList.length}</b>
              </span>
              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px]">
                Conforme: {conformeCount}
              </span>
              {anomalieCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono font-bold text-[11px]">
                  Anomalies: {anomalieCount}
                </span>
              )}
              {pdrCount > 0 && (
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-mono font-bold text-[11px]">
                  Avec PDR: {pdrCount}
                </span>
              )}
              {isTechUser && (
                <span className="text-[11px] text-purple-700 font-semibold">
                  • Soumission Maker-Checker (sans déstockage immédiat)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={selectedTasksList.length === 0}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black transition shadow-md flex items-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>
                  {isTechUser
                    ? `Soumettre la Ronde (${selectedTasksList.length} points)`
                    : `Valider la Ronde (${selectedTasksList.length} points)`}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
