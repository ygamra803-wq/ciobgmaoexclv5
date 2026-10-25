import { AuthorizationService } from './AuthorizationService';

function normalizeToken(val: unknown): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isTechnicianRole(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').trim().toUpperCase();
  return role === AuthorizationService.ROLES.TECHNICIEN || role === 'TECHNICIEN';
}

export function resolveTechnicianFromDirectory(user: any, technicians: any[] = []): any | null {
  if (!user || !Array.isArray(technicians) || technicians.length === 0) return null;

  const pIdNorm = normalizeToken(user.personnelId || user.code || '');
  const pNameNorm = normalizeToken(user.personnelName || user.name || '');

  for (const tech of technicians) {
    if (!tech || typeof tech !== 'object') continue;
    const tIdNorm = normalizeToken(tech.id_technician || tech.id || tech.code || '');
    const tName = tech.nom
      ? `${tech.nom} ${tech.prenom || ''}`.trim()
      : tech.nom_technicien || tech.name || '';
    const tNameNorm = normalizeToken(tName);

    if (pIdNorm && tIdNorm && pIdNorm === tIdNorm) return tech;
    if (pNameNorm && tNameNorm && pNameNorm === tNameNorm) return tech;
  }

  return null;
}

export function getTechnicianDisplayName(user: any, technicians: any[] = []): string {
  if (!user) return '';
  const matched = resolveTechnicianFromDirectory(user, technicians);
  if (matched) {
    const full = matched.nom
      ? `${matched.nom} ${matched.prenom || ''}`.trim()
      : matched.nom_technicien || matched.name || '';
    if (full) return full;
  }
  const rawName = String(user.personnelName || user.name || '').trim();
  if (rawName) {
    return rawName.replace(/^Technicien\s+/i, '').trim() || rawName;
  }
  return String(user.personnelId || user.code || '').trim();
}

export function getTechnicianBadgeLabel(user: any, technicians: any[] = []): string {
  if (!user) return 'Technicien';
  const matched = resolveTechnicianFromDirectory(user, technicians);
  const name = getTechnicianDisplayName(user, technicians);
  const code = String(
    user.personnelId || matched?.id_technician || matched?.id || user.code || ''
  ).trim();

  if (name && code && normalizeToken(name) !== normalizeToken(code)) {
    return `${name} (${code})`;
  }
  return name || code || 'Technicien';
}

export function getTechnicianIdentityTokens(user: any, technicians: any[] = []): Set<string> {
  const tokens = new Set<string>();
  if (!user) return tokens;

  const add = (val: unknown) => {
    const n = normalizeToken(val);
    if (n) tokens.add(n);
  };

  add(user.personnelId);
  add(user.personnelName);
  add(user.code);

  const rawName = String(user.name || '').trim();
  if (rawName) {
    add(rawName);
    add(rawName.replace(/^Technicien\s+/i, '').trim());
  }

  const matched = resolveTechnicianFromDirectory(user, technicians);
  if (matched) {
    add(matched.id_technician);
    add(matched.id);
    add(matched.code);
    add(matched.nom);
    if (matched.nom && matched.prenom) {
      add(`${matched.nom} ${matched.prenom}`);
    }
    add(matched.nom_technicien);
    add(matched.name);
  }

  return tokens;
}

/**
 * Matches a PreventiveTask, PreventiveExecution, or CorrectiveIntervention
 * against the logged-in technician's identity tokens (`personnelId` & `personnelName`).
 */
export function matchesTechnicianRecord(
  record: any,
  user: any,
  technicians: any[] = []
): boolean {
  if (!record || !user) return false;
  const userTokens = getTechnicianIdentityTokens(user, technicians);
  if (userTokens.size === 0) return false;

  const candidateValues = [
    record.id_technicien,
    record.id_technician,
    record.technicien_matricule,
    record.responsable,
    record.intervenant,
    record.technicien,
    record.technicien_realisateur,
  ];

  for (const val of candidateValues) {
    const norm = normalizeToken(val);
    if (norm && userTokens.has(norm)) {
      return true;
    }
  }

  return false;
}
