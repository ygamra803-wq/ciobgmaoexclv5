import React from 'react';
import { Package, Plus, Wrench } from 'lucide-react';
import {
  isNeedRequestBlockingBtClosure,
  NEED_MATERIAL_CLASS_LABELS,
  NEED_STATUS_LABELS,
  POLICY_TAG_LABELS,
  type MaintenancePolicyTag,
  type NeedMaterialClass,
  type INeedRequest,
  type NeedRequestStatus,
} from '../../../../domain/corrective/needRequestService';
import {
  isWorkshopOrderActive,
  WORKSHOP_STATUS_LABELS,
  type IWorkshopOrder,
  type WorkshopOrderStatus,
  type WorkshopOrderType,
} from '../../../../domain/corrective/workshopOrderService';
import { SortieExterneService } from '../../../../application/services/SortieExterneService';

interface NeedFormState {
  material_class: NeedMaterialClass;
  policy_tag: MaintenancePolicyTag;
  quantite: number;
  description_besoin: string;
  id_ref_pdr: string;
}

interface BonAtelierFormState {
  type_demande: WorkshopOrderType;
  quantite: number;
  description_travaux: string;
  observation: string;
}

interface WorkshopQuickFormState {
  categorie_flux: 'ATELIER_MECANIQUE' | 'SOUS_TRAITANCE_EXTERNE';
  nature_travail: string;
  designation_piece: string;
  fournisseur_externe: string;
  cout_bobinage: number;
  suspendBtAfterCreate: boolean;
}

export interface InterventionLiveHandoffPanelsProps {
  activeIntervention: any;
  formState: any;
  isTechUser: boolean;
  showNeedRequestForm: boolean;
  setShowNeedRequestForm: React.Dispatch<React.SetStateAction<boolean>>;
  needForm: NeedFormState;
  setNeedForm: React.Dispatch<React.SetStateAction<NeedFormState>>;
  handleEmitNeedRequest: () => void;
  linkedNeedRequests: INeedRequest[];
  handleNeedFieldHandoff: (needId: string, nextStatus: NeedRequestStatus) => void;
  linkedWorkshopOrders: any[];
  linkedInternalWorkshopOrders: IWorkshopOrder[];
  showBonAtelierMecaniqueForm: boolean;
  setShowBonAtelierMecaniqueForm: React.Dispatch<React.SetStateAction<boolean>>;
  bonAtelierForm: BonAtelierFormState;
  setBonAtelierForm: React.Dispatch<React.SetStateAction<BonAtelierFormState>>;
  handleEmitBonAtelierMecanique: () => void;
  handleTransitionWorkshopOrderStatus: (
    orderId: string,
    nextStatus: WorkshopOrderStatus
  ) => { valid: boolean; reason?: string };
  handleMarkSortieReturned: (id: string, cost?: number) => void;
  showQuickWorkshopForm: boolean;
  setShowQuickWorkshopForm: React.Dispatch<React.SetStateAction<boolean>>;
  workshopQuickForm: WorkshopQuickFormState;
  setWorkshopQuickForm: React.Dispatch<React.SetStateAction<WorkshopQuickFormState>>;
  handleQuickCreateWorkshopOrder: () => void;
  showToast?: (message: string, type?: string) => void;
}

export function InterventionLiveHandoffPanels({
  activeIntervention,
  formState,
  isTechUser,
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
  showToast,
}: InterventionLiveHandoffPanelsProps) {
  return (
    <>
      {/* COR-HANDOFF-P0: Demande de Besoin & Chaîne de Remise Terrain (NeedRequest) */}
      <div
        data-testid="live-need-handoff-panel"
        className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/90 space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-black uppercase tracking-wider text-purple-950 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-purple-700" />
              Demande de Besoin & Remise Terrain (`COR-HANDOFF`)
            </span>
            <p className="text-[11px] text-purple-800 mt-0.5">
              Déclarez un besoin matière (`PDR`, `Part`, `Composant`). Le responsable choisit le canal (`STOCK`, `ACHAT`, `ATELIER`, `EXTERNE`), puis vous validez la pose et l’essai (`POSE_ESSAI` ➔ `CLOTURE_FIELD`).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid="toggle-need-request-form-btn"
              onClick={() => setShowNeedRequestForm((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {showNeedRequestForm ? 'Fermer Formulaire Besoin' : '+ Demande de Besoin (ND)'}
              </span>
            </button>
          </div>
        </div>

        {showNeedRequestForm && (
          <div
            data-testid="need-request-live-form"
            className="p-3.5 rounded-xl bg-white border-2 border-purple-300 space-y-3"
          >
            <div className="flex items-center justify-between text-xs font-black text-purple-950 uppercase">
              <span>
                Nouvelle Demande de Besoin (Machine: {activeIntervention.code_machine} • BT:{' '}
                {activeIntervention.num_bt || activeIntervention.id})
              </span>
              <span className="text-[10px] font-mono bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                Statut initial: DEMANDE_TECH (Canal arbitré par Responsable)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Classe Matière *
                </label>
                <select
                  value={needForm.material_class}
                  onChange={(e) => {
                    const nextCls = e.target.value as NeedMaterialClass;
                    const nextTag: MaintenancePolicyTag =
                      nextCls === 'PDR'
                        ? 'REPLACING'
                        : nextCls === 'OTHER'
                        ? 'MODIFYING'
                        : 'REPAIRABLE';
                    setNeedForm((p) => ({
                      ...p,
                      material_class: nextCls,
                      policy_tag: nextTag,
                    }));
                  }}
                  className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-purple-200 bg-slate-50"
                >
                  {(Object.keys(NEED_MATERIAL_CLASS_LABELS) as NeedMaterialClass[]).map((cls) => (
                    <option key={cls} value={cls}>
                      {cls} — {NEED_MATERIAL_CLASS_LABELS[cls]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Quantité *
                </label>
                <input
                  type="number"
                  min={1}
                  value={needForm.quantite}
                  onChange={(e) =>
                    setNeedForm((p) => ({
                      ...p,
                      quantite: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="w-full py-2 px-2.5 text-xs font-mono font-bold rounded-lg border border-purple-200 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Réf. PDR (Optionnel)
                </label>
                <input
                  type="text"
                  value={needForm.id_ref_pdr}
                  onChange={(e) =>
                    setNeedForm((p) => ({ ...p, id_ref_pdr: e.target.value }))
                  }
                  placeholder={formState.pdr_ref || 'Ex: RLM-6205...'}
                  className="w-full py-2 px-2.5 text-xs font-mono rounded-lg border border-purple-200 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                Politique & Nature du Besoin (`POLICY-TAGS`)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(['REPLACING', 'REPAIRABLE', 'MODIFYING'] as MaintenancePolicyTag[]).map((tag) => {
                  const isSelected = needForm.policy_tag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setNeedForm((p) => ({ ...p, policy_tag: tag }))}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-800 border-purple-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-mono font-bold text-[10px]">{tag}</span>
                        {isSelected && <span className="text-[9px] text-amber-400 font-bold">● Choisi</span>}
                      </div>
                      <span className={`text-[9.5px] font-medium leading-tight ${isSelected ? 'text-slate-300' : 'text-slate-600'}`}>
                        {POLICY_TAG_LABELS[tag]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                Description du Besoin Technique *
              </label>
              <input
                type="text"
                value={needForm.description_besoin}
                onChange={(e) =>
                  setNeedForm((p) => ({ ...p, description_besoin: e.target.value }))
                }
                placeholder="Ex: Roulement palier principal usé, bague d'usure à remplacer ou confectionner..."
                className="w-full py-2 px-2.5 text-xs rounded-lg border border-purple-200 bg-white"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNeedRequestForm(false)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700 cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                data-testid="submit-need-request-live-btn"
                onClick={handleEmitNeedRequest}
                className="px-4 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-black uppercase shadow-xs cursor-pointer"
              >
                Émettre Demande de Besoin (`DEMANDE_TECH`)
              </button>
            </div>
          </div>
        )}

        {linkedNeedRequests.length > 0 && (
          <div className="space-y-2">
            {linkedNeedRequests.map((req) => {
              const isBlocking = isNeedRequestBlockingBtClosure(req);
              const firstTag = req.policy_tags_snapshot?.[0];
              return (
                <div
                  key={req.id}
                  className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                    isBlocking
                      ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                      : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black px-2 py-0.5 rounded bg-white border border-current/20">
                      {req.code_demande}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-white/80 font-mono">
                      {req.material_class} ×{req.quantite}
                    </span>
                    {firstTag && (
                      <span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-white text-slate-800 border border-slate-300">
                        Tag: {firstTag}
                      </span>
                    )}
                    {req.canal_appro && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-300">
                        Canal: {req.canal_appro}
                        {req.code_workshop_order ? ` (${req.code_workshop_order})` : ''}
                      </span>
                    )}
                    <span className="font-bold">{req.description_besoin}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                        isBlocking
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {NEED_STATUS_LABELS[req.statut] || req.statut}
                    </span>

                    {req.statut === 'REMIS_TECHNICIEN' && (
                      <button
                        type="button"
                        onClick={() => handleNeedFieldHandoff(req.id, 'POSE_ESSAI')}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                      >
                        Démarrer Pose & Essai
                      </button>
                    )}

                    {req.statut === 'POSE_ESSAI' && (
                      <button
                        type="button"
                        onClick={() => handleNeedFieldHandoff(req.id, 'CLOTURE_FIELD')}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                      >
                        Valider Essai OK (Clôturer Besoin)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CORRECTIVE-ATELIER-P0: Bon de Réalisation & Rectification (Atelier / Externe) lié au BT */}
      {(String(formState.intervention_nature || '').toUpperCase() === 'ATELIER' ||
        linkedWorkshopOrders.length > 0) && (
        <div
          data-testid="live-atelier-bridge-panel"
          className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 space-y-3"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-indigo-700" />
                Bon d’Atelier / Rectification & Sous-Traitance lié au BT
              </span>
              <p className="text-[11px] text-indigo-800 mt-0.5">
                Tant qu’un bon d’atelier ou externe est en cours, le BT ne peut pas être clôturé définitivement (reste ou passe en <b>EN_ATTENTE_PDR</b>).
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                data-testid="toggle-bon-atelier-mecanique-btn"
                onClick={() => setShowBonAtelierMecaniqueForm((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>
                  {showBonAtelierMecaniqueForm
                    ? 'Fermer Bon Atelier'
                    : 'Bon atelier mécanique (BR / RECT)'}
                </span>
              </button>
              <button
                type="button"
                data-testid="toggle-quick-workshop-btn"
                onClick={() => setShowQuickWorkshopForm((v) => !v)}
                className="px-3 py-1.5 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showQuickWorkshopForm ? 'Fermer' : '+ Sortie Externe / Bobinage'}</span>
              </button>
            </div>
          </div>

          {/* Dedicated Bon Atelier Mécanique (REALISATION / RECTIFICATION) Form */}
          {showBonAtelierMecaniqueForm && (
            <div
              data-testid="bon-atelier-mecanique-form"
              className="p-3.5 rounded-xl bg-amber-50/90 border-2 border-amber-300 space-y-3"
            >
              <div className="flex items-center justify-between text-xs font-black text-amber-950 uppercase">
                <span>
                  Demande Réalisation / Rectification — Atelier Fabrication Mécanique (Machine:{' '}
                  {activeIntervention.code_machine})
                </span>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-amber-300">
                  Section SM ➔ Atelier Interne (Sans impact Stock PDR)
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Type de Demande *
                  </label>
                  <select
                    value={bonAtelierForm.type_demande}
                    onChange={(e) =>
                      setBonAtelierForm((p) => ({
                        ...p,
                        type_demande: e.target.value as WorkshopOrderType,
                      }))
                    }
                    className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                  >
                    <option value="REALISATION">REALISATION (Confection / Usinage neuf)</option>
                    <option value="RECTIFICATION">RECTIFICATION (Réparation / Tournage / Ajustage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Quantité *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={bonAtelierForm.quantite}
                    onChange={(e) =>
                      setBonAtelierForm((p) => ({
                        ...p,
                        quantite: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-amber-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                    Observation / Tolérance
                  </label>
                  <input
                    type="text"
                    value={bonAtelierForm.observation}
                    onChange={(e) =>
                      setBonAtelierForm((p) => ({ ...p, observation: e.target.value }))
                    }
                    placeholder="Urgence, plan, matière..."
                    className="w-full py-2 px-2.5 text-xs rounded-lg border border-amber-300 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-700 uppercase mb-1">
                  Description des travaux demandés *
                </label>
                <input
                  type="text"
                  value={bonAtelierForm.description_travaux}
                  onChange={(e) =>
                    setBonAtelierForm((p) => ({ ...p, description_travaux: e.target.value }))
                  }
                  placeholder="Ex: Usinage bague bronze Ø40x60 ou rectification arbre moteur..."
                  className="w-full py-2 px-2.5 text-xs rounded-lg border border-amber-300 bg-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBonAtelierMecaniqueForm(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  data-testid="submit-bon-atelier-mecanique-btn"
                  onClick={handleEmitBonAtelierMecanique}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black uppercase shadow-xs cursor-pointer"
                >
                  Émettre Bon Atelier & Mettre BT en Attente
                </button>
              </div>
            </div>
          )}

          {/* Existing Linked Internal Mechanical Workshop Orders (BR / RECT) */}
          {linkedInternalWorkshopOrders.length > 0 && (
            <div className="space-y-2">
              {linkedInternalWorkshopOrders.map((ord) => {
                const isOpen = isWorkshopOrderActive(ord.statut);
                return (
                  <div
                    key={ord.id}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      isOpen
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                        : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black px-2 py-0.5 rounded bg-white border border-current/20">
                        {ord.code_bon}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-white/80">
                        {ord.type_demande} (Qté: {ord.quantite})
                      </span>
                      <span className="font-bold">{ord.description_travaux}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isOpen
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        Atelier: {WORKSHOP_STATUS_LABELS[ord.statut] || ord.statut}
                      </span>
                      {ord.statut === 'PRET_LIVRAISON' && (
                        <button
                          type="button"
                          onClick={() => {
                            const res = handleTransitionWorkshopOrderStatus(
                              ord.id,
                              'RECEPTIONNE_MONTAGE'
                            );
                            if (res.valid) {
                              showToast?.(
                                `Bon ${ord.code_bon} réceptionné pour montage. Le BT peut maintenant être clôturé.`,
                                'success'
                              );
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                        >
                          Réceptionner Montage
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Existing Linked Workshop Orders */}
          {linkedWorkshopOrders.length > 0 && (
            <div className="space-y-2">
              {linkedWorkshopOrders.map((ord: any) => {
                const isOpen = SortieExterneService.isWorkshopOrderOpen(ord.etat);
                return (
                  <div
                    key={ord.id || ord.code}
                    className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      isOpen
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                        : 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black px-2 py-0.5 rounded bg-white border border-current/20">
                        {ord.code}
                      </span>
                      <span className="font-bold">
                        {ord.nature_travail || ord.type_probleme}
                      </span>
                      <span className="text-[11px] opacity-80">
                        • {ord.fournisseur_externe}
                      </span>
                      <span className="font-mono font-bold text-[11px] bg-white/80 px-2 py-0.5 rounded">
                        {Number(ord.cout_bobinage || 0).toLocaleString()} DH
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          isOpen
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {ord.etat}
                      </span>
                      {isOpen && !isTechUser && (
                        <button
                          type="button"
                          onClick={() => {
                            handleMarkSortieReturned(ord.id, ord.cout_bobinage);
                            showToast?.(
                              `Bon ${ord.code} réceptionné (Retourné OK). Vous pouvez maintenant clôturer le BT.`,
                              'success'
                            );
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer transition shadow-2xs"
                        >
                          Réceptionner OK
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Workshop Creation Form */}
          {(showQuickWorkshopForm || linkedWorkshopOrders.length === 0) && (
            <div className="p-3.5 rounded-xl bg-white border border-indigo-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Type de Flux
                  </label>
                  <select
                    value={workshopQuickForm.categorie_flux}
                    onChange={(e) => {
                      const cat = e.target.value as 'ATELIER_MECANIQUE' | 'SOUS_TRAITANCE_EXTERNE';
                      setWorkshopQuickForm((p) => ({
                        ...p,
                        categorie_flux: cat,
                        nature_travail:
                          cat === 'ATELIER_MECANIQUE'
                            ? 'Usinage / Rectification'
                            : 'Bobinage complet',
                        fournisseur_externe:
                          cat === 'ATELIER_MECANIQUE'
                            ? 'Atelier Mécanique Interne'
                            : 'Atelier Bobinage Externe',
                      }));
                    }}
                    className="w-full py-2 px-2.5 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50"
                  >
                    <option value="ATELIER_MECANIQUE">
                      Atelier Mécanique / Usinage & Rectification (BON-ATEL)
                    </option>
                    <option value="SOUS_TRAITANCE_EXTERNE">
                      Sous-Traitance Externe / Bobinage (SORT-EXT)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Nature du Travail
                  </label>
                  <select
                    value={workshopQuickForm.nature_travail}
                    onChange={(e) =>
                      setWorkshopQuickForm((p) => ({ ...p, nature_travail: e.target.value }))
                    }
                    className="w-full py-2 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50"
                  >
                    {workshopQuickForm.categorie_flux === 'ATELIER_MECANIQUE' ? (
                      <>
                        <option value="Usinage / Rectification">Usinage / Rectification</option>
                        <option value="Tournage arbre / axe">Tournage arbre / axe</option>
                        <option value="Soudure / Rechargement">Soudure / Rechargement</option>
                        <option value="Confection pièce sur mesure">Confection pièce sur mesure</option>
                        <option value="Révision mécanique / Alésage">Révision mécanique / Alésage</option>
                      </>
                    ) : (
                      <>
                        <option value="Bobinage complet">Bobinage complet</option>
                        <option value="Remplacement roulements + étanchéité">
                          Remplacement roulements + étanchéité
                        </option>
                        <option value="Rectification collecteur / induit">
                          Rectification collecteur / induit
                        </option>
                        <option value="Réparation électronique / variateur">
                          Réparation électronique / variateur
                        </option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    Organe / Pièce à usiner ou réparer
                  </label>
                  <input
                    type="text"
                    value={workshopQuickForm.designation_piece}
                    onChange={(e) =>
                      setWorkshopQuickForm((p) => ({ ...p, designation_piece: e.target.value }))
                    }
                    placeholder={`Ex: Arbre principal / Moteur ${activeIntervention.code_machine}`}
                    className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Atelier / Prestataire
                    </label>
                    <input
                      type="text"
                      value={workshopQuickForm.fournisseur_externe}
                      onChange={(e) =>
                        setWorkshopQuickForm((p) => ({
                          ...p,
                          fournisseur_externe: e.target.value,
                        }))
                      }
                      className="w-full py-2 px-2.5 text-xs rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                      Coût estimé (DH)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={workshopQuickForm.cout_bobinage}
                      onChange={(e) =>
                        setWorkshopQuickForm((p) => ({
                          ...p,
                          cout_bobinage: Math.max(0, Number(e.target.value) || 0),
                        }))
                      }
                      className="w-full py-2 px-2.5 text-xs font-mono font-bold rounded-lg border border-slate-200 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <label className="flex items-center gap-2 text-xs text-slate-700 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workshopQuickForm.suspendBtAfterCreate}
                    onChange={(e) =>
                      setWorkshopQuickForm((p) => ({
                        ...p,
                        suspendBtAfterCreate: e.target.checked,
                      }))
                    }
                    className="rounded border-indigo-300 text-indigo-600"
                  />
                  <span>
                    Suspendre automatiquement le BT en <b>EN_ATTENTE_PDR</b> après création du bon
                  </span>
                </label>
                <button
                  type="button"
                  data-testid="confirm-quick-workshop-btn"
                  onClick={handleQuickCreateWorkshopOrder}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer transition shadow-xs"
                >
                  Enregistrer le Bon & Lier au BT
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
