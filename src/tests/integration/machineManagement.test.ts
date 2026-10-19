import { describe, it, expect } from 'vitest';
import { ValidationService } from '@/domain/validators/index.js';

describe('Machine Management Integration Flow', () => {
  it('يجب إنشاء وتأهيل بيانات الآلة والتحقق من ارتباطها بالمنطقة والنموذج', () => {
    const zone = {
      id: 'ZONE-A',
      name: 'Atelier Injection',
      description: 'Ligne principale',
    };

    expect(ValidationService.validateZone(zone).valid).toBe(true);

    const machine = {
      id: 'M-INJ-01',
      name: 'Presse Injection 250T',
      zone: zone.name,
      family: 'Presse',
      template: 'TPL-INJ-250',
      status: 'EN_SERVICE',
    };

    const res = ValidationService.validateMachine(machine);
    expect(res.valid).toBe(true);
    expect(res.data.status).toBe('EN_SERVICE');
  });
});
