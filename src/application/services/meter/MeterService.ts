/**
 * Meter & Counter-based Maintenance Domain Service (GMAO / CMMS)
 * 
 * Governs Horomètres, production cycles, and kilometer readings.
 * Evaluates threshold triggers for preventive tasks and maintains an immutable audit ledger of readings.
 */

import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';
import type { IMeterReading, MeterEvaluationResult, MeterTriggerStatus, MeterUnit } from '../../../types/meter';

export class MeterService {
  /**
   * Load all recorded meter readings from canonical storage (Zero silent demo seeds)
   */
  static getReadings(): IMeterReading[] {
    return loadCollection<IMeterReading>(STORAGE_KEYS.METER_READINGS, {
      allowDemoFallback: false,
      demoSeed: [],
    });
  }

  /**
   * Save meter readings collection
   */
  static saveReadings(readings: IMeterReading[]): IMeterReading[] {
    const clean = Array.isArray(readings) ? readings : [];
    try {
      storageService.setItem(STORAGE_KEYS.METER_READINGS, clean);
    } catch (err) {
      console.warn('[MeterService] Storage error saving meter readings:', err);
    }
    return clean;
  }

  /**
   * Evaluate whether a task's counter trigger condition has been reached
   */
  static evaluateTaskTrigger(task: any, machineCurrentValue?: number): MeterEvaluationResult {
    const unit: MeterUnit = task.compteur_unite || 'Heures';
    const interval = Math.max(1, Number(task.compteur_seuil_intervalle) || 500);
    const lastDoneAt = Math.max(0, Number(task.compteur_dernier_declenchement || 0));
    
    // Fallback: if prochain_declenchement is unset, it is lastDoneAt + interval
    const targetValue = Number(task.compteur_prochain_declenchement) > 0
      ? Number(task.compteur_prochain_declenchement)
      : lastDoneAt + interval;

    const currentVal = machineCurrentValue !== undefined
      ? Math.max(0, Number(machineCurrentValue) || 0)
      : Math.max(0, Number(task.compteur_actuel || 0));

    // Warning margin: default 10% of interval (e.g. 50h before a 500h interval)
    const margin = Math.max(1, Number(task.compteur_marge_alerte) || Math.round(interval * 0.10));
    const warningThreshold = Math.max(0, targetValue - margin);

    const remainingValue = Math.max(0, targetValue - currentVal);
    
    // Progress calculation between lastDoneAt and targetValue
    const span = Math.max(1, targetValue - lastDoneAt);
    const elapsed = Math.max(0, currentVal - lastDoneAt);
    const percentProgress = Math.min(100, Math.round((elapsed / span) * 100));

    let status: MeterTriggerStatus = 'OK';
    let isOverdue = false;
    let isWarning = false;
    let message = `${remainingValue} ${unit} restantes`;

    if (currentVal >= targetValue) {
      status = 'OVERDUE';
      isOverdue = true;
      const overshoot = currentVal - targetValue;
      message = overshoot > 0 
        ? `Seuil dépassé de +${overshoot} ${unit}`
        : `Seuil atteint (${targetValue} ${unit})`;
    } else if (currentVal >= warningThreshold) {
      status = 'WARNING';
      isWarning = true;
      message = `Alerte: plus que ${remainingValue} ${unit} avant échéance`;
    }

    return {
      status,
      currentValue: currentVal,
      targetValue,
      intervalValue: interval,
      remainingValue,
      percentProgress,
      unit,
      isOverdue,
      isWarning,
      message,
    };
  }

  /**
   * Evaluate a HYBRID task (whichever comes first: Calendar due date OR Counter threshold)
   */
  static evaluateHybridTask(task: any, machineCurrentValue?: number, todayStr?: string): {
    isDue: boolean;
    isWarning: boolean;
    primaryTrigger: 'CALENDAR' | 'METER' | 'BOTH' | 'NONE';
    meterEval: MeterEvaluationResult;
    calendarDue: boolean;
    calendarDaysDiff: number;
    summary: string;
  } {
    const today = todayStr || new Date().toISOString().split('T')[0];
    const meterEval = this.evaluateTaskTrigger(task, machineCurrentValue);
    
    const dueDate = task.prochaine_echeance || task.nextDueDate || '';
    let calendarDue = false;
    let calendarWarning = false;
    let calendarDaysDiff = 9999;

    if (dueDate) {
      const targetTime = new Date(dueDate).getTime();
      const currTime = new Date(today).getTime();
      calendarDaysDiff = Math.round((targetTime - currTime) / (1000 * 60 * 60 * 24));
      if (calendarDaysDiff <= 0) {
        calendarDue = true;
      } else if (calendarDaysDiff <= 7) {
        calendarWarning = true;
      }
    }

    const isDue = meterEval.isOverdue || calendarDue;
    const isWarning = !isDue && (meterEval.isWarning || calendarWarning);

    let primaryTrigger: 'CALENDAR' | 'METER' | 'BOTH' | 'NONE' = 'NONE';
    if (meterEval.isOverdue && calendarDue) {
      primaryTrigger = 'BOTH';
    } else if (meterEval.isOverdue) {
      primaryTrigger = 'METER';
    } else if (calendarDue) {
      primaryTrigger = 'CALENDAR';
    }

    let summary = 'En attente';
    if (isDue) {
      if (primaryTrigger === 'BOTH') summary = 'Échue par compteur et date calendaire';
      else if (primaryTrigger === 'METER') summary = `Échue par compteur (${meterEval.message})`;
      else summary = `Échue par date (${dueDate})`;
    } else if (isWarning) {
      summary = meterEval.isWarning 
        ? `Alerte compteur: ${meterEval.message}`
        : `Alerte date: dans ${calendarDaysDiff} j`;
    }

    return {
      isDue,
      isWarning,
      primaryTrigger,
      meterEval,
      calendarDue,
      calendarDaysDiff,
      summary,
    };
  }

  /**
   * Record a new reading for a machine with strict delta computation and monotonic integrity
   */
  static recordReading(
    payload: {
      machineId: string;
      valeur: number;
      unite?: MeterUnit;
      date_releve?: string;
      releve_par?: string;
      source?: IMeterReading['source'];
      commentaire?: string;
    },
    currentReadings: IMeterReading[] = [],
    machines: any[] = [],
    tasks: any[] = []
  ): {
    newReading: IMeterReading;
    updatedReadings: IMeterReading[];
    updatedMachines: any[];
    updatedTasks: any[];
  } {
    const rawVal = Number(payload.valeur);
    const newNumericVal = Math.max(0, isNaN(rawVal) ? 0 : rawVal);
    const targetMachineCode = String(payload.machineId || '').trim().toUpperCase();
    const dateStr = payload.date_releve || new Date().toISOString().split('T')[0];
    const techName = String(payload.releve_par || 'Opérateur').trim();
    const unit: MeterUnit = payload.unite || 'Heures';
    const source = payload.source || 'MANUEL';
    const nowIso = new Date().toISOString();

    // 1. Find previous reading for this machine
    const previousForMach = currentReadings
      .filter((r) => String(r.machineId || '').trim().toUpperCase() === targetMachineCode)
      .sort((a, b) => new Date(b.createdAt || b.date_releve).getTime() - new Date(a.createdAt || a.date_releve).getTime())[0];

    const matchedMach = machines.find((m) => {
      const code = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
      return code === targetMachineCode;
    });

    const previousValue = previousForMach
      ? Number(previousForMach.valeur || 0)
      : Number(matchedMach?.compteur_heures ?? matchedMach?.dernier_releve_compteur ?? 0);

    const delta = Math.max(0, newNumericVal - previousValue);

    const newReading: IMeterReading = {
      id: `REL-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      machineId: targetMachineCode,
      machineDesignation: matchedMach?.designation || `Machine ${targetMachineCode}`,
      valeur: newNumericVal,
      valeur_precedente: previousValue,
      delta,
      unite: unit,
      compteur_type: 'PRINCIPAL',
      date_releve: dateStr,
      releve_par: techName,
      source,
      commentaire: payload.commentaire || (delta > 0 ? `+${delta} ${unit} cumulées` : undefined),
      createdAt: nowIso,
    };

    const updatedReadings = [newReading, ...currentReadings];

    // 2. Update Machines list
    const updatedMachines = machines.map((m) => {
      const code = String(m.id_machine_registered || m.id || m.code || '').trim().toUpperCase();
      if (code === targetMachineCode) {
        return {
          ...m,
          compteur_heures: unit === 'Heures' ? newNumericVal : (m.compteur_heures ?? newNumericVal),
          compteur_cycles: unit === 'Cycles' ? newNumericVal : m.compteur_cycles,
          compteur_km: unit === 'Km' ? newNumericVal : m.compteur_km,
          dernier_releve_compteur: newNumericVal,
          date_releve_compteur: dateStr,
        };
      }
      return m;
    });

    // 3. Update Tasks for this machine and evaluate trigger status
    const updatedTasks = tasks.map((t) => {
      const taskMach = String(t.id_machine || '').trim().toUpperCase();
      if (taskMach !== targetMachineCode) return t;

      const isCounterBased = t.type_declencheur === 'COMPTEUR' || t.type_declencheur === 'HYBRIDE';
      const evalResult = this.evaluateTaskTrigger(t, newNumericVal);

      let nextEtat = t.etat;
      // If task is not already done or pending validation, update etat to 'En retard' or 'À faire'
      if (t.etat !== 'Fait' && t.etat !== 'En attente validation') {
        if (evalResult.isOverdue) {
          nextEtat = 'En retard';
        } else if (t.etat === 'En retard' && !evalResult.isOverdue && isCounterBased) {
          nextEtat = 'À faire';
        }
      }

      return {
        ...t,
        compteur_actuel: newNumericVal,
        dernier_releve: newNumericVal,
        ...(isCounterBased
          ? {
              etat: nextEtat,
              compteur_statut_declenchement: evalResult.status,
              compteur_restant: evalResult.remainingValue,
            }
          : {}),
        updated_at: nowIso,
      };
    });

    return {
      newReading,
      updatedReadings,
      updatedMachines,
      updatedTasks,
    };
  }

  /**
   * Advance task threshold upon completion of maintenance
   */
  static advanceTaskThresholdOnExecution(task: any, executedReading: number): {
    compteur_dernier_declenchement: number;
    compteur_actuel: number;
    compteur_prochain_declenchement: number;
  } {
    const reading = Math.max(0, Number(executedReading || 0));
    const interval = Math.max(1, Number(task.compteur_seuil_intervalle || 500));
    const nextTarget = reading + interval;

    return {
      compteur_dernier_declenchement: reading,
      compteur_actuel: reading,
      compteur_prochain_declenchement: nextTarget,
    };
  }
}
