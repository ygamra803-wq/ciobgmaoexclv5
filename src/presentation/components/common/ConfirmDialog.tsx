import React, { useEffect, useState, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { subscribeConfirm, resolveConfirm, type ConfirmState } from '../../../utils/confirmAction';

export default function ConfirmDialog() {
  const [state, setState] = useState<ConfirmState>({
    isOpen: false,
    options: { message: '' },
    resolve: null,
  });

  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    return subscribeConfirm((nextState) => {
      setState(nextState);
    });
  }, []);

  useEffect(() => {
    if (state.isOpen) {
      // Auto-focus confirm button or cancel button depending on destructiveness
      const timer = setTimeout(() => {
        if (state.options.isDestructive) {
          cancelBtnRef.current?.focus();
        } else {
          confirmBtnRef.current?.focus();
        }
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          resolveConfirm(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [state.isOpen, state.options.isDestructive]);

  if (!state.isOpen) return null;

  const {
    title,
    message,
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    variant,
    isDestructive = false,
  } = state.options;

  const isDanger = variant === 'danger' || isDestructive;
  const isWarning = variant === 'warning';

  const defaultTitle = isDanger
    ? 'Confirmation critique'
    : isWarning
      ? 'Attention requise'
      : 'Confirmation';

  const displayTitle = title || defaultTitle;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-none animate-in fade-in duration-150"
      onClick={() => resolveConfirm(false)}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-5 md:p-6 relative overflow-hidden transition-all scale-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => resolveConfirm(false)}
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          aria-label="Fermer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon + Title */}
        <div className="flex items-start gap-3.5 mb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isDanger
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60'
                : isWarning
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/60'
                  : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60'
            }`}
          >
            {isDanger ? (
              <AlertTriangle className="w-5 h-5" />
            ) : isWarning ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>

          <div className="flex-1 pr-6">
            <h3
              id="confirm-dialog-title"
              className="text-base font-bold text-slate-900 dark:text-white leading-snug"
            >
              {displayTitle}
            </h3>
          </div>
        </div>

        {/* Message body */}
        <div
          id="confirm-dialog-description"
          className="text-xs md:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line mb-6 pl-0.5"
        >
          {message}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={() => resolveConfirm(false)}
            className="px-4 py-2 text-xs md:text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
          >
            {cancelText}
          </button>

          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => resolveConfirm(true)}
            className={`px-4 py-2 text-xs md:text-sm font-semibold rounded-xl text-white shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800'
                : isWarning
                  ? 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
