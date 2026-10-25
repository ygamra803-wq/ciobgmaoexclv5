import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  CheckCircle,
  Wrench,
  Package,
  Timer,
  Play,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Plus,
  Trash2,
  Cpu,
  AlertTriangle,
} from 'lucide-react';
import { CorrectiveCalculationService } from '../../../domain/corrective/services/CorrectiveCalculationService';
import { stockIndexStore } from '../../../application/StockIndexStore';
import { isWarehouseComponent, isWarehousePart } from '../../../core/domain/EntrepotItem';
import { rankStockItemsByMachineBom } from '../../../core/domain';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { useI18n } from '../../../i18n/I18nContext';
import { useAuth } from '../../../context/AuthContext';
import {
  isTechnicianRole,
  matchesTechnicianRecord,
  getTechnicianBadgeLabel,
} from '../../../core/security/technicianScope';

export default function InterventionLiveTab({
  interventions = [],
  machines = [],
  technicians: _technicians = [],
  activeLiveId,
  setActiveLiveId,
  onSubmitForValidation,
  onClotureIntervention,
  onUpdateIntervention,
  onNavigateToTab,
  stockItems = [],
  warehouseItems = [],
  onAddMouvement: _onAddMouvement,
  actionsByPanne = {},
  travauxAFaire = [],
  getActionsForPanne: getActionsForPanneProp,
  onAddActionForPanne: _onAddActionForPanne,
  showToast,
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);
  const blueprints = useGmaoStore((s) => s.blueprints);
  const machineElementsLedger = useGmaoStore((s) => s.machineElementsLedger);
  const storeSubmitForValidation = useGmaoStore((s) => s.handleSubmitInterventionForValidation);
  // Sync with reactive StockIndexStore for real-time stock balances
  useSyncExternalStore(stockIndexStore.subscribeAll, stockIndexStore.getGlobalVersion);

  const scopedInterventions = useMemo(() => {
    if (!isTechUser) return interventions;
    return (interventions || []).filter((i) => matchesTechnicianRecord(i, user, _technicians));
  }, [interventions, isTechUser, user, _technicians]);

  // Active intervention object
  const activeIntervention = useMemo(() => {
    if (!activeLiveId) {
      // Pick first in_progress BT not already pending validation if none explicitly active
      return (
        scopedInterventions.find(
          (i) =>
            (i.statut === 'EN_COURS' || i.statut === 'BT_PLANIFIE') &&
            i.num_bt &&
            i.validation_status !== 'PENDING_VALIDATION'
        ) ||
        scopedInterventions.find(
          (i) => (i.statut === 'EN_COURS' || i.statut === 'BT_PLANIFIE') && i.num_bt
        ) ||
        null
      );
    }
    return scopedInterventions.find((i) => i.id === activeLiveId) || null;
  }, [scopedInterventions, activeLiveId]);

  // Fast Machine Lookup Map
  const machineMap = useMemo(() => {
    const map = new Map();
    (machines || []).forEach((m) => {
      const id = m.id_machine_registered || m.id;
      if (id) map.set(id, m);
    });
    return map;
  }, [machines]);

  // Real-time ticking chronometer
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 1000); // 1s tick for smooth live chrono
    return () => clearInterval(timer);
  }, []);

  // Live calculated industrial working time
  const liveWorkingTime = useMemo(() => {
    if (!activeIntervention?.date_debut || !activeIntervention?.heure_debut) {
      const now = new Date(currentTimestamp);
      const todayStr = now.toISOString().split('T')[0];
      const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      return CorrectiveCalculationService.calculateWorkingTime(
        todayStr,
        '08:00',
        todayStr,
        nowTimeStr
      );
    }
    const now = new Date(currentTimestamp);
    const todayStr = now.toISOString().split('T')[0];
    const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return CorrectiveCalculationService.calculateWorkingTime(
      activeIntervention.date_debut,
      activeIntervention.heure_debut,
      todayStr,
      nowTimeStr
    );
  }, [activeIntervention, currentTimestamp]);

  // Current shift status banner
  const shiftStatus = useMemo(() => {
    const now = new Date(currentTimestamp);
    const h = now.getHours();
    const m = now.getMinutes();
    const currentM = h * 60 + m;

    if (now.getDay() === 0) {
      return {
        label: 'Dimanche (Jour Non Ouvré) · Hors Shift',
        color: 'text-slate-500 bg-slate-100 border-slate-200',
      };
    }
    if (currentM >= 480 && currentM < 795) {
      return {
        label: 'Shift Matin (08:00 - 13:15) · Décompte Actif',
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200 animate-pulse',
      };
    }
    if (currentM >= 795 && currentM < 840) {
      return {
        label: 'Pause Déjeuner (13:15 - 14:00) · 45 min Déduites Automatiquement',
        color: 'text-amber-800 bg-amber-50 border-amber-200',
      };
    }
    if (currentM >= 840 && currentM < 1020) {
      return {
        label: 'Shift Après-Midi (14:00 - 17:00) · Décompte Actif',
        color: 'text-emerald-800 bg-emerald-50 border-emerald-200 animate-pulse',
      };
    }
    return {
      label: 'Hors Shift Usine (Après 17:00) · Chronomètre Figé jusqu’à 08:00',
      color: 'text-slate-600 bg-slate-100 border-slate-200',
    };
  }, [currentTimestamp]);

  // Form State for closing or modifying the live intervention
  const [formState, setFormState] = useState<any>({
    travail_a_faire: '',
    action_realisee: '',
    pdr_ref: '',
    pdr_designation: '',
    pdr_quantite: 1,
    marque: '',
    etat_piece: 'Neuve',
    arret_machine: true,
    temps_arret: '',
    pieces_utilisees: [],
    num_bon_saisi_par_tech: '',
    id_composant: '',
    nom_composant: '',
    id_part: '',
    nom_part: '',
    statut_composant_cloture: 'En service',
  });

  // Autocomplete suggestions
  const [travailSearch, setTravailSearch] = useState('');
  const [showTravailSuggestions, setShowTravailSuggestions] = useState(false);

  // Sync initial values when active intervention changes
  useEffect(() => {
    if (activeIntervention) {
      const initialPieces =
        Array.isArray(activeIntervention.pieces_utilisees) &&
        activeIntervention.pieces_utilisees.length > 0
          ? activeIntervention.pieces_utilisees
          : Array.isArray(activeIntervention.pieces_proposees) &&
            activeIntervention.pieces_proposees.length > 0
          ? activeIntervention.pieces_proposees
          : [];
      setFormState({
        travail_a_faire: activeIntervention.travail_a_faire || '',
        action_realisee: activeIntervention.action_realisee || '',
        pdr_ref: activeIntervention.pdr_ref || activeIntervention.pdr || '',
        pdr_designation: activeIntervention.pdr_designation || '',
        pdr_quantite: activeIntervention.pdr_quantite || 1,
        marque: activeIntervention.marque || '',
        etat_piece: activeIntervention.etat_piece || 'Neuve',
        arret_machine: Boolean(activeIntervention.arret_machine),
        temps_arret: activeIntervention.temps_arret || '',
        pieces_utilisees: initialPieces,
        num_bon_saisi_par_tech: activeIntervention.num_bon_saisi_par_tech || '',
        id_composant: activeIntervention.id_composant || '',
        nom_composant: activeIntervention.nom_composant || '',
        id_part: activeIntervention.id_part || '',
        nom_part: activeIntervention.nom_part || '',
        statut_composant_cloture: activeIntervention.statut_composant_cloture || 'En service',
      });
      setTravailSearch(activeIntervention.travail_a_faire || '');
    }
  }, [activeIntervention]);

  // Machine components from Entrepôt for optional component lifecycle tracking
  const machineComponents = useMemo(() => {
    if (!activeIntervention?.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(activeIntervention.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || w.machine_id || '').trim().toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehouseComponent(w);
    });
  }, [activeIntervention?.code_machine, warehouseItems]);

  // Machine structural parts (Localization sites — no stock deduction)
  const machineParts = useMemo(() => {
    if (!activeIntervention?.code_machine || !Array.isArray(warehouseItems)) return [];
    const code = String(activeIntervention.code_machine).trim().toUpperCase();
    return warehouseItems.filter((w) => {
      const wMach = String(w.id_machine_registered || w.id_machine || w.machine_id || '').trim().toUpperCase();
      return (wMach === code || wMach.includes(code)) && isWarehousePart(w);
    });
  }, [activeIntervention?.code_machine, warehouseItems]);

  // Filtered standard phrases from travauxAFaire prop
  const filteredSuggestions = useMemo(() => {
    if (!travailSearch) return (travauxAFaire || []).slice(0, 15);
    const term = travailSearch.toLowerCase();
    return (travauxAFaire || [])
      .filter((item) => String(item).toLowerCase().includes(term))
      .slice(0, 20);
  }, [travailSearch, travauxAFaire]);

  // Suggested solutions specifically linked to this failure anomaly (normalized lookup from prop/seed registry)
  const smartAnomalyActions = useMemo(() => {
    if (!activeIntervention?.anomalie) return [];
    if (typeof getActionsForPanneProp === 'function') {
      return getActionsForPanneProp(activeIntervention.anomalie);
    }
    const anom = String(activeIntervention.anomalie);
    if (actionsByPanne[anom]) return actionsByPanne[anom];
    const withUnder = anom.replace(/\s+/g, '_');
    if (actionsByPanne[withUnder]) return actionsByPanne[withUnder];
    const withSpace = anom.replace(/_/g, ' ');
    if (actionsByPanne[withSpace]) return actionsByPanne[withSpace];
    const lower = anom.toLowerCase().replace(/_/g, ' ').trim();
    for (const [key, acts] of Object.entries(actionsByPanne)) {
      if (key.toLowerCase().replace(/_/g, ' ').trim() === lower) {
        return acts;
      }
    }
    for (const [key, acts] of Object.entries(actionsByPanne)) {
      const normKey = key.toLowerCase().replace(/_/g, ' ').trim();
      if (normKey.includes(lower) || lower.includes(normKey)) {
        return acts;
      }
    }
    return [];
  }, [activeIntervention, actionsByPanne, getActionsForPanneProp]);

  // Filtered & BOM-Ranked Stock Items for PDR lookup (P2)
  const [pdrSearch, setPdrSearch] = useState('');
  const [showPdrList, setShowPdrList] = useState(false);

  const rankedMachineStockItems = useMemo(() => {
    return rankStockItemsByMachineBom(
      activeIntervention?.code_machine,
      stockItems,
      machines,
      blueprints,
      formState.id_composant || formState.nom_composant || formState.id_part || formState.nom_part,
      undefined,
      machineElementsLedger
    );
  }, [
    activeIntervention?.code_machine,
    stockItems,
    machines,
    blueprints,
    formState.id_composant,
    formState.nom_composant,
    formState.id_part,
    formState.nom_part,
    machineElementsLedger,
  ]);

  const matchedStockItems = useMemo(() => {
    if (!pdrSearch.trim()) return rankedMachineStockItems.slice(0, 12);
    const term = pdrSearch.toLowerCase().trim();
    return rankedMachineStockItems
      .filter(
        (s) =>
          String(s.ref || s.code_article || '').toLowerCase().includes(term) ||
          String(s.designation || s.nom || '').toLowerCase().includes(term) ||
          String(s.type || s.famille || '').toLowerCase().includes(term) ||
          String(s.marque || '').toLowerCase().includes(term)
      )
      .slice(0, 15);
  }, [rankedMachineStockItems, pdrSearch]);

  // Handle Select PDR
  const handleSelectPdr = (item) => {
    const stockQty = item.stockActuel ?? item.stock_actuel ?? item.quantite ?? 0;
    setFormState((prev) => ({
      ...prev,
      pdr_ref: item.ref || item.code_article,
      pdr_designation: item.designation || item.nom,
      pdr_prix: item.prix || item.prix_unitaire || 0,
      pdr_unite: item.unite || 'Pièce',
      pdr_stock_actuel: stockQty,
      marque: item.marque || prev.marque || 'Origine',
    }));
    setPdrSearch(`${item.ref || item.code_article} - ${item.designation || item.nom}`);
    setShowPdrList(false);
  };

  // Add currently selected PDR to pieces_utilisees list (Multi-PDR support)
  const handleAddPieceToList = () => {
    const ref = String(formState.pdr_ref || '').trim();
    const qty = Number(formState.pdr_quantite || 0);
    if (!ref || !(qty > 0)) {
      showToast?.('Veuillez sélectionner un article PDR et une quantité valide.', 'warning');
      return;
    }
    setFormState((prev) => {
      const currentList = Array.isArray(prev.pieces_utilisees) ? [...prev.pieces_utilisees] : [];
      const existingIdx = currentList.findIndex(
        (p) => String(p.ref || '').toUpperCase() === ref.toUpperCase()
      );
      if (existingIdx >= 0) {
        currentList[existingIdx] = {
          ...currentList[existingIdx],
          quantite: Number(currentList[existingIdx].quantite || 0) + qty,
        };
      } else {
        currentList.push({
          ref,
          designation: prev.pdr_designation || ref,
          quantite: qty,
          prix_unitaire: Number(prev.pdr_prix || 0),
          unite: prev.pdr_unite || 'Pièce',
          marque: prev.marque || '',
          etat_piece: prev.etat_piece || 'Neuve',
        });
      }
      return {
        ...prev,
        pieces_utilisees: currentList,
        pdr_ref: '',
        pdr_designation: '',
        pdr_quantite: 1,
        pdr_stock_actuel: undefined,
      };
    });
    setPdrSearch('');
  };

  const handleRemovePieceFromList = (refToRemove: string) => {
    setFormState((prev) => ({
      ...prev,
      pieces_utilisees: (prev.pieces_utilisees || []).filter(
        (p: any) => String(p.ref || '').toUpperCase() !== String(refToRemove || '').toUpperCase()
      ),
    }));
  };

  // Handle Clôture / Validation Submit (Maker-Checker V1+V2)
  const handleClotureSubmit = (e) => {
    e.preventDefault();
    if (!activeIntervention) {
      showToast?.('Aucune intervention active sélectionnée', 'warning');
      return;
    }

    const now = new Date();
    const dateFin = now.toISOString().split('T')[0];
    const heureFin = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const targetMachine = machineMap.get(activeIntervention.code_machine);
    const machineZone =
      targetMachine?.id_zone_default ||
      targetMachine?.id_zone ||
      activeIntervention.zone ||
      'Atelier';
    const machineDesignation =
      targetMachine?.designation || activeIntervention.code_machine;

    // 1. TECHNICIAN PATH: Submit field claim for validation WITHOUT closing or deducting stock
    if (isTechUser) {
      const submitFn = onSubmitForValidation || storeSubmitForValidation;
      if (typeof submitFn === 'function') {
        const submittedResult = submitFn(activeIntervention.id, {
          ...formState,
          pieces_proposees: formState.pieces_utilisees,
          num_bon_saisi_par_tech: formState.num_bon_saisi_par_tech,
          zone: machineZone,
          machine_designation: machineDesignation,
          date_fin_proposee: dateFin,
          heure_fin_proposee: heureFin,
          temps_intervention_propose: liveWorkingTime.formatted,
          temps_intervention_mins_propose: liveWorkingTime.minutes,
          submitted_by_id: user?.personnelId || user?.code || user?.id || '',
          submitted_by_name: getTechnicianBadgeLabel(user, _technicians),
          submitted_at: now.toISOString(),
        });

        if (submittedResult === null) {
          showToast?.(
            'Soumission refusée : vérifiez le travail réalisé ou le statut du Bon de Travail.',
            'warning'
          );
          return;
        }
      } else if (typeof onUpdateIntervention === 'function') {
        onUpdateIntervention(activeIntervention.id, {
          ...formState,
          pieces_proposees: formState.pieces_utilisees,
          pieces_utilisees: [],
          pdr_ref: '',
          pdr_quantite: 0,
          num_bon_saisi_par_tech: formState.num_bon_saisi_par_tech,
          date_fin_proposee: dateFin,
          heure_fin_proposee: heureFin,
          temps_intervention_propose: liveWorkingTime.formatted,
          temps_intervention_mins_propose: liveWorkingTime.minutes,
          validation_status: 'PENDING_VALIDATION',
          submitted_by_id: user?.personnelId || user?.code || user?.id || '',
          submitted_by_name: getTechnicianBadgeLabel(user, _technicians),
          submitted_at: now.toISOString(),
          action_fermee: 'NON',
          statut: 'EN_COURS',
        });
      }

      showToast?.(
        `Déclaration BT ${activeIntervention.num_bt || activeIntervention.code_machine} soumise pour validation responsable (aucun déstockage immédiat)`,
        'info'
      );

      setActiveLiveId?.(null);
      if (onNavigateToTab) {
        onNavigateToTab('corrective_bt');
      }
      return;
    }

    // 2. ADMIN / SUPERVISOR PATH: Direct approved closure & single stock deduction
    const closedResult = onClotureIntervention(activeIntervention.id, {
      ...formState,
      zone: machineZone,
      machine_designation: machineDesignation,
      date_fin: activeIntervention.date_fin_proposee || dateFin,
      heure_fin: activeIntervention.heure_fin_proposee || heureFin,
      temps_intervention_calc: liveWorkingTime.formatted,
      temps_intervention_mins: liveWorkingTime.minutes,
      temps_minutes: liveWorkingTime.minutes,
      validation_status: 'APPROVED',
      validated_by_id: user?.id || user?.code || 'admin',
      validated_by_name: user?.name || 'Administrateur',
      validated_at: now.toISOString(),
      statut: 'CLOTURE',
      action_fermee: 'OUI',
    });

    if (closedResult === null) {
      showToast?.(
        'Transition refusée : vérifiez le travail réalisé ou le statut du Bon de Travail.',
        'warning'
      );
      return;
    }

    showToast?.(
      `Intervention ${activeIntervention.num_bt || activeIntervention.code_machine} validée et clôturée (${liveWorkingTime.formatted} ouvré)`,
      'success'
    );

    setActiveLiveId?.(null);
    if (onNavigateToTab) {
      onNavigateToTab('corrective_cloture');
    }
  };

  if (!activeIntervention) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-12 text-center shadow-xs space-y-4 max-w-2xl mx-auto">
        <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
          <Play className="w-8 h-8 fill-current text-amber-600" />
        </div>
        <h3 className="text-lg font-black text-slate-900 tracking-tight">
          {t('corrective.live.no_live')}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          {t('corrective.live.select_bt')}
        </p>
        <button
          onClick={() => onNavigateToTab?.('corrective_bt')}
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-amber-600/25 active:scale-95 inline-flex items-center gap-2"
        >
          <Wrench className="w-4 h-4" />
          <span>{t('corrective.tabs.bt')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Live Chronometer & Shift Status Console */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-5 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-300/80 flex items-center justify-center text-amber-700 shadow-xs">
              <Timer className="w-6 h-6 text-amber-700 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-black text-slate-900 tracking-tight">
                  {t('corrective.live.title')}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                  EN DIRECT
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Machine : <b className="text-slate-800">{activeIntervention.code_machine}</b> • BT :{' '}
                <b className="text-blue-700">{activeIntervention.num_bt || 'BT-4825'}</b> • Intervenant :{' '}
                <b className="text-slate-800">{activeIntervention.intervenant || 'm_hammed'}</b>
              </p>
            </div>
          </div>

          {/* Shift status badge */}
          <div
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 self-start md:self-auto ${shiftStatus.color}`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{shiftStatus.label}</span>
          </div>
        </div>

        {/* Big Digital Stopwatch Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-gradient-to-br from-slate-950 to-slate-900 text-white rounded-2xl p-6 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-6 border border-slate-800">
            <div className="space-y-1 text-center sm:text-left">
              <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1.5 justify-center sm:justify-start">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                <span>Temps Réel Ouvré Payé (Excel)</span>
              </div>
              <div className="text-4xl sm:text-5xl font-mono font-black tracking-tight text-white drop-shadow-md">
                {liveWorkingTime.formatted}
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {liveWorkingTime.minutes} minutes effectives (Pauses déduites)
              </p>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 text-xs font-mono space-y-1.5 text-slate-300 w-full sm:w-auto">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Début :</span>
                <span className="font-bold text-white">
                  {activeIntervention.date_debut || '2026-03-24'} à {activeIntervention.heure_debut || '08:00'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Pause Midi :</span>
                <span className="text-amber-400 font-bold">-00h 45m</span>
              </div>
              <div className="flex justify-between gap-4 pt-1 border-t border-slate-700">
                <span className="text-slate-400">Plage usine :</span>
                <span className="text-emerald-400 font-bold">08:00 - 17:00</span>
              </div>
            </div>
          </div>

          <div className="bg-amber-50/80 rounded-2xl p-5 border border-amber-200/80 flex flex-col justify-between space-y-3">
            <div>
              <span className="text-[10.5px] font-extrabold text-amber-950 uppercase tracking-wider block">
                Anomalie Constatée (Col J)
              </span>
              <p className="font-black text-slate-900 text-sm mt-1 font-mono">
                {activeIntervention.anomalie || 'court_circuit'}
              </p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-800">
                <span className="font-bold">Type :</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-200/60 font-mono font-bold">
                  {activeIntervention.type_panne || 'E'}
                </span>
              </div>
            </div>

            {smartAnomalyActions.length > 0 && (
              <div className="pt-2 border-t border-amber-200 text-[11px]">
                <span className="font-bold text-amber-900 block mb-1">Actions Fréquentes Liées :</span>
                <div className="flex flex-wrap gap-1">
                  {smartAnomalyActions.slice(0, 2).map((act, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormState((p) => ({ ...p, action_realisee: act }))}
                      className="px-2 py-0.5 rounded-md bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-medium text-[10px] cursor-pointer transition shadow-2xs"
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clarification / Pending Validation Alert Banner */}
      {(activeIntervention.validation_status === 'NEEDS_CLARIFICATION' ||
        activeIntervention.validation_status === 'REJECTED') && (
        <div
          data-testid="live-clarification-banner"
          className="bg-rose-50 border border-rose-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-950 shadow-xs"
        >
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-black uppercase tracking-wider text-rose-900">
              {activeIntervention.validation_status === 'REJECTED'
                ? 'Déclaration Rejetée — Correction Requise'
                : 'Clarification Demandée par le Responsable'}
            </div>
            <p className="font-semibold text-rose-800">
              {activeIntervention.validation_note ||
                'Veuillez vérifier les pièces proposées, le numéro de bon ou la description du travail réalisé.'}
            </p>
            {activeIntervention.validated_by_name && (
              <p className="text-[11px] text-rose-700 font-mono">
                Contrôlé par : {activeIntervention.validated_by_name}
              </p>
            )}
          </div>
        </div>
      )}

      {activeIntervention.validation_status === 'PENDING_VALIDATION' && (
        <div
          data-testid="live-pending-validation-banner"
          className="bg-purple-50 border border-purple-300 rounded-2xl p-4 flex items-start gap-3 text-xs text-purple-950 shadow-xs"
        >
          <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-black uppercase tracking-wider text-purple-900">
              En attente de validation responsable (Aucun déstockage effectué)
            </div>
            <p className="text-purple-800 font-medium">
              {isTechUser
                ? 'Votre déclaration a été transmise. Vous pouvez encore rectifier les informations ci-dessous et renvoyer.'
                : `Déclaration soumise par ${activeIntervention.submitted_by_name || activeIntervention.intervenant || 'le technicien'}. Vérifiez les pièces proposées et validez pour clôturer et déduire le stock.`}
            </p>
          </div>
        </div>
      )}

      {/* 2. Clôture Form & PDR Consumption Card */}
      <form
        onSubmit={handleClotureSubmit}
        className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-6"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-2xs">
              <FileCheck className="w-4 h-4 text-emerald-700" />
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                {isTechUser
                  ? 'Déclaration d’Intervention & Proposition Pièce de Rechange (PDR)'
                  : 'Rapport de Clôture & Sortie Pièce de Rechange (PDR)'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isTechUser
                  ? 'Saisie terrain soumise à validation • Aucun déstockage magasin avant approbation Admin'
                  : 'Liaisons Excel Colonnes K, L, M, N • Déstockage direct et traçabilité industrielle'}
              </p>
            </div>
          </div>
        </div>

        {/* Travail à faire & Suggestions d'Atelier */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Travail à Faire / Action Réalisée (Col K) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={formState.action_realisee || formState.travail_a_faire}
              onChange={(e) => {
                const val = e.target.value;
                setFormState((p) => ({ ...p, action_realisee: val, travail_a_faire: val }));
                setTravailSearch(val);
                setShowTravailSuggestions(true);
              }}
              onFocus={() => setShowTravailSuggestions(true)}
              placeholder="Ex: Démonter vis sans fin, vérification circuit de commande, changement huile..."
              className="w-full py-2.5 px-3.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-amber-400 focus:outline-hidden transition"
            />

            {/* Dropdown Suggestions */}
            {showTravailSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-2xl border border-slate-200 shadow-xl max-h-48 overflow-y-auto p-2 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-400 px-2 py-1">
                  Suggestions Base Usine (143 phrases types) :
                </div>
                {filteredSuggestions.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setFormState((p) => ({ ...p, action_realisee: item, travail_a_faire: item }));
                      setTravailSearch(item);
                      setShowTravailSuggestions(false);
                    }}
                    className="p-2 text-xs rounded-lg hover:bg-amber-50 text-slate-800 cursor-pointer font-medium transition"
                  >
                    {item}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* PDR (Pièce de Rechange) Autocomplete & Details */}
        <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-cyan-700" />
              Pièce de Rechange Utilisée (Col L) & Sortie Magasin
            </span>
            <span className="text-[10px] font-mono text-cyan-800 bg-cyan-100 px-2 py-0.5 rounded-full font-bold">
              Liaison Stock_Actuel
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search PDR in Stock */}
            <div className="relative sm:col-span-2">
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                Rechercher Article PDR au Magasin
              </label>
              <input
                type="text"
                value={pdrSearch}
                onChange={(e) => {
                  setPdrSearch(e.target.value);
                  setShowPdrList(true);
                }}
                onFocus={() => setShowPdrList(true)}
                placeholder="Ex: ROULEMENT, COURROIE, CAPTEUR..."
                className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden transition"
              />

              {showPdrList && matchedStockItems.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-white rounded-2xl border border-cyan-200 shadow-xl max-h-48 overflow-y-auto p-2 space-y-1">
                  {matchedStockItems.map((item) => {
                    const dispo = item.stockActuel ?? item.stock_actuel ?? item.quantite ?? 0;
                    return (
                      <div
                        key={item.ref || item.code_article}
                        onClick={() => handleSelectPdr(item)}
                        className="p-2 text-xs rounded-lg hover:bg-cyan-50 text-slate-800 cursor-pointer font-medium transition flex items-center justify-between"
                      >
                        <div className="min-w-0 pr-2 flex items-center gap-1.5 flex-wrap">
                          {item.isBomRecommended && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold text-[10px] shrink-0">
                              ★ {item.bomSourceLabel || 'BOM'}
                            </span>
                          )}
                          <span className="font-mono font-bold text-cyan-900">{item.ref || item.code_article}</span>
                          <span className="text-slate-600 truncate">{item.designation || item.nom}</span>
                        </div>
                        <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                          dispo > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-rose-700 bg-rose-50 border-rose-200'
                        }`}>
                          Dispo: {dispo}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Real-time Selected PDR Confirmation & Stock Badge */}
              {formState.pdr_ref && (
                <div className="mt-2 p-2.5 rounded-xl bg-cyan-50/70 border border-cyan-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-300">
                      {formState.pdr_ref}
                    </span>
                    <span className="font-semibold text-slate-800 truncate">
                      {formState.pdr_designation}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                      Number(formState.pdr_quantite) > Number(formState.pdr_stock_actuel)
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    }`}>
                      Stock: {formState.pdr_stock_actuel ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setFormState((prev) => ({
                          ...prev,
                          pdr_ref: '',
                          pdr_designation: '',
                          pdr_stock_actuel: undefined,
                        }));
                        setPdrSearch('');
                      }}
                      className="text-[11px] text-slate-400 hover:text-rose-600 font-bold underline cursor-pointer"
                    >
                      Effacer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quantité Sortie + Bouton Ajouter Multi-PDR */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                Quantité Utilisée
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={formState.pdr_quantite}
                  onChange={(e) => setFormState({ ...formState, pdr_quantite: Number(e.target.value) })}
                  className="w-full py-2 px-3 text-xs font-mono font-bold rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddPieceToList}
                  disabled={!formState.pdr_ref}
                  title="Ajouter cette pièce à la liste multi-PDR du Bon de Travail"
                  className="px-3 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs transition cursor-pointer shrink-0 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>
            </div>
          </div>

          {/* Multi-PDR Consumed List (pieces_utilisees) */}
          {Array.isArray(formState.pieces_utilisees) && formState.pieces_utilisees.length > 0 && (
            <div className="p-3 rounded-xl bg-white/90 border border-cyan-200 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-cyan-950">
                <span>Pièces sélectionnées pour sortie magasin ({formState.pieces_utilisees.length}) :</span>
                <span className="font-mono text-cyan-700">
                  Total Qte: {formState.pieces_utilisees.reduce((s: number, p: any) => s + Number(p.quantite || 0), 0)}
                </span>
              </div>
              <div className="space-y-1.5">
                {formState.pieces_utilisees.map((piece: any) => (
                  <div
                    key={piece.ref}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-cyan-50/70 border border-cyan-200/80 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-cyan-950 bg-white px-2 py-0.5 rounded border border-cyan-300">
                        {piece.ref}
                      </span>
                      <span className="font-medium text-slate-700 truncate">
                        {piece.designation}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono font-black text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded">
                        × {piece.quantite} {piece.unite || 'Pièce'}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePieceFromList(piece.ref)}
                        className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer transition"
                        title="Retirer de la liste"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Marque */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                Marque de la Pièce (Col M)
              </label>
              <input
                type="text"
                value={formState.marque}
                onChange={(e) => setFormState({ ...formState, marque: e.target.value })}
                placeholder="Ex: SKF, Schneider, Festo, Omron..."
                className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
              />
            </div>

            {/* État de la Pièce */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                État Pièce (Col N)
              </label>
              <select
                value={formState.etat_piece}
                onChange={(e) => setFormState({ ...formState, etat_piece: e.target.value })}
                className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
              >
                <option value="Neuve">Neuve (Neuf usine)</option>
                <option value="Occasion">Occasion (Reconditionnée)</option>
                <option value="Réparée">Réparée sur place</option>
              </select>
            </div>

            {/* N° Bon Saisi par le Technicien (Optionnel — V2) */}
            <div>
              <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                N° Bon Magasin (Optionnel · Terrain)
              </label>
              <input
                type="text"
                value={formState.num_bon_saisi_par_tech || ''}
                onChange={(e) =>
                  setFormState({ ...formState, num_bon_saisi_par_tech: e.target.value })
                }
                placeholder="Ex: BS-2026-0412 (pour contrôle)"
                className="w-full py-2 px-3 text-xs font-mono font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Organe / Composant (Cycle de vie) & Part (Localisation Structurelle — Sans déstockage) */}
          {(machineComponents.length > 0 ||
            machineParts.length > 0 ||
            formState.id_composant ||
            formState.id_part) && (
            <div className="pt-3 border-t border-cyan-200/70 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                  <Cpu className="w-3.5 h-3.5 text-cyan-700" />
                  <span>Organe / Composant (Cycle de vie)</span>
                </label>
                <select
                  value={formState.id_composant || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = machineComponents.find(
                      (c: any) => String(c.id_warehouse_item || c.id || c.id_item) === val
                    );
                    setFormState({
                      ...formState,
                      id_composant: val,
                      nom_composant: found
                        ? String(found.designation || found.nom_composant || found.nom || val)
                        : '',
                    });
                  }}
                  className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
                >
                  <option value="">— Aucun composant spécifique —</option>
                  {machineComponents.map((comp: any) => {
                    const cId = comp.id_warehouse_item || comp.id || comp.id_item;
                    return (
                      <option key={cId} value={cId}>
                        {cId} · {comp.designation || comp.nom || 'Composant'} ({comp.status || 'En service'})
                      </option>
                    );
                  })}
                </select>
              </div>
              {formState.id_composant && (
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                    État du Composant après clôture
                  </label>
                  <select
                    value={formState.statut_composant_cloture || 'En service'}
                    onChange={(e) =>
                      setFormState({ ...formState, statut_composant_cloture: e.target.value })
                    }
                    className="w-full py-2 px-3 text-xs font-bold rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
                  >
                    <option value="En service">En service (Opérationnel sur machine)</option>
                    <option value="En réparation">En réparation (Déposé atelier / révision)</option>
                    <option value="Hors service">Hors service (À réformer / remplacer)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-600 uppercase mb-1">
                  Localisation / Part Structurelle (Sans déstockage)
                </label>
                <select
                  value={formState.id_part || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const found = machineParts.find(
                      (p: any) => String(p.id_warehouse_item || p.id || p.id_item) === val
                    );
                    setFormState({
                      ...formState,
                      id_part: val,
                      nom_part: found
                        ? String(found.designation_part || found.designation || found.nom || val)
                        : '',
                    });
                  }}
                  className="w-full py-2 px-3 text-xs font-medium rounded-xl border border-cyan-200 bg-white focus:border-cyan-400 focus:outline-hidden"
                >
                  <option value="">— Aucun site structurel —</option>
                  {machineParts.map((part: any) => {
                    const pId = part.id_warehouse_item || part.id || part.id_item;
                    return (
                      <option key={pId} value={pId}>
                        {pId} · {part.designation_part || part.designation || part.nom || 'Part'}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal / Form Submit Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setActiveLiveId(null);
                showToast?.(`Intervention ${activeIntervention.num_bt || ''} mise en pause.`, 'info');
                onNavigateToTab?.('corrective_bt');
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer w-full sm:w-auto"
            >
              Mettre en Pause / Quitter
            </button>

            {typeof onUpdateIntervention === 'function' && (
              <button
                type="button"
                onClick={() => {
                  onUpdateIntervention(activeIntervention.id, {
                    ...formState,
                    statut: 'EN_ATTENTE_PDR',
                  });
                  setActiveLiveId(null);
                  showToast?.(
                    `BT ${activeIntervention.num_bt || activeIntervention.id} suspendu en attente de pièce (EN_ATTENTE_PDR).`,
                    'warning'
                  );
                  onNavigateToTab?.('corrective_bt');
                }}
                className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 font-bold text-xs text-amber-900 cursor-pointer w-full sm:w-auto"
              >
                Suspendre (Attente PDR)
              </button>
            )}
          </div>

          <button
            type="submit"
            data-testid="live-submit-btn"
            className={`px-6 py-3 rounded-xl text-white font-bold text-xs transition cursor-pointer shadow-lg active:scale-95 flex items-center justify-center gap-2 w-full sm:w-auto ${
              isTechUser
                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/25'
                : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
            }`}
          >
            {isTechUser ? <ShieldCheck className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            <span>
              {isTechUser
                ? 'Soumettre pour Validation Responsable (Sans déstockage)'
                : "Clôturer l'Intervention & Valider le Rapport"}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
