// ✅ ملف: src/core/domain/services/ExcelFormulaEngine.ts

/**
 * Excel Formula Engine
 * ✅ تطبيق دقيق لـ Excel Formulas
 */
export class ExcelFormulaEngine {
  /**
   * SUMIFS Implementation
   * =SUMIFS(sum_range, criteria_range1, criterion1, criteria_range2, criterion2)
   * 
   * مثال:
   * SUMIFS(movements, 'ref', 'ROUL-6204', 'type', 'Entrée')
   * النتيجة: مجموع الكميات للدخول فقط
   */
  static sumifs(
    data: any[],
    sumField: string,
    criteriaField1: string,
    criterion1: any,
    criteriaField2: string,
    criterion2: any
  ): number {
    if (!Array.isArray(data) || data.length === 0) return 0;

    let sum = 0;

    for (const row of data) {
      const value1 = this.getNestedValue(row, criteriaField1);
      const value2 = this.getNestedValue(row, criteriaField2);
      const sumValue = this.getNestedValue(row, sumField);

      // التحقق من المعايير
      if (value1 === criterion1 && value2 === criterion2) {
        const numValue = Number(sumValue);
        if (Number.isFinite(numValue) && numValue > 0) {
          sum += numValue;
        }
      }
    }

    return sum;
  }

  /**
   * COUNTIFS Implementation
   */
  static countifs(
    data: any[],
    criteriaField1: string,
    criterion1: any,
    criteriaField2: string,
    criterion2: any
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

  /**
   * FILTER Implementation
   */
  static filter(
    data: any[],
    criteriaField: string,
    criterion: any
  ): any[] {
    if (!Array.isArray(data) || data.length === 0) return [];

    return data.filter(row => {
      const value = this.getNestedValue(row, criteriaField);
      return value === criterion;
    });
  }

  /**
   * VLOOKUP Implementation
   */
  static vlookup(
    lookupValue: any,
    tableArray: any[],
    colIndexNum: number,
    rangeLookup: boolean = false
  ): any {
    if (!Array.isArray(tableArray) || tableArray.length === 0) return null;

    for (const row of tableArray) {
      const firstValue = Array.isArray(row) ? row[0] : row[Object.keys(row)[0]];

      if (rangeLookup) {
        if (firstValue >= lookupValue) {
          return Array.isArray(row) ? row[colIndexNum - 1] : row[Object.keys(row)[colIndexNum - 1]];
        }
      } else {
        if (firstValue === lookupValue) {
          return Array.isArray(row) ? row[colIndexNum - 1] : row[Object.keys(row)[colIndexNum - 1]];
        }
      }
    }

    return null;
  }

  /**
   * حساب المخزون الفعلي
   * Stock Actuel = Stock Initial + Entrées - Sorties
   */
  static calculateStockActuel(
    article: any,
    movements: any[]
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

    const entrees = this.sumifs(
      movements,
      'quantite',
      'ref',
      article.ref,
      'type',
      'Entrée'
    );

    const sorties = this.sumifs(
      movements,
      'quantite',
      'ref',
      article.ref,
      'type',
      'Sortie'
    );

    const stockActuel = article.stockInitial + entrees - sorties;

    return {
      stockInitial: article.stockInitial,
      entrees,
      sorties,
      stockActuel: Math.max(0, stockActuel),
      alerte: this.calculateAlerte(stockActuel, article.seuil)
    };
  }

  /**
   * حساب حالة التنبيه
   */
  static calculateAlerte(
    stockActuel: number,
    seuil: number
  ): 'OK' | 'ALERTE' | 'RUPTURE' {
    if (stockActuel <= 0) return 'RUPTURE';
    if (stockActuel <= seuil) return 'ALERTE';
    return 'OK';
  }

  /**
   * التحقق من الحسابات
   */
  static verifyCalculations(articles: any[], movements: any[]) {
    const errors: any[] = [];

    for (const article of articles) {
      try {
        const calculated = this.calculateStockActuel(article, movements);

        if (article.stockActuel !== calculated.stockActuel) {
          errors.push({
            ref: article.ref,
            field: 'stockActuel',
            expected: article.stockActuel,
            calculated: calculated.stockActuel,
            difference: article.stockActuel - calculated.stockActuel
          });
        }

        if (article.alerte !== calculated.alerte) {
          errors.push({
            ref: article.ref,
            field: 'alerte',
            expected: article.alerte,
            calculated: calculated.alerte
          });
        }
      } catch (error) {
        errors.push({
          ref: article.ref,
          error: (error as Error).message
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errorCount: errors.length,
      errors
    };
  }

  /**
   * Helper: الحصول على القيمة من nested object
   */
  private static getNestedValue(obj: any, path: string): any {
    return obj[path];
  }
}

export default ExcelFormulaEngine;
