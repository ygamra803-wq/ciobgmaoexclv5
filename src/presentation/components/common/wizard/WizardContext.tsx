import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { WizardProfile, WizardStep, ValidationResult, WizardThemeColor } from './wizard.types';

export interface WizardContextValue {
  profile: WizardProfile;
  themeColor: WizardThemeColor;
  stepIndex: number;
  totalSteps: number;
  currentStep: WizardStep | undefined;
  isFirst: boolean;
  isLast: boolean;
  isSubmitting: boolean;
  isValidating: boolean;
  direction: number;
  validationResult: ValidationResult | null;
  clearValidation: () => void;
  next: () => Promise<boolean>;
  back: () => void;
  goToStep: (targetIndex: number) => Promise<boolean>;
  handleFinish: () => Promise<boolean>;
}

const WizardContext = createContext<WizardContextValue | null>(null);

export interface WizardProviderProps {
  profile: WizardProfile;
  initialStepIndex?: number;
  children: React.ReactNode;
}

export const WizardProvider: React.FC<WizardProviderProps> = ({
  profile,
  initialStepIndex = 0,
  children,
}) => {
  const totalSteps = profile.steps.length;
  const safeInitialIndex = Math.min(Math.max(0, initialStepIndex), Math.max(0, totalSteps - 1));

  const [stepIndex, setStepIndex] = useState<number>(safeInitialIndex);
  const [direction, setDirection] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const currentStep = profile.steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = totalSteps > 0 && stepIndex === totalSteps - 1;
  const themeColor: WizardThemeColor = profile.themeColor ?? 'emerald';

  const clearValidation = useCallback(() => {
    setValidationResult(null);
  }, []);

  const runCurrentStepValidation = useCallback(async (): Promise<boolean> => {
    if (!currentStep?.validate) {
      setValidationResult(null);
      return true;
    }

    try {
      setIsValidating(true);
      const rawResult = await Promise.resolve(currentStep.validate());
      if (typeof rawResult === 'boolean') {
        if (!rawResult) {
          setValidationResult({
            valid: false,
            message: 'Veuillez vérifier les champs requis avant de continuer.',
            level: 'critical',
          });
          return false;
        }
        setValidationResult(null);
        return true;
      }

      if (typeof rawResult === 'string') {
        setValidationResult({
          valid: false,
          message: rawResult,
          level: 'critical',
        });
        return false;
      }

      const isStepValid = rawResult.valid ?? rawResult.isValid ?? true;
      const resolvedLevel = rawResult.level ?? rawResult.severity ?? 'critical';

      if (!isStepValid) {
        setValidationResult({
          valid: false,
          message: rawResult.message || 'Veuillez vérifier les champs requis avant de continuer.',
          level: resolvedLevel,
        });
        return false;
      }
      setValidationResult(null);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Une erreur est survenue lors de la validation de cette étape.';
      setValidationResult({
        valid: false,
        message,
        level: 'critical',
      });
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [currentStep]);

  const next = useCallback(async (): Promise<boolean> => {
    if (isLast || isSubmitting || isValidating) return false;
    const isValid = await runCurrentStepValidation();
    if (!isValid) return false;

    setDirection(1);
    setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
    return true;
  }, [isLast, isSubmitting, isValidating, runCurrentStepValidation, totalSteps]);

  const back = useCallback(() => {
    if (isFirst || isSubmitting || isValidating) return;
    setValidationResult(null);
    setDirection(-1);
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [isFirst, isSubmitting, isValidating]);

  const goToStep = useCallback(
    async (targetIndex: number): Promise<boolean> => {
      if (
        targetIndex < 0 ||
        targetIndex >= totalSteps ||
        targetIndex === stepIndex ||
        isSubmitting ||
        isValidating
      ) {
        return false;
      }

      // Moving backwards is always allowed without blocking on current incomplete fields
      if (targetIndex < stepIndex) {
        setValidationResult(null);
        setDirection(-1);
        setStepIndex(targetIndex);
        return true;
      }

      // Moving forward validates the current step first
      const isValid = await runCurrentStepValidation();
      if (!isValid) return false;

      setDirection(1);
      setStepIndex(targetIndex);
      return true;
    },
    [totalSteps, stepIndex, isSubmitting, isValidating, runCurrentStepValidation]
  );

  const handleFinish = useCallback(async (): Promise<boolean> => {
    if (isSubmitting || isValidating) return false;
    const isValid = await runCurrentStepValidation();
    if (!isValid) return false;

    try {
      setIsSubmitting(true);
      const finishFn = profile.onFinish ?? profile.onComplete;
      if (finishFn) {
        await Promise.resolve(finishFn());
      }
      setValidationResult(null);
      setDirection(-1);
      setStepIndex(0);
      return true;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Échec de l'enregistrement final. Veuillez réessayer.";
      setValidationResult({
        valid: false,
        message,
        level: 'critical',
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, isValidating, runCurrentStepValidation, profile]);

  const contextValue = useMemo<WizardContextValue>(
    () => ({
      profile,
      themeColor,
      stepIndex,
      totalSteps,
      currentStep,
      isFirst,
      isLast,
      isSubmitting,
      isValidating,
      direction,
      validationResult,
      clearValidation,
      next,
      back,
      goToStep,
      handleFinish,
    }),
    [
      profile,
      themeColor,
      stepIndex,
      totalSteps,
      currentStep,
      isFirst,
      isLast,
      isSubmitting,
      isValidating,
      direction,
      validationResult,
      clearValidation,
      next,
      back,
      goToStep,
      handleFinish,
    ]
  );

  return <WizardContext.Provider value={contextValue}>{children}</WizardContext.Provider>;
};

export function useWizard(): WizardContextValue {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within a <WizardProvider>.');
  }
  return context;
}
