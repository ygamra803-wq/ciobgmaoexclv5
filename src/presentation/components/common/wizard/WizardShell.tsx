import React, { useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import type { WizardProfile } from './wizard.types';
import { WizardProvider, useWizard } from './WizardContext';
import { WizardSidebar } from './WizardSidebar';
import { WizardContent } from './WizardContent';
import { WizardFooter } from './WizardFooter';
import { WIZARD_THEME_TOKENS } from './wizardThemeTokens';

/**
 * Compact responsive header visible on mobile & tablet screens (< lg)
 * when `layout === 'split'` is used.
 * Includes an interactive Step Jump selector so mobile users can jump directly
 * to completed steps without clicking "Précédent" repeatedly.
 */
const MobileWizardHeader: React.FC = () => {
  const { profile, stepIndex, totalSteps, currentStep, themeColor, goToStep, isSubmitting } =
    useWizard();
  const [isStepMenuOpen, setIsStepMenuOpen] = useState(false);
  const tokens = WIZARD_THEME_TOKENS[themeColor];
  const progressPercentage =
    totalSteps > 0 ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 100;

  return (
    <div className="lg:hidden bg-slate-50/95 border-b border-slate-200/90 px-4 py-3 shrink-0 relative">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block truncate">
            {profile.title}
          </span>
          <h2 className="text-xs sm:text-sm font-black text-slate-900 truncate">
            {currentStep?.title}
          </h2>
        </div>

        {/* Interactive Step Jump Trigger */}
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => setIsStepMenuOpen((prev) => !prev)}
          aria-expanded={isStepMenuOpen}
          aria-label="Sélectionner une étape"
          className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border shrink-0 tabular-nums cursor-pointer transition-all ${tokens.headerBadgeBg} ${tokens.headerBadgeText} ${tokens.headerBadgeBorder}`}
        >
          <span>
            {stepIndex + 1} / {totalSteps}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isStepMenuOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>

      {/* Expandable Quick Step Jump List on Mobile */}
      {isStepMenuOpen && (
        <div className="mb-2.5 p-2 rounded-xl bg-white border border-slate-200/90 shadow-lg space-y-1 z-20">
          {profile.steps.map((step, idx) => {
            const isActive = idx === stepIndex;
            const isCompleted = idx < stepIndex;
            const isClickable = idx < stepIndex || idx === stepIndex + 1;
            const stepNum = String(idx + 1).padStart(2, '0');

            return (
              <button
                key={step.id}
                type="button"
                disabled={!isClickable && !isActive}
                onClick={() => {
                  setIsStepMenuOpen(false);
                  if (isClickable) {
                    void goToStep(idx);
                  }
                }}
                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                  isActive
                    ? `${tokens.activeCardBg} ${tokens.activeTitleText} font-bold border ${tokens.activeCardBorder}`
                    : isCompleted
                      ? 'hover:bg-slate-50 text-slate-800 font-semibold cursor-pointer'
                      : isClickable
                        ? 'hover:bg-slate-50 text-slate-600 cursor-pointer'
                        : 'text-slate-400 opacity-60 cursor-default'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold shrink-0 ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isActive
                          ? `${tokens.activeCircleBg} ${tokens.activeCircleText} border ${tokens.activeCircleBorder}`
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3 h-3 stroke-[2.5]" /> : stepNum}
                  </span>
                  <span className="truncate">{step.title}</span>
                </div>
                {step.optional && (
                  <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                    Opt.
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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
 * (e.g. inside a 5-column split-view card such as Sortie & Entrée Rapide or AddMachineModal).
 */
const CompactHorizontalStepper: React.FC = () => {
  const { profile, stepIndex, totalSteps, goToStep, themeColor } = useWizard();
  const tokens = WIZARD_THEME_TOKENS[themeColor];
  const progressPercentage =
    totalSteps > 0 ? Math.round(((stepIndex + 1) / totalSteps) * 100) : 100;

  return (
    <div className="bg-slate-50/90 border-b border-slate-200/90 px-3.5 py-2.5 shrink-0 select-none">
      {/* Sleek Horizontal Step Pills */}
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, Math.min(totalSteps, 4))}, minmax(0, 1fr))`,
        }}
      >
        {profile.steps.map((step, idx) => {
          const isActive = idx === stepIndex;
          const isCompleted = idx < stepIndex;
          const isClickable = idx < stepIndex || idx === stepIndex + 1;
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
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-left transition-all min-w-0 ${
                isActive
                  ? `${tokens.activeCardBg} ${tokens.activeCardBorder} shadow-2xs`
                  : isCompleted
                    ? 'bg-white border-slate-200/80 hover:border-slate-300 cursor-pointer'
                    : isClickable
                      ? 'bg-white/70 border-slate-200/60 hover:border-slate-300/80 opacity-85 cursor-pointer'
                      : 'bg-white/40 border-slate-200/50 opacity-55 cursor-default'
              }`}
            >
              <div
                className={`w-5.5 h-5.5 rounded-md flex items-center justify-center font-mono text-[10px] font-bold shrink-0 border transition-all ${
                  isActive
                    ? `${tokens.activeCircleBorder} ${tokens.activeCircleBg} ${tokens.activeCircleText} ${tokens.activeHalo}`
                    : isCompleted
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-slate-300 bg-white text-slate-400'
                }`}
              >
                {isCompleted ? (
                  <Check className="w-3 h-3 stroke-[2.5]" />
                ) : StepIcon ? (
                  <StepIcon className="w-3 h-3" />
                ) : (
                  <span>{stepNumberCode}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 truncate">
                    {step.code || `ÉTAPE ${stepNumberCode}`}
                  </span>
                  {step.optional && (
                    <span className="text-[8px] font-mono uppercase px-1 rounded bg-slate-100 text-slate-500 shrink-0">
                      Opt
                    </span>
                  )}
                </div>
                <div
                  className={`text-[11px] font-bold truncate leading-tight ${
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
      <div className="w-full bg-slate-200/70 h-1 rounded-full overflow-hidden mt-2">
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

const WizardShellInner: React.FC<{
  isCompact: boolean;
  className: string;
  onModalClose?: () => void;
}> = ({ isCompact, className, onModalClose }) => {
  const { isSubmitting } = useWizard();

  return (
    <div className="relative w-full">
      {onModalClose && (
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            if (!isSubmitting) {
              onModalClose();
            }
          }}
          aria-label="Fermer l'assistant"
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg bg-white/90 hover:bg-slate-100 border border-slate-200/90 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      )}
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
    </div>
  );
};

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
      <WizardShellInner isCompact={isCompact} className={className} />
    </WizardProvider>
  );
};

export interface WizardModalProps extends WizardShellProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Ready-to-use Modal Dialog wrapper around `WizardShell`.
 * Guards dismissal while `isSubmitting` is active.
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

  const isCompact = layout === 'compact';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={profile.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-xs animate-fade-in"
    >
      <div className="relative w-full max-w-5xl">
        <WizardProvider profile={profileWithCancel} initialStepIndex={initialStepIndex}>
          <WizardShellInner
            isCompact={isCompact}
            className="h-[82vh] max-h-[760px] shadow-2xl"
            onModalClose={onClose}
          />
        </WizardProvider>
      </div>
    </div>
  );
};
