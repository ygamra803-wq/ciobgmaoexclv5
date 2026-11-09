import { INITIAL_GUIDES } from './INITIAL_GUIDES';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';

export const STORAGE_KEY_GUIDES = STORAGE_KEYS.PREVENTIVE_GUIDES;

export class GuideService {
  static getGuides(): any[] {
    return loadCollection(STORAGE_KEY_GUIDES, {
      allowDemoFallback: true,
      demoSeed: INITIAL_GUIDES,
    });
  }

  static saveGuides(guides: any[]) {
    try {
      storageService.setItem(STORAGE_KEY_GUIDES, guides);
    } catch {
      // storage error
    }
  }

  static addGuide(guideData: any): any[] {
    const current = [...this.getGuides()];
    const seq = String(current.length + 1).padStart(3, '0');
    const compSlug = (guideData.composant_type || guideData.composant_nom || 'COMP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    
    const newGuide = {
      ...guideData,
      guide_id: guideData.guide_id || `GDE-${compSlug}-${seq}`,
      composant_type: guideData.composant_type || guideData.composant_nom || '',
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
    return current;
  }

  static updateGuide(guide_id: string | number, updatedFields: any): any[] {
    const current = [...this.getGuides()];
    const idx = current.findIndex((g: any) => (g.guide_id || g.id) === guide_id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updatedFields, updated_at: new Date().toISOString() };
      this.saveGuides(current);
    }
    return current;
  }

  static deleteGuide(guide_id: string | number): any[] {
    const current = this.getGuides();
    const filtered = current.filter((g: any) => (g.guide_id || g.id) !== guide_id);
    this.saveGuides(filtered);
    return filtered;
  }
}

export default GuideService;
