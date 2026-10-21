import { filterActiveMachines } from '../../utils/activeMachines';

export interface BlueprintPreventivePlanItem {
  id: string;
  action_code?: string;
  composant?: string;
  frequence: string;
  description?: string;
  duree_min?: number;
}

const ACTION_LABELS: Record<string, string> = {
  C: 'Contrôle',
  N: 'Nettoyage',
  G: 'Graissage',
  V: 'Vérification',
  R: 'Révision',
  S: 'Serrage',
  L: 'Lubrification',
};

function buildWeeklyPlanning(frequency: string, actionCode = 'C'): Record<string, string> {
  const planning: Record<string, string> = {};
  let step = 4;
  const f = String(frequency || 'Mensuel').toLowerCase();
  if (f.includes('quotid') || f.includes('jour') || f.includes('hebdo') && !f.includes('bi')) step = 1;
  else if (f.includes('bi')) step = 2;
  else if (f.includes('mensuel') || f === '1m') step = 4;
  else if (f.includes('trimestr') || f === '3m') step = 12;
  else if (f.includes('semestr') || f === '6m') step = 26;
  else if (f.includes('annuel') || f === '12m' || f === '1a') step = 52;

  for (let w = 1; w <= 52; w += step) {
    planning[`S${w}`] = actionCode;
  }
  return planning;
}

export function applyBlueprintPlanToActiveMachines(
  blueprintData: any,
  machines: any[] = [],
  existingTasks: any[] = []
) {
  const bpId = blueprintData?.id_blueprint || blueprintData?.id;
  const planItems: BlueprintPreventivePlanItem[] = Array.isArray(blueprintData?.preventivePlanItems)
    ? blueprintData.preventivePlanItems
    : [];

  const activeLinkedMachines = filterActiveMachines(machines).filter(
    (m) => m.id_blueprint === bpId
  );

  if (!bpId || planItems.length === 0 || activeLinkedMachines.length === 0) {
    return {
      addedTasks: [],
      updatedTasks: Array.isArray(existingTasks) ? existingTasks : [],
      targetMachinesCount: activeLinkedMachines.length,
    };
  }

  const currentTasks = Array.isArray(existingTasks) ? existingTasks : [];
  const addedTasks: any[] = [];
  const nowIso = new Date().toISOString();
  const today = nowIso.split('T')[0];

  activeLinkedMachines.forEach((m) => {
    const machineId = String(m.id_machine_registered || m.code_machine || m.id || '')
      .trim()
      .toUpperCase();
    if (!machineId) return;

    const cleanMach = machineId.replace(/[^a-zA-Z0-9]/g, '');
    const zone = m.id_zone_default || m.id_zone || m.zone || 'AFM';
    const tech = m.technician || m.technicien_responsable || m.technicien || 'Technicien';
    const machineName = m.designation || m.nom || `Machine ${machineId}`;

    planItems.forEach((item, idx) => {
      const itemId = item.id || `BP-ITEM-${idx + 1}`;
      const alreadyExists =
        currentTasks.some(
          (t) =>
            String(t.id_machine || '').toUpperCase() === machineId &&
            t.id_blueprint === bpId &&
            t.blueprint_item_id === itemId
        ) ||
        addedTasks.some(
          (t) =>
            String(t.id_machine || '').toUpperCase() === machineId &&
            t.id_blueprint === bpId &&
            t.blueprint_item_id === itemId
        );

      if (alreadyExists) return;

      const compName = String(item.composant || 'Machine entière').trim() || 'Machine entière';
      const cleanComp = compName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'COMP';
      const actCode = String(item.action_code || 'C').trim().toUpperCase() || 'C';
      const freq = String(item.frequence || 'Mensuel').trim() || 'Mensuel';
      const dureeMin = Number(item.duree_min) > 0 ? Number(item.duree_min) : 15;
      const seqNum = currentTasks.length + addedTasks.length + 1;
      const taskSeq = String(seqNum).padStart(4, '0');
      const desc =
        item.description?.trim() ||
        `Exécuter ${ACTION_LABELS[actCode] || actCode} sur ${compName}`;

      addedTasks.push({
        id: `ID-PREV-${cleanMach}-${cleanComp}-${freq.slice(0, 3).toUpperCase()}-${taskSeq}`,
        id_plan: `ID-PLAN-${bpId}-${cleanMach}`,
        id_blueprint: bpId,
        blueprint_item_id: itemId,
        code: `PREV-${machineId}-${cleanComp}-${taskSeq.slice(-3)}`,
        ref: `Plan-BP-${bpId}-${machineId}`,
        id_machine: machineId,
        nom_machine: machineName,
        id_zone: zone,
        section: `Sections: ${zone}`,
        composant: compName,
        type_intervention: ACTION_LABELS[actCode] || 'Contrôle',
        action_code: actCode,
        frequence: freq,
        planning: buildWeeklyPlanning(freq, actCode),
        is_global_machine: compName.toLowerCase() === 'machine entière',
        duree_estimee: `${dureeMin} min`,
        duree_min: dureeMin,
        description: desc,
        consigne: desc,
        responsable: tech,
        etat: 'À faire',
        priorite: 'Normale',
        prochaine_echeance: today,
        derniere_realisation: null,
        id_corrective: null,
        created_at: nowIso,
      });
    });
  });

  return {
    addedTasks,
    updatedTasks: [...addedTasks, ...currentTasks],
    targetMachinesCount: activeLinkedMachines.length,
  };
}

export function doesTaskMatchBlueprint(
  task: any,
  blueprintId: string,
  machines: any[] = []
): boolean {
  if (!blueprintId || blueprintId === 'ALL') return true;
  if (!task) return false;

  const targetBp = String(blueprintId).trim();
  if (task.id_blueprint && String(task.id_blueprint).trim() === targetBp) {
    return true;
  }

  const taskMachId = String(task.id_machine || task.code_machine || '')
    .trim()
    .toUpperCase();
  if (!taskMachId || !Array.isArray(machines)) return false;

  const norm = (s: any) =>
    String(s || '')
      .trim()
      .toUpperCase()
      .replace(/[-_\s]/g, '');
  const taskMachNorm = norm(taskMachId);

  const matchedMachine = machines.find((m) => {
    if (!m) return false;
    const mId = m.id_machine_registered || m.code_machine || m.id || m.id_machine || m.code;
    return String(mId || '').trim().toUpperCase() === taskMachId || norm(mId) === taskMachNorm;
  });

  return Boolean(matchedMachine && String(matchedMachine.id_blueprint || '').trim() === targetBp);
}

export function filterTasksByBlueprint(
  tasks: any[] = [],
  blueprintId: string,
  machines: any[] = []
): any[] {
  if (!Array.isArray(tasks)) return [];
  if (!blueprintId || blueprintId === 'ALL') return tasks;
  return tasks.filter((t) => doesTaskMatchBlueprint(t, blueprintId, machines));
}

export class Blueprint {
  id: any;
  specs: any;
  components_theoriques: any[];
  parts_theoriques: any[];
  pdr_theoriques: any[];
  preventivePlanItems: BlueprintPreventivePlanItem[];

  constructor(data: any = {}) {
    this.id = data.id_blueprint || data.id;
    this.specs = data.specs || {};
    this.components_theoriques = data.components_theoriques || [];
    this.parts_theoriques = data.parts_theoriques || [];
    this.pdr_theoriques = data.pdr_theoriques || [];
    this.preventivePlanItems = Array.isArray(data.preventivePlanItems)
      ? data.preventivePlanItems
      : [];
  }

  isSameSpecs(other: any) {
    const clean = (s: any) =>
      Object.fromEntries(
        Object.entries(s || {}).filter(([_, v]) => v != null && String(v).trim() !== '')
      );
    return JSON.stringify(clean(this.specs)) === JSON.stringify(clean(other.specs));
  }

  isTwin(other: any) {
    const key = (arr: any[], field: string) =>
      JSON.stringify(
        [...(arr || [])]
          .map((x) => ({ id: String(x[field] || '').trim(), q: Number(x.qte || 1) }))
          .sort((a, b) => a.id.localeCompare(b.id))
      );
    return (
      this.isSameSpecs(other) &&
      key(this.components_theoriques, 'id_component') ===
        key(other.components_theoriques || other.components_reels, 'id_component') &&
      key(this.parts_theoriques, 'id_part') ===
        key(other.parts_theoriques || other.parts_reels, 'id_part') &&
      key(this.pdr_theoriques, 'id_pdr') ===
        key(other.pdr_theoriques || other.pdr_historique, 'id_pdr')
    );
  }

  extractFromNexus(machine: any, mouvements: any[]) {
    const related = mouvements.filter(
      (m) => m.id_machine_registered === machine.id_machine_registered
    );
    this.components_theoriques = machine.components_reels || [];
    this.pdr_theoriques = related.map((m) => ({
      id_pdr: m.ref || m.id_article,
      qte: 1,
      criticite: 'Moyenne',
    }));
  }

  getMachinesLiees(machines: any[] = []) {
    return (machines || []).filter((m) => m.id_blueprint === this.id);
  }

  getActiveMachinesLiees(machines: any[] = []) {
    return filterActiveMachines(machines).filter((m) => m.id_blueprint === this.id);
  }

  getMachinesLieesCount(machines: any[] = []) {
    return this.getMachinesLiees(machines).length;
  }

  getBOMSummary() {
    return `Comp:${this.components_theoriques.length} Parts:${this.parts_theoriques.length} PDR:${this.pdr_theoriques.length} PM:${this.preventivePlanItems.length}`;
  }
}