import {
  Activity,
  ArrowRight,
  Calendar,
  Factory,
  FileSpreadsheet,
  Layers,
  Package,
  Truck,
  UserCheck,
  Warehouse,
  Wrench,
  Zap,
} from 'lucide-react';
import SortieEntreeIcon from '../../../components/common/SortieEntreeIcon';

export interface DashboardExecutiveAndQuickNavProps {
  t: (key: string) => string;
  executiveMaintenanceSummary: {
    pmTotalCount: number;
    pmDoneCount: number;
    pmOverdueCount: number;
    pmComplianceRate: number;
    openDiCount: number;
    plannedBtCount: number;
    liveBtCount: number;
    activeCorrectiveTotal: number;
    closedBtCount: number;
    mttrDisplay: string;
  };
  machineHealth: {
    enService: number;
    total: number;
  };
  pendingOrdersCount: number;
  pendingExternalRepairsCount: number;
  canAccessPreventiveTab: boolean;
  canAccessCorrectiveTab: boolean;
  canAccessCorrectiveDiTab: boolean;
  canAccessCorrectiveBtTab: boolean;
  canAccessCorrectiveLiveTab: boolean;
  canAccessCorrectiveClotureTab: boolean;
  canAccessCorrectiveAnalyticsTab: boolean;
  canAccessSortieTab: boolean;
  canAccessStockTab: boolean;
  canAccessMachinesTab: boolean;
  canAccessEntrepotTab: boolean;
  canAccessZonesTab: boolean;
  canAccessUsersTab: boolean;
  canAccessSettingsTab: boolean;
  onNavigateToPreventive?: () => void;
  onNavigateToCorrective?: (tab?: string) => void;
  onNavigateToSortie?: () => void;
  onNavigateToStock?: () => void;
  onNavigateToMachines?: () => void;
  onNavigateToWarehouse?: () => void;
  onNavigateToZones?: () => void;
  onNavigateToUsers?: () => void;
  onNavigateToSettings?: (section?: string) => void;
}

export function DashboardExecutiveAndQuickNav({
  t,
  executiveMaintenanceSummary,
  machineHealth,
  pendingOrdersCount,
  pendingExternalRepairsCount,
  canAccessPreventiveTab,
  canAccessCorrectiveTab,
  canAccessCorrectiveDiTab,
  canAccessCorrectiveBtTab,
  canAccessCorrectiveLiveTab,
  canAccessCorrectiveClotureTab,
  canAccessCorrectiveAnalyticsTab,
  canAccessSortieTab,
  canAccessStockTab,
  canAccessMachinesTab,
  canAccessEntrepotTab,
  canAccessZonesTab,
  canAccessUsersTab,
  canAccessSettingsTab,
  onNavigateToPreventive,
  onNavigateToCorrective,
  onNavigateToSortie,
  onNavigateToStock,
  onNavigateToMachines,
  onNavigateToWarehouse,
  onNavigateToZones,
  onNavigateToUsers,
  onNavigateToSettings,
}: DashboardExecutiveAndQuickNavProps) {
  return (
    <>
      {/* 2.5 Executive Maintenance & Reliability Pulse Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div
          onClick={canAccessPreventiveTab ? onNavigateToPreventive : undefined}
          className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
            canAccessPreventiveTab ? 'hover:border-indigo-300 cursor-pointer' : ''
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
              {t('dashboard.execPulse.preventiveCompliance')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-indigo-700">
                {executiveMaintenanceSummary.pmComplianceRate}%
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ({executiveMaintenanceSummary.pmDoneCount}/{executiveMaintenanceSummary.pmTotalCount} {t('dashboard.execPulse.doneShort')})
              </span>
            </div>
            <div className="text-[10.5px] font-mono text-rose-700 font-bold">
              {executiveMaintenanceSummary.pmOverdueCount} {t('dashboard.execPulse.overdueShort')}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={canAccessCorrectiveTab ? () => onNavigateToCorrective?.('corrective') : undefined}
          className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
            canAccessCorrectiveTab ? 'hover:border-amber-300 cursor-pointer' : ''
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
              {t('dashboard.execPulse.activeCorrectiveLoad')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-amber-700">
                {executiveMaintenanceSummary.activeCorrectiveTotal}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {t('dashboard.execPulse.openDiShort')} : {executiveMaintenanceSummary.openDiCount}
              </span>
            </div>
            <div className="text-[10.5px] font-mono text-emerald-700 font-bold">
              {executiveMaintenanceSummary.liveBtCount} {t('dashboard.execPulse.liveBtShort')}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 flex items-center justify-center text-amber-700 shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={canAccessCorrectiveAnalyticsTab ? () => onNavigateToCorrective?.('corrective_analytics') : undefined}
          className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
            canAccessCorrectiveAnalyticsTab ? 'hover:border-purple-300 cursor-pointer' : ''
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
              {t('dashboard.execPulse.meanRepairTime')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-purple-700">
                {executiveMaintenanceSummary.mttrDisplay}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                ({executiveMaintenanceSummary.closedBtCount} {t('dashboard.execPulse.closedInterventions')})
              </span>
            </div>
            <div className="text-[10.5px] font-mono text-slate-500 font-semibold">
              {t('dashboard.execPulse.availabilityLabel')} :{' '}
              {machineHealth.total > 0
                ? Math.round((machineHealth.enService / machineHealth.total) * 100)
                : 100}
              %
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200/80 flex items-center justify-center text-purple-700 shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div
          onClick={canAccessSortieTab ? onNavigateToSortie : undefined}
          className={`bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 transition ${
            canAccessSortieTab ? 'hover:border-teal-300 cursor-pointer' : ''
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500">
              {t('dashboard.execPulse.openLogisticsFlows')}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-teal-700">
                {pendingOrdersCount + pendingExternalRepairsCount}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                {pendingOrdersCount} {t('dashboard.execPulse.pendingOrdersShort')}
              </span>
            </div>
            <div className="text-[10.5px] font-mono text-purple-700 font-bold">
              {pendingExternalRepairsCount} {t('dashboard.execPulse.externalRepairsShort')}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-700 shrink-0">
            <Truck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3. Accès Rapide aux Modules GMAO */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs space-y-3.5">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2 tracking-tight">
            <Zap className="w-4 h-4 text-accent-main" />
            <span>{t('dashboard.quickNav.title')}</span>
          </h3>
          <span className="text-[10.5px] font-mono font-bold text-accent-main bg-accent-subtle px-2.5 py-0.5 rounded-full border border-accent-subtle">
            {t('dashboard.quickNav.badge')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {canAccessStockTab && (
            <button
              onClick={onNavigateToStock}
              className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package className="w-5 h-5" />
              </div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700 transition-colors">{t('dashboard.quickNav.stockTitle')}</div>
              <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.stockDesc')}</div>
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
              <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700 transition-colors">{t('dashboard.quickNav.movementsTitle')}</div>
              <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.movementsDesc')}</div>
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
              <div className="font-bold text-xs text-slate-900 group-hover:text-purple-700 transition-colors">{t('dashboard.quickNav.machinesTitle')}</div>
              <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.machinesDesc')}</div>
            </button>
          )}

          {canAccessEntrepotTab && (
            <button
              onClick={onNavigateToWarehouse}
              className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-teal-50/80 border border-slate-200/80 hover:border-teal-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Warehouse className="w-5 h-5" />
              </div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-teal-700 transition-colors">{t('dashboard.quickNav.warehouseTitle')}</div>
              <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.warehouseDesc')}</div>
            </button>
          )}

          {canAccessZonesTab && (
            <button
              onClick={onNavigateToZones}
              className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-amber-50/80 border border-slate-200/80 hover:border-amber-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700 transition-colors">{t('dashboard.quickNav.zonesTitle')}</div>
              <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.zonesDesc')}</div>
            </button>
          )}

          {canAccessUsersTab && (
            <button
              onClick={onNavigateToUsers}
              className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-indigo-50/80 border border-slate-200/80 hover:border-indigo-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">{t('dashboard.quickNav.usersTitle')}</div>
              <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.usersDesc')}</div>
            </button>
          )}

          {canAccessSettingsTab && (
            <button
              onClick={() => onNavigateToSettings?.()}
              className="p-3.5 rounded-xl bg-slate-50/90 hover:bg-slate-100 border border-slate-200/80 hover:border-slate-300 text-left shadow-2xs hover:shadow-xs hover:-translate-y-0.5 transition-all duration-200 space-y-1.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div className="font-bold text-xs text-slate-900 group-hover:text-slate-950 transition-colors">{t('dashboard.quickNav.excelTwinTitle')}</div>
              <div className="text-[10px] text-slate-500">{t('dashboard.quickNav.excelTwinDesc')}</div>
            </button>
          )}
        </div>
      </div>

      {/* 3.5 Hub Maintenance Corrective Industrielle Nexus */}
      {canAccessCorrectiveTab && (
        <div className="bg-white rounded-2xl border border-slate-200/90 border-l-4 border-l-amber-500 shadow-2xs p-4 sm:p-5 space-y-3.5 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center justify-center text-amber-700 shrink-0 shadow-2xs">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
                    {t('dashboard.correctiveHub.title')}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-200/80 tracking-wider font-mono">
                    {t('dashboard.correctiveHub.dedicatedBadge')}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-600 border border-slate-200 font-mono">
                    {t('dashboard.correctiveHub.subSectionsBadge')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 max-w-3xl leading-relaxed">
                  {t('dashboard.correctiveHub.description')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                onClick={() => onNavigateToCorrective?.('corrective')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{t('dashboard.correctiveHub.openBtn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-slate-100">
            {canAccessCorrectiveDiTab && (
              <button
                onClick={() => onNavigateToCorrective?.('corrective_di')}
                className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step1Title')}</div>
                <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                  <span>{t('dashboard.correctiveHub.step1Sub')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200">
                    {executiveMaintenanceSummary.openDiCount}
                  </span>
                </div>
              </button>
            )}

            {canAccessCorrectiveBtTab && (
              <button
                onClick={() => onNavigateToCorrective?.('corrective_bt')}
                className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step2Title')}</div>
                <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                  <span>{t('dashboard.correctiveHub.step2Sub')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    {executiveMaintenanceSummary.plannedBtCount}
                  </span>
                </div>
              </button>
            )}

            {canAccessCorrectiveLiveTab && (
              <button
                onClick={() => onNavigateToCorrective?.('corrective_live')}
                className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step3Title')}</div>
                <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                  <span>{t('dashboard.correctiveHub.step3Sub')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {executiveMaintenanceSummary.liveBtCount} {t('dashboard.tech.inProgress')}
                  </span>
                </div>
              </button>
            )}

            {canAccessCorrectiveClotureTab && (
              <button
                onClick={() => onNavigateToCorrective?.('corrective_cloture')}
                className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step4Title')}</div>
                <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                  <span>{t('dashboard.correctiveHub.step4Sub')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-white text-slate-700 border border-slate-200">
                    {executiveMaintenanceSummary.closedBtCount}
                  </span>
                </div>
              </button>
            )}

            {canAccessCorrectiveAnalyticsTab && (
              <button
                onClick={() => onNavigateToCorrective?.('corrective_analytics')}
                className="p-2.5 rounded-xl bg-slate-50/80 hover:bg-amber-50/50 border border-slate-200/90 hover:border-amber-300 text-left transition-all group cursor-pointer shadow-2xs"
              >
                <div className="text-[10px] font-bold text-slate-400 uppercase font-mono">{t('dashboard.correctiveHub.step5Title')}</div>
                <div className="text-xs font-extrabold text-slate-800 group-hover:text-amber-700 flex items-center justify-between mt-1">
                  <span>{t('dashboard.correctiveHub.step5Sub')}</span>
                  <span className="text-[11px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">
                    MTTR
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
