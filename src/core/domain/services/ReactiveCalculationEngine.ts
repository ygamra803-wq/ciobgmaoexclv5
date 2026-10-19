// ✅ ملف: src/core/domain/services/ReactiveCalculationEngine.ts

export interface StockMovementInput {
  type: 'IN' | 'OUT' | 'Entrée' | 'Sortie';
  quantity?: number;
  quantite?: number;
}

export interface MaintenanceInterventionInput {
  type: 'CORRECTIVE' | 'PREVENTIVE';
  duration: number;
}

export interface CalculationVerificationInput {
  stock?: number;
  mtbf?: number;
  mttr?: number;
  availability?: number;
}

/**
 * Reactive Calculation Engine
 * ✅ حسابات تفاعلية وآمنة للمخزون ومؤشرات الموثوقية الصناعية (MTBF, MTTR, Availability)
 */
export class ReactiveCalculationEngine {
  /**
   * حساب المخزون الفعلي
   * Stock = Initial + Entries - Exits
   */
  static calculateStock(
    initialStock: number,
    movements: Array<StockMovementInput>
  ): number {
    let stock = Number(initialStock) || 0;

    if (!Array.isArray(movements)) {
      return Math.max(0, stock);
    }

    for (const movement of movements) {
      if (!movement) continue;
      const qty = Number(movement.quantity ?? movement.quantite ?? 0);
      if (!Number.isFinite(qty) || qty < 0) continue;

      if (movement.type === 'IN' || movement.type === 'Entrée') {
        stock += qty;
      } else if (movement.type === 'OUT' || movement.type === 'Sortie') {
        stock -= qty;
      }
    }

    return Math.max(0, stock); // لا يمكن أن يكون سالباً
  }

  /**
   * حساب حالة التنبيه
   */
  static calculateAlertStatus(
    currentStock: number,
    minStock: number
  ): 'OK' | 'ALERTE' | 'RUPTURE' {
    if (currentStock <= 0) return 'RUPTURE';
    if (currentStock <= minStock) return 'ALERTE';
    return 'OK';
  }

  /**
   * حساب MTBF (Mean Time Between Failures)
   */
  static calculateMTBF(
    interventions: Array<MaintenanceInterventionInput>
  ): number {
    if (!Array.isArray(interventions)) return 0;

    const correctiveInterventions = interventions.filter(
      (i) => i && i.type === 'CORRECTIVE' && Number.isFinite(i.duration)
    );

    if (correctiveInterventions.length === 0) return 0;

    const totalTime = correctiveInterventions.reduce((sum, i) => sum + i.duration, 0);
    return totalTime / correctiveInterventions.length;
  }

  /**
   * حساب MTTR (Mean Time To Repair)
   */
  static calculateMTTR(
    interventions: Array<MaintenanceInterventionInput>
  ): number {
    if (!Array.isArray(interventions)) return 0;

    const correctiveInterventions = interventions.filter(
      (i) => i && i.type === 'CORRECTIVE' && Number.isFinite(i.duration)
    );

    if (correctiveInterventions.length === 0) return 0;

    return (
      correctiveInterventions.reduce((sum, i) => sum + i.duration, 0) /
      correctiveInterventions.length
    );
  }

  /**
   * حساب Availability (التوافرية التشغيلية)
   */
  static calculateAvailability(mtbf: number, mttr: number): number {
    if (mtbf === 0) return 100;
    if (mtbf + mttr <= 0) return 0;

    const availability = (mtbf / (mtbf + mttr)) * 100;
    return Math.min(Math.max(availability, 0), 100);
  }

  /**
   * التحقق من الحسابات (Verification Logic)
   */
  static verifyCalculations(data: CalculationVerificationInput): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (data && typeof data === 'object') {
      if (typeof data.stock === 'number' && data.stock < 0) {
        errors.push('Stock cannot be negative');
      }
      if (typeof data.mtbf === 'number' && data.mtbf < 0) {
        errors.push('MTBF cannot be negative');
      }
      if (typeof data.mttr === 'number' && data.mttr < 0) {
        errors.push('MTTR cannot be negative');
      }
      if (
        typeof data.availability === 'number' &&
        (data.availability < 0 || data.availability > 100)
      ) {
        errors.push('Availability must be 0-100');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

export default ReactiveCalculationEngine;
