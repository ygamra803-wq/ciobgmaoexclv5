import { Component } from 'react';
import { AlertTriangle, RefreshCw, Copy, Check, ShieldAlert } from 'lucide-react';
import { Logger } from '../../../core/logger/LoggerService';
import { errorTracker } from '../../../services/ErrorTrackingService';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    Logger.error('Captured runtime error:', { error, errorInfo }, 'ErrorBoundary');
    errorTracker.captureException(error, {
      componentStack: errorInfo?.componentStack,
      sectionName: this.props.sectionName || 'GMAO Section',
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('app_runtime_error', {
          detail: {
            error: error?.message || String(error),
            section: this.props.sectionName || 'Module GMAO',
            timestamp: new Date().toLocaleTimeString(),
          },
        })
      );
    }
  }

  handleRetry = () => {
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch (e) {
        Logger.warn('Error during onReset callback', e);
      }
    }
    this.setState({ hasError: false, error: null, copied: false });
  };

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleCopyError = () => {
    if (this.state.error) {
      const details = `[Erreur GMAO - ${this.props.sectionName || 'Module'}]\nMessage: ${this.state.error.message}\nStack: ${this.state.error.stack || 'N/A'}`;
      navigator.clipboard.writeText(details).then(() => {
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      });
    }
  };

  render() {
    if (this.state.hasError) {
      const sectionName = this.props.sectionName || 'ce module';
      const isCompact = this.props.compact || false;

      if (isCompact) {
        return (
          <div
            role="alert"
            aria-live="assertive"
            className="p-4 my-2 rounded-2xl bg-amber-50/90 border border-amber-200/90 shadow-2xs text-left space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-950">
                    Problème détecté dans {sectionName}
                  </h3>
                  <p className="text-[11px] text-amber-800/90">
                    L'affichage de cet élément a été isolé. Les autres fonctions restent disponibles.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-xl transition cursor-pointer shrink-0 shadow-2xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Réessayer</span>
              </button>
            </div>
            {this.state.error && (
              <p className="font-mono text-[10.5px] bg-white/80 p-2 rounded-lg border border-amber-200/60 text-rose-800 overflow-x-auto truncate">
                {this.state.error.message || String(this.state.error)}
              </p>
            )}
          </div>
        );
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-[350px] flex items-center justify-center p-4 my-2"
        >
          <div className="max-w-lg w-full bg-white rounded-2xl p-6 border border-slate-200/90 shadow-md text-center space-y-4 relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-amber-100/90 text-amber-700 flex items-center justify-center mx-auto border border-amber-200/80 shadow-2xs">
              <AlertTriangle className="w-6 h-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900">
                Interruption sécurisée : {sectionName}
              </h1>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Un dysfonctionnement est survenu dans la vue <b>{sectionName}</b>. Vos données restent enregistrées et intactes en mémoire locale.
              </p>
            </div>

            {this.state.error && (
              <details className="text-left bg-slate-50 rounded-xl p-3 border border-slate-200/90 space-y-2">
                <summary className="text-[11px] font-bold text-slate-700 cursor-pointer select-none flex items-center justify-between">
                  <span>Détails de l'incident technique</span>
                  <span className="text-[10px] text-slate-400 font-normal">Cliquer pour développer</span>
                </summary>
                <div className="font-mono text-[11px] text-rose-700 bg-rose-50/50 p-2.5 rounded-lg border border-rose-100 overflow-x-auto max-h-36 whitespace-pre-wrap leading-relaxed">
                  {this.state.error.stack || this.state.error.toString()}
                </div>
              </details>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Réessayer cette vue</span>
              </button>

              <button
                type="button"
                onClick={this.handleCopyError}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer border border-slate-200"
              >
                {this.state.copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{this.state.copied ? 'Copié !' : 'Copier rapport'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
              >
                <span>Recharger la page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

