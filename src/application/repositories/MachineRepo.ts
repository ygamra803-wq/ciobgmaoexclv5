import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { sanitizeMachinesHierarchy, type HierarchyMachineLike } from '../../utils/assetHierarchy';
import { ValidationService } from '../../core/validation/ValidationService';
import type {
  IBlueprint,
  IBlueprintTheoreticalPdr,
  IGeneralSystemType,
  IMachine,
  IMachineFamily,
  IMachineTemplate,
  IZone,
} from '../../types/domain';
import type { MachineElement } from '../../types/store';

export type MachinePersistenceInput = HierarchyMachineLike & {
  asset_class?: string;
  id_general_system_type?: string | null;
  [key: string]: unknown;
};

export type BlueprintPersistenceInput = Omit<IBlueprint, 'pdr_theoriques'> & {
  pdr_theoriques?: ReadonlyArray<string | IBlueprintTheoreticalPdr>;
};

/**
 * Domain repository owning Tier 1/2/3 industrial assets, hierarchy, zones, blueprints, and BOM ledger.
 */
export const MachineRepo = {
  saveMachines<T extends MachinePersistenceInput = IMachine>(
    list: ReadonlyArray<T> = [],
    options: { validate?: boolean } = {}
  ): T[] {
    const { validate = false } = options;
    const normalized: T[] = Array.isArray(list)
      ? list.map((m) => {
          if (!m || typeof m !== 'object') return m;
          const assetClass =
            String(m.asset_class || '').trim().toUpperCase() === 'SYSTEM_GENERAL'
              ? 'SYSTEM_GENERAL'
              : 'PRODUCTION';
          return {
            ...m,
            asset_class: assetClass,
            id_general_system_type:
              assetClass === 'SYSTEM_GENERAL' ? m.id_general_system_type || null : null,
          };
        })
      : [];

    let clean = sanitizeMachinesHierarchy(normalized) as T[];
    if (validate) {
      clean = clean.filter((m) => {
        const res = ValidationService.validateMachine(m) as { isValid?: boolean; valid?: boolean };
        return res.isValid ?? res.valid ?? true;
      });
    }
    storageService.setItem(STORAGE_KEYS.MACHINES, clean);
    return clean;
  },

  saveGeneralSystemTypes<T = IGeneralSystemType>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.GENERAL_SYSTEM_TYPES, clean);
    return clean;
  },

  saveFamilies<T = IMachineFamily>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.FAMILIES, clean);
    return clean;
  },

  saveTemplates<T = IMachineTemplate>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.TEMPLATES, clean);
    return clean;
  },

  saveBlueprints(list: ReadonlyArray<BlueprintPersistenceInput> = []): IBlueprint[] {
    const clean: IBlueprint[] = Array.isArray(list)
      ? list.map((b) => ({
          ...b,
          pdr_theoriques: Array.isArray(b?.pdr_theoriques)
            ? b.pdr_theoriques.map(
                (p: string | IBlueprintTheoreticalPdr): IBlueprintTheoreticalPdr =>
                  typeof p === 'string' ? { id_pdr: p, ref: p } : p
              )
            : [],
          preventivePlanItems: Array.isArray(b?.preventivePlanItems) ? b.preventivePlanItems : [],
          commonFailures: Array.isArray(b?.commonFailures) ? b.commonFailures : [],
        }))
      : [];
    storageService.setItem(STORAGE_KEYS.BLUEPRINTS, clean);
    return clean;
  },

  saveZones<T = IZone>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.ZONES, clean);
    return clean;
  },

  saveMachineBom<T = MachineElement>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.MACHINE_BOM, clean);
    return clean;
  },
};
