import { describe, it, expect } from 'vitest';
import { ExcelFormulaEngine } from '../../core/domain/services/ExcelFormulaEngine';

describe('UI & Formula Engine Benchmarks', () => {
  const generateMovements = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      ref: i % 2 === 0 ? 'ROUL-6204' : 'ROUL-6205',
      type: i % 3 === 0 ? 'Entrée' : 'Sortie',
      quantite: Math.floor(Math.random() * 50) + 1,
    }));
  };

  const movements100 = generateMovements(100);
  const movements1000 = generateMovements(1000);

  it('SUMIFS calculation over 100 movement records (< 25ms)', () => {
    const start = performance.now();
    const res = ExcelFormulaEngine.sumifs(
      movements100,
      'quantite',
      'ref',
      'ROUL-6204',
      'type',
      'Entrée'
    );
    const duration = performance.now() - start;
    expect(res).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(25);
  });

  it('SUMIFS calculation over 1,000 movement records (< 50ms)', () => {
    const start = performance.now();
    const res = ExcelFormulaEngine.sumifs(
      movements1000,
      'quantite',
      'ref',
      'ROUL-6204',
      'type',
      'Entrée'
    );
    const duration = performance.now() - start;
    expect(res).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(50);
  });

  it('COUNTIFS calculation over 1,000 movement records (< 50ms)', () => {
    const start = performance.now();
    const res = ExcelFormulaEngine.countifs(
      movements1000,
      'ref',
      'ROUL-6204',
      'type',
      'Sortie'
    );
    const duration = performance.now() - start;
    expect(res).toBeGreaterThanOrEqual(0);
    expect(duration).toBeLessThan(50);
  });
});

