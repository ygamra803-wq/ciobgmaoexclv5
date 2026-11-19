import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import type {
  ICompFamily,
  ICompGroup,
  ICompTemplate,
  IEntrepotComponent,
  IPartDesignation,
  IPartGroup,
  IPartType,
  IWarehouseItem,
} from '../../types/domain';

/**
 * Domain repository owning Entrepôt components, parts, classifications, and physical warehouse items.
 */
export const WarehouseRepo = {
  saveWarehouseItems<T = IWarehouseItem>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.WAREHOUSE_ITEMS, clean);
    return clean;
  },

  saveEntrepotComponents<T = IEntrepotComponent>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.ENTREPOT_COMPONENTS, clean);
    return clean;
  },

  saveCompGroups<T = ICompGroup>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.COMP_GROUPS, clean);
    return clean;
  },

  saveCompFamilies<T = ICompFamily>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.COMP_FAMILIES, clean);
    return clean;
  },

  saveCompTemplates<T = ICompTemplate>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.COMP_TEMPLATES, clean);
    return clean;
  },

  savePartGroups<T = IPartGroup>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PART_GROUPS, clean);
    return clean;
  },

  loadPartGroups(): IPartGroup[] {
    const data = storageService.getItem(STORAGE_KEYS.PART_GROUPS);
    return Array.isArray(data) ? (data as IPartGroup[]) : [];
  },

  savePartTypes<T = IPartType>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PART_TYPES, clean);
    return clean;
  },

  savePartDesignations<T = IPartDesignation>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PART_DESIGNATIONS, clean);
    return clean;
  },
};
