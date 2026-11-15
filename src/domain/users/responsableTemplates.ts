export const RESPONSABLE_TEMPLATES = [
  {
    id: 'RMT',
    label: 'Responsable Maintenance',
    badge: 'RMT',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    badgeDarkClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-500',
    cardBorder: 'border-rose-300 bg-rose-50/50',
    description: 'Supervision globale maintenance & fiabilité',
    defaultZones: ['ALL'],
  },
  {
    id: 'RZN',
    label: 'Responsable Zone',
    badge: 'RZN',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    badgeDarkClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-500',
    cardBorder: 'border-blue-300 bg-blue-50/50',
    description: 'Gestion & coordination technique de zone spécifique',
    defaultZones: [],
  },
  {
    id: 'RPD',
    label: 'Responsable Production',
    badge: 'RPD',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    badgeDarkClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
    cardBorder: 'border-emerald-300 bg-emerald-50/50',
    description: 'Coordination production & arrêts programmés',
    defaultZones: [],
  },
  {
    id: 'RMG',
    label: 'Responsable Magasin',
    badge: 'RMG',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    badgeDarkClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-500',
    cardBorder: 'border-amber-300 bg-amber-50/50',
    description: 'Gestion stock, réapprovisionnement & PDR',
    defaultZones: ['ALL'],
  },
];

export const getTemplateById = (templateId) => {
  return RESPONSABLE_TEMPLATES.find((t) => t.id === templateId) || RESPONSABLE_TEMPLATES[0];
};

/**
 * Normalizes any template input (array, comma-separated string, single string) into a clean array of valid template IDs.
 */
export const normalizeTemplateIds = (input) => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((t) => (typeof t === 'string' ? t.trim() : t?.id)).filter(Boolean);
  }
  if (typeof input === 'string') {
    return input
      .split(',')
      .map((s) => s.trim())
      .filter((s) => RESPONSABLE_TEMPLATES.some((t) => t.id === s));
  }
  if (input && typeof input === 'object' && input.id) {
    return [input.id];
  }
  return [];
};

/**
 * Returns template objects matching the provided list of template IDs.
 */
export const getTemplatesByIds = (templateIds) => {
  const ids = normalizeTemplateIds(templateIds);
  if (ids.length === 0) return [];
  return ids
    .map((id) => RESPONSABLE_TEMPLATES.find((t) => t.id === id))
    .filter(Boolean);
};

/**
 * Resolves all active templates for a given user or operation object.
 */
export const getTemplatesForUser = (user) => {
  if (!user) return [];
  const rawIds = user.templates || user.template_ids || user.template_id;
  let ids = normalizeTemplateIds(rawIds);

  if (ids.length === 0 && (user.type === 'RESPONSABLE' || user.type_profil === 'RESPONSABLE' || user.type_profil === 'CHEF' || String(user.id_operation || user.id).startsWith('RESP'))) {
    const nomLower = String(user.nom || '').toLowerCase();
    if (nomLower.includes('magasin')) ids = ['RMG'];
    else if (nomLower.includes('maintenance') || nomLower.includes('centrale')) ids = ['RMT'];
    else if (nomLower.includes('production') || nomLower.includes('équipe')) ids = ['RPD'];
    else ids = ['RZN'];
  }

  return ids.map((id) => RESPONSABLE_TEMPLATES.find((t) => t.id === id)).filter(Boolean);
};

/**
 * Formats multi-template labels as a readable string (e.g. "Responsable Maintenance, Responsable Zone")
 */
export const formatTemplateLabels = (templateIds) => {
  const tpls = getTemplatesByIds(templateIds);
  return tpls.map((t) => t.label).join(', ');
};

