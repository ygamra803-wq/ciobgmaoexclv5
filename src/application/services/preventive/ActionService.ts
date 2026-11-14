import { INITIAL_ACTIONS } from './INITIAL_ACTIONS';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';
import type { IPreventiveActionCatalogItem } from '../../../types/store';

export const STORAGE_KEY_ACTIONS = STORAGE_KEYS.PREVENTIVE_ACTIONS;

export interface ActionCatalogStorageAdapter {
  getActions: () => IPreventiveActionCatalogItem[];
  saveActions: (actions: IPreventiveActionCatalogItem[]) => void;
}

/**
 * Persistence service managing standardized Preventive Action catalog entries
 * (code, label, maintenance type, default frequency, and duration).
 */
export class ActionService {
  static getActions(): IPreventiveActionCatalogItem[] {
    return loadCollection<IPreventiveActionCatalogItem[]>(STORAGE_KEY_ACTIONS, {
      allowDemoFallback: true,
      demoSeed: INITIAL_ACTIONS as unknown as IPreventiveActionCatalogItem[],
    });
  }

  static saveActions(actions: IPreventiveActionCatalogItem[]): void {
    try {
      storageService.setItem(STORAGE_KEY_ACTIONS, actions);
    } catch {
      // storage error handling
    }
  }

  static addAction(
    actionData: Partial<IPreventiveActionCatalogItem>,
    adapter: ActionCatalogStorageAdapter = ActionService
  ): IPreventiveActionCatalogItem[] {
    const current = [...adapter.getActions()];
    const code = String(actionData.code || 'X').trim().toUpperCase();
    const libelle = String(actionData.libelle || 'Action').trim();
    const shortLib = libelle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
    const seq = String(current.length + 1).padStart(3, '0');

    const newAction: IPreventiveActionCatalogItem = {
      id: actionData.id ?? `ACT-${code}-${shortLib}-${seq}`,
      action_id: `ACT-${code}-${shortLib}-${seq}`,
      code,
      libelle,
      description: actionData.description || '',
      type_maintenance: actionData.type_maintenance || 'Préventif',
      frequence_defaut: actionData.frequence_defaut || '1M',
      color: actionData.color || '#3b82f6',
      symbole: actionData.symbole || code,
      duree_estimee_min: Number(actionData.duree_estimee_min) || 30,
      active: true,
      created_at: new Date().toISOString(),
    };

    current.push(newAction);
    adapter.saveActions(current);
    return current;
  }

  static updateAction(
    action_id: string | number,
    updatedFields: Partial<IPreventiveActionCatalogItem>,
    adapter: ActionCatalogStorageAdapter = ActionService
  ): IPreventiveActionCatalogItem[] {
    const current = [...adapter.getActions()];
    const idx = current.findIndex((a) => (a.action_id || a.id) === action_id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updatedFields, updated_at: new Date().toISOString() };
      adapter.saveActions(current);
    }
    return current;
  }

  static deleteAction(
    action_id: string | number,
    adapter: ActionCatalogStorageAdapter = ActionService
  ): IPreventiveActionCatalogItem[] {
    const current = adapter.getActions();
    const filtered = current.filter((a) => (a.action_id || a.id) !== action_id);
    adapter.saveActions(filtered);
    return filtered;
  }
}

export default ActionService;
