import { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  DownloadCloud,
  Loader2,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Server,
} from 'lucide-react';
import { serverSyncService, type ConflictDetectionResult, type ServerStateSummary } from '../../../services/serverSyncService';
import { useI18n } from '../../../i18n/I18nContext';
import ServerSyncConflictModal from './ServerSyncConflictModal';

interface SyncButtonsProps {
  state?: Record<string, any>;
  onApplyRemoteState?: (data?: any) => void;
  showToast?: (msg: string, type?: string) => void;
  variant?: 'inline' | 'card' | 'dropdown';
  onCloseDropdown?: () => void;
}

export default function SyncButtons({
  state,
  onApplyRemoteState,
  showToast,
  variant = 'inline',
  onCloseDropdown,
}: SyncButtonsProps) {
  const { t, language } = useI18n();
  const [actionLoading, setActionLoading] = useState<'push' | 'pull' | 'check' | null>(null);
  const [serverOnline, setServerOnline] = useState<boolean>(true);
  const [serverSummary, setServerSummary] = useState<ServerStateSummary | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => serverSyncService.getLastSyncAt());
  const [conflictModal, setConflictModal] = useState<ConflictDetectionResult | null>(null);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const checkServerStatusOnce = useCallback(async () => {
    setActionLoading((prev) => prev || 'check');
    try {
      const res = await serverSyncService.fetchServerState();
      setServerOnline(res.online);
      setServerSummary(res.summary);
      setLastSyncAt(serverSyncService.getLastSyncAt());
    } finally {
      setActionLoading((prev) => (prev === 'check' ? null : prev));
    }
  }, []);

  // Check once on mount (NO silent background polling every second)
  useEffect(() => {
    checkServerStatusOnce();
  }, [checkServerStatusOnce]);

  const notify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setStatusBanner({ type, text: msg });
    if (showToast) {
      showToast(msg, type);
    }
    setTimeout(() => {
      setStatusBanner((prev) => (prev?.text === msg ? null : prev));
    }, 5000);
  };

  const handleSaveToServer = async (force = false) => {
    setActionLoading('push');
    try {
      const res = await serverSyncService.pushToServer({ force, customState: state });
      if (res.conflict) {
        setConflictModal(res.conflict);
        return;
      }
      if (!res.success) {
        notify(res.error || t('server_sync.save_error'), 'error');
        return;
      }
      setConflictModal(null);
      setLastSyncAt(res.updatedAt || new Date().toISOString());
      if (res.summary) setServerSummary(res.summary);
      setServerOnline(true);
      notify(t('server_sync.save_success'), 'success');
      if (onCloseDropdown) onCloseDropdown();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestoreFromServer = async (force = false) => {
    setActionLoading('pull');
    try {
      const res = await serverSyncService.pullFromServer({ force });
      if (res.conflict) {
        setConflictModal(res.conflict);
        return;
      }
      if (!res.success) {
        notify(res.error || t('server_sync.restore_error'), 'error');
        return;
      }
      setConflictModal(null);
      setLastSyncAt(res.updatedAt || new Date().toISOString());
      if (res.summary) setServerSummary(res.summary);
      setServerOnline(true);
      if (onApplyRemoteState) {
        onApplyRemoteState(res.summary);
      }
      notify(t('server_sync.restore_success'), 'success');
      if (onCloseDropdown) onCloseDropdown();
    } finally {
      setActionLoading(null);
    }
  };

  const localeString = language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-US' : 'fr-FR';
  const formattedLastSync = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString(localeString, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : t('server_sync.never_synced');

  if (variant === 'dropdown') {
    return (
      <>
        <div className="p-3.5 space-y-3">
          {/* Header status */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  serverOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                }`}
              >
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{t('server_sync.card_title_short')}</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      serverOnline ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  <span>{serverOnline ? t('server_sync.status_online') : t('server_sync.status_offline')}</span>
                  {serverSummary && (
                    <span className="text-slate-400">• {serverSummary.totalItems} {t('server_sync.total_records')}</span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={checkServerStatusOnce}
              disabled={actionLoading !== null}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title={t('server_sync.check_tooltip')}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'check' ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>

          {/* Last Sync Info */}
          <div className="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between text-[11px]">
            <span className="text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{t('server_sync.last_sync')}</span>
            </span>
            <span className="font-mono font-bold text-slate-700">{formattedLastSync}</span>
          </div>

          {statusBanner && (
            <div
              className={`px-3 py-2 rounded-xl text-[11px] font-bold flex items-center gap-1.5 ${
                statusBanner.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : statusBanner.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {statusBanner.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              )}
              <span className="truncate">{statusBanner.text}</span>
            </div>
          )}

          {/* Explicit Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => handleSaveToServer(false)}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition flex items-center justify-between cursor-pointer disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {actionLoading === 'push' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>{actionLoading === 'push' ? t('server_sync.saving') : t('server_sync.push_button')}</span>
              </span>
              <span className="text-[10px] font-mono text-emerald-100 bg-white/15 px-2 py-0.5 rounded-md">
                {t('server_sync.push_badge')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleRestoreFromServer(false)}
              disabled={actionLoading !== null}
              className="w-full py-2.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition flex items-center justify-between cursor-pointer disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                {actionLoading === 'pull' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadCloud className="w-4 h-4" />
                )}
                <span>{actionLoading === 'pull' ? t('server_sync.restoring') : t('server_sync.pull_button')}</span>
              </span>
              <span className="text-[10px] font-mono text-blue-100 bg-white/15 px-2 py-0.5 rounded-md">
                {t('server_sync.pull_badge')}
              </span>
            </button>
          </div>

          <div className="text-[10px] text-slate-400 text-center leading-tight pt-0.5">
            {t('server_sync.explicit_notice')}
          </div>
        </div>

        <ServerSyncConflictModal
          isOpen={Boolean(conflictModal)}
          conflict={conflictModal}
          isProcessing={actionLoading !== null}
          onForcePushLocal={() => handleSaveToServer(true)}
          onForcePullServer={() => handleRestoreFromServer(true)}
          onCancel={() => setConflictModal(null)}
        />
      </>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3.5 w-full">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                serverOnline
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900">
                  {t('server_sync.card_title')}
                </h4>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                    serverOnline
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      serverOnline ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                  />
                  {serverOnline ? t('server_sync.status_online') : t('server_sync.status_offline')}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap leading-relaxed">
                <span>{t('server_sync.card_description')}</span>
                <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                  {t('server_sync.last_sync')} {formattedLastSync}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSaveToServer(false)}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              {actionLoading === 'push' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <UploadCloud className="w-4 h-4 shrink-0" />
              )}
              <span>{actionLoading === 'push' ? t('server_sync.saving') : t('server_sync.push_button')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleRestoreFromServer(false)}
              disabled={actionLoading !== null}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs hover:shadow transition cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              {actionLoading === 'pull' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : (
                <DownloadCloud className="w-4 h-4 shrink-0" />
              )}
              <span>{actionLoading === 'pull' ? t('server_sync.restoring') : t('server_sync.pull_button')}</span>
            </button>

            <button
              type="button"
              onClick={checkServerStatusOnce}
              disabled={actionLoading !== null}
              className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition cursor-pointer flex items-center justify-center min-h-[40px]"
              title={t('server_sync.check_tooltip')}
              aria-label={t('server_sync.check_tooltip')}
            >
              <RefreshCw className={`w-4 h-4 ${actionLoading === 'check' ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {statusBanner && (
          <div
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 ${
              statusBanner.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : statusBanner.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {statusBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusBanner.text}</span>
          </div>
        )}
      </div>

      <ServerSyncConflictModal
        isOpen={Boolean(conflictModal)}
        conflict={conflictModal}
        isProcessing={actionLoading !== null}
        onForcePushLocal={() => handleSaveToServer(true)}
        onForcePullServer={() => handleRestoreFromServer(true)}
        onCancel={() => setConflictModal(null)}
      />
    </>
  );
}
