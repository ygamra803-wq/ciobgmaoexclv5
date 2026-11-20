import { describe, it, expect, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  buildQuickEditEquipmentUpdates,
  computeEquipmentCockpitMetrics,
  normalizeCanonicalEquipStatus,
  reconcileTechnicianReassignment,
} from '../../application/services/ZoneEquipmentPhaseCService';
import { useAppComplexHandlers as createComplexHandlers } from '../../hooks/useAppComplexHandlers';
import { useAppNavigation } from '../../hooks/useAppNavigation';

function makeSetter<T>(initial: T) {
  let state = initial;
  const setter = (updater: T | ((prev: T) => T)) => {
    state = typeof updater === 'function' ? (updater as (prev: T) => T)(state) : updater;
  };
  return {
    get: () => state,
    set: setter,
  };
}

describe('Zone & Equipment / Utilisateurs — Phase C Small-Factory Cockpit & Workload Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('reconcileTechnicianReassignment transfers active machines, open BTs, and active PM tasks while preserving closed/archived history', () => {
    const machines = [
      { id_machine_registered: 'M-01', technician: 'TECH-01', status: 'En Service' },
      { id_machine_registered: 'M-02', technicien_responsable: 'Karim', status: "À l'Arrêt" },
      { id_machine_registered: 'M-ARCH', technician: 'TECH-01', status: 'ARCHIVEE', archived: true },
      { id_machine_registered: 'M-OTHER', technician: 'TECH-02', status: 'En Service' },
    ];
    const correctiveInterventions = [
      { id: 'BT-OPEN', intervenant: 'Karim', statut: 'EN_COURS' },
      { id: 'BT-PLAN', id_technicien: 'TECH-01', statut: 'BT_PLANIFIE' },
      { id: 'BT-CLOSED', intervenant: 'Karim', statut: 'CLOTURE' },
      { id: 'BT-REJECTED', intervenant: 'Karim', statut: 'OUVERTE', validation_status: 'REJECTED' },
    ];
    const preventiveTasks = [
      { id: 'PM-ACT', responsable: 'Karim', id_technicien: 'TECH-01', etat: 'ACTIVE' },
      { id: 'PM-SUSP', responsable: 'Karim', etat: 'SUSPENDUE' },
      { id: 'PM-ARCH', responsable: 'Karim', is_active: false },
    ];

    // Self-reassignment guard
    const selfResult = reconcileTechnicianReassignment({
      sourceTechId: 'TECH-01',
      sourceTechName: 'Karim',
      targetTechId: 'TECH-01',
      targetTechName: 'Karim',
      machines,
      correctiveInterventions,
      preventiveTasks,
    });
    expect(selfResult.totalReassigned).toBe(0);
    expect(selfResult.updatedMachines).toBe(machines);

    // Valid transfer
    const result = reconcileTechnicianReassignment({
      sourceTechId: 'TECH-01',
      sourceTechName: 'Karim',
      targetTechId: 'TECH-02',
      targetTechName: 'Nabil',
      machines,
      correctiveInterventions,
      preventiveTasks,
    });

    expect(result.reassignedMachinesCount).toBe(2);
    expect(result.reassignedBtsCount).toBe(2);
    expect(result.reassignedPmCount).toBe(1);
    expect(result.totalReassigned).toBe(5);

    // Active machines reassigned, archived & other untouched
    expect(result.updatedMachines.find((m) => m.id_machine_registered === 'M-01')?.technician).toBe('TECH-02');
    expect(result.updatedMachines.find((m) => m.id_machine_registered === 'M-02')?.technicien_responsable).toBe('TECH-02');
    expect(result.updatedMachines.find((m) => m.id_machine_registered === 'M-ARCH')?.technician).toBe('TECH-01');

    // Open BTs reassigned, closed & rejected untouched
    expect(result.updatedCorrectiveInterventions.find((b) => b.id === 'BT-OPEN')?.intervenant).toBe('Nabil');
    expect(result.updatedCorrectiveInterventions.find((b) => b.id === 'BT-PLAN')?.id_technicien).toBe('TECH-02');
    expect(result.updatedCorrectiveInterventions.find((b) => b.id === 'BT-CLOSED')?.intervenant).toBe('Karim');
    expect(result.updatedCorrectiveInterventions.find((b) => b.id === 'BT-REJECTED')?.intervenant).toBe('Karim');

    // Active PM reassigned, suspended & inactive untouched
    expect(result.updatedPreventiveTasks.find((p) => p.id === 'PM-ACT')?.id_technicien).toBe('TECH-02');
    expect(result.updatedPreventiveTasks.find((p) => p.id === 'PM-ACT')?.responsable).toBe('Nabil');
    expect(result.updatedPreventiveTasks.find((p) => p.id === 'PM-SUSP')?.responsable).toBe('Karim');
    expect(result.updatedPreventiveTasks.find((p) => p.id === 'PM-ARCH')?.responsable).toBe('Karim');
  });

  it('handleReassignTechnicianWorkload blocks archived targets, updates active datasets, preserves archived machines, and appends PERSONNEL_WORKLOAD_REASSIGNED audit event', () => {
    const technicians = [
      { id_technician: 'TECH-01', nom: 'Karim', is_active: true },
      { id_technician: 'TECH-02', nom: 'Nabil', is_active: true },
      { id_technician: 'TECH-OLD', nom: 'Ancien', is_active: false },
    ];
    const machinesBox = makeSetter<any[]>([
      { id_machine_registered: 'M-01', technician: 'TECH-01', status: 'En Service' },
      { id_machine_registered: 'M-ARCH', technician: 'TECH-01', status: 'ARCHIVEE', archived: true },
    ]);
    const btBox = makeSetter<any[]>([
      { id: 'BT-1', intervenant: 'Karim', statut: 'EN_COURS' },
      { id: 'BT-DONE', intervenant: 'Karim', statut: 'CLOTURE' },
    ]);
    const pmBox = makeSetter<any[]>([
      { id: 'PM-1', id_technicien: 'TECH-01', responsable: 'Karim', etat: 'ACTIVE' },
    ]);
    const audits: any[] = [];
    const toasts: Array<{ msg: string; type: string }> = [];

    const handlers = createComplexHandlers({
      zones: [],
      setZones: () => {},
      operations: [],
      setOperations: () => {},
      technicians,
      setTechnicians: () => {},
      machines: machinesBox.get(),
      setMachines: machinesBox.set,
      mouvements: [],
      setMouvements: () => {},
      setTypes: () => {},
      rawStock: [],
      setRawStock: () => {},
      setDesignations: () => {},
      setFamilies: () => {},
      templates: [],
      setTemplates: () => {},
      setCompGroups: () => {},
      compFamilies: [],
      setCompFamilies: () => {},
      compTemplates: [],
      setCompTemplates: () => {},
      setPartGroups: () => {},
      partTypes: [],
      setPartTypes: () => {},
      partDesignations: [],
      setPartDesignations: () => {},
      warehouseItems: [],
      setWarehouseItems: () => {},
      blueprints: [],
      setBlueprints: () => {},
      sortiesExterne: [],
      setSortiesExterne: () => {},
      sortieDemands: [],
      setSortieDemands: () => {},
      preventiveTasks: pmBox.get(),
      setPreventiveTasks: pmBox.set,
      preventiveExecutions: [],
      setPreventiveExecutions: () => {},
      meterReadings: [],
      setMeterReadings: () => {},
      correctiveInterventions: btBox.get(),
      setCorrectiveInterventions: btBox.set,
      machineElementsLedger: [],
      setMachineElementsLedger: () => {},
      appendAuditEvent: (ev: any) => audits.push(ev),
      showToast: (msg: string, type = 'info') => toasts.push({ msg, type }),
      setCurrentTab: () => {},
    });

    // Block inactive/archived target technician
    const blocked = handlers.handleReassignTechnicianWorkload({
      sourceTechId: 'TECH-01',
      targetTechId: 'TECH-OLD',
    });
    expect(blocked).toBeNull();
    expect(toasts.some((t) => t.type === 'warning')).toBe(true);
    expect(audits).toHaveLength(0);

    // Execute valid reassignment
    const res = handlers.handleReassignTechnicianWorkload({
      sourceTechId: 'TECH-01',
      targetTechId: 'TECH-02',
      includeMachines: true,
      includeOpenBts: true,
      includeActivePm: true,
    });

    expect(res).not.toBeNull();
    expect(res!.reassignedMachinesCount).toBe(1);
    expect(res!.reassignedBtsCount).toBe(1);
    expect(res!.reassignedPmCount).toBe(1);

    // Archived machine remains in array intact
    expect(machinesBox.get()).toHaveLength(2);
    expect(machinesBox.get().find((m) => m.id_machine_registered === 'M-01')?.technician).toBe('TECH-02');
    expect(machinesBox.get().find((m) => m.id_machine_registered === 'M-ARCH')?.technician).toBe('TECH-01');

    // Open BT reassigned, closed BT preserved
    expect(btBox.get().find((b) => b.id === 'BT-1')?.intervenant).toBe('Nabil');
    expect(btBox.get().find((b) => b.id === 'BT-DONE')?.intervenant).toBe('Karim');

    // Active PM reassigned
    expect(pmBox.get()[0].id_technicien).toBe('TECH-02');
    expect(pmBox.get()[0].responsable).toBe('Nabil');

    // Audit event emitted
    const audit = audits.find((a) => a.actionType === 'PERSONNEL_WORKLOAD_REASSIGNED');
    expect(audit).toBeDefined();
    expect(audit.entityType).toBe('TECHNICIAN');
    expect(audit.entityId).toBe('TECH-02');
    expect(audit.before).toEqual({ sourceTechId: 'TECH-01', sourceTechName: 'Karim' });
    expect(audit.after).toEqual({
      targetTechId: 'TECH-02',
      targetTechName: 'Nabil',
      reassignedMachinesCount: 1,
      reassignedBtsCount: 1,
      reassignedPmCount: 1,
    });
  });

  it('computeEquipmentCockpitMetrics isolates SYSTEM_GENERAL from PRODUCTION, excludes archived items, and computes all cockpit counters', () => {
    const refDate = new Date('2026-05-15T12:00:00Z');
    const metrics = computeEquipmentCockpitMetrics({
      referenceDate: refDate,
      machines: [
        {
          id_machine_registered: 'AIR-01',
          designation: 'Compresseur Atlas 55kW',
          asset_class: 'SYSTEM_GENERAL',
          id_zone_default: 'Z-UTIL',
          technician: 'TECH-01',
          status: "À l'Arrêt",
          cout_arret_horaire: 1800,
          valeur_acquisition: 80000,
        },
        {
          id_machine_registered: 'CHILL-01',
          designation: 'Groupe Froid Critique',
          asset_class: 'SYSTEM_GENERAL',
          id_zone_default: '', // incomplete setup
          technician: '', // incomplete setup
          status: 'En Maintenance',
          cout_arret_horaire: 500,
          valeur_acquisition: 10000, // Low acquisition + heavy cost => CRITIQUE_BER
        },
        {
          id_machine_registered: 'TGBT-01',
          designation: 'Armoire TGBT Principale',
          asset_class: 'SYSTEM_GENERAL',
          id_zone_default: 'Z-UTIL',
          technician: 'TECH-02',
          status: 'En Service',
          cout_arret_horaire: 0, // incomplete setup (missing hourly cost)
          valeur_acquisition: 150000,
        },
        {
          id_machine_registered: 'AIR-OLD',
          designation: 'Ancien Compresseur',
          asset_class: 'SYSTEM_GENERAL',
          id_zone_default: '',
          status: 'ARCHIVEE',
          archived: true,
          cout_arret_horaire: 5000,
        },
        {
          id_machine_registered: 'PROD-01',
          designation: 'Ligne Embouteillage (Production)',
          asset_class: 'PRODUCTION',
          status: "À l'Arrêt",
          cout_arret_horaire: 9999,
        },
      ],
      correctiveInterventions: [
        {
          id: 'BT-AIR-1',
          code_machine: 'AIR-01',
          statut: 'EN_COURS',
          date_demande: '2026-05-10',
          cout_pdr: 1000,
          temps_arret_minutes: 60,
        },
        {
          id: 'BT-CHILL-1',
          code_machine: 'CHILL-01',
          statut: 'CLOTURE',
          date_cloture: '2026-04-12',
          cout_pdr: 8000, // 80% of 10000 acquisition => CRITIQUE_BER
          temps_arret_minutes: 600,
        },
        {
          id: 'BT-PROD-1',
          code_machine: 'PROD-01',
          statut: 'EN_COURS',
          date_demande: '2026-05-11',
          cout_pdr: 25000,
        },
      ],
      preventiveTasks: [
        {
          id: 'PM-TGBT-1',
          id_machine: 'TGBT-01',
          etat: 'ACTIVE',
        },
        {
          id: 'PM-OLD-SUSP',
          id_machine: 'AIR-OLD',
          etat: 'SUSPENDUE',
        },
      ],
      preventiveExecutions: [],
      sortiesExterne: [],
      stockItems: [],
    });

    // Only 3 active SYSTEM_GENERAL assets counted (excludes AIR-OLD & PROD-01)
    expect(metrics.activeCount).toBe(3);
    expect(metrics.perEquipmentSignals['PROD-01']).toBeUndefined();
    expect(metrics.perEquipmentSignals['AIR-OLD'].isArchived).toBe(true);

    // Stopped or Maintenance: AIR-01 (1800) + CHILL-01 (500)
    expect(metrics.stoppedOrMaintCount).toBe(2);
    expect(metrics.activeHourlyLossDh).toBe(2300);

    // Bad actor: CHILL-01 exceeds BER threshold (8000 / 10000)
    expect(metrics.badActorsCount).toBe(1);
    expect(metrics.perEquipmentSignals['CHILL-01'].isBadActor).toBe(true);

    // Maint due: AIR-01 (1 open BT) + TGBT-01 (1 active PM)
    expect(metrics.maintDueCount).toBe(2);
    expect(metrics.totalOpenBtsCount).toBe(1);

    // Incomplete setup: CHILL-01 (no zone, no tech) + TGBT-01 (0 hourly cost)
    expect(metrics.incompleteSetupCount).toBe(2);
    expect(metrics.perEquipmentSignals['AIR-01'].isIncompleteSetup).toBe(false);
    expect(metrics.perEquipmentSignals['CHILL-01'].isIncompleteSetup).toBe(true);
    expect(metrics.perEquipmentSignals['TGBT-01'].missingHourlyCost).toBe(true);
  });

  it('buildQuickEditEquipmentUpdates normalizes status, filters untouched & archived equipments, and commits cleanly via handleUpdateMachine with audit log', () => {
    expect(normalizeCanonicalEquipStatus('STOPPED')).toBe("À l'Arrêt");
    expect(normalizeCanonicalEquipStatus('En Maintenance')).toBe('En Maintenance');
    expect(normalizeCanonicalEquipStatus('ACTIVE')).toBe('En Service');

    const machinesBox = makeSetter<any[]>([
      {
        id_machine_registered: 'AIR-01',
        designation: 'Compresseur 55kW',
        asset_class: 'SYSTEM_GENERAL',
        status: 'En Service',
        statut: 'En Service',
        technician: 'TECH-01',
        regime_travail: '2x8',
        cout_arret_horaire: 1000,
      },
      {
        id_machine_registered: 'CHILL-01',
        designation: 'Groupe Froid',
        asset_class: 'SYSTEM_GENERAL',
        status: 'En Service',
        statut: 'En Service',
        technician: 'TECH-02',
        regime_travail: '3x8',
        cout_arret_horaire: 1500,
      },
      {
        id_machine_registered: 'AIR-ARCH',
        designation: 'Compresseur Archivé',
        asset_class: 'SYSTEM_GENERAL',
        status: 'ARCHIVEE',
        archived: true,
        technician: 'TECH-01',
        regime_travail: '1x8',
        cout_arret_horaire: 500,
      },
    ]);

    const updates = buildQuickEditEquipmentUpdates(machinesBox.get(), {
      'AIR-01': {
        status: 'En Panne',
        technician: 'TECH-02',
        regime_travail: '3x8',
        cout_arret_horaire: 2400,
      },
      'CHILL-01': {
        status: 'En Service',
        technician: 'TECH-02',
        regime_travail: '3x8',
        cout_arret_horaire: 1500,
      },
      'AIR-ARCH': {
        status: 'En Service',
        technician: 'TECH-02',
      },
    });

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('AIR-01');
    expect(updates[0].updatedEquipment.status).toBe("À l'Arrêt");
    expect(updates[0].updatedEquipment.statut).toBe("À l'Arrêt");
    expect(updates[0].updatedEquipment.technician).toBe('TECH-02');
    expect(updates[0].updatedEquipment.regime_travail).toBe('3x8');
    expect(updates[0].updatedEquipment.cout_arret_horaire).toBe(2400);

    const audits: any[] = [];
    const handlers = createComplexHandlers({
      zones: [],
      setZones: () => {},
      operations: [],
      setOperations: () => {},
      technicians: [],
      setTechnicians: () => {},
      machines: machinesBox.get(),
      setMachines: machinesBox.set,
      mouvements: [],
      setMouvements: () => {},
      setTypes: () => {},
      rawStock: [],
      setRawStock: () => {},
      setDesignations: () => {},
      setFamilies: () => {},
      templates: [],
      setTemplates: () => {},
      setCompGroups: () => {},
      compFamilies: [],
      setCompFamilies: () => {},
      compTemplates: [],
      setCompTemplates: () => {},
      setPartGroups: () => {},
      partTypes: [],
      setPartTypes: () => {},
      partDesignations: [],
      setPartDesignations: () => {},
      warehouseItems: [],
      setWarehouseItems: () => {},
      blueprints: [],
      setBlueprints: () => {},
      sortiesExterne: [],
      setSortiesExterne: () => {},
      sortieDemands: [],
      setSortieDemands: () => {},
      preventiveTasks: [],
      setPreventiveTasks: () => {},
      preventiveExecutions: [],
      setPreventiveExecutions: () => {},
      meterReadings: [],
      setMeterReadings: () => {},
      correctiveInterventions: [],
      setCorrectiveInterventions: () => {},
      machineElementsLedger: [],
      setMachineElementsLedger: () => {},
      appendAuditEvent: (ev: any) => audits.push(ev),
      showToast: () => {},
      setCurrentTab: () => {},
    });

    for (const u of updates) {
      handlers.handleUpdateMachine(u.id, u.updatedEquipment);
    }

    const updatedAir = machinesBox.get().find((m) => m.id_machine_registered === 'AIR-01');
    expect(updatedAir.status).toBe("À l'Arrêt");
    expect(updatedAir.technician).toBe('TECH-02');
    expect(updatedAir.regime_travail).toBe('3x8');
    expect(updatedAir.cout_arret_horaire).toBe(2400);

    const audit = audits.find((a) => a.actionType === 'MACHINE_UPDATED' && a.entityId === 'AIR-01');
    expect(audit).toBeDefined();
    expect(audit.before.cout_arret_horaire).toBe(1000);
    expect(audit.after.cout_arret_horaire).toBe(2400);
    expect(audit.after.regime_travail).toBe('3x8');
  });

  it('isolates handleNavigateToZoneById (zoneSearch vs whSearch) and routes handleNavigateToEquipmentByZone to equipment tab', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    let activeTab = 'dashboard';
    let latestNav: ReturnType<typeof useAppNavigation> | null = null;
    const Harness = () => {
      latestNav = useAppNavigation({
        setCurrentTab: (next: string) => {
          activeTab = next;
        },
      });
      return null;
    };

    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(Harness));
    });

    await act(async () => {
      latestNav!.filters.setWhSearch('COMP-KEEP');
    });

    await act(async () => {
      latestNav!.navigation.handleNavigateToZoneById('Z-UTIL');
    });
    expect(activeTab).toBe('zones');
    expect(latestNav!.filters.zoneSearch).toBe('Z-UTIL');
    expect(latestNav!.filters.whSearch).toBe('COMP-KEEP');

    await act(async () => {
      latestNav!.navigation.handleNavigateToEquipmentByZone('Z-UTIL');
    });
    expect(activeTab).toBe('equipment');
    expect(latestNav!.filters.equipZoneFilter).toBe('Z-UTIL');

    await act(async () => {
      root.unmount();
    });
  });
});
