import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Wrench,
  XCircle,
} from 'lucide-react';
import SortieEntreeIcon from '../../../components/common/SortieEntreeIcon';
import type { serverSyncService } from '../../../../services/serverSyncService';
import type {
  buildAdminValidationRadar,
  selectValidationCenterQueues,
} from '../../../../core/security/validationReconciliation';

export interface DashboardTrustAndRadarStripProps {
  t: (key: string) => string;
  syncTrust: ReturnType<typeof serverSyncService.getOperationalSyncStatus>;
  isSyncBusy: boolean;
  canSyncLan: boolean;
  canAccessSettingsTab: boolean;
  canAccessValidationCenterTab: boolean;
  canAccessCorrectiveBtTab: boolean;
  canAccessPreventiveTab: boolean;
  canAccessSortieTab: boolean;
  referentialAudit: any;
  validationQueues: ReturnType<typeof selectValidationCenterQueues>;
  validationRadar: ReturnType<typeof buildAdminValidationRadar>;
  isRadarExpanded: boolean;
  onToggleRadar: () => void;
  onOpenConflictModal: () => void;
  onQuickLanMerge: () => void;
  onNavigateToSettings?: (section?: string) => void;
  onNavigateToValidationCenter?: () => void;
  onNavigateToCorrective?: (tab?: string) => void;
  onNavigateToPreventive?: () => void;
  onNavigateToSortie?: () => void;
}

export function DashboardTrustAndRadarStrip({
  t,
  syncTrust,
  isSyncBusy,
  canSyncLan,
  canAccessSettingsTab,
  canAccessValidationCenterTab,
  canAccessCorrectiveBtTab,
  canAccessPreventiveTab,
  canAccessSortieTab,
  referentialAudit,
  validationQueues,
  validationRadar,
  isRadarExpanded,
  onToggleRadar,
  onOpenConflictModal,
  onQuickLanMerge,
  onNavigateToSettings,
  onNavigateToValidationCenter,
  onNavigateToCorrective,
  onNavigateToPreventive,
  onNavigateToSortie,
}: DashboardTrustAndRadarStripProps) {
  return (
    <div
      data-testid="a2-operational-trust-card"
      className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 sm:p-4 space-y-3 text-xs"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: LAN Sync Status + Queue Counters + Referential Health */}
        <div className="flex items-start sm:items-center gap-3 min-w-0 flex-wrap">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 shadow-2xs ${
              syncTrust.hasUnresolvedConflict
                ? 'bg-amber-500 text-white'
                : syncTrust.lastSyncStatus === 'ERROR'
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-extrabold text-xs text-slate-900">
              {t('dashboard.trust.title')}
            </span>

            {syncTrust.hasUnresolvedConflict ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-mono text-[10.5px] font-extrabold border border-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                {t('dashboard.trust.conflictBadge')}
              </span>
            ) : syncTrust.lastSyncStatus === 'ERROR' ? (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-900 font-mono text-[10.5px] font-extrabold border border-rose-300 flex items-center gap-1">
                <XCircle className="w-3 h-3 text-rose-600" />
                {t('dashboard.trust.errorBadge')}
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-mono text-[10.5px] font-bold border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                {syncTrust.lastSyncAt
                  ? `${t('dashboard.trust.syncedOk')} (${new Date(syncTrust.lastSyncAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}${syncTrust.lastServerVersion ? ` · v${syncTrust.lastServerVersion}` : ''})`
                  : t('dashboard.trust.readyLocalLan')}
              </span>
            )}

            {referentialAudit?.summary && !referentialAudit.summary.isFullyAligned && (
              canAccessSettingsTab && onNavigateToSettings ? (
                <button
                  type="button"
                  onClick={() => onNavigateToSettings('matching')}
                  className="px-2.5 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-mono text-[10.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                  title="Des mouvements ou interventions font référence à des machines ou techniciens non enregistrés."
                >
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  <span>
                    {t('dashboard.trust.referentialGaps')} ({referentialAudit.summary.totalOrphanErrors || 0}) · {t('dashboard.trust.health')} {referentialAudit.healthScore ?? 100}%
                  </span>
                  <span className="underline ml-0.5">{t('dashboard.trust.pairAction')}</span>
                </button>
              ) : (
                <span
                  className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-mono text-[10.5px] font-bold inline-flex items-center gap-1"
                  title="Des mouvements ou interventions font référence à des machines ou techniciens non enregistrés."
                >
                  <ShieldAlert className="w-3 h-3 text-amber-600" />
                  <span>
                    {t('dashboard.trust.referentialGaps')} ({referentialAudit.summary.totalOrphanErrors || 0}) · {t('dashboard.trust.health')} {referentialAudit.healthScore ?? 100}%
                  </span>
                </span>
              )
            )}
          </div>

          <div className="hidden lg:block h-4 w-px bg-slate-200" />

          {/* Live PENDING Queue Counters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500">
              {t('dashboard.trust.pendingQueueLabel')} ({validationQueues.totalPending}) :
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 border border-slate-200 font-mono font-bold text-[10.5px]">
              {t('dashboard.trust.correctiveBt')} <b className="text-amber-700">{validationQueues.pendingCorrective.length}</b>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 border border-slate-200 font-mono font-bold text-[10.5px]">
              {t('dashboard.trust.preventive')} <b className="text-indigo-700">{validationQueues.pendingPreventive.length}</b>
            </span>
            <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-800 border border-slate-200 font-mono font-bold text-[10.5px]">
              {t('dashboard.trust.spareIssues')} <b className="text-teal-700">{validationQueues.pendingSortieDemands.length}</b>
            </span>
            {validationQueues.totalClarification > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-900 border border-rose-200 font-mono font-bold text-[10.5px]">
                {t('dashboard.trust.toClarify')} {validationQueues.totalClarification}
              </span>
            )}
          </div>
        </div>

        {/* Right: Conflict / Sync / Validation Center Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {canSyncLan && syncTrust.hasUnresolvedConflict && (
            <button
              type="button"
              onClick={onOpenConflictModal}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t('dashboard.trust.resolveLanConflict')}</span>
            </button>
          )}

          {(validationRadar.totalPendingCount > 0 || validationRadar.totalClarificationCount > 0) && (
            <button
              type="button"
              onClick={onToggleRadar}
              className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{t('dashboard.trust.fieldRadar')} ({validationRadar.totalPendingCount})</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isRadarExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>
          )}

          {canSyncLan && (
            <button
              type="button"
              onClick={onQuickLanMerge}
              disabled={isSyncBusy}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Fusionner intelligemment avec le serveur LAN sans écraser les données"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncBusy ? 'animate-spin text-emerald-600' : 'text-slate-600'}`} />
              <span>{t('dashboard.trust.syncLanBtn')}</span>
            </button>
          )}

          {canAccessValidationCenterTab && onNavigateToValidationCenter && (
            <button
              type="button"
              onClick={onNavigateToValidationCenter}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('dashboard.trust.validationCenterBtn')} ({validationQueues.totalPending})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {syncTrust.lastSyncError && (
        <div className="text-[11px] font-semibold text-rose-700 truncate pt-1 border-t border-slate-100">
          {t('dashboard.trust.lastError')} {syncTrust.lastSyncError}
        </div>
      )}

      {/* Collapsible V4 Admin Validation Radar */}
      {(validationRadar.totalPendingCount > 0 || validationRadar.totalClarificationCount > 0) && (
        <div
          data-testid="v4-admin-validation-radar"
          className="pt-3 border-t border-slate-100 space-y-2.5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs text-slate-800">
                Radar de Validation Terrain (Maker-Checker V4) : {validationRadar.totalPendingCount} à valider
              </span>
              {validationRadar.criticalAlertCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 font-mono text-[10px] font-bold border border-rose-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  {validationRadar.criticalAlertCount} anomalie(s) stock/bon
                </span>
              )}
              {validationRadar.totalClarificationCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-mono text-[10px] font-bold border border-amber-200">
                  {validationRadar.totalClarificationCount} en clarification tech.
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {validationRadar.pendingCorrectiveCount > 0 &&
                (canAccessValidationCenterTab || canAccessCorrectiveBtTab) && (
                  <button
                    type="button"
                    onClick={() =>
                      canAccessValidationCenterTab && onNavigateToValidationCenter
                        ? onNavigateToValidationCenter()
                        : canAccessCorrectiveBtTab
                        ? onNavigateToCorrective?.('corrective_bt')
                        : undefined
                    }
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                  >
                    <Wrench className="w-3 h-3 text-amber-700" />
                    <span>BT ({validationRadar.pendingCorrectiveCount})</span>
                  </button>
                )}
              {validationRadar.pendingPreventiveCount > 0 &&
                (canAccessValidationCenterTab || canAccessPreventiveTab) && (
                  <button
                    type="button"
                    onClick={() =>
                      canAccessValidationCenterTab && onNavigateToValidationCenter
                        ? onNavigateToValidationCenter()
                        : canAccessPreventiveTab
                        ? onNavigateToPreventive?.()
                        : undefined
                    }
                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                  >
                    <Calendar className="w-3 h-3 text-indigo-700" />
                    <span>Préventif ({validationRadar.pendingPreventiveCount})</span>
                  </button>
                )}
              {validationRadar.pendingSortieCount > 0 &&
                (canAccessValidationCenterTab || canAccessSortieTab) && (
                  <button
                    type="button"
                    onClick={() =>
                      canAccessValidationCenterTab && onNavigateToValidationCenter
                        ? onNavigateToValidationCenter()
                        : canAccessSortieTab
                        ? onNavigateToSortie?.()
                        : undefined
                    }
                    className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer"
                  >
                    <SortieEntreeIcon className="w-3 h-3 text-teal-700" />
                    <span>Sorties ({validationRadar.pendingSortieCount})</span>
                  </button>
                )}
            </div>
          </div>

          {isRadarExpanded && validationRadar.items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
              {validationRadar.items.slice(0, 6).map((item) => {
                const canInspectRadarItem =
                  item.claimType === 'CORRECTIVE'
                    ? canAccessCorrectiveBtTab || canAccessValidationCenterTab
                    : item.claimType === 'PREVENTIVE'
                    ? canAccessPreventiveTab || canAccessValidationCenterTab
                    : canAccessSortieTab || canAccessValidationCenterTab;

                return (
                  <div
                    key={`${item.claimType}-${item.id}`}
                    className={`p-3 rounded-xl bg-slate-50/80 border flex items-center justify-between gap-2.5 text-xs ${
                      item.reconciliation.hasCritical
                        ? 'border-rose-300'
                        : item.reconciliation.hasWarning
                        ? 'border-amber-300'
                        : 'border-slate-200/90'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9.5px] font-mono font-black ${
                            item.claimType === 'CORRECTIVE'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : item.claimType === 'PREVENTIVE'
                              ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                              : 'bg-teal-100 text-teal-900 border border-teal-200'
                          }`}
                        >
                          {item.claimType === 'CORRECTIVE'
                            ? 'BT'
                            : item.claimType === 'PREVENTIVE'
                            ? 'PRÉV'
                            : 'SORTIE'}
                        </span>
                        <span className="font-mono font-bold text-slate-900">{item.machineCode}</span>
                        <span className="text-[10.5px] text-slate-500 truncate">• {item.technicianName}</span>
                      </div>
                      <div className="font-bold text-slate-800 truncate">{item.title}</div>
                      {item.reconciliation.alerts.length > 0 ? (
                        <div className="text-[10px] font-bold text-rose-700 flex items-center gap-1 truncate">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.reconciliation.alerts[0].title}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-mono text-emerald-700">
                          {item.sparesCount} PDR • Concordance OK
                        </div>
                      )}
                    </div>

                    {canInspectRadarItem && (
                      <button
                        type="button"
                        onClick={() =>
                          item.claimType === 'CORRECTIVE'
                            ? canAccessCorrectiveBtTab
                              ? onNavigateToCorrective?.('corrective_bt')
                              : onNavigateToValidationCenter?.()
                            : item.claimType === 'PREVENTIVE'
                            ? canAccessPreventiveTab
                              ? onNavigateToPreventive?.()
                              : onNavigateToValidationCenter?.()
                            : canAccessSortieTab
                            ? onNavigateToSortie?.()
                            : onNavigateToValidationCenter?.()
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-[11px] shrink-0 cursor-pointer transition"
                      >
                        Contrôler
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
