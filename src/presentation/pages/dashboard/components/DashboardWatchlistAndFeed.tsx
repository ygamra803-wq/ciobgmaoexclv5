import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Plus,
  ShoppingCart,
  XCircle,
} from 'lucide-react';
import Action3DButton from '../../../components/common/Action3DButton';
import SortieEntreeIcon from '../../../components/common/SortieEntreeIcon';
import TableSkeletonRows from '../../../components/common/TableSkeletonRows';

type AnyRecord = Record<string, any>;

export interface DashboardWatchlistAndFeedProps {
  t: (key: string) => string;
  alertAndRuptureItems: AnyRecord[];
  isWatchlistReady: boolean;
  mouvements: AnyRecord[];
  stockItems: AnyRecord[];
  isReadOnlyUser: boolean;
  canCreateMovement: boolean;
  canAccessStockTab: boolean;
  canAccessSortieTab: boolean;
  onNavigateToStock?: () => void;
  onNavigateToSortie?: () => void;
  onOpenOrderForArticle: (article: AnyRecord) => void;
  onQuickSortie?: (article: AnyRecord) => void;
}

export function DashboardWatchlistAndFeed({
  t,
  alertAndRuptureItems,
  isWatchlistReady,
  mouvements,
  stockItems,
  isReadOnlyUser,
  canCreateMovement,
  canAccessStockTab,
  canAccessSortieTab,
  onNavigateToStock,
  onNavigateToSortie,
  onOpenOrderForArticle,
  onQuickSortie,
}: DashboardWatchlistAndFeedProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
      {/* Watchlist Ruptures & Alertes */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200/80 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  {t('dashboard.watchlist.title')} ({alertAndRuptureItems.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  {t('dashboard.watchlist.subtitle')}
                </p>
              </div>
            </div>

            {canAccessStockTab && onNavigateToStock && (
              <button
                onClick={onNavigateToStock}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{t('dashboard.watchlist.viewAllStock')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-200/80 rounded-xl shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3.5">{t('dashboard.watchlist.colRef')}</th>
                  <th className="py-2.5 px-3.5">{t('dashboard.watchlist.colDesignation')}</th>
                  <th className="py-2.5 px-2 text-right">{t('dashboard.watchlist.colCurrentStock')}</th>
                  <th className="py-2.5 px-2 text-right">{t('dashboard.watchlist.colThreshold')}</th>
                  <th className="py-2.5 px-3 text-center">{t('dashboard.watchlist.colState')}</th>
                  <th className="py-2.5 px-3">{t('dashboard.watchlist.colLocation')}</th>
                  <th className="py-2.5 px-3 text-center">{t('dashboard.watchlist.colQuickActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!isWatchlistReady ? (
                  <TableSkeletonRows cols={7} rows={6} />
                ) : alertAndRuptureItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        <span className="font-semibold text-slate-700">{t('dashboard.watchlist.emptyTitle')}</span>
                        <span className="text-xs text-slate-500">{t('dashboard.watchlist.emptySubtitle')}</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  alertAndRuptureItems.slice(0, 8).map((item, idx) => (
                    <tr key={`alert-item-${item.id ?? ''}-${item.ref ?? ''}-${idx}`} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">{item.ref}</td>
                      <td className="py-2.5 px-3.5 font-medium text-slate-800">{item.designation}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-black text-rose-600">
                        {item.stockActuel}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-slate-500">{item.seuil}</td>
                      <td className="py-2.5 px-3 text-center">
                        {item.alerte === 'RUPTURE' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
                            <XCircle className="w-3 h-3" />
                            <span>{t('dashboard.watchlist.ruptureBadge')}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{t('dashboard.watchlist.alertBadge')}</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{item.emplacement}</td>
                      <td className="py-2.5 px-3 text-center">
                        {canCreateMovement || (!isReadOnlyUser && canAccessSortieTab && onQuickSortie) ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {canCreateMovement && (
                              <Action3DButton
                                icon={ShoppingCart}
                                showAddBadge={true}
                                variant="circle"
                                color="amber"
                                title="Commander réapprovisionnement"
                                onClick={() => onOpenOrderForArticle(item)}
                              />
                            )}
                            {!isReadOnlyUser && canAccessSortieTab && onQuickSortie && (
                              <button
                                onClick={() => onQuickSortie(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-black text-white text-[11px] font-bold shadow-2xs transition cursor-pointer active:scale-95"
                                title="Faire une sortie"
                              >
                                {t('dashboard.watchlist.issueBtn')}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">{t('dashboard.watchlist.readOnlyLabel')}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Live Flux Feed */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
                <SortieEntreeIcon className="w-4 h-4 text-slate-800" strokeWidth={2.25} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">{t('dashboard.watchlist.recentMovementsTitle')}</h3>
                <p className="text-[11px] text-slate-500">{t('dashboard.watchlist.recentMovementsSubtitle')}</p>
              </div>
            </div>
            {!isReadOnlyUser && canAccessSortieTab && onNavigateToSortie && (
              <button
                onClick={onNavigateToSortie}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('dashboard.watchlist.issueBtn')}</span>
              </button>
            )}
          </div>

          {mouvements.length > 0 ? (
            <div className="space-y-2">
              {mouvements.slice(0, 6).map((m, idx) => {
                const art = stockItems.find(
                  (s) => String(s.ref).toLowerCase() === String(m.ref).toLowerCase()
                );
                const isSortie = String(m.type || '').toLowerCase().includes('sort');

                return (
                  <div
                    key={`feed-mvt-${m.id ?? ''}-${m.code_bon ?? ''}-${idx}`}
                    className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 flex items-center justify-between text-xs hover:border-slate-300 transition"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.2 rounded-full font-mono ${
                            isSortie
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{m.ref}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 truncate max-w-[180px] font-medium">
                        {art ? art.designation : m.designation || 'Article'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {m.code_bon || 'Bon'} • {m.date} • {m.technicien || 'Tech'}
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-sm shrink-0">
                      {isSortie ? (
                        <span className="text-rose-600">-{m.quantite}</span>
                      ) : (
                        <span className="text-emerald-600">+{m.quantite}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-400 text-center py-8 bg-slate-50/60 rounded-xl border border-slate-100">
              {t('dashboard.watchlist.noRecentMovements')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
