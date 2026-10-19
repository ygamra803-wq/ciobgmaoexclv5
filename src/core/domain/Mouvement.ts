/**
 * @file Mouvement.js
 * @module core/domain/Mouvement
 * @description
 * نموذج الكيان لدفتر حركات المخزون وصرف قطع الغيار (Excel Twin Model: Mouvements).
 * 
 * التطابق التام مع ورقة العمل Mouvements في إكسيل:
 * - العمود A: `code_bon` / `id` (رقم وصل الطلب أو الصرف، مثل: Bon-001)
 * - العمود B: `date` (تاريخ الحركة YYYY-MM-DD)
 * - العمود C: `ref` (مرجع المقال الموحد)
 * - العمود D: `quantite` / `qte` (الكمية المطلوبة/المصروفة)
 * - العمود E: `type` ('Entrée' | 'Sortie')
 * - العمود F: `action_id` ('CORRECTIVE', 'PREVENTIVE', 'AMELIORATIVE', 'USAGE', 'REAPPRO', 'RETOUR', 'INVENTAIRE')
 * - العمود G: `technicien` (الفني المسؤول أو المستلم)
 * - العمود H: `id_machine_registered` (الآلة المعنية بالتدخل)
 */
export class Mouvement {
  /**
   * بناء كائن حركة مخزون وتوثيق كافة الحقول المرتبطة بالعملية
   * 
   * @param {Object} data - البيانات الخام للحركة
   * @param {string} [data.id] - المعرف الفريد للحركة
   * @param {string} [data.code_bon] - رمز الوصل
   * @param {'Entrée' | 'Sortie' | string} [data.type] - نوع الحركة
   * @param {string} [data.action_id] - نوع الفلتر والتدخل
   * @param {string} [data.id_machine_registered] - رمز الآلة المعنية
   * @param {string} [data.ref] - مرجع القطعة المصروفة أو المدخلة
   * @param {number|string} [data.quantite] - الكمية
   * @param {string} [data.date] - التاريخ
   * @param {string} [data.technicien] - اسم أو رمز الفني
   */
  constructor(data = {}) {
    this.id = data.id || data.code_bon;
    this.code_bon = data.code_bon || this.id;
    this.type = data.type || '';
    this.action_id = data.action_id || '';
    this.id_machine_registered = data.id_machine_registered || null;
    this.ref = data.ref || data.id_article || '';
    this.qte = Number(data.quantite || data.qte) || 0;
    this.date = data.date || new Date().toISOString().split('T')[0];
    this.technicien = data.technicien || '';
    this.usage_type = data.usage_type || null;
    this.id_zone = data.id_zone || null;
    this.commentaire = data.commentaire || '';
  }

  /**
   * فحص ما إذا كانت الحركة عملية إخراج/صرف
   * 
   * @returns {boolean} true إذا كانت الحركة إخراجاً (Sortie)
   */
  isSortie() { 
    return String(this.type).toLowerCase().includes('sortie'); 
  }

  /**
   * فحص ما إذا كانت الحركة عملية إدخال/تزويد
   * 
   * @returns {boolean} true إذا كانت الحركة إدخالاً (Entrée)
   */
  isEntree() { 
    return String(this.type).toLowerCase().includes('entrée') || String(this.type).toLowerCase().includes('entree'); 
  }
}