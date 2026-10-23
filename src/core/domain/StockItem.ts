/**
 * @file StockItem.js
 * @module core/domain/StockItem
 * @description
 * نموذج الكيان المالي والمحاسبي لمقال/قطعة غيار في المخزون (Excel Twin Model: Stock_Actuel).
 * 
 * التطابق التام مع معادلات Excel المرجعية في GMAO_Light_Template_V2_Formules.xlsx:
 * - العمود E (Stock Initial): `stockInitial`
 * - العمود F (Entrées): `=SUMIFS(Mouvements!Quantité, Mouvements!Ref, [@Ref], Mouvements!Type, "Entrée")`
 * - العمود G (Sorties): `=SUMIFS(Mouvements!Quantité, Mouvements!Ref, [@Ref], Mouvements!Type, "Sortie")`
 * - العمود H (Stock Actuel): `= [@stockInitial] + [@entrees] - [@sorties]`
 * - العمود I (Seuil d'Alerte): `seuil`
 * - العمود J (Alerte / Criticité): `=IF([@stockActuel]<=0, "RUPTURE", IF([@stockActuel]<=[@seuil], "ALERTE", "OK"))`
 */
import { isComponentNature, isPartNature } from './EntrepotItem';

export interface ConsumablePdrInventoryItem {
  id_article: string;
  ref: string;
  reference: string;
  designation: string;
  stockActuel: number;
  unite: string;
  prix_unitaire: number;
  source: string;
  emplacement: string;
}

/**
 * P0 Canonical Invariant (ADR-09):
 * Consumable spare parts (PDR) deducted during maintenance come exclusively from
 * `stockItems` (`rawStock` governed by `IncrementalStockIndex`), never from
 * `warehouseItems` (`COMPONENT` / `COMPOSANT` / `PART` / `PARTIE`).
 * Items without an explicit `nature` in `seedStockItems.json` or live `rawStock`
 * are safely treated as consumable PDRs unless marked with warehouse component/part markers.
 */
export function buildConsumablePdrInventory(stockItems: any[] = []): ConsumablePdrInventoryItem[] {
  const list: ConsumablePdrInventoryItem[] = [];
  const seen = new Set<string>();

  (stockItems || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const explicitNature = String(item.nature || item.category || '').trim().toUpperCase();
    if (
      isComponentNature(explicitNature) ||
      isPartNature(explicitNature) ||
      Boolean(item.id_warehouse_item)
    ) {
      return;
    }

    const ref = String(item.ref || item.reference || item.code || '').trim();
    if (ref && !seen.has(ref.toLowerCase())) {
      list.push({
        id_article: `PDR-${ref}`,
        ref,
        reference: ref,
        designation: item.designation || item.nom || 'Pièce PDR',
        stockActuel: Number(item.stockActuel ?? item.stock_actuel ?? item.stockInitial ?? 0),
        unite: item.unit || item.unite || 'pcs',
        prix_unitaire: Number(item.prix || item.prix_unitaire || item.prix_achat_ht || 0),
        source: 'PDR Magasin',
        emplacement: item.emplacement || 'PDR',
      });
      seen.add(ref.toLowerCase());
    }
  });

  return list;
}

export class StockItem {
  /**
   * بناء كائن المقال وتجهيز مقادير المخزون الافتتاحي والتراكمي
   * 
   * @param {Object} data - كائن البيانات الخام للمقال
   * @param {string|number} [data.id_article] - المعرف الفريد للمقال
   * @param {string} [data.ref] - مرجع القطعة الموحد (رمز المقال، مثل: ROUL-6204-2RS)
   * @param {number|string} [data.stockInitial] - كمية المخزون الافتتاحي (الافتراضي: 0)
   * @param {number|string} [data.entrees] - مجموع كميات الإدخال المكتسبة من الحركات
   * @param {number|string} [data.sorties] - مجموع كميات الإخراج المصروفة للحركات
   * @param {number|string} [data.seuil] - الحد الأدنى لتنبيه المخزون (Seuil d'alerte)
   */
  constructor(data: Record<string, any> = {}) {
    this.id = data.id_article || data.id || data.ref;
    this.ref = data.ref || String(this.id || '');
    this.designation = data.designation || '';
    this.initial = Number(data.stockInitial) || 0;
    this.entrees = Number(data.entrees) || 0;
    this.sorties = Number(data.sorties) || 0;
    this.seuil = Number(data.seuil) || 0;
    this.emplacement = data.emplacement || '';
  }

  id: any;
  ref: string;
  designation: string;
  initial: number;
  entrees: number;
  sorties: number;
  seuil: number;
  emplacement: string;

  /**
   * حساب الرصيد الفعلي الحالي في الوقت الحقيقي (Excel Twin Equation)
   * 公式: Stock Actuel = Initial + Entrées - Sorties
   * 
   * @returns {number} الرصيد الصافي الفعلي المخزن
   */
  getActuel() { 
    return this.initial + this.entrees - this.sorties; 
  }

  /**
   * استرجاع حد الأمان/التنبيه الأدنى للمقال
   * 
   * @returns {number} حد التنبيه
   */
  getSeuilAlerte() {
    return this.seuil;
  }

  /**
   * استخراج نص المعادلة الحسابية للتدقيق والمطابقة مع إكسيل
   * 
   * @returns {string} صيغة المعادلة المحسوبة (مثال: "10 + 5 - 2 = 13")
   */
  getFormule() {
    return `${this.initial} + ${this.entrees} - ${this.sorties} = ${this.getActuel()}`;
  }

  /**
   * فحص ما إذا كان الرصيد الحالي يلامس أو يقل عن حد الأمان
   * 
   * @returns {boolean} true إذا كان المخزون في حالة حرجة/تنبيه
   */
  isBelowSeuil() { 
    return this.getActuel() <= this.seuil; 
  }

  /**
   * حساب مستوى الخطورة/الحالة التشغيلية للمقال (Criticité / Status)
   * - RUPTURE: الرصيد الفعلي صفر أو أقل (نفاد تام للمخزون)
   * - ALERTE: الرصيد الفعلي يقل عن أو يساوي حد التنبيه
   * - OK: المخزون آمن وفي النطاق المطلوب
   * 
   * @returns {'RUPTURE' | 'ALERTE' | 'OK'} رمزي الحالة المحسوبة
   */
  getCriticite() { 
    if (this.getActuel() <= 0) return 'RUPTURE'; 
    if (this.isBelowSeuil()) return 'ALERTE'; 
    return 'OK'; 
  }

  /**
   * فحص استخدام المقال ضمن مخطط التغيير النمطي (Blueprint / PDR النظرية)
   * 
   * @param {Object} blueprint - كائن المخطط النمطي للآلة
   * @returns {boolean} true إذا كان المقال مسجلاً كقطعة نظرية للآلة
   */
  isUsedInBlueprint(blueprint: any) {
    if (!blueprint || !blueprint.pdr_theoriques) return false;
    return blueprint.pdr_theoriques.some((p: any) => p.id_pdr === this.id || p.ref === this.ref); 
  }
}