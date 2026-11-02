import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useWizard } from './WizardContext';
import { WIZARD_THEME_TOKENS } from './wizardThemeTokens';

export const WizardFooter: React.FC = () => {
  const {
    profile,
    themeColor,
    next,
    back,
    isFirst,
    isLast,
    handleFinish,
    isSubmitting,
    isValidating,
    validationResult,
    stepIndex,
    totalSteps,
  } = useWizard();

  const tokens = WIZARD_THEME_TOKENS[themeColor];
  const isBusy = isSubmitting || isValidating;

  const hasBanner = Boolean(validationResult?.message);
  const isWarning = validationResult?.level === 'warning';
  const isNonBlockingWarning = Boolean(validationResult?.valid && isWarning);

  return (
    <footer className="border-t border-slate-200/90 bg-slate-50/95 px-4 sm:px-6 py-3 flex flex-col gap-2.5 shrink-0 z-10">
      {/* Sticky Validation / Operational Warning Banner Directly Above Buttons */}
      <AnimatePresence initial={false}>
        {hasBanner && validationResult?.message && (
          <motion.div
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            className="overflow-hidden"
          >
            <div
              role="alert"
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-semibold border shadow-2xs ${
                isWarning
                  ? 'bg-amber-50/95 text-amber-950 border-amber-300/90'
                  : 'bg-rose-50/95 text-rose-950 border-rose-300/90'
              }`}
            >
              {isWarning ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1 leading-snug">{validationResult.message}</span>
              {isNonBlockingWarning && (
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                  Avertissement
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls Row — Stacks cleanly on narrow mobile viewports */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5">
        {/* Left: Cancel & Back */}
        <div className="flex items-center justify-between sm:justify-start gap-2">
          {profile.onCancel && (
            <button
              type="button"
              onClick={profile.onCancel}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>{profile.cancelLabel || 'Annuler'}</span>
            </button>
          )}

          {!isFirst && (
            <button
              type="button"
              onClick={back}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer ml-auto sm:ml-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Précédent</span>
            </button>
          )}
        </div>

        {/* Right: Step Counter Pill + Next / Finish Action */}
        <div className="flex items-center justify-end gap-2.5 w-full sm:w-auto">
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-slate-200/80 text-[11px] font-mono font-bold text-slate-500 tabular-nums">
            ÉTAPE {stepIndex + 1} / {totalSteps}
          </span>

          {!isLast ? (
            <button
              type="button"
              onClick={() => void next()}
              disabled={isBusy}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-lg text-white text-xs font-bold transition-all shadow-sm cursor-pointer ${tokens.primaryButtonBg} ${tokens.primaryButtonHover} ${tokens.primaryButtonShadow} disabled:opacity-50`}
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Vérification...</span>
                </>
              ) : (
                <>
                  <span>Suivant</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleFinish()}
              disabled={isBusy}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 sm:py-2 rounded-lg text-white text-xs font-bold transition-all shadow-sm cursor-pointer ${tokens.primaryButtonBg} ${tokens.primaryButtonHover} ${tokens.primaryButtonShadow} disabled:opacity-50`}
            >
              {isBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Enregistrement...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>{profile.finishLabel || profile.submitLabel || 'Valider & Enregistrer'}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </footer>
  );
};
