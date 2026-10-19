import { describe, it, expect, beforeEach } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';

describe('GmaoStore (Zustand Global State Management)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('should initialize with baseline collections obeying SSOT', () => {
    const state = useGmaoStore.getState();
    expect(Array.isArray(state.rawStock)).toBe(true);
    expect(Array.isArray(state.machines)).toBe(true);
    expect(Array.isArray(state.families)).toBe(true);
    expect(Array.isArray(state.templates)).toBe(true);
    expect(Array.isArray(state.zones)).toBe(true);
    expect(Array.isArray(state.warehouseItems)).toBe(true);
    expect(Array.isArray(state.mouvements)).toBe(true);
    expect(Array.isArray(state.preventiveTasks)).toBe(true);
    expect(Array.isArray(state.correctiveInterventions)).toBe(true);
  });

  it('should support direct updates and functional updater functions', () => {
    const initialTypesCount = useGmaoStore.getState().types.length;
    const testType = { id: 'T-TEST', type: 'Test Type' };

    // Functional update
    useGmaoStore.getState().setTypes((prev) => [...prev, testType]);
    expect(useGmaoStore.getState().types.length).toBe(initialTypesCount + 1);
    expect(useGmaoStore.getState().types.some((t) => t.id === 'T-TEST')).toBe(true);

    // Direct array update
    useGmaoStore.getState().setTypes([{ id: 'T-SINGLE', type: 'Single' }]);
    expect(useGmaoStore.getState().types.length).toBe(1);
    expect(useGmaoStore.getState().types[0].id).toBe('T-SINGLE');
  });

  it('should isolate slices so updating stock does not mutate machines or movements', () => {
    const machinesBefore = useGmaoStore.getState().machines;
    const movementsBefore = useGmaoStore.getState().mouvements;

    useGmaoStore.getState().setRawStock([
      {
        id: 'ART-NEW',
        ref: 'REF-NEW-123',
        designation: 'New PDR Article',
        stockInitial: 50,
        entrees: 0,
        sorties: 0,
        stockActuel: 50,
        seuil: 5,
        alerte: 'OK',
      },
    ]);

    expect(useGmaoStore.getState().rawStock.length).toBe(1);
    expect(useGmaoStore.getState().machines).toBe(machinesBefore);
    expect(useGmaoStore.getState().mouvements).toBe(movementsBefore);
  });

  it('should compute derived stock items reactively', () => {
    useGmaoStore.getState().setRawStock([
      {
        id: '1',
        ref: 'TEST-ROULEMENT',
        designation: 'Roulement 6204',
        stockInitial: 10,
        entrees: 0,
        sorties: 0,
        stockActuel: 10,
        seuil: 2,
        alerte: 'OK',
      },
    ]);

    useGmaoStore.getState().setMouvements([
      {
        id: 'M-1',
        code_bon: 'BS-001',
        date: '2026-03-01',
        ref: 'TEST-ROULEMENT',
        quantite: 4,
        type: 'Sortie',
        action_id: 'CORRECTIVE',
      },
    ]);

    const calculated = useGmaoStore.getState().stockItems();
    const item = calculated.find((i) => i.ref === 'TEST-ROULEMENT');
    expect(item).toBeDefined();
    expect(item?.sorties).toBe(4);
    expect(item?.stockActuel).toBe(6);
  });

  it('should compute effectiveDesignations dynamically', () => {
    useGmaoStore.getState().setDesignations([
      { id: '1', ref: 'R-01', designation: 'Moteur 5kW' },
    ]);

    const designations = useGmaoStore.getState().effectiveDesignations();
    expect(designations.length).toBe(1);
    expect(designations[0].ref).toBe('R-01');
  });

  it('should manage machine element ledger with add, update, and delete', () => {
    const initialLedgerCount = useGmaoStore.getState().machineElementsLedger.length;
    const testElement = {
      id: 'BOM-TEST-1',
      id_machine_registered: 'M-BROY',
      ref_element: 'COURROIE-X',
      designation: 'Courroie Trapézoïdale',
    };

    useGmaoStore.getState().addMachineElement(testElement);
    expect(useGmaoStore.getState().machineElementsLedger.length).toBe(initialLedgerCount + 1);

    useGmaoStore.getState().updateMachineElement('BOM-TEST-1', { designation: 'Courroie Modifiée' });
    const updated = useGmaoStore.getState().machineElementsLedger.find((e) => e.id === 'BOM-TEST-1');
    expect(updated?.designation).toBe('Courroie Modifiée');

    useGmaoStore.getState().deleteMachineElement('BOM-TEST-1');
    expect(useGmaoStore.getState().machineElementsLedger.some((e) => e.id === 'BOM-TEST-1')).toBe(false);
  });

  it('should support subscriber listeners on slice changes', () => {
    let triggered = false;
    const unsubscribe = useGmaoStore.subscribe((state, prevState) => {
      if (state.preventiveTasks !== prevState.preventiveTasks) {
        triggered = true;
      }
    });

    useGmaoStore.getState().setPreventiveTasks([
      { id: 'TASK-1', titre: 'Graissage Mensuel' },
    ]);

    expect(triggered).toBe(true);
    unsubscribe();
  });
});
