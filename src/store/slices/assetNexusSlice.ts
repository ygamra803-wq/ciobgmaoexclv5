import { DataGateway } from '../../application/DataGateway';
import { isSystemGeneralMachine } from '../../utils/activeMachines';
import { safeId } from '../../utils/safeId';
import type { GmaoStoreState, MachineElement, StateUpdater } from '../../types/store';
import type {
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IBlueprint,
  IGeneralSystemType,
  IZone,
  IWarehouseItem,
  IEntrepotComponent,
  ICompGroup,
  ICompFamily,
  ICompTemplate,
  IPartGroup,
  IPartType,
  IPartDesignation,
  IUserRecord,
  ITechnician,
  IOperation,
} from '../../types/domain';
import {
  resolveUpdate,
  trackRemovedEntityIds,
  isMachineArchivedState,
  normalizeMachinesList,
  getInitialMachines,
  getInitialWarehouse,
  getInitialPersonnel,
} from './storeBootstrapSlice';

type StoreSet = (
  partial: Partial<GmaoStoreState> | ((state: GmaoStoreState) => Partial<GmaoStoreState>)
) => void;
type StoreGet = () => GmaoStoreState;

export type AssetNexusSliceKeys = Pick<
  GmaoStoreState,
  | 'families'
  | 'templates'
  | 'blueprints'
  | 'machines'
  | 'generalSystemTypes'
  | 'zones'
  | 'machineElementsLedger'
  | 'setFamilies'
  | 'setTemplates'
  | 'setBlueprints'
  | 'setMachines'
  | 'setGeneralSystemTypes'
  | 'handleAddGeneralSystemType'
  | 'handleToggleGeneralSystemType'
  | 'setZones'
  | 'setMachineElementsLedger'
  | 'addMachineElement'
  | 'updateMachineElement'
  | 'deleteMachineElement'
  | 'duplicateBOMToTwins'
  | 'isValidMachineFamilies'
  | 'isValidMachineTemplates'
  | 'warehouseItems'
  | 'entrepotComponents'
  | 'compGroups'
  | 'compFamilies'
  | 'compTemplates'
  | 'partGroups'
  | 'partTypes'
  | 'partDesignations'
  | 'setWarehouseItems'
  | 'setEntrepotComponents'
  | 'setCompGroups'
  | 'setCompFamilies'
  | 'setCompTemplates'
  | 'setPartGroups'
  | 'setPartTypes'
  | 'setPartDesignations'
  | 'users'
  | 'technicians'
  | 'operations'
  | 'setUsers'
  | 'setTechnicians'
  | 'setOperations'
>;

export function createAssetNexusSlice(set: StoreSet, get: StoreGet): AssetNexusSliceKeys {
  const initialMachines = getInitialMachines();
  const initialWarehouse = getInitialWarehouse();
  const initialPersonnel = getInitialPersonnel();

  return {
    families: initialMachines.families as IMachineFamily[],
    templates: initialMachines.templates as IMachineTemplate[],
    blueprints: initialMachines.blueprints as IBlueprint[],
    machines: initialMachines.machines as IMachine[],
    generalSystemTypes: initialMachines.generalSystemTypes as IGeneralSystemType[],
    zones: initialMachines.zones as IZone[],
    machineElementsLedger: initialMachines.machineElementsLedger as MachineElement[],

    setFamilies: (updater: StateUpdater<IMachineFamily[]>) => {
      const prev = get().families || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('families', prev, next);
      DataGateway.saveFamilies(next);
      set({ families: next });
    },

    setTemplates: (updater: StateUpdater<IMachineTemplate[]>) => {
      const prev = get().templates || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('templates', prev, next);
      DataGateway.saveTemplates(next);
      set({ templates: next });
    },

    setBlueprints: (updater: StateUpdater<IBlueprint[]>) => {
      const prev = get().blueprints || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('blueprints', prev, next);
      DataGateway.saveBlueprints(next);
      set({ blueprints: next });
    },

    setMachines: (updater: StateUpdater<IMachine[]>) => {
      const prev = get().machines || [];
      const rawNext = resolveUpdate(updater, prev);
      const next = normalizeMachinesList(rawNext) as IMachine[];
      trackRemovedEntityIds('machines', prev, next);

      // Institutional append-only audit for archive/restore lifecycle transitions
      if (prev.length > 0 && typeof get().appendAuditEvent === 'function') {
        const prevById = new Map<string, IMachine>();
        for (const m of prev) {
          const id = String(m?.id_machine_registered || m?.id || m?.code || '').trim();
          if (id) prevById.set(id.toUpperCase(), m);
        }
        for (const m of next) {
          const id = String(m?.id_machine_registered || m?.id || m?.code || '').trim();
          if (!id) continue;
          const oldMachine = prevById.get(id.toUpperCase());
          if (!oldMachine) continue;

          const wasArchived = isMachineArchivedState(oldMachine);
          const isArchived = isMachineArchivedState(m);
          if (wasArchived !== isArchived) {
            get().appendAuditEvent({
              actionType: isArchived ? 'MACHINE_ARCHIVED' : 'MACHINE_RESTORED',
              entityType: 'MACHINE',
              entityId: id,
              before: {
                is_active: oldMachine.is_active !== false && !wasArchived,
                status: oldMachine.status || oldMachine.statut || '',
              },
              after: {
                is_active: m.is_active !== false && !isArchived,
                status: m.status || m.statut || '',
              },
            });
          }
        }
      }

      DataGateway.saveMachines(next);
      set({ machines: next });
    },

    setGeneralSystemTypes: (updater: StateUpdater<IGeneralSystemType[]>) => {
      const prev = get().generalSystemTypes || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('generalSystemTypes', prev, next);
      DataGateway.saveGeneralSystemTypes(next);
      set({ generalSystemTypes: next });
    },

    handleAddGeneralSystemType: (payload: { name: string; code?: string; id?: string }) => {
      const cleanName = String(payload?.name || '').trim();
      if (!cleanName) return null;
      const cleanCode = String(
        payload?.code ||
          cleanName
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, 3)
            .toUpperCase() ||
          'SYS'
      )
        .trim()
        .toUpperCase();
      const id = String(payload?.id || `SYS-${cleanCode}`).trim();
      const existing = get().generalSystemTypes || [];
      const duplicate = existing.find(
        (t) =>
          String(t.id || '').toUpperCase() === id.toUpperCase() ||
          String(t.code || '').toUpperCase() === cleanCode
      );
      if (duplicate) return duplicate;

      const created: IGeneralSystemType = {
        id,
        code: cleanCode,
        name: cleanName,
        is_active: true,
      };
      get().setGeneralSystemTypes((prev) => [...(prev || []), created]);
      return created;
    },

    handleToggleGeneralSystemType: (id: string, isActive?: boolean) => {
      get().setGeneralSystemTypes((prev) =>
        (prev || []).map((t) => {
          if (String(t.id) !== String(id)) return t;
          const nextActive = typeof isActive === 'boolean' ? isActive : t.is_active === false;
          return { ...t, is_active: nextActive };
        })
      );
    },

    setZones: (updater: StateUpdater<IZone[]>) => {
      const prev = get().zones || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('zones', prev, next);
      DataGateway.saveZones(next);
      set({ zones: next });
    },

    setMachineElementsLedger: (updater: StateUpdater<MachineElement[]>) => {
      const prev = get().machineElementsLedger || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('machineElementsLedger', prev, next);
      DataGateway.saveMachineBom(next);
      set({ machineElementsLedger: next });
    },

    addMachineElement: (element: Partial<MachineElement>) => {
      if (!element || typeof element !== 'object') return;
      const targetMachKey = String(element.id_machine_registered || '').trim().toUpperCase();
      if (targetMachKey) {
        const matchedMachine = (get().machines || []).find(
          (m) =>
            String(m.id_machine_registered || m.id || m.code || '')
              .trim()
              .toUpperCase() === targetMachKey
        );
        if (matchedMachine && isSystemGeneralMachine(matchedMachine)) {
          return;
        }
      }

      const created: MachineElement = {
        ...element,
        id: String(element.id || safeId('BOM')).trim(),
      };
      get().setMachineElementsLedger((prev) => [created, ...(prev || [])]);
    },

    updateMachineElement: (id: string, updates: Partial<MachineElement>) => {
      get().setMachineElementsLedger((prev) =>
        (prev || []).map((el) => (String(el.id) === String(id) ? { ...el, ...updates } : el))
      );
    },

    deleteMachineElement: (id: string) => {
      get().setMachineElementsLedger((prev) =>
        (prev || []).filter((el) => String(el.id) !== String(id))
      );
    },

    duplicateBOMToTwins: (sourceMachineId: string, targetMachineIds: string[]) => {
      const srcKey = String(sourceMachineId || '').trim().toUpperCase();
      if (!srcKey || !Array.isArray(targetMachineIds) || targetMachineIds.length === 0) return;

      const ledger = get().machineElementsLedger || [];
      const sourceElements = ledger.filter(
        (el) => String(el.id_machine_registered || '').trim().toUpperCase() === srcKey
      );
      if (sourceElements.length === 0) return;

      const machines = get().machines || [];
      const existingKeys = new Set(
        ledger.map(
          (el) =>
            `${String(el.id_machine_registered || '').trim().toUpperCase()}::${String(
              el.ref_element || el.id_element || ''
            )
              .trim()
              .toUpperCase()}`
        )
      );

      const newEntries: MachineElement[] = [];
      for (const targetId of targetMachineIds) {
        const cleanTarget = String(targetId || '').trim();
        const targetKey = cleanTarget.toUpperCase();
        if (!targetKey || targetKey === srcKey) continue;

        const targetMachine = machines.find(
          (m) =>
            String(m.id_machine_registered || m.id || m.code || '')
              .trim()
              .toUpperCase() === targetKey
        );
        if (targetMachine && isSystemGeneralMachine(targetMachine)) continue;

        for (const srcEl of sourceElements) {
          const refKey = String(srcEl.ref_element || srcEl.id_element || '').trim().toUpperCase();
          const pairKey = `${targetKey}::${refKey}`;
          if (refKey && existingKeys.has(pairKey)) continue;
          if (refKey) existingKeys.add(pairKey);

          newEntries.push({
            ...srcEl,
            id: safeId('BOM'),
            id_machine_registered: cleanTarget,
          });
        }
      }

      if (newEntries.length > 0) {
        get().setMachineElementsLedger((prev) => [...newEntries, ...(prev || [])]);
      }
    },

    isValidMachineFamilies: (arr: IMachineFamily[]) =>
      Array.isArray(arr) &&
      arr.every((f) => Boolean(f && (f.id_family || f.id || f.nom_famille || f.libelle))),

    isValidMachineTemplates: (arr: IMachineTemplate[]) =>
      Array.isArray(arr) &&
      arr.every((t) => Boolean(t && (t.id_templates || t.id_template || t.id || t.nom_modele))),

    warehouseItems: initialWarehouse.warehouseItems as IWarehouseItem[],
    entrepotComponents: initialWarehouse.entrepotComponents as IEntrepotComponent[],
    compGroups: initialWarehouse.compGroups as ICompGroup[],
    compFamilies: initialWarehouse.compFamilies as ICompFamily[],
    compTemplates: initialWarehouse.compTemplates as ICompTemplate[],
    partGroups: initialWarehouse.partGroups as IPartGroup[],
    partTypes: initialWarehouse.partTypes as IPartType[],
    partDesignations: initialWarehouse.partDesignations as IPartDesignation[],

    setWarehouseItems: (updater: StateUpdater<IWarehouseItem[]>) => {
      const prev = get().warehouseItems || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('warehouseItems', prev, next);
      DataGateway.saveWarehouseItems(next);
      set({ warehouseItems: next });
    },

    setEntrepotComponents: (updater: StateUpdater<IEntrepotComponent[]>) => {
      const prev = get().entrepotComponents || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('entrepotComponents', prev, next);
      DataGateway.saveEntrepotComponents(next);
      set({ entrepotComponents: next });
    },

    setCompGroups: (updater: StateUpdater<ICompGroup[]>) => {
      const prev = get().compGroups || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('compGroups', prev, next);
      DataGateway.saveCompGroups(next);
      set({ compGroups: next });
    },

    setCompFamilies: (updater: StateUpdater<ICompFamily[]>) => {
      const prev = get().compFamilies || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('compFamilies', prev, next);
      DataGateway.saveCompFamilies(next);
      set({ compFamilies: next });
    },

    setCompTemplates: (updater: StateUpdater<ICompTemplate[]>) => {
      const prev = get().compTemplates || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('compTemplates', prev, next);
      DataGateway.saveCompTemplates(next);
      set({ compTemplates: next });
    },

    setPartGroups: (updater: StateUpdater<IPartGroup[]>) => {
      const prev = get().partGroups || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('partGroups', prev, next);
      DataGateway.savePartGroups(next);
      set({ partGroups: next });
    },

    setPartTypes: (updater: StateUpdater<IPartType[]>) => {
      const prev = get().partTypes || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('partTypes', prev, next);
      DataGateway.savePartTypes(next);
      set({ partTypes: next });
    },

    setPartDesignations: (updater: StateUpdater<IPartDesignation[]>) => {
      const prev = get().partDesignations || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('partDesignations', prev, next);
      DataGateway.savePartDesignations(next);
      set({ partDesignations: next });
    },

    users: initialPersonnel.users as IUserRecord[],
    technicians: initialPersonnel.technicians as ITechnician[],
    operations: initialPersonnel.operations as IOperation[],

    setUsers: (updater: StateUpdater<IUserRecord[]>) => {
      const prev = get().users || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('users', prev, next);
      DataGateway.savePersonnel(next, get().technicians, get().operations);
      set({ users: next });
    },

    setTechnicians: (updater: StateUpdater<ITechnician[]>) => {
      const prev = get().technicians || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('technicians', prev, next);
      DataGateway.saveTechnicians(next);
      set({ technicians: next });
    },

    setOperations: (updater: StateUpdater<IOperation[]>) => {
      const prev = get().operations || [];
      const next = resolveUpdate(updater, prev);
      trackRemovedEntityIds('operations', prev, next);
      DataGateway.saveOperations(next);
      set({ operations: next });
    },
  };
}
