import { describe, it, expect, beforeEach } from 'vitest';
import { ExecutionService } from '../../application/services/preventive/ExecutionService';
import { TaskService } from '../../application/services/preventive/TaskService';
import {
  isDateInPeriod,
  getMonthFromDate,
  normalizeDateToYMD,
  type PeriodFilterState,
} from '../../utils/datePeriodUtils';
import { MonthlyReportCalculationService } from '../../application/services/MonthlyReportCalculationService';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { DataGateway } from '../../application/DataGateway';

describe('Phase P1: Event-Sourced Factory Memory & Period Metrics', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    storageService.clearCache?.();
  });

  describe('P1.1 & P1.2: PreventiveExecution Event Sourcing and Recurrence Calculation', () => {
    it('should create an immutable execution record with technician, duration and cost', () => {
      const task = {
        id: 'TASK-DET-01',
        code: 'PRV-DET-01',
        id_machine: 'DET-05',
        nom_machine: 'Détoureuse 05',
        composant: 'Broche',
        action_code: 'G',
        frequence: 'Mensuel',
        responsable: 'Amine B.',
      };

      const validationData = {
        date_realisation: '2026-10-15',
        technicien: 'Karim M.',
        durationMinutes: 45,
        laborRate: 40,
        notes: 'Graissage complet effectué avec graisse haute température',
        usedPDR: [
          { ref: 'GRAISSE-HT', designation: 'Cartouche graisse HT', qty: 2, unitPrice: 15, unit: 'cartouche' },
        ],
      };

      const { execution } = ExecutionService.recordExecution(task, validationData);

      expect(execution.id).toBeDefined();
      expect(execution.taskId).toBe('TASK-DET-01');
      expect(execution.machineCode).toBe('DET-05');
      expect(execution.executedAt).toBe('2026-10-15');
      expect(execution.periodMonth).toBe('2026-10');
      expect(execution.executorName).toBe('Karim M.');
      expect(execution.durationMinutes).toBe(45);
      expect(execution.sparesCost).toBe(30); // 2 * 15
      // Labor cost: 45/60 * 40 = 30 DT. Total = 30 + 30 = 60 DT
      expect(execution.totalCost).toBe(60);
      expect(execution.sparesUsed.length).toBe(1);

      const all = ExecutionService.getExecutions();
      expect(all.length).toBeGreaterThanOrEqual(1);
      expect(all[0].id).toBe(execution.id);
    });

    it('should update task next due date automatically when marking task as done', () => {
      const initialTask = {
        id: 'TPL-HEBDO-01',
        code: 'PRV-MOT-01',
        id_machine: 'PRH-09',
        frequence: 'Hebdomadaire',
        responsable: 'Technicien 1',
        etat: 'À faire',
      };

      TaskService.saveTasks([initialTask]);

      const updatedTasks = TaskService.markTaskAsDone('TPL-HEBDO-01', {
        date_realisation: '2026-10-10',
        technicien: 'Sami K.',
      });

      const updated = updatedTasks.find((t: any) => t.id === 'TPL-HEBDO-01');
      expect(updated).toBeDefined();
      expect(updated.etat).toBe('Fait');
      expect(updated.derniere_realisation).toBe('2026-10-10');
      // Weekly frequency (+7 days): next due date should be 2026-10-17
      expect(updated.prochaine_echeance).toBe('2026-10-17');
    });
  });

  describe('P1.3 & P1.4: Date Period Utilities and Filtering', () => {
    it('should normalize different date formats into YYYY-MM-DD', () => {
      expect(normalizeDateToYMD('2026-10-18T14:30:00Z')).toBe('2026-10-18');
      expect(normalizeDateToYMD('18/10/2026')).toBe('2026-10-18');
      expect(normalizeDateToYMD('2026-10-18')).toBe('2026-10-18');
      expect(getMonthFromDate('2026-10-18')).toBe('2026-10');
    });

    it('should filter dates correctly by custom month', () => {
      const monthFilter: PeriodFilterState = {
        preset: 'CUSTOM_MONTH',
        selectedMonth: '2026-10',
      };

      expect(isDateInPeriod('2026-10-01', monthFilter)).toBe(true);
      expect(isDateInPeriod('2026-10-31', monthFilter)).toBe(true);
      expect(isDateInPeriod('2026-09-30', monthFilter)).toBe(false);
      expect(isDateInPeriod('2026-11-01', monthFilter)).toBe(false);
    });

    it('should filter dates correctly by custom range', () => {
      const rangeFilter: PeriodFilterState = {
        preset: 'CUSTOM_RANGE',
        startDate: '2026-10-10',
        endDate: '2026-10-20',
      };

      expect(isDateInPeriod('2026-10-09', rangeFilter)).toBe(false);
      expect(isDateInPeriod('2026-10-10', rangeFilter)).toBe(true);
      expect(isDateInPeriod('2026-10-15', rangeFilter)).toBe(true);
      expect(isDateInPeriod('2026-10-20', rangeFilter)).toBe(true);
      expect(isDateInPeriod('2026-10-21', rangeFilter)).toBe(false);
    });
  });

  describe('P1.5: Monthly Factory Report Calculation Service', () => {
    it('should calculate complete monthly metrics accurately', () => {
      const stockItems = [
        { ref: 'ROUL-01', designation: 'Roulement 6204', stockActuel: 10, seuil: 5, prix_unitaire: 25 },
        { ref: 'JOINT-02', designation: 'Joint spi', stockActuel: 0, seuil: 4, prix_unitaire: 8 }, // RUPTURE
        { ref: 'HUILE-03', designation: 'Huile ISO 68', stockActuel: 3, seuil: 5, prix_unitaire: 12 }, // ALERTE
      ];

      const mouvements = [
        { date: '2026-10-05', ref: 'ROUL-01', quantite: 2, type: 'Sortie Interne', prix_unitaire: 25 },
        { date: '2026-10-12', ref: 'ROUL-01', quantite: 4, type: 'Sortie Interne', prix_unitaire: 25 },
        { date: '2026-10-15', ref: 'HUILE-03', quantite: 10, type: 'Entrée', prix_unitaire: 12 },
        { date: '2026-09-20', ref: 'ROUL-01', quantite: 5, type: 'Sortie Interne', prix_unitaire: 25 }, // Other month
      ];

      const correctiveInterventions = [
        {
          id: 'BT-01',
          code_machine: 'DET-05',
          date_demande: '2026-10-08',
          statut: 'CLOTURE',
          downtimeHours: 2.5,
          pdr_cost: 50,
        },
        {
          id: 'BT-02',
          code_machine: 'DET-05',
          date_demande: '2026-10-14',
          statut: 'EN_COURS',
          downtimeHours: 1.5,
          pdr_cost: 30,
        },
      ];

      const executions = [
        {
          id: 'EXEC-01',
          taskId: 'TASK-1',
          executedAt: '2026-10-09',
          periodMonth: '2026-10',
          totalCost: 75,
          durationMinutes: 60,
        },
      ] as any[];

      const preventiveTasks = [{ id: 'TASK-1' }, { id: 'TASK-2' }];

      const report = MonthlyReportCalculationService.calculateMonthlyReport({
        month: '2026-10',
        stockItems,
        mouvements,
        correctiveInterventions,
        preventiveTasks,
        preventiveExecutions: executions,
      });

      // Stock Valuation: (10 * 25) + (0 * 8) + (3 * 12) = 250 + 36 = 286 DT
      expect(report.stockValuationTotal).toBe(286);
      expect(report.ruptureCount).toBe(1);
      expect(report.alerteCount).toBe(1);

      // Movements in Oct 2026:
      // Sorties: (2 + 4) * 25 = 150 DT
      expect(report.monthSortiesCount).toBe(2);
      expect(report.monthConsumptionCost).toBe(150);
      expect(report.monthEntriesCost).toBe(120); // 10 * 12
      expect(report.topConsumedParts.length).toBe(1);
      expect(report.topConsumedParts[0].ref).toBe('ROUL-01');
      expect(report.topConsumedParts[0].quantity).toBe(6);

      // Corrective:
      expect(report.correctiveCount).toBe(2);
      expect(report.correctiveClosedCount).toBe(1);
      expect(report.totalDowntimeHours).toBe(4); // 2.5 + 1.5
      expect(report.topFailingMachines[0].machineCode).toBe('DET-05');

      // Preventive:
      expect(report.preventiveExecutedCount).toBe(1);
      expect(report.preventiveTotalCost).toBe(75);
      expect(report.preventiveLaborHours).toBe(1);
      expect(report.preventiveDisciplineRate).toBe(50); // 1 executed out of 2 scheduled = 50%
    });
  });

  describe('P1.6: Clear Factory Persistence for Executions', () => {
    it('should clear preventive executions completely upon clearAllForRealFactory', () => {
      ExecutionService.recordExecution(
        { id: 'T-1', id_machine: 'M-1' },
        { date_realisation: '2026-10-18' }
      );
      expect(ExecutionService.getExecutions().length).toBe(1);

      DataGateway.clearAllForRealFactory();

      expect(ExecutionService.getExecutions().length).toBe(0);
      expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_EXECUTIONS)).toEqual([]);
    });
  });
});
