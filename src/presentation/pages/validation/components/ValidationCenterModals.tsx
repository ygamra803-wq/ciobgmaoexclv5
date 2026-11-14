import React from 'react';
import { X, AlertTriangle, Trash2, Calculator } from 'lucide-react';
import { INTERVENTION_NATURE_OPTIONS } from '../../../components/common/ValidationStatusBadge';
import type {
  CandidateStoreMovementMatch,
  ClaimReconciliationResult,
  ReconciliationAlert,
} from '../../../../core/security/validationReconciliation';
import type { ISortieDemand, ISortieDemandItem } from '../../../../types/domain';
import type {
  PreventiveExecutionRecord,
  PreventiveExecutionSpareItem,
} from '../../../../types/preventive';
import type {
  CorrectiveInterventionItem,
  CorrectivePdrConsumedItem,
} from '../../../../types/store';

export interface ValidationBtPieceDraft extends Partial<CorrectivePdrConsumedItem> {
  ref: string;
  designation?: string;
  quantite?: number;
  qty?: number;
}

export interface ValidationExecSpareDraft extends PreventiveExecutionSpareItem {
  reference?: string;
  quantite?: number;
  unite?: string;
  prix_unitaire?: number;
}

export interface ValidationDemandItemDraft extends ISortieDemandItem {
  qty?: number;
}

export interface ValidationCenterModalsProps {
  reviewBt: CorrectiveInterventionItem | null;
  setReviewBt: (bt: CorrectiveInterventionItem | null) => void;
  activeBtReconciliation: ClaimReconciliationResult | null;
  btNature: string;
  setBtNature: (v: string) => void;
  btActionRealisee: string;
  setBtActionRealisee: (v: string) => void;
  btPieces: ValidationBtPieceDraft[];
  setBtPieces: React.Dispatch<React.SetStateAction<ValidationBtPieceDraft[]>>;
  btSkipStockDeduction: boolean;
  setBtSkipStockDeduction: (v: boolean) => void;
  btNote: string;
  setBtNote: (v: string) => void;
  handleConfirmBtDecision: (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => void;
  reviewExec: PreventiveExecutionRecord | null;
  setReviewExec: (exec: PreventiveExecutionRecord | null) => void;
  activeExecReconciliation: ClaimReconciliationResult | null;
  execSpares: ValidationExecSpareDraft[];
  setReviewExecSpares: React.Dispatch<React.SetStateAction<ValidationExecSpareDraft[]>>;
  execSkipStockDeduction: boolean;
  setExecSkipStockDeduction: (v: boolean) => void;
  execCreateFollowUpDi: boolean;
  setExecCreateFollowUpDi: (v: boolean) => void;
  execFollowUpDiAnomalie: string;
  setExecFollowUpDiAnomalie: (v: string) => void;
  execNote: string;
  setExecNote: (v: string) => void;
  handleConfirmExecDecision: (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => void;
  reviewDemand: ISortieDemand | null;
  setReviewDemand: (d: ISortieDemand | null) => void;
  activeDemandReconciliation: ClaimReconciliationResult | null;
  demandCodeBonMagasin: string;
  setDemandCodeBonMagasin: (v: string) => void;
  demandMergeMovementId: string;
  setDemandMergeMovementId: (v: string) => void;
  demandItems: ValidationDemandItemDraft[];
  setDemandItems: React.Dispatch<React.SetStateAction<ValidationDemandItemDraft[]>>;
  demandNote: string;
  setDemandNote: (v: string) => void;
  handleConfirmDemandDecision: (decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED') => void;
  showFormulasModal: boolean;
  setShowFormulasModal: (v: boolean) => void;
  validationFormulas: Array<{ title: string; formula: string; description: string }>;
}

export default function ValidationCenterModals({
  reviewBt,
  setReviewBt,
  activeBtReconciliation,
  btNature,
  setBtNature,
  btActionRealisee,
  setBtActionRealisee,
  btPieces,
  setBtPieces,
  btSkipStockDeduction,
  setBtSkipStockDeduction,
  btNote,
  setBtNote,
  handleConfirmBtDecision,
  reviewExec,
  setReviewExec,
  activeExecReconciliation,
  execSpares,
  setReviewExecSpares,
  execSkipStockDeduction,
  setExecSkipStockDeduction,
  execCreateFollowUpDi,
  setExecCreateFollowUpDi,
  execFollowUpDiAnomalie,
  setExecFollowUpDiAnomalie,
  execNote,
  setExecNote,
  handleConfirmExecDecision,
  reviewDemand,
  setReviewDemand,
  activeDemandReconciliation,
  demandCodeBonMagasin,
  setDemandCodeBonMagasin,
  demandMergeMovementId,
  setDemandMergeMovementId,
  demandItems,
  setDemandItems,
  demandNote,
  setDemandNote,
  handleConfirmDemandDecision,
  showFormulasModal,
  setShowFormulasModal,
  validationFormulas,
}: ValidationCenterModalsProps) {
  return (
    <>
      {/* MODAL 1: CORRECTIVE BT MAKER-CHECKER REVIEW MODAL */}
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
                  Revue &amp; Validation Bon de Travail (BT)
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

            {activeBtReconciliation && activeBtReconciliation.alerts.length > 0 && (
              <div className="space-y-1.5">
                {activeBtReconciliation.alerts.map((alert: ReconciliationAlert, idx: number) => (
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
                  Nature de l&apos;intervention (modifiable avant validation)
                </label>
                <select
                  data-testid="vc-bt-nature-select"
                  value={btNature}
                  onChange={(e) => setBtNature(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold bg-white"
                >
                  <option value="">-- Non spécifiée (Autre) --</option>
                  {INTERVENTION_NATURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.shortLabel})
                    </option>
                  ))}
                </select>
              </div>

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

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-xs font-black text-slate-800">
                  Pièces à déduire du stock à l&apos;approbation ({btPieces.length})
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
                Approuver &amp; Clôturer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PREVENTIVE EXECUTION MAKER-CHECKER REVIEW MODAL */}
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
                  Revue &amp; Validation Exécution Préventive
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
                {activeExecReconciliation.alerts.map((alert: ReconciliationAlert, idx: number) => (
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
                  Pièces à déduire du stock à l&apos;approbation ({execSpares.length})
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
                Approuver l&apos;Exécution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: SORTIE DEMAND MAKER-CHECKER & RECONCILIATION MODAL */}
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
                  Validation &amp; Rapprochement Demande de Sortie PDR
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
                {activeDemandReconciliation.alerts.map((alert: ReconciliationAlert, idx: number) => (
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
                      {activeDemandReconciliation.candidateStoreMovements.map((cand: CandidateStoreMovementMatch) => (
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

      {/* Formulas Modal */}
      {showFormulasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700 shrink-0">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Formules &amp; Règles — Centre de Validation (Maker-Checker)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gouvernance des clôtures, rapprochement des bons et réservations de stock PDR
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFormulasModal(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[65vh] overflow-y-auto pr-1">
              {validationFormulas.map((f) => (
                <div
                  key={f.title}
                  className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/90 space-y-1.5"
                >
                  <div className="text-xs font-black text-slate-800">{f.title}</div>
                  <div className="font-mono text-xs text-rose-900 font-bold bg-white p-2 rounded-lg border border-rose-100">
                    {f.formula}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
