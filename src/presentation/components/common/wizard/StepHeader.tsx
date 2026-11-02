import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { useWizard } from './WizardContext';
import { WIZARD_THEME_TOKENS } from './wizardThemeTokens';

export interface StepHeaderProps {
  /** Step main title */
  title: string;
  /** Detailed guidance text for the operator */
  description?: string;
  /** Optional Lucide icon displayed in the Light Excel icon container */
  icon?: LucideIcon;
  /** Optional custom badge code (defaults to "ÉTAPE X SUR Y") */
  badgeText?: string;
  /** Optional right-side slot for contextual actions or Excel formula indicators */
  rightSlot?: React.ReactNode;
}

/**
 * Standardized Mature Light Excel header placed at the top of individual wizard step views.
 */
export const StepHeader: React.FC<StepHeaderProps> = ({
  title,
  description,
  icon: Icon,
  badgeText,
  rightSlot,
}) => {
  const { stepIndex, totalSteps, themeColor, currentStep } = useWizard();
  const tokens = WIZARD_THEME_TOKENS[themeColor];

  const ResolvedIcon = Icon ?? currentStep?.icon;
  const resolvedBadge =
    badgeText ??
    currentStep?.code ??
    `ÉTAPE ${String(stepIndex + 1).padStart(2, '0')} / ${String(totalSteps).padStart(2, '0')}`;

  return (
    <div className="mb-5 pb-3.5 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3">
        {ResolvedIcon && (
          <div
            className={`w-10 h-10 rounded-xl border ${tokens.stepIconBoxBg} ${tokens.stepIconBoxBorder} flex items-center justify-center shrink-0 shadow-2xs`}
          >
            <ResolvedIcon className={`w-4.5 h-4.5 ${tokens.stepIconColor}`} />
          </div>
        )}
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${tokens.headerBadgeBg} ${tokens.headerBadgeText} ${tokens.headerBadgeBorder}`}
            >
              {resolvedBadge}
            </span>
            {currentStep?.optional ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/90">
                Optionnel
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-white text-slate-500 border border-slate-200/80">
                Requis
              </span>
            )}
          </div>
          <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>

      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
};
