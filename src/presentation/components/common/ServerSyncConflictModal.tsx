import { AlertTriangle, UploadCloud, DownloadCloud, X, Server, HardDrive, Clock, ArrowRightLeft } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nContext';
import type { ConflictDetectionResult } from '../../../services/serverSyncService';

interface ServerSyncConflictModalProps {
  isOpen: boolean;
  conflict: ConflictDetectionResult | null;
  onForcePushLocal: () => void;
  onForcePullServer: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function ServerSyncConflictModal({
  isOpen,
  conflict,
  onForcePushLocal,
  onForcePullServer,
  onCancel,
  isProcessing = false,
}: ServerSyncConflictModalProps) {
  const { t, language } = useI18n();
  if (!isOpen || !conflict) return null;

  const { localSummary, serverSummary, reason } = conflict;

  const localeString = language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-US' : 'fr-FR';

  const formatTime = (iso: string | null) => {
    if (!iso) return t('common.not_specified', 'Non spécifié');
    try {
      return new Date(iso).toLocaleString(localeString, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const rows = [
    { label: t('sync_conflict.machine_records', 'Machines'), local: localSummary.machinesCount, server: serverSummary.machinesCount },
    { label: t('sync_conflict.stock_records', 'Stock PDR'), local: localSummary.stockCount, server: serverSummary.stockCount },
    { label: t('sync_conflict.preventive_records', 'Préventif'), local: localSummary.preventiveCount, server: serverSummary.preventiveCount },
    { label: t('sync_conflict.corrective_records', 'Correctif'), local: localSummary.correctiveCount, server: serverSummary.correctiveCount },
    { label: t('sync_conflict.movements_records', 'Mouvements'), local: localSummary.movementsCount, server: serverSummary.movementsCount },
  ];

  return (
    <div
      className="fixed inset-0 z-100 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-modal-title"
    >
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 id="conflict-modal-title" className="text-base font-black tracking-tight">
                {t('sync_conflict.title', 'Conflit de Synchronisation')}
              </h3>
              <p className="text-xs text-amber-100 font-medium mt-0.5">
                {reason === 'SERVER_NEWER'
                  ? t('sync_conflict.reason_server_newer', 'Le fichier serveur est plus récent.')
                  : t('sync_conflict.reason_generic', 'Il existe des différences entre les données.')}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition cursor-pointer"
            aria-label={t('common.close', 'Fermer')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Timestamp Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <HardDrive className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-emerald-950">{t('sync_conflict.local_version', 'Local')}</div>
                <div className="text-[11px] text-emerald-700 font-mono flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{formatTime(localSummary.updatedAt)}</span>
                </div>
                <div className="text-[11px] font-bold text-emerald-800 mt-1">
                  {t('sync_conflict.total_records', 'Total:')} <span className="font-mono">{localSummary.totalItems}</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Server className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-extrabold text-blue-950">{t('sync_conflict.server_version', 'Serveur')}</div>
                <div className="text-[11px] text-blue-700 font-mono flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="truncate">{formatTime(serverSummary.updatedAt)}</span>
                </div>
                <div className="text-[11px] font-bold text-blue-800 mt-1">
                  {t('sync_conflict.total_records', 'Total:')} <span className="font-mono">{serverSummary.totalItems}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" />
                <span>{t('sync_conflict.comparison_table_title', 'Comparaison')}</span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-200/80 font-bold">
                    <th className="py-2 px-4 text-left">{t('sync_conflict.comparison_table_header_entity', 'Entité')}</th>
                    <th className="py-2 px-4 text-center text-emerald-700">{t('sync_conflict.comparison_table_header_local', 'Local')}</th>
                    <th className="py-2 px-4 text-center text-blue-700">{t('sync_conflict.comparison_table_header_server', 'Serveur')}</th>
                    <th className="py-2 px-4 text-right">{t('sync_conflict.comparison_table_header_diff', 'Écart')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const diff = r.local - r.server;
                    return (
                      <tr key={r.label} className="hover:bg-slate-50/80">
                        <td className="py-2 px-4 font-semibold text-slate-800">{r.label}</td>
                        <td className="py-2 px-4 text-center font-mono font-bold text-emerald-700 bg-emerald-50/30">
                          {r.local}
                        </td>
                        <td className="py-2 px-4 text-center font-mono font-bold text-blue-700 bg-blue-50/30">
                          {r.server}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400">{t('sync_conflict.match_label', 'Match')}</span>
                          ) : diff > 0 ? (
                            <span className="text-emerald-600">+{diff} {t('sync_conflict.local_diff_label', 'local')}</span>
                          ) : (
                            <span className="text-blue-600">{diff} {t('sync_conflict.server_diff_label', 'serveur')}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              {t('sync_conflict.cancel', 'Annuler')}
            </button>

            <button
              type="button"
              onClick={onForcePullServer}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <DownloadCloud className="w-4 h-4 shrink-0" />
              <span>{t('sync_conflict.pull_server', 'Restaurer serveur')}</span>
            </button>

            <button
              type="button"
              onClick={onForcePushLocal}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4 shrink-0" />
              <span>{t('sync_conflict.push_local', 'Forcer local')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
