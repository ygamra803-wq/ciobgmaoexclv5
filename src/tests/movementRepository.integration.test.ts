import { describe, it, expect, beforeEach } from 'vitest';
import { MovementRepository } from '../application/MovementRepository';
import { stockIndexStore } from '../application/StockIndexStore';

describe('MovementRepository & StockIndexStore Integration', () => {
  let repo: MovementRepository;

  beforeEach(() => {
    stockIndexStore.reset();
    repo = new MovementRepository();
  });

  it('add movement: updates target ref and leaves other refs unchanged', () => {
    // Initial state
    stockIndexStore.index.setInitialStock('PDR-001', 100);
    stockIndexStore.index.setInitialStock('PDR-002', 50);

    expect(stockIndexStore.index.calculateCurrentStock('PDR-001')).toBe(100);
    expect(stockIndexStore.index.calculateCurrentStock('PDR-002')).toBe(50);

    // Add sortie on PDR-001
    repo.add({
      ref: 'PDR-001',
      type: 'Sortie',
      quantite: 15,
    });

    // PDR-001 updated
    const pdr1Totals = stockIndexStore.index.getTotals('PDR-001');
    expect(pdr1Totals.sorties).toBe(15);
    expect(stockIndexStore.index.calculateCurrentStock('PDR-001')).toBe(85);

    // PDR-002 completely unchanged
    const pdr2Totals = stockIndexStore.index.getTotals('PDR-002');
    expect(pdr2Totals.sorties).toBe(0);
    expect(pdr2Totals.entrees).toBe(0);
    expect(stockIndexStore.index.calculateCurrentStock('PDR-002')).toBe(50);
  });

  it('edit movement: updates delta accurately across old and new quantities', () => {
    const mvt = {
      id: 'mvt-1',
      ref: 'PDR-001',
      type: 'Sortie',
      quantite: 10,
    };
    repo.add(mvt);

    expect(stockIndexStore.index.getTotals('PDR-001').sorties).toBe(10);

    // Edit quantity from 10 to 25
    repo.edit(mvt, { ...mvt, quantite: 25 });
    expect(stockIndexStore.index.getTotals('PDR-001').sorties).toBe(25);
  });

  it('remove movement: rollbacks delta accurately', () => {
    const mvt = {
      id: 'mvt-1',
      ref: 'PDR-001',
      type: 'Entrée',
      quantite: 40,
    };
    repo.add(mvt);
    expect(stockIndexStore.index.getTotals('PDR-001').entrees).toBe(40);

    repo.remove(mvt);
    expect(stockIndexStore.index.getTotals('PDR-001').entrees).toBe(0);
  });

  it('hydration lifecycle: offline mutation does not prematurely mark index as hydrated', () => {
    expect(stockIndexStore.isHydrated()).toBe(false);

    // 1. App boots, offline movement added before DB hydration
    repo.add({
      ref: 'PDR-001',
      type: 'Sortie',
      quantite: 5,
    });

    // Index has running data but is NOT fully hydrated
    expect(stockIndexStore.index.hasData()).toBe(true);
    expect(stockIndexStore.isHydrated()).toBe(false);

    // 2. Historical data loads via bulkReplace
    repo.bulkReplace([
      { ref: 'PDR-001', type: 'Entrée', quantite: 100 },
      { ref: 'PDR-001', type: 'Sortie', quantite: 5 },
      { ref: 'PDR-002', type: 'Entrée', quantite: 50 },
    ]);

    expect(stockIndexStore.isHydrated()).toBe(true);
    expect(stockIndexStore.index.getTotals('PDR-001').entrees).toBe(100);
    expect(stockIndexStore.index.getTotals('PDR-001').sorties).toBe(5);
    expect(stockIndexStore.index.getTotals('PDR-002').entrees).toBe(50);
  });
});
