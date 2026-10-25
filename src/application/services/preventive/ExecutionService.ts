import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';
import type { PreventiveExecutionRecord, PreventiveExecutionSpareItem } from '../../../types/preventive';

export const STORAGE_KEY_EXECUTIONS = STORAGE_KEYS.PREVENTIVE_EXECUTIONS;

function parseDurationMinutes(rawDuration: unknown, fallback = 15): number {
  if (typeof rawDuration === 'number' && Number.isFinite(rawDuration)) {
    return Math.max(1, Math.round(rawDuration));
  }
  const str = String(rawDuration || '').trim().toLowerCase();
  if (!str) return fallback;
  const numMatch = str.match(/(\d+(?:[.,]\d+)?)/);
  if (!numMatch) return fallback;
  const val = parseFloat(numMatch[1].replace(',', '.'));
  if (!Number.isFinite(val) || val <= 0) return fallback;
  if (str.includes('h') && !str.includes('min')) {
    return Math.round(val * 60);
  }
  return Math.round(val);
}

function getIsoWeekLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'S1';
    const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return `S${Math.min(52, Math.max(1, weekNo))}`;
  } catch {
    return 'S1';
  }
}

export class ExecutionService {
  static getExecutions(): PreventiveExecutionRecord[] {
    return loadCollection(STORAGE_KEY_EXECUTIONS, {
      allowDemoFallback: false,
      demoSeed: [],
    }) as PreventiveExecutionRecord[];
  }

  static saveExecutions(executions: PreventiveExecutionRecord[]): PreventiveExecutionRecord[] {
    const clean = Array.isArray(executions) ? executions : [];
    try {
      storageService.setItem(STORAGE_KEY_EXECUTIONS, clean);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('preventive_executions_updated', { detail: clean }));
      }
    } catch {
      // ignore storage quota errors
    }
    return clean;
  }

  static recordExecution(task: Record<string, any> | null | undefined, validationData: Record<string, any> = {}): {
    execution: PreventiveExecutionRecord;
    executions: PreventiveExecutionRecord[];
  } {
    const nowIso = new Date().toISOString();
    const rawDate =
      validationData?.date_realisation ||
      validationData?.date_execution ||
      validationData?.executedAt ||
      nowIso.split('T')[0];

    const normalizedDate = String(rawDate).trim().slice(0, 10) || nowIso.split('T')[0];
    const periodMonth = normalizedDate.slice(0, 7);
    const periodWeek = validationData?.semaine || validationData?.periodWeek || getIsoWeekLabel(normalizedDate);

    const durationMinutes = parseDurationMinutes(
      validationData?.durationMinutes ?? validationData?.duree_reelle ?? task?.duree_estimee,
      15
    );
    const laborRate = Number(validationData?.taux_horaire ?? validationData?.laborRate ?? 35) || 0;

    const rawSpares = Array.isArray(validationData?.sparesProposed)
      ? validationData.sparesProposed
      : Array.isArray(validationData?.usedPDR)
      ? validationData.usedPDR
      : Array.isArray(validationData?.sparesUsed)
      ? validationData.sparesUsed
      : Array.isArray(validationData?.pieces_utilisees)
      ? validationData.pieces_utilisees
      : Array.isArray(validationData?.pieces_proposees)
      ? validationData.pieces_proposees
      : [];

    const parsedSpares: PreventiveExecutionSpareItem[] = rawSpares
      .map((s: any) => {
        const ref = String(s?.ref || s?.reference || s?.code || '').trim();
        const qty = Number(s?.qty ?? s?.quantite ?? 1);
        const unitPrice = Number(s?.unitPrice ?? s?.prix_unitaire ?? s?.prix ?? 0);
        return {
          ref,
          designation: String(s?.designation || ref || 'PDR').trim(),
          qty: Number.isFinite(qty) && qty > 0 ? qty : 1,
          unit: String(s?.unit || s?.unite || 'pcs'),
          unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
        };
      })
      .filter((s: PreventiveExecutionSpareItem) => Boolean(s.ref || s.designation));

    const isPendingValidation =
      validationData?.submitForValidation === true ||
      String(validationData?.validation_status || '').trim().toUpperCase() === 'PENDING_VALIDATION';

    const sparesUsed: PreventiveExecutionSpareItem[] = isPendingValidation ? [] : parsedSpares;
    const sparesProposed: PreventiveExecutionSpareItem[] = parsedSpares;

    const sparesCost = sparesUsed.reduce((sum, item) => sum + item.qty * (item.unitPrice || 0), 0);
    const laborCost = (durationMinutes / 60) * laborRate;
    const totalCost = Number((sparesCost + laborCost).toFixed(2));

    const executorName = String(
      validationData?.technicien ||
        validationData?.technicien_realisateur ||
        validationData?.executorName ||
        validationData?.submitted_by_name ||
        task?.responsable ||
        'Technicien'
    ).trim();

    const machineCode = String(task?.id_machine || validationData?.machineCode || 'GLOBAL')
      .trim()
      .toUpperCase();

    const idComposant = String(validationData?.id_composant ?? task?.id_composant ?? '').trim() || undefined;
    const nomComposant = String(validationData?.nom_composant ?? task?.nom_composant ?? '').trim() || undefined;
    const idPart = String(validationData?.id_part ?? task?.id_part ?? '').trim() || undefined;
    const nomPart = String(validationData?.nom_part ?? task?.nom_part ?? '').trim() || undefined;

    const organeLabel = String(
      task?.composant ||
        nomComposant ||
        nomPart ||
        validationData?.organe ||
        idComposant ||
        idPart ||
        'Machine entière'
    ).trim();

    const numBonTech = String(validationData?.num_bon_saisi_par_tech ?? '').trim();

    const execution: PreventiveExecutionRecord = {
      id:
        validationData?.id ||
        `EXEC-${machineCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      taskId: String(task?.id || validationData?.taskId || `TASK-${machineCode}`),
      taskCode: String(task?.code || validationData?.taskCode || ''),
      machineCode,
      machineName: String(task?.nom_machine || validationData?.machineName || machineCode),
      zone: String(task?.id_zone || task?.zone || validationData?.zone || ''),
      organe: organeLabel,
      ...(idComposant ? { id_composant: idComposant } : {}),
      ...(nomComposant ? { nom_composant: nomComposant } : {}),
      ...(idPart ? { id_part: idPart } : {}),
      ...(nomPart ? { nom_part: nomPart } : {}),
      actionCode: String(task?.action_code || validationData?.actionCode || 'C').toUpperCase(),
      taskDescription: String(
        task?.consigne || task?.type_intervention || task?.description || validationData?.taskDescription || ''
      ),
      frequence: String(task?.frequence || validationData?.frequence || 'Mensuel'),
      executedAt: normalizedDate,
      periodMonth,
      periodWeek,
      executorName,
      durationMinutes,
      laborRate,
      sparesCost: Number(sparesCost.toFixed(2)),
      totalCost,
      status:
        validationData?.status === 'SKIPPED' || validationData?.status === 'PARTIAL'
          ? validationData.status
          : 'DONE',
      notes: String(validationData?.observations ?? validationData?.notes ?? '').trim(),
      sparesUsed,
      sparesProposed,
      ...(numBonTech ? { num_bon_saisi_par_tech: numBonTech } : {}),
      validation_status: isPendingValidation ? 'PENDING_VALIDATION' : 'APPROVED',
      ...(isPendingValidation
        ? {
            submitted_by_id: String(validationData?.submitted_by_id || task?.id_technicien || executorName),
            submitted_by_name: String(validationData?.submitted_by_name || executorName),
            submitted_at: String(validationData?.submitted_at || nowIso),
            stock_deducted: false,
          }
        : {
            validated_by_id: String(validationData?.validated_by_id || 'admin'),
            validated_by_name: String(validationData?.validated_by_name || 'Administrateur'),
            validated_at: String(validationData?.validated_at || nowIso),
            stock_deducted: sparesUsed.length > 0,
          }),
      createdAt: nowIso,
    };

    const current = this.getExecutions();
    // If resubmitting a task that had a previous NEEDS_CLARIFICATION or PENDING_VALIDATION execution, replace it or prepend
    const existingPendingId = validationData?.replaceExecutionId || task?.last_pending_execution_id;
    const filteredCurrent = existingPendingId
      ? current.filter(
          (e) =>
            !(
              e.id === existingPendingId &&
              (e.validation_status === 'PENDING_VALIDATION' || e.validation_status === 'NEEDS_CLARIFICATION')
            )
        )
      : current;

    const updated = [execution, ...filteredCurrent];
    this.saveExecutions(updated);

    return { execution, executions: updated };
  }

  static updateExecution(
    executionId: string,
    updates: Partial<PreventiveExecutionRecord>
  ): {
    execution: PreventiveExecutionRecord | null;
    executions: PreventiveExecutionRecord[];
  } {
    const current = this.getExecutions();
    let updatedItem: PreventiveExecutionRecord | null = null;
    const updated = current.map((e) => {
      if (e.id === executionId) {
        updatedItem = { ...e, ...updates };
        return updatedItem;
      }
      return e;
    });
    this.saveExecutions(updated);
    return { execution: updatedItem, executions: updated };
  }

  static deleteExecution(executionId: string): PreventiveExecutionRecord[] {
    const current = this.getExecutions();
    const filtered = current.filter((e) => e.id !== executionId);
    return this.saveExecutions(filtered);
  }

  static clearExecutions(): PreventiveExecutionRecord[] {
    return this.saveExecutions([]);
  }
}

export default ExecutionService;

