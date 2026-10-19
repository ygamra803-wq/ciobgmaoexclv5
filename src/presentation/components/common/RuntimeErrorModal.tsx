import { useState, useEffect } from 'react';
import { RefreshCw, X, Copy, Check, ShieldAlert } from 'lucide-react';

export default function RuntimeErrorModal() {
  const [errorNotice, setErrorNotice] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 1. Listen for Custom Event dispatched by ErrorBoundary or async services
    const handleRuntimeError = (event) => {
      if (event.detail) {
        setErrorNotice({
          message: event.detail.error || 'Une erreur imprévue est survenue.',
          section: event.detail.section || 'Application GMAO',
          timestamp: event.detail.timestamp || new Date().toLocaleTimeString(),
          stack: event.detail.stack || '',
        });
      }
    };

    // 2. Listen for Uncaught Window Errors
    const handleWindowError = (event) => {
      const errorMsg = event.error?.message || event.message || 'Erreur d\'exécution du script';
      setErrorNotice({
        message: errorMsg,
        section: 'Exécution Script / Événement',
        timestamp: new Date().toLocaleTimeString(),
        stack: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      });
    };

    // 3. Listen for Unhandled Promise Rejections
    const handlePromiseRejection = (event) => {
      const reason = event.reason;
      const errorMsg = reason instanceof Error ? reason.message : String(reason || 'Rejet d\'opération asynchrone');
      setErrorNotice({
        message: errorMsg,
        section: 'Opération Asynchrone',
        timestamp: new Date().toLocaleTimeString(),
        stack: reason instanceof Error ? reason.stack : '',
      });
    };

    window.addEventListener('app_runtime_error', handleRuntimeError);
    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);

    return () => {
      window.removeEventListener('app_runtime_error', handleRuntimeError);
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
    };
  }, []);

  if (!errorNotice) return null;

  const handleCopyReport = () => {
    const text = `[RAPPORT ANOMALIE GMAO]\nModule: ${errorNotice.section}\nHeure: ${errorNotice.timestamp}\nMessage: ${errorNotice.message}\nStack: ${errorNotice.stack || 'N/A'}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-9999 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-lg w-full p-6 space-y-4 relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center font-bold shrink-0 shadow-2xs">
              <ShieldAlert className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-slate-900">
                  Alerte & Sécurité Système GMAO
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                  INCIDENT ISOLÉ
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Module : <b className="text-slate-800">{errorNotice.section}</b> à {errorNotice.timestamp}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
            title="Masquer cette alerte"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Card */}
        <div className="space-y-2">
          <p className="text-xs text-slate-600 leading-relaxed">
            Un problème technique a été intercepté. L'application a automatiquement protégé vos données locales et empêché le blocage complet du système.
          </p>
          <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200/80 font-mono text-xs text-rose-900 overflow-x-auto max-h-32 leading-relaxed">
            <b>Erreur :</b> {errorNotice.message}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-200"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Rapport Copié !' : 'Copier Rapport'}</span>
          </button>

          <button
            type="button"
            onClick={() => setErrorNotice(null)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
          >
            <span>Continuer l'utilisation</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recharger App</span>
          </button>
        </div>
      </div>
    </div>
  );
}
