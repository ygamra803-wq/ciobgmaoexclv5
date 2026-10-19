import { STORAGE_KEYS, LEGACY_KEY_MAP, OBSOLETE_FLAG_KEYS } from './storageKeys';
import { storageService } from '../../utils/storageService';
import { Logger } from '../../core/logger/LoggerService';

/**
 * One-time storage migration from legacy versioned keys to canonical STORAGE_KEYS.
 * Rules (Non-Negotiable):
 * 1. Runs once on startup (controlled by STORAGE_KEYS.STORAGE_MIGRATED = 'gmao_storage_migrated_v1').
 * 2. For each entry in LEGACY_KEY_MAP: if canonical key is empty/missing and legacy key has valid data, copy to canonical.
 * 3. Never overwrite a non-empty canonical key with legacy data.
 * 4. Delete legacy keys after migration to free quota and eliminate split-brain reads.
 * 5. NEVER load or inject seed data here.
 */
export function migrateStorageOnce() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { migrated: false, reason: 'no_local_storage' };
  }

  try {
    const alreadyMigrated = storageService.getItem(STORAGE_KEYS.STORAGE_MIGRATED);
    if (alreadyMigrated === true || alreadyMigrated === 'true') {
      return { migrated: false, reason: 'already_migrated' };
    }

    const migratedPairs = [];

    for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_KEY_MAP)) {
      if (legacyKey === canonicalKey) continue;

      const currentCanonical = storageService.getItem(canonicalKey);
      const isCanonicalPopulated =
        (Array.isArray(currentCanonical) && currentCanonical.length > 0) ||
        (currentCanonical &&
          typeof currentCanonical === 'object' &&
          !Array.isArray(currentCanonical) &&
          Object.keys(currentCanonical).length > 0);

      const legacyValue = storageService.getItem(legacyKey);
      const isLegacyPopulated =
        (Array.isArray(legacyValue) && legacyValue.length > 0) ||
        (legacyValue &&
          typeof legacyValue === 'object' &&
          !Array.isArray(legacyValue) &&
          Object.keys(legacyValue).length > 0);

      if (!isCanonicalPopulated && isLegacyPopulated) {
        storageService.setItem(canonicalKey, legacyValue);
        migratedPairs.push({ from: legacyKey, to: canonicalKey });
      }

      // Remove legacy key after checking/copying
      if (localStorage.getItem(legacyKey) !== null) {
        storageService.removeItem(legacyKey);
      }
    }

    // Clean up obsolete initialization flags
    for (const flagKey of OBSOLETE_FLAG_KEYS) {
      if (localStorage.getItem(flagKey) !== null) {
        storageService.removeItem(flagKey);
      }
    }

    // Migrate legacy start_mode ('demo' / 'empty') if DEMO_MODE is not explicitly set yet
    const existingDemoFlag = storageService.getItem(STORAGE_KEYS.DEMO_MODE);
    if (existingDemoFlag === null || existingDemoFlag === undefined) {
      const legacyStartMode = localStorage.getItem('gmao_start_mode');
      if (legacyStartMode === 'empty') {
        storageService.setItem(STORAGE_KEYS.DEMO_MODE, false);
      } else if (legacyStartMode === 'demo') {
        storageService.setItem(STORAGE_KEYS.DEMO_MODE, true);
      }
    }

    storageService.setItem(STORAGE_KEYS.STORAGE_MIGRATED, 'true');

    if (migratedPairs.length > 0) {
      Logger.info(
        `[migrateStorageOnce] Migrated ${migratedPairs.length} legacy key(s) to canonical SSOT keys.`,
        migratedPairs,
        'migrateStorage'
      );
    }

    return { migrated: true, migratedPairs };
  } catch (err) {
    Logger.warn('[migrateStorageOnce] Migration warning:', err, 'migrateStorage');
    return { migrated: false, error: err };
  }
}

const SNAPSHOT_FIELD_MAP = {
  [STORAGE_KEYS.STOCK_TYPES]: 'types',
  [STORAGE_KEYS.DESIGNATIONS]: 'designations',
  [STORAGE_KEYS.RAW_STOCK]: 'rawStock',
  [STORAGE_KEYS.FAMILIES]: 'families',
  [STORAGE_KEYS.TEMPLATES]: 'templates',
  [STORAGE_KEYS.BLUEPRINTS]: 'blueprints',
  [STORAGE_KEYS.MACHINES]: 'machines',
  [STORAGE_KEYS.ZONES]: 'zones',
  [STORAGE_KEYS.WAREHOUSE_ITEMS]: 'warehouseItems',
  [STORAGE_KEYS.ENTREPOT_COMPONENTS]: 'entrepotComponents',
  [STORAGE_KEYS.COMP_GROUPS]: 'compGroups',
  [STORAGE_KEYS.COMP_FAMILIES]: 'compFamilies',
  [STORAGE_KEYS.COMP_TEMPLATES]: 'compTemplates',
  [STORAGE_KEYS.PART_TYPES]: 'partTypes',
  [STORAGE_KEYS.PART_DESIGNATIONS]: 'partDesignations',
  [STORAGE_KEYS.PERSONNEL]: 'users',
  [STORAGE_KEYS.TECHNICIANS]: 'technicians',
  [STORAGE_KEYS.OPERATIONS]: 'operations',
  [STORAGE_KEYS.MOUVEMENTS]: 'mouvements',
  [STORAGE_KEYS.PREVENTIVE_TASKS]: 'preventiveTasks',
  [STORAGE_KEYS.PREVENTIVE_ACTIONS]: 'preventiveActions',
  [STORAGE_KEYS.PREVENTIVE_GUIDES]: 'preventiveGuides',
  [STORAGE_KEYS.PREVENTIVE_PLANS]: 'preventivePlans',
  [STORAGE_KEYS.SORTIE_EXTERNE]: 'sortiesExterne',
  [STORAGE_KEYS.CORRECTIVE_INTERVENTIONS]: 'correctiveInterventions',
  [STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE]: 'correctiveActionsByPanne',
  [STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES]: 'correctivePanneCategories',
  [STORAGE_KEYS.CORRECTIVE_TRAVAUX]: 'correctiveTravauxAFaire',
  [STORAGE_KEYS.CORRECTIVE_INTERVENANTS]: 'correctiveIntervenants',
};

/**
 * Unified collection loader for all use*SubState hooks, Zustand store, and services.
 * Strictly obeys SSOT rules with 4-Stage Self-Healing Hydration:
 * - Default for a new installation = EMPTY ([] or {}).
 * - Stage 1: Canonical key in storageService (authoritative user data if non-empty, or authoritative empty array/object when not in explicit Demo Mode).
 * - Stage 2: Legacy keys in LEGACY_KEY_MAP that map to this canonicalKey.
 * - Stage 3: Unified FULL_STATE_SNAPSHOT ('gmao_full_state_v2') recovery if individual key was evicted or missing.
 * - Stage 4: Seed data fallback ONLY when DEMO_MODE is explicitly true (demoFlag === true || demoFlag === 'true') and startMode !== 'empty' and allowDemoFallback is true.
 *
 * @param {string} canonicalKey - Key from STORAGE_KEYS
 * @param {object} options
 * @param {boolean} [options.allowDemoFallback=false] - Whether to allow returning demoSeed when DEMO_MODE is explicitly true
 * @param {Array|Object} [options.demoSeed=[]] - Seed data to return ONLY when DEMO_MODE is explicitly enabled
 * @param {Array|Object} [options.emptyDefault=[]] - Default empty value when no user data exists and DEMO_MODE is not enabled
 */
export function loadCollection(
  canonicalKey,
  { allowDemoFallback = false, demoSeed = [], emptyDefault = [] } = {}
) {
  const demoFlag = storageService.getItem(STORAGE_KEYS.DEMO_MODE);
  const startMode = storageService.getItem(STORAGE_KEYS.START_MODE);
  const isExplicitDemoMode =
    (demoFlag === true || demoFlag === 'true') && startMode !== 'empty';

  // STAGE 1: Direct Canonical Key
  const saved = storageService.getItem(canonicalKey);

  if (Array.isArray(saved)) {
    // Any non-empty user array is always authoritative.
    // An empty array [] is also authoritative unless DEMO_MODE is explicitly enabled and we need to check Stage 2/3/4.
    if (saved.length > 0 || !isExplicitDemoMode || !allowDemoFallback) {
      return saved;
    }
  } else if (
    !Array.isArray(emptyDefault) &&
    saved &&
    typeof saved === 'object'
  ) {
    if (Object.keys(saved).length > 0 || !isExplicitDemoMode || !allowDemoFallback) {
      return saved;
    }
  }

  // STAGE 2: Check Legacy Keys mapped to this canonicalKey (only when not in explicit empty factory mode)
  if (startMode !== 'empty' && demoFlag !== false && demoFlag !== 'false') {
    for (const [legacyKey, mappedCanonical] of Object.entries(LEGACY_KEY_MAP)) {
      if (mappedCanonical === canonicalKey && legacyKey !== canonicalKey) {
        const legacyVal = storageService.getItem(legacyKey);
        if (Array.isArray(legacyVal) && legacyVal.length > 0) {
          storageService.setItem(canonicalKey, legacyVal);
          return legacyVal;
        }
        if (
          !Array.isArray(emptyDefault) &&
          legacyVal &&
          typeof legacyVal === 'object' &&
          !Array.isArray(legacyVal) &&
          Object.keys(legacyVal).length > 0
        ) {
          storageService.setItem(canonicalKey, legacyVal);
          return legacyVal;
        }
      }
    }
  }

  // STAGE 3: Recover from Unified FULL_STATE_SNAPSHOT if present (only when not in explicit empty mode)
  const snapshotField = SNAPSHOT_FIELD_MAP[canonicalKey];
  if (snapshotField && startMode !== 'empty' && demoFlag !== false && demoFlag !== 'false') {
    const snapshot = storageService.getItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT);
    if (snapshot && typeof snapshot === 'object') {
      const snapVal = snapshot[snapshotField];
      if (Array.isArray(snapVal) && snapVal.length > 0) {
        storageService.setItem(canonicalKey, snapVal);
        return snapVal;
      }
      if (
        !Array.isArray(emptyDefault) &&
        snapVal &&
        typeof snapVal === 'object' &&
        !Array.isArray(snapVal) &&
        Object.keys(snapVal).length > 0
      ) {
        storageService.setItem(canonicalKey, snapVal);
        return snapVal;
      }
    }
  }

  // STAGE 4: Seed Fallback ONLY if DEMO_MODE is explicitly true (after Load Demo button)
  if (allowDemoFallback && isExplicitDemoMode && demoSeed !== undefined && demoSeed !== null) {
    return demoSeed;
  }

  return Array.isArray(saved) ? saved : emptyDefault;
}
