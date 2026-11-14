import { INITIAL_GUIDES } from './INITIAL_GUIDES';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';
import { loadCollection } from '../../../infrastructure/persistence/migrateStorage';
import type { IPreventiveGuideCatalogItem } from '../../../types/store';

export const STORAGE_KEY_GUIDES = STORAGE_KEYS.PREVENTIVE_GUIDES;

/**
 * Persistence service managing component preventive inspection guides,
 * checklists, required tooling, and recommended spare-part catalogs.
 */
export class GuideService {
  static getGuides(): IPreventiveGuideCatalogItem[] {
    return loadCollection<IPreventiveGuideCatalogItem[]>(STORAGE_KEY_GUIDES, {
      allowDemoFallback: true,
      demoSeed: INITIAL_GUIDES as unknown as IPreventiveGuideCatalogItem[],
    });
  }

  static saveGuides(guides: IPreventiveGuideCatalogItem[]): void {
    try {
      storageService.setItem(STORAGE_KEY_GUIDES, guides);
    } catch {
      // storage error
    }
  }

  static addGuide(guideData: Partial<IPreventiveGuideCatalogItem>): IPreventiveGuideCatalogItem[] {
    const current = [...this.getGuides()];
    const seq = String(current.length + 1).padStart(3, '0');
    const rawComp = String(guideData.composant_type || guideData.composant_nom || 'COMP');
    const compSlug = rawComp.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const guideId = String(guideData.guide_id || `GDE-${compSlug}-${seq}`);

    const newGuide: IPreventiveGuideCatalogItem = {
      ...guideData,
      id: guideData.id ?? guideId,
      code: String(guideData.code || guideId),
      guide_id: guideId,
      composant_nom: String(guideData.composant_nom || guideData.composant_type || ''),
      composant_type: String(guideData.composant_type || guideData.composant_nom || ''),
      actions_recommandees: guideData.actions_recommandees || [],
      periodicite_suggeree: guideData.periodicite_suggeree || '1M',
      points_de_controle: guideData.points_de_controle || [],
      outillage_requis: guideData.outillage_requis || [],
      consignes_securite: guideData.consignes_securite || '',
      active: true,
      created_at: new Date().toISOString(),
    };

    current.push(newGuide);
    this.saveGuides(current);
    return current;
  }

  static updateGuide(
    guide_id: string | number,
    updatedFields: Partial<IPreventiveGuideCatalogItem>
  ): IPreventiveGuideCatalogItem[] {
    const current = [...this.getGuides()];
    const idx = current.findIndex((g) => (g.guide_id || g.id) === guide_id);
    if (idx !== -1) {
      current[idx] = { ...current[idx], ...updatedFields, updated_at: new Date().toISOString() };
      this.saveGuides(current);
    }
    return current;
  }

  static deleteGuide(guide_id: string | number): IPreventiveGuideCatalogItem[] {
    const current = this.getGuides();
    const filtered = current.filter((g) => (g.guide_id || g.id) !== guide_id);
    this.saveGuides(filtered);
    return filtered;
  }
}

export default GuideService;
