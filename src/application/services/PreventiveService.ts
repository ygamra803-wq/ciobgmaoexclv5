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

  static getRecommendedPDRForAction(actionCode?: string, composant?: string) {
    const guides = GuideService.getGuides();
    if (!Array.isArray(guides) || !composant) return [];
    const compLower = String(composant).toLowerCase();
    const match =
      guides.find((g: any) => String(g.composant_nom || g.composant_type || '').toLowerCase() === compLower) ||
      guides.find((g: any) => compLower.includes(String(g.composant_nom || g.composant_type || '').toLowerCase()));
    return match?.pieces_rechange || [];
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
}

export default PreventiveService;
