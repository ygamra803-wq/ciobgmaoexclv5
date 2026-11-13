import type { IMachine } from '../../../types/domain';
import type { MachineElement, PreventiveTaskItem } from '../../../types/store';

export interface NexusAutomationDeps {
  machines: IMachine[];
  preventiveTasks: PreventiveTaskItem[];
  handleAddDemandeIntervention?: (payload: Record<string, unknown>) => unknown;
  handleCreatePlanWithTasks?: (
    planMeta: Record<string, unknown>,
    tasks: Array<Record<string, unknown>>
  ) => unknown;
  handleAddPreventiveAction?: (payload: Record<string, unknown>) => unknown;
  showToast?: (message: string, type?: string) => void;
}

export interface PreventiveRecommendationInput {
  machine?: string;
  code_machine?: string;
  anomalie?: string;
  titre?: string;
  zone?: string;
  suggestedIntervalDays?: number;
  recommendation?: string;
  recommendedAction?: string;
  description?: string;
}

export function buildNexusAutomationCallbacks(deps: NexusAutomationDeps) {
  const {
    machines,
    preventiveTasks,
    handleAddDemandeIntervention,
    handleCreatePlanWithTasks,
    handleAddPreventiveAction,
    showToast,
  } = deps;

  const onCreateCorrectiveFromNexus = (machine: IMachine, element: MachineElement) => {
    if (!machine || !element || typeof handleAddDemandeIntervention !== 'function') return;
    const machineId = String(machine.id_machine_registered || machine.id || '').trim();
    const zoneId = machine.id_zone_default || machine.id_zone || 'Atelier';
    const techName =
      element.technicien && element.technicien !== 'tech'
        ? element.technicien
        : machine.technician || machine.technicien_responsable || 'Technicien';
    const isComp = element.element_type === 'COMPONENT';
    const isPart = element.element_type === 'PART';
    const parentKey = String(element.parent_component_key || '').trim();
    const priorite =
      element.criticalite === 'CRITIQUE'
        ? 'Urgente'
        : element.criticalite === 'MAJEURE'
        ? 'Haute'
        : 'Normale';

    handleAddDemandeIntervention({
      code_machine: machineId,
      id_machine: machineId,
      id_zone: zoneId,
      zone: zoneId,
      technicien: techName,
      demandeur: `Nexus BOM (${techName})`,
      priorite,
      type_panne: isComp ? 'Électromécanique' : 'Mécanique',
      id_composant: isComp ? element.ref_element : parentKey || undefined,
      nom_composant: isComp
        ? element.designation || element.ref_element
        : parentKey || undefined,
      id_part: isPart ? element.ref_element : undefined,
      nom_part: isPart ? element.designation || element.ref_element : undefined,
      anomalie: `Intervention BOM Nexus : ${element.ref_element} — ${element.designation || 'Élément monté'} (${element.statut || 'Usure'})`,
      travail_a_faire:
        element.element_type === 'PDR'
          ? `Contrôler et remplacer la pièce PDR ${element.ref_element} (${element.designation || ''}) montée sur ${element.emplacement_machine || parentKey || machineId}.`
          : `Inspecter / réviser l'organe ${element.ref_element} (${element.designation || ''}) sur ${machineId}.`,
    });
  };

  const onCreatePreventiveFromNexus = (machine: IMachine, element: MachineElement) => {
    if (!machine || !element || typeof handleCreatePlanWithTasks !== 'function') {
      return { skipped: true };
    }
    const machineId = String(machine.id_machine_registered || machine.id || '').trim();
    const composantLabel = `${element.designation || element.ref_element} (${element.ref_element})`;
    const alreadyExists = (preventiveTasks || []).some(
      (t) =>
        String(t.id_machine || '').trim().toUpperCase() === machineId.toUpperCase() &&
        (String(t.composant || '').trim().toLowerCase() === composantLabel.toLowerCase() ||
          String(t.pdr_ref || '').trim().toUpperCase() ===
            String(element.ref_element || '').trim().toUpperCase())
    );
    if (alreadyExists) {
      return { skipped: true, reason: 'ALREADY_EXISTS', composantLabel };
    }

    const zoneId = machine.id_zone_default || machine.id_zone || 'Atelier';
    const techName =
      element.technicien && element.technicien !== 'tech'
        ? element.technicien
        : machine.technician || machine.technicien_responsable || 'Technicien';
    const maxH = Number(element.duree_vie_estimee_heures) || 5000;
    const frequence = maxH <= 1000 ? 'Hebdo' : maxH <= 3000 ? 'Mensuel' : 'Trimestriel';
    const isComp = element.element_type === 'COMPONENT';
    const isPart = element.element_type === 'PART';
    const parentKey = String(element.parent_component_key || '').trim();

    handleCreatePlanWithTasks(
      {
        id_machine: machineId,
        nom_machine: machine.designation || machine.nom || `Machine ${machineId}`,
        id_zone: zoneId,
        id_technicien: techName,
        semaine_cible: 'S1',
        description: `Surveillance préventive BOM Nexus pour ${element.ref_element} sur ${machineId}`,
      },
      [
        {
          composant: composantLabel,
          id_composant: isComp ? element.ref_element : parentKey || undefined,
          nom_composant: isComp
            ? element.designation || element.ref_element
            : parentKey || undefined,
          id_part: isPart ? element.ref_element : undefined,
          nom_part: isPart ? element.designation || element.ref_element : undefined,
          action_code: element.element_type === 'PDR' ? 'C' : 'V',
          frequence,
          duree_estimee: '20 min',
          priorite: element.criticalite === 'CRITIQUE' ? 'Haute' : 'Moyenne',
          consigne: `Contrôler l'usure (RUL max ${maxH}h) de ${element.ref_element} (${element.designation || ''}) à l'emplacement : ${element.emplacement_machine || parentKey || 'Machine'}.`,
          pdr_requises:
            element.element_type === 'PDR'
              ? [
                  {
                    ref: element.ref_element,
                    nom: element.designation || element.ref_element,
                    designation: element.designation || element.ref_element,
                    quantite: Math.max(1, Number(element.qte_montee) || 1),
                  },
                ]
              : [],
        },
      ]
    );
    return { skipped: false, frequence, composantLabel };
  };

  const onAdoptRecommendation = (rec: PreventiveRecommendationInput) => {
    const machineId = String(rec?.machine || rec?.code_machine || '').trim().toUpperCase();
    if (!machineId) return { skipped: true };
    const anomClean = String(rec?.anomalie || rec?.titre || 'inspection_generale')
      .replace(/^Maintenance Préventive Ciblée\s*:\s*/i, '')
      .replace(/_/g, ' ')
      .trim();
    const composantName = `Contrôle ${anomClean}`;
    const alreadyExists = (preventiveTasks || []).some(
      (t) =>
        String(t.id_machine || '').trim().toUpperCase() === machineId &&
        String(t.composant || '').trim().toLowerCase() === composantName.toLowerCase()
    );
    if (alreadyExists) {
      showToast?.(`Une routine préventive "${composantName}" existe déjà pour ${machineId}.`, 'info');
      return { skipped: true };
    }
    const matchedMachine = (machines || []).find(
      (m) => String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase() === machineId
    );
    const zoneId = matchedMachine?.id_zone_default || matchedMachine?.id_zone || rec?.zone || 'Atelier';
    const techName =
      matchedMachine?.technician ||
      matchedMachine?.technicien_responsable ||
      matchedMachine?.technicien ||
      'Technicien';
    const freq = rec?.suggestedIntervalDays && Number(rec.suggestedIntervalDays) <= 10 ? 'Hebdo' : 'Mensuel';
    if (typeof handleCreatePlanWithTasks === 'function') {
      handleCreatePlanWithTasks(
        {
          id_machine: machineId,
          nom_machine: matchedMachine?.designation || `Machine ${machineId}`,
          id_zone: zoneId,
          id_technicien: techName,
          semaine_cible: 'S1',
          description: rec?.recommendation || rec?.description || `Routine anti-récidive (${anomClean}) pour ${machineId}`,
        },
        [
          {
            composant: composantName,
            action_code: 'C',
            frequence: freq,
            duree_estimee: '20 min',
            priorite: 'Haute',
            consigne: rec?.recommendedAction || rec?.description || `Contrôle préventif systématique (${anomClean})`,
          },
        ]
      );
    }
    if (typeof handleAddPreventiveAction === 'function') {
      handleAddPreventiveAction({
        code: 'C',
        libelle: `${composantName} (${machineId})`,
        description: rec?.recommendedAction || rec?.description || '',
        type_maintenance: 'Préventif',
        frequence_defaut: freq === 'Hebdo' ? '1S' : '1M',
      });
    }
    showToast?.(`Routine préventive "${composantName}" planifiée pour ${machineId} (${freq}).`, 'success');
    return { skipped: false, machineId, composant: composantName };
  };

  const onCreateCorrectiveFromPreventive = (
    taskOrPayload: Record<string, unknown> = {},
    btData: Record<string, unknown> = {}
  ) => {
    if (typeof handleAddDemandeIntervention === 'function') {
      const { id: preventiveTaskId, etat: _etat, statut: _statut, ...restTask } = taskOrPayload || {};
      handleAddDemandeIntervention({
        ...restTask,
        ...btData,
        id_tache_preventive: preventiveTaskId || undefined,
        code_machine:
          btData?.code_machine ||
          taskOrPayload?.code_machine ||
          taskOrPayload?.id_machine ||
          taskOrPayload?.machine ||
          '',
        anomalie:
          btData?.anomalie ||
          btData?.description ||
          taskOrPayload?.anomalie ||
          taskOrPayload?.description ||
          taskOrPayload?.composant ||
          'Anomalie détectée en préventif',
        travail_a_faire:
          btData?.description ||
          taskOrPayload?.consigne ||
          `Intervention corrective suite au contrôle ${taskOrPayload?.composant || ''}`,
        priorite: String(btData?.priorite || taskOrPayload?.priorite || 'HAUTE').toUpperCase(),
        demandeur:
          btData?.demandeur ||
          taskOrPayload?.demandeur ||
          taskOrPayload?.technicien ||
          taskOrPayload?.responsable ||
          'Maintenance Préventive',
      });
    }
    showToast?.(
      `DI Corrective créée depuis le préventif (${taskOrPayload?.id_machine || taskOrPayload?.code_machine || ''}) !`,
      'info'
    );
  };

  const onAddPreventiveTaskFromCorrective = (recOrTask: PreventiveRecommendationInput) => {
    const machineId = String(recOrTask?.code_machine || recOrTask?.machine || '').trim().toUpperCase();
    if (!machineId || typeof handleCreatePlanWithTasks !== 'function') {
      return { created: false };
    }
    const anomClean = String(recOrTask?.anomalie || recOrTask?.titre || 'inspection_generale')
      .replace(/^Maintenance Préventive Ciblée\s*:\s*/i, '')
      .replace(/_/g, ' ')
      .trim();
    const composantName = `Contrôle ${anomClean}`;
    const alreadyExists = (preventiveTasks || []).some(
      (t) =>
        String(t.id_machine || '').trim().toUpperCase() === machineId &&
        String(t.composant || '').trim().toLowerCase() === composantName.toLowerCase()
    );
    if (alreadyExists) {
      return { created: false, duplicate: true };
    }
    const matchedMachine = (machines || []).find(
      (m) => String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase() === machineId
    );
    const zoneId = matchedMachine?.id_zone_default || matchedMachine?.id_zone || recOrTask?.zone || 'Atelier';
    const resolvedTech = matchedMachine?.technician || matchedMachine?.technicien || 'Technicien';
    handleCreatePlanWithTasks(
      {
        id_machine: machineId,
        nom_machine: matchedMachine?.designation || `Machine ${machineId}`,
        id_zone: zoneId,
        id_technicien: resolvedTech,
        semaine_cible: 'S1',
        description: recOrTask?.description || `Plan préventif ciblé (${anomClean}) pour ${machineId}`,
      },
      [
        {
          composant: composantName,
          action_code: 'C',
          frequence: 'Mensuel',
          duree_estimee: '20 min',
          priorite: 'Haute',
          consigne: recOrTask?.description || `Contrôle préventif systématique (${anomClean})`,
        },
      ]
    );
    return { created: true };
  };

  return {
    onCreateCorrectiveFromNexus,
    onCreatePreventiveFromNexus,
    onAdoptRecommendation,
    onCreateCorrectiveFromPreventive,
    onAddPreventiveTaskFromCorrective,
  };
}
