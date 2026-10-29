import { ROLES } from './Roles';

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
  return role === ROLES.TECHNICIEN || role === 'TECHNICIEN';
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
    record.executorName,
    record.submitted_by_id,
    record.submitted_by_name,
  ];

  for (const val of candidateValues) {
    const norm = normalizeToken(val);
    if (norm && userTokens.has(norm)) {
      return true;
    }
  }

  return false;
}

export function getCurrentIsoWeekKey(date: Date = new Date()): string {
  const start = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const weekNum = Math.min(52, Math.max(1, Math.ceil((days + start.getDay() + 1) / 7)));
  return `S${weekNum}`;
}

export function buildTechnicianDashboardScope({
  user,
  technicians = [],
  preventiveTasks = [],
  preventiveExecutions = [],
  correctiveInterventions = [],
  mouvements = [],
  currentWeekKey = getCurrentIsoWeekKey(),
}: {
  user: any;
  technicians?: any[];
  preventiveTasks?: any[];
  preventiveExecutions?: any[];
  correctiveInterventions?: any[];
  mouvements?: any[];
  currentWeekKey?: string;
}) {
  const isTechUser = isTechnicianRole(user);
  const badgeLabel = getTechnicianBadgeLabel(user, technicians);
  const displayName = getTechnicianDisplayName(user, technicians);

  const activePreventiveTasks = (preventiveTasks || []).filter(
    (t) =>
      t?.is_active !== false &&
      t?.active !== false &&
      String(t?.statut || t?.status || '').trim().toUpperCase() !== 'ARCHIVEE' &&
      t?._isOrphan !== true
  );

  const myPreventiveTasks = isTechUser
    ? activePreventiveTasks.filter((t) => matchesTechnicianRecord(t, user, technicians))
    : activePreventiveTasks;

  const isScheduledThisWeek = (task: any) => {
    if (!task) return false;
    if (task.planning && Boolean(task.planning[currentWeekKey])) return true;
    if (String(task.semaine_cible || '').trim().toUpperCase() === currentWeekKey.toUpperCase()) {
      return true;
    }
    return false;
  };

  const overdueTasks = myPreventiveTasks.filter((t) => t?.etat === 'En retard');
  const needsClarificationPreventive = myPreventiveTasks.filter(
    (t) =>
      t?.etat === 'À clarifier' ||
      t?.validation_status === 'NEEDS_CLARIFICATION' ||
      t?.validation_status === 'REJECTED'
  );
  const pendingValidationPreventive = myPreventiveTasks.filter(
    (t) => t?.etat === 'En attente validation' || t?.validation_status === 'PENDING_VALIDATION'
  );
  const thisWeekTasks = myPreventiveTasks.filter(
    (t) => t?.etat !== 'Fait' && isScheduledThisWeek(t)
  );
  const todoTasks = myPreventiveTasks.filter((t) => t?.etat === 'À faire');
  const doneTasks = myPreventiveTasks.filter((t) => t?.etat === 'Fait');

  const priorityTasks = [...myPreventiveTasks].sort((a, b) => {
    const rank = (t: any) => {
      if (t?.etat === 'À clarifier' || t?.validation_status === 'NEEDS_CLARIFICATION') return -1;
      if (t?.etat === 'En retard') return 0;
      if (t?.etat !== 'Fait' && isScheduledThisWeek(t)) return 1;
      if (t?.etat === 'À faire') return 2;
      return 3;
    };
    return rank(a) - rank(b);
  });

  const myCorrectiveInterventions = isTechUser
    ? (correctiveInterventions || []).filter((i) => matchesTechnicianRecord(i, user, technicians))
    : correctiveInterventions || [];

  const openCorrective = myCorrectiveInterventions.filter((i) => i?.statut !== 'CLOTURE');
  const liveCorrective = myCorrectiveInterventions.filter((i) => i?.statut === 'EN_COURS');
  const plannedBtCorrective = myCorrectiveInterventions.filter(
    (i) => i?.statut === 'BT_PLANIFIE' || i?.statut === 'EN_ATTENTE_PDR'
  );
  const pendingValidationCorrective = myCorrectiveInterventions.filter(
    (i) => i?.statut !== 'CLOTURE' && i?.validation_status === 'PENDING_VALIDATION'
  );
  const needsClarificationCorrective = myCorrectiveInterventions.filter(
    (i) =>
      i?.statut !== 'CLOTURE' &&
      (i?.validation_status === 'NEEDS_CLARIFICATION' || i?.validation_status === 'REJECTED')
  );
  const closedCorrective = myCorrectiveInterventions.filter((i) => i?.statut === 'CLOTURE');

  const myPreventiveExecutions = isTechUser
    ? (preventiveExecutions || []).filter((ex) => matchesTechnicianRecord(ex, user, technicians))
    : preventiveExecutions || [];

  const myMouvements = isTechUser
    ? (mouvements || []).filter((m) => matchesTechnicianRecord(m, user, technicians))
    : mouvements || [];

  const totalMySortiePieces = myMouvements.reduce((acc, m) => {
    const isSortie = String(m?.type || '').toLowerCase().includes('sort');
    return isSortie ? acc + (Number(m?.quantite) || 0) : acc;
  }, 0);

  return {
    isTechUser,
    badgeLabel,
    displayName,
    currentWeekKey,
    myPreventiveTasks,
    overdueTasks,
    needsClarificationPreventive,
    pendingValidationPreventive,
    thisWeekTasks,
    todoTasks,
    doneTasks,
    priorityTasks,
    myCorrectiveInterventions,
    openCorrective,
    liveCorrective,
    plannedBtCorrective,
    pendingValidationCorrective,
    needsClarificationCorrective,
    closedCorrective,
    myPreventiveExecutions,
    myMouvements,
    totalMySortiePieces,
  };
}

