/**
 * Canonical Role Definitions & Normalization Layer (GMAO Single Source of Truth)
 * Eliminates domain identity mismatches (e.g. RESPONSABLE_MAGASIN vs MAGASINIER)
 */

export const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  RESPONSABLE_MAINTENANCE: 'RESPONSABLE_MAINTENANCE',
  RESPONSABLE_MAGASIN: 'RESPONSABLE_MAGASIN',
  TECHNICIEN: 'TECHNICIEN',
  OPERATEUR: 'OPERATEUR',
  VIEWER: 'VIEWER',
});

// Legacy aliases gracefully mapped to Canonical Roles
const ROLE_ALIASES = Object.freeze({
  'ADMIN': ROLES.ADMIN,
  'ADMINISTRATEUR': ROLES.ADMIN,
  'RESPONSABLE': ROLES.RESPONSABLE_MAINTENANCE,
  'RESPONSABLE_MAINTENANCE': ROLES.RESPONSABLE_MAINTENANCE,
  'CHEF': ROLES.RESPONSABLE_MAINTENANCE,
  'CHEF_EQUIPE': ROLES.RESPONSABLE_MAINTENANCE,
  'MAGASINIER': ROLES.RESPONSABLE_MAGASIN,
  'RESPONSABLE_MAGASIN': ROLES.RESPONSABLE_MAGASIN,
  'RMG': ROLES.RESPONSABLE_MAGASIN,
  'TECHNICIEN': ROLES.TECHNICIEN,
  'TECHNICIAN': ROLES.TECHNICIEN,
  'TECH': ROLES.TECHNICIEN,
  'OPERATEUR': ROLES.OPERATEUR,
  'OPERATOR': ROLES.OPERATEUR,
  'VIEWER': ROLES.VIEWER,
  'OBSERVATEUR': ROLES.VIEWER,
  'VISITEUR': ROLES.VIEWER,
});

/**
 * Normalizes any role string to its Canonical Role representation
 * @param {string} raw - raw role string
 * @returns {string} canonical role
 */
export function normalizeRole(raw) {
  if (!raw || typeof raw !== 'string') return ROLES.VIEWER;
  const clean = raw.trim().toUpperCase();
  return ROLE_ALIASES[clean] || ROLES.VIEWER;
}

/**
 * Checks if a given role matches or has equivalent privileges
 */
export function isRoleMatch(userRole, targetRole) {
  return normalizeRole(userRole) === normalizeRole(targetRole);
}

export default ROLES;
