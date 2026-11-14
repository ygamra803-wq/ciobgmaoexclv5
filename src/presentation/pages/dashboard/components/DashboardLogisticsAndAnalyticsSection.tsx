import Action3DButton from '../../../components/common/Action3DButton';
import SortieEntreeIcon from '../../../components/common/SortieEntreeIcon';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Factory,
  Inbox,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  TrendingDown,
  Truck,
  Wrench,
  Zap,
} from 'lucide-react';

export interface DashboardLogisticsAndAnalyticsSectionProps {
  t: (key: string) => string;
  isOperatorRole: boolean;
  isReadOnlyUser: boolean;
  canCreateMovement: boolean;
  canEditMovement: boolean;
  canDeleteMovement: boolean;
  canAccessSortieTab: boolean;
  canAccessStockTab: boolean;
  canAccessMachinesTab: boolean;
  allOrders: any[];
  pendingOrders: any[];
  completedOrders: any[];
  displayedOrders: any[];
  orderFilterTab: string;
  setOrderFilterTab: (tab: string) => void;
  stockItems: any[];
  handleOpenNewOrder: () => void;
  handleValidateReception: (cmd: any) => void;
  onDeleteMouvement?: (id: any) => void;
  pendingExternalRepairs: any[];
  overdueRepairs: any[];
  todayStr: string;
  onNavigateToSortie?: () => void;
  onNavigateToStock?: () => void;
  onNavigateToMachines?: () => void;
  mouvements: any[];
  actionStats: {
    counts: Record<string, number>;
    totalActions: number;
    totalSortieQty: number;
    totalEntreeQty: number;
  };
  topConsumedArticles: Array<{
    ref: string;
    designation: string;
    qty: number;
    stockActuel: number;
    alerte: string;
  }>;
  machineHealth: {
    enService: number;
    enMaintenance: number;
    arret: number;
    total: number;
    topMachines: Array<{
      id: string;
      designation: string;
      zone: string;
      count: number;
    }>;
  };
}

export function DashboardLogisticsAndAnalyticsSection({
  t,
  isOperatorRole,
  isReadOnlyUser,
  canCreateMovement,
  canEditMovement,
  canDeleteMovement,
  canAccessSortieTab,
  canAccessStockTab,
  canAccessMachinesTab,
  allOrders,
  pendingOrders,
  completedOrders,
  displayedOrders,
  orderFilterTab,
  setOrderFilterTab,
  stockItems,
  handleOpenNewOrder,
  handleValidateReception,
  onDeleteMouvement,
  pendingExternalRepairs,
  overdueRepairs,
  todayStr,
  onNavigateToSortie,
  onNavigateToStock,
  onNavigateToMachines,
  mouvements,
  actionStats,
  topConsumedArticles,
  machineHealth,
}: DashboardLogisticsAndAnalyticsSectionProps) {
  return (
    <>
      {/* 5. Side-by-Side Logistics Hub: Commandes & Réappro (Left) + Réparations Externes (Right) — Hidden for OPERATEUR (DB-11) */}
      {!isOperatorRole && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {/* Left Column: Suivi des Commandes & Réapprovisionnements */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-100 pb-3.5 space-y-3">
                <div className="flex items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
                          {t('dashboard.logistics.ordersTitle')}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-amber-100/90 text-amber-950 border border-amber-200/80">
                          {pendingOrders.length} {t('dashboard.logistics.pendingBadge')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {canEditMovement ? (
                          <>
                            Cliquez sur <b className="text-emerald-700">&quot;{t('dashboard.logistics.validateReceiptBtn')}&quot;</b>
                          </>
                        ) : (
                          t('dashboard.logistics.ordersReadOnlyHint')
                        )}
                      </p>
                    </div>
                  </div>

                  {canCreateMovement && (
                    <Action3DButton
                      icon={ShoppingCart}
                      showAddBadge={true}
                      variant="circle"
                      color="amber"
                      title={t('dashboard.logistics.createPurchaseOrderBtn')}
                      onClick={handleOpenNewOrder}
                    />
                  )}
                </div>

                {/* Filter Tabs Bar */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="inline-flex p-0.5 bg-slate-100/90 rounded-xl border border-slate-200/80 text-[11px] font-medium">
                    <button
                      onClick={() => setOrderFilterTab('ALL')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        orderFilterTab === 'ALL'
                          ? 'bg-white text-slate-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t('dashboard.logistics.tabAll')} ({allOrders.length})
                    </button>
                    <button
                      onClick={() => setOrderFilterTab('PENDING')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        orderFilterTab === 'PENDING'
                          ? 'bg-white text-amber-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t('dashboard.logistics.tabPending')} ({pendingOrders.length})
                    </button>
                    <button
                      onClick={() => setOrderFilterTab('RECEIVED')}
                      className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                        orderFilterTab === 'RECEIVED'
                          ? 'bg-white text-emerald-900 font-bold shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t('dashboard.logistics.tabReceived')} ({completedOrders.length})
                    </button>
                  </div>

                  <div className="text-[10.5px] text-slate-400 font-mono">
                    {displayedOrders.length} {t('dashboard.logistics.ordersCountUnit')}
                  </div>
                </div>
              </div>

              {/* Order Cards Grid */}
              {displayedOrders.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {displayedOrders.map((cmd, idx) => {
                    const art = stockItems.find(
                      (s) => String(s.ref).toLowerCase() === String(cmd.ref).toLowerCase()
                    );
                    const isReceived =
                      Array.isArray(cmd.tags) && cmd.tags.includes('#RECEPTION_VALIDE');

                    return (
                      <div
                        key={`dash-cmd-${cmd.id ?? ''}-${cmd.ref ?? ''}-${idx}`}
                        className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between space-y-2.5 ${
                          isReceived
                            ? 'bg-emerald-50/30 border-emerald-200/90'
                            : 'bg-slate-50/60 border-slate-200/90 hover:border-amber-300'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="font-mono font-extrabold text-[11px] text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {cmd.ref}
                              </span>
                              <span className="text-[10px] font-bold text-amber-950 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-200 font-mono">
                                {cmd.code_bon || 'CMD'}
                              </span>
                            </div>

                            {isReceived ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{t('dashboard.logistics.receivedBadge')}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-950 border border-amber-200/80">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>{t('dashboard.logistics.waitingBadge')}</span>
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="font-bold text-xs text-slate-900 line-clamp-1">
                              {art ? art.designation : cmd.designation || 'Article commandé'}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center justify-between">
                              <span>
                                Qté : <b className="text-slate-900 font-black">{cmd.quantite} pcs</b>
                              </span>
                              <span>{cmd.date}</span>
                            </div>
                          </div>

                          {(cmd.technicien || cmd.fournisseur || cmd.id_zone) && (
                            <div className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80 font-mono space-y-0.5">
                              {cmd.fournisseur && (
                                <div className="flex items-center justify-between truncate">
                                  <span className="text-slate-400">Fourn.:</span>
                                  <b className="text-slate-800 truncate ml-1">{cmd.fournisseur}</b>
                                </div>
                              )}
                              {cmd.technicien && (
                                <div className="flex items-center justify-between truncate">
                                  <span className="text-slate-400">Dem.:</span>
                                  <b className="text-slate-800 truncate ml-1">{cmd.technicien}</b>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5">
                          {!isReceived ? (
                            canEditMovement ? (
                              <button
                                onClick={() => handleValidateReception(cmd)}
                                className="flex-1 py-1.5 btn-primary-accent font-bold text-[11px] rounded-lg shadow-2xs transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{t('dashboard.logistics.validateReceiptBtn')}</span>
                              </button>
                            ) : (
                              <div className="flex-1 py-1.5 text-center text-amber-900 font-bold text-[11px] bg-amber-50 border border-amber-200/80 rounded-lg">
                                {t('dashboard.logistics.awaitingReceipt')}
                              </div>
                            )
                          ) : (
                            <div className="flex-1 py-1.5 text-center text-emerald-900 font-bold text-[11px] bg-emerald-100/70 border border-emerald-200/80 rounded-lg">
                              {t('dashboard.logistics.entryRecorded')}
                            </div>
                          )}

                          {canDeleteMovement && onDeleteMouvement && (
                            <button
                              onClick={() => onDeleteMouvement(cmd.id)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition cursor-pointer"
                              title="Supprimer la commande"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-6 text-center space-y-2 min-h-[190px] flex flex-col items-center justify-center">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-800">{t('dashboard.logistics.noOrdersTitle')}</h4>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {t('dashboard.logistics.noOrdersSubtitle')}
                  </p>
                  {canCreateMovement && (
                    <button
                      onClick={handleOpenNewOrder}
                      className="mt-1 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-2xs transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t('dashboard.logistics.createPurchaseOrderBtn')}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Matériels en Réparation Externe (Bons de Sortie) */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-extrabold text-sm text-slate-900 tracking-tight">
                        {t('dashboard.logistics.externalRepairsTitle')}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-purple-100/90 text-purple-950 border border-purple-200/80">
                        {pendingExternalRepairs.length} {t('dashboard.tech.inProgress')}
                      </span>
                      {overdueRepairs.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-extrabold bg-rose-100 text-rose-900 border border-rose-300 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>{overdueRepairs.length} {t('dashboard.tech.overdue')}</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {t('dashboard.logistics.externalRepairsSubtitle')}
                    </p>
                  </div>
                </div>

                {!isReadOnlyUser && canAccessSortieTab && onNavigateToSortie && (
                  <Action3DButton
                    icon={Truck}
                    showAddBadge={true}
                    variant="circle"
                    color="purple"
                    title="Nouveau Bon de Sortie"
                    onClick={onNavigateToSortie}
                  />
                )}
              </div>

              {/* List of External Repairs */}
              {pendingExternalRepairs.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                  {pendingExternalRepairs.map((rep, idx) => {
                    const isLate = rep.date_retour_prevue && rep.date_retour_prevue < todayStr;
                    return (
                      <div
                        key={`dash-rep-${rep.id ?? ''}-${idx}`}
                        className={`p-3.5 rounded-xl border transition-all relative flex flex-col justify-between space-y-2.5 ${
                          isLate
                            ? 'bg-rose-50/40 border-rose-300/90'
                            : 'bg-slate-50/60 border-slate-200/90 hover:border-purple-300'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-extrabold text-[11px] text-purple-950 bg-purple-100/90 px-2 py-0.5 rounded border border-purple-200">
                                {rep.code_bon || 'BS-EXT'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded-full border border-slate-200 font-mono">
                                {rep.ref}
                              </span>
                            </div>
                            {isLate ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-300">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>{t('dashboard.logistics.overdueBadge')}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200/80">
                                <Clock className="w-3 h-3 text-purple-600" />
                                <span>{t('dashboard.logistics.externalBadge')}</span>
                              </span>
                            )}
                          </div>

                          <div>
                            <div className="font-bold text-xs text-slate-900 line-clamp-1">
                              {rep.designation || 'Pièce en réparation'}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center justify-between">
                              <span>Qté : <b className="text-slate-900 font-black">{rep.quantite} pcs</b></span>
                              <span className={isLate ? 'text-rose-700 font-bold font-mono' : 'text-purple-950 font-semibold'}>
                                {t('dashboard.logistics.returnLabel')} : {rep.date_retour_prevue || t('dashboard.logistics.notSet')}
                              </span>
                            </div>
                          </div>

                          {(rep.prestataire_externe || rep.id_machine_registered) && (
                            <div className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/80 font-mono space-y-0.5">
                              {rep.prestataire_externe && (
                                <div className="flex items-center justify-between truncate">
                                  <span className="text-slate-400">Prest.:</span>
                                  <b className="text-purple-950 truncate ml-1">{rep.prestataire_externe}</b>
                                </div>
                              )}
                              {rep.id_machine_registered && (
                                <div className="flex items-center justify-between truncate">
                                  <span className="text-slate-400">Machine:</span>
                                  <b className="text-slate-800 truncate ml-1">{rep.id_machine_registered}</b>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {!isReadOnlyUser && canAccessSortieTab && onNavigateToSortie && (
                          <div className="pt-2 border-t border-slate-200/60">
                            <button
                              onClick={onNavigateToSortie}
                              className="w-full py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-lg shadow-2xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Inbox className="w-3.5 h-3.5" />
                              <span>{t('dashboard.logistics.receiveReturnBtn')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-6 text-center space-y-2 min-h-[190px] flex flex-col items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500" />
                  <div className="text-xs font-bold text-slate-800">{t('dashboard.logistics.noExternalRepairsTitle')}</div>
                  <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                    {t('dashboard.logistics.noExternalRepairsSubtitle')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. GMAO Flux Intelligence & Action Distribution (3-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Actions & Interventions Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Répartition des Interventions
                </h3>
                <p className="text-[11px] text-slate-500">Par type d&apos;action GMAO</p>
              </div>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/60">
              {mouvements.length} mvts
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {/* Corrective */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-rose-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  Corrective (Dépannage)
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.CORRECTIVE} (
                  {Math.round((actionStats.counts.CORRECTIVE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.CORRECTIVE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Preventive */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-blue-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Préventive (Systématique)
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.PREVENTIVE} (
                  {Math.round((actionStats.counts.PREVENTIVE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.PREVENTIVE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Usage Direct */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-purple-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Usage Direct / Consommables
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.USAGE} (
                  {Math.round((actionStats.counts.USAGE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.USAGE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Ameliorative */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-amber-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Améliorative / Travaux Neufs
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.AMELIORATIVE} (
                  {Math.round((actionStats.counts.AMELIORATIVE / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.AMELIORATIVE / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Reapprovisionnements & Entrees */}
            <div className="space-y-1">
              <div className="flex items-center justify-between font-medium">
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Réapprovisionnement Magasin
                </span>
                <span className="font-mono font-bold text-slate-800">
                  {actionStats.counts.REAPPRO} (
                  {Math.round((actionStats.counts.REAPPRO / actionStats.totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round(
                      (actionStats.counts.REAPPRO / actionStats.totalActions) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Top 5 Most Consumed Articles */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0">
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Top 5 Pièces Consommées
                </h3>
                <p className="text-[11px] text-slate-500">Volume total de sorties</p>
              </div>
            </div>
            {canAccessStockTab && onNavigateToStock && (
              <button
                onClick={onNavigateToStock}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Stock</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {topConsumedArticles.length > 0 ? (
              topConsumedArticles.map((art, idx) => {
                const rankStyles = [
                  'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold shadow-2xs',
                  'bg-slate-200 text-slate-800 border border-slate-300 font-bold',
                  'bg-orange-100 text-orange-900 border border-orange-200 font-bold',
                  'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
                  'bg-slate-100 text-slate-600 border border-slate-200 font-medium',
                ];

                return (
                  <div
                    key={`top-art-${art.ref ?? ''}-${idx}`}
                    className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:border-slate-300 flex items-center justify-between text-xs transition-colors"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-mono ${rankStyles[idx] || rankStyles[4]}`}>
                          {idx + 1}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{art.ref}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                        {art.designation}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-black text-rose-600 text-sm">
                        -{art.qty} pcs
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Reste : {art.stockActuel}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-slate-400 text-center py-6">
                Aucune sortie enregistrée pour le moment.
              </div>
            )}
          </div>
        </div>

        {/* Top Demanding Machines */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center shrink-0">
                <Factory className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900 tracking-tight">
                  Machines les Plus Sollicitées
                </h3>
                <p className="text-[11px] text-slate-500">Nombre d&apos;interventions / dépannages</p>
              </div>
            </div>
            {canAccessMachinesTab && onNavigateToMachines && (
              <button
                onClick={onNavigateToMachines}
                className="text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Parc</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {machineHealth.topMachines.length > 0 ? (
              machineHealth.topMachines.map((mch, idx) => (
                <div
                  key={`top-mch-${mch.id ?? ''}-${idx}`}
                  className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:border-slate-300 flex items-center justify-between text-xs transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] shadow-2xs">
                        {mch.id}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 truncate max-w-[140px]">
                        {mch.designation}
                      </span>
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-mono">
                      Zone : {mch.zone}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-mono font-bold text-xs border border-purple-200/80 shadow-2xs">
                      {mch.count} interventions
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-400 text-center py-6">
                Aucune machine associée aux sorties.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export function DashboardTechQuickAccessHub({
  canAccessPreventiveTab,
  onNavigateToPreventive,
  canAccessCorrectiveTab,
  onNavigateToCorrective,
  canAccessStockTab,
  onNavigateToStock,
  canAccessSortieTab,
  onNavigateToSortie,
  canAccessMachinesTab,
  onNavigateToMachines,
  canAccessGuideTab,
  onNavigateToGuide,
}: {
  canAccessPreventiveTab: boolean;
  onNavigateToPreventive?: () => void;
  canAccessCorrectiveTab: boolean;
  onNavigateToCorrective?: (tab: string) => void;
  canAccessStockTab: boolean;
  onNavigateToStock?: () => void;
  canAccessSortieTab: boolean;
  onNavigateToSortie?: () => void;
  canAccessMachinesTab: boolean;
  onNavigateToMachines?: () => void;
  canAccessGuideTab: boolean;
  onNavigateToGuide?: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3">
      <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
        <Zap className="w-4 h-4 text-amber-500" />
        <span>Accès Rapide aux Modules GMAO</span>
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {canAccessPreventiveTab && onNavigateToPreventive && (
          <button
            onClick={onNavigateToPreventive}
            className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">Maintenance Préventive</div>
            <div className="text-[10px] text-slate-500">Mes tâches & planning</div>
          </button>
        )}

        {canAccessCorrectiveTab && onNavigateToCorrective && (
          <button
            onClick={() => onNavigateToCorrective('corrective')}
            className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-amber-50/80 border border-slate-200/80 hover:border-amber-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700 transition-colors">Maintenance Corrective</div>
            <div className="text-[10px] text-slate-500">DI, BT & Chrono Live</div>
          </button>
        )}

        {canAccessStockTab && (
          <button
            onClick={onNavigateToStock}
            className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Package className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">Magasin Stock</div>
            <div className="text-[10px] text-slate-500">Consulter les PDR</div>
          </button>
        )}

        {canAccessSortieTab && (
          <button
            onClick={onNavigateToSortie}
            className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <SortieEntreeIcon className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">Sorties & Entrées</div>
            <div className="text-[10px] text-slate-500">Enregistrer un bon</div>
          </button>
        )}

        {canAccessMachinesTab && (
          <button
            onClick={onNavigateToMachines}
            className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-purple-50/80 border border-slate-200/80 hover:border-purple-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Factory className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-purple-700 transition-colors">Parc Machines</div>
            <div className="text-[10px] text-slate-500">Arborescence actifs</div>
          </button>
        )}

        {canAccessGuideTab && onNavigateToGuide && (
          <button
            onClick={onNavigateToGuide}
            className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-teal-50/80 border border-slate-200/80 hover:border-teal-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="font-bold text-xs text-slate-900 group-hover:text-teal-700 transition-colors">Guide Terrain</div>
            <div className="text-[10px] text-slate-500">Manuel & Procédures</div>
          </button>
        )}
      </div>
    </div>
  );
}
