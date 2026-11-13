import React, { Suspense, Component, type ErrorInfo, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { useWizard } from './WizardContext';
import { StepHeader } from './StepHeader';
import { Logger } from '../../../../core/logger/LoggerService';

interface ErrorBoundaryProps {
  children: ReactNode;
  stepId: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Isolated Error Boundary per Wizard Step so a rendering fault in one step
 * never crashes the parent GMAO screen or loses prior wizard state.
 */
class StepErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.stepId !== this.props.stepId && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Logger.error('[GMAO Wizard StepErrorBoundary]', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border border-rose-200/90 bg-rose-50/70 text-rose-900 flex flex-col items-center justify-center text-center min-h-[260px] shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center mb-3">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <h3 className="text-sm font-black tracking-tight text-rose-950 mb-1">
            Erreur d&apos;affichage dans cette étape
          </h3>
          <p className="text-xs text-rose-700/90 mb-4 max-w-md font-mono">
            {this.state.error?.message || 'Une erreur inattendue est survenue.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-rose-200 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-50 transition-colors shadow-2xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Réessayer le chargement
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface WizardContentProps {
  compact?: boolean;
}

export const WizardContent: React.FC<WizardContentProps> = ({ compact = false }) => {
  const { currentStep, direction, stepIndex } = useWizard();

  if (!currentStep) return null;

  return (
    <div
      className={`flex-1 overflow-y-auto relative bg-white ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-7'
      }`}
    >
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={currentStep.id || stepIndex}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 18 : -18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction > 0 ? -18 : 18 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className={compact ? 'w-full' : 'max-w-3xl mx-auto w-full'}
        >
          <StepErrorBoundary stepId={currentStep.id}>
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center min-h-[260px] text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2 text-slate-500" />
                  <p className="text-xs font-mono uppercase tracking-wider">
                    Chargement du module...
                  </p>
                </div>
              }
            >
              {currentStep.component ? (
                currentStep.component
              ) : (
                <div className="space-y-4">
                  <StepHeader
                    title={currentStep.title}
                    description={currentStep.description || currentStep.subtitle}
                    icon={currentStep.icon}
                    badgeText={currentStep.badge || currentStep.code}
                  />
                  {currentStep.content}
                </div>
              )}
            </Suspense>
          </StepErrorBoundary>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
