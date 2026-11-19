import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import {
  dataIntegrityService,
  type IntegrityMachineRecord,
} from '../../services/dataIntegrityService';
import type {
  CorrectiveIntervenantEntry,
  CorrectiveInterventionItem,
} from '../../types/store';
import type { IWorkshopOrder } from '../../domain/corrective/workshopOrderService';
import type { INeedRequest } from '../../domain/corrective/needRequestService';

export interface CorrectiveInterventionRefLike {
  code_machine?: string;
  id_machine?: string;
  machine_id?: string;
  id_machine_registered?: string;
  _isOrphan?: boolean;
  [key: string]: unknown;
}

/**
 * Domain repository owning corrective interventions (DI/BT), panne catalogs,
 * internal workshop orders, and material need requests.
 */
export const CorrectiveRepo = {
  saveCorrectiveInterventions<T extends CorrectiveInterventionRefLike = CorrectiveInterventionItem>(
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
        clean.forEach((i) => {
          const ref = i.code_machine || i.id_machine || i.machine_id || i.id_machine_registered;
          if (dataIntegrityService.isOrphanMachineRef(ref, activeIds)) {
            orphanCount++;
          } else {
            kept.push({ ...i, _isOrphan: false });
          }
        });
        clean = kept;
      } else {
        clean = clean.map((i) => {
          const ref = i.code_machine || i.id_machine || i.machine_id || i.id_machine_registered;
          const isOrphan = dataIntegrityService.isOrphanMachineRef(ref, activeIds);
          if (isOrphan) orphanCount++;
          return { ...i, _isOrphan: isOrphan };
        });
      }
    }

    storageService.setItem(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, clean);
    return { saved: clean, orphanCount };
  },

  saveCorrectiveActionsByPanne<T extends Record<string, unknown> = Record<string, string[]>>(
    dict: T = {} as T
  ): T {
    const clean = (dict && typeof dict === 'object' ? dict : {}) as T;
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE, clean);
    return clean;
  },

  saveCorrectivePanneCategories<T extends Record<string, unknown> = Record<string, string[]>>(
    dict: T = {} as T
  ): T {
    const clean = (dict && typeof dict === 'object' ? dict : {}) as T;
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES, clean);
    return clean;
  },

  saveCorrectiveTravaux<T = string>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_TRAVAUX, clean);
    return clean;
  },

  saveCorrectiveIntervenants<T = CorrectiveIntervenantEntry>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.CORRECTIVE_INTERVENANTS, clean);
    return clean;
  },

  saveWorkshopOrders<T = IWorkshopOrder>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.WORKSHOP_ORDERS, clean);
    return clean;
  },

  saveNeedRequests<T = INeedRequest>(list: ReadonlyArray<T> = []): T[] {
    const clean = Array.isArray(list) ? [...list] : [];
    storageService.setItem(STORAGE_KEYS.NEED_REQUESTS, clean);
    return clean;
  },
};
