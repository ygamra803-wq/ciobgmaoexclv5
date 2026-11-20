import { describe, it, expect, beforeEach } from 'vitest';
import {
  STRICT_ADMIN_ONLY_ENTITIES,
  canRoleMutateEntity,
  sanitizeBulkStateForRole,
} from '../../core/security/serverRbacPolicy';
import { AuthorizationService } from '../../core/security/AuthorizationService';
import { AuthService } from '../../core/security/AuthService';
import { normalizeEquipStatus } from '../../presentation/pages/equipment/EquipmentView';
import { useAppEntityActions as createEntityActions } from '../../hooks/useAppEntityActions';
import { useAppComplexHandlers as createComplexHandlers } from '../../hooks/useAppComplexHandlers';
import { useGmaoStore } from '../../store/useGmaoStore';
import { DataGateway } from '../../application/DataGateway';

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

describe('Zone & Equipment / Utilisateurs — Phase A Regression Suite', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    AuthService.instance = null;
    await DataGateway.clearAllForRealFactory(useGmaoStore.getState());
  });

  it('enforces STRICT_ADMIN_ONLY_ENTITIES on users and authAccounts for non-ADMIN roles including RESPONSABLE_MAINTENANCE', () => {
    expect(STRICT_ADMIN_ONLY_ENTITIES.has('users')).toBe(true);
    expect(STRICT_ADMIN_ONLY_ENTITIES.has('authAccounts')).toBe(true);

    expect(canRoleMutateEntity('ADMIN', 'users', 'POST').allowed).toBe(true);
    expect(canRoleMutateEntity('ADMIN', 'authAccounts', 'POST').allowed).toBe(true);

    expect(canRoleMutateEntity('RESPONSABLE_MAINTENANCE', 'users', 'POST').allowed).toBe(false);
    expect(canRoleMutateEntity('RESPONSABLE_MAINTENANCE', 'authAccounts', 'PUT').allowed).toBe(false);
    expect(canRoleMutateEntity('TECHNICIEN', 'users', 'POST').allowed).toBe(false);
    expect(canRoleMutateEntity('RESPONSABLE_MAGASIN', 'authAccounts', 'POST').allowed).toBe(false);

    const bulkCheck = sanitizeBulkStateForRole('RESPONSABLE_MAINTENANCE', {
      users: [{ id: 'u-1', role: 'ADMIN' }],
      authAccounts: [{ id: 'acct-1', role: 'ADMIN' }],
      zones: [{ id_zone: 'Z-01', libelle: 'Atelier A' }],
      machines: [{ id_machine_registered: 'M-01' }],
    });

    expect(bulkCheck.allowed).toBe(true);
    expect(bulkCheck.strippedKeys).toEqual(expect.arrayContaining(['users', 'authAccounts']));
    expect(bulkCheck.sanitizedState.users).toBeUndefined();
    expect(bulkCheck.sanitizedState.authAccounts).toBeUndefined();
    expect(bulkCheck.sanitizedState.zones).toHaveLength(1);
    expect(bulkCheck.sanitizedState.machines).toHaveLength(1);
  });

  it('grants TECHNICIEN zone.view permission', () => {
    const techUser = { id: 'TECH-01', role: 'TECHNICIEN' };
    expect(AuthorizationService.hasPermission(techUser, 'zone.view')).toBe(true);
    expect(AuthorizationService.hasPermission(techUser, 'zone.delete')).toBe(false);
  });

  it('tracks hasPassword, assigns RESPONSABLE_MAINTENANCE / OPERATEUR metadata, and cascades zone renames in AuthService', async () => {
    const auth = new AuthService();

    const passwordless = await auth.upsertPersonnelAuthAccount({
      personnelId: 'OP-01',
      nom: 'Operateur Alpha',
      id_zone: 'Z-OLD',
      specialite: 'Ligne Bottling',
      role: 'OPERATEUR',
      username: 'op_alpha',
      isActive: true,
    });

    expect(passwordless.hasPassword).toBe(false);
    expect(passwordless.badgeColor).toBe('cyan');
    expect(passwordless.titleFr).toContain('Opérateur Production');

    const retrievedNoPass = auth.getAccountForPersonnel('OP-01');
    expect(retrievedNoPass?.hasPassword).toBe(false);

    const withPass = await auth.upsertPersonnelAuthAccount({
      personnelId: 'RESP-10',
      nom: 'Chef Maintenance',
      id_zone: 'Z-OLD, Z-OTHER',
      specialite: 'Supervision',
      role: 'RESPONSABLE_MAINTENANCE',
      username: 'chef_maint',
      plainPassword: 'MaintUser2026',
      isActive: true,
    });

    expect(withPass.hasPassword).toBe(true);
    expect(withPass.badgeColor).toBe('purple');
    expect(withPass.titleFr).toContain('Responsable Maintenance');

    const available = auth.getAvailableAccounts(true);
    expect(available.find((a) => a.personnelId === 'OP-01')?.hasPassword).toBe(false);
    expect(available.find((a) => a.personnelId === 'RESP-10')?.hasPassword).toBe(true);

    const updatedCount = auth.cascadeZoneRename('z-old', 'Z-NEW');
    expect(updatedCount).toBe(2);
    expect(auth.getAccountForPersonnel('OP-01')?.id_zone).toBe('Z-NEW');
    expect(auth.getAccountForPersonnel('RESP-10')?.id_zone).toBe('Z-NEW, Z-OTHER');
  });

  it('normalizes legacy and mixed equipment status strings into canonical values', () => {
    expect(normalizeEquipStatus('En service')).toBe('En Service');
    expect(normalizeEquipStatus('En Service')).toBe('En Service');
    expect(normalizeEquipStatus('en maintenance')).toBe('En Maintenance');
    expect(normalizeEquipStatus('Maintenance')).toBe('En Maintenance');
    expect(normalizeEquipStatus("À l'Arrêt")).toBe("À l'Arrêt");
    expect(normalizeEquipStatus('Arrêt')).toBe("À l'Arrêt");
    expect(normalizeEquipStatus('Hors Service')).toBe("À l'Arrêt");
    expect(normalizeEquipStatus('inactive')).toBe("À l'Arrêt");
  });

  it('normalizes zone IDs, rejects duplicates, and cascades rename across all operational tables with audit trail', async () => {
    const zonesBox = makeSetter<any[]>([]);
    const opsBox = makeSetter<any[]>([
      { id_operation: 'RESP-01', nom: 'Chef Z', id_zone: 'Z-01, Z-02', zones: ['z-01', 'Z-02'] },
    ]);
    const techBox = makeSetter<any[]>([
      { id_technician: 'TECH-01', nom: 'Tech Z', id_zone: 'z-01' },
    ]);
    const machinesBox = makeSetter<any[]>([
      { id_machine_registered: 'SYS-01', id_zone_default: 'Z-01', asset_class: 'GENERAL_SYSTEM' },
    ]);
    const warehouseBox = makeSetter<any[]>([
      { id: 'WH-01', id_zone: 'Z-01', id_zone_default: 'z-01' },
    ]);
    const mvBox = makeSetter<any[]>([
      { id: 'MV-01', id_zone: 'Z-01', type: 'SORTIE' },
    ]);
    const pmBox = makeSetter<any[]>([
      { id: 'PM-01', id_zone: 'Z-01' },
    ]);
    const pmExecBox = makeSetter<any[]>([
      { id: 'PME-01', id_zone: 'Z-01' },
    ]);
    const btBox = makeSetter<any[]>([
      { id: 'BT-01', id_zone: 'Z-01' },
    ]);
    const sdBox = makeSetter<any[]>([
      { id: 'SD-01', id_zone: 'Z-01' },
    ]);
    const bomBox = makeSetter<any[]>([
      { id: 'BOM-01', id_zone: 'Z-01' },
    ]);
    const audits: any[] = [];
    const toasts: Array<{ msg: string; type?: string }> = [];

    const makeEntityState = () => ({
      types: [],
      setTypes: () => {},
      designations: [],
      setDesignations: () => {},
      families: [],
      setFamilies: () => {},
      templates: [],
      setTemplates: () => {},
      blueprints: [],
      setBlueprints: () => {},
      machines: machinesBox.get(),
      setMachines: machinesBox.set,
      warehouseItems: warehouseBox.get(),
      setWarehouseItems: warehouseBox.set,
      zones: zonesBox.get(),
      setZones: zonesBox.set,
      technicians: techBox.get(),
      setTechnicians: techBox.set,
      operations: opsBox.get(),
      setOperations: opsBox.set,
      mouvements: mvBox.get(),
      setMouvements: mvBox.set,
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
      preventiveTasks: pmBox.get(),
      meterReadings: [],
      setMeterReadings: () => {},
      correctiveInterventions: btBox.get(),
      machineElementsLedger: bomBox.get(),
      appendAuditEvent: (ev: any) => audits.push(ev),
    });

    const entityActions = createEntityActions({
      gmaoState: makeEntityState(),
      showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
      setCurrentTab: () => {},
    });

    const added = entityActions.handleAddZone({
      id_zone: 'z-01',
      code_zone: 'z-01',
      libelle: 'Atelier Conditionnement',
    });
    expect(added).toBe(true);
    expect(zonesBox.get()[0].id_zone).toBe('Z-01');
    expect(audits.some((a) => a.actionType === 'ZONE_CREATED' && a.entityId === 'Z-01')).toBe(true);

    // Sync local zones into duplicate check call
    const entityActionsWithExisting = createEntityActions({
      gmaoState: makeEntityState(),
      showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
      setCurrentTab: () => {},
    });
    const dup = entityActionsWithExisting.handleAddZone({
      id_zone: 'Z-01',
      libelle: 'Duplicate',
    });
    expect(dup).toBe(false);

    const auth = new AuthService();
    await auth.upsertPersonnelAuthAccount({
      personnelId: 'TECH-01',
      nom: 'Tech Z',
      id_zone: 'Z-01',
      role: 'TECHNICIEN',
      username: 'techz',
      isActive: true,
    });

    const handlers = createComplexHandlers({
      zones: zonesBox.get(),
      setZones: zonesBox.set,
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
      warehouseItems: warehouseBox.get(),
      setWarehouseItems: warehouseBox.set,
      blueprints: [],
      setBlueprints: () => {},
      sortiesExterne: [],
      setSortiesExterne: () => {},
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
      machineElementsLedger: bomBox.get(),
      setMachineElementsLedger: bomBox.set,
      appendAuditEvent: (ev: any) => audits.push(ev),
      showToast: (msg: string, type?: string) => toasts.push({ msg, type }),
      setCurrentTab: () => {},
    });

    const renamed = handlers.handleUpdateZone('Z-01', {
      id_zone: 'z-99',
      code_zone: 'z-99',
      libelle: 'Atelier Nord',
    });

    expect(renamed).toBe(true);
    expect(zonesBox.get()[0].id_zone).toBe('Z-99');
    expect(opsBox.get()[0].id_zone).toBe('Z-99, Z-02');
    expect(opsBox.get()[0].zones).toEqual(['Z-99', 'Z-02']);
    expect(techBox.get()[0].id_zone).toBe('Z-99');
    expect(machinesBox.get()[0].id_zone_default).toBe('Z-99');
    expect(warehouseBox.get()[0].id_zone).toBe('Z-99');
    expect(warehouseBox.get()[0].id_zone_default).toBe('Z-99');
    expect(mvBox.get()[0].id_zone).toBe('Z-99');
    expect(pmBox.get()[0].id_zone).toBe('Z-99');
    expect(pmExecBox.get()[0].id_zone).toBe('Z-99');
    expect(btBox.get()[0].id_zone).toBe('Z-99');
    expect(sdBox.get()[0].id_zone).toBe('Z-99');
    expect(bomBox.get()[0].id_zone).toBe('Z-99');
    expect(auth.getAccountForPersonnel('TECH-01')?.id_zone).toBe('Z-99');
    expect(audits.some((a) => a.actionType === 'ZONE_UPDATED' && a.entityId === 'Z-99')).toBe(true);
  });

  it('emits GENERAL_SYSTEM_TYPE_CREATED and GENERAL_SYSTEM_TYPE_TOGGLED audit events in assetNexusSlice', () => {
    const store = useGmaoStore.getState();
    const created = store.handleAddGeneralSystemType({
      code: 'AIR',
      name: 'Air Comprimé',
    });
    expect(created).toBeTruthy();
    expect(created?.id).toBe('SYS-AIR');

    store.handleToggleGeneralSystemType(created!.id, false);
    const updatedType = useGmaoStore
      .getState()
      .generalSystemTypes.find((t) => t.id === created!.id);
    expect(updatedType?.is_active).toBe(false);

    const events = useGmaoStore.getState().auditEvents || [];
    expect(
      events.some(
        (ev) => ev.actionType === 'GENERAL_SYSTEM_TYPE_CREATED' && ev.entityId === created!.id
      )
    ).toBe(true);
    expect(
      events.some(
        (ev) => ev.actionType === 'GENERAL_SYSTEM_TYPE_TOGGLED' && ev.entityId === created!.id
      )
    ).toBe(true);
  });
});
