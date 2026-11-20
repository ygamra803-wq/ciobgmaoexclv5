import { describe, it, expect, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  computeZoneOperationalAnalytics,
  matchesMemberZone,
  matchesZoneRef,
} from '../../application/services/ZoneOperationalAnalyticsService';
import { computePersonnelWorkload } from '../../application/services/PersonnelWorkloadService';
import { computeMachineHealthPassport } from '../../application/services/MachineHealthPassportService';
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

describe('Zone & Equipment / Utilisateurs — Phase B Operational & Security Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('computes accurate Zone Operational Analytics (PROD vs SYSTEM_GENERAL, archived exclusions, CSV matching, 12m TCO & downtime loss, CRITIQUE/VIGILANCE/NOMINAL)', () => {
    const refDate = new Date('2026-05-15T12:00:00Z');
    const report = computeZoneOperationalAnalytics({
      referenceDate: refDate,
      zones: [
        { id_zone: 'Z-PROD-1', code_zone: 'ZP1', libelle: 'Atelier Embouteillage' },
        { id_zone: 'Z-UTIL', code_zone: 'ZU', libelle: 'Local Utilités' },
        { id_zone: 'Z-OK', code_zone: 'ZOK', libelle: 'Zone Propre' },
      ],
      machines: [
        {
          id_machine_registered: 'M-101',
          designation: 'Soutireuse Principale',
          id_zone_default: 'ZP1', // matches by code_zone
          status: "À l'Arrêt",
          cout_arret_horaire: 2000,
          valeur_acquisition: 500000,
          regime_travail: '2x8',
        },
        {
          id_machine_registered: 'M-102',
          designation: 'Etiqueteuse',
          id_zone_default: 'Z-PROD-1',
          status: 'En Service',
        },
        {
          id_machine_registered: 'M-OLD',
          designation: 'Ancienne Ligne',
          id_zone_default: 'Z-PROD-1',
          status: 'ARCHIVEE',
          archived: true,
        },
        {
          id_machine_registered: 'AIR-01',
          designation: 'Compresseur Atlas 55kW',
          asset_class: 'SYSTEM_GENERAL',
          id_zone_default: 'Z-UTIL',
          status: 'En Maintenance',
          cout_arret_horaire: 1200,
        },
        {
          id_machine_registered: 'CHILL-01',
          designation: 'Groupe Froid',
          asset_class: 'SYSTEM_GENERAL',
          id_zone_default: 'Z-OK',
          status: 'En Service',
        },
      ],
      technicians: [
        { id_technician: 'TECH-01', nom: 'Karim', id_zone: 'Z-PROD-1', is_active: true },
        { id_technician: 'TECH-ARCH', nom: 'Ancien Tech', id_zone: 'Z-PROD-1', is_active: false },
        { id_technician: 'TECH-ALL', nom: 'Polyvalent', id_zone: 'ALL', is_active: true },
        { id_technician: 'TECH-OK', nom: 'Youssef', id_zone: 'Z-OK', is_active: true },
      ],
      operations: [
        {
          id_operation: 'RESP-01',
          nom: 'Chef Zone',
          type_profil: 'SUPERVISEUR',
          id_zone: 'z-prod-1, Z-UTIL',
          zones: ['Z-PROD-1', 'Z-UTIL'],
        },
        {
          id_operation: 'OP-01',
          nom: 'Operateur Ligne',
          type_profil: 'OPERATEUR',
          id_zone: 'Z-PROD-1',
        },
        {
          id_operation: 'OP-ARCH',
          nom: 'Operateur Retiré',
          type_profil: 'OPERATEUR',
          id_zone: 'Z-PROD-1',
          statut: 'ARCHIVE',
        },
      ],
      warehouseItems: [
        { id: 'WH-1', id_zone: 'Z-PROD-1' },
        { id: 'WH-2', id_zone_default: 'ZU' },
      ],
      correctiveInterventions: [
        {
          id: 'BT-1',
          code_machine: 'M-101',
          statut: 'EN_COURS',
          date_demande: '2026-05-10',
          cout_pdr: 3500,
          temps_arret_minutes: 180, // 3h -> 6000 DH loss
        },
        {
          id: 'BT-PENDING-CLAIM',
          code_machine: 'M-102',
          statut: 'EN_ATTENTE_VALIDATION',
          validation_status: 'PENDING_VALIDATION',
          date_demande: '2026-05-12',
          cout_pdr: 99999, // Must NOT enter official TCO until validated
        },
        {
          id: 'BT-CLOSED-OLD',
          code_machine: 'CHILL-01',
          statut: 'CLOTURE',
          date_cloture: '2026-04-20',
          cout_pdr: 400,
        },
      ],
      preventiveTasks: [
        {
          id: 'PM-OVERDUE',
          id_machine: 'AIR-01',
          prochaine_date: '2026-05-01',
          etat: 'ACTIVE',
        },
        {
          id: 'PM-SUSPENDED',
          id_machine: 'M-OLD',
          prochaine_date: '2026-01-01',
          etat: 'SUSPENDUE',
        },
      ],
      preventiveExecutions: [
        {
          id: 'PME-1',
          machineCode: 'AIR-01',
          executedAt: '2026-05-02',
          totalCost: 1200,
          validation_status: 'APPROVED',
        },
      ],
      sortiesExterne: [
        {
          id: 'EXT-1',
          id_machine: 'M-101',
          date_demontage: '2026-05-05',
          cout_bobinage: 2500,
        },
      ],
      stockItems: [],
    });

    const prod = report.byZoneKey['Z-PROD-1'];
    expect(prod).toBeDefined();
    expect(prod.activeMachinesCount).toBe(2);
    expect(prod.activeProductionCount).toBe(2);
    expect(prod.activeSystemGeneralCount).toBe(0);
    expect(prod.archivedMachinesCount).toBe(1);
    expect(prod.stoppedMachinesCount).toBe(1);
    expect(prod.activeTechniciansCount).toBe(1); // excludes archived & 'ALL'
    expect(prod.archivedTechniciansCount).toBe(1);
    expect(prod.activeResponsablesCount).toBe(1);
    expect(prod.activeOperatorsCount).toBe(1);
    expect(prod.archivedOperationsCount).toBe(1);
    expect(prod.openCorrectiveCount).toBe(2); // BT-1 + BT-PENDING-CLAIM
    expect(prod.pendingValidationCount).toBe(1);
    expect(prod.totalMaintenanceCost12m).toBe(6000); // 3500 BT-1 + 2500 EXT-1 (excludes pending 99999)
    expect(prod.downtimeHours12m).toBe(3);
    expect(prod.downtimeProductionLossCost12m).toBe(6000); // 3h * 2000 DH/h
    expect(prod.zoneStatus).toBe('CRITIQUE');

    const util = report.byZoneKey['Z-UTIL'];
    expect(util.activeMachinesCount).toBe(1);
    expect(util.activeSystemGeneralCount).toBe(1);
    expect(util.activeTechniciansCount).toBe(0);
    expect(util.activeResponsablesCount).toBe(1); // CSV multi-zone match
    expect(util.overduePreventiveCount).toBe(1);
    expect(util.maintenanceMachinesCount).toBe(1);
    expect(util.totalMaintenanceCost12m).toBe(1200);
    expect(util.zoneStatus).toBe('VIGILANCE');

    const ok = report.byZoneKey['Z-OK'];
    expect(ok.zoneStatus).toBe('NOMINAL');
    expect(ok.totalMaintenanceCost12m).toBe(400);

    // Canonical totals avoid double-counting multi-zone RESP-01
    expect(report.totals.totalZones).toBe(3);
    expect(report.totals.activeResponsablesCount).toBe(1);
    expect(report.totals.activeOperatorsCount).toBe(1);
    expect(report.totals.activeTechniciansCount).toBe(3); // TECH-01, TECH-ALL, TECH-OK
    expect(report.totals.totalMaintenanceCost12m).toBe(7600);
    expect(report.totals.downtimeProductionLossCost12m).toBe(6000);

    // Helper checks
    expect(matchesZoneRef('zp1', { id_zone: 'Z-PROD-1', code_zone: 'ZP1' })).toBe(true);
    expect(
      matchesMemberZone({ id_zone: 'ALL' }, { id_zone: 'Z-OK' }, { includeAll: true })
    ).toBe(true);
  });

  it('computes Personnel Workload, security account warnings (missingPasswordWarning), and unassigned active technician counts', () => {
    const refDate = new Date('2026-05-15T12:00:00Z');
    const report = computePersonnelWorkload({
      referenceDate: refDate,
      technicians: [
        { id_technician: 'TECH-01', nom: 'Karim', is_active: true },
        { id_technician: 'TECH-02', nom: 'Nabil', is_active: true },
        { id_technician: 'TECH-OLD', nom: 'Retraite', is_active: false },
      ],
      operations: [
        { id_operation: 'OP-01', nom: 'Salma', is_active: true },
      ],
      machines: [
        { id_machine_registered: 'M-01', technician: 'Karim', status: 'En Service' },
        { id_machine_registered: 'M-02', technician: 'TECH-01', status: 'En Service' },
        { id_machine_registered: 'M-ARCH', technician: 'Karim', status: 'ARCHIVEE', archived: true },
      ],
      correctiveInterventions: [
        { id: 'BT-1', intervenant: 'Karim', statut: 'EN_COURS' },
        { id: 'BT-2', id_technicien: 'TECH-01', statut: 'OUVERTE' },
        { id: 'BT-3', intervenant: 'Karim', statut: 'BT_PLANIFIE' },
        { id: 'BT-CLOSED', intervenant: 'Karim', statut: 'CLOTURE' },
        { id: 'BT-REJECTED', intervenant: 'Karim', statut: 'OUVERTE', validation_status: 'REJECTED' },
      ],
      preventiveTasks: [
        { id: 'PM-1', responsable: 'Karim', etat: 'ACTIVE' },
        { id: 'PM-SUSP', responsable: 'Karim', etat: 'SUSPENDUE' },
      ],
      preventiveExecutions: [
        { id: 'E-1', executorName: 'Karim', executedAt: '2026-05-10', validation_status: 'APPROVED' },
        { id: 'E-OLD', executorName: 'Karim', executedAt: '2026-01-01', validation_status: 'APPROVED' },
        { id: 'E-PEND', executorName: 'Karim', executedAt: '2026-05-12', validation_status: 'PENDING_VALIDATION' },
      ],
      sortiesExterne: [
        { id: 'EXT-1', technicien_demontage: 'Karim', statut: 'CHEZ_PRESTATAIRE' },
        { id: 'EXT-DONE', technicien_montage: 'Karim', statut: 'MONTE' },
      ],
      authAccounts: [
        { personnelId: 'TECH-01', isActive: true, hasPassword: true },
        { personnelId: 'TECH-02', isActive: true, hasPassword: false },
        { personnelId: 'OP-01', isActive: false, hasPassword: false },
      ],
    });

    const karim = report.byPersonId['TECH-01'];
    expect(karim.assignedMachinesCount).toBe(2); // M-01 + M-02 (excludes archived M-ARCH)
    expect(karim.assignedMachineCodes).toEqual(['M-01', 'M-02']);
    expect(karim.openCorrectiveCount).toBe(3); // excludes BT-CLOSED & BT-REJECTED
    expect(karim.activePreventiveTasksCount).toBe(1);
    expect(karim.completedExecutions30dCount).toBe(1);
    expect(karim.activeExternalSortiesCount).toBe(1);
    expect(karim.missingPasswordWarning).toBe(false);
    expect(karim.workloadLevel).toBe('SURCHARGE');

    const nabil = report.byPersonId['TECH-02'];
    expect(nabil.workloadLevel).toBe('DISPONIBLE');
    expect(nabil.missingPasswordWarning).toBe(true);

    const salma = report.byPersonId['OP-01'];
    expect(salma.hasAccount).toBe(true);
    expect(salma.isAccessActive).toBe(false);
    expect(salma.missingPasswordWarning).toBe(false); // Disabled accounts do not trigger active password warning

    const oldTech = report.byPersonId['TECH-OLD'];
    expect(oldTech.workloadLevel).toBe('ARCHIVE');

    expect(report.summary.totalMembers).toBe(4);
    expect(report.summary.totalActive).toBe(3);
    expect(report.summary.archivedCount).toBe(1);
    expect(report.summary.activeTechsCount).toBe(2);
    expect(report.summary.unassignedActiveTechsCount).toBe(1);
    expect(report.summary.activeAccessCount).toBe(2);
    expect(report.summary.disabledAccessCount).toBe(1);
    expect(report.summary.missingPasswordCount).toBe(1);
  });

  it('cascades technician and operation renames across sortiesExterne, sortieDemands, and preventiveExecutions with audit trail', () => {
    const opsBox = makeSetter<any[]>([{ id_operation: 'OP-01', nom: 'Ancien Op' }]);
    const techBox = makeSetter<any[]>([{ id_technician: 'TECH-01', nom: 'Ancien Tech' }]);
    const machinesBox = makeSetter<any[]>([{ id_machine_registered: 'M-01', technician: 'Ancien Tech' }]);
    const mvBox = makeSetter<any[]>([
      { id: 'MV-1', technicien: 'Ancien Tech' },
      { id: 'MV-2', operation: 'Ancien Op', demandeur: 'Ancien Op' },
    ]);
    const pmBox = makeSetter<any[]>([
      { id: 'PM-1', technicien: 'Ancien Tech', responsable: 'Ancien Op' },
    ]);
    const pmExecBox = makeSetter<any[]>([
      { id: 'PME-1', executorName: 'Ancien Tech' },
      { id: 'PME-2', executorName: 'Ancien Op', technicien: 'Ancien Op' },
    ]);
    const btBox = makeSetter<any[]>([
      { id: 'BT-1', intervenant: 'Ancien Tech', demandeur: 'Ancien Op', submitted_by_name: 'Ancien Op' },
    ]);
    const extBox = makeSetter<any[]>([
      { id: 'EXT-1', technicien_demontage: 'Ancien Tech', technicien_montage: 'Ancien Op' },
    ]);
    const sdBox = makeSetter<any[]>([
      { id: 'SD-1', technicien_nom: 'Ancien Tech', demandeur_nom: 'Ancien Op' },
    ]);
    const audits: any[] = [];

    const handlers = createComplexHandlers({
      zones: [],
      setZones: () => {},
      operations: opsBox.get(),
      setOperations: opsBox.set,
      technicians: techBox.get(),
      setTechnicians: techBox.set,
      machines: machinesBox.get(),
      setMachines: machinesBox.set,
      mouvements: mvBox.get(),
      setMouvements: mvBox.set,
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
      sortiesExterne: extBox.get(),
      setSortiesExterne: extBox.set,
      sortieDemands: sdBox.get(),
      setSortieDemands: sdBox.set,
      preventiveTasks: pmBox.get(),
      setPreventiveTasks: pmBox.set,
      preventiveExecutions: pmExecBox.get(),
      setPreventiveExecutions: pmExecBox.set,
      meterReadings: [],
      setMeterReadings: () => {},
      correctiveInterventions: btBox.get(),
      setCorrectiveInterventions: btBox.set,
      machineElementsLedger: [],
      setMachineElementsLedger: () => {},
      appendAuditEvent: (ev: any) => audits.push(ev),
      showToast: () => {},
      setCurrentTab: () => {},
    });

    handlers.handleUpdateTechnician('TECH-01', { id_technician: 'TECH-01', nom: 'Nouveau Tech' });
    handlers.handleUpdateOperation('OP-01', { id_operation: 'OP-01', nom: 'Nouvel Op' });

    expect(machinesBox.get()[0].technician).toBe('Nouveau Tech');
    expect(pmExecBox.get()[0].executorName).toBe('Nouveau Tech');
    expect(pmExecBox.get()[1].executorName).toBe('Nouvel Op');
    expect(pmExecBox.get()[1].technicien).toBe('Nouvel Op');
    expect(extBox.get()[0].technicien_demontage).toBe('Nouveau Tech');
    expect(extBox.get()[0].technicien_montage).toBe('Nouvel Op');
    expect(sdBox.get()[0].technicien_nom).toBe('Nouveau Tech');
    expect(sdBox.get()[0].demandeur_nom).toBe('Nouvel Op');
    expect(audits.some((a) => a.actionType === 'TECHNICIAN_UPDATED' && a.entityId === 'TECH-01')).toBe(true);
    expect(audits.some((a) => a.actionType === 'OPERATION_UPDATED' && a.entityId === 'OP-01')).toBe(true);
  });

  it('routes handleNavigateToTechsByZone and handleNavigateToOpsByZone to canonical "utilisateurs" tab', async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    let activeTab = 'zones';
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
      latestNav!.navigation.handleNavigateToTechsByZone('Z-01');
    });
    expect(activeTab).toBe('utilisateurs');
    expect(latestNav!.filters.techZoneFilter).toBe('Z-01');

    activeTab = 'zones';
    await act(async () => {
      latestNav!.navigation.handleNavigateToOpsByZone('Z-02');
    });
    expect(activeTab).toBe('utilisateurs');
    expect(latestNav!.filters.opZoneFilter).toBe('Z-02');

    await act(async () => {
      root.unmount();
    });
  });

  it('computes Health Passport 360° & economic downtime TCO for a SYSTEM_GENERAL equipment', () => {
    const passport = computeMachineHealthPassport({
      referenceDate: '2026-05-15T12:00:00Z',
      machine: {
        id_machine_registered: 'AIR-01',
        designation: 'Compresseur Vis 55kW',
        cout_arret_horaire: 1500,
        valeur_acquisition: 100000,
        regime_travail: '3x8',
      },
      stockItems: [{ ref: 'FIL-01', prix_unitaire: 600 }],
      correctiveInterventions: [
        {
          id: 'BT-AIR-1',
          code_machine: 'AIR-01',
          statut: 'CLOTURE',
          date_cloture: '2026-05-10',
          pieces_utilisees: [{ ref: 'FIL-01', quantite: 2 }],
          temps_arret_minutes: 1440, // 24h downtime
          temps_intervention_mins: 120, // 2h repair
          nom_composant: 'Bloc Vis',
        },
        {
          id: 'BT-AIR-PEND',
          code_machine: 'AIR-01',
          statut: 'EN_ATTENTE_VALIDATION',
          validation_status: 'PENDING_VALIDATION',
          date_demande: '2026-05-11',
          cout_pdr: 50000,
        },
      ],
      preventiveExecutions: [
        {
          id: 'PME-AIR-1',
          machineCode: 'AIR-01',
          executedAt: '2026-04-15',
          totalCost: 800,
          validation_status: 'APPROVED',
        },
      ],
      sortiesExterne: [
        {
          id: 'EXT-AIR-1',
          id_machine: 'AIR-01',
          date_demontage: '2026-03-10',
          cout_bobinage: 3000,
        },
      ],
    });

    expect(passport.machineCode).toBe('AIR-01');
    expect(passport.regimeTravail).toBe('3x8');
    expect(passport.correctivePdrCost12m).toBe(1200);
    expect(passport.preventiveTotalCost12m).toBe(800);
    expect(passport.externalBobinageCost12m).toBe(3000);
    expect(passport.totalMaintenanceCost12m).toBe(5000);
    expect(passport.totalDowntimeHours12m).toBe(24);
    expect(passport.downtimeProductionLossCost12m).toBe(36000); // 24h * 1500 DH/h
    expect(passport.totalEconomicImpact12m).toBe(41000);
    expect(passport.berRatioPercent).toBe(5);
    expect(passport.mttrHours12m).toBe(2);
    expect(passport.availabilityRate12m).toBeLessThan(100);
  });
});
