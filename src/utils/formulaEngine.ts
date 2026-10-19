/**
 * Formula Engine & Data Utility for CIOB GMAO Light
 * Ensures safe numeric conversions, formula twin compatibility, and null/undefined handling.
 */
import { Logger } from '../core/logger/LoggerService';

/**
 * Safely converts any input value to a valid finite number.
 * @param {any} val - Value to convert
 * @param {number} defaultVal - Default fallback value if val is invalid
 * @returns {number}
 */
export function safeNum(val, defaultVal = NaN) {
  try {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'number') {
      return Number.isFinite(val) ? val : defaultVal;
    }
    if (typeof val === 'string') {
      // Normalize French formatted numbers: remove NBSP/spaces, replace comma with dot
      const cleanStr = val.replace(/[\s\u00A0\u202F\u2009]/g, '').replace(',', '.');
      const parsed = Number(cleanStr);
      return Number.isFinite(parsed) ? parsed : defaultVal;
    }
    const parsed = Number(val);
    return Number.isFinite(parsed) ? parsed : defaultVal;
  } catch (error) {
    Logger.warn('safeNum conversion error:', error, 'formulaEngine');
    return defaultVal;
  }
}

// Global lookup maps for O(1) search performance
let stockLookup = new Map();
let warehouseLookup = new Map();
let technicianLookup = new Map();
let zoneLookup = new Map();
let machineLookup = new Map();
let operationLookup = new Map();
let lastContextRef = null;

/**
 * Updates lookup maps for high performance O(1) validation lookups.
 * Caches by context reference to avoid redundant re-allocations in tight loops.
 */
export function updateLookups(context = {}, force = false) {
  try {
    if (!context || typeof context !== 'object') {
      return;
    }
    if (!force && lastContextRef === context) {
      return;
    }
    lastContextRef = context;

    const {
      stock = [],
      warehouseItems = [],
      technicians = [],
      zones = [],
      machines = [],
      operations = []
    } = context;

    stockLookup = new Map();
    if (Array.isArray(stock)) {
      stock.forEach((s) => {
        if (!s) return;
        const key = String(s.ref || s.Ref || '').toLowerCase().trim();
        if (key) stockLookup.set(key, s);
      });
    }

    warehouseLookup = new Map();
    if (Array.isArray(warehouseItems)) {
      warehouseItems.forEach((w) => {
        if (!w) return;
        const key = String(w.code || w.ref || w.item_code || '').toLowerCase().trim();
        if (key) warehouseLookup.set(key, w);
      });
    }

    technicianLookup = new Map();
    if (Array.isArray(technicians)) {
      technicians.forEach((t) => {
        if (!t) return;
        const key = String(t.nom || t.name || t.id_technician || '').toLowerCase().trim();
        if (key) technicianLookup.set(key, t);
      });
    }

    zoneLookup = new Map();
    if (Array.isArray(zones)) {
      zones.forEach((z) => {
        if (!z) return;
        const key = String(z.id_zone || z.ID_Zone || z.code_zone || z.code || '').toLowerCase().trim();
        if (key) zoneLookup.set(key, z);
      });
    }

    machineLookup = new Map();
    if (Array.isArray(machines)) {
      machines.forEach((m) => {
        if (!m) return;
        const key = String(m.id_machine_registered || m.id || '').toLowerCase().trim();
        if (key) machineLookup.set(key, m);
      });
    }

    operationLookup = new Map();
    if (Array.isArray(operations)) {
      operations.forEach((o) => {
        if (!o) return;
        const key = String(o.id_operation || o.id || o.nom || '').toLowerCase().trim();
        if (key) operationLookup.set(key, o);
      });
    }
  } catch (error) {
    Logger.error('updateLookups failure:', error, 'formulaEngine');
  }
}

/**
 * Calculates stock balance and alert status safely according to GMAO Excel Twin formulas.
 * Formula Stock Actuel = stockInitial + entrees - sorties
 * Formula Alert = RUPTURE if stockActuel <= 0, ALERTE if stockActuel <= seuil, else OK
 * (If isAchatUnique is true, no RUPTURE/ALERTE alarms are raised when stock is 0).
 *
 * @param {number} stockInitial
 * @param {number} entrees
 * @param {number} sorties
 * @param {number} seuil
 * @param {boolean} isAchatUnique - If true, treated as one-off non-stockable purchase
 * @returns {{ stockActuel: number, stockActuelRaw: number, alerte: 'OK' | 'ALERTE' | 'RUPTURE' | 'NON_STOCKABLE', isValid: boolean, error?: string }}
 */
export function calculateStockStatus(stockInitial, entrees, sorties, seuil, isAchatUnique = false) {
  try {
    const init = safeNum(stockInitial, 0);
    const ent = safeNum(entrees, 0);
    const sor = safeNum(sorties, 0);
    const s = Math.max(0, safeNum(seuil, 0));

    // Compute raw balance (allowing negative for logging/audit purposes)
    const stockActuel = init + ent - sor;

    // Display stock floor at 0 for safe inventory representation
    const displayStock = Math.max(0, stockActuel);

    let alerte = 'OK';
    if (isAchatUnique) {
      alerte = 'OK'; // One-time purchases default to OK
    } else if (displayStock <= 0) {
      alerte = 'RUPTURE';
    } else if (displayStock <= s) {
      alerte = 'ALERTE';
    }

    return {
      stockActuel: stockActuel,
      stockActuelRaw: stockActuel,
      alerte,
      isValid: true,
      calculatedAt: new Date().toISOString(),
    };
  } catch (error) {
    Logger.error('calculateStockStatus error:', error, 'formulaEngine');
    return {
      stockActuel: 0,
      stockActuelRaw: 0,
      alerte: 'RUPTURE',
      isValid: false,
      error: error.message || 'Error calculating stock status',
      calculatedAt: new Date().toISOString(),
    };
  }
}

/**
 * Validates a movement record before saving.
 * @param {object} mvt
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateMouvement(mvt) {
  try {
    const errors = [];
    if (!mvt || typeof mvt !== 'object') {
      return { valid: false, errors: ['Données de mouvement invalides'] };
    }

    if (!mvt.ref || String(mvt.ref).trim() === '') {
      errors.push("La référence de l'article est requise.");
    }

    const qty = safeNum(mvt.quantite || mvt.quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      errors.push('La quantité doit être un nombre valide et supérieur à 0.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    Logger.error('validateMouvement error:', error, 'formulaEngine');
    return {
      valid: false,
      errors: ['Erreur inattendue lors de la validation du mouvement'],
    };
  }
}

/**
 * Validates a movement record with full context (foreign keys, stock availability).
 * Uses lookup maps for O(1) search instead of O(n) find()
 */
export function validateMovementWithContext(mvt, context) {
  try {
    const errors = [];
    if (!mvt || typeof mvt !== 'object') {
      return { valid: false, errors: ['Mouvement non valide ou manquant.'] };
    }

    // Update lookup maps if context is provided
    if (context) {
      updateLookups(context);
    }

    const qty = safeNum(mvt.quantite || mvt.quantity);

    // 1. Basic validation
    if (!mvt.code_bon || String(mvt.code_bon).trim() === '') {
      errors.push('Le code du bon (Code Bon) est requis.');
    }

    if (!mvt.ref || String(mvt.ref).trim() === '') {
      errors.push("La référence de l'article (Ref) est requise.");
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      errors.push('La quantité doit être un nombre strictement positif.');
    }

    const validTypes = [
      'Entrée',
      'Sortie',
      'Sortie Interne',
      'Entrée Interne',
      'Sortie Externe',
      'Entrée Externe',
      'Bon de Sortie',
      'COMMANDE',
      'Demande',
    ];
    if (!mvt.type || !validTypes.some((vt) => String(mvt.type).toLowerCase().includes(vt.toLowerCase()))) {
      errors.push(
        'Le type de mouvement doit être "Sortie Interne", "Entrée Interne", "Sortie Externe", "Bon de Sortie", "Entrée Externe" ou "COMMANDE".'
      );
    }

    if (!mvt.date || isNaN(Date.parse(mvt.date))) {
      errors.push('La date spécifiée est invalide ou manquante.');
    }

    // 2. Foreign Key Validations using lookup maps (O(1) instead of O(n))
    if (context) {
      const refKey = String(mvt.ref || '').toLowerCase().trim();

      // Check if article exists in stock OR warehouse items
      const articleInStock = stockLookup.get(refKey);
      const itemInWarehouse = warehouseLookup.get(refKey);

      if (!articleInStock && !itemInWarehouse && !mvt.is_custom_ref) {
        errors.push(`La référence "${mvt.ref}" n'existe ni dans le stock PDR ni dans le registre de l'entrepôt.`);
      }

      // Check technician/person existence
      if (mvt.technicien && String(mvt.technicien).trim() !== '') {
        const techKey = String(mvt.technicien).toLowerCase().trim();
        const techExists = technicianLookup.has(techKey);
        const opExists = operationLookup.has(techKey);
        if (!techExists && !opExists && !mvt.allow_external_technician) {
          // Allow external/custom persons if set, or record error if strict
        }
      }

      // Check zone existence
      if (mvt.id_zone && String(mvt.id_zone).trim() !== '') {
        const zoneKey = String(mvt.id_zone).toLowerCase().trim();
        const zoneExists = zoneLookup.has(zoneKey);
        if (!zoneExists) {
          errors.push(`La zone "${mvt.id_zone}" n'est pas enregistrée.`);
        }
      }

      // Check machine existence
      if (mvt.id_machine_registered && String(mvt.id_machine_registered).trim() !== '') {
        const mchKey = String(mvt.id_machine_registered).toLowerCase().trim();
        const mchExists = machineLookup.has(mchKey);
        if (!mchExists) {
          errors.push(`La machine "${mvt.id_machine_registered}" n'est pas enregistrée.`);
        }
      }

      // Check stock availability for Sortie of PDR consumables
      if (String(mvt.type).toLowerCase().includes('sortie') && articleInStock && !mvt.skip_stock_limit) {
        const currentStock = safeNum(articleInStock.stockActuel || articleInStock.stockInitial);
        if (qty > currentStock) {
          errors.push(
            `Mouvement impossible : Stock insuffisant pour la référence "${mvt.ref}". Disponible : ${currentStock}, Demandé : ${qty}.`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  } catch (error) {
    Logger.error('validateMovementWithContext error:', error, 'formulaEngine');
    return {
      valid: false,
      errors: ['Erreur lors de la validation du mouvement dans le contexte'],
    };
  }
}

/**
 * Excel SUMIFS equivalent helper with error safety
 */
export function sumIfs(records = [], sumField, ...conditions) {
  try {
    if (!Array.isArray(records) || records.length === 0) return 0;
    return records.reduce((sum, item) => {
      if (!item) return sum;
      // Check condition pairs (field, expectedValue)
      for (let i = 0; i < conditions.length; i += 2) {
        const field = conditions[i];
        const val = conditions[i + 1];
        if (field && val !== undefined) {
          if (String(item[field] || '').toLowerCase() !== String(val).toLowerCase()) {
            return sum;
          }
        }
      }
      return sum + safeNum(item[sumField], 0);
    }, 0);
  } catch (error) {
    Logger.error('sumIfs formula error:', error, 'formulaEngine');
    return 0;
  }
}

/**
 * Excel COUNTIFS equivalent helper with error safety
 */
export function countIfs(records = [], ...conditions) {
  try {
    if (!Array.isArray(records) || records.length === 0) return 0;
    return records.filter((item) => {
      if (!item) return false;
      for (let i = 0; i < conditions.length; i += 2) {
        const field = conditions[i];
        const val = conditions[i + 1];
        if (field && val !== undefined) {
          if (String(item[field] || '').toLowerCase() !== String(val).toLowerCase()) {
            return false;
          }
        }
      }
      return true;
    }).length;
  } catch (error) {
    Logger.error('countIfs formula error:', error, 'formulaEngine');
    return 0;
  }
}

