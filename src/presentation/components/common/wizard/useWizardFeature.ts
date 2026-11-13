import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../../../../infrastructure/persistence/storageKeys';
import { Logger } from '../../../../core/logger/LoggerService';
import type { WizardFeatureFlagsState, WizardModuleKey } from './wizard.types';

/**
 * Default Wizard Feature Flag states.
 * All modules default to `false` so existing GMAO workflows remain untouched
 * until explicitly enabled globally or per-module.
 */
export const DEFAULT_WIZARD_FEATURE_FLAGS: WizardFeatureFlagsState = {
  global: false,
  machines_onboarding: false,
  preventive_plan: false,
  corrective_di: false,
  corrective_bt: false,
  stock_article: false,
  stock_rapid_movement: false,
  entrepot_component: false,
};

const WIZARD_FLAGS_EVENT = 'gmao:wizard-feature-flags-changed';

export function readWizardFeatureFlags(): WizardFeatureFlagsState {
  if (typeof window === 'undefined') return { ...DEFAULT_WIZARD_FEATURE_FLAGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.WIZARD_FEATURE_FLAGS);
    if (!raw) return { ...DEFAULT_WIZARD_FEATURE_FLAGS };
    const parsed = JSON.parse(raw) as Partial<WizardFeatureFlagsState>;
    return {
      ...DEFAULT_WIZARD_FEATURE_FLAGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_WIZARD_FEATURE_FLAGS };
  }
}

export function writeWizardFeatureFlags(nextFlags: WizardFeatureFlagsState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STORAGE_KEYS.WIZARD_FEATURE_FLAGS,
      JSON.stringify(nextFlags)
    );
    window.dispatchEvent(new CustomEvent(WIZARD_FLAGS_EVENT, { detail: nextFlags }));
  } catch (err) {
    Logger.error('[GMAO WizardFeatureFlags] Failed to persist flags:', err);
  }
}

/**
 * Hook to inspect and toggle the Wizard Engine feature flag globally or for a specific GMAO module.
 *
 * @param moduleKey Optional module identifier (e.g. `'machines_onboarding'`).
 *                  When provided, `isEnabled` is true if either `global` OR `flags[moduleKey]` is enabled.
 */
export function useWizardFeature(moduleKey: WizardModuleKey = 'global') {
  const [flags, setFlags] = useState<WizardFeatureFlagsState>(() =>
    readWizardFeatureFlags()
  );

  useEffect(() => {
    const handleSync = () => {
      setFlags(readWizardFeatureFlags());
    };
    window.addEventListener(WIZARD_FLAGS_EVENT, handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener(WIZARD_FLAGS_EVENT, handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const isEnabled =
    moduleKey === 'global'
      ? Boolean(flags.global)
      : Boolean(flags.global || flags[moduleKey]);

  const setModuleEnabled = useCallback(
    (targetModule: WizardModuleKey, enabled: boolean) => {
      const current = readWizardFeatureFlags();
      const updated: WizardFeatureFlagsState = {
        ...current,
        [targetModule]: enabled,
        ...(targetModule !== 'global' && !enabled ? { global: false } : {}),
      };
      writeWizardFeatureFlags(updated);
      setFlags(updated);
    },
    []
  );

  const setMode = useCallback(
    (enabled: boolean) => {
      setModuleEnabled(moduleKey, enabled);
    },
    [moduleKey, setModuleEnabled]
  );

  const toggleModule = useCallback((targetModule: WizardModuleKey = moduleKey) => {
    const current = readWizardFeatureFlags();
    const nextVal = !current[targetModule];
    const updated: WizardFeatureFlagsState = {
      ...current,
      [targetModule]: nextVal,
      ...(targetModule !== 'global' && !nextVal ? { global: false } : {}),
    };
    writeWizardFeatureFlags(updated);
    setFlags(updated);
  }, [moduleKey]);

  const resetAllFlags = useCallback(() => {
    writeWizardFeatureFlags({ ...DEFAULT_WIZARD_FEATURE_FLAGS });
    setFlags({ ...DEFAULT_WIZARD_FEATURE_FLAGS });
  }, []);

  return {
    /** Whether Wizard mode is active for the requested module (or globally) */
    isEnabled,
    /** Complete dictionary of all module flags */
    flags,
    /** Enable or disable the active moduleKey directly */
    setEnabled: setMode,
    /** Alias for setEnabled */
    setMode,
    /** Enable or disable a specific module (or 'global') */
    setModuleEnabled,
    /** Toggle the current or specified module flag */
    toggleModule,
    /** Reset all wizard flags to disabled (`false`) */
    resetAllFlags,
  };
}
