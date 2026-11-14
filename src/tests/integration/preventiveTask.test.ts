import { describe, it, expect } from 'vitest';
import { computeNextDueDate } from '@/application/services/preventive/TaskService';
import { PreventiveService } from '@/application/services/PreventiveService';

describe('Preventive Task Integration Flow', () => {
  it('يجب تنفيذ مهمة وقائية وتحديث تاريخ الاستحقاق التالي وحساب نسبة الإنجاز', () => {
    const executionDate = '2026-09-08';
    const nextDate = computeNextDueDate(executionDate, 'Hebdomadaire');

    expect(new Date(nextDate).getTime()).toBeGreaterThan(new Date(executionDate).getTime());

    PreventiveService.saveTasks([
      {
        id: 'PREV-001',
        id_machine: 'MCH-01',
        action_code: 'GRAISSAGE',
        composant: 'Palier',
        frequence: 'Hebdomadaire',
        derniere_realisation: executionDate,
        prochaine_echeance: nextDate,
        etat: 'Fait',
      },
    ]);
    PreventiveService.saveExecutions([]);

    const profile = PreventiveService.getMachinePreventiveProfile('MCH-01');

    expect(profile.fait_tasks).toBe(1);
    expect(profile.compliance_rate).toBe(100);
  });
});
