import { INITIAL_ACTIONS } from './INITIAL_ACTIONS';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';

export const STORAGE_KEY_ACTIONS = STORAGE_KEYS.PREVENTIVE_ACTIONS;

export class ActionService {
  static getActions() {
    return loadCollection(STORAGE_KEY_ACTIONS, {
      allowDemoFallback: true,
      demoSeed: INITIAL_ACTIONS,
    });
  }

  static saveActions(actions) {
    try {
      storageService.setItem(STORAGE_KEY_ACTIONS, actions);
    } catch {
      // storage error handling
    }
  }

  static addAction(actionData) {
    const current = [...this.getActions()];
    const code = (actionData.code || 'X').trim().toUpperCase();
    const libelle = (actionData.libelle || 'Action').trim();
    const shortLib = libelle.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
    const seq = String(current.length + 1).padStart(3, '0');
    
    const newAction = {
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
      created_at: new Date().toISOString()
    };

    current.push(newAction);
    this.saveActions(current);
    return newAction;
  }

  static updateAction(action_id, updatedFields) {
    const current = [...this.getActions()];
    const idx = current.findIndex(a => a.action_id === action_id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updatedFields, updated_at: new Date().toISOString() };
      this.saveActions(current);
      return current[idx];
    }
    return null;
  }

  static deleteAction(action_id) {
    const current = this.getActions();
    const filtered = current.filter(a => a.action_id !== action_id);
    this.saveActions(filtered);
    return true;
  }
}

export default ActionService;
