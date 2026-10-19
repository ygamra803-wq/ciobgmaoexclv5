// src/utils/baselineCorrective.js
import { Logger } from '../core/logger/LoggerService';
import seedInterventions from '../data/corrective/seedCorrectiveInterventions.json';
import seedActionsByPanne from '../data/corrective/seedActionsByPanne.json';
import seedPanneByCategory from '../data/corrective/seedPanneByCategory.json';
import seedTravailAFaire from '../data/corrective/seedTravailAFaire.json';
import seedIntervenants from '../data/corrective/seedIntervenants.json';

/**
 * Synchronously / directly provides baseline corrective maintenance data
 * Guarantees 100% offline availability and eliminates flaky fetch calls.
 */
export async function loadBaselineCorrectiveData() {
  try {
    const rawInterventions = Array.isArray(seedInterventions) ? seedInterventions : [];
    const interventions = rawInterventions.map((item: any) => ({
      ...item,
      id: item.id || `CORR-${Math.random().toString(36).slice(2, 7)}`,
      code_machine: item.code_machine || item.codeMachine || 'DET-05',
      num_bt: item.num_bt || item.numeroBT || null,
      date_demande: item.date_demande || item.demandeDate || (item.debut ? String(item.debut).split('T')[0] : null) || new Date().toISOString().split('T')[0],
      intervenant: item.intervenant || 'Mhammed',
      type_panne: item.type_panne || item.typePanne || 'M',
      anomalie: item.anomalie || 'Intervention corrective',
      travail_a_faire: item.travail_a_faire || item.travailAFaire || 'Maintenance',
      statut: item.statut || (item.numeroBT || item.num_bt ? 'CLOTURE' : 'DEMANDE'),
    }));

    return {
      interventions,
      actionsByPanne: seedActionsByPanne && typeof seedActionsByPanne === 'object' ? seedActionsByPanne : {},
      panneCategories: seedPanneByCategory && typeof seedPanneByCategory === 'object' ? seedPanneByCategory : {},
      travauxAFaire: Array.isArray(seedTravailAFaire) ? seedTravailAFaire : [],
      intervenants: Array.isArray(seedIntervenants) ? seedIntervenants : [],
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
