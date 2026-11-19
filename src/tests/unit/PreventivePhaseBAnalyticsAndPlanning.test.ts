import { describe, it, expect, beforeEach } from 'vitest';
import {
  computePreventiveAnalytics,
  computeExecutionDelayDays,
  isApprovedPreventiveExecution,
} from '../../domain/preventive/preventiveAnalyticsEngine';
import { PlanService } from '../../application/services/preventive/PlanService';
import { TaskService } from '../../application/services/preventive/TaskService';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

describe('Preventive Phase B — Analytics, PDR Readiness, Plan Hygiene & Recurrence Override', () => {
  beforeEach(() => {
    localStorage.clear();
    storageService.removeItem(STORAGE_KEYS.PREVENTIVE_PLANS);
    storageService.removeItem(STORAGE_KEYS.PREVENTIVE_TASKS);
    storageService.removeItem(STORAGE_KEYS.PREVENTIVE_EXECUTIONS);
  });

  describe('preventiveAnalyticsEngine', () => {
    it('evaluates dynamic cycle status using live machine meters and calendar dates', () => {
      const tasks = [
        {
          id: 'T1',
          id_machine: 'M-01',
          id_zone: 'Z1',
          action_code: 'C',
          frequence: 'Mensuel',
          etat: 'Fait', // Stale static status, but next due date is in the past
          prochaine_echeance: '2026-04-01',
          derniere_realisation: '2026-03-01',
        },
        {
          id: 'T2',
          id_machine: 'M-02',
          id_zone: 'Z1',
          action_code: 'G',
          type_declencheur: 'COMPTEUR',
          compteur_seuil_intervalle: 500,
          compteur_actuel: 900, // Stale task counter
          compteur_prochain_declenchement: 1000,
          etat: 'À faire',
        },
        {
          id: 'T3',
          id_machine: 'M-03',
          id_zone: 'Z2',
          action_code: 'N',
          frequence: 'Mensuel',
          etat: 'Fait',
          prochaine_echeance: '2026-05-15',
          derniere_realisation: '2026-04-15',
        },
        {
          id: 'T4',
          id_machine: 'M-03',
          id_zone: 'Z2',
          action_code: 'C',
          frequence: 'Mensuel',
          etat: 'En attente validation',
          validation_status: 'PENDING_VALIDATION',
          prochaine_echeance: '2026-04-20',
        },
      ];

      const machines = [
        { id_machine_registered: 'M-01', designation: 'Presse 1', id_zone_default: 'Z1', compteur_heures: 500 },
        { id_machine_registered: 'M-02', designation: 'Compresseur 2', id_zone_default: 'Z1', compteur_heures: 1050 }, // Exceeds 1000!
        { id_machine_registered: 'M-03', designation: 'Convoyeur 3', id_zone_default: 'Z2', compteur_heures: 200 },
      ];

      const report = computePreventiveAnalytics({
        tasks,
        machines,
        today: '2026-04-16',
      });

      expect(report.overview.totalTasks).toBe(4);
      expect(report.overview.overdueCount).toBe(2); // T1 (calendar past) + T2 (live meter 1050 >= 1000)
      expect(report.overview.doneCount).toBe(1); // T3 only
      expect(report.overview.pendingValidationCount).toBe(1); // T4
      expect(report.overview.dynamicComplianceRate).toBe(25);

      const z1 = report.zonesStats.find((z) => z.zone === 'Z1');
      expect(z1?.overdue).toBe(2);
      expect(z1?.complianceRate).toBe(0);
    });

    it('computes honest OTCR punctuality and Labor vs PDR cost split strictly from APPROVED executions', () => {
      const tasks = [
        { id: 'T1', id_machine: 'M-01', action_code: 'G', id_zone: 'Z1', etat: 'Fait', prochaine_echeance: '2026-05-10', derniere_realisation: '2026-04-10' },
        { id: 'T2', id_machine: 'M-01', action_code: 'R', id_zone: 'Z1', etat: 'Fait', prochaine_echeance: '2026-05-15', derniere_realisation: '2026-04-15' },
      ];
      const executions = [
        {
          id: 'EX-1',
          taskId: 'T1',
          machineCode: 'M-01',
          actionCode: 'G',
          executedAt: '2026-04-10',
          scheduledDueDate: '2026-04-12', // On time (-2d)
          periodMonth: '2026-04',
          periodWeek: 'S15',
          durationMinutes: 60,
          laborCost: 50,
          sparesCost: 150,
          totalCost: 200,
          sparesUsed: [],
          status: 'DONE' as const,
          validation_status: 'APPROVED' as const,
        },
        {
          id: 'EX-2',
          taskId: 'T2',
          machineCode: 'M-01',
          actionCode: 'R',
          executedAt: '2026-04-15',
          scheduledDueDate: '2026-04-10', // Late (+5d)
          periodMonth: '2026-04',
          periodWeek: 'S16',
          durationMinutes: 30,
          laborCost: 25,
          sparesCost: 75,
          totalCost: 100,
          sparesUsed: [],
          status: 'DONE' as const,
          validation_status: 'APPROVED' as const,
        },
        {
          id: 'EX-PENDING',
          taskId: 'T1',
          machineCode: 'M-01',
          actionCode: 'G',
          executedAt: '2026-04-16',
          scheduledDueDate: '2026-04-10',
          periodMonth: '2026-04',
          periodWeek: 'S16',
          durationMinutes: 120,
          laborCost: 999,
          sparesCost: 999,
          totalCost: 1998,
          sparesUsed: [],
          status: 'DONE' as const,
          validation_status: 'PENDING_VALIDATION' as const,
        },
        {
          id: 'EX-REJECTED',
          taskId: 'T2',
          machineCode: 'M-01',
          actionCode: 'R',
          executedAt: '2026-04-16',
          scheduledDueDate: '2026-04-10',
          periodMonth: '2026-04',
          periodWeek: 'S16',
          durationMinutes: 60,
          laborCost: 500,
          sparesCost: 500,
          totalCost: 1000,
          sparesUsed: [],
          status: 'DONE' as const,
          validation_status: 'REJECTED' as const,
        },
      ];

      const correctiveInterventions = [
        { id: 'BT-1', id_machine: 'M-01', statut: 'CLOTURE' },
        { id: 'BT-2', id_machine: 'M-01', statut: 'EN_COURS' },
        { id: 'BT-CANCEL', id_machine: 'M-01', statut: 'ANNULEE' }, // Must be ignored
      ];

      const report = computePreventiveAnalytics({
        tasks,
        executions,
        correctiveInterventions,
        today: '2026-04-16',
      });

      expect(isApprovedPreventiveExecution(executions[0])).toBe(true);
      expect(isApprovedPreventiveExecution(executions[2])).toBe(false);
      expect(isApprovedPreventiveExecution(executions[3])).toBe(false);
      expect(computeExecutionDelayDays(executions[0])).toBe(-2);
      expect(computeExecutionDelayDays(executions[1])).toBe(5);

      expect(report.punctuality.approvedExecutionsCount).toBe(2);
      expect(report.punctuality.pendingExecutionsCount).toBe(1);
      expect(report.punctuality.rejectedExecutionsCount).toBe(1);
      expect(report.punctuality.onTimeCount).toBe(1);
      expect(report.punctuality.lateCount).toBe(1);
      expect(report.punctuality.onTimeComplianceRate).toBe(50);
      expect(report.punctuality.avgDelayDays).toBe(5);

      // Unapproved & rejected costs MUST be excluded
      expect(report.costs.totalLaborCost).toBe(75);
      expect(report.costs.totalSparesCost).toBe(225);
      expect(report.costs.totalCost).toBe(300);
      expect(report.costs.laborSharePct).toBe(25);
      expect(report.costs.sparesSharePct).toBe(75);

      // PM vs CM: 2 approved PM vs 2 active CM => 50%
      expect(report.pmCmBalance.pmCount).toBe(2);
      expect(report.pmCmBalance.cmCount).toBe(2);
      expect(report.pmCmBalance.pmRatioPct).toBe(50);
    });

    it('detects upcoming PDR stock shortages using live StockCalculationService movements', () => {
      const tasks = [
        {
          id: 'T1',
          id_machine: 'M-01',
          etat: 'À faire',
          prochaine_echeance: '2026-04-20',
          pdr_requises: [{ ref: 'FILT-01', designation: 'Filtre huile', quantite: 2 }],
        },
        {
          id: 'T2',
          id_machine: 'M-02',
          etat: 'En retard',
          prochaine_echeance: '2026-04-10',
          pdr_requises: [
            { ref: 'FILT-01', designation: 'Filtre huile', quantite: 2 },
            { ref: 'JOINT-99', designation: 'Joint spécial', quantite: 1 },
          ],
        },
        {
          id: 'T3',
          id_machine: 'M-03',
          etat: 'Fait', // Already done -> should not trigger upcoming demand
          prochaine_echeance: '2026-05-20',
          derniere_realisation: '2026-04-15',
          pdr_requises: [{ ref: 'COUR-05', designation: 'Courroie', quantite: 10 }],
        },
      ];

      const stockItems = [
        { ref: 'FILT-01', designation: 'Filtre huile', stockInitial: 5, seuil: 2 },
        { ref: 'COUR-05', designation: 'Courroie', stockInitial: 0, seuil: 1 },
      ];
      const mouvements = [
        // 3 withdrawn -> live stock for FILT-01 is 2 (required is 4 -> INSUFFISANT by 2)
        { id: 'MV-1', ref: 'FILT-01', type: 'SORTIE', quantite: 3 },
      ];

      const report = computePreventiveAnalytics({
        tasks,
        stockItems,
        mouvements,
        today: '2026-04-16',
      });

      const filtRisk = report.pdrReadinessRisks.find((r) => r.ref === 'FILT-01');
      expect(filtRisk).toBeDefined();
      expect(filtRisk?.status).toBe('INSUFFISANT');
      expect(filtRisk?.requiredQty).toBe(4);
      expect(filtRisk?.availableStock).toBe(2);
      expect(filtRisk?.shortageQty).toBe(2);
      expect(filtRisk?.impactedMachines).toEqual(['M-01', 'M-02']);

      const missingRefRisk = report.pdrReadinessRisks.find((r) => r.ref === 'JOINT-99');
      expect(missingRefRisk?.status).toBe('NON_REFERENCE');
      expect(missingRefRisk?.shortageQty).toBe(1);

      // T3 is already Fait -> COUR-05 must NOT appear in upcoming risks
      expect(report.pdrReadinessRisks.find((r) => r.ref === 'COUR-05')).toBeUndefined();
    });
  });

  describe('PlanService trigger hygiene & PDR persistence', () => {
    it('does NOT attach phantom meter thresholds to pure CALENDRIER plans even if stale meter values are passed', () => {
      const { tasks } = PlanService.createPlanWithTasks(
        {
          id_machine: 'M-CAL',
          nom_machine: 'Presse Calendrier',
          id_zone: 'Z1',
          id_technicien: 'Ali',
          type_declencheur: 'CALENDRIER',
          mode_calcul_recurrence: 'FIXE',
        },
        [
          {
            composant: 'Moteur',
            action_code: 'G',
            frequence: 'Mensuel',
            type_declencheur: 'CALENDRIER',
            compteur_seuil_intervalle: 500, // Stale leaked value must be ignored!
            pdr_ref: 'GR-01',
            pdr_designation: 'Graisse haute T°',
          },
        ]
      );

      expect(tasks).toHaveLength(1);
      expect(tasks[0].type_declencheur).toBe('CALENDRIER');
      expect(tasks[0].compteur_seuil_intervalle).toBeUndefined();
      expect(tasks[0].compteur_prochain_declenchement).toBeUndefined();
      expect(tasks[0].pdr_ref).toBe('GR-01');
      expect(tasks[0].pdr_requises).toEqual([
        { ref: 'GR-01', nom: 'Graisse haute T°', designation: 'Graisse haute T°', quantite: 1 },
      ]);
    });

    it('preserves meter thresholds on COMPTEUR and HYBRIDE plans', () => {
      const { tasks } = PlanService.createPlanWithTasks(
        {
          id_machine: 'M-COMP',
          id_zone: 'Z2',
          id_technicien: 'Karim',
          type_declencheur: 'HYBRIDE',
        },
        [
          {
            composant: 'Pompe Hydraulique',
            action_code: 'V',
            frequence: 'Trimestriel',
            type_declencheur: 'HYBRIDE',
            compteur_unite: 'Heures',
            compteur_seuil_intervalle: 250,
            compteur_actuel: 1000,
          },
        ]
      );

      expect(tasks[0].type_declencheur).toBe('HYBRIDE');
      expect(tasks[0].compteur_seuil_intervalle).toBe(250);
      expect(tasks[0].compteur_actuel).toBe(1000);
      expect(tasks[0].compteur_prochain_declenchement).toBe(1250);
    });
  });

  describe('TaskService recurrence mode override & meter advancement on execution', () => {
    it('honors mode_calcul_recurrence override and advances meter threshold from validationData.compteur_releve', () => {
      TaskService.saveTasks([
        {
          id: 'TASK-HYB-1',
          id_machine: 'M-HYB',
          composant: 'Compresseur',
          action_code: 'V',
          frequence: 'Mensuel',
          mode_calcul_recurrence: 'FIXE',
          type_declencheur: 'HYBRIDE',
          compteur_seuil_intervalle: 500,
          compteur_actuel: 1000,
          compteur_prochain_declenchement: 1500,
          prochaine_echeance: '2026-04-01',
          etat: 'À faire',
        },
      ]);

      const updated = TaskService.markTaskAsDone('TASK-HYB-1', {
        date_realisation: '2026-04-10',
        mode_calcul_recurrence: 'GLISSANT', // Override FIXE -> GLISSANT
        compteur_releve: 1520,
        technicien: 'Hassan',
        duree_reelle: '30 min',
        taux_horaire: 60,
        validation_status: 'APPROVED',
      });

      const task = updated.find((t: any) => t.id === 'TASK-HYB-1');
      expect(task).toBeDefined();
      expect(task.mode_calcul_recurrence).toBe('GLISSANT');
      // GLISSANT: 2026-04-10 + 30 days = 2026-05-10 (NOT FIXE 2026-05-01!)
      expect(task.prochaine_echeance).toBe('2026-05-10');
      expect(task.compteur_actuel).toBe(1520);
      expect(task.compteur_prochain_declenchement).toBe(2020);

      const execs = ExecutionService.getExecutions();
      expect(execs).toHaveLength(1);
      expect(execs[0].scheduledDueDate).toBe('2026-04-01');
      expect(execs[0].laborCost).toBe(30); // 30min * 60 DH/h
    });
  });
});
