import React from 'react';
import { Check, X } from 'lucide-react';
import type { WizardProfile } from './wizard.types';
import { WizardProvider, useWizard } from './WizardContext';
import { WizardSidebar } from './WizardSidebar';
import { WizardContent } from './WizardContent';
import { WizardFooter } from './WizardFooter';
import { WIZARD_THEME_TOKENS } from './wizardThemeTokens';

/**
 * Compact responsive header visible on mobile & tablet screens (< lg)
 * when `layout === 'split'` is used.
 */
const MobileWizardHeader: React.FC = () => {
  const { profile, stepIndex, totalSteps, currentStep, themeColor } = useWizard();
  const tokens = WIZARD_THEME_TOKENS[themeColor];
  const progressPercentage =
    totalSteps > 0 ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 100;

  return (
    <div className="lg:hidden bg-slate-50/95 border-b border-slate-200/90 p-4 shrink-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
            {profile.title}
          </span>
          <h2 className="text-sm font-black text-slate-900 truncate">
            {currentStep?.title}
          </h2>
        </div>
        <span
          className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-md border shrink-0 tabular-nums ${tokens.headerBadgeBg} ${tokens.headerBadgeText} ${tokens.headerBadgeBorder}`}
        >
          {stepIndex + 1} / {totalSteps}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${tokens.progressBarFill}`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Horizontal Mature Light Excel Stepper Bar used when `layout="compact"`
 * (e.g. inside a 5-column split-view card such as Sortie & Entrée Rapide).
 */
const CompactHorizontalStepper: React.FC = () => {
  const { profile, stepIndex, totalSteps, goToStep, themeColor } = useWizard();
  const tokens = WIZARD_THEME_TOKENS[themeColor];
  const progressPercentage =
    totalSteps > 0 ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 100;

  return (
    <div className="bg-slate-50/90 border-b border-slate-200/90 px-4 py-3 shrink-0 select-none">
      {/* Horizontal Step Pills */}
      <div className="grid grid-cols-3 gap-2">
        {profile.steps.map((step, idx) => {
          const isActive = idx === stepIndex;
          const isCompleted = idx < stepIndex;
          const isClickable = idx < stepIndex;
          const StepIcon = step.icon;
          const stepNumberCode = String(idx + 1).padStart(2, '0');

          return (
            <button
              key={step.id}
              type="button"
              disabled={!isClickable && !isActive}
              onClick={() => {
                if (isClickable) {
                  void goToStep(idx);
                }
              }}
              className={`group flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                isActive
                  ? `${tokens.activeCardBg} ${tokens.activeCardBorder} shadow-2xs`
                  : isCompleted
                    ? 'bg-white border-slate-200/80 hover:border-slate-300 cursor-pointer'
                    : 'bg-white/50 border-slate-200/50 opacity-60 cursor-default'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold shrink-0 border transition-all ${
                  isActive
                    ? `${tokens.activeCircleBorder} ${tokens.activeCircleBg} ${tokens.activeCircleText} ring-2 ring-indigo-500/15`
                    : isCompleted
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : StepIcon ? (
                  <StepIcon className="w-3 h-3" />
                ) : (
                  <span>{stepNumberCode}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 truncate">
                  {step.code || `ÉTAPE ${stepNumberCode}`}
                </div>
                <div
                  className={`text-[11px] font-bold truncate ${
                    isActive
                      ? tokens.activeTitleText
                      : isCompleted
                        ? 'text-slate-800'
                        : 'text-slate-500'
                  }`}
                >
                  {step.title}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Thin Excel Progress Bar */}
      <div className="w-full bg-slate-200/70 h-1 rounded-full overflow-hidden mt-2.5">
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${tokens.progressBarFill}`}
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
};

export interface WizardShellProps {
  profile: WizardProfile;
  initialStepIndex?: number;
  /**
   * - `'split'` (default): Desktop vertical sidebar on the left + main content on the right.
   * - `'compact'`: Horizontal top stepper bar + full-width step content (ideal for split-screen cards).
   */
  layout?: 'split' | 'compact';
  /** Optional custom height/container classes (defaults to min-h-[560px]) */
  className?: string;
}

/**
 * Inline Mature Light Excel Wizard container.
 * Can be rendered inside any page, tab, split-column card, or modal dialog.
 */
export const WizardShell: React.FC<WizardShellProps> = ({
  profile,
  initialStepIndex = 0,
  layout = 'split',
  className = 'min-h-[560px] max-h-[85vh]',
}) => {
  if (!profile?.steps || profile.steps.length === 0) {
    return (
      <div className="p-6 rounded-xl border border-amber-200 bg-amber-50/80 text-amber-900 text-xs font-mono">
        Configuration Assistant invalide : aucune étape définie dans le profil ({profile?.id || 'inconnu'}).
      </div>
    );
  }

  const isCompact = layout === 'compact';

  return (
    <WizardProvider profile={profile} initialStepIndex={initialStepIndex}>
      <div
        className={`flex ${
          isCompact ? 'flex-col' : 'flex-col lg:flex-row'
        } w-full bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200/90 ${className}`}
      >
        {!isCompact && <WizardSidebar />}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden bg-white">
          {isCompact ? <CompactHorizontalStepper /> : <MobileWizardHeader />}
          <WizardContent compact={isCompact} />
          <WizardFooter />
        </div>
      </div>
    </WizardProvider>
  );
};

export interface WizardModalProps extends WizardShellProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Ready-to-use Modal Dialog wrapper around `WizardShell`.
 * Allows any GMAO module to launch a multi-step wizard overlay when the feature flag is enabled.
 */
export const WizardModal: React.FC<WizardModalProps> = ({
  isOpen,
  onClose,
  profile,
  initialStepIndex = 0,
  layout = 'split',
}) => {
  if (!isOpen) return null;

  const profileWithCancel: WizardProfile = {
    ...profile,
    onCancel: profile.onCancel ?? onClose,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={profile.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
    >
      <div className="relative w-full max-w-5xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'assistant"
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg bg-white/90 hover:bg-slate-100 border border-slate-200/90 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shadow-2xs"
        >
          <X className="w-4 h-4" />
        </button>
        <WizardShell
          profile={profileWithCancel}
          initialStepIndex={initialStepIndex}
          layout={layout}
          className="h-[82vh] max-h-[760px] shadow-2xl"
        />
      </div>
    </div>
  );
};
