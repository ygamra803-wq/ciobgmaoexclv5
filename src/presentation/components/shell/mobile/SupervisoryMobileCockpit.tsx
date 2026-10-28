import { useState, useMemo } from 'react';
import {
  Monitor,
  Smartphone,
  LogOut,
  QrCode,
  ShieldCheck,
  Wrench,
  Calendar,
  Package,
  AlertTriangle,
  CheckCircle2,
  X,
  PlusCircle,
  Layers,
  ExternalLink,
  Factory,
} from 'lucide-react';
import { useGmaoStore } from '../../../../store/useGmaoStore';
import {
  resolveMobileSupervisoryProfile,
  getRoleScopedPendingCounts,
} from '../../../../core/security/supervisoryMobileScope';
import {
  selectValidationCenterQueues,
  reconcileFieldClaim,
} from '../../../../core/security/validationReconciliation';
import ShellModeSwitcher from '../../common/ShellModeSwitcher';

interface SupervisoryMobileCockpitProps {
  currentUser: any;
  mode: string;
  resolved: string;
  setMode: (m: 'auto' | 'desktop' | 'mobile') => void;
  setCurrentTab: (tab: string) => void;
  onLogout: () => void;
  onOpenQrScanner: () => void;
  machines: any[];
  stockItems: any[];
  preventiveTasks: any[];
  preventiveExecutions: any[];
  correctiveInterventions: any[];
  sortieDemands: any[];
  mouvements: any[];
  onAddDemandeIntervention?: (data: any) => any;
  showToast?: (msg: string, type?: string) => void;
}

export default function SupervisoryMobileCockpit({
  currentUser,
  mode,
  resolved,
  setMode,
  setCurrentTab,
  onLogout,
  onOpenQrScanner,
  machines = [],
  stockItems = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  correctiveInterventions = [],
  sortieDemands = [],
  mouvements = [],
  onAddDemandeIntervention,
  showToast,
}: SupervisoryMobileCockpitProps) {
  const profile = useMemo(() => resolveMobileSupervisoryProfile(currentUser), [currentUser]);

  // Store Maker-Checker review actions
  const reviewCorrective = useGmaoStore((s) => s.handleReviewInterventionValidation);
  const reviewPreventive = useGmaoStore((s) => s.handleReviewPreventiveExecutionValidation);
  const reviewSortieDemand = useGmaoStore((s) => s.handleReviewSortieDemandValidation);

  const queues = useMemo(
    () =>
      selectValidationCenterQueues({
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands,
      }),
    [correctiveInterventions, preventiveExecutions, sortieDemands]
  );

  const scopedCounts = useMemo(
    () =>
      getRoleScopedPendingCounts(profile, {
        prevCount: queues.pendingPreventive.length,
        corrCount: queues.pendingCorrective.length,
        sortieCount: queues.pendingSortieDemands.length,
        total: queues.totalPending,
      }),
    [profile, queues]
  );

  // Default sub-filter based on persona
  const [activeQueueTab, setActiveQueueTab] = useState<'SORTIE' | 'CORRECTIVE' | 'PREVENTIVE' | 'RADAR'>(() => {
    if (profile.persona === 'RESPONSABLE_MAGASIN') return 'SORTIE';
    if (profile.persona === 'SUPERVISEUR_MAINTENANCE') return 'CORRECTIVE';
    return 'RADAR';
  });

  // Quick review modal state on mobile
  const [selectedItem, setSelectedItem] = useState<{
    kind: 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE';
    record: any;
  } | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [codeBonMagasin, setCodeBonMagasin] = useState('');
  const [skipStockDeduction, setSkipStockDeduction] = useState(false);

  // Operator quick DI modal state
  const [showOperatorDiModal, setShowOperatorDiModal] = useState(false);
  const [diMachineCode, setDiMachineCode] = useState('');
  const [diAnomalie, setDiAnomalie] = useState('');
  const [diUrgence, setDiUrgence] = useState<'Normale' | 'Haute' | 'Critique'>('Haute');

  // Stock & Workshop Radar Metrics
  const radarMetrics = useMemo(() => {
    let ruptureCount = 0;
    let alerteCount = 0;
    for (const item of stockItems || []) {
      const actual = Number(item.stock_actuel ?? item.quantite ?? 0);
      const min = Number(item.seuil_alerte ?? item.stock_min ?? 0);
      if (actual <= 0) ruptureCount += 1;
      else if (min > 0 && actual <= min) alerteCount += 1;
    }

    const activeBtsCount = (correctiveInterventions || []).filter((i) => {
      const st = String(i.statut || '').toUpperCase();
      return st === 'EN_COURS' || st === 'DEMANDE' || st === 'EN_ATTENTE_PDR';
    }).length;

    const overduePmCount = (preventiveTasks || []).filter(
      (t) => String(t.etat || '').toLowerCase() === 'en retard'
    ).length;

    return {
      ruptureCount,
      alerteCount,
      activeBtsCount,
      overduePmCount,
      reservedRefsCount: queues.reservedRefsCount,
      totalReservedUnits: queues.totalReservedUnits,
    };
  }, [stockItems, correctiveInterventions, preventiveTasks, queues]);

  const activeReconciliation = useMemo(() => {
    if (!selectedItem) return null;
    const r = selectedItem.record;
    if (selectedItem.kind === 'CORRECTIVE') {
      const pieces = Array.isArray(r.pieces_proposees)
        ? r.pieces_proposees
        : Array.isArray(r.pieces_utilisees)
        ? r.pieces_utilisees
        : [];
      return reconcileFieldClaim({
        recordType: 'CORRECTIVE_BT',
        recordId: r.id || r.num_bt,
        machineCode: r.code_machine,
        numBonSaisi: r.num_bon_saisi_par_tech,
        proposedItems: pieces,
        stockItems,
        mouvements,
        reservedStockMap: queues.reservedStockMap,
      });
    }
    if (selectedItem.kind === 'PREVENTIVE') {
      const pieces = Array.isArray(r.sparesProposed)
        ? r.sparesProposed
        : Array.isArray(r.sparesUsed)
        ? r.sparesUsed
        : [];
      return reconcileFieldClaim({
        recordType: 'PREVENTIVE_EXEC',
        recordId: r.id,
        machineCode: r.machineCode,
        numBonSaisi: r.num_bon_saisi_par_tech,
        proposedItems: pieces,
        stockItems,
        mouvements,
        reservedStockMap: queues.reservedStockMap,
      });
    }
    const items = Array.isArray(r.items) ? r.items : [];
    return reconcileFieldClaim({
      recordType: 'SORTIE_DEMAND',
      recordId: r.id,
      machineCode: r.id_machine_registered,
      numBonSaisi: r.code_bon_magasin || r.id,
      proposedItems: items,
      stockItems,
      mouvements,
      reservedStockMap: queues.reservedStockMap,
    });
  }, [selectedItem, stockItems, mouvements, queues.reservedStockMap]);

  const handleOpenReview = (kind: 'CORRECTIVE' | 'PREVENTIVE' | 'SORTIE', record: any) => {
    setReviewNote('');
    setCodeBonMagasin(record.code_bon_magasin || record.num_bon_saisi_par_tech || '');
    // Pre-check skipStockDeduction if exact bon match exists in storehouse movements
    const pieces =
      kind === 'CORRECTIVE'
        ? record.pieces_proposees || record.pieces_utilisees || []
        : kind === 'PREVENTIVE'
        ? record.sparesProposed || record.sparesUsed || []
        : [];
    const rec =
      kind !== 'SORTIE'
        ? reconcileFieldClaim({
            recordType: kind === 'CORRECTIVE' ? 'CORRECTIVE_BT' : 'PREVENTIVE_EXEC',
            recordId: record.id,
            machineCode: record.code_machine || record.machineCode,
            numBonSaisi: record.num_bon_saisi_par_tech,
            proposedItems: pieces,
            stockItems,
            mouvements,
            reservedStockMap: queues.reservedStockMap,
          })
        : null;
    setSkipStockDeduction(Boolean(rec?.exactMovementMatch));
    setSelectedItem({ kind, record });
  };

  const handleConfirmDecision = (
    decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED'
  ) => {
    if (!selectedItem) return;
    if (decision !== 'APPROVED' && !reviewNote.trim()) {
      showToast?.('Veuillez saisir un motif de clarification ou de rejet.', 'warning');
      return;
    }

    const reviewerName =
      currentUser?.name || currentUser?.nom || currentUser?.username || profile.roleBadge;
    const { kind, record } = selectedItem;

    if (kind === 'CORRECTIVE' && profile.canValidateCorrective) {
      const pieces = Array.isArray(record.pieces_proposees)
        ? record.pieces_proposees
        : Array.isArray(record.pieces_utilisees)
        ? record.pieces_utilisees
        : [];
      reviewCorrective(record.id, {
        decision,
        reviewer_name: reviewerName,
        validation_note: reviewNote.trim(),
        action_realisee: record.action_realisee || record.observations || 'Intervention validée',
        pieces_utilisees: pieces,
        skipStockDeduction,
      });
      showToast?.(
        decision === 'APPROVED'
          ? `BT ${record.num_bt || record.id} approuvé et clôturé.`
          : `Décision enregistrée (${decision}).`,
        'success'
      );
    } else if (kind === 'PREVENTIVE' && profile.canValidatePreventive) {
      const spares = Array.isArray(record.sparesProposed)
        ? record.sparesProposed
        : Array.isArray(record.sparesUsed)
        ? record.sparesUsed
        : [];
      reviewPreventive(record.id, {
        decision,
        reviewer_name: reviewerName,
        validation_note: reviewNote.trim(),
        sparesUsed: spares,
        skipStockDeduction,
      });
      showToast?.(
        decision === 'APPROVED'
          ? `Exécution préventive ${record.taskCode || record.id} approuvée.`
          : `Décision enregistrée (${decision}).`,
        'success'
      );
    } else if (kind === 'SORTIE' && profile.canValidateSortieDemand) {
      reviewSortieDemand(record.id, {
        decision,
        reviewer_name: reviewerName,
        validation_note: reviewNote.trim(),
        code_bon_magasin: codeBonMagasin.trim() || record.id,
        items: Array.isArray(record.items) ? record.items : [],
      });
      showToast?.(
        decision === 'APPROVED'
          ? `Demande de sortie ${record.id} validée au magasin.`
          : `Décision enregistrée (${decision}).`,
        'success'
      );
    }

    setSelectedItem(null);
  };

  const handleCreateOperatorDi = () => {
    if (!diMachineCode.trim() || !diAnomalie.trim()) {
      showToast?.('Sélectionnez une machine et décrivez l’anomalie.', 'warning');
      return;
    }
    const targetMachine = machines.find(
      (m) =>
        String(m.id_machine_registered || m.id || m.code || '') === diMachineCode.trim()
    );
    onAddDemandeIntervention?.({
      code_machine: diMachineCode.trim(),
      nom_machine: targetMachine?.nom || targetMachine?.designation || diMachineCode.trim(),
      zone: targetMachine?.zone || 'Atelier',
      anomalie: diAnomalie.trim(),
      urgence: diUrgence,
      type_panne: 'Mécanique',
      demandeur: currentUser?.name || currentUser?.nom || 'Opérateur',
    });
    setShowOperatorDiModal(false);
    setDiAnomalie('');
    showToast?.('Demande d’intervention (DI) transmise à la maintenance.', 'success');
  };

  return (
    <div
      data-testid="mobile-shell-admin-gateway"
      data-persona={profile.persona}
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-5 font-sans select-none"
    >
      {/* Top Role-Aware Header */}
      <header className="flex items-center justify-between gap-2.5 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border ${
              profile.persona === 'RESPONSABLE_MAGASIN'
                ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                : profile.persona === 'SUPERVISEUR_MAINTENANCE'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
            }`}
          >
            {profile.persona === 'RESPONSABLE_MAGASIN'
              ? 'MAG'
              : profile.persona === 'SUPERVISEUR_MAINTENANCE'
              ? 'SUP'
              : 'OBS'}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-black tracking-tight flex items-center gap-1.5 flex-wrap">
              <span className="truncate">
                {currentUser?.name || currentUser?.nom || profile.roleLabelFr}
              </span>
              <span
                data-testid="mobile-supervisory-role-badge"
                className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              >
                {profile.roleBadge}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Shell: {resolved}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 truncate">{profile.roleLabelFr}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenQrScanner}
            data-testid="supervisory-qr-scan-btn"
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Scanner QR Machine"
          >
            <QrCode className="w-4 h-4" />
            <span>QR</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-800 transition cursor-pointer"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Role-Tailored Cockpit */}
      <main className="my-auto py-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Role Identity & Mode Banner Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>{profile.roleLabelFr}</span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white">
                {profile.titleFr}
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">{profile.subtitleFr}</p>
            </div>
          </div>

          <p
            dir="rtl"
            className="text-xs text-emerald-300/90 font-semibold leading-relaxed bg-emerald-950/40 border border-emerald-800/50 rounded-xl p-3"
          >
            {profile.bannerAr}
          </p>

          {/* Operator Quick Breakdown Reporting CTA */}
          {profile.canReportBreakdown && profile.persona === 'OPERATEUR_TERRAIN' && (
            <button
              type="button"
              data-testid="operator-report-di-btn"
              onClick={() => setShowOperatorDiModal(true)}
              className="w-full py-3.5 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Signaler une Panne / Demande d'Intervention (DI)</span>
            </button>
          )}

          {/* Primary CTA: Force Desktop Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              data-testid="force-desktop-mode-btn"
              onClick={() => setMode('desktop')}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Monitor className="w-4 h-4 shrink-0" />
              <span>Forcer le mode Bureau (Desktop)</span>
            </button>

            {(profile.canValidateSortieDemand ||
              profile.canValidateCorrective ||
              profile.canValidatePreventive) && (
              <button
                type="button"
                data-testid="open-desktop-validation-center-btn"
                onClick={() => {
                  setCurrentTab('validation_center');
                  setMode('desktop');
                }}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Centre À valider ({scopedCounts.total})</span>
              </button>
            )}
          </div>

          {/* ====================================================================
              ROLE-SCOPED MAKER-CHECKER & RADAR TABS ON MOBILE
             ==================================================================== */}
          <div className="pt-3 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                {profile.persona === 'RESPONSABLE_MAGASIN'
                  ? 'Guichet Magasin PDR (À valider)'
                  : profile.persona === 'SUPERVISEUR_MAINTENANCE'
                  ? 'Supervision & Validation Terrain (Maker-Checker)'
                  : 'Radar Terrain & État Atelier'}
              </span>
              {(profile.canValidateCorrective ||
                profile.canValidatePreventive ||
                profile.canValidateSortieDemand) && (
                <span
                  data-testid="supervisory-scoped-pending-total"
                  className="px-2 py-0.5 rounded-full text-[11px] font-mono font-black bg-rose-500/20 text-rose-300 border border-rose-500/30"
                >
                  {scopedCounts.total} en attente
                </span>
              )}
            </div>

            {/* Role-Filtered Counter Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {profile.canValidateCorrective && (
                <button
                  type="button"
                  data-testid="sup-tab-corrective"
                  onClick={() => setActiveQueueTab('CORRECTIVE')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    activeQueueTab === 'CORRECTIVE'
                      ? 'bg-amber-500/20 border-amber-500/50 text-white'
                      : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-base font-black font-mono text-amber-400">
                    {scopedCounts.corrCount}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Correctif BT</div>
                </button>
              )}

              {profile.canValidatePreventive && (
                <button
                  type="button"
                  data-testid="sup-tab-preventive"
                  onClick={() => setActiveQueueTab('PREVENTIVE')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    activeQueueTab === 'PREVENTIVE'
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                      : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-base font-black font-mono text-indigo-400">
                    {scopedCounts.prevCount}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Préventif</div>
                </button>
              )}

              {profile.canValidateSortieDemand && (
                <button
                  type="button"
                  data-testid="sup-tab-sortie"
                  onClick={() => setActiveQueueTab('SORTIE')}
                  className={`p-2.5 rounded-xl border transition cursor-pointer ${
                    activeQueueTab === 'SORTIE'
                      ? 'bg-teal-500/20 border-teal-500/50 text-white'
                      : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="text-base font-black font-mono text-teal-400">
                    {scopedCounts.sortieCount}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">Bons PDR</div>
                </button>
              )}

              <button
                type="button"
                data-testid="sup-tab-radar"
                onClick={() => setActiveQueueTab('RADAR')}
                className={`p-2.5 rounded-xl border transition cursor-pointer ${
                  activeQueueTab === 'RADAR'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                    : 'bg-slate-950/80 hover:bg-slate-800 border-slate-800 text-slate-300'
                }`}
              >
                <div className="text-base font-black font-mono text-emerald-400">
                  {profile.persona === 'RESPONSABLE_MAGASIN'
                    ? radarMetrics.ruptureCount + radarMetrics.alerteCount
                    : radarMetrics.activeBtsCount}
                </div>
                <div className="text-[10px] text-slate-400 font-bold">
                  {profile.persona === 'RESPONSABLE_MAGASIN' ? 'Alertes Stock' : 'Radar Atelier'}
                </div>
              </button>
            </div>

            {/* ==================================================================
                ACTIVE QUEUE CARDS (IN-PLACE MOBILE APPROVAL WITHOUT DESKTOP CRUSH)
               ================================================================== */}
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {activeQueueTab === 'CORRECTIVE' && profile.canValidateCorrective && (
                <>
                  {queues.pendingCorrective.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400">
                      Aucun Bon de Travail (BT) en attente de validation.
                    </div>
                  ) : (
                    queues.pendingCorrective.map((bt: any) => (
                      <div
                        key={bt.id}
                        className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-black">
                              {bt.num_bt || bt.id}
                            </span>
                            <span className="font-mono text-xs font-bold text-white truncate">
                              {bt.code_machine || bt.nom_machine}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {bt.action_realisee || bt.anomalie || 'Intervention corrective'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Tech : {bt.submitted_by_name || bt.intervenant || 'Technicien'}
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`mobile-sup-review-bt-${bt.id}`}
                          onClick={() => handleOpenReview('CORRECTIVE', bt)}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
                        >
                          Examiner
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeQueueTab === 'PREVENTIVE' && profile.canValidatePreventive && (
                <>
                  {queues.pendingPreventive.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400">
                      Aucune exécution préventive en attente de validation.
                    </div>
                  ) : (
                    queues.pendingPreventive.map((ex: any) => (
                      <div
                        key={ex.id}
                        className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black">
                              {ex.taskCode || ex.actionCode || 'PM'}
                            </span>
                            <span className="font-mono text-xs font-bold text-white truncate">
                              {ex.machineCode || ex.machineName}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {ex.organe || ex.notes || 'Maintenance préventive'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Tech : {ex.submitted_by_name || ex.executedBy || 'Technicien'}
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`mobile-sup-review-prev-${ex.id}`}
                          onClick={() => handleOpenReview('PREVENTIVE', ex)}
                          className="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs shrink-0 cursor-pointer"
                        >
                          Examiner
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeQueueTab === 'SORTIE' && profile.canValidateSortieDemand && (
                <>
                  {queues.pendingSortieDemands.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-400">
                      Aucune demande de sortie PDR en attente au magasin.
                    </div>
                  ) : (
                    queues.pendingSortieDemands.map((sd: any) => (
                      <div
                        key={sd.id}
                        className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-mono text-[10px] font-black">
                              {sd.id}
                            </span>
                            <span className="font-mono text-xs font-bold text-white truncate">
                              {sd.id_machine_registered || 'Atelier'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 truncate">
                            {(sd.items || [])
                              .map((it: any) => `${it.ref} (×${it.qty || it.quantite || 1})`)
                              .join(', ') || 'Pièces demandées'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Demandeur : {sd.created_by_name || sd.technicien || 'Technicien'}
                          </div>
                        </div>
                        <button
                          type="button"
                          data-testid={`mobile-sup-review-sortie-${sd.id}`}
                          onClick={() => handleOpenReview('SORTIE', sd)}
                          className="px-3 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
                        >
                          Servir / Valider
                        </button>
                      </div>
                    ))
                  )}
                </>
              )}

              {activeQueueTab === 'RADAR' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                      Stock Réservé (Terrain)
                    </div>
                    <div className="text-base font-black font-mono text-amber-400 mt-0.5">
                      {radarMetrics.totalReservedUnits} u. ({radarMetrics.reservedRefsCount} réf.)
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                      Ruptures / Alertes PDR
                    </div>
                    <div className="text-base font-black font-mono text-rose-400 mt-0.5">
                      {radarMetrics.ruptureCount} rupt. / {radarMetrics.alerteCount} al.
                    </div>
                  </div>
                  {profile.persona !== 'RESPONSABLE_MAGASIN' && (
                    <>
                      <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">
                          BTs Correctifs Actifs
                        </div>
                        <div className="text-base font-black font-mono text-sky-400 mt-0.5">
                          {radarMetrics.activeBtsCount} en cours
                        </div>
                      </div>
                      <div className="p-3 rounded-2xl bg-slate-950/90 border border-slate-800">
                        <div className="text-[10px] text-slate-400 font-bold uppercase">
                          Préventif en Retard
                        </div>
                        <div className="text-base font-black font-mono text-indigo-400 mt-0.5">
                          {radarMetrics.overduePmCount} tâches
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ShellPolicy Developer / Session Switcher */}
        <div className="text-slate-900">
          <ShellModeSwitcher />
        </div>
      </main>

      <footer className="text-center text-[11px] text-slate-500 font-mono pt-2 border-t border-slate-900">
        ShellPolicy • mode={mode} • resolved={resolved} • role={profile.normalizedRole}
      </footer>

      {/* ======================================================================
          IN-PLACE MOBILE MAKER-CHECKER APPROVAL MODAL
         ====================================================================== */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div
            data-testid="mobile-sup-review-modal"
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4 text-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {selectedItem.kind === 'CORRECTIVE'
                    ? 'Validation BT Correctif'
                    : selectedItem.kind === 'PREVENTIVE'
                    ? 'Validation Exécution Préventive'
                    : 'Validation Sortie Magasin PDR'}
                </span>
                <h3 className="text-sm font-black mt-1">
                  {selectedItem.record.num_bt ||
                    selectedItem.record.taskCode ||
                    selectedItem.record.id}{' '}
                  —{' '}
                  {selectedItem.record.code_machine ||
                    selectedItem.record.machineCode ||
                    selectedItem.record.id_machine_registered ||
                    'Atelier'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Reconciliation Alerts */}
            {activeReconciliation && activeReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeReconciliation.alerts.map((al, i) => (
                  <div
                    key={i}
                    className={`p-2.5 rounded-xl border text-xs flex items-start gap-2 ${
                      al.severity === 'critical'
                        ? 'bg-rose-950/60 border-rose-700 text-rose-200'
                        : 'bg-amber-950/60 border-amber-700 text-amber-200'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">{al.title}</div>
                      <div className="text-[11px] opacity-90">{al.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Storehouse Bon Code for SortieDemand */}
            {selectedItem.kind === 'SORTIE' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  N° Bon de Sortie Magasin officiel
                </label>
                <input
                  type="text"
                  value={codeBonMagasin}
                  onChange={(e) => setCodeBonMagasin(e.target.value)}
                  placeholder="Ex: BS-2026-105"
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            )}

            {/* Skip Double Stock Deduction Checkbox for BT/Preventive */}
            {selectedItem.kind !== 'SORTIE' && (
              <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipStockDeduction}
                  onChange={(e) => setSkipStockDeduction(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600"
                />
                <span>
                  <strong className="text-white">Pièces déjà déduites au magasin</strong> — Conserver
                  le coût PDR sur la machine sans déduire le stock en double.
                </span>
              </label>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Note de validation / Motif de clarification ou rejet
              </label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Note du superviseur / magasinier..."
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleConfirmDecision('REJECTED')}
                className="py-2.5 px-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 text-xs font-bold cursor-pointer"
              >
                Rejeter
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDecision('NEEDS_CLARIFICATION')}
                className="py-2.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-bold cursor-pointer"
              >
                À clarifier
              </button>
              <button
                type="button"
                data-testid="mobile-sup-confirm-approve-btn"
                onClick={() => handleConfirmDecision('APPROVED')}
                className="py-2.5 px-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
              >
                Approuver
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          OPERATOR QUICK BREAKDOWN (DI) MODAL
         ====================================================================== */}
      {showOperatorDiModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-5 space-y-4 text-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black">Signaler une Panne Machine (DI)</h3>
              <button
                type="button"
                onClick={() => setShowOperatorDiModal(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Équipement</label>
                <select
                  value={diMachineCode}
                  onChange={(e) => setDiMachineCode(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-xs text-white"
                >
                  <option value="">-- Choisir la machine --</option>
                  {machines.map((m: any) => {
                    const code = m.id_machine_registered || m.id || m.code;
                    return (
                      <option key={code} value={code}>
                        {code} — {m.nom || m.designation}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Urgence</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Normale', 'Haute', 'Critique'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setDiUrgence(u)}
                      className={`py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                        diUrgence === u
                          ? 'bg-rose-600 border-rose-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Symptôme / Anomalie constatée
                </label>
                <textarea
                  rows={3}
                  value={diAnomalie}
                  onChange={(e) => setDiAnomalie(e.target.value)}
                  placeholder="Ex: Bruit anormal roulement, fuite d'air..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateOperatorDi}
              className="w-full py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs cursor-pointer"
            >
              Envoyer la Demande d'Intervention
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
