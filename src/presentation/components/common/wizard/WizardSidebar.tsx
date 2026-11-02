import React from 'react';
import { Check, Layers } from 'lucide-react';
import { useWizard } from './WizardContext';
import { WIZARD_THEME_TOKENS } from './wizardThemeTokens';

export const WizardSidebar: React.FC = () => {
  const { profile, themeColor, stepIndex, totalSteps, goToStep } = useWizard();
  const tokens = WIZARD_THEME_TOKENS[themeColor];

  const completionPct =
    totalSteps > 1 ? Math.round((stepIndex / (totalSteps - 1)) * 100) : 100;

  return (
    <aside
      aria-label="Progression de l'assistant"
      className="w-72 bg-slate-50/90 border-r border-slate-200/90 flex flex-col justify-between shrink-0 select-none hidden lg:flex"
    >
      {/* Top Section: Header + Vertical Timeline Stepper */}
      <div className="p-5 overflow-y-auto flex-1">
        {/* Excel-style Header Block */}
        <div className="mb-5 pb-4 border-b border-slate-200/80">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${tokens.headerBadgeBg} ${tokens.headerBadgeText} ${tokens.headerBadgeBorder}`}
            >
              <Layers className="w-3 h-3" />
              {profile.code || 'ASSISTANT GMAO'}
            </span>
            <span className="text-[10px] font-mono font-semibold text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200/80">
              {totalSteps} ÉTAPES
            </span>
          </div>
          <h2 className="text-sm font-black text-slate-900 tracking-tight leading-snug">
            {profile.title}
          </h2>
          {(profile.description || profile.subtitle) && (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {profile.description || profile.subtitle}
            </p>
          )}
        </div>

        {/* Vertical Timeline Stepper */}
        <div className="relative pl-1">
          {/* Continuous Vertical Spine */}
          {totalSteps > 1 && (
            <div
              aria-hidden="true"
              className="absolute top-5 bottom-6 left-[19px] w-[2px] bg-slate-200/90 z-0"
            />
          )}

          <div className="space-y-2 relative z-10">
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
                  className={`w-full text-left group flex items-start gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                    isActive
                      ? `${tokens.activeCardBg} ${tokens.activeCardBorder} shadow-2xs`
                      : isCompleted
                        ? 'bg-white/80 border-slate-200/70 hover:bg-white hover:border-slate-300 cursor-pointer'
                        : isClickable
                          ? 'bg-transparent border-transparent hover:bg-white/60 hover:border-slate-200/60 opacity-80 cursor-pointer'
                          : 'bg-transparent border-transparent opacity-55 cursor-default'
                  }`}
                >
                  {/* Step Node Circle */}
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold transition-all duration-200 shrink-0 border-2 mt-0.5 ${
                      isActive
                        ? `${tokens.activeCircleBorder} ${tokens.activeCircleBg} ${tokens.activeCircleText} ${tokens.activeHalo} scale-105`
                        : isCompleted
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                          : 'border-slate-300 bg-white text-slate-400'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    ) : StepIcon ? (
                      <StepIcon className="w-3.5 h-3.5" />
                    ) : (
                      <span>{stepNumberCode}</span>
                    )}
                  </div>

                  {/* Step Metadata */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        {step.code || `ÉTAPE ${stepNumberCode}`}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {step.optional ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase bg-slate-100 text-slate-500 border border-slate-200/90">
                            Optionnel
                          </span>
                        ) : step.badge ? (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-white text-slate-600 border border-slate-200/80">
                            {step.badge}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p
                      className={`text-xs font-bold tracking-tight truncate mt-0.5 transition-colors ${
                        isActive
                          ? tokens.activeTitleText
                          : isCompleted
                            ? 'text-slate-800 group-hover:text-slate-950'
                            : 'text-slate-500'
                      }`}
                    >
                      {step.title}
                    </p>

                    {(step.description || step.subtitle) && (
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">
                        {step.description || step.subtitle}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Light Excel Progress Ledger Footer */}
      <div className="p-4 bg-white/90 border-t border-slate-200/90">
        <div className="flex items-center justify-between text-[11px] mb-1.5">
          <span className="font-semibold text-slate-600">Avancement global</span>
          <span className="font-mono font-bold text-slate-800 tabular-nums">
            {stepIndex + 1}/{totalSteps} ({completionPct}%)
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
          <div
            className={`h-full transition-all duration-300 rounded-full ${tokens.progressBarFill}`}
            style={{ width: `${Math.max(8, completionPct)}%` }}
          />
        </div>
      </div>
    </aside>
  );
};
