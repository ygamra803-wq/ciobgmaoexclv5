import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Mature Light Excel theme accents supported across CIOB GMAO v4 modules.
 */
export type WizardThemeColor =
  | 'emerald'
  | 'indigo'
  | 'blue'
  | 'amber'
  | 'purple'
  | 'teal';

/**
 * Standard result returned by a step's synchronous or asynchronous `validate()` guard.
 * - `valid: false` blocks navigation to the next step and surfaces the banner in WizardFooter.
 * - `level: 'warning'` renders an Amber operational notice; `'critical'` (default) renders a Rose blocker.
 */
export interface ValidationResult {
  valid?: boolean;
  isValid?: boolean;
  message?: string;
  level?: 'warning' | 'critical';
  severity?: 'warning' | 'critical';
}

export type StepValidationReturn =
  | ValidationResult
  | boolean
  | string;

export interface StepValidationContext {
  /** 'live' when triggered reactively via validateOn: 'always', 'submit' when triggered by Suivant/Terminer */
  mode: 'live' | 'submit';
}

/**
 * Definition of a single step inside a Profile-Driven Wizard.
 */
export interface WizardStep {
  /** Unique step identifier within the profile */
  id: string;
  /** Optional short monospace reference code (e.g. "ETAPE-01" or "REF-BOM") */
  code?: string;
  /** Step title shown in sidebar timeline and mobile header */
  title: string;
  /** Concise subtitle/description shown under the title in the sidebar */
  description?: string;
  /** Alias for description */
  subtitle?: string;
  /** Optional badge label (e.g. "Obligatoire", "Optionnel", "Auto") */
  badge?: string;
  /** React node rendered when this step is active */
  component?: ReactNode;
  /** Alias for component */
  content?: ReactNode;
  /** Optional Lucide icon component for the step */
  icon?: LucideIcon;
  /** Optional mark indicating this step is non-mandatory */
  optional?: boolean;
  /** When to run validation for this step ('next' by default, or 'always' on mount/change) */
  validateOn?: 'next' | 'always';
  /**
   * Guard executed when the user clicks "Suivant"/"Terminer" (mode='submit')
   * or reactively on state change when `validateOn === 'always'` (mode='live').
   * Supports both synchronous and async validation.
   */
  validate?: (
    context?: StepValidationContext
  ) => StepValidationReturn | Promise<StepValidationReturn>;
}

/**
 * Registered GMAO modules that can individually enable or disable Wizard mode.
 */
export type WizardModuleKey =
  | 'global'
  | 'machines_onboarding'
  | 'preventive_plan'
  | 'corrective_di'
  | 'corrective_bt'
  | 'stock_article'
  | 'stock_rapid_movement'
  | 'entrepot_component';

/**
 * Complete declarative configuration for a multi-step GMAO workflow.
 */
export interface WizardProfile {
  /** Unique profile identifier (e.g. "machine-onboarding-v1") */
  id: string;
  /** Optional canonical module key used to enforce module themeColor consistency */
  moduleKey?: WizardModuleKey;
  /** Optional Excel/GMAO reference code displayed in the sidebar badge (e.g. "WIZ-MAC-01") */
  code?: string;
  /** Main title of the wizard shown in the sidebar header */
  title: string;
  /** Optional description explaining the workflow goal */
  description?: string;
  /** Alias for description */
  subtitle?: string;
  /** Module accent color matching the parent L1/L2 page (defaults to moduleKey mapping or 'emerald') */
  themeColor?: WizardThemeColor;
  /** Default validation timing for steps in this profile ('next' by default) */
  validateOn?: 'next' | 'always';
  /** Custom label for the final submission button (defaults to "Valider & Enregistrer") */
  finishLabel?: string;
  /** Alias for finishLabel */
  submitLabel?: string;
  /** Custom label for the cancel button (defaults to "Annuler") */
  cancelLabel?: string;
  /** Ordered list of steps */
  steps: WizardStep[];
  /** Callback fired after the final step passes validation. Return `false` to abort reset and stay on the final step. */
  onFinish?: () => Promise<boolean | void> | boolean | void;
  /** Alias for onFinish. Return `false` to abort reset and stay on the final step. */
  onComplete?: () => Promise<boolean | void> | boolean | void;
  /** Optional callback fired when the user cancels/closes the wizard */
  onCancel?: () => void;
}

export type WizardFeatureFlagsState = Record<WizardModuleKey, boolean>;
