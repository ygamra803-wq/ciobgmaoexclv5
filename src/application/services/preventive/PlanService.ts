import { TaskService } from './TaskService';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';

export const STORAGE_KEY_PLANS = STORAGE_KEYS.PREVENTIVE_PLANS;
export const INITIAL_PLANS = [];

export class PlanService {
  static getPlans() {
    return loadCollection(STORAGE_KEY_PLANS, {
      allowDemoFallback: true,
      demoSeed: INITIAL_PLANS,
    });
  }

  static savePlans(plans) {
    try {
      storageService.setItem(STORAGE_KEY_PLANS, plans);
    } catch {
      // storage error
    }
  }

  static deletePlan(id) {
    const current = this.getPlans();
    const filtered = current.filter(p => p.id !== id);
    this.savePlans(filtered);
    return filtered;
  }

  /**
   * Créer un plan complet et générer automatiquement toutes les tâches préventives associées
   */
  static createPlanWithTasks(planData, taskItems = []) {
    const currentPlans = this.getPlans();
    const currentTasks = TaskService.getTasks();

    const machineId = (planData.id_machine || 'MACH').trim().toUpperCase();
    const cleanMach = machineId.replace(/[^a-zA-Z0-9]/g, '');
    const zone = planData.id_zone || 'ZONE';
    const tech = planData.id_technicien || 'Technicien';
    const yearMonth = new Date().toISOString().slice(0, 7);
    const seq = String(currentPlans.length + 1).padStart(3, '0');

    const planId = planData.id || `ID-PLAN-${cleanMach}-${yearMonth}-${seq}`;
    const planCode = planData.code || `PLAN-${cleanMach}-${yearMonth}`;
    const planRef = planData.ref || `Plan-2025-${zone}-${machineId}-${planData.semaine_cible || 'S1'}`;

    const newPlan = {
      id: planId,
      code: planCode,
      ref: planRef,
      id_machine: machineId,
      nom_machine: planData.nom_machine || `Machine ${machineId}`,
      id_zone: zone,
      id_technicien: tech,
      date_creation: planData.date_creation || new Date().toISOString().split('T')[0],
      is_groupee: Boolean(planData.is_groupee),
      semaine_cible: planData.semaine_cible || 'S1',
      description: planData.description || `Plan de maintenance préventive pour ${machineId}`,
      nb_taches: taskItems.length,
      created_at: new Date().toISOString(),
    };

    const generatedTasks = taskItems.map((item, index) => {
      const compName = item.is_global_machine ? 'Machine entière' : (item.composant || 'Composant');
      const cleanComp = compName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      const actCode = (item.action_code || 'C').toUpperCase();
      const freq = item.frequence || 'Mensuel';
      const taskSeq = String(currentTasks.length + index + 1).padStart(4, '0');

      const planning = item.planning || this.generatePlanningForFrequency(freq, item.target_week || planData.semaine_cible || 'S1', actCode);

      return {
        id: `ID-PREV-${cleanMach}-${cleanComp}-${freq.slice(0, 3).toUpperCase()}-${taskSeq}`,
        id_plan: planId,
        code: `PREV-${machineId}-${cleanComp}-${taskSeq.slice(-3)}`,
        ref: planRef,
        id_machine: machineId,
        nom_machine: planData.nom_machine || `Machine ${machineId}`,
        id_zone: zone,
        section: `Sections: ${zone}`,
        composant: compName,
        type_intervention: item.type_intervention || this.getActionLabel(actCode),
        action_code: actCode,
        frequence: freq,
        planning,
        is_global_machine: Boolean(item.is_global_machine),
        duree_estimee: item.duree_estimee || '15 min',
        responsable: tech,
        etat: 'À faire',
        priorite: item.priorite || 'Normale',
        prochaine_echeance: planData.date_prevue || new Date().toISOString().split('T')[0],
        derniere_realisation: null,
        id_corrective: null,
        consigne: item.consigne || `Exécuter l'action ${actCode} sur ${compName}`,
        created_at: new Date().toISOString(),
      };
    });

    const updatedPlans = [newPlan, ...currentPlans];
    const updatedTasks = [...generatedTasks, ...currentTasks];

    this.savePlans(updatedPlans);
    TaskService.saveTasks(updatedTasks);

    return { plan: newPlan, tasks: generatedTasks };
  }

  static generatePlanningForFrequency(frequency, startWeek = 'S1', actionCode = 'C') {
    const startNum = parseInt(startWeek.replace('S', ''), 10) || 1;
    const planning = {};

    let step = 1;
    if (frequency === 'Hebdo') step = 1;
    else if (frequency === 'Bi-hebdo' || frequency === 'Bimensuel') step = 2;
    else if (frequency === 'Mensuel') step = 4;
    else if (frequency === 'Trimestriel') step = 12;
    else if (frequency === 'Semestriel') step = 26;
    else if (frequency === 'Annuel') step = 52;

    for (let w = startNum; w <= 52; w += step) {
      planning[`S${w}`] = actionCode;
    }

    return planning;
  }

  static getActionLabel(code) {
    const map = {
      C: 'Contrôle',
      N: 'Nettoyage',
      G: 'Graissage',
      V: 'Vérification',
      R: 'Révision',
      S: 'Serrage',
      L: 'Lubrification',
    };
    return map[code] || 'Intervention';
  }
}

export default PlanService;
