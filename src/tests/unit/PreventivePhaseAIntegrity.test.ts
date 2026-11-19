import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { SecurityService } from '../../core/security/SecurityService';
import { MeterService } from '../../application/services/meter/MeterService';
import { PlanService } from '../../application/services/preventive/PlanService';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';
import PreventiveService from '../../application/services/PreventiveService';
import {
  computeNextDueDateForMode,
  computeTaskCycleStatus,
  hasApprovedExecutionInPeriod,
  resolvePreventiveLaborRate,
  sanitizeCsvCell,
} from '../../domain/preventive/preventiveScheduleEngine';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { StockCalculationService } from '../../core/domain/services/StockCalculationService';

function setTestSession(role: string, id = 'USR-1', nom = 'Test User') {
  SecurityService.saveSessionSecure('gmao_session_v2', {
    payload: { id, userId: id, nom, name: nom, role },
  });
}

function clearTestSession() {
  try {
    SecurityService.removeSecure('gmao_session_v2');
  } catch {
    sessionStorage.clear();
  }
}

describe('Preventive Maintenance — Phase A Security, Maker-Checker, Stock & Lifecycle Integrity', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearTestSession();

    useGmaoStore.setState({
      machines: [
        {
          id_machine_registered: 'M-100',
          code: 'M-100',
          designation: 'Presse Hydraulique 100T',
          id_zone_default: 'Atelier A',
          status: 'ACTIVE',
          compteur_heures: 1000,
          dernier_releve_compteur: 1000,
          compteur_unite_defaut: 'Heures',
        } as any,
      ],
      rawStock: [
        {
          ref: 'FILT-HYD-01',
          designation: 'Filtre Hydraulique HP',
          stockInitial: 5,
          prixUnitaire: 0,
          prix_achat_ht: 120,
          unite: 'pcs',
        } as any,
      ],
      mouvements: [],
      technicians: [
        {
          id_technician: 'TECH-01',
          nom: 'Karim',
          taux_horaire: 80,
          role: 'TECHNICIEN',
        } as any,
      ],
      preventiveTasks: [
        {
          id: 'PRV-TASK-1',
          code: 'PRV-001',
          id_machine: 'M-100',
          nom_machine: 'Presse Hydraulique 100T',
          composant: 'Centrale Hydraulique',
          action_code: 'V',
          frequence: 'Mensuel',
          mode_calcul_recurrence: 'GLISSANT',
          type_declencheur: 'HYBRIDE',
          compteur_unite: 'Heures',
          compteur_seuil_intervalle: 500,
          compteur_dernier_declenchement: 1000,
          compteur_prochain_declenchement: 1500,
          compteur_marge_alerte: 50,
          compteur_actuel: 1000,
          responsable: 'Karim',
          etat: 'À faire',
          prochaine_echeance: '2026-11-25',
          cout_cumule: 0,
          planning: { S47: 'V' },
        } as any,
      ],
      preventiveExecutions: [],
      preventivePlans: [],
      preventiveActions: [],
      preventiveGuides: [],
      meterReadings: [],
      correctiveInterventions: [],
      auditEvents: [],
    });
  });

  afterEach(() => {
    clearTestSession();
  });

  describe('1. Session RBAC & Maker-Checker Enforcement (Store + Service)', () => {
    it('forces TECHNICIEN into PENDING_VALIDATION even if submitForValidation=false, with zero stock deduction and zero machine counter mutation', () => {
      setTestSession('TECHNICIEN', 'TECH-01', 'Karim');

      const res = useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        submitForValidation: false, // Attempted bypass
        date_realisation: '2026-11-19',
        duree_reelle_min: 60,
        technicien: 'Karim',
        compteur_releve: 1520,
        usedPDR: [{ ref: 'FILT-HYD-01', designation: 'Filtre Hydraulique HP', quantite: 2 }],
      });

      expect(res).toBeTruthy();
      const state = useGmaoStore.getState();

      // Execution must be strictly PENDING_VALIDATION
      expect(state.preventiveExecutions.length).toBe(1);
      expect(state.preventiveExecutions[0].validation_status).toBe('PENDING_VALIDATION');
      expect(state.preventiveExecutions[0].compteur_releve).toBe(1520);

      // Zero stock deduction
      expect(state.mouvements.length).toBe(0);
      const stockActuel = StockCalculationService.calculateStockActuel(
        state.rawStock[0] as any,
        state.mouvements as any
      );
      expect(stockActuel).toBe(5);

      // Machine counter must NOT be mutated while pending approval
      expect((state.machines[0] as any).compteur_heures).toBe(1000);
      expect(state.meterReadings.length).toBe(0);
      expect((state.preventiveTasks[0] as any).etat).toBe('En attente validation');
      expect((state.preventiveTasks[0] as any).compteur_actuel).toBe(1000);
    });

    it('blocks TECHNICIEN from supervisor approval, task deletion, execution deletion, plan creation, factory clear, and bulk import', () => {
      setTestSession('TECHNICIEN', 'TECH-01', 'Karim');
      useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        date_realisation: '2026-11-19',
        duree_reelle_min: 30,
        technicien: 'Karim',
      });
      const execId = useGmaoStore.getState().preventiveExecutions[0].id;

      // Attempt self-approval
      const reviewRes = useGmaoStore.getState().handleReviewPreventiveExecutionValidation(execId, {
        decision: 'APPROVED',
      });
      expect(reviewRes).toBeNull();
      expect(useGmaoStore.getState().preventiveExecutions[0].validation_status).toBe('PENDING_VALIDATION');

      // Attempt task delete
      useGmaoStore.getState().handleDeleteTask('PRV-TASK-1');
      expect(useGmaoStore.getState().preventiveTasks.length).toBe(1);

      // Attempt execution delete
      useGmaoStore.getState().handleDeletePreventiveExecution(execId);
      expect(useGmaoStore.getState().preventiveExecutions.length).toBe(1);

      // Attempt plan creation
      const planRes = useGmaoStore.getState().handleCreatePlanWithTasks(
        { id_machine: 'M-100', nom_machine: 'Presse' },
        [{ composant: 'Pompe', action_code: 'C', frequence: 'Mensuel' }]
      );
      expect(planRes?.tasks || []).toHaveLength(0);
      expect(useGmaoStore.getState().preventivePlans.length).toBe(0);
      expect(useGmaoStore.getState().preventiveTasks.length).toBe(1);

      // Attempt clear factory
      useGmaoStore.getState().handleClearPreventiveForRealFactory();
      expect(useGmaoStore.getState().preventiveTasks.length).toBe(1);

      // Attempt bulk import in service
      expect(() =>
        PreventiveService.bulkImportTasks(
          [{ id_machine: 'M-100', composant: 'Test', action_code: 'C', frequence: 'Mensuel' }],
          false,
          { actorRole: 'TECHNICIEN' }
        )
      ).toThrow(/RBAC_DENIED/i);
    });

    it('approving a pending execution deducts stock, advances meter thresholds, syncs machine counter, and logs audit', () => {
      setTestSession('TECHNICIEN', 'TECH-01', 'Karim');
      useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        date_realisation: '2026-11-19',
        duree_reelle_min: 60,
        technicien: 'Karim',
        compteur_releve: 1520,
        usedPDR: [{ ref: 'FILT-HYD-01', designation: 'Filtre Hydraulique HP', quantite: 2 }],
      });
      const execId = useGmaoStore.getState().preventiveExecutions[0].id;

      // Switch to RESPONSABLE and approve
      setTestSession('RESPONSABLE', 'RESP-1', 'Chef Maintenance');
      const approved = useGmaoStore.getState().handleReviewPreventiveExecutionValidation(execId, {
        decision: 'APPROVED',
      });

      expect(approved?.validation_status).toBe('APPROVED');
      const state = useGmaoStore.getState();

      // Stock deducted: 5 - 2 = 3; price fallback prix_achat_ht = 120 -> sparesCost = 240
      // Real technician hourly rate = 80 DH/h * 1h = 80 -> totalCost = 320
      expect(state.mouvements.length).toBe(1);
      expect(
        StockCalculationService.calculateStockActuel(state.rawStock[0] as any, state.mouvements as any)
      ).toBe(3);
      expect(state.preventiveExecutions[0].sparesCost).toBe(240);
      expect(state.preventiveExecutions[0].laborRate).toBe(80);
      expect(state.preventiveExecutions[0].totalCost).toBe(320);

      // Meter counter synced and next threshold advanced: 1520 + 500 = 2020
      expect((state.machines[0] as any).compteur_heures).toBe(1520);
      expect(state.meterReadings.length).toBe(1);
      expect((state.preventiveTasks[0] as any).compteur_dernier_declenchement).toBe(1520);
      expect((state.preventiveTasks[0] as any).compteur_prochain_declenchement).toBe(2020);
      expect(state.auditEvents.length).toBeGreaterThan(0);
    });
  });

  describe('2. Stock Integrity, Double-Deduction Guard, Follow-Up DI & Execution Deletion Rollback', () => {
    it('blocks direct completion when stock is insufficient with zero partial mutation', () => {
      setTestSession('ADMIN', 'ADM-1', 'Admin');

      const res = useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        date_realisation: '2026-11-19',
        duree_reelle_min: 30,
        technicien: 'Karim',
        usedPDR: [{ ref: 'FILT-HYD-01', designation: 'Filtre Hydraulique HP', quantite: 10 }],
      });

      expect(res).toBeUndefined();
      const state = useGmaoStore.getState();
      expect(state.preventiveExecutions.length).toBe(0);
      expect(state.mouvements.length).toBe(0);
      expect((state.preventiveTasks[0] as any).etat).toBe('À faire');
    });

    it('honors skipStockDeduction=true and records costs without emitting stock movements', () => {
      setTestSession('ADMIN', 'ADM-1', 'Admin');

      const res = useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        date_realisation: '2026-11-19',
        duree_reelle_min: 60,
        technicien: 'Karim',
        skipStockDeduction: true,
        usedPDR: [{ ref: 'FILT-HYD-01', designation: 'Filtre Hydraulique HP', quantite: 2 }],
      });

      expect(res).toBeTruthy();
      const state = useGmaoStore.getState();
      expect(state.mouvements.length).toBe(0);
      expect(state.preventiveExecutions[0].stock_deducted).toBe(false);
      expect(state.preventiveExecutions[0].sparesCost).toBe(240);
      expect(state.preventiveExecutions[0].laborRate).toBe(80);
      expect(state.preventiveExecutions[0].totalCost).toBe(320);
    });

    it('prevents double stock deduction when part is already covered by a Store Bon', () => {
      setTestSession('ADMIN', 'ADM-1', 'Admin');
      useGmaoStore.setState({
        mouvements: [
          {
            id: 'MVT-STORE-1',
            code_bon: 'BS-999',
            type: 'Sortie Interne',
            ref: 'FILT-HYD-01',
            quantite: 2,
            date: '2026-11-19',
          } as any,
        ],
      });

      const res = useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        date_realisation: '2026-11-19',
        duree_reelle_min: 30,
        technicien: 'Karim',
        num_bon_sortie: 'BS-999',
        usedPDR: [{ ref: 'FILT-HYD-01', designation: 'Filtre Hydraulique HP', quantite: 2 }],
      });

      expect(res).toBeTruthy();
      const state = useGmaoStore.getState();
      // Still only the original store bon movement — NO duplicate preventive movement!
      expect(state.mouvements.length).toBe(1);
      expect(
        StockCalculationService.calculateStockActuel(state.rawStock[0] as any, state.mouvements as any)
      ).toBe(3);
    });

    it('creates a linked Corrective DI on direct approval when createFollowUpDi=true', () => {
      setTestSession('ADMIN', 'ADM-1', 'Admin');

      useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        date_realisation: '2026-11-19',
        duree_reelle_min: 45,
        technicien: 'Karim',
        createFollowUpDi: true,
        followUpDiDescription: 'Fuite joint vérin constatée pendant vidange',
        followUpDiPriority: 'Urgente',
      });

      const state = useGmaoStore.getState();
      expect(state.correctiveInterventions.length).toBe(1);
      expect((state.correctiveInterventions[0] as any).source).toBe('AUTO_DI_PREVENTIF');
      expect((state.correctiveInterventions[0] as any).statut).toBe('DEMANDE');
      expect(state.preventiveExecutions[0].generated_di_id).toBe(
        (state.correctiveInterventions[0] as any).id
      );
    });

    it('rolls back linked stock movements and recomputes task.cout_cumule on execution deletion', () => {
      setTestSession('ADMIN', 'ADM-1', 'Admin');

      useGmaoStore.getState().handleMarkTaskDone('PRV-TASK-1', {
        date_realisation: '2026-11-19',
        duree_reelle_min: 60,
        technicien: 'Karim',
        usedPDR: [{ ref: 'FILT-HYD-01', designation: 'Filtre Hydraulique HP', quantite: 2 }],
      });

      const execBefore = useGmaoStore.getState().preventiveExecutions[0];
      expect(useGmaoStore.getState().mouvements.length).toBe(1);
      expect((useGmaoStore.getState().preventiveTasks[0] as any).cout_cumule).toBe(320);

      useGmaoStore.getState().handleDeletePreventiveExecution(execBefore.id);

      const stateAfter = useGmaoStore.getState();
      expect(stateAfter.preventiveExecutions.length).toBe(0);
      expect(stateAfter.mouvements.length).toBe(0);
      expect(
        StockCalculationService.calculateStockActuel(
          stateAfter.rawStock[0] as any,
          stateAfter.mouvements as any
        )
      ).toBe(5);
      expect((stateAfter.preventiveTasks[0] as any).cout_cumule).toBe(0);
    });
  });

  describe('3. Recurring Cycle Engine, Period Matching, FIXE vs GLISSANT & Profile Honesty', () => {
    it('supports both GLISSANT and FIXE recurrence next-due-date calculation without drift', () => {
      // Executed 4 days late (2026-11-05 vs due 2026-11-01) on Mensuel (30d)
      const glissant = computeNextDueDateForMode('2026-11-05', 'Mensuel', 'GLISSANT', '2026-11-01');
      const fixe = computeNextDueDateForMode('2026-11-05', 'Mensuel', 'FIXE', '2026-11-01');

      expect(glissant).toBe('2026-12-05');
      expect(fixe).toBe('2026-12-01');
    });

    it('prevents permanent Fait freeze by dynamically re-opening recurring tasks on lead window and overdue date', () => {
      const doneTask = {
        id: 'T-1',
        etat: 'Fait',
        frequence: 'Mensuel',
        derniere_realisation: '2026-11-01',
        prochaine_echeance: '2026-12-01',
      };

      // Right after execution -> Fait
      expect(computeTaskCycleStatus(doneTask, { today: '2026-11-05' }).effectiveEtat).toBe('Fait');

      // Entering lead window (within 7 days of 2026-12-01) -> re-opens to À faire
      expect(computeTaskCycleStatus(doneTask, { today: '2026-11-26' }).effectiveEtat).toBe('À faire');

      // Past due date -> En retard
      const lateEval = computeTaskCycleStatus(doneTask, { today: '2026-12-03' });
      expect(lateEval.effectiveEtat).toBe('En retard');
      expect(lateEval.isOverdue).toBe(true);
    });

    it('marks only the executed period as done via hasApprovedExecutionInPeriod', () => {
      const executions: any[] = [
        {
          id: 'EX-1',
          taskId: 'T-1',
          executedAt: '2026-11-10',
          periodMonth: '2026-11',
          periodWeek: 'S46',
          validation_status: 'APPROVED',
          status: 'COMPLETED',
        },
        {
          id: 'EX-2',
          taskId: 'T-1',
          executedAt: '2026-11-17',
          periodMonth: '2026-11',
          periodWeek: 'S47',
          validation_status: 'PENDING_VALIDATION',
          status: 'COMPLETED',
        },
      ];

      expect(hasApprovedExecutionInPeriod('T-1', '2026-11-10', 'S46', executions)).toBe(true);
      expect(hasApprovedExecutionInPeriod('T-1', '2026-11-17', 'S47', executions)).toBe(false);
      expect(hasApprovedExecutionInPeriod('T-1', '2026-11-24', 'S48', executions)).toBe(false);
    });

    it('resolves real technician hourly rate before falling back to 35 DH/h', () => {
      const techs = [{ id_technician: 'TECH-01', nom: 'Karim', taux_horaire: 85 }];
      expect(resolvePreventiveLaborRate(techs, 'Karim')).toBe(85);
      expect(resolvePreventiveLaborRate(techs, 'Inconnu')).toBe(35);
      expect(resolvePreventiveLaborRate(techs, 'Karim', 110)).toBe(110);
    });

    it('returns Non planifiée (0% compliance) instead of 100% Optimal when a machine has 0 tasks', () => {
      const profile = PreventiveService.getMachinePreventiveProfile('M-UNPLANNED');
      expect(profile.total_tasks).toBe(0);
      expect(profile.compliance_rate).toBe(0);
      expect(profile.health_status).toBe('Non planifiée');
    });
  });

  describe('4. Meter Monotonicity, Explicit Reset, PlanService Propagation & Deduplication', () => {
    it('rejects non-monotonic decrease unless allowMeterReset=true, and re-opens Fait counter tasks', () => {
      const machines = [{ id_machine_registered: 'M-100', compteur_heures: 1000 }];
      const tasks = [
        {
          id: 'T-CNT',
          id_machine: 'M-100',
          type_declencheur: 'COMPTEUR',
          compteur_seuil_intervalle: 500,
          compteur_dernier_declenchement: 1000,
          compteur_prochain_declenchement: 1500,
          compteur_actuel: 1000,
          etat: 'Fait',
        },
      ];

      // Decreasing value rejected by default
      expect(() =>
        MeterService.recordReading(
          { machineId: 'M-100', valeur: 800, unite: 'Heures' },
          [],
          machines,
          tasks
        )
      ).toThrow(/NON_MONOTONIC_READING/);

      // Explicit meter replacement allowed
      const resetRes = MeterService.recordReading(
        { machineId: 'M-100', valeur: 10, unite: 'Heures', allowMeterReset: true },
        [],
        machines,
        tasks
      );
      expect(resetRes.newReading.isMeterReset).toBe(true);
      expect(resetRes.newReading.delta).toBe(10);

      // Crossing threshold re-opens a Fait counter task to En retard
      const overdueRes = MeterService.recordReading(
        { machineId: 'M-100', valeur: 1550, unite: 'Heures' },
        [],
        machines,
        tasks
      );
      expect(overdueRes.updatedTasks[0].etat).toBe('En retard');
    });

    it('propagates COMPTEUR/HYBRIDE fields and uses dynamic current year in PlanService.createPlanWithTasks', () => {
      const res = PlanService.createPlanWithTasks(
        { id_machine: 'M-100', nom_machine: 'Presse 100T', id_zone: 'Atelier A' },
        [
          {
            composant: 'Filtre',
            action_code: 'V',
            frequence: 'Mensuel',
            mode_calcul_recurrence: 'FIXE',
            type_declencheur: 'HYBRIDE',
            compteur_unite: 'Heures',
            compteur_seuil_intervalle: 500,
            compteur_actuel: 1000,
            compteur_marge_alerte: 50,
          },
        ]
      );

      expect(res.plan.code).toContain(String(new Date().getFullYear()));
      expect(res.plan.code).not.toContain('2025');
      expect(res.tasks[0].mode_calcul_recurrence).toBe('FIXE');
      expect(res.tasks[0].type_declencheur).toBe('HYBRIDE');
      expect(res.tasks[0].compteur_seuil_intervalle).toBe(500);
      expect(res.tasks[0].compteur_prochain_declenchement).toBe(1500);
    });

    it('deduplicates pending/clarification resubmissions by taskId in ExecutionService.recordExecution', () => {
      const first = ExecutionService.recordExecution(
        { id: 'T-DUP', id_machine: 'M-100', composant: 'Pompe', action_code: 'C' },
        {
          submitForValidation: true,
          date_realisation: '2026-11-19',
          observations: 'First claim',
        }
      );
      const second = ExecutionService.recordExecution(
        { id: 'T-DUP', id_machine: 'M-100', composant: 'Pompe', action_code: 'C' },
        {
          submitForValidation: true,
          date_realisation: '2026-11-19',
          observations: 'Updated claim',
        }
      );

      expect(first.id).toBe(second.id);
      const allExecs = ExecutionService.getExecutions();
      expect(allExecs.filter((e) => String(e.taskId) === 'T-DUP').length).toBe(1);
      expect(allExecs[0].notes).toBe('Updated claim');
    });
  });

  describe('5. CSV Injection Neutralization & Snapshot Recovery', () => {
    it('neutralizes spreadsheet formula prefixes and safely quotes CSV cells in sanitizeCsvCell', () => {
      expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe('"\'=cmd|""/C calc""!A0"');
      expect(sanitizeCsvCell('+SUM(A1:A5)')).toBe('"\'+SUM(A1:A5)"');
      expect(sanitizeCsvCell('-1+1')).toBe('"\'-1+1"');
      expect(sanitizeCsvCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
      expect(sanitizeCsvCell('Normal text')).toBe('"Normal text"');
    });

    it('recovers preventiveExecutions and meterReadings from FULL_STATE_SNAPSHOT via loadCollection', () => {
      storageService.removeItem(STORAGE_KEYS.PREVENTIVE_EXECUTIONS);
      storageService.removeItem(STORAGE_KEYS.METER_READINGS);
      localStorage.clear();
      const snapshot = {
        preventiveExecutions: [{ id: 'EX-SNAP-1', taskId: 'T-1', executedAt: '2026-11-10' }],
        meterReadings: [{ id: 'REL-SNAP-1', machineId: 'M-100', valeur: 1200 }],
      };
      storageService.setItem(STORAGE_KEYS.FULL_STATE_SNAPSHOT, snapshot);

      const restoredExecs = loadCollection(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, {
        allowDemoFallback: false,
        demoSeed: [],
      });
      const restoredReadings = loadCollection(STORAGE_KEYS.METER_READINGS, {
        allowDemoFallback: false,
        demoSeed: [],
      });

      expect(Array.isArray(restoredExecs)).toBe(true);
      expect(restoredExecs[0].id).toBe('EX-SNAP-1');
      expect(Array.isArray(restoredReadings)).toBe(true);
      expect(restoredReadings[0].id).toBe('REL-SNAP-1');
    });
  });
});
