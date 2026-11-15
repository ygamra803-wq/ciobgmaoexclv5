import { Logger } from '../core/logger/LoggerService';
import { storageService } from './storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';

/**
 * Reads corrective maintenance collections from canonical SSOT storage.
 * Direct static seed imports are disabled per AGENTS.md §1.2 (Zero Silent Seed Reinjection).
 * Demo/seed loading must pass exclusively through DataGateway.
 */
export async function loadBaselineCorrectiveData() {
  try {
    const interventions = storageService.getItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS);
    const actionsByPanne = storageService.getItem(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE);
    const panneCategories = storageService.getItem(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES);
    const travauxAFaire = storageService.getItem(STORAGE_KEYS.CORRECTIVE_TRAVAUX);
    const intervenants = storageService.getItem(STORAGE_KEYS.CORRECTIVE_INTERVENANTS);

    return {
      interventions: Array.isArray(interventions) ? interventions : [],
      actionsByPanne: actionsByPanne && typeof actionsByPanne === 'object' ? actionsByPanne : {},
      panneCategories: panneCategories && typeof panneCategories === 'object' ? panneCategories : {},
      travauxAFaire: Array.isArray(travauxAFaire) ? travauxAFaire : [],
      intervenants: Array.isArray(intervenants) ? intervenants : [],
    };
  } catch (err) {
    Logger.warn('Error in loadBaselineCorrectiveData:', err);
    return {
      interventions: [],
      actionsByPanne: {},
      panneCategories: {},
      travauxAFaire: [],
      intervenants: [],
    };
  }
}
