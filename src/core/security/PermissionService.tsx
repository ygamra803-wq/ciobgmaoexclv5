import { ROLES, PERMISSIONS, RBACService } from './RBACService';
import { AuthService } from './AuthService';
import { Logger } from '../logger/LoggerService';

/**
 * Unified Permission Service - Single Source of Truth for RBAC and Authorization.
 * @module PermissionService
 */
export class PermissionService {
  static ROLES = ROLES;
  static PERMISSIONS = PERMISSIONS;

  /**
   * Retrieves the current authenticated user safely through AuthService
   * Enforces fail-closed security principle.
   * @returns {Object}
   */
  static getCurrentUser() {
    try {
      const auth = new AuthService();
      const user = auth.getCurrentUser();
      if (user && user.role) {
        return user;
      }
    } catch (err) {
      Logger.warn('[PermissionService] Failed to resolve currentUser safely:', err);
    }
    // Fail-closed default: Visiteur
    return { username: 'Visiteur', role: ROLES.VIEWER };
  }

  /**
   * Checks whether the current user or given role has a specific permission.
   * @param {string} permission - e.g. 'stock.view', 'machine.create'
   * @param {string} [role] - Optional role override
   * @returns {boolean}
   */
  static can(permission, role = null) {
    const effectiveRole = role || this.getCurrentUser()?.role || ROLES.VIEWER;
    const hasPerm = RBACService.hasPermission(effectiveRole, permission);
    Logger.debug(`[PermissionService] Check ${permission} for ${effectiveRole}: ${hasPerm ? 'ALLOWED' : 'DENIED'}`);
    return hasPerm;
  }

  /**
   * Checks whether the current user or specified role is an Administrator.
   * @param {string} [role]
   * @returns {boolean}
   */
  static isAdmin(role = null) {
    const userRole = role || this.getCurrentUser()?.role;
    return userRole === ROLES.ADMIN || this.can('machine.delete', role);
  }

  /**
   * Checks whether the user has at least one of the specified roles.
   * @param {string[]} roles
   * @param {string} [currentRole]
   * @returns {boolean}
   */
  static hasAnyRole(roles = [], currentRole = null) {
    const userRole = currentRole || this.getCurrentUser()?.role;
    return roles.includes(userRole);
  }

  /**
   * Retrieves all registered permissions.
   * @returns {Object.<string, string[]>}
   */
  static getAllPermissions() {
    return PERMISSIONS;
  }

  /**
   * Retrieves all available roles.
   * @returns {Object.<string, string>}
   */
  static getRoles() {
    return ROLES;
  }
}

export default PermissionService;
