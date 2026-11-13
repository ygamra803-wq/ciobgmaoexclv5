import { motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Inbox,
  ShieldCheck,
  ShoppingCart,
} from 'lucide-react';
import { reconcileFieldClaim } from '../../../../core/security/validationReconciliation';
import type { SortieDemandRecord } from './SortieModals';

export interface PendingOrderRecord {
  id?: string | number;
  num_commande?: string;
  code_bon?: string;
  date?: string;
  ref?: string;
  designation?: string;
  quantite?: number;
  unit?: string;
  source_category?: string;
  fournisseur?: string;
}

export interface PendingOrdersSubTabProps {
  pendingOrders: PendingOrderRecord[];
  onFulfillOrder: (order: PendingOrderRecord) => void;
}

export function PendingOrdersSubTab({
  pendingOrders,
  onFulfillOrder,
}: PendingOrdersSubTabProps) {
  return (
    <motion.div
      key="subtab-commandes"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="bg-white p-5 rounded-2xl border border-amber-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out space-y-4"
    >
      <div className="flex items-center justify-between border-b border-amber-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center font-bold">
            <ShoppingCart className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Demandes d&apos;Achat & Commandes en Attente
            </h3>
            <p className="text-xs text-slate-500">
              Commandes de pièces ou composants en attente de livraison fournisseur. Cliquez sur &quot;Réceptionner&quot; pour les entrer en stock.
            </p>
          </div>
        </div>
      </div>

      {pendingOrders.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
          <p className="text-xs font-medium">Aucune commande en attente de livraison.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pendingOrders.map((ord, idx) => (
            <div
              key={`pending-ord-${ord.id ?? ''}-${ord.code_bon ?? ''}-${idx}`}
              className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2.5 hover:shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] hover:shadow-[0_16px_40px_-8px_rgba(0,0,0,0.16),0_6px_16px_-3px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 ease-out transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-amber-950 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  {ord.num_commande || ord.code_bon}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">{ord.date}</span>
              </div>

              <div>
                <div className="font-bold text-xs text-slate-800">{ord.ref}</div>
                <div className="text-xs text-slate-500">{ord.designation || 'Article / Pièce'}</div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-100">
                <div className="text-slate-600 font-medium">
                  Qté : <b className="font-mono text-amber-900">{ord.quantite} {ord.unit || 'pcs'}</b>
                </div>
                <button
                  type="button"
                  onClick={() => onFulfillOrder(ord)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 transition cursor-pointer shadow-2xs"
                >
                  <Inbox className="w-3 h-3" />
                  <span>📥 Réceptionner</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export interface ValidationTerrainQueueSubTabProps {
  storeSortieDemands: SortieDemandRecord[];
  stockItems: unknown[];
  mouvements: unknown[];
  correctiveInterventions: unknown[];
  preventiveExecutions: unknown[];
  onOpenReviewModal: (demand: SortieDemandRecord) => void;
}

export function ValidationTerrainQueueSubTab({
  storeSortieDemands,
  stockItems,
  mouvements,
  correctiveInterventions,
  preventiveExecutions,
  onOpenReviewModal,
}: ValidationTerrainQueueSubTabProps) {
  return (
    <motion.div
      key="subtab-validation-terrain"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="bg-white p-5 rounded-2xl border border-purple-200 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] space-y-4 mt-4"
    >
      <div className="flex items-center justify-between border-b border-purple-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">
              File d&apos;Attente des Demandes de Sortie Terrain (V3 + V4 Réconciliation Bon Tech × Bon Magasin)
            </h3>
            <p className="text-xs text-slate-500">
              Chaque demande ci-dessous a été saisie par un technicien sans déduction de stock. Approuvez ou fusionnez avec un bon magasin existant.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
          {storeSortieDemands.length} demande(s) totale(s)
        </span>
      </div>

      {storeSortieDemands.length === 0 ? (
        <div className="py-12 text-center text-slate-400 space-y-2">
          <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
          <p className="text-xs font-medium">Aucune demande de sortie terrain enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {storeSortieDemands.map((dem) => {
            const isPending = dem.validation_status === 'PENDING_VALIDATION';
            const isClarif = dem.validation_status === 'NEEDS_CLARIFICATION';
            const isApproved = dem.validation_status === 'APPROVED';
            const recon = reconcileFieldClaim({
              claimType: 'SORTIE',
              claimId: String(dem.id),
              numBonSaisi: dem.code_bon_tech,
              machineCode: dem.id_machine_registered,
              proposedSpares: dem.items || [],
              stockItems,
              mouvements,
              correctiveInterventions,
              preventiveExecutions,
              sortieDemands: storeSortieDemands,
            });

            return (
              <div
                key={dem.id}
                className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                  isPending
                    ? 'bg-purple-50/40 border-purple-200'
                    : isClarif
                    ? 'bg-rose-50/40 border-rose-200'
                    : isApproved
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-black text-purple-950 bg-white px-2 py-0.5 rounded border border-purple-200">
                      Bon Tech: {dem.code_bon_tech}
                    </span>
                    {dem.code_bon_magasin && (
                      <span className="font-mono font-bold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        Bon Magasin: {dem.code_bon_magasin}
                      </span>
                    )}
                    <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {dem.id_machine_registered || dem.id_zone || 'ATELIER'}
                    </span>
                    <span className="font-semibold text-slate-700">
                      Technicien: <b>{dem.technicien}</b>
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {dem.date} • {dem.heure}
                    </span>
                    {isPending && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-purple-100 text-purple-900 border border-purple-300">
                        À VALIDER
                      </span>
                    )}
                    {isClarif && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-100 text-rose-900 border border-rose-300">
                        ÉCART / À CLARIFIER
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {dem.discrepancy_status === 'BON_MISMATCH_MERGED'
                          ? 'APPROUVÉ & RÉCONCILIÉ'
                          : 'APPROUVÉ & DÉDUIT'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(dem.items || []).map((it, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono font-bold text-[11px] text-slate-800"
                      >
                        {it.ref} — {it.designation} (x{it.quantite} {it.unit || 'pcs'})
                      </span>
                    ))}
                  </div>

                  {!isApproved && recon.alerts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {recon.alerts.map((al, i) => (
                        <span
                          key={i}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-bold flex items-center gap-1 ${
                            al.severity === 'critical'
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {al.title}
                        </span>
                      ))}
                    </div>
                  )}

                  {dem.validation_note && (
                    <div className="text-[11px] font-semibold text-rose-800 pt-0.5">
                      Note Magasin / Resp. : « {dem.validation_note} »
                    </div>
                  )}
                </div>

                {(isPending || isClarif) && (
                  <button
                    type="button"
                    onClick={() => onOpenReviewModal(dem)}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shrink-0 cursor-pointer transition shadow-2xs"
                  >
                    Contrôler & Réconcilier
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

export interface TechSortieDemandsPanelProps {
  mySortieDemands: SortieDemandRecord[];
  onReloadClarificationDemand: (demand: SortieDemandRecord) => void;
}

export function TechSortieDemandsPanel({
  mySortieDemands,
  onReloadClarificationDemand,
}: TechSortieDemandsPanelProps) {
  if (mySortieDemands.length === 0) return null;

  return (
    <div
      data-testid="tech-sortie-demands-list"
      className="bg-white rounded-2xl border border-indigo-200/90 shadow-xs p-4 space-y-3"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Mes Demandes de Sortie Terrain ({mySortieDemands.length})
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          Aucune déduction stock avant approbation magasin
        </span>
      </div>
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {mySortieDemands.slice(0, 8).map((dem) => {
          const isClarif = dem.validation_status === 'NEEDS_CLARIFICATION';
          const isPending = dem.validation_status === 'PENDING_VALIDATION';
          const isApproved = dem.validation_status === 'APPROVED';
          return (
            <div
              key={dem.id}
              className={`p-3 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
                isClarif
                  ? 'bg-rose-50/60 border-rose-300'
                  : isPending
                  ? 'bg-purple-50/40 border-purple-200'
                  : isApproved
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono font-black text-slate-900">
                    {dem.code_bon_tech || dem.id}
                  </span>
                  {dem.code_bon_magasin && dem.code_bon_magasin !== dem.code_bon_tech && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900 font-mono text-[10px] font-bold">
                      → Bon Magasin: {dem.code_bon_magasin}
                    </span>
                  )}
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                      isClarif
                        ? 'bg-rose-100 text-rose-900 border border-rose-300 animate-pulse'
                        : isPending
                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                        : isApproved
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {isClarif
                      ? 'À CLARIFIER (DISCREPANCY)'
                      : isPending
                      ? 'EN ATTENTE VALIDATION'
                      : isApproved
                      ? dem.discrepancy_status === 'BON_MISMATCH_MERGED'
                        ? 'VALIDÉ & FUSIONNÉ'
                        : 'APPROUVÉ & DÉDUIT'
                      : 'REJETÉ'}
                  </span>
                  {dem.id_machine_registered && (
                    <span className="text-[10.5px] font-mono text-slate-600">
                      • {dem.id_machine_registered}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-600 truncate">
                  {(dem.items || [])
                    .map((it) => `${it.ref} (×${it.quantite})`)
                    .join(', ')}
                </div>
                {dem.validation_note && (
                  <div className="text-[11px] font-bold text-rose-800">
                    Note Magasin/Admin : « {dem.validation_note} »
                  </div>
                )}
              </div>

              {isClarif && (
                <button
                  type="button"
                  onClick={() => onReloadClarificationDemand(dem)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  Corriger & Resoumettre
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
