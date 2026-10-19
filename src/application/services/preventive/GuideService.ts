import { INITIAL_GUIDES } from './INITIAL_GUIDES';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';

export const STORAGE_KEY_GUIDES = STORAGE_KEYS.PREVENTIVE_GUIDES;

export class GuideService {
  static getGuides() {
    return loadCollection(STORAGE_KEY_GUIDES, {
      allowDemoFallback: true,
      demoSeed: INITIAL_GUIDES,
    });
  }

  static saveGuides(guides) {
    try {
      storageService.setItem(STORAGE_KEY_GUIDES, guides);
    } catch {
      // storage error
    }
  }

  static addGuide(guideData) {
    const current = [...this.getGuides()];
    const seq = String(current.length + 1).padStart(3, '0');
    const compSlug = (guideData.composant_type || 'COMP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    
    const newGuide = {
      guide_id: `GDE-${compSlug}-${seq}`,
      composant_type: guideData.composant_type || '',
      actions_recommandees: guideData.actions_recommandees || [],
      periodicite_suggeree: guideData.periodicite_suggeree || '1M',
      points_de_controle: guideData.points_de_controle || [],
      outillage_requis: guideData.outillage_requis || [],
      consignes_securite: guideData.consignes_securite || '',
      active: true,
      created_at: new Date().toISOString()
    };

    current.push(newGuide);
    this.saveGuides(current);
    return newGuide;
  }

  static updateGuide(guide_id, updatedFields) {
    const current = [...this.getGuides()];
    const idx = current.findIndex(g => g.guide_id === guide_id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updatedFields, updated_at: new Date().toISOString() };
      this.saveGuides(current);
      return current[idx];
    }
    return null;
  }

  static deleteGuide(guide_id) {
    const current = this.getGuides();
    const filtered = current.filter(g => g.guide_id !== guide_id);
    this.saveGuides(filtered);
    return true;
  }
}

export default GuideService;
