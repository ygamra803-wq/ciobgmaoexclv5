import { describe, it, expect, beforeEach } from 'vitest';
import { useAppComplexHandlers as createComplexHandlers } from '../../hooks/useAppComplexHandlers';
import { useGmaoStore } from '../../store/useGmaoStore';
import { DataGateway } from '../../application/DataGateway';
import {
  computeParentCorrectiveRollup,
  resolveMonthlyOperatingHours,
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

describe('Parc Machines — Phase B (Economic Downtime Cost, Economic BER Threshold & Shift Regime Reliability)', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    await DataGateway.clearAllForRealFactory(useGmaoStore.getState());
  });

  it('resolves monthly operating hours by shift regime (1x8=176h, 2x8=352h, 3x8=720h) and computes line availability and downtime cost rollup', () => {
    expect(resolveMonthlyOperatingHours({ regime_travail: '1x8' })).toBe(176);
    expect(resolveMonthlyOperatingHours({ regime_travail: '2x8' })).toBe(352);
    expect(resolveMonthlyOperatingHours({ regime_travail: '3x8' })).toBe(720);
    expect(resolveMonthlyOperatingHours({ heures_ouverture_mensuelles: 400, regime_travail: '1x8' })).toBe(400);

    const machines = [
      {
        id_machine_registered: 'LINE-A',
        designation: 'Ligne Assemblage A',
        asset_level: 'LINE',
        regime_travail: '2x8',
        cout_arret_horaire: 500,
        status: 'En service',
      },
      {
        id_machine_registered: 'MCH-A1',
        designation: 'Poste Soudure A1',
        asset_level: 'MACHINE',
        parent_id: 'LINE-A',
        regime_travail: '1x8', // 176h
        cout_arret_horaire: 1000, // 1000 DH/h
        status: 'En service',
      },
      {
        id_machine_registered: 'MCH-A2',
        designation: 'Poste Contrôle A2',
        asset_level: 'MACHINE',
        parent_id: 'LINE-A',
        regime_travail: '2x8', // 352h
        cout_arret_horaire: 600, // 600 DH/h
        status: 'En service',
      },
    ];

    const correctiveInterventions = [
      {
        id: 'BT-101',
        code_machine: 'MCH-A1',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        temps_arret_minutes: 120, // 2h downtime -> 2 * 1000 = 2000 DH
        temps_intervention_mins: 60, // 1h repair
      },
      {
        id: 'BT-102',
        code_machine: 'MCH-A2',
        statut: 'CLOTURE',
        validation_status: 'APPROVED',
        duree_arret_heures: 3, // 3h downtime -> 3 * 600 = 1800 DH
        temps_reparation_min: 90, // 1.5h repair
      },
    ];

    const rollup = computeParentCorrectiveRollup('LINE-A', machines, correctiveInterventions);

    expect(rollup.descendantCount).toBe(2);
    expect(rollup.approvedFailuresCount).toBe(2);
    expect(rollup.totalDowntimeHours).toBe(5);
    expect(rollup.totalRepairHours).toBe(2.5);
    expect(rollup.mttrHours).toBe(1.25);
    // Planned hours = 176 (MCH-A1) + 352 (MCH-A2) = 528h
    expect(rollup.totalPlannedHours).toBe(528);
    // Available hours = 528 - 5 = 523h -> MTBF = 523 / 2 = 261.5h
    expect(rollup.mtbfHours).toBe(261.5);
    expect(rollup.availabilityRatePercent).toBe(99.1);
    // Total downtime cost = 2000 + 1800 = 3800 DH
    expect(rollup.totalDowntimeCost).toBe(3800);
  });

  it('computes 12-month production loss cost, total economic impact, economic BER ratio, and shift-aware availability in MachineHealthPassportService', () => {
    const today = new Date().toISOString().slice(0, 10);
    const passport = computeMachineHealthPassport({
      machine: {
        id_machine_registered: 'PRS-01',
        designation: 'Presse Hydraulique 200T',
        cout_arret_horaire: 1500, // 1500 DH/h
        valeur_acquisition: 100000, // 100,000 DH
        regime_travail: '1x8', // 176h/month -> 2112h/12m
      },
      correctiveInterventions: [
        {
          id: 'BT-1',
          code_machine: 'PRS-01',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          cout_pdr: 32000,
          temps_arret_minutes: 240, // 4h downtime
          temps_intervention_mins: 120, // 2h repair
          date_cloture: today,
        },
      ],
      preventiveExecutions: [
        {
          id: 'PM-1',
          machineCode: 'PRS-01',
          validation_status: 'APPROVED',
          totalCost: 8000,
          executedAt: today,
        },
      ],
      sortiesExterne: [
        {
          id: 'EXT-1',
          id_machine: 'PRS-01',
          validation_status: 'APPROVED',
          cout_bobinage: 15000,
          date_montage: today,
        },
      ],
    });

    // Direct maintenance cost = 32,000 + 8,000 + 15,000 = 55,000 DH
    expect(passport.totalMaintenanceCost12m).toBe(55000);
    expect(passport.totalDowntimeHours12m).toBe(4);
    expect(passport.hourlyDowntimeCost).toBe(1500);
    // Downtime loss = 4h * 1500 DH/h = 6,000 DH
    expect(passport.downtimeProductionLossCost12m).toBe(6000);
    // Total economic impact = 55,000 + 6,000 = 61,000 DH
    expect(passport.totalEconomicImpact12m).toBe(61000);

    // Economic BER = 55,000 / 100,000 = 55% (>= 50% threshold)
    expect(passport.acquisitionValue).toBe(100000);
    expect(passport.berRatioPercent).toBe(55);
    expect(passport.isEconomicBerExceeded).toBe(true);
    expect(passport.healthStatus).toBe('CRITIQUE_BER');

    // Shift regime 1x8 -> 176h/month * 12 = 2112h planned
    expect(passport.regimeTravail).toBe('1x8');
    expect(passport.monthlyOperatingHours).toBe(176);
    expect(passport.plannedOperatingHours12m).toBe(2112);
    expect(passport.mttrHours12m).toBe(2);
    expect(passport.mtbfHours12m).toBe(2108);
    expect(passport.availabilityRate12m).toBe(99.8);
  });

  it('preserves cout_arret_horaire, valeur_acquisition, and regime_travail in Type A ASSETS_MACHINES round-trip', () => {
    const parcCommit = validateAndCommitRefParcBundle({
      zones: [{ code_zone: 'Z-PROD', libelle: 'Zone Production' }],
      families: [{ code_family: 'FAM-INJ', libelle: 'Injection' }],
      templates: [{ code_template: 'TPL-INJ', code_family: 'FAM-INJ', libelle: 'Presse Injection' }],
    });
    expect(parcCommit.success).toBe(true);

    const exported = exportAssetsMachinesBundle({
      machines: [
        {
          id_machine_registered: 'INJ-01',
          designation: 'Presse Injection 01',
          id_zone_default: 'Z-PROD',
          asset_class: 'PRODUCTION',
          id_family: 'FAM-INJ',
          id_templates: 'TPL-INJ',
          status: 'En Service',
          cout_arret_horaire: 950,
          valeur_acquisition: 240000,
          regime_travail: '3x8',
        } as any,
      ],
    });

    expect(exported.machines[0].cout_arret_horaire).toBe(950);
    expect(exported.machines[0].valeur_acquisition).toBe(240000);
    expect(exported.machines[0].regime_travail).toBe('3x8');

    const buffer = buildTypeAExcelWorkbookBuffer('ASSETS_MACHINES', exported);
    const parsed = parseTypeAExcelWorkbook(buffer);
    expect(parsed.ok).toBe(true);

    const report = runUnifiedImportPipeline(parsed.payload as any, { dryRun: false });
    expect(report.success).toBe(true);

    const committed = useGmaoStore
      .getState()
      .machines.find((m) => m.id_machine_registered === 'INJ-01');
    expect(committed).toBeDefined();
    expect(committed?.cout_arret_horaire).toBe(950);
    expect(committed?.valeur_acquisition).toBe(240000);
    expect(committed?.regime_travail).toBe('3x8');
  });

  it('audits changes to cout_arret_horaire, valeur_acquisition, and regime_travail in handleUpdateMachine', () => {
    let machinesState: any[] = [
      {
        id_machine_registered: 'MCH-01',
        designation: 'Compresseur 01',
        id_zone_default: 'Z-01',
        status: 'En Service',
        cout_arret_horaire: 0,
        valeur_acquisition: 0,
        regime_travail: '2x8',
      },
    ];
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

    handlers.handleUpdateMachine('MCH-01', {
      ...machinesState[0],
      cout_arret_horaire: 1200,
      valeur_acquisition: 180000,
      regime_travail: '3x8',
    });

    expect(audits).toHaveLength(1);
    expect(audits[0].actionType).toBe('MACHINE_UPDATED');
    expect(audits[0].before.cout_arret_horaire).toBe(0);
    expect(audits[0].after.cout_arret_horaire).toBe(1200);
    expect(audits[0].after.valeur_acquisition).toBe(180000);
    expect(audits[0].after.regime_travail).toBe('3x8');
  });
});
