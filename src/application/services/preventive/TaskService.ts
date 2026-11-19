import * as XLSX from 'xlsx';
import { Logger } from '../../../core/logger/LoggerService';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';
import { ExecutionService } from './ExecutionService';
import { computeNextDueDateForMode } from '../../../domain/preventive/preventiveScheduleEngine';
import { MeterService } from '../meter/MeterService';

export const STORAGE_KEY_TASKS = STORAGE_KEYS.PREVENTIVE_TASKS;
export const INITIAL_TASKS: any[] = [];

export function computeNextDueDate(
  dateRealisation: string,
  frequence?: string,
  modeCalcul?: string,
  previousDueDate?: string
): string {
  return computeNextDueDateForMode(dateRealisation, frequence, modeCalcul, previousDueDate);
}

export class TaskService {
  static getTasks() {
    return loadCollection(STORAGE_KEY_TASKS, {
      allowDemoFallback: false,
      demoSeed: [],
    });
  }

  static saveTasks(tasks) {
    try {
      storageService.setItem(STORAGE_KEY_TASKS, tasks);
    } catch {
      // storage error
    }
  }

  static deleteTask(taskId) {
    const current = this.getTasks();
    const filtered = current.filter(t => t.id !== taskId);
    this.saveTasks(filtered);
    return filtered;
  }

  static updateTask(taskId, updatedFields) {
    const current = this.getTasks();
    const updated = current.map(t => t.id === taskId ? { ...t, ...updatedFields, updated_at: new Date().toISOString() } : t);
    this.saveTasks(updated);
    return updated;
  }

  static updateTaskCounter(taskId, newCounterValue) {
    const current = this.getTasks();
    const target = current.find((t) => String(t.id) === String(taskId));
    const targetMachine = String(target?.id_machine || '').trim().toUpperCase();
    const numericVal = Number(newCounterValue || 0);
    const nowIso = new Date().toISOString();

    const updated = current.map((t) => {
      const isSameTask = String(t.id) === String(taskId);
      const isSameMachine =
        targetMachine && String(t.id_machine || '').trim().toUpperCase() === targetMachine;
      if (isSameTask || isSameMachine) {
        const isCounter =
          t.type_declencheur === 'COMPTEUR' ||
          t.type_declencheur === 'HYBRIDE' ||
          Number(t.compteur_seuil_intervalle || 0) > 0;
        const evalRes = MeterService.evaluateTaskTrigger(t, numericVal);
        let etat = t.etat;
        const isAwaitingReview =
          t.etat === 'En attente validation' ||
          t.etat === 'À clarifier' ||
          t.validation_status === 'PENDING_VALIDATION' ||
          t.validation_status === 'NEEDS_CLARIFICATION';
        if (isCounter && !isAwaitingReview) {
          if (evalRes.isOverdue) etat = 'En retard';
          else if (evalRes.isWarning && (t.etat === 'Fait' || t.etat === 'En retard')) etat = 'À faire';
          else if (etat === 'En retard' && !evalRes.isOverdue) etat = 'À faire';
        }
        return {
          ...t,
          dernier_releve: numericVal,
          compteur_actuel: numericVal,
          etat,
          updated_at: nowIso,
        };
      }
      return t;
    });
    this.saveTasks(updated);
    return updated;
  }

  static markTaskAsDone(taskId, validationData: Record<string, any> = {}) {
    const current = this.getTasks();
    const nowIso = new Date().toISOString();
    const dateRealisation =
      validationData?.date_realisation ||
      validationData?.date_execution ||
      nowIso.split('T')[0];

    const targetTask = current.find((t) => String(t.id) === String(taskId));
    const targetMachine = String(targetTask?.id_machine || '').trim().toUpperCase();
    const releveNum = Number(
      validationData?.compteur_releve ?? validationData?.dernier_releve ?? 0
    );

    const { execution } = ExecutionService.recordExecution(targetTask || { id: taskId }, {
      ...validationData,
      date_realisation: dateRealisation,
    });

    const isPending = execution.validation_status === 'PENDING_VALIDATION';

    const updated = current.map((t) => {
      const isTarget = String(t.id) === String(taskId);
      const isSameMachine =
        targetMachine && String(t.id_machine || '').trim().toUpperCase() === targetMachine;

      if (!isTarget) {
        // NEVER mutate sibling tasks' counters while an execution is still PENDING_VALIDATION
        if (!isPending && isSameMachine && releveNum > 0) {
          return {
            ...t,
            dernier_releve: releveNum,
            compteur_actuel: releveNum,
            updated_at: nowIso,
          };
        }
        return t;
      }

      if (isPending) {
        return {
          ...t,
          etat: 'En attente validation',
          validation_status: 'PENDING_VALIDATION',
          last_pending_execution_id: execution.id,
          pieces_proposees: execution.sparesProposed || [],
          num_bon_saisi_par_tech: execution.num_bon_saisi_par_tech || '',
          submitted_by_id: execution.submitted_by_id || '',
          submitted_by_name: execution.submitted_by_name || execution.executorName || '',
          submitted_at: execution.submitted_at || nowIso,
          validation_note: '',
          technicien_realisateur: execution.executorName || t.responsable,
          observations_validation: execution.notes || '',
          duree_reelle: validationData?.duree_reelle || `${execution.durationMinutes} min`,
          ...(execution.id_composant ? { id_composant: execution.id_composant } : {}),
          ...(execution.nom_composant ? { nom_composant: execution.nom_composant } : {}),
          ...(execution.id_part ? { id_part: execution.id_part } : {}),
          ...(execution.nom_part ? { nom_part: execution.nom_part } : {}),
          ...(releveNum > 0 ? { pending_compteur_releve: releveNum } : {}),
          updated_at: nowIso,
        };
      }

      const previousDue =
        t.prochaine_echeance || t.nextDueDate || t.date_prevue || t.date_planifiee || t.dueDate || '';
      const nextDue = computeNextDueDateForMode(
        dateRealisation,
        t.frequence,
        t.mode_calcul_recurrence,
        previousDue
      );
      const prevCost = Number(t.cout_cumule || 0);
      const addedCost = Number(execution.totalCost || 0);
      const nextPlanning =
        t.planning && typeof t.planning === 'object' && execution.periodWeek && t.planning[execution.periodWeek]
          ? { ...t.planning, [execution.periodWeek]: 'DONE' }
          : t.planning;

      const isCounterTask =
        t.type_declencheur === 'COMPTEUR' ||
        t.type_declencheur === 'HYBRIDE' ||
        Number(t.compteur_seuil_intervalle || 0) > 0;
      const effectiveMeterReading =
        releveNum > 0
          ? releveNum
          : isCounterTask
          ? Math.max(0, Number(t.compteur_actuel ?? t.dernier_releve ?? 0))
          : 0;
      const meterAdvancement =
        isCounterTask && effectiveMeterReading > 0
          ? {
              dernier_releve: effectiveMeterReading,
              ...MeterService.advanceTaskThresholdOnExecution(t, effectiveMeterReading),
            }
          : releveNum > 0
          ? {
              dernier_releve: releveNum,
              compteur_actuel: releveNum,
            }
          : {};

      return {
        ...t,
        etat: 'Fait',
        validation_status: 'APPROVED',
        last_pending_execution_id: '',
        pending_compteur_releve: undefined,
        pieces_proposees: execution.sparesProposed || [],
        validated_by_id: execution.validated_by_id || 'admin',
        validated_by_name: execution.validated_by_name || 'Administrateur',
        validated_at: execution.validated_at || nowIso,
        validation_note: execution.validation_note || '',
        derniere_realisation: dateRealisation,
        lastExecutedAt: dateRealisation,
        ...(previousDue ? { echeance_precedente: previousDue } : {}),
        prochaine_echeance: nextDue,
        technicien_realisateur: execution.executorName || t.responsable,
        observations_validation: execution.notes || '',
        duree_reelle: validationData?.duree_reelle || `${execution.durationMinutes} min`,
        cout_cumule: Number((prevCost + addedCost).toFixed(2)),
        ...(execution.id_composant ? { id_composant: execution.id_composant } : {}),
        ...(execution.nom_composant ? { nom_composant: execution.nom_composant } : {}),
        ...(execution.id_part ? { id_part: execution.id_part } : {}),
        ...(execution.nom_part ? { nom_part: execution.nom_part } : {}),
        ...meterAdvancement,
        planning: nextPlanning,
        updated_at: nowIso,
      };
    });
    this.saveTasks(updated);
    return updated;
  }

  /**
   * Nettoyage et injection de données normalisées (usage interne après validation FK machine)
   */
  static injectRealData(tasksArray) {
    if (!Array.isArray(tasksArray)) return [];

    const sanitized = tasksArray.map((t, idx) => {
      const rawMachine = String(t?.id_machine || '').trim().toUpperCase();
      if (!rawMachine || rawMachine === 'GLOBAL') {
        throw new Error(
          `INTEGRITY_ERROR : Tâche préventive ligne ${idx + 1} sans id_machine enregistré valide (GLOBAL interdit).`
        );
      }
      const cleanMach = rawMachine.replace(/[^a-zA-Z0-9]/g, '');
      const cleanComp = String(t.composant || 'COMP').trim().replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      const taskSeq = String(idx + 1).padStart(4, '0');
      const actCode = (t.action_code || 'C').toUpperCase();
      const freq = t.frequence || 'Mensuel';

      let planning = t.planning;
      if (!planning || typeof planning !== 'object' || Object.keys(planning).length === 0) {
        planning = { S1: actCode };
      }

      return {
        ...t,
        id: t.id || `ID-PREV-${cleanMach}-${cleanComp}-${freq.slice(0, 3).toUpperCase()}-${taskSeq}-${idx + 1}`,
        code: t.code || `PREV-${cleanMach}-${cleanComp}-${taskSeq.slice(-3)}`,
        id_machine: rawMachine,
        nom_machine: t.nom_machine || `Machine ${rawMachine}`,
        id_zone: String(t.id_zone || '').trim(),
        composant: t.composant || 'Machine entière',
        action_code: actCode,
        frequence: freq,
        planning,
        etat: t.etat || 'À faire',
        responsable: t.responsable || 'Technicien',
        duree_estimee: t.duree_estimee || '15 min',
      };
    });

    this.saveTasks(sanitized);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('preventive_tasks_updated', { detail: sanitized }));
    }
    return sanitized;
  }

  /**
   * Import depuis fichier Excel avec contrôle FK strict sur ASSETS_MACHINES actives (INGEST-GOV-P9)
   */
  static async importFromExcel(file) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    if (workbook.SheetNames.some((n) => n.trim().toUpperCase() === 'README_TYPE_A')) {
      throw new Error(
        'TYPE_A_REDIRECT : Ce classeur officiel Type A doit être importé via Paramètres ➔ Ingestion Structurée (Mode B).'
      );
    }

    const storedMachines = loadCollection<any[]>(STORAGE_KEYS.MACHINES, {
      allowDemoFallback: false,
      demoSeed: [],
    });
    const activeMachines = (Array.isArray(storedMachines) ? storedMachines : []).filter(
      (m) => m && m.is_active !== false && String(m.status || '').toUpperCase() !== 'ARCHIVEE'
    );
    const machineMap = new Map<string, { id: string; designation: string; id_zone: string }>();
    activeMachines.forEach((m) => {
      const code = String(m.id_machine_registered || '').trim().toUpperCase();
      if (code) {
        machineMap.set(code, {
          id: m.id_machine_registered,
          designation: String(m.designation || m.id_machine_registered),
          id_zone: String(m.id_zone_default || ''),
        });
      }
    });

    const parsedTasks: any[] = [];
    const fkErrors: string[] = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) return;
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      rows.forEach((row, rowIdx) => {
        const rawMachine = String(
          row['id_machine'] || row['Code Machine'] || row['Machine ID'] || row['Machine'] || ''
        )
          .trim()
          .toUpperCase();
        if (!rawMachine || rawMachine === 'GLOBAL') {
          fkErrors.push(`${sheetName}#${rowIdx + 2} : id_machine obligatoire et non GLOBAL.`);
          return;
        }
        const matched = machineMap.get(rawMachine);
        if (!matched) {
          fkErrors.push(
            `${sheetName}#${rowIdx + 2} : machine "${rawMachine}" introuvable ou archivée dans ASSETS_MACHINES.`
          );
          return;
        }
        parsedTasks.push({
          ...row,
          id_machine: matched.id,
          nom_machine: String(row['nom_machine'] || matched.designation),
          id_zone: String(row['id_zone'] || matched.id_zone),
          composant: String(row['Composant'] || row['composant'] || 'Machine entière').trim(),
          action_code: String(row['Action'] || row['action_code'] || 'C').trim().toUpperCase(),
          frequence: String(row['Frequence'] || row['frequence'] || 'Mensuel').trim(),
          priorite: String(row['Priorite'] || row['priorite'] || 'Normale').trim(),
          created_at: new Date().toISOString(),
        });
      });
    });

    if (fkErrors.length > 0) {
      throw new Error(
        `Import préventif Excel rejeté (${fkErrors.length} erreur(s) FK) : ${fkErrors.slice(0, 3).join(' | ')}`
      );
    }
    if (parsedTasks.length === 0) {
      throw new Error('Aucune tâche préventive valide détectée dans le classeur Excel.');
    }

    const existing = this.getTasks();
    return this.injectRealData([...parsedTasks, ...(Array.isArray(existing) ? existing : [])]);
  }

  /**
   * Backdoor historique /data/preventive/*.json fermée définitivement (INGEST-GOV-P9)
   */
  static async loadFromPublicJson() {
    Logger.warn('[TaskService] Blocked legacy loadFromPublicJson() backdoor call.');
    throw new Error(
      'LEGACY_BACKDOOR_BLOCKED : Le chargement direct des fichiers publics /data/preventive/*.json est désactivé. Utilisez Mode C (Démo) ou Mode B (PM_CATALOG Type A + TaskImportModal FK vérifiée).'
    );
  }
}

export default TaskService;
