import { motion } from 'motion/react';
import { ShoppingCart, CheckCircle2, Inbox } from 'lucide-react';

/**
 * Commandes & Demandes d'Achat pending backlog view.
 */
export default function SortieRapideCommandesTab({
  pendingOrders = [],
  handleFulfillOrder,
}) {
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
              Demandes d'Achat & Commandes en Attente
            </h3>
            <p className="text-xs text-slate-500">
              Commandes de pièces ou composants en attente de livraison fournisseur. Cliquez sur "Réceptionner" pour les entrer en stock.
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
                <div className="text-xs text-slate-500">
                  {ord.designation || 'Article / Pièce'}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-100">
                <div className="text-slate-600 font-medium">
                  Qté :{' '}
                  <b className="font-mono text-amber-900">
                    {ord.quantite} {ord.unit || 'pcs'}
                  </b>
                </div>
                <button
                  type="button"
                  onClick={() => handleFulfillOrder(ord)}
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
