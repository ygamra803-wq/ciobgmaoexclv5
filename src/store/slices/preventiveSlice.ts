import { DataGateway } from '../../application/DataGateway';
import { ActionService } from '../../application/services/preventive/ActionService';
import { GuideService } from '../../application/services/preventive/GuideService';
import { PlanService } from '../../application/services/preventive/PlanService';
import { TaskService } from '../../application/services/preventive/TaskService';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';
import { MeterService } from '../../application/services/meter/MeterService';
import SortieExterneService from '../../application/services/SortieExterneService';
import { StockCalculationService } from '../../core/domain/services/StockCalculationService';
import {
  computeNextDueDateForMode,
  resolvePreventiveLaborRate,
} from '../../domain/preventive/preventiveScheduleEngine';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { safeId } from '../../utils/safeId';
import { Logger } from '../../core/logger/LoggerService';
import type {
  GmaoStoreState,
  IPreventiveActionCatalogItem,
  IPreventiveGuideCatalogItem,
  IPreventivePlanCatalogItem,
  MeterReadingRecordPayload,
  PreventiveTaskItem,
  SortieExterneItem,
  SortieMountedPayload,
  StateUpdater,
  ValidationReviewDecisionPayload,
} from '../../types/store';
import type { IMouvement } from '../../types/domain';
import type { IMeterReading } from '../../types/meter';
import type { PreventiveExecutionRecord, PreventiveExecutionSpareItem } from '../../types/preventive';
import {
  resolveUpdate,
  trackRemovedEntityIds,
  syncCorrectiveInterventionsWithSortieRecord,
  getInitialPreventive,
  getInitialSorties,
  resolveActiveActorContext,
  resolveActiveSessionRole,
  isPartAlreadyDeductedByStoreBon,
} from './storeBootstrapSlice';

const PREVENTIVE_MANAGER_ROLES = new Set(['ADMIN', 'RESPONSABLE', 'RESPONSABLE_MAINTENANCE']);
const PREVENTIVE_EXECUTOR_ROLES = new Set([
  'ADMIN',
  'RESPONSABLE',
  'RESPONSABLE_MAINTENANCE',
  'TECHNICIEN',
]);

function resolvePreventiveRole(explicitRole?: unknown): string {
  return String(explicitRole || resolveActiveSessionRole() || '')
    .trim()
    .toUpperCase();
}

function canManagePreventiveSession(explicitRole?: unknown): boolean {
  const role = resolvePreventiveRole(explicitRole);
  if (!role) return true; // Headless unit test without active browser session
  return PREVENTIVE_MANAGER_ROLES.has(role);
}

function canExecutePreventiveSession(explicitRole?: unknown): boolean {
  const role = resolvePreventiveRole(explicitRole);
  if (!role) return true;
  return PREVENTIVE_EXECUTOR_ROLES.has(role);
}

function isFieldOnlyRole(explicitRole?: unknown): boolean {
  const role = resolvePreventiveRole(explicitRole);
  return role === 'TECHNICIEN' || role === 'OPERATEUR';
}

function resolveSpareUnitPrice(rawSpare: any, stockMatch: any): number {
  const candidates = [
    rawSpare?.unitPrice,
    rawSpare?.prix_unitaire,
    rawSpare?.prixUnitaire,
    rawSpare?.prix,
    rawSpare?.prix_achat_ht,
    stockMatch?.prix_unitaire,
    stockMatch?.prixUnitaire,
    stockMatch?.prix,
    stockMatch?.prix_achat_ht,
  ];
  for (const c of candidates) {
    const num = Number(c);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 0;
}

function normalizePreventiveSparesList(
  items: unknown,
  stockMap: Map<string, any>
): PreventiveExecutionSpareItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((s: any) => {
      const ref = String(s?.ref || s?.reference || s?.code || '').trim();
      const qty = Number(s?.qty ?? s?.quantite ?? 0);
      const stockMatch = stockMap.get(ref.toUpperCase());
      const unitPrice = resolveSpareUnitPrice(s, stockMatch);
      return {
        ref,
        designation: String(s?.designation || stockMatch?.designation || ref || 'PDR').trim(),
        qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
        unit: String(s?.unit || s?.unite || stockMatch?.unite || 'pcs'),
        unitPrice,
      };
    })
    .filter((s) => Boolean(s.ref && s.qty > 0));
}

function validatePreventiveStockSufficiency(
  spares: PreventiveExecutionSpareItem[],
  stockMap: Map<string, any>,
  currentMovements: IMouvement[],
  numBonSaisi: unknown,
  skipAllDeduction: boolean
): { valid: boolean; reason?: string } {
  if (skipAllDeduction || spares.length === 0) return { valid: true };
  const requestedByRef = new Map<string, { ref: string; qty: number }>();

  for (const sp of spares) {
    const refKey = String(sp.ref || '').trim().toUpperCase();
    if (!refKey || sp.qty <= 0) continue;
    if (isPartAlreadyDeductedByStoreBon(currentMovements, numBonSaisi, sp.ref)) continue;
    const prev = requestedByRef.get(refKey);
    if (prev) {
      prev.qty += sp.qty;
    } else {
      requestedByRef.set(refKey, { ref: sp.ref, qty: sp.qty });
    }
  }

  for (const [refKey, req] of requestedByRef.entries()) {
    const stockMatch = stockMap.get(refKey);
    if (!stockMatch) continue;
    const liveStock = StockCalculationService.calculateStockActuel(stockMatch, currentMovements);
    if (req.qty > liveStock) {
      return {
        valid: false,
        reason: `Stock insuffisant pour ${req.ref} : demandé ${req.qty}, disponible ${liveStock}.`,
      };
    }
  }

  return { valid: true };
}

type StoreSet = (
  partial: Partial<GmaoStoreState> | ((state: GmaoStoreState) => Partial<GmaoStoreState>)
) => void;
type StoreGet = () => GmaoStoreState;

export type PreventiveSliceKeys = Pick<
  GmaoStoreState,
  | 'preventiveTasks'
  | 'preventiveActions'
  | 'preventiveGuides'
  | 'preventivePlans'
  | 'preventiveExecutions'
  | 'meterReadings'
  | 'setPreventiveTasks'
  | 'setPreventiveActions'
  | 'setPreventiveGuides'
  | 'setPreventivePlans'
  | 'setPreventiveExecutions'
  | 'setMeterReadings'
  | 'handleRecordMeterReading'
  | 'handleBatchRecordMeterReadings'
  | 'handleUpdateTask'
  | 'handleDeleteTask'
  | 'handleUpdateTaskCounter'
  | 'handleMarkTaskDone'
  | 'handleReviewPreventiveExecutionValidation'
  | 'handleDeletePreventiveExecution'
  | 'handleCreatePlanWithTasks'
  | 'handleAddAction'
  | 'handleUpdateAction'
  | 'handleDeleteAction'
  | 'handleAddGuide'
  | 'handleUpdateGuide'
  | 'handleDeleteGuide'
  | 'handleResetPreventiveToBaseline'
  | 'handleClearPreventiveForRealFactory'
  | 'sortiesExterne'
  | 'setSortiesExterne'
  | 'handleAddSortieExterne'
  | 'handleUpdateSortieExterne'
  | 'handleDeleteSortieExterne'
  | 'handleMarkSortieReturned'
  | 'handleMarkSortieMounted'
  | 'handleClearSortiesForRealFactory'
  | 'handleResetSortiesToBaseline'
>;

export function createPreventiveSlice(set: StoreSet, get: StoreGet): PreventiveSliceKeys {
  const initialPreventive = getInitialPreventive();
  const initialSorties = getInitialSorties();

  return {
    preventiveTasks: initialPreventive.tasks as PreventiveTaskItem[],
    preventiveActions: initialPreventive.actions as IPreventiveActionCatalogItem[],
    preventiveGuides: initialPreventive.guides as IPreventiveGuideCatalogItem[],
    preventivePlans: initialPreventive.plans as IPreventivePlanCatalogItem[],
    preventiveExecutions: initialPreventive.executions as PreventiveExecutionRecord[],
    meterReadings: initialPreventive.meterReadings as IMeterReading[],

    setPreventiveTasks: (updater: StateUpdater<PreventiveTaskItem[]>) => {
      const prev = get().preventiveTasks || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventiveTasks', prev, next);
      DataGateway.savePreventiveTasks(next, { machines: get().machines, strict: false });
      set({ preventiveTasks: next });
    },

    setPreventiveActions: (updater: StateUpdater<IPreventiveActionCatalogItem[]>) => {
      const prev = get().preventiveActions || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventiveActions', prev, next);
      DataGateway.savePreventiveActions(next);
      set({ preventiveActions: next });
    },

    setPreventiveGuides: (updater: StateUpdater<IPreventiveGuideCatalogItem[]>) => {
      const prev = get().preventiveGuides || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventiveGuides', prev, next);
      DataGateway.savePreventiveGuides(next);
      set({ preventiveGuides: next });
    },

    setPreventivePlans: (updater: StateUpdater<IPreventivePlanCatalogItem[]>) => {
      const prev = get().preventivePlans || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventivePlans', prev, next);
      DataGateway.savePreventivePlans(next);
      set({ preventivePlans: next });
    },

    setPreventiveExecutions: (updater: StateUpdater<PreventiveExecutionRecord[]>) => {
      const prev = get().preventiveExecutions || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('preventiveExecutions', prev, next);
      DataGateway.savePreventiveExecutions(next);
      set({ preventiveExecutions: next });
    },

    setMeterReadings: (updater: StateUpdater<IMeterReading[]>) => {
      const prev = get().meterReadings || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('meterReadings', prev, next);
      DataGateway.saveMeterReadings(next);
      set({ meterReadings: next });
    },

    handleRecordMeterReading: (payload: MeterReadingRecordPayload) => {
      if (!payload || !payload.machineId) return null;
      if (!canExecutePreventiveSession()) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleRecordMeterReading');
        return null;
      }
      const result = MeterService.recordReading(
        payload,
        get().meterReadings || [],
        get().machines || [],
        get().preventiveTasks || []
      );
      MeterService.saveReadings(result.updatedReadings);
      set({ meterReadings: result.updatedReadings });
      get().setMachines(result.updatedMachines);
      get().setPreventiveTasks(result.updatedTasks);

      if (result.newReading.isMeterReset) {
        const actor = resolveActiveActorContext();
        get().appendAuditEvent({
          actorId: actor.actorId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          actionType: 'METER_RESET_RECORDED',
          entityType: 'METER_READING',
          entityId: result.newReading.id,
          before: { valeur: result.newReading.valeur_precedente, machineId: result.newReading.machineId },
          after: {
            valeur: result.newReading.valeur,
            unite: result.newReading.unite,
            commentaire: result.newReading.commentaire,
          },
        });
      }
      return result.newReading;
    },

    handleBatchRecordMeterReadings: (readingsPayload: MeterReadingRecordPayload[]) => {
      if (!Array.isArray(readingsPayload) || readingsPayload.length === 0) return [];
      if (!canExecutePreventiveSession()) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleBatchRecordMeterReadings');
        return [];
      }
      const recorded: IMeterReading[] = [];
      let currReadings = get().meterReadings || [];
      let currMachines = get().machines || [];
      let currTasks = get().preventiveTasks || [];

      for (const payload of readingsPayload) {
        if (!payload || !payload.machineId) continue;
        const result = MeterService.recordReading(payload, currReadings, currMachines, currTasks);
        currReadings = result.updatedReadings;
        currMachines = result.updatedMachines;
        currTasks = result.updatedTasks;
        recorded.push(result.newReading);
      }

      if (recorded.length > 0) {
        MeterService.saveReadings(currReadings);
        set({ meterReadings: currReadings });
        get().setMachines(currMachines);
        get().setPreventiveTasks(currTasks);
      }
      return recorded;
    },

    handleUpdateTask: (id, updates) => {
      if (!canManagePreventiveSession()) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleUpdateTask');
        return;
      }
      const prevTask = (get().preventiveTasks || []).find((t) => String(t.id) === String(id));
      get().setPreventiveTasks((prev) =>
        (prev || []).map((t) =>
          String(t.id) === String(id)
            ? { ...t, ...updates, updated_at: new Date().toISOString() }
            : t
        )
      );
      if (prevTask) {
        const actor = resolveActiveActorContext();
        get().appendAuditEvent({
          actorId: actor.actorId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          actionType: 'PREVENTIVE_TASK_UPDATED',
          entityType: 'PREVENTIVE_TASK',
          entityId: String(id),
          before: { etat: prevTask.etat, frequence: prevTask.frequence, prochaine_echeance: prevTask.prochaine_echeance },
          after: updates as Record<string, unknown>,
        });
      }
    },

    handleDeleteTask: (id) => {
      if (!canManagePreventiveSession()) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleDeleteTask');
        return;
      }
      const prevTask = (get().preventiveTasks || []).find((t) => String(t.id) === String(id));
      get().setPreventiveTasks((prev) =>
        (prev || []).filter((t) => String(t.id) !== String(id))
      );
      if (prevTask) {
        const actor = resolveActiveActorContext();
        get().appendAuditEvent({
          actorId: actor.actorId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          actionType: 'PREVENTIVE_TASK_DELETED',
          entityType: 'PREVENTIVE_TASK',
          entityId: String(id),
          before: {
            code: prevTask.code,
            id_machine: prevTask.id_machine,
            composant: prevTask.composant,
          },
          after: null,
        });
      }
    },

    handleUpdateTaskCounter: (id, newCounterValue) => {
      if (!canExecutePreventiveSession()) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleUpdateTaskCounter');
        return;
      }
      const currentTasks = get().preventiveTasks || [];
      const numericVal = Number(newCounterValue || 0);
      const target = currentTasks.find((t) => String(t.id) === String(id));
      const targetMachine = String(target?.id_machine || '').trim().toUpperCase();

      // Route through MeterService SSOT so machines, meterReadings, and preventiveTasks stay synchronized
      if (targetMachine) {
        const actor = resolveActiveActorContext();
        get().handleRecordMeterReading({
          machineId: targetMachine,
          valeur: numericVal,
          unite: (target?.compteur_unite as any) || 'Heures',
          releve_par: actor.actorName,
          source: 'MANUEL',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      const updated = currentTasks.map((t) => {
        if (String(t.id) !== String(id)) return t;
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
      });

      get().setPreventiveTasks(updated);
    },

    handleMarkTaskDone: (id, validationData: Record<string, any> = {}) => {
      if (!canExecutePreventiveSession(validationData?.actorRole)) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleMarkTaskDone');
        return undefined;
      }

      const currentTasks = get().preventiveTasks || [];
      const targetTaskBefore = currentTasks.find((t) => String(t.id) === String(id));
      const actor = resolveActiveActorContext();

      // Server/Store-enforced Maker-Checker: Technicians / Operators CANNOT self-approve
      const forcePendingValidation =
        isFieldOnlyRole(validationData?.actorRole) ||
        validationData?.submitForValidation === true ||
        String(validationData?.validation_status || '').trim().toUpperCase() === 'PENDING_VALIDATION';

      const stockMap = new Map<string, any>();
      for (const s of get().rawStock || []) {
        const refKey = String(s?.ref || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
      }

      const rawSparesInput = Array.isArray(validationData?.sparesProposed)
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
      const normalizedSpares = normalizePreventiveSparesList(rawSparesInput, stockMap);

      const skipDeduction = Boolean(validationData?.skipStockDeduction);
      const currentMovements = get().mouvements || [];
      const bonSaisi = String(
        validationData?.num_bon_saisi_par_tech ||
          validationData?.num_bon_sortie ||
          validationData?.code_bon_magasin ||
          validationData?.code_bon ||
          ''
      ).trim();

      // Pre-validate stock sufficiency BEFORE mutating any state on direct approval
      if (!forcePendingValidation && normalizedSpares.length > 0) {
        const stockCheck = validatePreventiveStockSufficiency(
          normalizedSpares,
          stockMap,
          currentMovements,
          bonSaisi,
          skipDeduction
        );
        if (!stockCheck.valid) {
          Logger.warn(`[PreventiveSlice] Blocked handleMarkTaskDone: ${stockCheck.reason}`);
          return undefined;
        }
      }

      const executorName = String(
        validationData?.technicien ||
          validationData?.technicien_realisateur ||
          validationData?.executorName ||
          validationData?.submitted_by_name ||
          targetTaskBefore?.responsable ||
          actor.actorName
      ).trim();

      const resolvedLaborRate = resolvePreventiveLaborRate(
        get().technicians || [],
        validationData?.id_technician || executorName,
        validationData?.taux_horaire ?? validationData?.laborRate
      );

      const enrichedValidationData: Record<string, any> = {
        ...validationData,
        technicien: executorName,
        taux_horaire: resolvedLaborRate,
        laborRate: resolvedLaborRate,
        sparesUsed: normalizedSpares,
        sparesProposed: normalizedSpares,
        usedPDR: normalizedSpares,
        skipStockDeduction: skipDeduction,
        ...(forcePendingValidation
          ? {
              submitForValidation: true,
              validation_status: 'PENDING_VALIDATION',
              submitted_by_id: String(validationData?.submitted_by_id || actor.actorId),
              submitted_by_name: String(validationData?.submitted_by_name || executorName || actor.actorName),
            }
          : {
              submitForValidation: false,
              validation_status: 'APPROVED',
              validated_by_id: String(validationData?.validated_by_id || actor.actorId),
              validated_by_name: String(validationData?.validated_by_name || actor.actorName),
            }),
      };

      // Keep TaskService storage aligned with Zustand store before executing markTaskAsDone
      TaskService.saveTasks(currentTasks);
      ExecutionService.saveExecutions(get().preventiveExecutions || []);

      const updatedTasks = TaskService.markTaskAsDone(id, enrichedValidationData);
      let updatedExecutions = ExecutionService.getExecutions();

      let latestExec =
        updatedExecutions.find((e) => String(e.taskId) === String(id)) || updatedExecutions[0] || null;

      if (latestExec && latestExec.validation_status === 'APPROVED') {
        const spares = Array.isArray(latestExec.sparesUsed) ? latestExec.sparesUsed : [];
        let emittedIds: string[] = Array.isArray(latestExec.emitted_movement_ids)
          ? [...latestExec.emitted_movement_ids]
          : [];

        if (!skipDeduction && spares.length > 0 && emittedIds.length === 0) {
          const bonCode = String(
            bonSaisi || latestExec.num_bon_saisi_par_tech || `BS-PRV-${latestExec.taskId}`
          ).trim();
          const newMovements: IMouvement[] = spares
            .filter(
              (sp) =>
                sp &&
                sp.ref &&
                Number(sp.qty) > 0 &&
                !isPartAlreadyDeductedByStoreBon(currentMovements, bonSaisi || bonCode, sp.ref)
            )
            .map((sp) => {
              const mvtId = safeId('MVT');
              emittedIds.push(mvtId);
              return {
                id: mvtId,
                code_bon: bonCode,
                ...(bonSaisi ? { num_bon_saisi_par_tech: bonSaisi } : {}),
                source_preventive_execution_id: latestExec!.id,
                type: 'Sortie Interne',
                ref: sp.ref,
                designation: sp.designation || sp.ref,
                quantite: Number(sp.qty),
                date: latestExec!.executedAt || new Date().toISOString().slice(0, 10),
                technicien: latestExec!.executorName,
                id_machine_registered: latestExec!.machineCode,
                id_zone: latestExec!.zone,
                action_id: 'PREVENTIVE',
                prix_unitaire: Number(sp.unitPrice || 0),
              };
            });

          if (newMovements.length > 0) {
            get().setMouvements((prev) => [...newMovements, ...(prev || [])]);
          }
        }

        // Honor createFollowUpDi on direct Admin/Supervisor completion as well!
        let generatedDiId = latestExec.generated_di_id ? String(latestExec.generated_di_id) : undefined;
        if (
          (validationData?.createFollowUpDi === true || validationData?.request_followup_di === true) &&
          !generatedDiId
        ) {
          const targetTaskAfter = updatedTasks.find((t: any) => String(t.id) === String(id));
          const diDescription = String(
            validationData?.followUpDiAnomalie ||
              validationData?.followUpDiDescription ||
              latestExec.notes ||
              `Anomalie détectée lors du préventif ${targetTaskAfter?.code || latestExec.taskId}`
          ).trim();
          const createdDi = get().handleAddDemandeIntervention({
            code_machine: String(latestExec.machineCode || targetTaskAfter?.id_machine || '').trim(),
            id_zone: latestExec.zone || targetTaskAfter?.id_zone || '',
            zone: latestExec.zone || targetTaskAfter?.id_zone || '',
            anomalie: diDescription,
            priorite: String(validationData?.followUpDiPriorite || 'HAUTE'),
            source: 'AUTO_DI_PREVENTIF',
            source_preventive_execution_id: latestExec.id,
            source_preventive_task_id: latestExec.taskId,
            intervenant: latestExec.executorName || actor.actorName,
          });
          if (createdDi?.id) {
            generatedDiId = String(createdDi.id);
          }
        }

        latestExec = {
          ...latestExec,
          stock_deducted: !skipDeduction && emittedIds.length > 0,
          skip_stock_deduction: skipDeduction,
          emitted_movement_ids: emittedIds,
          ...(generatedDiId ? { generated_di_id: generatedDiId } : {}),
        };
        updatedExecutions = updatedExecutions.map((e) =>
          String(e.id) === String(latestExec!.id) ? latestExec! : e
        );
        ExecutionService.saveExecutions(updatedExecutions);
      }

      get().setPreventiveTasks(updatedTasks);
      get().setPreventiveExecutions(updatedExecutions);

      // Update machine counter & record MeterReading ONLY on APPROVED execution (NEVER on PENDING_VALIDATION!)
      const releveNum = Number(
        validationData?.compteur_releve ?? validationData?.dernier_releve ?? 0
      );
      if (latestExec && latestExec.validation_status === 'APPROVED' && releveNum > 0) {
        const targetTask = updatedTasks.find((t: any) => String(t.id) === String(id));
        const targetMachineKey = String(
          targetTask?.id_machine || latestExec?.machineCode || ''
        )
          .trim()
          .toUpperCase();
        if (targetMachineKey) {
          try {
            const meterRes = MeterService.recordReading(
              {
                machineId: targetMachineKey,
                valeur: releveNum,
                unite: (targetTask?.compteur_unite as any) || 'Heures',
                date_releve: latestExec.executedAt || new Date().toISOString().slice(0, 10),
                releve_par: latestExec.executorName || actor.actorName,
                source: 'PREVENTIVE_EXECUTION',
                commentaire: `Exécution préventive ${targetTask?.code || id}`,
              },
              get().meterReadings || [],
              get().machines || [],
              [] // Avoid overwriting freshly-advanced task thresholds
            );
            MeterService.saveReadings(meterRes.updatedReadings);
            set({ meterReadings: meterRes.updatedReadings });
            get().setMachines(meterRes.updatedMachines);
          } catch (meterErr) {
            Logger.warn('[PreventiveSlice] Skipped non-monotonic meter sync on task execution:', meterErr);
          }
        }
      }

      if (latestExec && latestExec.validation_status === 'APPROVED') {
        get().appendAuditEvent({
          actorId: actor.actorId,
          actorName: actor.actorName,
          actorRole: actor.actorRole,
          actionType: 'PREVENTIVE_EXECUTION_APPROVED',
          entityType: 'PREVENTIVE_EXECUTION',
          entityId: latestExec.id,
          before: { taskId: String(id), etat: targetTaskBefore?.etat },
          after: {
            validation_status: 'APPROVED',
            totalCost: latestExec.totalCost,
            stock_deducted: latestExec.stock_deducted,
            emitted_movement_ids: latestExec.emitted_movement_ids || [],
            ...(latestExec.generated_di_id ? { generated_di_id: latestExec.generated_di_id } : {}),
          },
        });
      }

      return latestExec || undefined;
    },

    handleReviewPreventiveExecutionValidation: (
      executionId: string,
      decisionData: ValidationReviewDecisionPayload = {},
      onAddMouvement = null
    ) => {
      if (!canManagePreventiveSession(decisionData?.actorRole)) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleReviewPreventiveExecutionValidation');
        return null;
      }

      const currentExecs = get().preventiveExecutions || [];
      const existing = currentExecs.find((e) => String(e.id) === String(executionId));
      if (!existing) return null;
      if (String(existing.validation_status || '').toUpperCase() === 'APPROVED') {
        return null;
      }

      const nowIso = new Date().toISOString();
      const actor = resolveActiveActorContext();
      const decision = String(decisionData?.decision || 'APPROVED').trim().toUpperCase();
      const validatorId = String(decisionData?.validated_by_id || actor.actorId).trim();
      const validatorName = String(decisionData?.validated_by_name || actor.actorName).trim();
      const validationNote = String(decisionData?.validation_note || decisionData?.notes || '').trim();

      if (decision === 'NEEDS_CLARIFICATION' || decision === 'REJECTED') {
        const nextStatus = decision === 'REJECTED' ? 'REJECTED' : 'NEEDS_CLARIFICATION';
        const updatedExec: PreventiveExecutionRecord = {
          ...existing,
          validation_status: nextStatus,
          validated_by_id: validatorId,
          validated_by_name: validatorName,
          validated_at: nowIso,
          validation_note: validationNote,
          stock_deducted: false,
        };

        get().setPreventiveExecutions((prev) =>
          (prev || []).map((e) => (String(e.id) === String(executionId) ? updatedExec : e))
        );

        get().setPreventiveTasks((prev) =>
          (prev || []).map((t) => {
            if (String(t.id) !== String(existing.taskId)) return t;
            return {
              ...t,
              etat: nextStatus === 'NEEDS_CLARIFICATION' ? 'À clarifier' : 'Rejeté',
              validation_status: nextStatus,
              validation_note: validationNote,
              pending_compteur_releve: undefined,
              updated_at: nowIso,
            };
          })
        );

        get().appendAuditEvent({
          actorId: validatorId,
          actorName: validatorName,
          actorRole: actor.actorRole,
          actionType: nextStatus === 'REJECTED' ? 'VALIDATION_REJECTED' : 'VALIDATION_NEEDS_CLARIFICATION',
          entityType: 'PREVENTIVE_EXECUTION',
          entityId: existing.id,
          before: { validation_status: existing.validation_status },
          after: { validation_status: nextStatus, validation_note: validationNote },
        });
        return updatedExec;
      }

      // APPROVED branch
      const stockMap = new Map<string, any>();
      for (const s of get().rawStock || []) {
        const refKey = String(s?.ref || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
      }

      const rawApproved = Array.isArray(decisionData?.approvedSpares)
        ? decisionData.approvedSpares
        : Array.isArray(decisionData?.sparesUsed)
        ? decisionData.sparesUsed
        : existing.sparesProposed || [];

      const sparesUsed = normalizePreventiveSparesList(rawApproved, stockMap);
      const skipDeduction = Boolean(decisionData?.skipStockDeduction || existing.skip_stock_deduction);
      const currentMovements = get().mouvements || [];
      const bonCode = String(
        decisionData?.code_bon_magasin ||
          existing.num_bon_saisi_par_tech ||
          `BS-PRV-${existing.taskId}`
      ).trim();

      const stockCheck = validatePreventiveStockSufficiency(
        sparesUsed,
        stockMap,
        currentMovements,
        existing.num_bon_saisi_par_tech || bonCode,
        skipDeduction
      );
      if (!stockCheck.valid) {
        Logger.warn(`[PreventiveSlice] Blocked review approval: ${stockCheck.reason}`);
        return null;
      }

      const sparesCost = Number(
        sparesUsed.reduce((sum, s) => sum + s.qty * (s.unitPrice || 0), 0).toFixed(2)
      );
      const resolvedLaborRate = resolvePreventiveLaborRate(
        get().technicians || [],
        existing.executorName,
        existing.laborRate
      );
      const laborCost = ((Number(existing.durationMinutes) || 15) / 60) * resolvedLaborRate;
      const totalCost = Number((sparesCost + laborCost).toFixed(2));

      const emittedIds: string[] = [];
      const newMovements: IMouvement[] = skipDeduction
        ? []
        : sparesUsed
            .filter(
              (sp) =>
                !isPartAlreadyDeductedByStoreBon(
                  currentMovements,
                  existing.num_bon_saisi_par_tech || bonCode,
                  sp.ref
                )
            )
            .map((sp) => {
              const mvtId = safeId('MVT');
              emittedIds.push(mvtId);
              return {
                id: mvtId,
                code_bon: bonCode,
                num_bon_saisi_par_tech: existing.num_bon_saisi_par_tech,
                source_preventive_execution_id: existing.id,
                type: 'Sortie Interne',
                ref: sp.ref,
                designation: sp.designation,
                quantite: sp.qty,
                date: existing.executedAt || nowIso.slice(0, 10),
                technicien: existing.executorName,
                id_machine_registered: existing.machineCode,
                id_zone: existing.zone,
                action_id: 'PREVENTIVE',
                prix_unitaire: sp.unitPrice,
              };
            });

      if (newMovements.length > 0) {
        get().setMouvements((prev) => [...newMovements, ...(prev || [])]);
        if (typeof onAddMouvement === 'function') {
          for (const mv of newMovements) {
            onAddMouvement(mv);
          }
        }
      }

      const targetTask = (get().preventiveTasks || []).find(
        (t) => String(t.id) === String(existing.taskId)
      );

      let generatedDiId = existing.generated_di_id ? String(existing.generated_di_id) : undefined;
      if (decisionData?.createFollowUpDi === true && !generatedDiId) {
        const diDescription = String(
          decisionData?.followUpDiAnomalie ||
            decisionData?.followUpDiDescription ||
            existing.notes ||
            `Anomalie détectée lors du préventif ${targetTask?.code || existing.taskId}`
        ).trim();
        const createdDi = get().handleAddDemandeIntervention({
          code_machine: String(existing.machineCode || targetTask?.id_machine || '').trim(),
          id_zone: existing.zone || targetTask?.id_zone || '',
          zone: existing.zone || targetTask?.id_zone || '',
          anomalie: diDescription,
          priorite: String(decisionData?.followUpDiPriorite || 'HAUTE'),
          source: 'AUTO_DI_PREVENTIF',
          source_preventive_execution_id: existing.id,
          source_preventive_task_id: existing.taskId,
          intervenant: existing.executorName || validatorName,
        });
        if (createdDi?.id) {
          generatedDiId = String(createdDi.id);
        }
      }

      const approvedMeterReading = Number(
        decisionData?.compteur_releve ??
          existing.compteur_releve ??
          targetTask?.pending_compteur_releve ??
          0
      );

      const updatedExec: PreventiveExecutionRecord = {
        ...existing,
        laborRate: resolvedLaborRate,
        laborCost: Number(laborCost.toFixed(2)),
        sparesUsed,
        sparesCost,
        totalCost,
        ...(approvedMeterReading > 0 ? { compteur_releve: approvedMeterReading } : {}),
        validation_status: 'APPROVED',
        validated_by_id: validatorId,
        validated_by_name: validatorName,
        validated_at: nowIso,
        validation_note: validationNote,
        stock_deducted: !skipDeduction && emittedIds.length > 0,
        skip_stock_deduction: skipDeduction,
        emitted_movement_ids: emittedIds,
        ...(generatedDiId ? { generated_di_id: generatedDiId } : {}),
      };

      get().setPreventiveExecutions((prev) =>
        (prev || []).map((e) => (String(e.id) === String(executionId) ? updatedExec : e))
      );

      const targetMachineCode = String(
        existing.machineCode || targetTask?.id_machine || ''
      )
        .trim()
        .toUpperCase();

      get().setPreventiveTasks((prev) =>
        (prev || []).map((t) => {
          const isTarget = String(t.id) === String(existing.taskId);
          const isSiblingSameMachine =
            !isTarget &&
            Boolean(targetMachineCode) &&
            String(t.id_machine || '').trim().toUpperCase() === targetMachineCode;

          if (isSiblingSameMachine && approvedMeterReading > 0) {
            return {
              ...t,
              dernier_releve: approvedMeterReading,
              compteur_actuel: approvedMeterReading,
              updated_at: nowIso,
            };
          }
          if (!isTarget) return t;

          const prevCost = Number(t.cout_cumule || 0);
          const dateRealisation = existing.executedAt || nowIso.slice(0, 10);
          const previousDue = String(
            t.prochaine_echeance || t.nextDueDate || t.date_echeance || ''
          );
          const nextDue = computeNextDueDateForMode(
            dateRealisation,
            t.frequence,
            String(t.mode_calcul_recurrence || ''),
            previousDue
          );

          const isCounterTask =
            t.type_declencheur === 'COMPTEUR' ||
            t.type_declencheur === 'HYBRIDE' ||
            Number(t.compteur_seuil_intervalle || 0) > 0;
          const effectiveReading =
            approvedMeterReading > 0
              ? approvedMeterReading
              : isCounterTask
              ? Math.max(0, Number(t.compteur_actuel ?? t.dernier_releve ?? 0))
              : 0;
          const meterAdvancement =
            isCounterTask && effectiveReading > 0
              ? {
                  dernier_releve: effectiveReading,
                  ...MeterService.advanceTaskThresholdOnExecution(t, effectiveReading),
                }
              : approvedMeterReading > 0
              ? {
                  dernier_releve: approvedMeterReading,
                  compteur_actuel: approvedMeterReading,
                }
              : {};

          return {
            ...t,
            etat: 'Fait',
            validation_status: 'APPROVED',
            last_pending_execution_id: '',
            pending_compteur_releve: undefined,
            validated_by_id: validatorId,
            validated_by_name: validatorName,
            validated_at: nowIso,
            validation_note: validationNote,
            derniere_realisation: dateRealisation,
            lastExecutedAt: dateRealisation,
            ...(previousDue ? { echeance_precedente: previousDue } : {}),
            prochaine_echeance: nextDue,
            cout_cumule: Number((prevCost + totalCost).toFixed(2)),
            ...meterAdvancement,
            updated_at: nowIso,
          };
        })
      );

      // Sync machine counter & append MeterReading upon approval
      if (approvedMeterReading > 0 && targetMachineCode) {
        try {
          const meterRes = MeterService.recordReading(
            {
              machineId: targetMachineCode,
              valeur: approvedMeterReading,
              unite: (targetTask?.compteur_unite as any) || 'Heures',
              date_releve: existing.executedAt || nowIso.slice(0, 10),
              releve_par: existing.executorName || validatorName,
              source: 'PREVENTIVE_EXECUTION',
              commentaire: `Validation préventive ${targetTask?.code || existing.taskId}`,
            },
            get().meterReadings || [],
            get().machines || [],
            []
          );
          MeterService.saveReadings(meterRes.updatedReadings);
          set({ meterReadings: meterRes.updatedReadings });
          get().setMachines(meterRes.updatedMachines);
        } catch (meterErr) {
          Logger.warn('[PreventiveSlice] Skipped non-monotonic meter sync on approval:', meterErr);
        }
      }

      get().appendAuditEvent({
        actorId: validatorId,
        actorName: validatorName,
        actorRole: actor.actorRole,
        actionType: 'VALIDATION_APPROVED',
        entityType: 'PREVENTIVE_EXECUTION',
        entityId: existing.id,
        before: { validation_status: existing.validation_status },
        after: {
          validation_status: 'APPROVED',
          sparesCost,
          totalCost,
          emitted_movement_ids: emittedIds,
          ...(approvedMeterReading > 0 ? { compteur_releve: approvedMeterReading } : {}),
          ...(generatedDiId ? { generated_di_id: generatedDiId } : {}),
        },
      });

      return updatedExec;
    },

    handleDeletePreventiveExecution: (id: string) => {
      if (!canManagePreventiveSession()) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleDeletePreventiveExecution');
        return;
      }
      const currentExecs = get().preventiveExecutions || [];
      const targetExec = currentExecs.find((e) => String(e.id) === String(id));
      if (!targetExec) return;

      const remainingExecs = currentExecs.filter((e) => String(e.id) !== String(id));
      get().setPreventiveExecutions(remainingExecs);

      // Rollback any emitted stock movements linked to this execution so stock math stays exact
      const emittedSet = new Set(
        (targetExec.emitted_movement_ids || []).map((mId) => String(mId).trim()).filter(Boolean)
      );
      const currentMouvements = get().mouvements || [];
      const filteredMouvements = currentMouvements.filter((m) => {
        if (!m) return false;
        if (emittedSet.has(String(m.id || '').trim())) return false;
        if (String(m.source_preventive_execution_id || '').trim() === String(targetExec.id)) {
          return false;
        }
        return true;
      });
      if (filteredMouvements.length !== currentMouvements.length) {
        get().setMouvements(filteredMouvements);
      }

      // Recompute cumulative cost for the linked task from remaining approved executions
      if (targetExec.taskId) {
        const targetTaskIdStr = String(targetExec.taskId);
        const recomputedCost = Number(
          remainingExecs
            .filter((ex) => {
              if (String(ex.taskId || '') !== targetTaskIdStr) return false;
              const vStatus = String(ex.validation_status || 'APPROVED').toUpperCase();
              return (vStatus === 'APPROVED' || vStatus === 'NONE' || vStatus === '') && ex.status !== 'SKIPPED';
            })
            .reduce((sum, ex) => sum + (Number(ex.totalCost) || 0), 0)
            .toFixed(2)
        );
        get().setPreventiveTasks((prev) =>
          (prev || []).map((t) =>
            String(t.id) === targetTaskIdStr
              ? { ...t, cout_cumule: recomputedCost, updated_at: new Date().toISOString() }
              : t
          )
        );
      }

      const actor = resolveActiveActorContext();
      get().appendAuditEvent({
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        actionType: 'PREVENTIVE_EXECUTION_DELETED',
        entityType: 'PREVENTIVE_EXECUTION',
        entityId: targetExec.id,
        before: {
          taskId: targetExec.taskId,
          totalCost: targetExec.totalCost,
          emitted_movement_ids: targetExec.emitted_movement_ids || [],
        },
        after: {
          rolledBackMovementsCount: currentMouvements.length - filteredMouvements.length,
        },
      });
    },

    handleCreatePlanWithTasks: (planData, taskItems) => {
      if (!canManagePreventiveSession()) {
        Logger.warn('[PreventiveSlice] RBAC blocked handleCreatePlanWithTasks');
        return { plan: {} as IPreventivePlanCatalogItem, tasks: [] };
      }
      PlanService.savePlans(get().preventivePlans || []);
      TaskService.saveTasks(get().preventiveTasks || []);
      const res = PlanService.createPlanWithTasks(planData, taskItems);
      get().setPreventivePlans(PlanService.getPlans());
      get().setPreventiveTasks(TaskService.getTasks());

      const actor = resolveActiveActorContext();
      get().appendAuditEvent({
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        actionType: 'PREVENTIVE_PLAN_CREATED',
        entityType: 'PREVENTIVE_PLAN',
        entityId: String(res?.plan?.id || 'PLAN'),
        before: null,
        after: {
          id_machine: res?.plan?.id_machine,
          tasksCount: res?.tasks?.length || 0,
        },
      });
      return res;
    },

    handleAddAction: (actionData) => {
      if (!canManagePreventiveSession()) return get().preventiveActions || [];
      ActionService.saveActions(get().preventiveActions || []);
      const next = ActionService.addAction(actionData);
      get().setPreventiveActions(next);
      return next;
    },

    handleUpdateAction: (id, actionData) => {
      if (!canManagePreventiveSession()) return get().preventiveActions || [];
      ActionService.saveActions(get().preventiveActions || []);
      const next = ActionService.updateAction(id, actionData);
      get().setPreventiveActions(next);
      return next;
    },

    handleDeleteAction: (id) => {
      if (!canManagePreventiveSession()) return get().preventiveActions || [];
      ActionService.saveActions(get().preventiveActions || []);
      const next = ActionService.deleteAction(id);
      get().setPreventiveActions(next);
      return next;
    },

    handleAddGuide: (guideData) => {
      if (!canManagePreventiveSession()) return get().preventiveGuides || [];
      GuideService.saveGuides(get().preventiveGuides || []);
      const next = GuideService.addGuide(guideData);
      get().setPreventiveGuides(next);
      return next;
    },

    handleUpdateGuide: (id, guideData) => {
      if (!canManagePreventiveSession()) return get().preventiveGuides || [];
      GuideService.saveGuides(get().preventiveGuides || []);
      const next = GuideService.updateGuide(id, guideData);
      get().setPreventiveGuides(next);
      return next;
    },

    handleDeleteGuide: (id) => {
      if (!canManagePreventiveSession()) return get().preventiveGuides || [];
      GuideService.saveGuides(get().preventiveGuides || []);
      const next = GuideService.deleteGuide(id);
      get().setPreventiveGuides(next);
      return next;
    },

    handleResetPreventiveToBaseline: async () => {
      if (!canManagePreventiveSession()) {
        return { cancelled: true, restoredCount: 0, orphanCountAfter: 0 };
      }
      const isDemoMode =
        storageService.getItem(STORAGE_KEYS.DEMO_MODE, false) === true &&
        storageService.getItem(STORAGE_KEYS.START_MODE, 'empty') !== 'empty';
      if (!isDemoMode) {
        return { cancelled: true, restoredCount: 0, orphanCountAfter: 0 };
      }
      await DataGateway.loadDemoSection('preventive', {
        setPreventiveActions: get().setPreventiveActions,
        setPreventiveGuides: get().setPreventiveGuides,
        setPreventivePlans: get().setPreventivePlans,
        setPreventiveTasks: get().setPreventiveTasks,
        setPreventiveExecutions: get().setPreventiveExecutions,
        setMeterReadings: get().setMeterReadings,
      });
      const restoredTasks = get().preventiveTasks || [];
      return { cancelled: false, restoredCount: restoredTasks.length, orphanCountAfter: 0 };
    },

    handleClearPreventiveForRealFactory: async () => {
      if (!canManagePreventiveSession()) {
        return { cancelled: true, clearedCount: 0 };
      }
      const prevCount = (get().preventiveTasks || []).length;
      const prevExecCount = (get().preventiveExecutions || []).length;
      get().setPreventiveTasks([]);
      get().setPreventivePlans([]);
      get().setPreventiveExecutions([]);
      get().setMeterReadings([]);

      const actor = resolveActiveActorContext();
      get().appendAuditEvent({
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole,
        actionType: 'PREVENTIVE_FACTORY_CLEARED',
        entityType: 'PREVENTIVE_TASK',
        entityId: 'ALL',
        before: { tasksCount: prevCount, executionsCount: prevExecCount },
        after: { tasksCount: 0, executionsCount: 0 },
      });
      return { cancelled: false, clearedCount: prevCount };
    },

    sortiesExterne: initialSorties.sorties as SortieExterneItem[],

    setSortiesExterne: (updater: StateUpdater<SortieExterneItem[]>) => {
      const prev = get().sortiesExterne || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('sortiesExterne', prev, next);
      DataGateway.saveSortiesExterne(next);
      set({ sortiesExterne: next });
    },

    handleAddSortieExterne: (sortieData) => {
      const current = get().sortiesExterne || [];
      const created = SortieExterneService.addSortie(sortieData, current);
      const nextList = [created, ...current];
      get().setSortiesExterne(nextList);

      const syncedWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems || [],
        created
      );
      if (syncedWarehouse !== get().warehouseItems) {
        get().setWarehouseItems(syncedWarehouse);
      }

      const { changed, nextInterventions } = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions || [],
        created,
        nextList
      );
      if (changed) {
        get().setCorrectiveInterventions(nextInterventions);
      }

      return created as SortieExterneItem;
    },

    handleUpdateSortieExterne: (id, sortieData) => {
      const current = get().sortiesExterne || [];
      const updated = SortieExterneService.updateSortie(id, sortieData, current);
      if (!updated) return null;

      const nextList = current.map((s) => (String(s.id) === String(id) ? updated : s));
      get().setSortiesExterne(nextList);

      const syncedWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems || [],
        updated
      );
      if (syncedWarehouse !== get().warehouseItems) {
        get().setWarehouseItems(syncedWarehouse);
      }

      const { changed, nextInterventions } = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions || [],
        updated,
        nextList
      );
      if (changed) {
        get().setCorrectiveInterventions(nextInterventions);
      }

      return updated as SortieExterneItem;
    },

    handleDeleteSortieExterne: (id) => {
      get().setSortiesExterne((prev) =>
        (prev || []).filter((s) => String(s.id) !== String(id))
      );
    },

    handleMarkSortieReturned: (id, returnData) => {
      const current = get().sortiesExterne || [];
      const updated = SortieExterneService.markAsReturned(id, returnData, current);
      if (!updated) return null;

      const nextList = current.map((s) => (String(s.id) === String(id) ? updated : s));
      get().setSortiesExterne(nextList);

      const syncedWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems || [],
        updated
      );
      if (syncedWarehouse !== get().warehouseItems) {
        get().setWarehouseItems(syncedWarehouse);
      }

      const { changed, nextInterventions } = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions || [],
        updated,
        nextList
      );
      if (changed) {
        get().setCorrectiveInterventions(nextInterventions);
      }

      return updated as SortieExterneItem;
    },

    handleMarkSortieMounted: (id, mountData: SortieMountedPayload) => {
      const current = get().sortiesExterne || [];
      const updated = SortieExterneService.markAsMounted(id, mountData, current);
      if (!updated) return null;

      const nextList = current.map((s) => (String(s.id) === String(id) ? updated : s));
      get().setSortiesExterne(nextList);

      const syncedWarehouse = SortieExterneService.syncWarehouseItemsWithSortie(
        get().warehouseItems || [],
        updated
      );
      if (syncedWarehouse !== get().warehouseItems) {
        get().setWarehouseItems(syncedWarehouse);
      }

      const { changed, nextInterventions } = syncCorrectiveInterventionsWithSortieRecord(
        get().correctiveInterventions || [],
        updated,
        nextList
      );
      if (changed) {
        get().setCorrectiveInterventions(nextInterventions);
      }

      return updated as SortieExterneItem;
    },

    handleClearSortiesForRealFactory: async () => {
      const count = (get().sortiesExterne || []).length;
      get().setSortiesExterne([]);
      return { cancelled: false, clearedCount: count };
    },

    handleResetSortiesToBaseline: () => {
      const baseline = SortieExterneService.resetToBaseline();
      get().setSortiesExterne(baseline);
      return { cancelled: false, count: baseline.length };
    },
  };
}
