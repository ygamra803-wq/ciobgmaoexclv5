/**
 * @module lotoService
 * @description
 * Industrial Lockout / Tagout (`LOTO` — Permis de Consignation Énergétique) domain service
 * for Corrective Maintenance Work Orders (`BT`).
 *
 * Enforces an explicit finite-state safety lifecycle when `requires_loto === true`:
 *   ATTENTE_CONSIGNATION ➔ CONSIGNE (padlock + energy types + VAT zero-energy test) ➔ DECONSIGNE (padlock removed, safe restart)
 *
 * Security & Safety Invariants:
 * - Work Order execution (`EN_COURS`) is strictly blocked while `requires_loto === true` and status !== `'CONSIGNE'`.
 * - Work Order administrative closure (`CLOTURE`) is strictly blocked while `requires_loto === true` and status !== `'DECONSIGNE'`.
 * - Non-LOTO interventions (`requires_loto !== true`) remain unaffected (`NON_REQUIS`).
 */

export type LotoStatus =
  | 'NON_REQUIS'
  | 'ATTENTE_CONSIGNATION'
  | 'CONSIGNE'
  | 'DECONSIGNE';

export type LotoEnergyType =
  | 'ELECTRIQUE'
  | 'HYDRAULIQUE'
  | 'PNEUMATIQUE'
  | 'MECANIQUE'
  | 'THERMIQUE';

export interface ILotoPermit {
  required: boolean;
  status: LotoStatus;
  energy_types: LotoEnergyType[];
  num_cadenas?: string;
  consignateur_id?: string;
  consignateur_name?: string;
  consigned_at?: string;
  vat_verified?: boolean;
  deconsignateur_id?: string;
  deconsignateur_name?: string;
  deconsigned_at?: string;
  notes?: string;
}

export interface LotoCheckResult {
  valid: boolean;
  status: LotoStatus;
  reason?: string;
}

export const VALID_LOTO_ENERGY_TYPES: ReadonlyArray<LotoEnergyType> = [
  'ELECTRIQUE',
  'HYDRAULIQUE',
  'PNEUMATIQUE',
  'MECANIQUE',
  'THERMIQUE',
];

const LOTO_STATUS_ALIASES: Record<string, LotoStatus> = {
  NON_REQUIS: 'NON_REQUIS',
  NONE: 'NON_REQUIS',
  ATTENTE_CONSIGNATION: 'ATTENTE_CONSIGNATION',
  PENDING: 'ATTENTE_CONSIGNATION',
  EN_ATTENTE: 'ATTENTE_CONSIGNATION',
  CONSIGNE: 'CONSIGNE',
  LOCKED: 'CONSIGNE',
  ISOLATED: 'CONSIGNE',
  DECONSIGNE: 'DECONSIGNE',
  UNLOCKED: 'DECONSIGNE',
  RELEASED: 'DECONSIGNE',
};

/**
 * Structural projection accepted by LOTO precondition guards so both full
 * `CorrectiveInterventionItem` records and partial draft patches validate uniformly.
 */
export interface LotoInterventionLike {
  requires_loto?: boolean | null;
  loto_status?: LotoStatus | string | null;
  loto?: Partial<ILotoPermit> | null;
}

export function normalizeLotoStatus(raw?: unknown, required = false): LotoStatus {
  const key = String(raw || '').trim().toUpperCase();
  if (key && LOTO_STATUS_ALIASES[key]) {
    return LOTO_STATUS_ALIASES[key];
  }
  return required ? 'ATTENTE_CONSIGNATION' : 'NON_REQUIS';
}

export function normalizeEnergyTypes(raw?: unknown): LotoEnergyType[] {
  if (!Array.isArray(raw)) return [];
  const out: LotoEnergyType[] = [];
  for (const item of raw) {
    const clean = String(item || '').trim().toUpperCase() as LotoEnergyType;
    if (VALID_LOTO_ENERGY_TYPES.includes(clean) && !out.includes(clean)) {
      out.push(clean);
    }
  }
  return out;
}

/**
 * Resolves effective LOTO requirement giving precedence to an incoming patch/payload
 * over the persisted intervention state so enabling/disabling LOTO takes effect immediately.
 */
export function isLotoRequired(
  intervention?: LotoInterventionLike | null,
  payload?: LotoInterventionLike | null
): boolean {
  if (payload?.requires_loto !== undefined) {
    return Boolean(payload.requires_loto);
  }
  if (payload?.loto?.required !== undefined) {
    return Boolean(payload.loto.required);
  }
  if (intervention?.requires_loto !== undefined) {
    return Boolean(intervention.requires_loto);
  }
  if (intervention?.loto?.required !== undefined) {
    return Boolean(intervention.loto.required);
  }
  return false;
}

export function resolveEffectiveLotoStatus(
  intervention?: LotoInterventionLike | null,
  payload?: LotoInterventionLike | null
): LotoStatus {
  const required = isLotoRequired(intervention, payload);
  const rawStatus =
    payload?.loto_status ??
    payload?.loto?.status ??
    intervention?.loto_status ??
    intervention?.loto?.status;
  return normalizeLotoStatus(rawStatus, required);
}

/**
 * Verifies LOTO safety precondition before entering `EN_COURS`.
 * If `requires_loto === true`, the equipment MUST be in `'CONSIGNE'` state.
 */
export function canStartWorkWithLoto(
  intervention?: LotoInterventionLike | null,
  payload?: LotoInterventionLike | null
): LotoCheckResult {
  const required = isLotoRequired(intervention, payload);
  const status = resolveEffectiveLotoStatus(intervention, payload);
  if (!required) {
    return { valid: true, status: 'NON_REQUIS' };
  }
  if (status !== 'CONSIGNE') {
    return {
      valid: false,
      status,
      reason:
        status === 'DECONSIGNE'
          ? 'Intervention refusée : le permis LOTO est déjà déconsigné. Reconsignez les énergies avant de reprendre le travail.'
          : 'Intervention refusée : consignation énergétique (LOTO) obligatoire avant le démarrage des travaux (statut requis : CONSIGNE).',
    };
  }
  return { valid: true, status };
}

/**
 * Verifies LOTO safety precondition before closing (`CLOTURE`) a Work Order.
 * If `requires_loto === true`, padlocks must be explicitly removed (`DECONSIGNE`).
 */
export function canCloseWorkOrderWithLoto(
  intervention?: LotoInterventionLike | null,
  payload?: LotoInterventionLike | null
): LotoCheckResult {
  const required = isLotoRequired(intervention, payload);
  const status = resolveEffectiveLotoStatus(intervention, payload);
  if (!required) {
    return { valid: true, status: 'NON_REQUIS' };
  }
  if (status !== 'DECONSIGNE') {
    return {
      valid: false,
      status,
      reason:
        'Clôture refusée : le cadenas/permis de consignation LOTO est encore actif ou non déconsigné. Effectuez la déconsignation avant de clôturer le BT.',
    };
  }
  return { valid: true, status };
}

export interface LotoConsignPayload {
  num_cadenas: string;
  energy_types: LotoEnergyType[];
  vat_verified: boolean;
  consignateur_id?: string;
  consignateur_name?: string;
  notes?: string;
  timestamp?: string;
}

export interface LotoDeconsignPayload {
  deconsignateur_id?: string;
  deconsignateur_name?: string;
  zone_cleared?: boolean;
  notes?: string;
  timestamp?: string;
}

export function validateLotoConsignation(
  currentPermit: Partial<ILotoPermit> | null | undefined,
  payload: Partial<LotoConsignPayload>
): { valid: boolean; reason?: string; permit?: ILotoPermit } {
  const currentStatus = normalizeLotoStatus(currentPermit?.status, true);
  if (currentStatus === 'CONSIGNE') {
    return { valid: false, reason: 'Équipement déjà consigné (CONSIGNE).' };
  }

  const numCadenas = String(payload.num_cadenas || '').trim();
  if (!numCadenas) {
    return { valid: false, reason: 'N° de cadenas LOTO obligatoire pour la consignation.' };
  }

  const energies = normalizeEnergyTypes(payload.energy_types);
  if (energies.length === 0) {
    return { valid: false, reason: 'Sélectionnez au moins un type d’énergie isolée (ELECTRIQUE, HYDRAULIQUE, etc.).' };
  }

  if (payload.vat_verified !== true) {
    return {
      valid: false,
      reason: 'Vérification Absence de Tension / Énergie Zéro (VAT) obligatoire avant consignation.',
    };
  }

  const nowIso = payload.timestamp || new Date().toISOString();
  return {
    valid: true,
    permit: {
      required: true,
      status: 'CONSIGNE',
      energy_types: energies,
      num_cadenas: numCadenas,
      consignateur_id: String(payload.consignateur_id || 'TECH').trim(),
      consignateur_name: String(payload.consignateur_name || 'Intervenant').trim(),
      consigned_at: nowIso,
      vat_verified: true,
      notes: payload.notes ? String(payload.notes).trim() : currentPermit?.notes,
    },
  };
}

export function validateLotoDeconsignation(
  currentPermit: Partial<ILotoPermit> | null | undefined,
  payload: Partial<LotoDeconsignPayload> = {}
): { valid: boolean; reason?: string; permit?: ILotoPermit } {
  const currentStatus = normalizeLotoStatus(currentPermit?.status, Boolean(currentPermit?.required));
  if (currentStatus !== 'CONSIGNE') {
    return {
      valid: false,
      reason: `Déconsignation refusée : le permis doit être au statut CONSIGNE (actuel : ${currentStatus}).`,
    };
  }

  if (payload.zone_cleared === false) {
    return {
      valid: false,
      reason: 'Déconsignation refusée : la zone d’intervention doit être dégagée et sécurisée avant remise en énergie.',
    };
  }

  const nowIso = payload.timestamp || new Date().toISOString();
  return {
    valid: true,
    permit: {
      required: true,
      status: 'DECONSIGNE',
      energy_types: normalizeEnergyTypes(currentPermit?.energy_types),
      num_cadenas: currentPermit?.num_cadenas,
      consignateur_id: currentPermit?.consignateur_id,
      consignateur_name: currentPermit?.consignateur_name,
      consigned_at: currentPermit?.consigned_at,
      vat_verified: currentPermit?.vat_verified,
      deconsignateur_id: String(payload.deconsignateur_id || 'SUP').trim(),
      deconsignateur_name: String(payload.deconsignateur_name || 'Responsable').trim(),
      deconsigned_at: nowIso,
      notes: payload.notes ? String(payload.notes).trim() : currentPermit?.notes,
    },
  };
}
