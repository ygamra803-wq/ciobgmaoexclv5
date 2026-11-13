import { DataGateway } from '../../application/DataGateway';
import { PreventiveService } from '../../application/services/PreventiveService';
import { ActionService } from '../../application/services/preventive/ActionService';
import { GuideService } from '../../application/services/preventive/GuideService';
import { PlanService } from '../../application/services/preventive/PlanService';
import { TaskService, computeNextDueDate } from '../../application/services/preventive/TaskService';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';
import { MeterService } from '../../application/services/meter/MeterService';
import SortieExterneService from '../../application/services/SortieExterneService';
import { safeId } from '../../utils/safeId';
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
} from './storeBootstrapSlice';

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
      return result.newReading;
    },

    handleBatchRecordMeterReadings: (readingsPayload: MeterReadingRecordPayload[]) => {
      if (!Array.isArray(readingsPayload) || readingsPayload.length === 0) return [];
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
      get().setPreventiveTasks((prev) =>
        (prev || []).map((t) =>
          String(t.id) === String(id)
            ? { ...t, ...updates, updated_at: new Date().toISOString() }
            : t
        )
      );
    },

    handleDeleteTask: (id) => {
      get().setPreventiveTasks((prev) =>
        (prev || []).filter((t) => String(t.id) !== String(id))
      );
    },

    handleUpdateTaskCounter: (id, newCounterValue) => {
      const currentTasks = get().preventiveTasks || [];
      const numericVal = Number(newCounterValue || 0);
      const target = currentTasks.find((t) => String(t.id) === String(id));
      const targetMachine = String(target?.id_machine || '').trim().toUpperCase();
      const nowIso = new Date().toISOString();

      const updated = currentTasks.map((t) => {
        const isSameTask = String(t.id) === String(id);
        const isSameMachine =
          Boolean(targetMachine) &&
          String(t.id_machine || '').trim().toUpperCase() === targetMachine;
        if (!isSameTask && !isSameMachine) return t;

        const isCounter = t.type_declencheur === 'COMPTEUR' || t.type_declencheur === 'HYBRIDE';
        const targetVal = Number(t.compteur_prochain_declenchement || 0);
        const isOverdue = targetVal > 0 && numericVal >= targetVal;
        let etat = t.etat;
        if (isCounter && t.etat !== 'Fait' && t.etat !== 'En attente validation') {
          if (isOverdue) etat = 'En retard';
          else if (etat === 'En retard' && !isOverdue) etat = 'À faire';
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
      const currentTasks = get().preventiveTasks || [];
      const stockMap = new Map<string, any>();
      for (const s of get().rawStock || []) {
        const refKey = String(s?.ref || '').trim().toUpperCase();
        if (refKey) stockMap.set(refKey, s);
      }

      const resolveSparePrices = (items: any) =>
        Array.isArray(items)
          ? items.map((s: any) => {
              const ref = String(s?.ref || s?.reference || s?.code || '').trim();
              const stockMatch = stockMap.get(ref.toUpperCase());
              const rawPrice = Number(s?.unitPrice ?? s?.prix_unitaire ?? s?.prix ?? 0);
              const stockPrice = Number(stockMatch?.prix_unitaire ?? stockMatch?.prixUnitaire ?? stockMatch?.prix ?? 0) || 0;
              const unitPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : stockPrice;
              return {
                ...s,
                ref,
                designation: String(s?.designation || stockMatch?.designation || ref || 'PDR').trim(),
                unitPrice,
              };
            })
          : items;

      const enrichedValidationData = {
        ...validationData,
        ...(Array.isArray(validationData?.sparesUsed)
          ? { sparesUsed: resolveSparePrices(validationData.sparesUsed) }
          : {}),
        ...(Array.isArray(validationData?.sparesProposed)
          ? { sparesProposed: resolveSparePrices(validationData.sparesProposed) }
          : {}),
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
        if (spares.length > 0 && !(latestExec.emitted_movement_ids?.length)) {
          const bonCode = String(
            latestExec.num_bon_saisi_par_tech || `BS-PRV-${latestExec.taskId}`
          ).trim();
          const emittedIds: string[] = [];
          const newMovements: IMouvement[] = spares
            .filter((sp) => sp && sp.ref && Number(sp.qty) > 0)
            .map((sp) => {
              const mvtId = safeId('MVT');
              emittedIds.push(mvtId);
              return {
                id: mvtId,
                code_bon: bonCode,
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

          latestExec = {
            ...latestExec,
            stock_deducted: true,
            emitted_movement_ids: emittedIds,
          };
          updatedExecutions = updatedExecutions.map((e) =>
            String(e.id) === String(latestExec!.id) ? latestExec! : e
          );
          ExecutionService.saveExecutions(updatedExecutions);
        }
      }

      get().setPreventiveTasks(updatedTasks);
      get().setPreventiveExecutions(updatedExecutions);

      const releveNum = Number(
        validationData?.compteur_releve ?? validationData?.dernier_releve ?? 0
      );
      if (releveNum > 0) {
        const targetTask = updatedTasks.find((t: any) => String(t.id) === String(id));
        const targetMachineKey = String(
          targetTask?.id_machine || latestExec?.machineCode || ''
        )
          .trim()
          .toUpperCase();
        if (targetMachineKey) {
          get().setMachines((prev) =>
            (prev || []).map((m: any) => {
              const mKeys = [m?.id_machine_registered, m?.code, m?.id]
                .filter(Boolean)
                .map((v) => String(v).trim().toUpperCase());
              if (!mKeys.includes(targetMachineKey)) return m;
              return {
                ...m,
                compteur_heures: releveNum,
                compteur_actuel: releveNum,
                dernier_releve_compteur: releveNum,
              };
            })
          );
        }
      }

      return latestExec || undefined;
    },

    handleReviewPreventiveExecutionValidation: (
      executionId: string,
      decisionData: ValidationReviewDecisionPayload = {},
      onAddMouvement = null
    ) => {
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

      const sparesUsed: PreventiveExecutionSpareItem[] = rawApproved
        .map((s: any) => {
          const ref = String(s?.ref || s?.reference || s?.code || '').trim();
          const qty = Number(s?.qty ?? s?.quantite ?? 0);
          const stockMatch = stockMap.get(ref.toUpperCase());
          const rawUnitPrice = Number(s?.unitPrice ?? s?.prix_unitaire ?? s?.prix ?? 0);
          const stockPrice =
            Number(stockMatch?.prix_unitaire ?? stockMatch?.prixUnitaire ?? stockMatch?.prix ?? 0) || 0;
          const unitPrice =
            Number.isFinite(rawUnitPrice) && rawUnitPrice > 0 ? rawUnitPrice : stockPrice;
          return {
            ref,
            designation: String(s?.designation || stockMatch?.designation || ref || 'PDR').trim(),
            qty: Number.isFinite(qty) && qty > 0 ? qty : 0,
            unit: String(s?.unit || s?.unite || 'pcs'),
            unitPrice: Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0,
          };
        })
        .filter((s) => Boolean(s.ref && s.qty > 0));

      const sparesCost = Number(
        sparesUsed.reduce((sum, s) => sum + s.qty * (s.unitPrice || 0), 0).toFixed(2)
      );
      const laborCost = ((Number(existing.durationMinutes) || 15) / 60) * (Number(existing.laborRate) || 35);
      const totalCost = Number((sparesCost + laborCost).toFixed(2));
      const bonCode = String(
        decisionData?.code_bon_magasin ||
          existing.num_bon_saisi_par_tech ||
          `BS-PRV-${existing.taskId}`
      ).trim();

      const emittedIds: string[] = [];
      const newMovements: IMouvement[] = sparesUsed.map((sp) => {
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

      const updatedExec: PreventiveExecutionRecord = {
        ...existing,
        sparesUsed,
        sparesCost,
        totalCost,
        validation_status: 'APPROVED',
        validated_by_id: validatorId,
        validated_by_name: validatorName,
        validated_at: nowIso,
        validation_note: validationNote,
        stock_deducted: sparesUsed.length > 0,
        emitted_movement_ids: emittedIds,
        ...(generatedDiId ? { generated_di_id: generatedDiId } : {}),
      };

      get().setPreventiveExecutions((prev) =>
        (prev || []).map((e) => (String(e.id) === String(executionId) ? updatedExec : e))
      );

      get().setPreventiveTasks((prev) =>
        (prev || []).map((t) => {
          if (String(t.id) !== String(existing.taskId)) return t;
          const prevCost = Number(t.cout_cumule || 0);
          const dateRealisation = existing.executedAt || nowIso.slice(0, 10);
          const nextDue = computeNextDueDate(dateRealisation, t.frequence);
          return {
            ...t,
            etat: 'Fait',
            validation_status: 'APPROVED',
            last_pending_execution_id: '',
            validated_by_id: validatorId,
            validated_by_name: validatorName,
            validated_at: nowIso,
            validation_note: validationNote,
            derniere_realisation: dateRealisation,
            lastExecutedAt: dateRealisation,
            prochaine_echeance: nextDue,
            cout_cumule: Number((prevCost + totalCost).toFixed(2)),
            updated_at: nowIso,
          };
        })
      );

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
          ...(generatedDiId ? { generated_di_id: generatedDiId } : {}),
        },
      });

      return updatedExec;
    },

    handleDeletePreventiveExecution: (id: string) => {
      get().setPreventiveExecutions((prev) =>
        (prev || []).filter((e) => String(e.id) !== String(id))
      );
    },

    handleCreatePlanWithTasks: (planData, taskItems) => {
      PlanService.savePlans(get().preventivePlans || []);
      TaskService.saveTasks(get().preventiveTasks || []);
      const res = PlanService.createPlanWithTasks(planData, taskItems);
      get().setPreventivePlans(PlanService.getPlans());
      get().setPreventiveTasks(TaskService.getTasks());
      return res;
    },

    handleAddAction: (actionData) => {
      ActionService.saveActions(get().preventiveActions || []);
      const next = ActionService.addAction(actionData);
      get().setPreventiveActions(next);
      return next;
    },

    handleUpdateAction: (id, actionData) => {
      ActionService.saveActions(get().preventiveActions || []);
      const next = ActionService.updateAction(id, actionData);
      get().setPreventiveActions(next);
      return next;
    },

    handleDeleteAction: (id) => {
      ActionService.saveActions(get().preventiveActions || []);
      const next = ActionService.deleteAction(id);
      get().setPreventiveActions(next);
      return next;
    },

    handleAddGuide: (guideData) => {
      GuideService.saveGuides(get().preventiveGuides || []);
      const next = GuideService.addGuide(guideData);
      get().setPreventiveGuides(next);
      return next;
    },

    handleUpdateGuide: (id, guideData) => {
      GuideService.saveGuides(get().preventiveGuides || []);
      const next = GuideService.updateGuide(id, guideData);
      get().setPreventiveGuides(next);
      return next;
    },

    handleDeleteGuide: (id) => {
      GuideService.saveGuides(get().preventiveGuides || []);
      const next = GuideService.deleteGuide(id);
      get().setPreventiveGuides(next);
      return next;
    },

    handleResetPreventiveToBaseline: async () => {
      const seedTasks = Array.isArray(TaskService.getTasks()) ? TaskService.getTasks() : [];
      const baselineActions = PreventiveService.getActions();
      const baselineGuides = PreventiveService.getGuides();
      get().setPreventiveActions(baselineActions);
      get().setPreventiveGuides(baselineGuides);
      get().setPreventiveTasks(seedTasks);
      return { cancelled: false, restoredCount: seedTasks.length, orphanCountAfter: 0 };
    },

    handleClearPreventiveForRealFactory: async () => {
      const prevCount = (get().preventiveTasks || []).length;
      get().setPreventiveTasks([]);
      get().setPreventivePlans([]);
      get().setPreventiveExecutions([]);
      get().setMeterReadings([]);
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
