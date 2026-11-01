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

  const isInvalid = validationResult && !validationResult.valid;
  const isWarning = validationResult?.level === 'warning';

  return (
    <footer className="border-t border-slate-200/90 bg-slate-50/80 px-5 sm:px-7 py-3.5 flex flex-col gap-3 shrink-0">
      {/* Validation Banner (Critical or Warning) */}
      <AnimatePresence initial={false}>
        {isInvalid && validationResult?.message && (
          <motion.div
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 6, height: 0 }}
            className="overflow-hidden"
          >
            <div
              role="alert"
              className={`flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-semibold border ${
                isWarning
                  ? 'bg-amber-50/90 text-amber-900 border-amber-200/90'
                  : 'bg-rose-50/90 text-rose-900 border-rose-200/90'
              }`}
            >
              {isWarning ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="flex-1 leading-snug">{validationResult.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Controls Row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left: Cancel & Back */}
        <div className="flex items-center gap-2">
          {profile.onCancel && (
            <button
              type="button"
              onClick={profile.onCancel}
              disabled={isBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors disabled:opacity-50"
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Précédent</span>
            </button>
          )}
        </div>

        {/* Right: Step Counter Pill + Next / Finish Action */}
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md bg-white border border-slate-200/80 text-[11px] font-mono font-bold text-slate-500 tabular-nums">
            ÉTAPE {stepIndex + 1} / {totalSteps}
          </span>

          {!isLast ? (
            <button
              type="button"
              onClick={() => void next()}
              disabled={isBusy}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-white text-xs font-bold transition-all shadow-sm ${tokens.primaryButtonBg} ${tokens.primaryButtonHover} ${tokens.primaryButtonShadow} disabled:opacity-50`}
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
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50"
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
