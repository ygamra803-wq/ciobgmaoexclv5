import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import {
  dataIntegrityService,
  type IntegrityMachineRecord,
} from '../../services/dataIntegrityService';
import type {
  IPreventiveActionCatalogItem,
  IPreventiveGuideCatalogItem,
  IPreventivePlanCatalogItem,
  PreventiveTaskItem,
} from '../../types/store';
import type { PreventiveExecutionRecord } from '../../types/preventive';
import type { IMeterReading } from '../../types/meter';

export interface PreventiveTaskRefLike {
  id_machine?: string;
  machine_id?: string;
  code_machine?: string;
  _isOrphan?: boolean;
  [key: string]: unknown;
}

/**
 * Domain repository owning preventive maintenance tasks, catalogs, executions, and meter readings.
 */
export const PreventiveRepo = {
  savePreventiveTasks<T extends PreventiveTaskRefLike = PreventiveTaskItem>(
    list: ReadonlyArray<T> = [],
    options: { machines?: ReadonlyArray<IntegrityMachineRecord> | null; strict?: boolean } = {}
  ): { saved: T[]; orphanCount: number } {
    const { machines = null, strict = false } = options;
    let clean: T[] = Array.isArray(list) ? [...list] : [];
    let orphanCount = 0;

    if (Array.isArray(machines) && (machines.length > 0 || strict)) {
      const activeIds = dataIntegrityService.buildActiveMachineIdSet([...machines]);
      if (strict) {
        const kept: T[] = [];
        clean.forEach((t) => {
          const ref = t.id_machine || t.machine_id || t.code_machine;
          if (dataIntegrityService.isOrphanMachineRef(ref, activeIds)) {
            orphanCount++;
          } else {
            kept.push({ ...t, _isOrphan: false });
          }
        });
        clean = kept;
      } else {
        clean = clean.map((t) => {
          const ref = t.id_machine || t.machine_id || t.code_machine;
          const isOrphan = dataIntegrityService.isOrphanMachineRef(ref, activeIds);
          if (isOrphan) orphanCount++;
          return { ...t, _isOrphan: isOrphan };
        });
      }
    }

    storageService.setItem(STORAGE_KEYS.PREVENTIVE_TASKS, clean);
    return { saved: clean, orphanCount };
  },

  savePreventiveActions<T = IPreventiveActionCatalogItem>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_ACTIONS, clean);
    return clean;
  },

  savePreventiveGuides<T = IPreventiveGuideCatalogItem>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_GUIDES, clean);
    return clean;
  },

  savePreventivePlans<T = IPreventivePlanCatalogItem>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_PLANS, clean);
    return clean;
  },

  savePreventiveExecutions<T = PreventiveExecutionRecord>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.PREVENTIVE_EXECUTIONS, clean);
    return clean;
  },

  saveMeterReadings<T = IMeterReading>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.METER_READINGS, clean);
    return clean;
  },
};
