import { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Wrench,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Search,
  FileText,
  Clock,
  User,
  Factory,
  X,
  Trash2,
  Layers,
  ArrowLeft,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useGmaoStore } from '../../../store/useGmaoStore';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { isTechnicianRole } from '../../../core/security/technicianScope';
import {
  reconcileFieldClaim,
  selectValidationCenterQueues,
} from '../../../core/security/validationReconciliation';
import { hasPreventiveExecutionAnomaly } from '../../../application/services/MachineHealthPassportService';

interface ValidationCenterViewProps {
  stockItems?: any[];
  machines?: any[];
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
  sortieDemands?: any[];
  onReviewCorrectiveValidation?: (id: string, decisionData: any, onAddMouvement?: any) => any;
  onReviewPreventiveValidation?: (id: string, decisionData: any, onAddMouvement?: any) => any;
  onReviewSortieDemandValidation?: (id: string, decisionData: any, onAddMouvement?: any) => any;
  onAddMouvement?: (mvt: any) => any;
  onNavigateToTab?: (tab: string) => void;
  showToast?: (msg: string, type?: string) => void;
}

export default function ValidationCenterView({
  stockItems: propStockItems,
  machines: _propMachines = [],
  mouvements: propMouvements,
  correctiveInterventions: propCorrective,
  preventiveExecutions: propPreventive,
  sortieDemands: propSortieDemands,
  onReviewCorrectiveValidation,
  onReviewPreventiveValidation,
  onReviewSortieDemandValidation,
  onAddMouvement,
  onNavigateToTab,
  showToast,
}: ValidationCenterViewProps) {
  const { user } = useAuth();
  const isTechUser = isTechnicianRole(user);
  const canAccess = !user || (!isTechUser && AuthorizationService.canAccessTab(user, 'validation_center'));

  // Fallbacks to Zustand SSOT store so the center is always live-synchronized
  const storeCorrective = useGmaoStore((s) => s.correctiveInterventions || []);
  const storePreventive = useGmaoStore((s) => s.preventiveExecutions || []);
  const storeSortieDemands = useGmaoStore((s) => s.sortieDemands || []);
  const storeMouvements = useGmaoStore((s) => s.mouvements || []);
  const storeRawStock = useGmaoStore((s) => s.rawStock || []);

  const storeReviewCorrective = useGmaoStore((s) => s.handleReviewInterventionValidation);
  const storeReviewPreventive = useGmaoStore((s) => s.handleReviewPreventiveExecutionValidation);
  const storeReviewSortieDemand = useGmaoStore((s) => s.handleReviewSortieDemandValidation);

  const correctiveInterventions = propCorrective ?? storeCorrective;
  const preventiveExecutions = propPreventive ?? storePreventive;
  const sortieDemands = propSortieDemands ?? storeSortieDemands;
  const mouvements = propMouvements ?? storeMouvements;
  const stockItems = propStockItems ?? storeRawStock;

  // UI Filters
  const [sectionFilter, setSectionFilter] = useState<'ALL' | 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE'>('ALL');
  const [includeClarifications, setIncludeClarifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showReservedDetails, setShowReservedDetails] = useState(false);

  // 1. Corrective Review Modal State
  const [reviewBt, setReviewBt] = useState<any | null>(null);
  const [btActionRealisee, setBtActionRealisee] = useState('');
  const [btPieces, setBtPieces] = useState<any[]>([]);
  const [btSkipStockDeduction, setBtSkipStockDeduction] = useState(false);
  const [btNote, setBtNote] = useState('');

  // 2. Preventive Review Modal State
  const [reviewExec, setReviewExec] = useState<any | null>(null);
  const [execSpares, setReviewExecSpares] = useState<any[]>([]);
  const [execSkipStockDeduction, setExecSkipStockDeduction] = useState(false);
  const [execCreateFollowUpDi, setExecCreateFollowUpDi] = useState(false);
  const [execFollowUpDiAnomalie, setExecFollowUpDiAnomalie] = useState('');
  const [execNote, setExecNote] = useState('');

  // 3. SortieDemand Review Modal State
  const [reviewDemand, setReviewDemand] = useState<any | null>(null);
  const [demandCodeBonMagasin, setDemandCodeBonMagasin] = useState('');
  const [demandMergeMovementId, setDemandMergeMovementId] = useState('');
  const [demandItems, setDemandItems] = useState<any[]>([]);
  const [demandNote, setDemandNote] = useState('');

  // Aggregate Queues via pure selector
  const queues = useMemo(
    () =>
      selectValidationCenterQueues({
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands,
      }),
    [correctiveInterventions, preventiveExecutions, sortieDemands]
  );

  const visibleCorrective = useMemo(() => {
    const base = includeClarifications
      ? [...queues.pendingCorrective, ...queues.clarificationCorrective]
      : queues.pendingCorrective;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((bt: any) => {
      const code = String(bt.num_bt || bt.id || '').toLowerCase();
      const machine = String(bt.code_machine || bt.nom_machine || '').toLowerCase();
      const tech = String(bt.submitted_by_name || bt.intervenant || '').toLowerCase();
      const anom = String(bt.action_realisee || bt.anomalie || bt.travail_a_faire || '').toLowerCase();
      const bon = String(bt.num_bon_saisi_par_tech || '').toLowerCase();
      return code.includes(q) || machine.includes(q) || tech.includes(q) || anom.includes(q) || bon.includes(q);
    });
  }, [queues, includeClarifications, searchQuery]);

  const visiblePreventive = useMemo(() => {
    const base = includeClarifications
      ? [...queues.pendingPreventive, ...queues.clarificationPreventive]
      : queues.pendingPreventive;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((ex: any) => {
      const code = String(ex.taskCode || ex.actionCode || ex.id || '').toLowerCase();
      const machine = String(ex.machineCode || ex.machineName || '').toLowerCase();
      const tech = String(ex.submitted_by_name || ex.executorName || '').toLowerCase();
      const organe = String(ex.organe || ex.taskDescription || ex.notes || '').toLowerCase();
      const bon = String(ex.num_bon_saisi_par_tech || '').toLowerCase();
      return code.includes(q) || machine.includes(q) || tech.includes(q) || organe.includes(q) || bon.includes(q);
    });
  }, [queues, includeClarifications, searchQuery]);

  const visibleSortieDemands = useMemo(() => {
    const base = includeClarifications
      ? [...queues.pendingSortieDemands, ...queues.clarificationSortieDemands]
      : queues.pendingSortieDemands;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((dem: any) => {
      const code = String(dem.code_bon_tech || dem.code_bon_magasin || dem.id || '').toLowerCase();
      const machine = String(dem.id_machine_registered || dem.id_zone || '').toLowerCase();
      const tech = String(dem.submitted_by_name || dem.technicien || '').toLowerCase();
      const comm = String(dem.commentaire || dem.motif || '').toLowerCase();
      return code.includes(q) || machine.includes(q) || tech.includes(q) || comm.includes(q);
    });
  }, [queues, includeClarifications, searchQuery]);

  // Active Modal Reconciliations
  const activeBtReconciliation = useMemo(() => {
    if (!reviewBt) return null;
    return reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: String(reviewBt.id),
      numBonSaisi: reviewBt.num_bon_saisi_par_tech,
      machineCode: reviewBt.code_machine,
      proposedSpares: btPieces,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
  }, [
    reviewBt,
    btPieces,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  ]);

  const activeExecReconciliation = useMemo(() => {
    if (!reviewExec) return null;
    return reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: String(reviewExec.id),
      numBonSaisi: reviewExec.num_bon_saisi_par_tech,
      machineCode: reviewExec.machineCode,
      proposedSpares: execSpares,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
  }, [
    reviewExec,
    execSpares,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  ]);

  const activeDemandReconciliation = useMemo(() => {
    if (!reviewDemand) return null;
    return reconcileFieldClaim({
      claimType: 'SORTIE',
      claimId: String(reviewDemand.id),
      numBonSaisi: reviewDemand.code_bon_tech,
      machineCode: reviewDemand.id_machine_registered,
      proposedSpares: demandItems,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
  }, [
    reviewDemand,
    demandItems,
    stockItems,
    mouvements,
    correctiveInterventions,
    preventiveExecutions,
    sortieDemands,
  ]);

  // Open & Submit Handlers for Section 1 (Corrective BT)
  const handleOpenBtModal = (bt: any) => {
    const initialPieces =
      Array.isArray(bt?.pieces_proposees) && bt.pieces_proposees.length > 0
        ? bt.pieces_proposees.map((p: any) => ({ ...p }))
        : Array.isArray(bt?.pieces_utilisees) && bt.pieces_utilisees.length > 0
        ? bt.pieces_utilisees.map((p: any) => ({ ...p }))
        : [];
    const rec = reconcileFieldClaim({
      claimType: 'CORRECTIVE',
      claimId: String(bt?.id || ''),
      numBonSaisi: bt?.num_bon_saisi_par_tech,
      machineCode: bt?.code_machine,
      proposedSpares: initialPieces,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
    setReviewBt(bt);
    setBtActionRealisee(bt?.action_realisee || bt?.travail_a_faire || '');
    setBtPieces(initialPieces);
    setBtSkipStockDeduction(Boolean(rec?.exactMovementMatch));
    setBtNote(bt?.validation_note || '');
  };

  const handleConfirmBtDecision = (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => {
    if (!reviewBt) return;
    if (
      (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') &&
      !String(btNote || '').trim()
    ) {
      showToast?.(
        'Veuillez saisir une note pour expliquer au technicien la clarification ou le motif du rejet.',
        'warning'
      );
      return;
    }

    const reviewFn = onReviewCorrectiveValidation || storeReviewCorrective;
    const result = reviewFn(
      reviewBt.id,
      {
        decision,
        action_realisee: btActionRealisee,
        travail_a_faire: btActionRealisee,
        pieces_utilisees: btPieces,
        pieces_proposees: btPieces,
        skipStockDeduction: btSkipStockDeduction,
        validation_note: btNote.trim(),
        validated_by_id: user?.id || user?.code || 'admin',
        validated_by_name: user?.name || user?.nom || 'Administrateur',
      },
      onAddMouvement
    );

    if (result === null) {
      showToast?.('Action impossible : vérifiez le statut du Bon de Travail.', 'warning');
      return;
    }

    if (decision === 'APPROVED') {
      showToast?.(
        btSkipStockDeduction
          ? `BT ${reviewBt.num_bt || reviewBt.id} validé et clôturé (coût imputé sur machine sans 2e déstockage).`
          : `BT ${reviewBt.num_bt || reviewBt.id} validé et clôturé (${btPieces.length} réf. déduite(s) du stock).`,
        'success'
      );
    } else if (decision === 'NEEDS_CLARIFICATION') {
      showToast?.(
        `Demande de clarification envoyée au technicien pour ${reviewBt.num_bt || reviewBt.id}.`,
        'warning'
      );
    } else {
      showToast?.(`Déclaration ${reviewBt.num_bt || reviewBt.id} rejetée (aucun déstockage).`, 'info');
    }

    setReviewBt(null);
  };

  // Open & Submit Handlers for Section 2 (Preventive Execution)
  const handleOpenExecModal = (exec: any) => {
    setReviewExec(exec);
    const initialSpares =
      Array.isArray(exec.sparesProposed) && exec.sparesProposed.length > 0
        ? exec.sparesProposed
        : Array.isArray(exec.sparesUsed)
        ? exec.sparesUsed
        : [];
    const mappedSpares = initialSpares.map((s: any) => ({
      ref: s.ref || s.reference || '',
      designation: s.designation || s.ref || 'Pièce PDR',
      qty: Math.max(1, Number(s.qty ?? s.quantite ?? 1)),
      unit: s.unit || s.unite || 'pcs',
      unitPrice: Number(s.unitPrice ?? s.prix_unitaire ?? 0),
    }));
    const rec = reconcileFieldClaim({
      claimType: 'PREVENTIVE',
      claimId: String(exec?.id || ''),
      numBonSaisi: exec?.num_bon_saisi_par_tech,
      machineCode: exec?.machineCode,
      proposedSpares: mappedSpares,
      stockItems,
      mouvements,
      correctiveInterventions,
      preventiveExecutions,
      sortieDemands,
    });
    setReviewExecSpares(mappedSpares);
    setExecSkipStockDeduction(Boolean(rec?.exactMovementMatch));
    const hasAnom = hasPreventiveExecutionAnomaly(exec);
    setExecCreateFollowUpDi(hasAnom && !exec?.generated_di_id);
    setExecFollowUpDiAnomalie(
      exec?.followUpDiAnomalie ||
        exec?.notes ||
        `Anomalie constatée lors du contrôle préventif sur ${exec?.organe || exec?.machineCode || 'équipement'}`
    );
    setExecNote(exec.validation_note || '');
  };

  const handleConfirmExecDecision = (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => {
    if (!reviewExec) return;
    if ((decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') && !execNote.trim()) {
      showToast?.('Veuillez saisir un motif de clarification ou de rejet.', 'warning');
      return;
    }

    const reviewFn = onReviewPreventiveValidation || storeReviewPreventive;
    const updated = reviewFn(
      reviewExec.id,
      {
        decision,
        validation_note: execNote.trim(),
        validated_by_id: user?.id || user?.code || 'admin',
        validated_by_name: user?.name || user?.nom || 'Administrateur',
        approvedSpares: execSpares,
        skipStockDeduction: execSkipStockDeduction,
        createFollowUpDi: decision === 'APPROVED' && execCreateFollowUpDi,
        followUpDiAnomalie: execFollowUpDiAnomalie.trim(),
      },
      onAddMouvement
    );

    if (decision === 'APPROVED') {
      const diSuffix =
        execCreateFollowUpDi || updated?.generated_di_id
          ? ' + DI corrective de suivi générée automatiquement !'
          : '.';
      showToast?.(
        execSkipStockDeduction
          ? `Exécution préventive ${reviewExec.machineCode} approuvée (coût imputé sur machine sans 2e déstockage)${diSuffix}`
          : `Exécution préventive ${reviewExec.machineCode} approuvée (${execSpares.length} réf. déduite(s) du stock)${diSuffix}`,
        'success'
      );
    } else if (decision === 'NEEDS_CLARIFICATION') {
      showToast?.(
        `Demande de clarification envoyée au technicien (${reviewExec.executorName}).`,
        'warning'
      );
    } else {
      showToast?.(`Exécution ${reviewExec.machineCode} rejetée (sans déstockage).`, 'info');
    }

    setReviewExec(null);
  };

  // Open & Submit Handlers for Section 3 (SortieDemand)
  const handleOpenDemandModal = (dem: any) => {
    setReviewDemand(dem);
    setDemandCodeBonMagasin(dem.code_bon_magasin || dem.code_bon_tech || '');
    setDemandMergeMovementId('');
    setDemandItems(Array.isArray(dem.items) ? dem.items.map((it: any) => ({ ...it })) : []);
    setDemandNote(dem.validation_note || '');
  };

  const handleConfirmDemandDecision = (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => {
    if (!reviewDemand) return;
    if (
      (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') &&
      !String(demandNote || '').trim()
    ) {
      showToast?.('Veuillez saisir un motif de clarification ou de rejet.', 'warning');
      return;
    }

    const reviewFn = onReviewSortieDemandValidation || storeReviewSortieDemand;
    reviewFn(
      reviewDemand.id,
      {
        decision,
        code_bon_magasin: demandCodeBonMagasin || reviewDemand.code_bon_tech,
        mergeWithMovementId: demandMergeMovementId || null,
        approvedItems: demandItems,
        validation_note: demandNote.trim(),
        validated_by_id: user?.id || user?.code || 'admin',
        validated_by_name: user?.name || user?.nom || 'Magasinier / Admin',
      },
      onAddMouvement
    );

    if (decision === 'APPROVED') {
      showToast?.(
        `Demande de sortie ${reviewDemand.code_bon_tech || reviewDemand.id} approuvée avec succès.`,
        'success'
      );
    } else if (decision === 'NEEDS_CLARIFICATION') {
      showToast?.(
        `Demande de clarification envoyée pour ${reviewDemand.code_bon_tech || reviewDemand.id}.`,
        'warning'
      );
    } else {
      showToast?.(
        `Demande de sortie ${reviewDemand.code_bon_tech || reviewDemand.id} rejetée (aucun déstockage).`,
        'info'
      );
    }

    setReviewDemand(null);
  };

  if (!canAccess) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 rounded-3xl bg-white border border-amber-200 shadow-lg text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-slate-900">
          Accès réservé aux Responsables & Administrateurs
        </h2>
        <p className="text-xs text-slate-600">
          Le Centre de Validation (Maker-Checker) est destiné à la revue des interventions et bons de sortie.
        </p>
        <button
          type="button"
          onClick={() => onNavigateToTab?.('dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au Tableau de Bord</span>
        </button>
      </div>
    );
  }

  const totalDisplayed =
    (sectionFilter === 'ALL' || sectionFilter === 'CORRECTIVE' ? visibleCorrective.length : 0) +
    (sectionFilter === 'ALL' || sectionFilter === 'PREVENTIVE' ? visiblePreventive.length : 0) +
    (sectionFilter === 'ALL' || sectionFilter === 'SORTIE' ? visibleSortieDemands.length : 0);

  return (
    <div data-testid="validation-center-view" className="space-y-6 pb-10">
      {/* TOP HEADER BANNER */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/90 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0 shadow-2xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
                  Maker-Checker Centralisé
                </span>
                <span className="text-xs font-mono text-slate-500">
                  Zéro déduction stock avant approbation
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                Centre de Validation — À valider
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Point unique de revue et d'approbation des rapports correctifs (BT), exécutions préventives et demandes de sortie PDR.
              </p>
            </div>
          </div>

          {/* Search & Clarification Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher N° BT, machine, technicien, bon..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <button
              type="button"
              onClick={() => setIncludeClarifications((prev) => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                includeClarifications
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>À clarifier ({queues.totalClarification})</span>
            </button>
          </div>
        </div>

        {/* SUMMARY KPI CARDS (5 Cards) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card 1: Total Pending */}
          <button
            type="button"
            onClick={() => setSectionFilter('ALL')}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              sectionFilter === 'ALL'
                ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-900 border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-mono font-extrabold uppercase tracking-wider ${
                  sectionFilter === 'ALL' ? 'text-rose-300' : 'text-slate-500'
                }`}
              >
                Total À valider
              </span>
              <ShieldCheck
                className={`w-4 h-4 ${sectionFilter === 'ALL' ? 'text-rose-400' : 'text-rose-600'}`}
              />
            </div>
            <div className="text-2xl font-black font-mono mt-1" data-testid="vc-total-pending">
              {queues.totalPending}
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                sectionFilter === 'ALL' ? 'text-slate-300' : 'text-slate-500'
              }`}
            >
              +{queues.totalClarification} en attente de clarification
            </div>
          </button>

          {/* Card 2: Corrective BTs */}
          <button
            type="button"
            onClick={() =>
              setSectionFilter((prev) => (prev === 'CORRECTIVE' ? 'ALL' : 'CORRECTIVE'))
            }
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              sectionFilter === 'CORRECTIVE'
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md'
                : 'bg-amber-50/60 hover:bg-amber-50 text-slate-900 border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-amber-900">
                1. Correctif (BT)
              </span>
              <Wrench className="w-4 h-4 text-amber-700" />
            </div>
            <div className="text-2xl font-black font-mono mt-1" data-testid="vc-corrective-count">
              {queues.pendingCorrective.length}
            </div>
            <div className="text-[11px] text-amber-900/80 mt-0.5">
              {queues.clarificationCorrective.length} à clarifier
            </div>
          </button>

          {/* Card 3: Preventive Executions */}
          <button
            type="button"
            onClick={() =>
              setSectionFilter((prev) => (prev === 'PREVENTIVE' ? 'ALL' : 'PREVENTIVE'))
            }
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              sectionFilter === 'PREVENTIVE'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'bg-indigo-50/60 hover:bg-indigo-50 text-slate-900 border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-mono font-extrabold uppercase tracking-wider ${
                  sectionFilter === 'PREVENTIVE' ? 'text-indigo-100' : 'text-indigo-900'
                }`}
              >
                2. Préventif (Exéc.)
              </span>
              <Calendar
                className={`w-4 h-4 ${
                  sectionFilter === 'PREVENTIVE' ? 'text-indigo-200' : 'text-indigo-600'
                }`}
              />
            </div>
            <div className="text-2xl font-black font-mono mt-1" data-testid="vc-preventive-count">
              {queues.pendingPreventive.length}
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                sectionFilter === 'PREVENTIVE' ? 'text-indigo-100' : 'text-indigo-900/80'
              }`}
            >
              {queues.clarificationPreventive.length} à clarifier
            </div>
          </button>

          {/* Card 4: Sortie Demands */}
          <button
            type="button"
            onClick={() => setSectionFilter((prev) => (prev === 'SORTIE' ? 'ALL' : 'SORTIE'))}
            className={`p-4 rounded-2xl border text-left transition cursor-pointer ${
              sectionFilter === 'SORTIE'
                ? 'bg-teal-600 text-white border-teal-600 shadow-md'
                : 'bg-teal-50/60 hover:bg-teal-50 text-slate-900 border-teal-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-mono font-extrabold uppercase tracking-wider ${
                  sectionFilter === 'SORTIE' ? 'text-teal-100' : 'text-teal-900'
                }`}
              >
                3. Sorties Terrain
              </span>
              <Package
                className={`w-4 h-4 ${
                  sectionFilter === 'SORTIE' ? 'text-teal-200' : 'text-teal-600'
                }`}
              />
            </div>
            <div className="text-2xl font-black font-mono mt-1" data-testid="vc-sortie-count">
              {queues.pendingSortieDemands.length}
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                sectionFilter === 'SORTIE' ? 'text-teal-100' : 'text-teal-900/80'
              }`}
            >
              {queues.clarificationSortieDemands.length} à clarifier
            </div>
          </button>

          {/* Card 5: Derived Virtual Stock Reservation (Read-Only from computeReservedStockMap) */}
          <button
            type="button"
            onClick={() => setShowReservedDetails((prev) => !prev)}
            className="p-4 rounded-2xl border border-purple-200 bg-purple-50/60 hover:bg-purple-50 text-left transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-purple-900">
                Réservation PDR
              </span>
              <Layers className="w-4 h-4 text-purple-600" />
            </div>
            <div className="text-2xl font-black font-mono text-purple-950 mt-1">
              {queues.reservedRefsCount} <span className="text-xs font-bold">réf.</span>
            </div>
            <div className="text-[11px] text-purple-800 mt-0.5 font-mono">
              {queues.totalReservedUnits} unité(s) réservée(s)
            </div>
          </button>
        </div>

        {/* Optional Expandable Virtual Stock Reservation Breakdown */}
        {showReservedDetails && queues.reservedRefsCount > 0 && (
          <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-950">
                Détail des réservations virtuelles (lecture seule — sans impact sur Stock Actuel avant validation)
              </span>
              <button
                type="button"
                onClick={() => setShowReservedDetails(false)}
                className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
              >
                Masquer
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(queues.reservedStockMap.values()).map((entry) => (
                <div
                  key={entry.ref}
                  className="px-3 py-1.5 rounded-xl bg-white border border-purple-200 text-xs font-mono flex items-center gap-2 shadow-2xs"
                >
                  <span className="font-black text-slate-900">{entry.ref}</span>
                  <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-bold text-[10px]">
                    Réservé: {entry.reservedQty}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    ({entry.sources.map((s) => s.code).join(', ')})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GLOBAL EMPTY STATE */}
      {totalDisplayed === 0 && (
        <div
          data-testid="validation-center-empty"
          className="bg-white rounded-3xl p-10 border border-slate-200/90 text-center space-y-3 shadow-2xs"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">
            Rien à valider — tout est à jour
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Aucune demande d'approbation en attente dans ce filtre. Les soumissions terrain des techniciens apparaissent automatiquement ici.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateToTab?.('corrective')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              <span>Correctif Hub</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab?.('preventive')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Planning Préventif</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToTab?.('sortie')}
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Package className="w-3.5 h-3.5 text-teal-600" />
              <span>Sortie & Entrée</span>
            </button>
          </div>
        </div>
      )}

      {/* ==========================================================================
          SECTION 1: INTERVENTIONS CORRECTIVES À VALIDER (BT)
         ========================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'CORRECTIVE') && (
        <section
          data-testid="vc-section-corrective"
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <span>1. Interventions correctives à valider</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-amber-100 text-amber-900">
                    {visibleCorrective.length}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Rapports Bons de Travail (BT) soumis par les techniciens • Approbation = Clôture + Sortie PDR officielle
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('corrective')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Ouvrir Correctif BT</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {visibleCorrective.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
              Aucune intervention corrective en attente de validation.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleCorrective.map((bt: any) => {
                const proposed = Array.isArray(bt?.pieces_proposees) ? bt.pieces_proposees : [];
                const reconciliation = reconcileFieldClaim({
                  claimType: 'CORRECTIVE',
                  claimId: String(bt.id),
                  numBonSaisi: bt.num_bon_saisi_par_tech,
                  machineCode: bt.code_machine,
                  proposedSpares: proposed,
                  stockItems,
                  mouvements,
                  correctiveInterventions,
                  preventiveExecutions,
                  sortieDemands,
                });
                const isClarify = bt.validation_status === 'NEEDS_CLARIFICATION';

                return (
                  <div
                    key={bt.id}
                    data-testid={`vc-corrective-row-${bt.id}`}
                    className={`p-4 rounded-2xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isClarify
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-950 font-mono text-xs font-black">
                          {bt.num_bt || bt.id}
                        </span>
                        <span className="font-mono text-xs font-black text-slate-900 flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5 text-slate-500" />
                          {bt.code_machine || bt.id_machine_registered}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {bt.submitted_by_name || bt.intervenant || 'Technicien'}
                        </span>
                        {bt.submitted_at && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {String(bt.submitted_at).slice(0, 16).replace('T', ' ')}
                          </span>
                        )}
                        {bt.num_bon_saisi_par_tech && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-bold flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Bon Tech: {bt.num_bon_saisi_par_tech}
                          </span>
                        )}
                        {isClarify ? (
                          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono text-[10px] font-black">
                            À CLARIFIER PAR TECH
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-black">
                            À VALIDER
                          </span>
                        )}
                        {(bt.source === 'AUTO_DI_PREVENTIF' || bt.source_preventive_execution_id) && (
                          <span
                            data-testid={`vc-bt-auto-di-badge-${bt.id}`}
                            className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300 font-mono text-[10px] font-black inline-flex items-center gap-1"
                            title={`Origine préventive : ${bt.source_preventive_execution_id || 'Auto-DI'}`}
                          >
                            <Calendar className="w-3 h-3 text-indigo-700" />
                            <span>AUTO-DI PRÉVENTIF</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-900">
                        {bt.action_realisee || bt.anomalie || bt.travail_a_faire || 'Intervention corrective'}
                      </div>

                      {/* Proposed Spares Pills */}
                      {proposed.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[11px] font-bold text-slate-500">PDR proposées :</span>
                          {proposed.map((p: any, idx: number) => (
                            <span
                              key={`${p.ref}-${idx}`}
                              className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                            >
                              {p.ref} ×{p.quantite ?? p.qty ?? 1}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">
                          Aucune pièce détachée déclarée (0 déstockage)
                        </div>
                      )}

                      {/* Reconciliation Alerts */}
                      {reconciliation.alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {reconciliation.alerts.map((alert, i) => (
                            <span
                              key={`${alert.code}-${i}`}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                alert.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                              title={alert.detail}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{alert.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`vc-open-bt-review-${bt.id}`}
                        onClick={() => handleOpenBtModal(bt)}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>Ouvrir revue</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==========================================================================
          SECTION 2: EXÉCUTIONS PRÉVENTIVES À VALIDER
         ========================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'PREVENTIVE') && (
        <section
          data-testid="vc-section-preventive"
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <span>2. Exécutions préventives à valider</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-indigo-100 text-indigo-900">
                    {visiblePreventive.length}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Inspections et rondes préventives exécutées sur le terrain • Approbation = Fait + Sortie PDR officielle
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('preventive')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Ouvrir Préventif</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {visiblePreventive.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
              Aucune exécution préventive en attente de validation.
            </div>
          ) : (
            <div className="space-y-3">
              {visiblePreventive.map((ex: any) => {
                const proposed = Array.isArray(ex?.sparesProposed) ? ex.sparesProposed : [];
                const reconciliation = reconcileFieldClaim({
                  claimType: 'PREVENTIVE',
                  claimId: String(ex.id),
                  numBonSaisi: ex.num_bon_saisi_par_tech,
                  machineCode: ex.machineCode,
                  proposedSpares: proposed,
                  stockItems,
                  mouvements,
                  correctiveInterventions,
                  preventiveExecutions,
                  sortieDemands,
                });
                const isClarify = ex.validation_status === 'NEEDS_CLARIFICATION';

                return (
                  <div
                    key={ex.id}
                    data-testid={`vc-preventive-row-${ex.id}`}
                    className={`p-4 rounded-2xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isClarify
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-950 font-mono text-xs font-black">
                          {ex.taskCode || ex.actionCode || 'PRÉV'}
                        </span>
                        <span className="font-mono text-xs font-black text-slate-900 flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5 text-slate-500" />
                          {ex.machineCode}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {ex.submitted_by_name || ex.executorName || 'Technicien'}
                        </span>
                        {ex.executedAt && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ex.executedAt} ({ex.periodWeek || ex.periodMonth || ''})
                          </span>
                        )}
                        {ex.num_bon_saisi_par_tech && (
                          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono text-[10px] font-bold flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Bon Tech: {ex.num_bon_saisi_par_tech}
                          </span>
                        )}
                        {isClarify ? (
                          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono text-[10px] font-black">
                            À CLARIFIER PAR TECH
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-black">
                            À VALIDER
                          </span>
                        )}
                        {hasPreventiveExecutionAnomaly(ex) && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10px] font-black inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            <span>ANOMALIE SIGNALÉE (AUTO-DI PROPOSÉE)</span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-bold text-slate-900">
                        {ex.organe || 'Machine entière'} —{' '}
                        <span className="font-medium text-slate-700">
                          {ex.taskDescription || ex.notes || 'Exécution préventive'}
                        </span>
                      </div>

                      {/* Proposed Spares */}
                      {proposed.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[11px] font-bold text-slate-500">PDR proposées :</span>
                          {proposed.map((p: any, idx: number) => (
                            <span
                              key={`${p.ref}-${idx}`}
                              className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                            >
                              {p.ref} ×{p.qty ?? p.quantite ?? 1}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">
                          Aucune pièce détachée déclarée (0 déstockage)
                        </div>
                      )}

                      {/* Reconciliation Alerts */}
                      {reconciliation.alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {reconciliation.alerts.map((alert, i) => (
                            <span
                              key={`${alert.code}-${i}`}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                alert.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                              title={alert.detail}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{alert.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`vc-open-prev-review-${ex.id}`}
                        onClick={() => handleOpenExecModal(ex)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Ouvrir revue</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==========================================================================
          SECTION 3: DEMANDES DE SORTIE TERRAIN (SORTIE DEMANDS)
         ========================================================================== */}
      {(sectionFilter === 'ALL' || sectionFilter === 'SORTIE') && (
        <section
          data-testid="vc-section-sortie"
          className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-2xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                  <span>3. Demandes de sortie terrain</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-teal-100 text-teal-900">
                    {visibleSortieDemands.length}
                  </span>
                </h2>
                <p className="text-[11px] text-slate-500">
                  Bons de sortie PDR saisis par les techniciens • Rapprochement BS-Tech × BS-Magasin sans double déstockage
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateToTab?.('sortie')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Ouvrir Sortie & Entrée</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {visibleSortieDemands.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 text-center text-xs text-slate-500">
              Aucune demande de sortie terrain en attente de validation.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleSortieDemands.map((dem: any) => {
                const items = Array.isArray(dem?.items) ? dem.items : [];
                const reconciliation = reconcileFieldClaim({
                  claimType: 'SORTIE',
                  claimId: String(dem.id),
                  numBonSaisi: dem.code_bon_tech,
                  machineCode: dem.id_machine_registered,
                  proposedSpares: items,
                  stockItems,
                  mouvements,
                  correctiveInterventions,
                  preventiveExecutions,
                  sortieDemands,
                });
                const isClarify = dem.validation_status === 'NEEDS_CLARIFICATION';

                return (
                  <div
                    key={dem.id}
                    data-testid={`vc-sortie-row-${dem.id}`}
                    className={`p-4 rounded-2xl border transition flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                      isClarify
                        ? 'bg-amber-50/40 border-amber-300'
                        : 'bg-slate-50/60 hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-950 font-mono text-xs font-black">
                          {dem.code_bon_tech || dem.id}
                        </span>
                        <span className="font-mono text-xs font-black text-slate-900 flex items-center gap-1">
                          <Factory className="w-3.5 h-3.5 text-slate-500" />
                          {dem.id_machine_registered || dem.id_zone || 'MAGASIN'}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          {dem.submitted_by_name || dem.technicien || 'Technicien'}
                        </span>
                        {dem.date && (
                          <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dem.date} {dem.heure || ''}
                          </span>
                        )}
                        {isClarify ? (
                          <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono text-[10px] font-black">
                            À CLARIFIER PAR TECH
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px] font-black">
                            À VALIDER
                          </span>
                        )}
                      </div>

                      {dem.commentaire && (
                        <div className="text-xs font-medium text-slate-700">
                          Motif : {dem.commentaire}
                        </div>
                      )}

                      {/* Requested Items */}
                      {items.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <span className="text-[11px] font-bold text-slate-500">Articles demandés :</span>
                          {items.map((it: any, idx: number) => (
                            <span
                              key={`${it.ref}-${idx}`}
                              className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-800"
                            >
                              {it.ref} — {it.designation || it.ref} ×{it.quantite ?? it.qty ?? 1}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Reconciliation Alerts (including CANDIDATE_STORE_BON_MATCH) */}
                      {reconciliation.alerts.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {reconciliation.alerts.map((alert, i) => (
                            <span
                              key={`${alert.code}-${i}`}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                                alert.severity === 'critical'
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                              }`}
                              title={alert.detail}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{alert.title}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        data-testid={`vc-open-sortie-review-${dem.id}`}
                        onClick={() => handleOpenDemandModal(dem)}
                        className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Ouvrir revue</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ==========================================================================
          MODAL 1: CORRECTIVE BT MAKER-CHECKER REVIEW MODAL
         ========================================================================== */}
      {reviewBt && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            data-testid="vc-bt-review-modal"
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs font-black">
                    {reviewBt.num_bt || reviewBt.id}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Machine : {reviewBt.code_machine}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Revue & Validation Bon de Travail (BT)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewBt(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Reconciliation Alerts inside Modal */}
            {activeBtReconciliation && activeBtReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeBtReconciliation.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black">{alert.title}</div>
                      <div className="text-[11px]">{alert.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Action réalisée (modifiable avant clôture)
                </label>
                <textarea
                  rows={3}
                  value={btActionRealisee}
                  onChange={(e) => setBtActionRealisee(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>

              {/* Proposed Spares List */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">
                  Pièces à déduire du stock à l'approbation ({btPieces.length})
                </div>
                {btPieces.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">Aucune pièce détachée</div>
                ) : (
                  <div className="space-y-1.5">
                    {btPieces.map((p, idx) => (
                      <div
                        key={`${p.ref}-${idx}`}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-black text-slate-900">{p.ref}</span>
                          <span className="text-slate-500 ml-1.5 truncate">{p.designation}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={p.quantite ?? p.qty ?? 1}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setBtPieces((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, quantite: val, qty: val } : item
                                )
                              );
                            }}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono text-center"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setBtPieces((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {btPieces.length > 0 && (
                  <label className="flex items-start gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={btSkipStockDeduction}
                      onChange={(e) => setBtSkipStockDeduction(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong className="font-bold text-slate-900">
                        ✅ Bon de sortie déjà déstocké au magasin
                      </strong>{' '}
                      — Imputer le coût PDR sur la machine sans créer de 2e mouvement de stock.
                    </span>
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note de validation / Motif de clarification ou rejet
                </label>
                <textarea
                  rows={2}
                  value={btNote}
                  onChange={(e) => setBtNote(e.target.value)}
                  placeholder="Obligatoire en cas de demande de clarification ou de rejet..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmBtDecision('REJECTED')}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Rejeter
              </button>
              <button
                type="button"
                data-testid="vc-bt-clarify-btn"
                onClick={() => handleConfirmBtDecision('NEEDS_CLARIFICATION')}
                className="px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                Demander Clarification
              </button>
              <button
                type="button"
                data-testid="vc-bt-approve-btn"
                onClick={() => handleConfirmBtDecision('APPROVED')}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black cursor-pointer shadow-sm"
              >
                Approuver & Clôturer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL 2: PREVENTIVE EXECUTION MAKER-CHECKER REVIEW MODAL
         ========================================================================== */}
      {reviewExec && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            data-testid="vc-prev-review-modal"
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono text-xs font-black">
                    {reviewExec.taskCode || reviewExec.actionCode || 'PRÉV'}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Machine : {reviewExec.machineCode}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Revue & Validation Exécution Préventive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewExec(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeExecReconciliation && activeExecReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeExecReconciliation.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black">{alert.title}</div>
                      <div className="text-[11px]">{alert.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div>
                  <span className="font-bold text-slate-600">Organe : </span>
                  <span className="font-bold text-slate-900">{reviewExec.organe}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-600">Observations Tech : </span>
                  <span className="text-slate-800">{reviewExec.notes || 'RAS'}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">
                  Pièces à déduire du stock à l'approbation ({execSpares.length})
                </div>
                {execSpares.length === 0 ? (
                  <div className="text-xs text-slate-500 italic">Aucune pièce détachée</div>
                ) : (
                  <div className="space-y-1.5">
                    {execSpares.map((s, idx) => (
                      <div
                        key={`${s.ref}-${idx}`}
                        className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-mono font-black text-slate-900">{s.ref}</span>
                          <span className="text-slate-500 ml-1.5 truncate">{s.designation}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="1"
                            value={s.qty}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setReviewExecSpares((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, qty: val } : item))
                              );
                            }}
                            className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono text-center"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setReviewExecSpares((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {execSpares.length > 0 && (
                  <label className="flex items-start gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={execSkipStockDeduction}
                      onChange={(e) => setExecSkipStockDeduction(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>
                      <strong className="font-bold text-slate-900">
                        ✅ Bon de sortie déjà déstocké au magasin
                      </strong>{' '}
                      — Imputer le coût PDR sur la machine sans créer de 2e mouvement de stock.
                    </span>
                  </label>
                )}
              </div>

              {/* Idea 1: Boucle fermée Préventif -> Correctif (Auto-DI sur Anomalie) */}
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2">
                <label className="flex items-start gap-2 text-xs text-amber-950 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    data-testid="vc-prev-auto-di-checkbox"
                    checked={execCreateFollowUpDi}
                    onChange={(e) => setExecCreateFollowUpDi(e.target.checked)}
                    className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>
                    <strong className="font-black">
                      Créer une DI corrective de suivi (Auto-DI sur anomalie préventive)
                    </strong>{' '}
                    — Génère automatiquement une Demande d&apos;Intervention liée à{' '}
                    <code className="font-mono font-bold">{reviewExec.machineCode}</code> dès l&apos;approbation.
                  </span>
                </label>

                {execCreateFollowUpDi && (
                  <div className="pt-1">
                    <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                      Description de l&apos;anomalie pour la DI corrective :
                    </label>
                    <input
                      type="text"
                      data-testid="vc-prev-auto-di-anomalie-input"
                      value={execFollowUpDiAnomalie}
                      onChange={(e) => setExecFollowUpDiAnomalie(e.target.value)}
                      className="w-full rounded-xl border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note de validation / Motif de clarification ou rejet
                </label>
                <textarea
                  rows={2}
                  value={execNote}
                  onChange={(e) => setExecNote(e.target.value)}
                  placeholder="Obligatoire en cas de demande de clarification ou de rejet..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmExecDecision('REJECTED')}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Rejeter
              </button>
              <button
                type="button"
                data-testid="vc-prev-clarify-btn"
                onClick={() => handleConfirmExecDecision('NEEDS_CLARIFICATION')}
                className="px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                Demander Clarification
              </button>
              <button
                type="button"
                data-testid="vc-prev-approve-btn"
                onClick={() => handleConfirmExecDecision('APPROVED')}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer shadow-sm"
              >
                Approuver l'Exécution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL 3: SORTIE DEMAND MAKER-CHECKER & RECONCILIATION MODAL
         ========================================================================== */}
      {reviewDemand && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div
            data-testid="vc-sortie-review-modal"
            className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-mono text-xs font-black">
                    {reviewDemand.code_bon_tech || reviewDemand.id}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    Machine : {reviewDemand.id_machine_registered || reviewDemand.id_zone}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 mt-1">
                  Validation & Rapprochement Demande de Sortie PDR
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewDemand(null)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeDemandReconciliation && activeDemandReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeDemandReconciliation.alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                      alert.severity === 'critical'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-black">{alert.title}</div>
                      <div className="text-[11px]">{alert.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  N° Bon Magasin Officiel
                </label>
                <input
                  type="text"
                  value={demandCodeBonMagasin}
                  onChange={(e) => setDemandCodeBonMagasin(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono"
                />
              </div>

              {/* Candidate Storekeeper Movement Merge (Prevent Double Deduction) */}
              {activeDemandReconciliation &&
                activeDemandReconciliation.candidateStoreMovements.length > 0 && (
                  <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-1.5">
                    <label className="block text-xs font-black text-amber-950">
                      Fusionner avec un mouvement magasin existant (évite le double déstockage)
                    </label>
                    <select
                      value={demandMergeMovementId}
                      onChange={(e) => setDemandMergeMovementId(e.target.value)}
                      className="w-full rounded-xl border border-amber-300 px-3 py-2 text-xs font-mono bg-white"
                    >
                      <option value="">— Créer un nouveau mouvement de sortie —</option>
                      {activeDemandReconciliation.candidateStoreMovements.map((cand) => (
                        <option key={cand.movementId} value={cand.movementId}>
                          Fusionner avec {cand.code_bon} ({cand.ref} ×{cand.quantite} le {cand.date})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">
                  Articles demandés ({demandItems.length})
                </div>
                {demandItems.map((it, idx) => (
                  <div
                    key={`${it.ref}-${idx}`}
                    className="flex items-center justify-between gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-mono font-black text-slate-900">{it.ref}</span>
                      <span className="text-slate-500 ml-1.5 truncate">{it.designation}</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      value={it.quantite ?? it.qty ?? 1}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setDemandItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, quantite: val, qty: val } : row
                          )
                        );
                      }}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-xs font-mono text-center"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Note de validation / Motif de clarification ou rejet
                </label>
                <textarea
                  rows={2}
                  value={demandNote}
                  onChange={(e) => setDemandNote(e.target.value)}
                  placeholder="Obligatoire en cas de demande de clarification ou de rejet..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmDemandDecision('REJECTED')}
                className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold cursor-pointer"
              >
                Rejeter
              </button>
              <button
                type="button"
                data-testid="vc-sortie-clarify-btn"
                onClick={() => handleConfirmDemandDecision('NEEDS_CLARIFICATION')}
                className="px-3.5 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold cursor-pointer"
              >
                Demander Clarification
              </button>
              <button
                type="button"
                data-testid="vc-sortie-approve-btn"
                onClick={() => handleConfirmDemandDecision('APPROVED')}
                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black cursor-pointer shadow-sm"
              >
                Approuver la Sortie
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
