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

  describe('validateOn: always (live vs submit context differentiation)', () => {
    it('defers empty-ref blocking in live mode while enforcing stock checks immediately', () => {
      const mockStepValidate = (
        items: Array<{ ref: string; quantite: number; stock: number }>,
        mode: 'live' | 'submit'
      ) => {
        for (const item of items) {
          if (!item.ref) {
            if (mode !== 'live') {
              return { valid: false, message: 'Sélectionnez un article.', level: 'critical' as const };
            }
            continue;
          }
          if (item.quantite > item.stock) {
            return { valid: false, message: 'Stock insuffisant.', level: 'critical' as const };
          }
          if (item.quantite === item.stock && item.stock > 0) {
            return { valid: true, message: 'Stock épuisé après sortie.', level: 'warning' as const };
          }
        }
        return { valid: true };
      };

      // 1. Entering Step 2 with blank ref in 'live' mode does not flash premature red error
      expect(evaluateStepValidation(mockStepValidate([{ ref: '', quantite: 1, stock: 5 }], 'live'))).toEqual({
        canProceed: true,
        banner: null,
      });

      // 2. Clicking 'Suivant' ('submit' mode) with blank ref blocks navigation
      expect(
        evaluateStepValidation(mockStepValidate([{ ref: '', quantite: 1, stock: 5 }], 'submit')).canProceed
      ).toBe(false);

      // 3. Selecting an item that exhausts stock surfaces a live warning banner without blocking
      const liveWarning = evaluateStepValidation(
        mockStepValidate([{ ref: 'PDR-01', quantite: 5, stock: 5 }], 'live')
      );
      expect(liveWarning.canProceed).toBe(true);
      expect(liveWarning.banner?.level).toBe('warning');

      // 4. Exceeding stock in 'live' mode immediately surfaces a critical banner
      const liveOverflow = evaluateStepValidation(
        mockStepValidate([{ ref: 'PDR-01', quantite: 6, stock: 5 }], 'live')
      );
      expect(liveOverflow.canProceed).toBe(false);
      expect(liveOverflow.banner?.level).toBe('critical');
    });
  });
});
