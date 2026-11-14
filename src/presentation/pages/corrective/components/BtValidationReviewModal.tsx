import React from 'react';
import {
  ShieldCheck,
  X,
  AlertTriangle,
  CheckCircle,
  Package,
  Trash2,
  Wrench,
} from 'lucide-react';
import { INTERVENTION_NATURE_OPTIONS } from '../../../components/common/ValidationStatusBadge';
import { SortieExterneService } from '../../../../application/services/SortieExterneService';

export interface BtValidationReviewModalProps {
  reviewModalBt: any;
  setReviewModalBt: (bt: any) => void;
  resolveTechNom: (bt: any) => string;
  reviewReconciliation: any;
  reviewNature: string;
  setReviewNature: (val: string) => void;
  reviewActionRealisee: string;
  setReviewActionRealisee: (val: string) => void;
  reviewPieces: Array<{ ref: string; designation: string; quantite: number }>;
  setReviewPieces: React.Dispatch<
    React.SetStateAction<Array<{ ref: string; designation: string; quantite: number }>>
  >;
  stockItems: any[];
  reviewSkipStockDeduction: boolean;
  setReviewSkipStockDeduction: (val: boolean) => void;
  sortiesExterne: any[];
  handleMarkSortieReturned: (id: string, cout?: number) => void;
  showToast?: (message: string, type?: string) => void;
  reviewNote: string;
  setReviewNote: (val: string) => void;
  handleReviewDecision: (
    decision: 'APPROVED' | 'NEEDS_CLARIFICATION' | 'REJECTED'
  ) => void;
}

export default function BtValidationReviewModal({
  reviewModalBt,
  setReviewModalBt,
  resolveTechNom,
  reviewReconciliation,
  reviewNature,
  setReviewNature,
  reviewActionRealisee,
  setReviewActionRealisee,
  reviewPieces,
  setReviewPieces,
  stockItems,
  reviewSkipStockDeduction,
  setReviewSkipStockDeduction,
  sortiesExterne,
  handleMarkSortieReturned,
  showToast,
  reviewNote,
  setReviewNote,
  handleReviewDecision,
}: BtValidationReviewModalProps) {
  if (!reviewModalBt) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="maker-checker-review-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600/10 via-purple-500/5 to-transparent p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">
                Contrôle &amp; Validation de Clôture BT (Maker-Checker)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Bon de Travail :{' '}
                <b className="font-mono text-purple-900">
                  {reviewModalBt.num_bt || reviewModalBt.id}
                </b>{' '}
                • Machine :{' '}
                <b className="font-mono text-slate-900">{reviewModalBt.code_machine}</b>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReviewModalBt(null)}
            className="w-8 h-8 rounded-full border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs text-slate-700">
          {/* Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Soumis par</span>
              <span className="font-bold text-slate-900 block truncate">
                {reviewModalBt.submitted_by_name || resolveTechNom(reviewModalBt)}
              </span>
              <span className="text-[10.5px] text-slate-500 font-mono">
                {reviewModalBt.submitted_by_id || 'Technicien'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">
                Temps Ouvré Proposé
              </span>
              <span className="font-mono font-bold text-emerald-700 text-sm block">
                {reviewModalBt.temps_intervention_propose ||
                  reviewModalBt.temps_intervention_calc ||
                  reviewModalBt.temps_intervention ||
                  '00:00'}
              </span>
              <span className="text-[10.5px] text-slate-400 font-mono">
                Fin: {reviewModalBt.heure_fin_proposee || '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200">
              <span className="text-[10px] font-bold text-purple-700 uppercase block">
                N° Bon Saisi Terrain
              </span>
              <span className="font-mono font-bold text-purple-950 text-sm block">
                {reviewModalBt.num_bon_saisi_par_tech || 'Non renseigné'}
              </span>
              <span className="text-[10.5px] text-purple-600">Déclaration technicien</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">
                Bon Officiel Généré
              </span>
              <span className="font-mono font-bold text-emerald-950 text-sm block">
                BS-BT-{reviewModalBt.num_bt || reviewModalBt.id}
              </span>
              <span className="text-[10.5px] text-emerald-700">À l’approbation</span>
            </div>
          </div>

          {/* V4 Smart Reconciliation Banner */}
          {reviewReconciliation && (
            <div
              data-testid="v4-reconciliation-panel"
              className={`p-3.5 rounded-2xl border space-y-2 ${
                reviewReconciliation.hasCritical
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : reviewReconciliation.hasWarning
                  ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  {reviewReconciliation.hasWarning ? (
                    <AlertTriangle
                      className={`w-4 h-4 shrink-0 ${
                        reviewReconciliation.hasCritical ? 'text-rose-600' : 'text-amber-600'
                      }`}
                    />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  Contrôle Automatique de Concordance (V4)
                </span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-white/80 border border-current/20">
                  {reviewReconciliation.alerts.length === 0
                    ? '0 anomalie détectée'
                    : `${reviewReconciliation.alerts.length} alerte(s)`}
                </span>
              </div>

              {reviewReconciliation.alerts.length > 0 ? (
                <div className="space-y-1.5">
                  {reviewReconciliation.alerts.map((alert: any, idx: number) => (
                    <div
                      key={`${alert.code}-${idx}`}
                      className={`px-3 py-2 rounded-xl border text-[11px] flex items-start justify-between gap-2 ${
                        alert.severity === 'critical'
                          ? 'bg-white border-rose-200 text-rose-900'
                          : 'bg-white border-amber-200 text-amber-900'
                      }`}
                    >
                      <div>
                        <span className="font-black mr-1.5">{alert.title} :</span>
                        <span className="font-medium">{alert.detail}</span>
                      </div>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-black shrink-0 ${
                          alert.severity === 'critical'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {alert.code}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-emerald-800 font-medium">
                  Aucune anomalie de stock, de doublon de bon magasin ou de réservation concurrente détectée.
                </p>
              )}
            </div>
          )}

          {/* Editable Nature d'intervention & Travail Réalisé */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Nature de l&apos;intervention (VAL-4)
              </label>
              <select
                data-testid="bt-review-nature-select"
                value={reviewNature}
                onChange={(e) => setReviewNature(e.target.value)}
                className="w-full py-2.5 px-3 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-purple-400 focus:outline-hidden"
              >
                <option value="">-- Non spécifiée (Autre) --</option>
                {INTERVENTION_NATURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.shortLabel})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Travail Réalisé / Rapport Technique (Col K)
              </label>
              <input
                type="text"
                value={reviewActionRealisee}
                onChange={(e) => setReviewActionRealisee(e.target.value)}
                className="w-full py-2.5 px-3.5 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-purple-400 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Proposed PDR List & Stock Verification */}
          <div className="p-4 rounded-2xl bg-cyan-50/50 border border-cyan-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-cyan-950 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-cyan-700" />
                Pièces de Rechange Proposées ({reviewPieces.length})
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900">
                Déstockage uniquement sur Approbation
              </span>
            </div>

            {reviewPieces.length > 0 ? (
              <div className="space-y-2">
                {reviewPieces.map((piece, idx) => {
                  const stockMatch = (stockItems || []).find(
                    (s: any) =>
                      String(s.ref || s.code_article || '').trim().toUpperCase() ===
                      String(piece.ref || '').trim().toUpperCase()
                  );
                  const dispo = stockMatch
                    ? stockMatch.stockActuel ?? stockMatch.stock_actuel ?? stockMatch.quantite ?? 0
                    : 0;
                  const isShort = Number(piece.quantite || 0) > Number(dispo);

                  return (
                    <div
                      key={`${piece.ref}-${idx}`}
                      className="p-2.5 rounded-xl bg-white border border-cyan-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-cyan-950 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-300">
                          {piece.ref}
                        </span>
                        <span className="font-semibold text-slate-800 truncate">
                          {piece.designation || stockMatch?.designation || piece.ref}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono text-[10.5px] font-bold px-2 py-0.5 rounded border ${
                            isShort
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          Dispo: {dispo}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500">Qté:</span>
                          <input
                            type="number"
                            min={1}
                            value={piece.quantite}
                            onChange={(e) => {
                              const nextQty = Math.max(1, Number(e.target.value) || 1);
                              setReviewPieces((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, quantite: nextQty } : p))
                              );
                            }}
                            className="w-16 py-1 px-2 text-xs font-mono font-bold rounded-lg border border-cyan-300 bg-white text-center"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setReviewPieces((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Retirer cette pièce de la validation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Aucune pièce de rechange déclarée sur cette intervention (clôture sans mouvement stock).
              </p>
            )}

            {reviewPieces.length > 0 && (
              <label className="flex items-start gap-2 pt-2 border-t border-cyan-200/80 text-xs text-cyan-950 cursor-pointer select-none">
                <input
                  type="checkbox"
                  data-testid="bt-review-skip-stock-checkbox"
                  checked={reviewSkipStockDeduction}
                  onChange={(e) => setReviewSkipStockDeduction(e.target.checked)}
                  className="mt-0.5 rounded border-cyan-400 text-cyan-700 focus:ring-cyan-500"
                />
                <span>
                  <strong className="font-black">
                    ✅ Bon de sortie déjà déstocké au magasin
                  </strong>{' '}
                  — Imputer le coût PDR sur la machine sans créer de 2e mouvement de stock.
                </span>
              </label>
            )}
          </div>

          {/* CORRECTIVE-ATELIER-P0: Linked Workshop / External Orders in Review Modal */}
          {(() => {
            const linkedOrders = SortieExterneService.getLinkedOrdersForBt(
              reviewModalBt,
              sortiesExterne
            );
            if (linkedOrders.length === 0) return null;
            return (
              <div
                data-testid="review-workshop-orders-panel"
                className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-indigo-700" />
                    Bon(s) d’Atelier / Externe associé(s) ({linkedOrders.length})
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-900">
                    Coût Atelier inclus à la clôture
                  </span>
                </div>
                <div className="space-y-2">
                  {linkedOrders.map((ord: any) => {
                    const isOpen = SortieExterneService.isWorkshopOrderOpen(ord.etat);
                    return (
                      <div
                        key={ord.id || ord.code}
                        className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                          isOpen
                            ? 'bg-amber-50 border-amber-300 text-amber-950'
                            : 'bg-emerald-50 border-emerald-300 text-emerald-950'
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
                          {isOpen && (
                            <button
                              type="button"
                              data-testid={`review-receive-workshop-${ord.code}`}
                              onClick={() => {
                                handleMarkSortieReturned(ord.id, ord.cout_bobinage);
                                showToast?.(
                                  `Bon ${ord.code} réceptionné (Retourné OK). Vous pouvez approuver la clôture du BT.`,
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
              </div>
            );
          })()}

          {/* Validation / Clarification Note */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Note du Responsable / Motif de Clarification (Visible par le technicien)
            </label>
            <input
              type="text"
              data-testid="review-validation-note-input"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Ex: Vérifier la quantité du roulement 6205 ou le N° de bon magasin..."
              className="w-full py-2.5 px-3.5 text-xs font-medium rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-purple-400 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Footer Decision Actions */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              data-testid="review-clarify-btn"
              onClick={() => handleReviewDecision('NEEDS_CLARIFICATION')}
              className="px-3.5 py-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition cursor-pointer flex-1 sm:flex-initial"
            >
              Demander Clarification
            </button>
            <button
              type="button"
              data-testid="review-reject-btn"
              onClick={() => handleReviewDecision('REJECTED')}
              className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs transition cursor-pointer flex-1 sm:flex-initial"
            >
              Rejeter
            </button>
          </div>

          <button
            type="button"
            data-testid="review-approve-btn"
            onClick={() => handleReviewDecision('APPROVED')}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Approuver &amp; Clôturer (Déduire Stock)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
