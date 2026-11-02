import { describe, it, expect } from 'vitest';
import { evaluateStepValidation } from '../WizardContext';
import { resolveWizardThemeColor, WIZARD_MODULE_THEME_MAP } from '../wizardThemeTokens';

describe('Wizard Engine Validation & Module Theme Rules', () => {
  describe('evaluateStepValidation (sync/async step guard normalization)', () => {
    it('allows navigation and clears banner when result is undefined or true', () => {
      expect(evaluateStepValidation(undefined)).toEqual({
        canProceed: true,
        banner: null,
      });
      expect(evaluateStepValidation(true)).toEqual({
        canProceed: true,
        banner: null,
      });
    });

    it('blocks navigation with critical French default message when result is false', () => {
      const res = evaluateStepValidation(false);
      expect(res.canProceed).toBe(false);
      expect(res.banner).toEqual({
        valid: false,
        message: 'Veuillez vérifier les champs requis avant de continuer.',
        level: 'critical',
      });
    });

    it('blocks navigation when a non-empty error string is returned (e.g. TabPlanBuilder)', () => {
      const res = evaluateStepValidation('Veuillez sélectionner une machine active.');
      expect(res.canProceed).toBe(false);
      expect(res.banner).toEqual({
        valid: false,
        message: 'Veuillez sélectionner une machine active.',
        level: 'critical',
      });
    });

    it('allows navigation when an empty string is returned', () => {
      expect(evaluateStepValidation('   ')).toEqual({
        canProceed: true,
        banner: null,
      });
    });

    it('handles canonical { valid: false, message, level } objects (SortieRapideView)', () => {
      const res = evaluateStepValidation({
        valid: false,
        message: 'Stock insuffisant pour [PDR-001].',
        level: 'critical',
      });
      expect(res.canProceed).toBe(false);
      expect(res.banner).toEqual({
        valid: false,
        message: 'Stock insuffisant pour [PDR-001].',
        level: 'critical',
      });
    });

    it('handles legacy alias { isValid: false, severity, message } objects (AddMachineModal & InterventionLiveTab)', () => {
      const res = evaluateStepValidation({
        isValid: false,
        severity: 'critical',
        message: "Veuillez définir le code matricule de l'équipement (Col B).",
      });
      expect(res.canProceed).toBe(false);
      expect(res.banner).toEqual({
        valid: false,
        message: "Veuillez définir le code matricule de l'équipement (Col B).",
        level: 'critical',
      });
    });

    it('preserves non-blocking operational warnings when valid/isValid is true and level/severity is warning', () => {
      const res = evaluateStepValidation({
        isValid: true,
        severity: 'warning',
        message: 'Attention : la quantité saisie dépasse le stock disponible.',
      });
      expect(res.canProceed).toBe(true);
      expect(res.banner).toEqual({
        valid: true,
        message: 'Attention : la quantité saisie dépasse le stock disponible.',
        level: 'warning',
      });
    });
  });

  describe('resolveWizardThemeColor (strict parent module color mapping)', () => {
    it('enforces canonical module theme colors when moduleKey is provided', () => {
      expect(WIZARD_MODULE_THEME_MAP.machines_onboarding).toBe('emerald');
      expect(WIZARD_MODULE_THEME_MAP.stock_rapid_movement).toBe('teal');
      expect(WIZARD_MODULE_THEME_MAP.corrective_bt).toBe('amber');
      expect(WIZARD_MODULE_THEME_MAP.preventive_plan).toBe('indigo');

      // moduleKey takes precedence over ad-hoc themeColor overrides
      expect(resolveWizardThemeColor('purple', 'corrective_bt')).toBe('amber');
      expect(resolveWizardThemeColor('indigo', 'stock_rapid_movement')).toBe('teal');
      expect(resolveWizardThemeColor('teal', 'machines_onboarding')).toBe('emerald');
      expect(resolveWizardThemeColor('emerald', 'preventive_plan')).toBe('indigo');
    });

    it('falls back to explicit themeColor or emerald when moduleKey is omitted', () => {
      expect(resolveWizardThemeColor('blue')).toBe('blue');
      expect(resolveWizardThemeColor(undefined)).toBe('emerald');
    });
  });
});
