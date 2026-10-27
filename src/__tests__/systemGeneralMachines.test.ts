import { describe, it, expect, beforeEach } from 'vitest';
import { MachineEntity } from '../domain/machines/entities/MachineEntity';
import {
  filterActiveMachines,
  filterProductionMachines,
  getMachineAssetClass,
  isSystemGeneralMachine,
} from '../utils/activeMachines';
import { generateSystemGeneralCode } from '../presentation/pages/machines/AddMachineModal';
import { useGmaoStore } from '../store/useGmaoStore';
import { DataGateway } from '../application/DataGateway';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';

describe('System General & Real Zones Contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults legacy machines without asset_class to PRODUCTION', () => {
    const legacyMachine = {
      id_machine_registered: 'PRS-01',
      designation: 'Presse Hydraulique 1',
      id_family: 'FAM-PRES',
      id_templates: 'TPL-PRS',
      id_zone_default: 'Z-PROD-A',
    };

    expect(getMachineAssetClass(legacyMachine)).toBe('PRODUCTION');
    expect(isSystemGeneralMachine(legacyMachine)).toBe(false);

    const entity = new MachineEntity(legacyMachine as any);
    expect(entity.asset_class).toBe('PRODUCTION');
  });

  it('preserves SYSTEM_GENERAL, id_general_system_type, and optional empty family/template in MachineEntity', () => {
    const sysMachine = new MachineEntity({
      id_machine_registered: 'AIR-01',
      designation: 'Compresseur Central Atlas Copco',
      asset_class: 'SYSTEM_GENERAL',
      id_general_system_type: 'SYS-AIR',
      id_family: '',
      id_templates: '',
      id_zone_default: 'Z-TECH-01',
      technician: 'TECH-01',
      status: 'En Service',
    });

    expect(sysMachine.asset_class).toBe('SYSTEM_GENERAL');
    expect(sysMachine.id_general_system_type).toBe('SYS-AIR');
    expect(sysMachine.id_family).toBe('');
    expect(sysMachine.id_templates).toBe('');
    expect(sysMachine.id_zone_default).toBe('Z-TECH-01');
  });

  it('derives sequential codes from GeneralSystemType code (AIR-01, AIR-02, SEC-01)', () => {
    const airType = { id: 'SYS-AIR', code: 'AIR', name: 'Air comprimé', is_active: true };
    const secType = { id: 'SYS-SEC', code: 'SEC', name: 'Sécurité incendie', is_active: true };

    expect(generateSystemGeneralCode(airType, [])).toBe('AIR-01');
    expect(
      generateSystemGeneralCode(airType, [
        { id_machine_registered: 'AIR-01', id_general_system_type: 'SYS-AIR' },
      ])
    ).toBe('AIR-02');
    expect(
      generateSystemGeneralCode(secType, [
        { id_machine_registered: 'AIR-01', id_general_system_type: 'SYS-AIR' },
      ])
    ).toBe('SEC-01');
  });

  it('includes active SYSTEM_GENERAL in filterActiveMachines (for PM/WO) but excludes them in filterProductionMachines (for Components/BOM)', () => {
    const list = [
      { id_machine_registered: 'PRS-01', status: 'En Service', asset_class: 'PRODUCTION' as const },
      {
        id_machine_registered: 'AIR-01',
        status: 'En Service',
        asset_class: 'SYSTEM_GENERAL' as const,
        id_general_system_type: 'SYS-AIR',
      },
      {
        id_machine_registered: 'SEC-99',
        status: 'ARCHIVEE',
        asset_class: 'SYSTEM_GENERAL' as const,
        id_general_system_type: 'SYS-SEC',
      },
    ];

    const active = filterActiveMachines(list as any);
    expect(active.map((m) => m.id_machine_registered)).toEqual(['PRS-01', 'AIR-01']);

    const prodOnly = filterProductionMachines(list as any);
    expect(prodOnly.map((m) => m.id_machine_registered)).toEqual(['PRS-01']);
  });

  it('protects BOM / MachineElements from attaching to SYSTEM_GENERAL machines', () => {
    const store = useGmaoStore.getState();
    store.setMachines([
      {
        id_machine_registered: 'PRS-01',
        designation: 'Presse 1',
        asset_class: 'PRODUCTION',
        id_family: 'FAM-PRES',
        id_templates: 'TPL-PRS',
        id_zone_default: 'Z-01',
        technician: 'T1',
        status: 'En Service',
      },
      {
        id_machine_registered: 'SEC-01',
        designation: 'Extincteur CO2',
        asset_class: 'SYSTEM_GENERAL',
        id_general_system_type: 'SYS-SEC',
        id_family: '',
        id_templates: '',
        id_zone_default: 'Z-01',
        technician: 'T1',
        status: 'En Service',
      },
    ]);
    store.setMachineElementsLedger([]);

    store.addMachineElement({
      id: 'EL-1',
      id_machine_registered: 'SEC-01',
      ref_element: 'MOT-1',
      designation: 'Moteur',
    } as any);

    expect(useGmaoStore.getState().machineElementsLedger).toHaveLength(0);

    store.addMachineElement({
      id: 'EL-2',
      id_machine_registered: 'PRS-01',
      ref_element: 'MOT-1',
      designation: 'Moteur Presse',
    } as any);

    expect(useGmaoStore.getState().machineElementsLedger).toHaveLength(1);
  });

  it('respects zero silent seed reinjection on clearAllForRealFactory and loads 5 types on loadDemoData', () => {
    DataGateway.clearAllForRealFactory(useGmaoStore.getState());
    expect(useGmaoStore.getState().generalSystemTypes).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.GENERAL_SYSTEM_TYPES) || '[]')).toEqual([]);

    DataGateway.loadDemoData(useGmaoStore.getState());
    expect(useGmaoStore.getState().generalSystemTypes).toHaveLength(5);
    expect(useGmaoStore.getState().generalSystemTypes.map((t: any) => t.id)).toEqual([
      'SYS-AIR',
      'SYS-SEC',
      'SYS-EAU',
      'SYS-ECL',
      'SYS-ASC',
    ]);
  });
});
