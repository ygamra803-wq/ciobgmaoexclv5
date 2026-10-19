import { describe, it, expect, beforeEach } from 'vitest';
import { DataGateway } from '../../application/DataGateway';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { loadCollection } from '../../infrastructure/persistence/migrateStorage';
import { syncMovementsToIndex, calculateStockItems } from '../../hooks/useAppCalculations';
import { stockIndexStore } from '../../application/StockIndexStore';
import { filterActiveMachines, getActiveMachineCodes } from '../../utils/activeMachines';
import seedStockItems from '../../data/stock/seedStockItems.json';
import seedMouvements from '../../data/movements/seedMouvements.json';
import seedCorrectiveInterventions from '../../data/corrective/seedCorrectiveInterventions.json';

describe('Five-Point Critical GMAO Verification Suite', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    DataGateway.clearAllForRealFactory();
  });

  // Path 1: stockInitial + entrées − sorties on seed sample & demo tour coherence
  it('1) computes stockActuel = stockInitial + entrées - sorties accurately on seed data and surfaces ALERTE & RUPTURE across 102 movements and 12 corrective interventions', () => {
    expect(seedMouvements.length).toBe(102);
    expect(seedCorrectiveInterventions.length).toBe(12);

    // Ensure no corrective intervention is mislabeled as "préventive"
    const mislabeled = seedCorrectiveInterventions.filter(
      (c: any) => String(c.travail_a_faire || '').toLowerCase() === 'préventive'
    );
    expect(mislabeled).toHaveLength(0);

    // Verify all movement refs and corrective pdr_refs exist in stock
    const stockRefSet = new Set(
      seedStockItems.map((s: any) => String(s.ref || '').trim().toUpperCase())
    );
    for (const mov of seedMouvements as any[]) {
      expect(stockRefSet.has(String(mov.ref || '').trim().toUpperCase())).toBe(true);
    }
    for (const corr of seedCorrectiveInterventions as any[]) {
      if (corr.pdr_ref) {
        expect(stockRefSet.has(String(corr.pdr_ref).trim().toUpperCase())).toBe(true);
      }
    }

    // Rebuild index and calculate stock items
    stockIndexStore.reset();
    syncMovementsToIndex(seedMouvements as any[]);
    const computedStock = calculateStockItems(seedStockItems as any[], seedMouvements as any[]);

    expect(computedStock.length).toBe(seedStockItems.length);

    // Verify mathematical equation: stockActuel === stockInitial + entrees - sorties on sample items
    const sampleRefs = ['Raccord01', 'Raccord03', 'Distributeur05', 'Courroie21', 'paliers01'];
    for (const ref of sampleRefs) {
      const item = computedStock.find(
        (s: any) => String(s.ref).trim().toUpperCase() === ref.toUpperCase()
      );
      expect(item).toBeDefined();
      expect(item.stockActuel).toBe(item.stockInitial + item.entrees - item.sorties);
    }

    const ruptures = computedStock.filter((s: any) => s.alerte === 'RUPTURE');
    const alertes = computedStock.filter((s: any) => s.alerte === 'ALERTE');
    expect(ruptures.length).toBeGreaterThan(0);
    expect(alertes.length).toBeGreaterThan(0);
  });

  // Path 2: clearAll -> canonical + legacy Preventive keys = empty (and stay empty after F5)
  it('2) clears all canonical and legacy Preventive keys on clearAllForRealFactory and keeps Preventive, Stock, Movements, and Corrective empty after F5', () => {
    // Load Demo first
    DataGateway.loadDemoData();
    // Simulate legacy preventive keys
    localStorage.setItem('gmao_preventive_tasks_v8', JSON.stringify([{ id: 'OLD-1' }]));
    localStorage.setItem('gmao_preventive_tasks', JSON.stringify([{ id: 'OLD-2' }]));
    localStorage.setItem('gmao_preventive_plans', JSON.stringify([{ id: 'OLD-PLAN' }]));

    // Clear all for real factory
    DataGateway.clearAllForRealFactory();

    // Canonical keys must be empty arrays []
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_TASKS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_ACTIONS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_GUIDES, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.PREVENTIVE_PLANS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.RAW_STOCK, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.MOUVEMENTS, null)).toEqual([]);
    expect(storageService.getItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, null)).toEqual([]);

    // Legacy keys must be completely removed (null)
    expect(localStorage.getItem('gmao_preventive_tasks_v8')).toBeNull();
    expect(localStorage.getItem('gmao_preventive_tasks')).toBeNull();
    expect(localStorage.getItem('gmao_preventive_plans')).toBeNull();

    // Simulate F5 reload via loadCollection with non-empty fallback seeds
    expect(loadCollection(STORAGE_KEYS.PREVENTIVE_TASKS, [{ id: 'SEED-1' }])).toEqual([]);
    expect(loadCollection(STORAGE_KEYS.RAW_STOCK, [{ ref: 'SEED-STOCK' }])).toEqual([]);
    expect(loadCollection(STORAGE_KEYS.MOUVEMENTS, [{ id: 'SEED-MOV' }])).toEqual([]);
    expect(loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, [{ id: 'SEED-CORR' }])).toEqual([]);
  });

  // Path 3: Archived machine never appears in new task creation lists
  it('3) excludes archived and inactive machines from new task creation selectors', () => {
    const machines = [
      { id_machine_registered: 'DET-05', nom: 'Détecteur 05', statut: 'En service', is_active: true },
      { id_machine_registered: 'DET-08', nom: 'Détecteur 08 (Archivée)', statut: 'Archivée', is_active: true },
      { id_machine_registered: 'PCE-01', nom: 'Presse 01 (ARCHIVEE)', status: 'ARCHIVEE', is_active: true },
      { id_machine_registered: 'FRL-01', nom: 'FRL 01 (Inactive)', statut: 'En service', is_active: false },
      { id_machine_registered: 'FRL-02', nom: 'FRL 02 (Active)', statut: 'Opérationnelle', actif: true },
    ];

    const activeList = filterActiveMachines(machines);
    const activeCodes = getActiveMachineCodes(machines);

    expect(activeList).toHaveLength(2);
    expect(activeCodes).toEqual(['DET-05', 'FRL-02']);
    expect(activeCodes).not.toContain('DET-08');
    expect(activeCodes).not.toContain('PCE-01');
    expect(activeCodes).not.toContain('FRL-01');
  });
});
