import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { useAppComplexHandlers } from '../../hooks/useAppComplexHandlers';

describe('Round 3 — State & Wiring Fixes (C-02, C-03, C-04, H-01, H-03, H-05, M-01)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('C-02: useGmaoStore exposes canonical corrective* keys and updates them synchronously with aliases', () => {
    const state = useGmaoStore.getState();

    expect(state.correctiveActionsByPanne).toBeDefined();
    expect(typeof state.correctiveActionsByPanne).toBe('object');
    expect(state.correctivePanneCategories).toBeDefined();
    expect(typeof state.correctivePanneCategories).toBe('object');
    expect(Array.isArray(state.correctiveTravauxAFaire)).toBe(true);
    expect(Array.isArray(state.correctiveIntervenants)).toBe(true);

    // Mutate via store actions and verify canonical keys update
    state.handleAddPanne('MECANIQUE', 'PANNE_ROULEMENT_TEST');
    state.handleAddCorrectiveActionForPanne('PANNE_ROULEMENT_TEST', 'Remplacer roulement SKF');
    state.handleAddTravail('Graissage palier principal');

    const updated = useGmaoStore.getState();
    expect(updated.correctivePanneCategories['MECANIQUE']).toContain('PANNE_ROULEMENT_TEST');
    expect(updated.correctiveActionsByPanne['PANNE_ROULEMENT_TEST']).toContain('Remplacer roulement SKF');
    expect(updated.correctiveTravauxAFaire).toContain('Graissage palier principal');
  });

  it('H-01: useAppComplexHandlers enforces referential integrity using machines prop on Zone & Technician delete', () => {
    const setZones = vi.fn();
    const setTechnicians = vi.fn();
    const showToast = vi.fn();

    const handlers = useAppComplexHandlers({
      zones: [{ id_zone: 'Z-PROD-01', nom: 'Atelier Production' }],
      setZones,
      operations: [],
      setOperations: vi.fn(),
      technicians: [{ id_technician: 'TECH-01', nom: 'Karim Benali', is_active: true }],
      setTechnicians,
      machines: [
        {
          id_machine_registered: 'MCH-001',
          nom: 'Presse Hydraulique',
          id_zone_default: 'Z-PROD-01',
          technician: 'Karim Benali',
        },
      ],
      _machines: undefined,
      setMachines: vi.fn(),
      mouvements: [],
      setMouvements: vi.fn(),
      setTypes: vi.fn(),
      rawStock: [],
      setRawStock: vi.fn(),
      setDesignations: vi.fn(),
      setFamilies: vi.fn(),
      setTemplates: vi.fn(),
      setCompGroups: vi.fn(),
      setCompFamilies: vi.fn(),
      setCompTemplates: vi.fn(),
      setPartTypes: vi.fn(),
      setPartDesignations: vi.fn(),
      setWarehouseItems: vi.fn(),
      preventiveTasks: [],
      correctiveInterventions: [],
      machineElementsLedger: [],
      showToast,
      setCurrentTab: vi.fn(),
    });

    // Attempt to delete zone linked to MCH-001 -> must be blocked
    handlers.handleDeleteZone('Z-PROD-01');
    expect(setZones).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining('contient des machines ou techniciens actifs'),
      'warning'
    );

    // Attempt to delete technician linked to MCH-001 -> must soft-archive instead of hard-deleting
    handlers.handleDeleteTechnician('TECH-01');
    expect(setTechnicians).toHaveBeenCalledTimes(1);
    const updaterFn = setTechnicians.mock.calls[0][0];
    const resultTechs = updaterFn([{ id_technician: 'TECH-01', nom: 'Karim Benali', is_active: true }]);
    expect(resultTechs).toHaveLength(1);
    expect(resultTechs[0].is_active).toBe(false);
    expect(resultTechs[0].statut).toBe('ARCHIVE');
  });

  it('H-05 & M-01: handleAddDemandeIntervention creates a DEMANDE intervention counted by DI filter', () => {
    const store = useGmaoStore.getState();
    const initialCount = store.correctiveInterventions.length;

    const created = store.handleAddDemandeIntervention({
      code_machine: 'DET-05',
      anomalie: 'Fuite huile vérin principal',
      demandeur: 'Maintenance Préventive',
    });

    const after = useGmaoStore.getState().correctiveInterventions;
    expect(after.length).toBe(initialCount + 1);
    expect(created.statut).toBe('DEMANDE');

    const diCount = after.filter(
      (i) => i.statut === 'DEMANDE' || i.statut === 'DEMANDE_CREEE' || i.statut === 'EN_ATTENTE_VALIDATION'
    ).length;
    expect(diCount).toBeGreaterThanOrEqual(1);
  });
});
