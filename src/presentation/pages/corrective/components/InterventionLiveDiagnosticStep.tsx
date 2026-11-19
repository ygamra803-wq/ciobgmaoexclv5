import type { Dispatch, SetStateAction } from 'react';
import { AlertTriangle } from 'lucide-react';
import { INTERVENTION_NATURE_OPTIONS } from '../../../components/common/ValidationStatusBadge';
import { InterventionLiveHandoffPanels } from './InterventionLiveHandoffPanels';
import type { CorrectiveInterventionItem, SortieExterneItem } from '../../../../types/store';
import type { IWorkshopOrder, WorkshopOrderStatus } from '../../../../domain/corrective/workshopOrderService';
import type { INeedRequest, NeedRequestStatus } from '../../../../domain/corrective/needRequestService';
import type { ToastState } from '../../../../hooks/useAppViewController';
import type {
  LiveBonAtelierFormState,
  LiveInterventionFormState,
  LiveNeedFormState,
  LiveWorkshopQuickFormState,
} from '../hooks/useInterventionLiveController';

interface InterventionLiveDiagnosticStepProps {
  activeIntervention: CorrectiveInterventionItem;
  formState: LiveInterventionFormState;
  setFormState: Dispatch<SetStateAction<LiveInterventionFormState>>;
  isTechUser: boolean;
  isWizardMode: boolean;
  showNeedRequestForm: boolean;
  setShowNeedRequestForm: Dispatch<SetStateAction<boolean>>;
  needForm: LiveNeedFormState;
  setNeedForm: Dispatch<SetStateAction<LiveNeedFormState>>;
  handleEmitNeedRequest: () => void;
  linkedNeedRequests: INeedRequest[];
  handleNeedFieldHandoff: (needId: string, nextStatus: NeedRequestStatus) => void;
  linkedWorkshopOrders: SortieExterneItem[];
  linkedInternalWorkshopOrders: IWorkshopOrder[];
  showBonAtelierMecaniqueForm: boolean;
  setShowBonAtelierMecaniqueForm: Dispatch<SetStateAction<boolean>>;
  bonAtelierForm: LiveBonAtelierFormState;
  setBonAtelierForm: Dispatch<SetStateAction<LiveBonAtelierFormState>>;
  handleEmitBonAtelierMecanique: () => void;
  handleTransitionWorkshopOrderStatus: (
    orderId: string,
    nextStatus: WorkshopOrderStatus,
    observation?: string
  ) => { valid: boolean; reason?: string; order?: IWorkshopOrder };
  handleMarkSortieReturned: (id: string) => void;
  showQuickWorkshopForm: boolean;
  setShowQuickWorkshopForm: Dispatch<SetStateAction<boolean>>;
  workshopQuickForm: LiveWorkshopQuickFormState;
  setWorkshopQuickForm: Dispatch<SetStateAction<LiveWorkshopQuickFormState>>;
  handleQuickCreateWorkshopOrder: () => void;
  setTravailSearch: Dispatch<SetStateAction<string>>;
  showTravailSuggestions: boolean;
  setShowTravailSuggestions: Dispatch<SetStateAction<boolean>>;
  filteredSuggestions: string[];
  smartAnomalyActions: string[];
  showToast?: (msg: string, type?: ToastState['type']) => void;
}

export function InterventionLiveDiagnosticStep({
  activeIntervention,
  formState,
  setFormState,
  isTechUser,
  isWizardMode,
  showNeedRequestForm,
  setShowNeedRequestForm,
  needForm,
  setNeedForm,
  handleEmitNeedRequest,
  linkedNeedRequests,
  handleNeedFieldHandoff,
  linkedWorkshopOrders,
  linkedInternalWorkshopOrders,
  showBonAtelierMecaniqueForm,
  setShowBonAtelierMecaniqueForm,
  bonAtelierForm,
  setBonAtelierForm,
  handleEmitBonAtelierMecanique,
  handleTransitionWorkshopOrderStatus,
  handleMarkSortieReturned,
  showQuickWorkshopForm,
  setShowQuickWorkshopForm,
  workshopQuickForm,
  setWorkshopQuickForm,
  handleQuickCreateWorkshopOrder,
  setTravailSearch,
  showTravailSuggestions,
  setShowTravailSuggestions,
  filteredSuggestions,
  smartAnomalyActions,
  showToast,
}: InterventionLiveDiagnosticStepProps) {
  return (
    <div className="space-y-4">
      {/* VAL-3 Banner: Show Supervisor Clarification / Rejection Note when editing & resubmitting */}
      {(activeIntervention.validation_status === 'NEEDS_CLARIFICATION' ||
        activeIntervention.validation_status === 'REJECTED') &&
        activeIntervention.validation_note && (
          <div
            className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs ${
              activeIntervention.validation_status === 'REJECTED'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-orange-50 border-orange-300 text-orange-950'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-black uppercase tracking-wider">
                {activeIntervention.validation_status === 'REJECTED'
                  ? 'Déclaration précédente rejetée (Sans effet stock) — Nouvelle déclaration :'
                  : 'Clarification demandée par le responsable — Corrigez et renvoyez :'}
              </div>
              <p className="font-semibold mt-0.5">{activeIntervention.validation_note}</p>
            </div>
          </div>
        )}

      {/* VAL-4: Nature de l'intervention (Optionnel · Compatible ascendant) */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
          Nature de l'Intervention (Optionnel · Contrôle cohérence PDR)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {INTERVENTION_NATURE_OPTIONS.map((opt) => {
            const isSelected =
              String(formState.intervention_nature || '').toUpperCase() === opt.code;
            return (
              <button
                key={opt.code}
                type="button"
                data-testid={`live-nature-${opt.code}`}
                onClick={() =>
                  setFormState((p) => ({
                    ...p,
                    intervention_nature: isSelected ? '' : opt.code,
                  }))
                }
                className={`px-3 py-2 rounded-xl border text-left text-xs font-bold transition cursor-pointer flex items-center justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="truncate">{opt.shortLabel}</span>
                {opt.requiresPartsWarning && (
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                      isSelected ? 'bg-amber-400 text-slate-950' : 'bg-cyan-100 text-cyan-800'
                    }`}
                  >
                    +PDR
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <InterventionLiveHandoffPanels
        activeIntervention={activeIntervention}
        formState={formState}
        isTechUser={isTechUser}
        showNeedRequestForm={showNeedRequestForm}
        setShowNeedRequestForm={setShowNeedRequestForm}
        needForm={needForm}
        setNeedForm={setNeedForm}
        handleEmitNeedRequest={handleEmitNeedRequest}
        linkedNeedRequests={linkedNeedRequests}
        handleNeedFieldHandoff={handleNeedFieldHandoff}
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
        showToast={
          showToast
            ? (message: string, type?: string) => showToast(message, type as ToastState['type'])
            : undefined
        }
      />

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

      {/* Actions fréquentes rapides en mode Wizard */}
      {isWizardMode && smartAnomalyActions.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-1.5">
          <span className="text-[10.5px] font-black uppercase tracking-wider text-amber-950 block">
            Solutions rapides associées à « {activeIntervention.anomalie} » :
          </span>
          <div className="flex flex-wrap gap-1.5">
            {smartAnomalyActions.map((act, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setFormState((p) => ({ ...p, action_realisee: act, travail_a_faire: act }))
                }
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-semibold text-[11px] cursor-pointer transition shadow-2xs"
              >
                + {act}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
