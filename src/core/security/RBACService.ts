import { ROLES, normalizeRole } from './Roles';

export { ROLES, normalizeRole };

export const PERMISSIONS = {
  'stock.view': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
    ROLES.TECHNICIEN,
    ROLES.OPERATEUR,
    ROLES.VIEWER,
  ],
  'stock.create': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
  ],
  'stock.update': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
  ],
  'stock.delete': [
    ROLES.ADMIN,
  ],
  'machine.view': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.RESPONSABLE_MAGASIN,
    ROLES.TECHNICIEN,
    ROLES.OPERATEUR,
    ROLES.VIEWER,
  ],
  'machine.create': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
  ],
  'machine.update': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.TECHNICIEN,
  ],
  'machine.delete': [
    ROLES.ADMIN,
  ],
  'corrective.manage': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
    ROLES.TECHNICIEN,
  ],
  'preventive.manage': [
    ROLES.ADMIN,
    ROLES.RESPONSABLE_MAINTENANCE,
  ],
  'settings.manage': [
    ROLES.ADMIN,
  ],
};

export class RBACService {
  static hasPermission(userRole, permission) {
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;
    const normalized = normalizeRole(userRole);
    return allowedRoles.includes(normalized);
  }
}

