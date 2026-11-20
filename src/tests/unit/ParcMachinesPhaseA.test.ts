import { describe, it, expect, beforeEach } from 'vitest';
import { useAppComplexHandlers as createComplexHandlers } from '../../hooks/useAppComplexHandlers';
import { useAppEntityActions as createEntityActions } from '../../hooks/useAppEntityActions';
import { useGmaoStore } from '../../store/useGmaoStore';
import { DataGateway } from '../../application/DataGateway';
import {
  getMachineSerialNumber,
  getMachineCommissioningDate,
} from '../../presentation/pages/machines/MachinesRegisteredView';
import {
  computeParentCorrectiveRollup,
  extractCorrectiveDowntimeMinutes,
} from '../../utils/assetHierarchy';
import { computeMachineHealthPassport } from '../../application/services/MachineHealthPassportService';
import {
  exportAssetsMachinesBundle,
  runUnifiedImportPipeline,
  validateAndCommitRefParcBundle,
} from '../../services/import/unifiedImportPipeline';
import {
  buildTypeAExcelWorkbookBuffer,
  parseTypeAExcelWorkbook,
} from '../../services/import/typeAExcelBridge';

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

describe('Parc Machines — Phase A (Referential Integrity, Cascade, Zero Fake Data, Downtime & Round-Trip)', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await DataGateway.clearAllForRealFactory(useGmaoStore.getState());
  });

  it('deletes an unreferenced zone via handleDeleteZone, emits ZONE_DELETED audit, and blocks referenced zones', () => {
    const zonesBox = makeSetter([
      { id_zone: 'Z-REF', libelle: 'Zone Référencée' },
      { id_zone: 'Z-FREE', libelle: 'Zone Libre' },
    ]);
    const audits: any[] = [];
    const toasts: Array<{ msg: string; type?: string }> = [];

    const handlers = createComplexHandlers({
      zones: zonesBox.get(),
      setZones: zonesBox.set,
      operations: [],
      setOperations: () => {},
      technicians: [],
      setTechnicians: () => {},
      machines: [{ id_machine_registered: 'MCH-01', id_zone_default: 'Z-REF' }],
      setMachines: () => {},
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
      showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
      setCurrentTab: () => {},
    });

    handlers.handleDeleteZone('Z-REF');
    expect(zonesBox.get().map((z) => z.id_zone)).toEqual(['Z-REF', 'Z-FREE']);
    expect(toasts.some((t) => t.type === 'warning')).toBe(true);

    handlers.handleDeleteZone('Z-FREE');
    expect(zonesBox.get().map((z) => z.id_zone)).toEqual(['Z-REF']);
    expect(audits.some((a) => a.actionType === 'ZONE_DELETED' && a.entityId === 'Z-FREE')).toBe(true);
  });

  it('detaches active child machines on parent archive and cascades code rename to children and meterReadings', () => {
    const machinesBox = makeSetter([
      {
        id_machine_registered: 'LINE-01',
        designation: 'Ligne Découpe 01',
        asset_level: 'LINE',
        id_zone_default: 'Z-01',
        status: 'En service',
        is_active: true,
      },
      {
        id_machine_registered: 'DET-01',
        designation: 'Détoureuse 01',
        asset_level: 'MACHINE',
        parent_id: 'LINE-01',
        id_parent: 'LINE-01',
        id_zone_default: 'Z-01',
        status: 'En service',
        is_active: true,
      },
    ]);
    const metersBox = makeSetter([
      { id: 'MR-1', id_machine: 'DET-01', valeur: 1200 },
    ]);
    const blueprintsBox = makeSetter([
      { id_blueprint: 'BPT-01', id_family: 'FAM-01', id_templates: 'TPL-01', libelle: 'Plan 1' },
    ]);
    const familiesBox = makeSetter([{ id_family: 'FAM-01', libelle: 'Famille 1' }]);
    const templatesBox = makeSetter([
      { id_templates: 'TPL-01', id_family: 'FAM-01', libelle: 'Template 1' },
    ]);
    const audits: any[] = [];

    const getHandlers = () =>
      createComplexHandlers({
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
        setFamilies: familiesBox.set,
        templates: templatesBox.get(),
        setTemplates: templatesBox.set,
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
        blueprints: blueprintsBox.get(),
        setBlueprints: blueprintsBox.set,
        sortiesExterne: [],
        setSortiesExterne: () => {},
        sortieDemands: [],
        setSortieDemands: () => {},
        preventiveTasks: [],
        setPreventiveTasks: () => {},
        preventiveExecutions: [],
        setPreventiveExecutions: () => {},
        meterReadings: metersBox.get(),
        setMeterReadings: metersBox.set,
        correctiveInterventions: [],
        setCorrectiveInterventions: () => {},
        machineElementsLedger: [],
        setMachineElementsLedger: () => {},
        appendAuditEvent: (ev: any) => audits.push(ev),
        showToast: () => {},
        setCurrentTab: () => {},
      });

    // 1. Cascade Family & Template renames to Blueprints
    getHandlers().handleUpdateFamily('FAM-01', { id_family: 'FAM-CNC', libelle: 'Famille CNC' });
    getHandlers().handleUpdateTemplate('TPL-01', {
      id_templates: 'TPL-CNC',
      id_family: 'FAM-CNC',
      libelle: 'Template CNC',
    });
    expect(blueprintsBox.get()[0].id_family).toBe('FAM-CNC');
    expect(blueprintsBox.get()[0].id_templates).toBe('TPL-CNC');

    // 2. Cascade child machine rename to meterReadings
    getHandlers().handleUpdateMachine('DET-01', {
      ...machinesBox.get()[1],
      id_machine_registered: 'DET-01-NEW',
    });
    expect(metersBox.get()[0].id_machine).toBe('DET-01-NEW');

    // 3. Archiving parent LINE-01 via handleUpdateMachine detaches active child DET-01-NEW
    getHandlers().handleUpdateMachine('LINE-01', {
      ...machinesBox.get()[0],
      status: 'ARCHIVEE',
      is_active: false,
    });
    const detachedChild = machinesBox.get().find((m) => m.id_machine_registered === 'DET-01-NEW') as any;
    expect(detachedChild.parent_id).toBeNull();
    expect(detachedChild.id_parent).toBeNull();
    expect(detachedChild.previous_parent_id).toBe('LINE-01');
    expect(audits.some((a) => a.actionType === 'MACHINE_UPDATED' && a.entityId === 'LINE-01')).toBe(true);
  });

  it('blocks Blueprint deletion case-insensitively across machines and preventiveTasks', () => {
    const blueprintsBox = makeSetter([
      { id_blueprint: 'BPT-01', libelle: 'Plan Lié Machine' },
      { id_blueprint: 'BPT-02', libelle: 'Plan Lié PM' },
      { id_blueprint: 'BPT-03', libelle: 'Plan Libre' },
    ]);
    const audits: any[] = [];

    const gmaoState: any = {
      types: [],
      setTypes: () => {},
      designations: [],
      setDesignations: () => {},
      families: [],
      setFamilies: () => {},
      templates: [],
      setTemplates: () => {},
      blueprints: blueprintsBox.get(),
      setBlueprints: blueprintsBox.set,
      machines: [{ id_machine_registered: 'MCH-01', id_blueprint: 'bpt-01' }],
      setMachines: () => {},
      warehouseItems: [],
      setWarehouseItems: () => {},
      zones: [],
      setZones: () => {},
      technicians: [],
      setTechnicians: () => {},
      operations: [],
      setOperations: () => {},
      mouvements: [],
      setMouvements: () => {},
      rawStock: [],
      setRawStock: () => {},
      setCompGroups: () => {},
      compFamilies: [],
      setCompFamilies: () => {},
      compTemplates: [],
      setCompTemplates: () => {},
      partGroups: [],
      setPartGroups: () => {},
      partTypes: [],
      setPartTypes: () => {},
      partDesignations: [],
      setPartDesignations: () => {},
      preventiveTasks: [{ id: 'PM-1', id_blueprint: 'BPT-02' }],
      meterReadings: [],
      setMeterReadings: () => {},
      correctiveInterventions: [],
      machineElementsLedger: [],
      appendAuditEvent: (ev: any) => audits.push(ev),
    };

    const actions = createEntityActions({ gmaoState, showToast: () => {}, setCurrentTab: () => {} });

    actions.handleDeleteBlueprint('BPT-01');
    actions.handleDeleteBlueprint('bpt-02');
    expect(blueprintsBox.get().map((b) => b.id_blueprint)).toEqual(['BPT-01', 'BPT-02', 'BPT-03']);

    actions.handleDeleteBlueprint('BPT-03');
    expect(blueprintsBox.get().map((b) => b.id_blueprint)).toEqual(['BPT-01', 'BPT-02']);
    expect(audits.some((a) => a.actionType === 'BLUEPRINT_DELETED' && a.entityId === 'BPT-03')).toBe(true);
  });

  it('never fabricates fake serial numbers or commissioning dates when absent', () => {
    const emptyMachine = { id_machine_registered: 'MCH-99', designation: 'Presse 99' };
    expect(getMachineSerialNumber(emptyMachine)).toBe('');
    expect(getMachineCommissioningDate(emptyMachine)).toBe('');

    const realMachine = {
      id_machine_registered: 'MCH-01',
      serial_number: 'SN-REAL-7788',
      date_mise_en_service: '2024-06-12',
    };
    expect(getMachineSerialNumber(realMachine)).toBe('SN-REAL-7788');
    expect(getMachineCommissioningDate(realMachine)).toBe('2024-06-12');
  });

  it('unifies corrective downtime extraction across assetHierarchy and MachineHealthPassportService', () => {
    const btList = [
      {
        id: 'BT-1',
        code_machine: 'MCH-01',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        temps_arret_minutes: 90,
        date_cloture: new Date().toISOString().slice(0, 10),
      },
      {
        id: 'BT-2',
        code_machine: 'MCH-01',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        temps_arret_machine_min: 30,
        date_cloture: new Date().toISOString().slice(0, 10),
      },
      {
        id: 'BT-3',
        code_machine: 'MCH-01',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        duree_arret_heures: 1.5,
        date_cloture: new Date().toISOString().slice(0, 10),
      },
    ];

    expect(extractCorrectiveDowntimeMinutes(btList[0])).toBe(90);
    expect(extractCorrectiveDowntimeMinutes(btList[1])).toBe(30);
    expect(extractCorrectiveDowntimeMinutes(btList[2])).toBe(90);

    const rollup = computeParentCorrectiveRollup(
      'MCH-01',
      [{ id_machine_registered: 'MCH-01', status: 'En service' }],
      btList
    );
    const passport = computeMachineHealthPassport({
      machine: { id_machine_registered: 'MCH-01', designation: 'Presse 01' },
      correctiveInterventions: btList,
      preventiveExecutions: [],
      sortiesExterne: [],
      rawStock: [],
      mouvements: [],
    });

    expect(rollup.totalDowntimeHours).toBe(3.5);
    expect(passport.totalDowntimeHours12m).toBe(3.5);
  });

  it('preserves id_blueprint, compteur_actuel, and unite_compteur in Type A ASSETS_MACHINES round-trip', () => {
    const parcCommit = validateAndCommitRefParcBundle({
      zones: [{ code_zone: 'Z-ATELIER', libelle: 'Atelier Principal' }],
      families: [{ code_family: 'FAM-PR', libelle: 'Presses' }],
      templates: [{ code_template: 'TPL-PR', code_family: 'FAM-PR', libelle: 'Presse 100T' }],
    });
    expect(parcCommit.success).toBe(true);

    const exportedJson = exportAssetsMachinesBundle({
      machines: [
        {
          id_machine_registered: 'PR-01',
          designation: 'Presse 100T',
          id_zone_default: 'Z-ATELIER',
          asset_class: 'PRODUCTION',
          id_family: 'FAM-PR',
          id_templates: 'TPL-PR',
          id_blueprint: 'BPT-01',
          compteur_actuel: 4250,
          unite_compteur: 'h',
          status: 'En Service',
        } as any,
      ],
    });

    expect(exportedJson.machines[0].id_blueprint).toBe('BPT-01');
    expect(exportedJson.machines[0].compteur_actuel).toBe(4250);
    expect(exportedJson.machines[0].unite_compteur).toBe('h');

    const buffer = buildTypeAExcelWorkbookBuffer('ASSETS_MACHINES', exportedJson);
    const parsed = parseTypeAExcelWorkbook(buffer);
    expect(parsed.ok).toBe(true);
    expect(parsed.bundleType).toBe('ASSETS_MACHINES');

    const report = runUnifiedImportPipeline(parsed.payload as any, { dryRun: false });
    expect(report.success).toBe(true);
    const imported = useGmaoStore
      .getState()
      .machines.find((m) => m.id_machine_registered === 'PR-01') as any;
    expect(imported).toBeDefined();
    expect(imported.id_blueprint).toBe('BPT-01');
    expect(imported.compteur_actuel).toBe(4250);
    expect(imported.unite_compteur).toBe('h');
  });
});
