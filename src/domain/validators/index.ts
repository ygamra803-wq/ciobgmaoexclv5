import { z } from 'zod';

/**
 * Schemas للتحقق من البيانات - GMAO Nexus Validation Schemas
 */

// Machine Schema
export const MachineSchema = z.object({
  id: z.string().min(1, 'معرف الآلة مطلوب'),
  name: z.string().min(1, 'اسم الآلة مطلوب'),
  zone: z.string().min(1, 'المنطقة مطلوبة'),
  family: z.string().min(1, 'العائلة مطلوبة'),
  template: z.string().min(1, 'النموذج مطلوب'),
  status: z.enum(['EN_SERVICE', 'EN_PANNE', 'MAINTENANCE', 'ACTIF', 'INACTIF']).optional().default('EN_SERVICE'),
  blueprintId: z.string().optional().nullable()
});

// StockItem Schema
export const StockItemSchema = z.object({
  code: z.string().min(1, 'رمز المادة مطلوب'),
  designation: z.string().min(1, 'تسمية المادة مطلوبة'),
  quantity: z.number().min(0, 'الكمية يجب أن تكون موجبة'),
  minStock: z.number().min(0, 'الحد الأدنى يجب أن يكون موجباً'),
  unit: z.string().min(1, 'الوحدة مطلوبة').optional().default('U'),
  category: z.string().optional().nullable()
});

// Mouvement Schema
export const MouvementSchema = z.object({
  id: z.string().optional(),
  date: z.union([z.date(), z.string()]),
  type: z.enum(['IN', 'OUT', 'ENTREE', 'SORTIE', 'AJUSTEMENT']),
  quantity: z.number().positive('الكمية يجب أن تكون موجبة'),
  stockCode: z.string().min(1, 'رمز المادة مطلوب'),
  user: z.string().min(1, 'المستخدم مطلوب'),
  notes: z.string().optional().nullable()
});

// Technician Schema
export const TechnicianSchema = z.object({
  id: z.string().min(1, 'معرف الفني مطلوب'),
  name: z.string().min(1, 'اسم الفني مطلوب'),
  specialization: z.string().min(1, 'التخصص مطلوب'),
  pin: z.string().min(4, 'الرمز يجب أن يكون 4 أحرف على الأقل'),
  zone: z.string().optional().nullable()
});

// Zone Schema
export const ZoneSchema = z.object({
  id: z.string().min(1, 'معرف المنطقة مطلوب'),
  name: z.string().min(1, 'اسم المنطقة مطلوب'),
  description: z.string().optional().nullable()
});

// Blueprint Schema
export const BlueprintSchema = z.object({
  id: z.string().min(1, 'معرف النموذج مطلوب'),
  model: z.string().min(1, 'نموذج المصنع مطلوب'),
  manufacturer: z.string().min(1, 'المصنع مطلوب'),
  specs: z.record(z.string(), z.any()).optional()
});

/**
 * خدمة التحقق من البيانات - ValidationService
 */
export class ValidationService {
  /**
   * التحقق من الآلة
   */
  static validateMachine(data) {
    return this.validate(data, MachineSchema, 'الآلة');
  }

  /**
   * التحقق من عنصر المخزون
   */
  static validateStockItem(data) {
    return this.validate(data, StockItemSchema, 'عنصر المخزون');
  }

  /**
   * التحقق من الحركة
   */
  static validateMouvement(data) {
    return this.validate(data, MouvementSchema, 'الحركة');
  }

  /**
   * التحقق من الفني
   */
  static validateTechnician(data) {
    return this.validate(data, TechnicianSchema, 'الفني');
  }

  /**
   * التحقق من المنطقة
   */
  static validateZone(data) {
    return this.validate(data, ZoneSchema, 'المنطقة');
  }

  /**
   * التحقق من النموذج
   */
  static validateBlueprint(data) {
    return this.validate(data, BlueprintSchema, 'النموذج');
  }

  /**
   * دالة التحقق العامة
   */
  static validate(data, schema, entityName) {
    try {
      const validated = schema.parse(data);
      return {
        valid: true,
        data: validated,
        errors: []
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = (error.issues || error.errors || []).map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return {
          valid: false,
          data: null,
          errors,
          summary: `خطأ في ${entityName}: ${errors[0]?.message || 'بيانات غير صحيحة'}`
        };
      }

      return {
        valid: false,
        data: null,
        errors: [{ message: error.message }],
        summary: `خطأ غير متوقع في ${entityName}`
      };
    }
  }

  /**
   * التحقق من البيانات المستوردة
   */
  static validateImportedData(data) {
    const results = {
      machines: { valid: true, errors: [] },
      stockItems: { valid: true, errors: [] },
      mouvements: { valid: true, errors: [] },
      technicians: { valid: true, errors: [] },
      zones: { valid: true, errors: [] }
    };

    // التحقق من الآلات
    if (Array.isArray(data?.machines)) {
      data.machines.forEach((item, index) => {
        const validation = this.validateMachine(item);
        if (!validation.valid) {
          results.machines.valid = false;
          results.machines.errors.push({
            row: index + 1,
            errors: validation.errors
          });
        }
      });
    }

    // التحقق من عناصر المخزون
    if (Array.isArray(data?.stockItems)) {
      data.stockItems.forEach((item, index) => {
        const validation = this.validateStockItem(item);
        if (!validation.valid) {
          results.stockItems.valid = false;
          results.stockItems.errors.push({
            row: index + 1,
            errors: validation.errors
          });
        }
      });
    }

    // التحقق من الحركات
    if (Array.isArray(data?.mouvements)) {
      data.mouvements.forEach((item, index) => {
        const validation = this.validateMouvement(item);
        if (!validation.valid) {
          results.mouvements.valid = false;
          results.mouvements.errors.push({
            row: index + 1,
            errors: validation.errors
          });
        }
      });
    }

    // التحقق من الفنيين
    if (Array.isArray(data?.technicians)) {
      data.technicians.forEach((item, index) => {
        const validation = this.validateTechnician(item);
        if (!validation.valid) {
          results.technicians.valid = false;
          results.technicians.errors.push({
            row: index + 1,
            errors: validation.errors
          });
        }
      });
    }

    // التحقق من المناطق
    if (Array.isArray(data?.zones)) {
      data.zones.forEach((item, index) => {
        const validation = this.validateZone(item);
        if (!validation.valid) {
          results.zones.valid = false;
          results.zones.errors.push({
            row: index + 1,
            errors: validation.errors
          });
        }
      });
    }

    const allValid = Object.values(results).every(r => r.valid);

    return {
      valid: allValid,
      results,
      summary: allValid
        ? '✅ جميع البيانات صحيحة'
        : `❌ توجد أخطاء في البيانات المستوردة`
    };
  }
}

export default ValidationService;
