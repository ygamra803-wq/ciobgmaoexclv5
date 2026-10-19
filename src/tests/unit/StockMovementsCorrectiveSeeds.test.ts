import { describe, it, expect, beforeEach } from 'vitest';
import seedStockItems from '../../data/stock/seedStockItems.json';
import seedMouvements from '../../data/movements/seedMouvements.json';
import seedCorrectiveInterventions from '../../data/corrective/seedCorrectiveInterventions.json';
import seedMachines from '../../data/machines/seedMachines.json';
import seedPanneByCategory from '../../data/corrective/seedPanneByCategory.json';
import { IncrementalStockIndex } from '../../application/IncrementalStockIndex';
import { IncrementalStockIndex as PdrIncrementalStockIndex } from '../../domain/pdr/services/IncrementalStockIndex';
import { IncrementalStockIndex as CoreIncrementalStockIndex } from '../../core/domain/services/IncrementalStockIndex';
import { StockCalculationService } from '../../domain/pdr/services/StockCalculationService';
import { StockCalculationService as CoreStockCalculationService } from '../../core/domain/services/StockCalculationService';
import { syncMovementsToIndex, calculateStockItems } from '../../hooks/useAppCalculations';
import { stockIndexStore } from '../../application/StockIndexStore';

describe('Stock, Mouvements & Corrective Demo Seed Synchronization (STOCK-01, STOCK-02, MOV-01, CORR-01)', () => {
  beforeEach(() => {
    stockIndexStore.reset();
    StockCalculationService.clearCache();
  });

  it('STOCK-01: should unify all IncrementalStockIndex and StockCalculationService imports to the exact same canonical classes', () => {
    expect(PdrIncrementalStockIndex).toBe(IncrementalStockIndex);
    expect(CoreIncrementalStockIndex).toBe(IncrementalStockIndex);
    expect(CoreStockCalculationService).toBe(StockCalculationService);

    // Quick verification: "Sortie Interne" decrements stock across both services
    const idx = new IncrementalStockIndex();
    idx.setInitialStock('Raccord01', 82);
    idx.applyDelta({ ref: 'raccord01', type: 'Sortie Interne', quantity: 4 });
    expect(idx.calculateCurrentStock('RACCORD01')).toBe(78);

    const calc = StockCalculationService.calculateStockActuel(
      { ref: 'Raccord01', stockInitial: 82, seuil: 3 },
      [{ ref: 'raccord01', type: 'Sortie Interne', quantite: 4 }]
    );
    expect(calc).toBe(78);
  });

  it('STOCK-02 & MOV-01: should compute stockActuel from seedStockItems + seedMouvements with 100% mathematical parity and surface RUPTURE/ALERTE items', () => {
    expect(seedMouvements.length).toBe(102);

    // Every movement ref must exist in seedStockItems
    const stockRefSet = new Set(seedStockItems.map((s) => s.ref.trim().toUpperCase()));
    for (const m of seedMouvements) {
      expect(stockRefSet.has(String(m.ref).trim().toUpperCase())).toBe(true);
    }

    syncMovementsToIndex(seedMouvements);
    const computed = calculateStockItems(seedStockItems, seedMouvements);
    expect(computed.length).toBe(seedStockItems.length);

    // Verify 100% parity between expected Excel snapshot stockActuel and dynamically computed stockActuel
    let mismatches = 0;
    for (let i = 0; i < seedStockItems.length; i++) {
      const expected = seedStockItems[i].stockActuel;
      const actual = computed[i].stockActuel;
      if (expected !== actual) {
        mismatches++;
      }
    }
    expect(mismatches).toBe(0);

    // Verify RUPTURE and ALERTE items are surfaced after dynamic calculation
    const ruptures = computed.filter((s) => s.alerte === 'RUPTURE');
    const alertes = computed.filter((s) => s.alerte === 'ALERTE');
    expect(ruptures.length).toBeGreaterThan(0);
    expect(alertes.length).toBeGreaterThan(0);

    // Specifically check Distributeur05 (init 4 - sortie 4 = 0 -> RUPTURE) and Raccord01 (init 82 - sortie 4 = 78)
    const dist05 = computed.find((s) => s.ref === 'Distributeur05');
    expect(dist05?.stockActuel).toBe(0);
    expect(dist05?.alerte).toBe('RUPTURE');

    const raccord01 = computed.find((s) => s.ref === 'Raccord01');
    expect(raccord01?.stockActuel).toBe(78);
  });

  it('CORR-01: should have enriched corrective interventions with valid machines, categories, and stock pdr_ref links', () => {
    expect(seedCorrectiveInterventions.length).toBeGreaterThanOrEqual(12);

    const stockRefSet = new Set(seedStockItems.map((s) => s.ref.trim().toUpperCase()));
    const machineIdSet = new Set(
      seedMachines.map((m) => String(m.id || m.id_machine_registered).trim().toUpperCase())
    );
    const validCategories = new Set(Object.keys(seedPanneByCategory));

    for (const item of seedCorrectiveInterventions) {
      expect(machineIdSet.has(item.code_machine.trim().toUpperCase())).toBe(true);
      expect(validCategories.has(item.type_panne)).toBe(true);
      expect(item.travail_a_faire).not.toBe('préventive');
      if (item.pdr_ref) {
        expect(stockRefSet.has(item.pdr_ref.trim().toUpperCase())).toBe(true);
      }
    }
  });
});
