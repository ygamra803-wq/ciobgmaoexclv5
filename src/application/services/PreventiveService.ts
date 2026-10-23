import { ActionService } from './preventive/ActionService';
import { GuideService } from './preventive/GuideService';
import { PlanService } from './preventive/PlanService';
import { TaskService } from './preventive/TaskService';
import { ExecutionService } from './preventive/ExecutionService';

export class PreventiveService {
  static getExecutions() {
    return ExecutionService.getExecutions();
  }

  static saveExecutions(executions: any[]) {
    return ExecutionService.saveExecutions(executions);
  }

  static recordExecution(task: any, validationData?: any) {
    return ExecutionService.recordExecution(task, validationData);
  }

  static deleteExecution(id: string) {
    return ExecutionService.deleteExecution(id);
  }

  static clearExecutions() {
    return ExecutionService.clearExecutions();
  }

  static getActions() {
    return ActionService.getActions();
  }

  static saveActions(actions: any[]) {
    return ActionService.saveActions(actions);
  }

  static addAction(actionData: any) {
    const current = [...this.getActions()];
    const code = (actionData.code || 'X').trim().toUpperCase();
    const libelle = (actionData.libelle || 'Action').trim();
    const shortLib = libelle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
    const seq = String(current.length + 1).padStart(3, '0');
    
    const newAction = {
      action_id: `ACT-${code}-${shortLib}-${seq}`,
      code,
      libelle,
      description: actionData.description || '',
      type_maintenance: actionData.type_maintenance || 'Préventif',
      frequence_defaut: actionData.frequence_defaut || '1M',
      color: actionData.color || '#3b82f6',
      symbole: actionData.symbole || code,
      duree_estimee_min: Number(actionData.duree_estimee_min) || 30,
      active: true,
      created_at: new Date().toISOString()
    };

    current.push(newAction);
    this.saveActions(current);
    return current;
  }

  static updateAction(id: string, actionData: any) {
    return ActionService.updateAction(id, actionData);
  }

  static deleteAction(id: string) {
    return ActionService.deleteAction(id);
  }

  static getTasks() {
    return TaskService.getTasks();
  }

  static saveTasks(tasks: any[]) {
    return TaskService.saveTasks(tasks);
  }

  static markTaskAsDone(id: string, validationData?: any) {
    return TaskService.markTaskAsDone(id, validationData);
  }

  static updateTaskCounter(id: string, counter: number) {
    return TaskService.updateTaskCounter(id, counter);
  }

  static updateTaskStatus(id: string, newStatus: string) {
    return TaskService.updateTask(id, { etat: newStatus });
  }

  static updateTask(id: string, taskData: any) {
    return TaskService.updateTask(id, taskData);
  }

  static deleteTask(id: string) {
    return TaskService.deleteTask(id);
  }

  static bulkImportTasks(tasksArray: any[], replace = false) {
    const current = replace ? [] : this.getTasks();
    return TaskService.injectRealData([...tasksArray, ...current]);
  }

  static importFromExcel(file: File) {
    return TaskService.importFromExcel(file);
  }

  static loadFromPublicJson() {
    return TaskService.loadFromPublicJson();
  }

  static getRecommendedPDRForAction(actionCode?: string, composant?: string, task?: any) {
    const result: any[] = [];
    const seenRefs = new Set<string>();

    // 1. Explicit required PDRs attached to the PreventiveTask (P7.1 canonical link)
    const explicitList = Array.isArray(task?.pdr_requises)
      ? task.pdr_requises
      : task?.pdr_ref && String(task.pdr_ref).trim()
      ? [{ ref: String(task.pdr_ref).trim(), nom: task.pdr_designation || task.pdr_ref, quantite: 1 }]
      : [];

    explicitList.forEach((p: any) => {
      const ref = String(p?.ref || p?.reference || p?.code || '').trim();
      if (!ref) return;
      const key = ref.toLowerCase();
      if (seenRefs.has(key)) return;
      seenRefs.add(key);
      const label = String(p?.designation || p?.nom || ref).trim();
      result.push({
        id_article: `PDR-${ref}`,
        ref,
        reference: ref,
        nom: label,
        designation: label,
        quantite: Math.max(1, Number(p?.quantite ?? p?.qty ?? 1)),
        unite: String(p?.unite || p?.unit || 'Pièce'),
        prix_unitaire: Number(p?.prix_unitaire ?? p?.unitPrice ?? 0) || 0,
      });
    });

    // 2. Guide fallback recommendations
    const guides = GuideService.getGuides();
    const targetComp = String(composant || task?.composant || task?.nom_composant || task?.nom_part || '').trim();
    if (Array.isArray(guides) && targetComp) {
      const compLower = targetComp.toLowerCase();
      const match =
        guides.find((g: any) => String(g.composant_nom || g.composant_type || '').toLowerCase() === compLower) ||
        guides.find((g: any) => compLower.includes(String(g.composant_nom || g.composant_type || '').toLowerCase()));
      const guidePieces = Array.isArray(match?.pieces_rechange) ? match.pieces_rechange : [];
      guidePieces.forEach((gp: any) => {
        const ref = String(gp?.reference || gp?.ref || gp?.code || '').trim();
        const key = (ref || String(gp?.designation || '')).toLowerCase();
        if (!key || seenRefs.has(key)) return;
        seenRefs.add(key);
        result.push(gp);
      });
    }

    return result;
  }

  static createPlanWithTasks(planData: any, taskItems: any[]) {
    return PlanService.createPlanWithTasks(planData, taskItems);
  }

  static addGuide(guideData: any) {
    return GuideService.addGuide(guideData);
  }

  static updateGuide(id: string, guideData: any) {
    return GuideService.updateGuide(id, guideData);
  }

  static deleteGuide(id: string) {
    return GuideService.deleteGuide(id);
  }

  static getMachinePreventiveProfile(machineId: string) {
    const id = String(machineId || '').trim();
    const allTasks = Array.isArray(this.getTasks()) ? this.getTasks() : [];
    const allExecutions = Array.isArray(this.getExecutions()) ? this.getExecutions() : [];

    const tasks = allTasks.filter(
      (t: any) => String(t.id_machine || t.machine || '').trim() === id
    );
    const executions = allExecutions.filter(
      (ex: any) => String(ex.id_machine || ex.machine || '').trim() === id
    );

    const total_tasks = tasks.length;
    const fait_tasks = tasks.filter(
      (t: any) => String(t.etat || '').toLowerCase() === 'fait'
    ).length;
    const retard_tasks = tasks.filter(
      (t: any) => String(t.etat || '').toLowerCase().includes('retard')
    ).length;

    const compliance_rate =
      total_tasks > 0 ? Math.round((fait_tasks / total_tasks) * 100) : 100;

    const health_status =
      retard_tasks === 0 && compliance_rate >= 80
        ? 'Optimale'
        : retard_tasks <= 2 && compliance_rate >= 50
        ? 'Moyenne'
        : 'Critique';

    const pendingTask = tasks.find(
      (t: any) => String(t.etat || '').toLowerCase() !== 'fait'
    );
    const prochaine_intervention = pendingTask
      ? {
          semaine: pendingTask.prochaine_echeance || pendingTask.frequence || 'Planifié',
          date: pendingTask.derniere_execution
            ? `Dernière: ${pendingTask.derniere_execution}`
            : 'Calendrier annuel',
        }
      : null;

    const tasksCost = tasks.reduce(
      (sum: number, t: any) => sum + (Number(t.cout_total) || Number(t.cout_pdr) || 0),
      0
    );
    const execsCost = executions.reduce(
      (sum: number, ex: any) => sum + (Number(ex.cout_total) || Number(ex.cout_pdr) || 0),
      0
    );

    return {
      tasks,
      total_tasks,
      fait_tasks,
      retard_tasks,
      compliance_rate,
      health_status,
      prochaine_intervention,
      cout_total_preventif: execsCost > 0 ? execsCost : tasksCost,
    };
  }
}

export default PreventiveService;
