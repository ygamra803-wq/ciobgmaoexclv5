import { ActionService } from './preventive/ActionService';
import { GuideService } from './preventive/GuideService';
import { PlanService } from './preventive/PlanService';
import { TaskService } from './preventive/TaskService';
import { ExecutionService } from './preventive/ExecutionService';
import type { PreventiveExecutionRecord } from '../../types/preventive';
import type { IPreventiveActionCatalogItem, IPreventiveGuideCatalogItem } from '../../types/store';

export type PreventiveRecord = Record<string, unknown>;

export interface PreventiveActionInput {
  action_id?: string;
  id?: string | number;
  code?: string;
  libelle?: string;
  description?: string;
  type_maintenance?: string;
  frequence_defaut?: string;
  color?: string;
  symbole?: string;
  duree_estimee_min?: number | string;
  [key: string]: unknown;
}

export interface PreventiveGuidePiece {
  ref?: string;
  reference?: string;
  code?: string;
  nom?: string;
  designation?: string;
  quantite?: number | string;
  qty?: number | string;
  unite?: string;
  unit?: string;
  prix_unitaire?: number | string;
  unitPrice?: number | string;
  [key: string]: unknown;
}

export interface RecommendedPdrItem {
  id_article?: string;
  ref?: string;
  reference?: string;
  nom?: string;
  designation?: string;
  quantite?: number;
  unite?: string;
  prix_unitaire?: number;
  [key: string]: unknown;
}

export interface PreventiveTaskLookupShape {
  id?: string | number;
  code?: string;
  action_code?: string;
  responsable?: string;
  id_machine?: string;
  machine?: string;
  composant?: string;
  nom_composant?: string;
  nom_part?: string;
  etat?: string;
  pdr_ref?: string;
  pdr_designation?: string;
  pdr_requises?: PreventiveGuidePiece[];
  derniere_realisation?: string;
  lastExecutedAt?: string;
  derniere_execution?: string;
  prochaine_echeance?: string;
  frequence?: string;
  cout_cumule?: number;
  cout_total?: number;
  cout_pdr?: number;
  [key: string]: unknown;
}

export interface MachinePreventiveProfile {
  tasks: PreventiveTaskLookupShape[];
  total_tasks: number;
  fait_tasks: number;
  retard_tasks: number;
  compliance_rate: number;
  health_status: 'Optimale' | 'Moyenne' | 'Critique';
  prochaine_intervention: { semaine: string; date: string } | null;
  cout_total_preventif: number;
}

/**
 * Application-layer facade coordinating Preventive Maintenance sub-services
 * (Actions, Guides, Plans, Tasks, Executions) and computing machine compliance/cost profiles.
 */
export class PreventiveService {
  static getExecutions(): PreventiveExecutionRecord[] {
    return ExecutionService.getExecutions();
  }

  static saveExecutions(executions: PreventiveExecutionRecord[]): PreventiveExecutionRecord[] {
    return ExecutionService.saveExecutions(executions);
  }

  static recordExecution(
    task: PreventiveRecord | null | undefined,
    validationData?: PreventiveRecord
  ) {
    return ExecutionService.recordExecution(task, validationData);
  }

  static deleteExecution(id: string): PreventiveExecutionRecord[] {
    return ExecutionService.deleteExecution(id);
  }

  static clearExecutions(): PreventiveExecutionRecord[] {
    return ExecutionService.clearExecutions();
  }

  static getActions(): IPreventiveActionCatalogItem[] {
    return ActionService.getActions();
  }

  static saveActions(actions: IPreventiveActionCatalogItem[]): void {
    ActionService.saveActions(actions);
  }

  /** Registers a new standardized preventive action catalog item with auto-generated code/sequence ID. */
  static addAction(actionData: PreventiveActionInput): IPreventiveActionCatalogItem[] {
    return ActionService.addAction(actionData as Partial<IPreventiveActionCatalogItem>, this);
  }

  static updateAction(
    id: string | number,
    actionData: Partial<IPreventiveActionCatalogItem>
  ): IPreventiveActionCatalogItem[] {
    return ActionService.updateAction(id, actionData, this);
  }

  static deleteAction(id: string | number): IPreventiveActionCatalogItem[] {
    return ActionService.deleteAction(id, this);
  }

  static getTasks(): PreventiveTaskLookupShape[] {
    return TaskService.getTasks() as PreventiveTaskLookupShape[];
  }

  static saveTasks(tasks: PreventiveRecord[]) {
    return TaskService.saveTasks(tasks);
  }

  static markTaskAsDone(id: string | number, validationData?: PreventiveRecord) {
    return TaskService.markTaskAsDone(id, validationData);
  }

  static updateTaskCounter(id: string | number, counter: number) {
    return TaskService.updateTaskCounter(id, counter);
  }

  static updateTaskStatus(id: string | number, newStatus: string) {
    return TaskService.updateTask(id, { etat: newStatus });
  }

  static updateTask(id: string | number, taskData: PreventiveRecord) {
    return TaskService.updateTask(id, taskData);
  }

  static deleteTask(id: string | number) {
    return TaskService.deleteTask(id);
  }

  static bulkImportTasks(tasksArray: PreventiveRecord[], replace = false) {
    const current = replace ? [] : this.getTasks();
    return TaskService.injectRealData([...tasksArray, ...current]);
  }

  static importFromExcel(file: File) {
    return TaskService.importFromExcel(file);
  }

  static loadFromPublicJson() {
    return TaskService.loadFromPublicJson();
  }

  /**
   * Resolves spare parts recommended for a preventive task by merging:
   *  1. Explicit BOM `pdr_requises` / `pdr_ref` attached to the task (highest priority)
   *  2. Component guide catalog fallback (`GuideService.getGuides`) deduplicated case-insensitively by `ref`.
   */
  static getRecommendedPDRForAction(
    _actionCode?: string,
    composant?: string,
    task?: PreventiveTaskLookupShape | null
  ): RecommendedPdrItem[] {
    const result: RecommendedPdrItem[] = [];
    const seenRefs = new Set<string>();

    // 1. Explicit required PDRs attached to the PreventiveTask (canonical link)
    const explicitList: PreventiveGuidePiece[] = Array.isArray(task?.pdr_requises)
      ? task.pdr_requises
      : task?.pdr_ref && String(task.pdr_ref).trim()
      ? [{ ref: String(task.pdr_ref).trim(), nom: task.pdr_designation || task.pdr_ref, quantite: 1 }]
      : [];

    explicitList.forEach((p) => {
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
    const guides = GuideService.getGuides() as Array<{
      composant_nom?: unknown;
      composant_type?: unknown;
      pieces_rechange?: PreventiveGuidePiece[];
    }>;
    const targetComp = String(
      composant || task?.composant || task?.nom_composant || task?.nom_part || ''
    ).trim();
    if (Array.isArray(guides) && targetComp) {
      const compLower = targetComp.toLowerCase();
      const match =
        guides.find((g) => String(g.composant_nom || g.composant_type || '').toLowerCase() === compLower) ||
        guides.find((g) => compLower.includes(String(g.composant_nom || g.composant_type || '').toLowerCase()));
      const guidePieces = Array.isArray(match?.pieces_rechange) ? match.pieces_rechange : [];
      guidePieces.forEach((gp) => {
        const ref = String(gp?.reference || gp?.ref || gp?.code || '').trim();
        const key = (ref || String(gp?.designation || '')).toLowerCase();
        if (!key || seenRefs.has(key)) return;
        seenRefs.add(key);
        result.push(gp as RecommendedPdrItem);
      });
    }

    return result;
  }

  static createPlanWithTasks(planData: PreventiveRecord, taskItems: PreventiveRecord[]) {
    return PlanService.createPlanWithTasks(planData, taskItems);
  }

  static getGuides(): IPreventiveGuideCatalogItem[] {
    return GuideService.getGuides();
  }

  static saveGuides(guides: IPreventiveGuideCatalogItem[]): void {
    GuideService.saveGuides(guides);
  }

  static addGuide(guideData: Partial<IPreventiveGuideCatalogItem>): IPreventiveGuideCatalogItem[] {
    return GuideService.addGuide(guideData);
  }

  static updateGuide(
    id: string | number,
    guideData: Partial<IPreventiveGuideCatalogItem>
  ): IPreventiveGuideCatalogItem[] {
    return GuideService.updateGuide(id, guideData);
  }

  static deleteGuide(id: string | number): IPreventiveGuideCatalogItem[] {
    return GuideService.deleteGuide(id);
  }

  /**
   * Computes a machine's preventive compliance rate, health tier (`Optimale | Moyenne | Critique`),
   * next scheduled intervention, and cumulative preventive cost from approved executions.
   * Unapproved (`PENDING_VALIDATION` / `NEEDS_CLARIFICATION` / `REJECTED`) and `SKIPPED` executions
   * are excluded from the realized cost roll-up.
   */
  static getMachinePreventiveProfile(machineId: string): MachinePreventiveProfile {
    const idUpper = String(machineId || '').trim().toUpperCase();
    const allTasks = Array.isArray(this.getTasks()) ? this.getTasks() : [];
    const allExecutions = Array.isArray(this.getExecutions()) ? this.getExecutions() : [];

    const tasks = allTasks.filter(
      (t) => String(t.id_machine || t.machine || '').trim().toUpperCase() === idUpper
    );
    const executions = allExecutions.filter((ex) => {
      const exMach = String(ex.machineCode || ex.id_machine || ex.machine || '').trim().toUpperCase();
      if (exMach !== idUpper) return false;
      const valStatus = String(ex.validation_status || 'APPROVED').toUpperCase();
      if (valStatus === 'PENDING_VALIDATION' || valStatus === 'NEEDS_CLARIFICATION' || valStatus === 'REJECTED') {
        return false;
      }
      return ex.status !== 'SKIPPED';
    });

    const total_tasks = tasks.length;
    const fait_tasks = tasks.filter(
      (t) => String(t.etat || '').toLowerCase() === 'fait'
    ).length;
    const retard_tasks = tasks.filter(
      (t) => String(t.etat || '').toLowerCase().includes('retard')
    ).length;

    const compliance_rate =
      total_tasks > 0 ? Math.round((fait_tasks / total_tasks) * 100) : 100;

    const health_status: MachinePreventiveProfile['health_status'] =
      retard_tasks === 0 && compliance_rate >= 80
        ? 'Optimale'
        : retard_tasks <= 2 && compliance_rate >= 50
        ? 'Moyenne'
        : 'Critique';

    const pendingTask = tasks.find(
      (t) => String(t.etat || '').toLowerCase() !== 'fait'
    );
    const lastRealisation =
      pendingTask?.derniere_realisation ||
      pendingTask?.lastExecutedAt ||
      pendingTask?.derniere_execution;
    const prochaine_intervention = pendingTask
      ? {
          semaine: String(pendingTask.prochaine_echeance || pendingTask.frequence || 'Planifié'),
          date: lastRealisation
            ? `Dernière: ${lastRealisation}`
            : 'Calendrier annuel',
        }
      : null;

    const tasksCost = tasks.reduce(
      (sum, t) =>
        sum + (Number(t.cout_cumule ?? t.cout_total ?? t.cout_pdr ?? 0) || 0),
      0
    );
    const execsCost = executions.reduce(
      (sum, ex) =>
        sum + (Number(ex.totalCost ?? ex.sparesCost ?? ex.cout_total ?? ex.cout_pdr ?? 0) || 0),
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
      cout_total_preventif: Number((execsCost > 0 ? execsCost : tasksCost).toFixed(2)),
    };
  }
}

export default PreventiveService;
