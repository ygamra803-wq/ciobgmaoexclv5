import { Logger } from '../logger/LoggerService';
import { PermissionError } from '../errors/ApplicationError';
import { ROLES, normalizeRole } from './Roles';

/**
 * @file AuthorizationService.tsx
 * @module core/security/AuthorizationService
 * @description
 * جدول مصفوفة الصلاحيات وخيارات التحكم بالوصول المبني على الأدوار (Role-Based Access Control - RBAC).
 *
 * الأدوار المعتمدة بالنظام:
 * - ADMIN: مدير النظام (جميع الصلاحيات الإدارية، التعديل، التصدير، النسخ الاحتياطي، وتفريغ المصنع).
 * - RESPONSABLE / RESPONSABLE_MAINTENANCE: رئيس الفرقة/المشرف (عرض، إنشاء، تعديل الصيانة والمخزون والآلات، وتصدير التقارير).
 * - RESPONSABLE_MAGASIN: أمين المخزن (إدارة المخزون PDR، المستودع، وحركات الصرف والاستلام).
 * - TECHNICIEN: الفني الميداني (عرض المخزون والآلات، تنفيذ المهام الوقائية والعلاجية، وصرف القطع).
 * - OPERATEUR: المشغل الميداني (عرض واستخدام قطع الغيار وتبليغ الأعطال).
 * - VIEWER: المراقب (قراءة فقط للوحات القيادة والمخزون والآلات والصيانة).
 */
export const PERMISSIONS: Record<string, string[]> = {
  // إدارة المخزون والمقالات (Stock PDR)
  'stock.view': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
    ROLES.TECHNICIEN,
    ROLES.OPERATEUR,
    ROLES.VIEWER,
  ],
  'stock.create': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],
  'stock.edit': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],
  'stock.update': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],
  'stock.delete': [ROLES.ADMIN],
  'stock.export': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],

  // إدارة المستودع الاحتياطي (Warehouse / Entrepôt)
  'warehouse.view': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],
  'warehouse.manage': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],

  // إدارة حركات الصرف والإرجاع (Movements)
  'movement.view': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
    ROLES.TECHNICIEN,
    ROLES.OPERATEUR,
    ROLES.VIEWER,
  ],
  'movement.create': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
  ],
  'movement.edit': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],
  'movement.delete': [ROLES.ADMIN],

  // إدارة الآلات والمعدات (Machines)
  'machine.view': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
    ROLES.TECHNICIEN,
    ROLES.OPERATEUR,
    ROLES.VIEWER,
  ],
  'machine.create': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE],
  'machine.edit': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE],
  'machine.update': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.TECHNICIEN],
  'machine.delete': [ROLES.ADMIN],

  // الصيانة الوقائية والعلاجية (Preventive & Corrective)
  'preventive.view': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.TECHNICIEN,
    ROLES.VIEWER,
  ],
  'preventive.execute': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.TECHNICIEN],
  'preventive.manage': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE],
  'corrective.view': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.TECHNICIEN,
    ROLES.OPERATEUR,
    ROLES.VIEWER,
  ],
  'corrective.execute': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.TECHNICIEN,
    ROLES.OPERATEUR,
  ],
  'corrective.manage': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.TECHNICIEN],

  // إدارة المستخدمين والملفات الشخصية (User Management)
  'user.view': [ROLES.ADMIN],
  'user.create': [ROLES.ADMIN],
  'user.edit': [ROLES.ADMIN],
  'user.delete': [ROLES.ADMIN],

  // التقارير والإحصائيات (Reports & Analytics)
  'report.view': [
    ROLES.ADMIN,
    'RESPONSABLE',
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
    ROLES.VIEWER,
  ],
  'report.export': [ROLES.ADMIN, 'RESPONSABLE', ROLES.RESPONSABLE_MAINTENANCE, ROLES.RESPONSABLE_MAGASIN],

  // إعدادات النظام والنسخ الاحتياطي (Settings & Backup)
  'settings.view': [ROLES.ADMIN],
  'settings.edit': [ROLES.ADMIN],
  'settings.manage': [ROLES.ADMIN],
  'settings.backup': [ROLES.ADMIN],
  'settings.restore': [ROLES.ADMIN],
};

// مصفوفة التبويبات المسموحة لكل دور قياسي
const ROLE_ALLOWED_TABS: Record<string, Set<string> | '*'> = {
  [ROLES.ADMIN]: '*',
  [ROLES.RESPONSABLE_MAINTENANCE]: '*',
  [ROLES.RESPONSABLE_MAGASIN]: new Set([
    'dashboard',
    'validation_center',
    'shift_weekly_report',
    'executive_report',
    'stock',
    'types',
    'designations',
    'diagnostics',
    'sortie',
    'entrepot',
    'comp_groups',
    'comp_families',
    'comp_templates',
    'part_types',
    'part_designations',
    'machines',
    'families',
    'templates',
    'blueprints',
    'zones',
    'guide',
  ]),
  [ROLES.TECHNICIEN]: new Set([
    'dashboard',
    'stock',
    'sortie',
    'machines',
    'preventive',
    'corrective',
    'corrective_di',
    'corrective_bt',
    'corrective_live',
    'corrective_cloture',
    'corrective_analytics',
    'corrective_history',
    'corrective_pieces',
    'guide',
  ]),
  [ROLES.OPERATEUR]: new Set([
    'dashboard',
    'stock',
    'sortie',
    'machines',
    'corrective',
    'corrective_di',
    'zones',
    'guide',
  ]),
  [ROLES.VIEWER]: new Set([
    'dashboard',
    'shift_weekly_report',
    'executive_report',
    'stock',
    'machines',
    'preventive',
    'corrective',
    'corrective_di',
    'corrective_bt',
    'corrective_cloture',
    'corrective_analytics',
    'zones',
    'guide',
  ]),
};

/**
 * Authorization Service
 * ✅ خدمة التحقق من الصلاحيات والتحكم في الوصول المباشر
 */
export class AuthorizationService {
  static hasPermission(user: any, permission: string): boolean {
    if (!user) {
      Logger.warn('⚠️ User is null or undefined during permission check');
      return false;
    }

    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) {
      Logger.warn('⚠️ Unknown or unregistered permission requested', { permission });
      return false;
    }

    const rawRole = typeof user === 'string' ? user : user.role;
    const normalized = normalizeRole(rawRole);

    const hasPerm =
      allowedRoles.includes(rawRole) ||
      allowedRoles.includes(normalized);

    if (!hasPerm) {
      Logger.warn('⚠️ Permission denied', {
        userId: user?.id,
        permission,
        userRole: rawRole,
      });
    }

    return hasPerm;
  }

  /**
   * التحقق من صلاحية الوصول إلى تبويب/شاشة معينة حسب دور المستخدم
   */
  static canAccessTab(userOrRole: any, tabId: string): boolean {
    if (!userOrRole) return false;
    const rawRole = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
    const normalized = normalizeRole(rawRole);
    const allowed = ROLE_ALLOWED_TABS[normalized];
    if (allowed === '*') return true;
    if (!allowed) return false;
    const cleanTab = String(tabId || 'dashboard').trim();
    if (allowed.has(cleanTab)) return true;
    if (cleanTab.startsWith('corrective_') && cleanTab !== 'corrective_referentiel' && allowed.has('corrective')) {
      return true;
    }
    return false;
  }

  /**
   * التحقق مما إذا كان الحساب للقراءة فقط (Observateur / VIEWER)
   */
  static isReadOnly(userOrRole: any): boolean {
    if (!userOrRole) return true;
    const rawRole = typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
    return normalizeRole(rawRole) === ROLES.VIEWER;
  }

  static requirePermission(permission: string) {
    return (user: any) => {
      if (!this.hasPermission(user, permission)) {
        throw new PermissionError(`Permission denied: ${permission}`, permission);
      }
    };
  }

  static getAllPermissions(role: string): string[] {
    const normalized = normalizeRole(role);
    return Object.entries(PERMISSIONS)
      .filter(([_, roles]) => roles.includes(role) || roles.includes(normalized))
      .map(([permission]) => permission);
  }

  static canAccess(user: any, resource: string): boolean {
    const permissions = this._getResourcePermissions(resource);
    return permissions.some((p) => this.hasPermission(user, p));
  }

  static _getResourcePermissions(resource: string): string[] {
    const [domain, action] = resource.split('.');
    return Object.keys(PERMISSIONS)
      .filter((p) => p.startsWith(domain))
      .filter((p) => p.endsWith(action));
  }
}

