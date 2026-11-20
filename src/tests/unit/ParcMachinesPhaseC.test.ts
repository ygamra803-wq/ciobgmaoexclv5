import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildQuickEditMachineUpdates,
  computeMachinesCockpitMetrics,
} from '../../domain/machines/machinesCockpitService';
import { useAppComplexHandlers as createComplexHandlers } from '../../hooks/useAppComplexHandlers';
import { useGmaoStore } from '../../store/useGmaoStore';
import { DataGateway } from '../../application/DataGateway';

describe('Parc Machines — Phase C (Owner Cockpit, Pilotage Terrain Quick-Edit & Batch QR Readiness)', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await DataGateway.clearAllForRealFactory(useGmaoStore.getState());
  });

  it('computes live Owner & Field Cockpit metrics while excluding archived machines from alarms', () => {
    const today = new Date().toISOString().slice(0, 10);

    const machines = [
      {
        id_machine_registered: 'PRS-01',
        designation: 'Presse Hydraulique 01',
        asset_class: 'PRODUCTION',
        status: 'Arrêt',
        id_zone_default: 'Z-PROD',
        technician: 'TECH-01',
        cout_arret_horaire: 1200,
        valeur_acquisition: 100000, // 100k DH
        regime_travail: '2x8',
      },
      {
        id_machine_registered: 'CMP-01',
        designation: 'Compresseur Atlas Copco',
        asset_class: 'SYSTEM_GENERAL',
        status: 'En Maintenance',
        id_zone_default: 'Z-UTIL',
        technician: 'TECH-02',
        cout_arret_horaire: 400, // Stopped/Maint hourly burn adds 400 DH/h
        valeur_acquisition: 200000,
        regime_travail: '3x8',
      },
      {
        id_machine_registered: 'CNC-02',
        designation: 'Centre Usinage 02',
        asset_class: 'PRODUCTION',
        status: 'En Service',
        id_zone_default: '', // Missing zone + tech + hourly cost -> Incomplete setup
        technician: '',
        cout_arret_horaire: 0,
        regime_travail: '2x8',
      },
      {
        id_machine_registered: 'OLD-99',
        designation: 'Ancienne Scie Archivée',
        asset_class: 'PRODUCTION',
        status: 'ARCHIVEE',
        is_active: false,
        archived: true,
        id_zone_default: '',
        technician: '',
        cout_arret_horaire: 5000, // Must NOT pollute active alarms
        valeur_acquisition: 50000,
      },
    ];

    const correctiveInterventions = [
      // Open BT on PRS-01 + closed high-cost BT pushing BER >= 50%
      {
        id: 'BT-OPEN-1',
        code_machine: 'PRS-01',
        statut: 'EN_COURS',
        date_demande: today,
      },
      {
        id: 'BT-CLOSED-1',
        code_machine: 'PRS-01',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        cout_pdr: 55000, // 55% of 100k acquisition -> BER exceeded!
        temps_arret_minutes: 120, // 2h * 1200 DH/h = 2400 DH production loss
        date_cloture: today,
      },
      {
        id: 'BT-OPEN-OLD',
        code_machine: 'OLD-99',
        statut: 'DEMANDE',
        date_demande: today,
      },
    ];

    const preventiveTasks = [
      {
        id: 'PM-1',
        id_machine: 'CMP-01',
        statut: 'PLANIFIEE',
        etat: 'à faire',
      },
      {
        id: 'PM-SUSP',
        id_machine: 'CNC-02',
        statut: 'SUSPENDUE',
        etat: 'à faire',
      },
    ];

    const metrics = computeMachinesCockpitMetrics({
      machines,
      correctiveInterventions,
      preventiveTasks,
      preventiveExecutions: [],
      sortiesExterne: [],
      stockItems: [],
    });

    // Only 3 active machines (OLD-99 excluded)
    expect(metrics.activeMachinesCount).toBe(3);

    // Stopped or Maintenance: PRS-01 (1200 DH/h) + CMP-01 (400 DH/h) = 2 machines, 1600 DH/h
    expect(metrics.stoppedMachinesCount).toBe(2);
    expect(metrics.activeHourlyLossDh).toBe(1600);

    // Bad actors: PRS-01 has BER 55% (>=50%) and economic impact 55,000 + 2,400 = 57,400 DH
    expect(metrics.badActorsCount).toBe(1);
    expect(metrics.perMachineSignals['PRS-01'].isEconomicBerExceeded).toBe(true);
    expect(metrics.perMachineSignals['PRS-01'].isBadActor).toBe(true);
    expect(metrics.badActorsEconomicImpact12m).toBe(57400);

    // Maint due: PRS-01 (1 open BT) + CMP-01 (1 due PM), while OLD-99 is archived and CNC-02 PM is SUSPENDUE
    expect(metrics.maintDueMachinesCount).toBe(2);
    expect(metrics.totalOpenBtsCount).toBe(1);

    // Incomplete setup: CNC-02 only (missing zone, tech, hourly cost)
    expect(metrics.incompleteSetupCount).toBe(1);
    expect(metrics.perMachineSignals['CNC-02'].isIncompleteSetup).toBe(true);
    expect(metrics.perMachineSignals['CNC-02'].missingZone).toBe(true);
    expect(metrics.perMachineSignals['CNC-02'].missingTechnician).toBe(true);
    expect(metrics.perMachineSignals['CNC-02'].missingHourlyCost).toBe(true);

    // Archived machine signal stays tagged archived and excluded from alarms
    expect(metrics.perMachineSignals['OLD-99'].isArchived).toBe(true);
    expect(metrics.perMachineSignals['OLD-99'].isStoppedOrMaint).toBe(false);
    expect(metrics.perMachineSignals['OLD-99'].isIncompleteSetup).toBe(false);
  });

  it('flags recurrent organ failure CRITIQUE_BER as bad actor even without acquisition value', () => {
    const today = new Date().toISOString().slice(0, 10);
    const machines = [
      {
        id_machine_registered: 'MCH-REC',
        designation: 'Broyeur 01',
        asset_class: 'PRODUCTION',
        status: 'En Service',
        id_zone_default: 'Z-01',
        technician: 'TECH-01',
        cout_arret_horaire: 300,
      },
    ];

    const correctiveInterventions = [1, 2, 3].map((i) => ({
      id: `BT-R-${i}`,
      code_machine: 'MCH-REC',
      statut: 'CLOTURE',
      validation_status: 'APPROVED',
      nom_composant: 'Roulement Principal',
      cout_pdr: 500,
      date_cloture: today,
    }));

    const metrics = computeMachinesCockpitMetrics({
      machines,
      correctiveInterventions,
    });

    expect(metrics.badActorsCount).toBe(1);
    expect(metrics.perMachineSignals['MCH-REC'].healthStatus).toBe('CRITIQUE_BER');
    expect(metrics.perMachineSignals['MCH-REC'].isBadActor).toBe(true);
  });

  it('builds minimal Pilotage Terrain quick-edit diffs and commits through handleUpdateMachine with AUDIT_EVENTS', () => {
    let machinesState: any[] = [
      {
        id_machine_registered: 'MCH-10',
        designation: 'Tour CNC 10',
        id_zone_default: 'Z-01',
        status: 'En Service',
        statut: 'En Service',
        technician: 'TECH-01',
        regime_travail: '2x8',
        cout_arret_horaire: 500,
      },
      {
        id_machine_registered: 'MCH-11',
        designation: 'Fraiseuse 11',
        id_zone_default: 'Z-01',
        status: 'En Service',
        statut: 'En Service',
        technician: 'TECH-02',
        regime_travail: '1x8',
        cout_arret_horaire: 300,
      },
      {
        id_machine_registered: 'MCH-ARC',
        designation: 'Tour Archivé',
        status: 'ARCHIVEE',
        is_active: false,
        archived: true,
        technician: 'TECH-01',
        regime_travail: '1x8',
        cout_arret_horaire: 100,
      },
    ];

    const updates = buildQuickEditMachineUpdates(machinesState, {
      'MCH-10': {
        status: 'Arrêt',
        technician: 'TECH-03',
        regime_travail: '3x8',
        cout_arret_horaire: '850',
      },
      // Untouched values on MCH-11 -> should be ignored
      'MCH-11': {
        status: 'En Service',
        technician: 'TECH-02',
        regime_travail: '1x8',
        cout_arret_horaire: 300,
      },
      // Archived machine -> must be ignored even if drafted
      'MCH-ARC': {
        status: 'En Service',
        cout_arret_horaire: 999,
      },
    });

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('MCH-10');
    expect(updates[0].updatedMachine.status).toBe('Arrêt');
    expect(updates[0].updatedMachine.statut).toBe('Arrêt');
    expect(updates[0].updatedMachine.technician).toBe('TECH-03');
    expect(updates[0].updatedMachine.regime_travail).toBe('3x8');
    expect(updates[0].updatedMachine.cout_arret_horaire).toBe(850);

    const audits: any[] = [];
    const handlers = createComplexHandlers({
      zones: [],
      setZones: () => {},
      operations: [],
      setOperations: () => {},
      technicians: [],
      setTechnicians: () => {},
      machines: machinesState,
      setMachines: (updater: any) => {
        machinesState = typeof updater === 'function' ? updater(machinesState) : updater;
      },
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

    updates.forEach((item) => {
      handlers.handleUpdateMachine(item.id, item.updatedMachine);
    });

    const updatedMch10 = machinesState.find((m) => m.id_machine_registered === 'MCH-10');
    expect(updatedMch10?.status).toBe('Arrêt');
    expect(updatedMch10?.technician).toBe('TECH-03');
    expect(updatedMch10?.regime_travail).toBe('3x8');
    expect(updatedMch10?.cout_arret_horaire).toBe(850);

    expect(audits).toHaveLength(1);
    expect(audits[0].actionType).toBe('MACHINE_UPDATED');
    expect(audits[0].after.status).toBe('Arrêt');
    expect(audits[0].after.cout_arret_horaire).toBe(850);
  });
});
