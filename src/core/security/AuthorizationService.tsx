import { Logger } from '../logger/LoggerService';
import { PermissionError } from '../errors/ApplicationError';

/**
 * @file AuthorizationService.js
 * @module core/security/AuthorizationService
 * @description
 * جدول مصفوفة الصلاحيات وخيارات التحكم بالوصول المبني على الأدوار (Role-Based Access Control - RBAC).
 * 
 * الأدوار المعتمدة بالنظام:
 * - ADMIN: مدير النظام (جميع الصلاحيات الإدارية، التعديل، التصدير، النسخ الاحتياطي).
 * - RESPONSABLE: رئيس الفرقة/المشرف (عرض، إنشاء، تعديل المخزون والآلات، وتصدير التقارير).
 * - TECHNICIEN: الفني الميداني (عرض المخزون والآلات، تسجيل وإجراء حركات الصيانة PDR).
 * - OPERATEUR: المشغل الميداني (عرض واستخدام قطع الغيار وحركات الصرف المباشرة).
 */
export const PERMISSIONS = {
  // إدارة المخزون والمقالات (Stock PDR)
  'stock.view': ['ADMIN', 'RESPONSABLE', 'TECHNICIEN'],
  'stock.create': ['ADMIN', 'RESPONSABLE'],
  'stock.edit': ['ADMIN', 'RESPONSABLE'],
  'stock.delete': ['ADMIN'],
  'stock.export': ['ADMIN', 'RESPONSABLE'],

  // إدارة حركات الصرف والإرجاع (Movements)
  'movement.view': ['ADMIN', 'RESPONSABLE', 'TECHNICIEN', 'OPERATEUR'],
  'movement.create': ['ADMIN', 'RESPONSABLE', 'TECHNICIEN'],
  'movement.edit': ['ADMIN', 'RESPONSABLE'],
  'movement.delete': ['ADMIN'],

  // إدارة الآلات والمعدات (Machines)
  'machine.view': ['ADMIN', 'RESPONSABLE', 'TECHNICIEN'],
  'machine.create': ['ADMIN', 'RESPONSABLE'],
  'machine.edit': ['ADMIN', 'RESPONSABLE'],
  'machine.delete': ['ADMIN'],

  // إدارة المستخدمين والملفات الشخصية (User Management)
  'user.view': ['ADMIN'],
  'user.create': ['ADMIN'],
  'user.edit': ['ADMIN'],
  'user.delete': ['ADMIN'],

  // التقارير والإحصائيات (Reports & Analytics)
  'report.view': ['ADMIN', 'RESPONSABLE'],
  'report.export': ['ADMIN', 'RESPONSABLE'],

  // إعدادات النظام والنسخ الاحتياطي (Settings & Backup)
  'settings.view': ['ADMIN'],
  'settings.edit': ['ADMIN'],
  'settings.backup': ['ADMIN'],
  'settings.restore': ['ADMIN']
};

/**
 * Authorization Service
 * ✅ خدمة التحقق من الصلاحيات والتحكم في الوصول المباشر
 */
export class AuthorizationService {
  /**
   * فحص ما إذا كان المستخدم يملك صلاحية محددة
   * 
   * @param {Object} user - كائن المستخدم الحالي (يحتوي على role و id)
   * @param {string} permission - اسم الصلاحية المطلوب فحصها (مثل: 'stock.edit', 'movement.create')
   * @returns {boolean} true إذا كان المستخدم يملك الصلاحية، و false خلاف ذلك
   */
  static hasPermission(user, permission) {
    if (!user) {
      Logger.warn('⚠️ User is null or undefined during permission check');
      return false;
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      Logger.warn('⚠️ Unknown or unregistered permission requested', { permission });
      return false;
    }

    const hasPermission = allowedRoles.includes(user.role);
    
    if (!hasPermission) {
      Logger.warn('⚠️ Permission denied', { 
        userId: user.id, 
        permission, 
        userRole: user.role 
      });
    }

    return hasPermission;
  }

  /**
   * دالة حظر إجبارية (Higher-Order Function) تفرض وجود الصلاحية وتطرح استثناءً عند عدم التخويل
   * 
   * @param {string} permission - اسم الصلاحية المطلوبة
   * @returns {(user: Object) => void} دالة تتحقق من صلاحية المستخدم
   * @throws {PermissionError} عند رفض الوصول وعدم مطابقة الصلاحية
   */
  static requirePermission(permission) {
    return (user) => {
      if (!this.hasPermission(user, permission)) {
        throw new PermissionError(`Permission denied: ${permission}`, permission);
      }
    };
  }

  /**
   * استخراج قائمة كافة الصلاحيات المتاحة لدور معين
   * 
   * @param {string} role - اسم الدور المراد استعلام صلاحياته
   * @returns {Array<string>} مصفوفة بجميع مسميات الصلاحيات المسموحة لهذا الدور
   */
  static getAllPermissions(role) {
    return Object.entries(PERMISSIONS)
      .filter(([_, roles]) => roles.includes(role))
      .map(([permission]) => permission);
  }

  /**
   * فحص إمكانية الوصول إلى مورد عام بناءً على المجال والحدث (e.g., 'stock.view')
   * 
   * @param {Object} user - كائن المستخدم
   * @param {string} resource - اسم المورد النمطي
   * @returns {boolean} true إذا كان يمتلك أي صلاحية تابعة للمورد
   */
  static canAccess(user, resource) {
    const permissions = this._getResourcePermissions(resource);
    return permissions.some(p => this.hasPermission(user, p));
  }

  /**
   * استخراج الصلاحيات الفرعية المرتبطة بمورد محدد
   * 
   * @private
   * @param {string} resource
   * @returns {Array<string>}
   */
  static _getResourcePermissions(resource) {
    const [domain, action] = resource.split('.');
    return Object.keys(PERMISSIONS)
      .filter(p => p.startsWith(domain))
      .filter(p => p.endsWith(action));
  }
}
