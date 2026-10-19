import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SparePartApplicationService } from '@/application/services/SparePartApplicationService.js';
import { Container } from '@/core/di/Container.js';

describe('SparePart / Stock Application Service Unit Tests', () => {
  let mockDomainService;

  beforeEach(() => {
    mockDomainService = {
      createSparePart: vi.fn().mockImplementation(async (data) => ({
        id: 'sp-1',
        ref: data.ref || 'REF-1',
        designation: data.designation || 'Part 1',
        stockActuel: data.stockActuel || 10,
        stockMin: data.stockMin || 2,
      })),
      getSparePart: vi.fn().mockImplementation(async (id) => ({
        id,
        ref: 'REF-1',
        designation: 'Part 1',
        stockActuel: 10,
        stockMin: 2,
      })),
      listSpareParts: vi.fn().mockResolvedValue([
        { id: '1', ref: 'R1', designation: 'P1', stockActuel: 5, stockMin: 2 },
        { id: '2', ref: 'R2', designation: 'P2', stockActuel: 0, stockMin: 3 },
      ]),
      updateSparePart: vi.fn().mockImplementation(async (id, data) => ({
        id,
        ...data,
      })),
      deleteSparePart: vi.fn().mockResolvedValue(true),
    };

    Container.register('sparePartService', mockDomainService);
  });

  it('يجب إنشاء قطعة غيار وتحويلها للاستجابة المناسبة', async () => {
    const service = new SparePartApplicationService();
    const result = await service.createSparePart({
      ref: 'ROUL-6204',
      designation: 'Roulement à billes',
      stockActuel: 20,
    });

    expect(result).toBeDefined();
    expect(mockDomainService.createSparePart).toHaveBeenCalled();
  });

  it('يجب استرجاع قائمة قطع الغيار بنجاح', async () => {
    const service = new SparePartApplicationService();
    const list = await service.listSpareParts();

    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(2);
  });
});
