import { useState } from 'react';
import {
  CheckCircle,
  Wrench,
  Package,
  Play,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Wand2,
  LayoutList,
  History,
  Zap,
  Clock,
} from 'lucide-react';
import { WizardShell, useWizardFeature, type WizardProfile } from '../../components/common/wizard';
import { useI18n } from '../../../i18n/I18nContext';
import { canCloseWorkOrderWithLoto } from '../../../domain/corrective/lotoService';
import LotoPermitPanel from './components/LotoPermitPanel';
import { InterventionLiveChronoConsole } from './components/InterventionLiveChronoConsole';
import { InterventionLiveDiagnosticStep } from './components/InterventionLiveDiagnosticStep';
import { InterventionLivePdrStep } from './components/InterventionLivePdrStep';
import { InterventionLiveLifecycleStep } from './components/InterventionLiveLifecycleStep';
import {
  buildEffectivePiecesList,
  useInterventionLiveController,
  type InterventionLiveTabProps,
  type LiveRankedStockItem,
} from './hooks/useInterventionLiveController';

export type { InterventionLiveTabProps };

export default function InterventionLiveTab(props: InterventionLiveTabProps) {
  const { t } = useI18n();
  const { isEnabled: isWizardMode, setEnabled: setWizardMode } = useWizardFeature('corrective_bt');

  const [quickMinorAction, setQuickMinorAction] = useState('');
  const QUICK_MINOR_PRESETS = [
    'Réarmement relais thermique',
    'Nettoyage capteur / cellule',
    'Réglage fin de course',
    'Serrage bornier / connexion',
    'Appoint huile / graissage',
  ];

  const ctrl = useInterventionLiveController(props);
  const {
    user,
    isTechUser,
    isReadOnlyUser,
    canFastTrackNeed,
    actorName,
    actorRole,
    activeIntervention,
    recentMachineFailures,
    liveWorkingTime,
    shiftStatus,
    formState,
    setFormState,
    setTravailSearch,
    showTravailSuggestions,
    setShowTravailSuggestions,
    filteredSuggestions,
    smartAnomalyActions,
    pdrSearch,
    setPdrSearch,
    showPdrList,
    setShowPdrList,
    rankedMachineStockItems,
    matchedStockItems,
    handleSelectPdr,
    handleAddPieceToList,
    handleRemovePieceFromList,
    machineComponents,
    machineParts,
    linkedWorkshopOrders,
    linkedInternalWorkshopOrders,
    openWorkshopOrders,
    linkedNeedRequests,
    blockingNeedRequests,
    showNeedRequestForm,
    setShowNeedRequestForm,
    needForm,
    setNeedForm,
    handleEmitNeedRequest,
    handleNeedFieldHandoff,
    handleFastTrackLinkedNeed,
    showBonAtelierMecaniqueForm,
    setShowBonAtelierMecaniqueForm,
    bonAtelierForm,
    setBonAtelierForm,
    handleEmitBonAtelierMecanique,
    showQuickWorkshopForm,
    setShowQuickWorkshopForm,
    workshopQuickForm,
    setWorkshopQuickForm,
    handleQuickCreateWorkshopOrder,
    handleStartLiveIntervention,
    handleTransitionWorkshopOrderStatus,
    handleMarkSortieReturned,
    executeClotureOrSubmit,
    handleClotureSubmit,
    handleQuickMinorClosure,
  } = ctrl;

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
          onClick={() => props.onNavigateToTab?.('corrective_bt')}
          className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-amber-600/25 active:scale-95 inline-flex items-center gap-2"
        >
          <Wrench className="w-4 h-4" />
          <span>{t('corrective.tabs.bt')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const step1DiagnosticSection = (
    <InterventionLiveDiagnosticStep
      activeIntervention={activeIntervention}
      formState={formState}
      setFormState={setFormState}
      isTechUser={isTechUser}
      canFastTrackNeed={canFastTrackNeed}
      isWizardMode={isWizardMode}
      showNeedRequestForm={showNeedRequestForm}
      setShowNeedRequestForm={setShowNeedRequestForm}
      needForm={needForm}
      setNeedForm={setNeedForm}
      handleEmitNeedRequest={handleEmitNeedRequest}
      linkedNeedRequests={linkedNeedRequests}
      handleNeedFieldHandoff={handleNeedFieldHandoff}
      handleFastTrackLinkedNeed={handleFastTrackLinkedNeed}
      linkedWorkshopOrders={linkedWorkshopOrders}
      linkedInternalWorkshopOrders={linkedInternalWorkshopOrders}
      showBonAtelierMecaniqueForm={showBonAtelierMecaniqueForm}
      setShowBonAtelierMecaniqueForm={setShowBonAtelierMecaniqueForm}
      bonAtelierForm={bonAtelierForm}
      setBonAtelierForm={setBonAtelierForm}
      handleEmitBonAtelierMecanique={handleEmitBonAtelierMecanique}
      handleTransitionWorkshopOrderStatus={handleTransitionWorkshopOrderStatus}
      handleMarkSortieReturned={handleMarkSortieReturned}
      showQuickWorkshopForm={showQuickWorkshopForm}
      setShowQuickWorkshopForm={setShowQuickWorkshopForm}
      workshopQuickForm={workshopQuickForm}
      setWorkshopQuickForm={setWorkshopQuickForm}
      handleQuickCreateWorkshopOrder={handleQuickCreateWorkshopOrder}
      setTravailSearch={setTravailSearch}
      showTravailSuggestions={showTravailSuggestions}
      setShowTravailSuggestions={setShowTravailSuggestions}
      filteredSuggestions={filteredSuggestions}
      smartAnomalyActions={smartAnomalyActions}
      showToast={props.showToast}
    />
  );

  const step2PdrSection = (
    <InterventionLivePdrStep
      formState={formState}
      setFormState={setFormState}
      pdrSearch={pdrSearch}
      setPdrSearch={setPdrSearch}
      showPdrList={showPdrList}
      setShowPdrList={setShowPdrList}
      matchedStockItems={matchedStockItems as LiveRankedStockItem[]}
      handleSelectPdr={handleSelectPdr}
      handleAddPieceToList={handleAddPieceToList}
      handleRemovePieceFromList={handleRemovePieceFromList}
    />
  );

  const step3LifecycleSection = (
    <InterventionLiveLifecycleStep
      activeIntervention={activeIntervention}
      formState={formState}
      setFormState={setFormState}
      machineComponents={machineComponents}
      machineParts={machineParts}
      isWizardMode={isWizardMode}
      liveWorkingTime={liveWorkingTime}
    />
  );

  const pauseAndSuspendButtons = (
    <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
      <button
        type="button"
        onClick={() => {
          props.setActiveLiveId?.(null);
          props.showToast?.(`Intervention ${activeIntervention.num_bt || ''} mise en pause.`, 'info');
          props.onNavigateToTab?.('corrective_bt');
        }}
        className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 font-bold text-xs text-slate-700 cursor-pointer w-full sm:w-auto"
      >
        Mettre en Pause / Quitter
      </button>

      {typeof props.onUpdateIntervention === 'function' && (
        <button
          type="button"
          onClick={() => {
            props.onUpdateIntervention?.(activeIntervention.id, {
              ...formState,
              statut: 'EN_ATTENTE_PDR',
            });
            props.setActiveLiveId?.(null);
            props.showToast?.(
              `BT ${activeIntervention.num_bt || activeIntervention.id} suspendu en attente de pièce (EN_ATTENTE_PDR).`,
              'warning'
            );
            props.onNavigateToTab?.('corrective_bt');
          }}
          className="px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 font-bold text-xs text-amber-900 cursor-pointer w-full sm:w-auto"
        >
          Suspendre (Attente PDR)
        </button>
      )}
    </div>
  );

  const correctiveBtWizardProfile: WizardProfile = {
    id: 'corrective-bt-cloture-wizard',
    moduleKey: 'corrective_bt',
    code: activeIntervention.num_bt || 'BT-LIVE',
    title: isTechUser
      ? 'Assistant Déclaration Terrain (BT)'
      : 'Assistant Clôture Bon de Travail (BT)',
    subtitle: `Machine ${activeIntervention.code_machine} • ${activeIntervention.num_bt || 'BT'} • Colonnes Excel K → N`,
    themeColor: 'amber',
    finishLabel: isTechUser
      ? 'Soumettre pour Validation Responsable'
      : "Clôturer l'Intervention & Valider le Rapport",
    onFinish: async () => executeClotureOrSubmit(),
    steps: [
      {
        id: 'step-1-diagnostic',
        code: 'ÉTAPE 01',
        title: 'Action Réalisée (Col K)',
        description:
          "Renseignez le diagnostic technique et le travail effectivement réalisé sur l'équipement.",
        badge: 'COL K',
        icon: Wrench,
        content: step1DiagnosticSection,
        validate: () => {
          const actionText = String(
            formState.action_realisee || formState.travail_a_faire || ''
          ).trim();
          if (!actionText) {
            return {
              isValid: false,
              severity: 'critical',
              message:
                "Veuillez décrire le travail réalisé (Col K) avant de passer à l'étape des pièces de rechange.",
            };
          }
          return { isValid: true };
        },
      },
      {
        id: 'step-2-pdr',
        code: 'ÉTAPE 02',
        title: 'Pièces PDR & Magasin',
        description:
          'Sélectionnez les pièces de rechange consommées (Col L), leur marque (Col M), leur état (Col N) et le N° de bon.',
        badge: 'COL L-N',
        optional: true,
        validateOn: 'always',
        icon: Package,
        content: step2PdrSection,
        validate: (ctx) => {
          if (formState.pdr_ref && Number(formState.pdr_quantite) <= 0) {
            return {
              isValid: false,
              severity: 'critical',
              message: `La quantité pour la pièce [${formState.pdr_ref}] doit être supérieure à 0.`,
            };
          }

          const effectivePieces = buildEffectivePiecesList(formState);
          let stockWarningMessage: string | null = null;

          for (const piece of effectivePieces) {
            const ref = String(piece.ref || '').trim();
            if (!ref) continue;
            const qty = Number(piece.quantite || 0);
            if (qty <= 0) {
              return {
                isValid: false,
                severity: 'critical',
                message: `La quantité pour la pièce [${ref}] doit être supérieure à 0.`,
              };
            }

            const stockItem = (rankedMachineStockItems as LiveRankedStockItem[]).find(
              (s) =>
                String(s.ref || s.code_article || '').trim().toUpperCase() === ref.toUpperCase()
            );
            const availableStock =
              stockItem !== undefined
                ? Number(stockItem.stockActuel ?? stockItem.stock_actuel ?? stockItem.quantite ?? 0)
                : String(formState.pdr_ref || '').trim().toUpperCase() === ref.toUpperCase() &&
                    formState.pdr_stock_actuel !== undefined
                  ? Number(formState.pdr_stock_actuel)
                  : Infinity;

            if (qty > availableStock && !stockWarningMessage) {
              stockWarningMessage = `Attention : la quantité totale demandée pour [${ref}] (${qty}) dépasse le stock disponible (${availableStock}).`;
            }
          }

          if (ctx?.mode === 'submit' && String(formState.pdr_ref || '').trim()) {
            setFormState((prev) => ({
              ...prev,
              pieces_utilisees: buildEffectivePiecesList(prev),
              pdr_ref: '',
              pdr_designation: '',
              pdr_quantite: 1,
              pdr_stock_actuel: undefined,
            }));
            setPdrSearch('');
          }

          if (stockWarningMessage) {
            return { isValid: true, severity: 'warning', message: stockWarningMessage };
          }
          return { isValid: true };
        },
      },
      {
        id: 'step-3-cloture',
        code: 'ÉTAPE 03',
        title: 'Organe & Validation',
        description:
          "Mettez à jour l'état de l'organe ou de la part structurelle et validez la clôture du Bon de Travail.",
        badge: 'CLÔTURE',
        icon: CheckCircle,
        content: step3LifecycleSection,
        validate: () => {
          const actionText = String(
            formState.action_realisee || formState.travail_a_faire || ''
          ).trim();
          if (!actionText) {
            return {
              isValid: false,
              severity: 'critical',
              message: 'Le rapport de travail réalisé (Col K) est requis pour clôturer le BT.',
            };
          }
          if (!isTechUser) {
            const lotoCloseCheck = canCloseWorkOrderWithLoto(activeIntervention);
            if (!lotoCloseCheck.valid) {
              return {
                isValid: false,
                severity: 'critical',
                message:
                  lotoCloseCheck.reason ||
                  'Clôture bloquée : déconsignez le permis LOTO avant de clôturer le BT.',
              };
            }
          }
          return { isValid: true };
        },
      },
    ],
  };

  return (
    <div className="space-y-6">
      <InterventionLiveChronoConsole
        title={t('corrective.live.title')}
        activeIntervention={activeIntervention}
        liveWorkingTime={liveWorkingTime}
        shiftStatus={shiftStatus}
        smartAnomalyActions={smartAnomalyActions}
        setFormState={setFormState}
      />

      <LotoPermitPanel
        intervention={activeIntervention}
        onUpdateIntervention={props.onUpdateIntervention}
        onStartWork={handleStartLiveIntervention}
        showToast={props.showToast}
        isReadOnly={isReadOnlyUser}
        actorId={user?.personnelId || user?.code || user?.id}
        actorName={actorName}
        actorRole={actorRole}
      />

      {/* PHASE C4a — Dernières 3 pannes clôturées sur la même machine */}
      <div
        data-testid="live-recent-failures-panel"
        className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-2.5"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
            <History className="w-4 h-4 text-amber-600" />
            <span>
              Dernières Pannes — {activeIntervention.code_machine} (Top 3 Historique)
            </span>
          </div>
          <span className="text-[10.5px] font-mono font-bold text-slate-500">
            {recentMachineFailures.length > 0
              ? `${recentMachineFailures.length} intervention(s) récente(s)`
              : 'Aucun antécédent clôturé'}
          </span>
        </div>

        {recentMachineFailures.length === 0 ? (
          <p className="text-xs text-slate-500">
            Première panne enregistrée ou aucun historique clôturé sur{' '}
            <b>{activeIntervention.code_machine}</b>.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {recentMachineFailures.map((prevBt, idx) => {
              const prevDate = String(
                prevBt.date_cloture || prevBt.date_fin || prevBt.date_demande || prevBt.date || ''
              ).slice(0, 10);
              const prevPdrs = Array.isArray(prevBt.pieces_utilisees)
                ? prevBt.pieces_utilisees.map((p) => `${p.ref} (×${p.quantite})`).join(', ')
                : prevBt.pdr_ref || '';
              return (
                <div
                  key={String(prevBt.id || prevBt.num_bt || idx)}
                  data-testid={`recent-failure-card-${idx}`}
                  className="p-3 rounded-xl bg-slate-50/90 border border-slate-200 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono font-black text-[11px] text-slate-900">
                      {prevBt.num_bt || prevBt.id}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {prevDate || '—'}
                      {prevBt.temps_intervention_calc || prevBt.temps_intervention
                        ? ` · ${prevBt.temps_intervention_calc || prevBt.temps_intervention}`
                        : ''}
                    </span>
                  </div>
                  <div className="font-bold text-rose-800 line-clamp-1">
                    {prevBt.anomalie || 'Anomalie non précisée'}
                  </div>
                  <div className="text-[11px] text-slate-700 line-clamp-2">
                    <b className="text-slate-900">
                      {prevBt.cause_racine ? 'Cause / Action :' : 'Action :'}
                    </b>{' '}
                    {prevBt.cause_racine || prevBt.action_realisee || prevBt.travail_a_faire || '—'}
                  </div>
                  {prevPdrs && (
                    <div className="text-[10px] font-mono font-bold text-cyan-800 bg-cyan-50 border border-cyan-200 px-2 py-0.5 rounded truncate">
                      PDR : {prevPdrs}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* PHASE C4b — Clôture Express (Panne mineure — 0 PDR) */}
      {!isReadOnlyUser && activeIntervention.statut !== 'CLOTURE' && (() => {
        const lotoCheck: { valid: boolean; reason?: string } = !isTechUser
          ? canCloseWorkOrderWithLoto(activeIntervention)
          : { valid: true };
        const expressBlocker =
          !lotoCheck.valid
            ? lotoCheck.reason || 'Permis LOTO encore consigné.'
            : !isTechUser && openWorkshopOrders.length > 0
            ? 'Bon d’atelier / externe encore ouvert.'
            : !isTechUser && blockingNeedRequests.length > 0
            ? 'Demande de besoin encore en cours.'
            : null;
        return (
          <div
            data-testid="live-quick-minor-closure"
            className="bg-emerald-50/70 rounded-2xl border border-emerald-200/90 p-4 shadow-xs space-y-2.5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-950">
                <Zap className="w-4 h-4 text-emerald-600" />
                <span>Clôture Express — Panne Mineure (0 PDR · Réglage / Nettoyage)</span>
              </div>
              <span className="text-[10.5px] font-mono font-bold text-emerald-800 bg-white/80 px-2 py-0.5 rounded border border-emerald-200">
                {isTechUser ? 'Soumission 1-clic (Maker-Checker actif)' : 'Clôture directe 1-clic (LOTO respecté)'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_MINOR_PRESETS.map((preset) => {
                const selected = quickMinorAction === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    data-testid={`quick-minor-preset-${preset.slice(0, 12).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    onClick={() => setQuickMinorAction(preset)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                      selected
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white hover:bg-emerald-100 text-emerald-950 border-emerald-200'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                data-testid="live-quick-minor-input"
                value={quickMinorAction}
                onChange={(e) => setQuickMinorAction(e.target.value)}
                placeholder="Choisissez un raccourci ci-dessus ou décrivez l'action mineure..."
                className="flex-1 py-2 px-3 rounded-xl border border-emerald-300 bg-white text-xs font-medium text-slate-900 focus:outline-hidden focus:border-emerald-500"
              />
              <button
                type="button"
                data-testid="live-quick-minor-submit-btn"
                disabled={Boolean(expressBlocker) || !quickMinorAction.trim()}
                onClick={() => {
                  const ok = handleQuickMinorClosure(quickMinorAction);
                  if (ok) setQuickMinorAction('');
                }}
                className={`px-4 py-2 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 transition shrink-0 ${
                  Boolean(expressBlocker) || !quickMinorAction.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : isTechUser
                    ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-xs'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  {isTechUser ? 'Soumettre Express (0 PDR)' : 'Clôture Express (0 PDR)'}
                </span>
              </button>
            </div>

            {expressBlocker && (
              <div
                data-testid="live-quick-minor-blocker"
                className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Clôture express verrouillée : {expressBlocker}</span>
              </div>
            )}
          </div>
        );
      })()}

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

      {/* Clôture Form & PDR Consumption Card (Toggleable Classic ⇄ Wizard) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center text-amber-700 shadow-2xs shrink-0">
              <FileCheck className="w-4 h-4 text-amber-700" />
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

          <div
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/90 shadow-2xs self-start sm:self-auto shrink-0"
            role="group"
            aria-label="Mode de clôture BT"
          >
            <button
              type="button"
              onClick={() => setWizardMode(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                !isWizardMode
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5 text-slate-600" />
              <span>Formulaire Classique</span>
            </button>

            <button
              type="button"
              onClick={() => setWizardMode(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                isWizardMode
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-500 hover:text-amber-700'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Assistant Wizard</span>
            </button>
          </div>
        </div>

        {isWizardMode ? (
          <div className="space-y-4">
            <WizardShell
              profile={correctiveBtWizardProfile}
              layout="split"
              className="min-h-[480px] max-h-[760px]"
            />
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              {pauseAndSuspendButtons}
            </div>
          </div>
        ) : (
          <form onSubmit={handleClotureSubmit} className="space-y-6">
            {step1DiagnosticSection}
            {step2PdrSection}
            {step3LifecycleSection}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
              {pauseAndSuspendButtons}

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
        )}
      </div>
    </div>
  );
}
