/**
 * Canonical nature & item classifiers for Entrepôt (Components vs Parts).
 * Resolves historical French/English naming discrepancies:
 * - COMPONENT / COMPOSANT -> Organe / Sous-ensemble (Moteur, Réducteur, Pompe...)
 * - PART / PARTIE -> Pièce de structure / Spéciale
 */
export type EntrepotItemNature = 'COMPONENT' | 'PART';

export function isComponentNature(rawNature?: string | null): boolean {
  const norm = String(rawNature || '').trim().toUpperCase();
  return norm === 'COMPONENT' || norm === 'COMPOSANT';
}

export function isPartNature(rawNature?: string | null): boolean {
  const norm = String(rawNature || '').trim().toUpperCase();
  return norm === 'PART' || norm === 'PARTIE' || norm === 'ORGANE';
}

export function isWarehouseComponent(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  const explicitNature = String(item.nature || item.category || '').trim().toUpperCase();
  if (isComponentNature(explicitNature)) return true;
  if (isPartNature(explicitNature)) return false;

  const explicitType = String(item.type || '').trim().toUpperCase();
  if (isComponentNature(explicitType)) return true;
  if (isPartNature(explicitType)) return false;

  // Structural fallback for legacy records without explicit nature
  const hasPartMarkers = Boolean(
    item.part_type ||
      item.id_part ||
      item.id_part_designation ||
      item.id_designation ||
      (item.id_type && !item.id_family && !item.id_templates && !item.id_template)
  );
  return !hasPartMarkers;
}

export function isWarehousePart(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  return !isWarehouseComponent(item);
}

export class EntrepotItem {
  id: string;
  designation: string;
  qte: number;
  category: string;
  nature: 'COMPONENT' | 'PART';

  constructor(data: Record<string, any> = {}) {
    this.id = data.id_warehouse_item || data.id || data.id_part || '';
    this.designation = data.designation || '';
    this.qte = Number(data.qte ?? data.quantite ?? data.stockInitial) || 0;
    const isComp = isWarehouseComponent(data);
    this.nature = isComp ? 'COMPONENT' : 'PART';
    this.category = data.category || (isComp ? 'COMPONENT' : 'PART');
  }

  getStockActuel() {
    return this.qte;
  }

  isUsedInMachines(machines: any[] = []) {
    return machines.some((m) =>
      (m.components_reels || []).some((c: any) => c.id_component === this.id)
    );
  }
}