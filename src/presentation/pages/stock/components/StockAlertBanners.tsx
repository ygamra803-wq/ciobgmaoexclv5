import type { Dispatch, SetStateAction } from 'react';
import { AlertTriangle, ChevronDown, Lock, ShoppingCart } from 'lucide-react';
import type { computeStockReorderAlerts } from '../../../../core/security/validationReconciliation';

type ReorderAlertsData = ReturnType<typeof computeStockReorderAlerts>;

interface StockAlertBannersProps {
  reservedSummary: { articlesCount: number; totalUnits: number; riskCount: number };
  reorderAlerts: ReorderAlertsData;
  activeKpiFilter: string;
  setActiveKpiFilter: Dispatch<SetStateAction<string>>;
  stockAlertOnly: boolean;
  setStockAlertOnly: (val: boolean) => void;
  canEditStock: boolean;
  showReorderPanel: boolean;
  setShowReorderPanel: Dispatch<SetStateAction<boolean>>;
  onOpenReplenishment: () => void;
}

export function StockAlertBanners({
  reservedSummary,
  reorderAlerts,
  activeKpiFilter,
  setActiveKpiFilter,
  stockAlertOnly,
  setStockAlertOnly,
  canEditStock,
  showReorderPanel,
  setShowReorderPanel,
  onOpenReplenishment,
}: StockAlertBannersProps) {
  return (
    <>
      {/* Virtual Stock Reservation Banner (Maker-Checker) */}
      {reservedSummary.articlesCount > 0 && (
        <div className="bg-purple-50/90 border border-purple-300 rounded-2xl p-3.5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-2">
                <span>Stock Physique vs Stock Disponible (Réservation Virtuelle Maker-Checker)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-200 text-purple-900">
                  {reservedSummary.totalUnits} u. réservée(s)
                </span>
              </div>
              <p className="text-[11px] text-purple-800 mt-0.5">
                {reservedSummary.articlesCount} référence(s) ont des sorties déclarées par les
                techniciens en attente de validation responsable.
                {reservedSummary.riskCount > 0 && (
                  <span className="font-bold text-rose-700 ml-1">
                    Attention : {reservedSummary.riskCount} article(s) passent sous le seuil ou en
                    rupture après validation !
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveKpiFilter(activeKpiFilter === 'RESERVED' ? 'ALL' : 'RESERVED');
              setStockAlertOnly(false);
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
              activeKpiFilter === 'RESERVED'
                ? 'bg-slate-900 text-white'
                : 'bg-purple-700 hover:bg-purple-800 text-white shadow-2xs'
            }`}
          >
            {activeKpiFilter === 'RESERVED'
              ? 'Afficher tout le stock'
              : `Filtrer les réservations (${reservedSummary.articlesCount})`}
          </button>
        </div>
      )}

      {/* C3 — Lightweight Stock Reorder Alert Card */}
      {reorderAlerts.totalAlertCount > 0 && (
        <div
          className="bg-amber-50/90 border border-amber-300 rounded-2xl p-4 shadow-2xs space-y-3"
          data-testid="c3-stock-reorder-alert-card"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                    Alerte Réapprovisionnement (C3 — Articles sous seuil / rupture)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-100 text-rose-900 border border-rose-200">
                    {reorderAlerts.ruptureCount} rupture(s)
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-200/80 text-amber-950 border border-amber-300">
                    {reorderAlerts.sousSeuilCount} sous seuil
                  </span>
                  {reorderAlerts.reservationRiskCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-900 border border-purple-200">
                      {reorderAlerts.reservationRiskCount} sous seuil après réservation
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-amber-900 mt-0.5">
                  Lecture seule basée sur le solde affiché (Stock Actuel ≤ Seuil Min) et les
                  réservations en attente. Aucun bon d&apos;achat automatique n&apos;est généré.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setStockAlertOnly(!stockAlertOnly);
                  setActiveKpiFilter('ALL');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  stockAlertOnly
                    ? 'bg-slate-900 text-white'
                    : 'bg-white hover:bg-amber-100 text-amber-950 border border-amber-300'
                }`}
              >
                {stockAlertOnly ? 'Tout afficher' : 'Filtrer dans la grille'}
              </button>
              {canEditStock && (
                <button
                  type="button"
                  onClick={onOpenReplenishment}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Générer Commande</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowReorderPanel((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <span>
                  {showReorderPanel
                    ? 'Masquer la liste'
                    : `Voir la liste (${reorderAlerts.totalAlertCount})`}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${
                    showReorderPanel ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {showReorderPanel && (
            <div className="bg-white rounded-xl border border-amber-200 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase text-slate-600">
                    <th className="py-2 px-3">Réf</th>
                    <th className="py-2 px-3">Désignation</th>
                    <th className="py-2 px-3">Emplacement</th>
                    <th className="py-2 px-3 text-right">Stock Actuel</th>
                    <th className="py-2 px-3 text-right">Réservé (Attente)</th>
                    <th className="py-2 px-3 text-right">Net Dispo</th>
                    <th className="py-2 px-3 text-right">Seuil Min</th>
                    <th className="py-2 px-3 text-center">Statut Alerte</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reorderAlerts.items.slice(0, 15).map((item) => (
                    <tr key={item.ref} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{item.ref}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{item.designation}</td>
                      <td className="py-2 px-3 text-slate-600">{item.emplacement}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {item.stockActuel} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-purple-800">
                        {item.reservedQty > 0 ? `${item.reservedQty} ${item.unit}` : '—'}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-mono font-bold ${
                          item.netAvailable <= 0 ? 'text-rose-700' : 'text-amber-800'
                        }`}
                      >
                        {item.netAvailable} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-700">
                        {item.seuil} {item.unit}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            item.status === 'RUPTURE'
                              ? 'bg-rose-100 text-rose-900 border-rose-200'
                              : item.status === 'SOUS_SEUIL'
                                ? 'bg-amber-100 text-amber-900 border-amber-200'
                                : 'bg-purple-100 text-purple-900 border-purple-200'
                          }`}
                        >
                          {item.statusLabelFr}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );
}
