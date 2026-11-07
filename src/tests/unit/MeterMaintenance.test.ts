import { describe, it, expect, beforeEach } from 'vitest';
import { MeterService } from '../../application/services/meter/MeterService';
import type { IMeterReading } from '../../types/meter';

describe('Meter & Counter-based Maintenance Engine (ISO 14224 / CMMS)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. Single & Monotonic Meter Reading', () => {
    it('records a new reading with correct delta calculation', () => {
      const initialReadings: IMeterReading[] = [
        {
          id: 'REL-001',
          machineId: 'COMP-01',
          valeur: 4000,
          valeur_precedente: 3800,
          delta: 200,
          unite: 'Heures',
          date_releve: '2026-11-01',
          releve_par: 'Hassan',
          source: 'MANUEL',
          createdAt: '2026-11-01T08:00:00Z',
        },
      ];

      const machines = [
        { id_machine_registered: 'COMP-01', designation: 'Compresseur Atlas', compteur_heures: 4000 },
      ];

      const tasks = [
        {
          id: 'PRV-101',
          id_machine: 'COMP-01',
          type_declencheur: 'COMPTEUR',
          compteur_unite: 'Heures',
          compteur_seuil_intervalle: 500,
          compteur_prochain_declenchement: 4500,
          compteur_actuel: 4000,
          etat: 'À faire',
        },
      ];

      const result = MeterService.recordReading(
        {
          machineId: 'COMP-01',
          valeur: 4250,
          unite: 'Heures',
          releve_par: 'Youssef',
          source: 'MANUEL',
        },
        initialReadings,
        machines,
        tasks
      );

      // Verify reading entity
      expect(result.newReading.valeur).toBe(4250);
      expect(result.newReading.valeur_precedente).toBe(4000);
      expect(result.newReading.delta).toBe(250);
      expect(result.newReading.releve_par).toBe('Youssef');
      expect(result.newReading.unite).toBe('Heures');

      // Verify updated machines
      const updatedMach = result.updatedMachines.find((m) => m.id_machine_registered === 'COMP-01');
      expect(updatedMach?.compteur_heures).toBe(4250);
      expect(updatedMach?.dernier_releve_compteur).toBe(4250);

      // Verify updated tasks
      const updatedTask = result.updatedTasks.find((t) => t.id === 'PRV-101');
      expect(updatedTask?.compteur_actuel).toBe(4250);
      expect(updatedTask?.dernier_releve).toBe(4250);
      expect(updatedTask?.etat).toBe('À faire'); // not overdue yet (4250 < 4500)
    });
  });

  describe('2. Threshold Evaluation (OK vs WARNING vs OVERDUE)', () => {
    const task = {
      id: 'TASK-500H',
      id_machine: 'M-01',
      compteur_unite: 'Heures',
      compteur_seuil_intervalle: 500,
      compteur_dernier_declenchement: 1000,
      compteur_prochain_declenchement: 1500,
      compteur_marge_alerte: 50, // warning when >= 1450
    };

    it('evaluates status as OK when well below threshold', () => {
      const evalRes = MeterService.evaluateTaskTrigger(task, 1200);
      expect(evalRes.status).toBe('OK');
      expect(evalRes.isOverdue).toBe(false);
      expect(evalRes.isWarning).toBe(false);
      expect(evalRes.remainingValue).toBe(300);
      expect(evalRes.percentProgress).toBe(40); // (1200-1000)/(1500-1000) = 40%
    });

    it('evaluates status as WARNING when approaching threshold within margin', () => {
      const evalRes = MeterService.evaluateTaskTrigger(task, 1460);
      expect(evalRes.status).toBe('WARNING');
      expect(evalRes.isOverdue).toBe(false);
      expect(evalRes.isWarning).toBe(true);
      expect(evalRes.remainingValue).toBe(40);
      expect(evalRes.percentProgress).toBe(92);
      expect(evalRes.message).toContain('40 Heures');
    });

    it('evaluates status as OVERDUE when threshold is reached or exceeded', () => {
      const evalRes = MeterService.evaluateTaskTrigger(task, 1515);
      expect(evalRes.status).toBe('OVERDUE');
      expect(evalRes.isOverdue).toBe(true);
      expect(evalRes.remainingValue).toBe(0);
      expect(evalRes.percentProgress).toBe(100);
      expect(evalRes.message).toContain('+15 Heures');
    });
  });

  describe('3. Hybrid Task Evaluation (First Due Triggers)', () => {
    const hybridTask = {
      id: 'TASK-HYBRID',
      id_machine: 'PUMP-02',
      type_declencheur: 'HYBRIDE',
      prochaine_echeance: '2026-12-01',
      compteur_unite: 'Heures',
      compteur_seuil_intervalle: 500,
      compteur_dernier_declenchement: 2000,
      compteur_prochain_declenchement: 2500,
    };

    it('triggers when meter threshold is exceeded even if calendar date is far in future', () => {
      const res = MeterService.evaluateHybridTask(hybridTask, 2550, '2026-11-01');
      expect(res.isDue).toBe(true);
      expect(res.primaryTrigger).toBe('METER');
      expect(res.calendarDue).toBe(false);
      expect(res.meterEval.isOverdue).toBe(true);
    });

    it('triggers when calendar date has passed even if meter has not reached target', () => {
      const res = MeterService.evaluateHybridTask(hybridTask, 2200, '2026-12-05');
      expect(res.isDue).toBe(true);
      expect(res.primaryTrigger).toBe('CALENDAR');
      expect(res.calendarDue).toBe(true);
      expect(res.meterEval.isOverdue).toBe(false);
    });

    it('flags BOTH if both calendar date and meter have reached trigger point', () => {
      const res = MeterService.evaluateHybridTask(hybridTask, 2600, '2026-12-05');
      expect(res.isDue).toBe(true);
      expect(res.primaryTrigger).toBe('BOTH');
    });
  });

  describe('4. Threshold Advancement on Maintenance Execution', () => {
    it('advances the next trigger value cleanly by interval from executed reading', () => {
      const task = {
        id: 'TASK-OIL',
        compteur_seuil_intervalle: 250,
      };

      const advanced = MeterService.advanceTaskThresholdOnExecution(task, 1250);
      expect(advanced.compteur_dernier_declenchement).toBe(1250);
      expect(advanced.compteur_actuel).toBe(1250);
      expect(advanced.compteur_prochain_declenchement).toBe(1500); // 1250 + 250
    });
  });
});
