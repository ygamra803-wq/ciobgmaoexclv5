import { describe, it, expect } from 'vitest';
import { calculateNextDueDate, getComplianceRate } from '@/domain/preventiveScheduling';

describe('Preventive Task Integration Flow', () => {
  it('يجب تنفيذ مهمة وقائية وتحديث تاريخ الاستحقاق التالي وحساب نسبة الإنجاز', () => {
    const task = {
      id: 'PREV-001',
      titre: 'Graissage paliers',
      machine: 'Extrudeuse 01',
      periodicite: 'HEBDO',
      derniereDate: new Date('2026-09-01'),
      status: 'A_FAIRE',
    };

    // Simulate validation/execution
    const executionDate = new Date('2026-09-08');
    const nextDate = calculateNextDueDate(executionDate, task.periodicite);

    task.derniereDate = executionDate;
    task.prochaineDate = nextDate;
    task.status = 'REALISE';

    expect(task.status).toBe('REALISE');
    expect(task.prochaineDate.getTime()).toBeGreaterThan(task.derniereDate.getTime());

    // Check rate
    const compliance = getComplianceRate(10, 10);
    expect(compliance).toBe(100);
  });
});
