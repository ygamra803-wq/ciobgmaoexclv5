// ✅ ملف: src/core/domain/services/ExcelFormulaEngine.ts

export type FormulaRowObject = Record<string, unknown>;
export type FormulaTableRow = FormulaRowObject | ReadonlyArray<unknown>;

export interface FormulaStockArticle {
  ref: string;
  stockInitial: number;
  seuil: number;
  stockActuel?: number;
  alerte?: 'OK' | 'ALERTE' | 'RUPTURE' | string;
}

export interface FormulaMovementRow {
  ref?: string;
  type?: string;
  quantite?: number | string;
  [key: string]: unknown;
}

export interface CalculationDiscrepancy {
  ref: string;
  field?: 'stockActuel' | 'alerte';
  expected?: unknown;
  calculated?: unknown;
  difference?: number;
  error?: string;
}

/**
 * Excel Formula Engine
 * Provides deterministic TypeScript equivalents of Excel lookup/aggregation formulas
 * (`SUMIFS`, `COUNTIFS`, `FILTER`, `VLOOKUP`) and verifies the canonical stock invariant:
 *   `stockActuel = stockInitial + entrees - sorties`
 */
export class ExcelFormulaEngine {
  /**
   * Computes `=SUMIFS(sum_range, criteria_range1, criterion1, criteria_range2, criterion2)`.
   * Sums strictly positive numeric values matching both criteria (mirroring warehouse ledger math).
   */
  static sumifs<T extends FormulaRowObject>(
    data: ReadonlyArray<T>,
    sumField: string,
    criteriaField1: string,
    criterion1: unknown,
    criteriaField2: string,
    criterion2: unknown
  ): number {
    if (!Array.isArray(data) || data.length === 0) return 0;

    let sum = 0;

    for (const row of data) {
      const value1 = this.getNestedValue(row, criteriaField1);
      const value2 = this.getNestedValue(row, criteriaField2);
      const sumValue = this.getNestedValue(row, sumField);

      if (value1 === criterion1 && value2 === criterion2) {
        const numValue = Number(sumValue);
        if (Number.isFinite(numValue) && numValue > 0) {
          sum += numValue;
        }
      }
    }

    return sum;
  }

  /** Counts rows matching two exact field equality criteria (`=COUNTIFS`). */
  static countifs<T extends FormulaRowObject>(
    data: ReadonlyArray<T>,
    criteriaField1: string,
    criterion1: unknown,
    criteriaField2: string,
    criterion2: unknown
  ): number {
    if (!Array.isArray(data) || data.length === 0) return 0;

    let count = 0;

    for (const row of data) {
      const value1 = this.getNestedValue(row, criteriaField1);
      const value2 = this.getNestedValue(row, criteriaField2);

      if (value1 === criterion1 && value2 === criterion2) {
        count++;
      }
    }

    return count;
  }

  /** Filters object rows matching a single field criterion while preserving row element type `T`. */
  static filter<T extends FormulaRowObject>(
    data: ReadonlyArray<T>,
    criteriaField: string,
    criterion: unknown
  ): T[] {
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.filter((row) => {
      const value = this.getNestedValue(row, criteriaField);
      return value === criterion;
    });
  }

  /** Performs exact or ordered-threshold `=VLOOKUP` over array tuples or key-ordered objects. */
  static vlookup(
    lookupValue: string | number,
    tableArray: ReadonlyArray<FormulaTableRow>,
    colIndexNum: number,
    rangeLookup: boolean = false
  ): unknown {
    if (!Array.isArray(tableArray) || tableArray.length === 0) return null;

    for (const row of tableArray) {
      const firstValue = Array.isArray(row) ? row[0] : row[Object.keys(row)[0]];
      const readTargetCell = () =>
        Array.isArray(row) ? row[colIndexNum - 1] : row[Object.keys(row)[colIndexNum - 1]];

      if (rangeLookup) {
        if (
          (typeof firstValue === 'number' && typeof lookupValue === 'number' && firstValue >= lookupValue) ||
          (typeof firstValue === 'string' && typeof lookupValue === 'string' && firstValue >= lookupValue)
        ) {
          return readTargetCell();
        }
      } else if (firstValue === lookupValue) {
        return readTargetCell();
      }
    }

    return null;
  }

  /**
   * Computes exact live stock balance using the canonical invariant:
   * `stockActuel = Math.max(0, stockInitial + entrees - sorties)`.
   */
  static calculateStockActuel(
    article: FormulaStockArticle,
    movements: ReadonlyArray<FormulaMovementRow>
  ): {
    stockInitial: number;
    entrees: number;
    sorties: number;
    stockActuel: number;
    alerte: 'OK' | 'ALERTE' | 'RUPTURE';
  } {
    if (!article || !Array.isArray(movements)) {
      throw new Error('Invalid article or movements');
    }

    const entrees = this.sumifs(movements, 'quantite', 'ref', article.ref, 'type', 'Entrée');
    const sorties = this.sumifs(movements, 'quantite', 'ref', article.ref, 'type', 'Sortie');

    const stockActuel = article.stockInitial + entrees - sorties;

    return {
      stockInitial: article.stockInitial,
      entrees,
      sorties,
      stockActuel: Math.max(0, stockActuel),
      alerte: this.calculateAlerte(stockActuel, article.seuil),
    };
  }

  /** Maps signed raw stock balance and reorder threshold to `'RUPTURE' | 'ALERTE' | 'OK'`. */
  static calculateAlerte(
    stockActuel: number,
    seuil: number
  ): 'OK' | 'ALERTE' | 'RUPTURE' {
    if (stockActuel <= 0) return 'RUPTURE';
    if (stockActuel <= seuil) return 'ALERTE';
    return 'OK';
  }

  /** Audits persisted article snapshots against ledger sums and reports numeric or alert drifts. */
  static verifyCalculations(
    articles: ReadonlyArray<FormulaStockArticle>,
    movements: ReadonlyArray<FormulaMovementRow>
  ): {
    isValid: boolean;
    errorCount: number;
    errors: CalculationDiscrepancy[];
  } {
    const errors: CalculationDiscrepancy[] = [];

    for (const article of articles) {
      try {
        const calculated = this.calculateStockActuel(article, movements);

        if (article.stockActuel !== calculated.stockActuel) {
          errors.push({
            ref: article.ref,
            field: 'stockActuel',
            expected: article.stockActuel,
            calculated: calculated.stockActuel,
            difference: (article.stockActuel ?? 0) - calculated.stockActuel,
          });
        }

        if (article.alerte !== calculated.alerte) {
          errors.push({
            ref: article.ref,
            field: 'alerte',
            expected: article.alerte,
            calculated: calculated.alerte,
          });
        }
      } catch (error) {
        errors.push({
          ref: article.ref,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errorCount: errors.length,
      errors,
    };
  }

  /** Safely reads a field from a dynamic row record without `any` escape hatches. */
  private static getNestedValue(obj: FormulaRowObject, path: string): unknown {
    return obj ? obj[path] : undefined;
  }
}

export default ExcelFormulaEngine;
