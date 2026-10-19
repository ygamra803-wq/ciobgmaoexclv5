/**
 * 🏛️ GMAO Reactive Calculation Engine (HyperFormula)
 * Conforme à la Constitution GMAO : Moteur de calcul réactif en mémoire (In-Memory DAG Calculation Engine).
 * Fournit une compatibilité mathématique 100% identique à Excel (SUMIFS, COUNTIFS, IF, VLOOKUP)
 * pour le recalcul instantané des stocks, des alertes et des indicateurs de supervision.
 */
import { HyperFormula } from 'hyperformula';
import { Logger } from '../core/logger/LoggerService';
import { safeNum, calculateStockStatus } from '../utils/formulaEngine';
import { INITIAL_STOCK_LOOKUP } from '../utils/baselineStock';
import { stockIndexStore } from '../application/StockIndexStore';

class ReactiveCalculationEngine {
  constructor() {
    this.hf = null;
    this.stockSheetId = null;
    this._lastRawStock = null;
    this._lastMouvements = null;
    this._lastGlobalVersion = -1;
    this._lastComputedItems = null;
    this._dirtyHyperFormula = false;
    this._latestComputedStock = [];
    this._kpiCache = new WeakMap();
    this.initEngine();
  }

  /**
   * Initialise l'instance HyperFormula avec la configuration industrielle
   */
  initEngine() {
    try {
      this.hf = HyperFormula.buildEmpty({
        licenseKey: 'gpl-v3',
        useColumnIndex: true,
        useStats: false,
        evaluateNullToZero: true,
        precisionRounding: 6,
      });
      Logger.info('[ReactiveEngine] HyperFormula instance initialized successfully', 'reactiveCalculationEngine');
    } catch (err) {
      Logger.error('[ReactiveEngine] Failed to initialize HyperFormula:', err, 'reactiveCalculationEngine');
      this.hf = null;
    }
  }

  /**
   * Recalcule réactivement l'ensemble des stocks et alertes à partir du stock brut et des mouvements.
   * Utilise le moteur réactif en miroir strict des formules Excel :
   * - Entrées: =SUMIFS(Mouvements!C:C, Mouvements!B:B, ref, Mouvements!D:D, "Entrée")
   * - Sorties: =SUMIFS(Mouvements!C:C, Mouvements!B:B, ref, Mouvements!D:D, "Sortie")
   * - Stock Actuel: =StockInitial + Entrées - Sorties
   * - Alerte: =IF(StockActuel <= 0, "RUPTURE", IF(StockActuel <= Seuil, "ALERTE", "OK"))
   */
  recalculateStockReactive(rawStock = [], mouvements = []) {
    if (!Array.isArray(rawStock) || rawStock.length === 0) {
      return [];
    }

    try {
      const hasHydratedStore =
        stockIndexStore &&
        typeof stockIndexStore.isHydrated === 'function' &&
        stockIndexStore.isHydrated();

      const currentVersion =
        hasHydratedStore && typeof stockIndexStore.getGlobalVersion === 'function'
          ? stockIndexStore.getGlobalVersion()
          : -1;

      // Return cached result in O(1) if input references and index version are identical
      if (
        this._lastComputedItems !== null &&
        this._lastRawStock === rawStock &&
        this._lastMouvements === mouvements &&
        this._lastGlobalVersion === currentVersion
      ) {
        return this._lastComputedItems;
      }

      const computedItems = rawStock.map((item, idx) => {
        if (!item) return null;
        const itemRef = String(item.ref || item.Ref || `ART-${idx + 1}`).trim();
        const itemRefKey = itemRef.toLowerCase();
        const itemDesigKey = String(item.designation || item.Designation || '')
          .trim()
          .toLowerCase();

        // Direct O(1) indexed lookups
        let totals = { entrees: 0, sorties: 0, commandes: 0 };
        if (hasHydratedStore) {
          totals = stockIndexStore.index.getTotals(itemRef);
        } else if (Array.isArray(mouvements)) {
          let ent = 0;
          let sor = 0;
          for (let i = 0; i < mouvements.length; i++) {
            const m = mouvements[i];
            if (!m) continue;
            const mRef = String(m.ref || m.Ref || m['Référence'] || '').trim().toLowerCase();
            if (mRef === itemRefKey) {
              const qte = safeNum(m.quantite != null ? m.quantite : m['Quantité'], 0);
              const type = String(m.type || m['Type (Entrée/Sortie)'] || '').trim().toLowerCase();
              if (type.includes('entr') || type === 'in') {
                ent += qte;
              } else {
                sor += qte;
              }
            }
          }
          totals = { entrees: ent, sorties: sor, commandes: 0 };
        }

        let stockInitial = 0;
        if (
          item.stockInitial !== undefined &&
          item.stockInitial !== null &&
          item.stockInitial !== '' &&
          !isNaN(Number(item.stockInitial))
        ) {
          stockInitial = Number(item.stockInitial);
        } else {
          const baseline =
            INITIAL_STOCK_LOOKUP.get(itemRefKey) ||
            (itemDesigKey ? INITIAL_STOCK_LOOKUP.get(itemDesigKey) : null);
          if (baseline && baseline.qty > 0) {
            stockInitial = baseline.qty;
          }
        }

        const seuil = safeNum(item.seuil, 3);
        const { stockActuel, alerte } = calculateStockStatus(
          stockInitial,
          totals.entrees,
          totals.sorties,
          seuil
        );

        return {
          ...item,
          ref: itemRef,
          stockInitial,
          entrees: totals.entrees,
          sorties: totals.sorties,
          commandes: totals.commandes,
          stockActuel,
          alerte,
        };
      }).filter(Boolean);

      // Cache computed items and mark HyperFormula workbook for lazy on-demand sync
      this._lastRawStock = rawStock;
      this._lastMouvements = mouvements;
      this._lastGlobalVersion = currentVersion;
      this._lastComputedItems = computedItems;
      this._latestComputedStock = computedItems;
      this._dirtyHyperFormula = true;

      return computedItems;
    } catch (err) {
      Logger.error('[ReactiveEngine] Calculation error, fallback to safe conversion:', err, 'reactiveCalculationEngine');
      return rawStock;
    }
  }

  /**
   * Synchronise l'instance HyperFormula avec le modèle réactif
   */
  syncHyperFormulaStock(stockItems = []) {
    if (!this.hf) return;
    try {
      const sheetName = 'Stock_Reactive';
      if (this.hf.doesSheetExist(sheetName)) {
        this.stockSheetId = this.hf.getSheetId(sheetName);
        this.hf.clearSheet(this.stockSheetId);
      } else {
        this.hf.addSheet(sheetName);
        this.stockSheetId = this.hf.getSheetId(sheetName);
      }

      // Construit la table miroir avec les formules Excel
      const headers = ['Ref', 'StockInitial', 'Entrees', 'Sorties', 'StockActuel', 'Seuil', 'Alerte'];
      const rows = [headers];

      stockItems.slice(0, 500).forEach((s, idx) => {
        const rowNum = idx + 2;
        rows.push([
          s.ref,
          s.stockInitial,
          s.entrees,
          s.sorties,
          `=B${rowNum}+C${rowNum}-D${rowNum}`,
          s.seuil,
          `=IF(E${rowNum}<=0, "RUPTURE", IF(E${rowNum}<=F${rowNum}, "ALERTE", "OK"))`,
        ]);
      });

      this.hf.setCellContents({ sheet: this.stockSheetId, col: 0, row: 0 }, rows);
      this._dirtyHyperFormula = false;
    } catch (syncErr) {
      Logger.warn('[ReactiveEngine] HyperFormula sheet sync warning:', syncErr, 'reactiveCalculationEngine');
    }
  }

  /**
   * Calcule les métriques globales de stock (KPIs) avec détection des alertes et ruptures
   * Utilise un WeakMap pour retourner la même référence en O(1) si stockItems n'a pas changé
   */
  computeStockKPIs(stockItems = []) {
    if (Array.isArray(stockItems) && this._kpiCache.has(stockItems)) {
      return this._kpiCache.get(stockItems);
    }

    let totalEntrees = 0;
    let totalSorties = 0;
    let totalStockActuel = 0;
    let ruptures = 0;
    let alertes = 0;

    for (let i = 0; i < stockItems.length; i++) {
      const s = stockItems[i];
      if (!s) continue;
      totalEntrees += s.entrees || 0;
      totalSorties += s.sorties || 0;
      totalStockActuel += s.stockActuel || 0;
      if (s.alerte === 'RUPTURE') ruptures++;
      else if (s.alerte === 'ALERTE') alertes++;
    }

    const result = {
      totalArticles: stockItems.length,
      totalEntrees,
      totalSorties,
      totalStockActuel,
      ruptures,
      alertes,
    };

    if (Array.isArray(stockItems)) {
      this._kpiCache.set(stockItems, result);
    }

    return result;
  }

  /**
   * Évalue une formule Excel arbitraire via HyperFormula
   * Ex: evaluateFormula("=SUM(10, 20, 30)") -> 60
   */
  evaluateFormula(formulaString) {
    if (!this.hf) return null;
    try {
      if (this._dirtyHyperFormula && this._latestComputedStock.length > 0) {
        this.syncHyperFormulaStock(this._latestComputedStock);
      }
      const cleanFormula = formulaString.startsWith('=') ? formulaString : `=${formulaString}`;
      const sheetName = 'Eval_Temp';
      
      let sheetId;
      if (this.hf.doesSheetExist(sheetName)) {
        sheetId = this.hf.getSheetId(sheetName);
        this.hf.clearSheet(sheetId);
      } else {
        sheetId = this.hf.addSheet(sheetName);
      }

      this.hf.setCellContents({ sheet: sheetId, col: 0, row: 0 }, [[cleanFormula]]);
      const val = this.hf.getCellValue({ sheet: sheetId, col: 0, row: 0 });
      return val;
    } catch (err) {
      Logger.warn('[ReactiveEngine] Formula eval error:', err, 'reactiveCalculationEngine');
      return null;
    }
  }

  /**
   * Calcule les métriques globales de supervision (KPIs) en miroir d'Excel
   */
  computeExecutiveKpis({ stockItems = [], mouvements = [], machines = [], bonsTravail = [] } = {}) {
    const totalArticles = stockItems.length;
    const articlesEnAlerte = stockItems.filter((s) => s.alerte === 'ALERTE' || s.alerte === 'RUPTURE').length;
    const totalQuantiteStock = stockItems.reduce((acc, s) => acc + (Number(s.stockActuel) || 0), 0);
    const totalEntrees = stockItems.reduce((acc, s) => acc + (Number(s.entrees) || 0), 0);
    const totalSorties = stockItems.reduce((acc, s) => acc + (Number(s.sorties) || 0), 0);
    const totalMouvements = mouvements.length;
    const totalMachines = machines.length;
    const totalBt = bonsTravail.length;

    return {
      totalArticles,
      articlesEnAlerte,
      totalQuantiteStock,
      totalEntrees,
      totalSorties,
      totalMouvements,
      totalMachines,
      totalBt,
      tauxDisponibilStock:
        totalArticles > 0 ? Math.round(((totalArticles - articlesEnAlerte) / totalArticles) * 100) : 100,
    };
  }
}

export const reactiveCalculationEngine = new ReactiveCalculationEngine();
export default reactiveCalculationEngine;
