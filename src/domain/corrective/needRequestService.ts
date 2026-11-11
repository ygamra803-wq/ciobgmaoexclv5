/**
 * Need Request & Field Handoff Domain Service (`COR-HANDOFF-P0`)
 *
 * Models the multi-actor operational handoff chain above Corrective Maintenance (`BT`)
 * and the Internal Mechanical Workshop (`COR-ATELIER-P0`):
 *
 *   DEMANDE_TECH (Technician declares operational need without choosing final supply channel)
 *     ➔ REVUE_SUPERVISEUR (Supervisor/Admin reviews & arbitrates `canal_appro`)
 *     ➔ APPROVISIONNEMENT (`STOCK` | `ACHAT` | `ATELIER` | `EXTERNE`)
 *     ➔ RECU_STRUCTURE (Received by Maintenance / Store / Workshop ready)
 *     ➔ REMIS_TECHNICIEN (Physically handed off to the field technician)
 *     ➔ POSE_ESSAI (Field technician mounts part & runs machine test)
 *     ➔ CLOTURE_FIELD (Field test confirmed OK — unblocks parent `BT` administrative closure)
 *
 * Core Invariants:
 *  1. Single Source of Truth persisted under `STORAGE_KEYS.NEED_REQUESTS` (`gmao_need_requests_v1`).
 *  2. Technicians NEVER set the final `canal_appro` on creation (`canal_appro` starts as `null`).
 *  3. Standard catalog spare parts (`material_class === 'PDR'`) suggest `['STOCK', 'ACHAT']`
 *     and NEVER suggest `'ATELIER'` by default.
 *  4. When `canal_appro === 'ATELIER'`, transitioning `APPROVISIONNEMENT ➔ RECU_STRUCTURE`
 *     is strictly blocked while the linked `IWorkshopOrder` is still active (`EMIS`,
 *     `EN_COURS_FABRICATION`, `PRET_LIVRAISON`).
 *  5. Parent `BT` cannot transition to `CLOTURE` (`handleClotureIntervention`) while any
 *     linked `NeedRequest` with `requires_material !== false` has not reached a terminal
 *     state (`CLOTURE_FIELD`, `REJETE`, `ANNULE`), unless the supervisor explicitly marks
 *     the intervention or request as `requires_material: false` (`sans_materiel: true`).
 *  6. Zero direct stock mutation (`rawStock` / `IncrementalStockIndex` untouched).
 */

import { isWorkshopOrderActive, type IWorkshopOrder } from './workshopOrderService';

export type NeedMaterialClass = 'PDR' | 'PART' | 'COMPONENT' | 'OTHER';

export type NeedApproChannel = 'STOCK' | 'ACHAT' | 'ATELIER' | 'EXTERNE';

export type NeedRequestStatus =
  | 'DEMANDE_TECH'
  | 'REVUE_SUPERVISEUR'
  | 'APPROVISIONNEMENT'
  | 'RECU_STRUCTURE'
  | 'REMIS_TECHNICIEN'
  | 'POSE_ESSAI'
  | 'CLOTURE_FIELD'
  | 'REJETE'
  | 'ANNULE'
  | 'CLARIFICATION';

export interface INeedRequest {
  id: string;
  code_demande: string; // e.g., ND-2026-001
  id_bt?: string | null;
  id_di?: string | null;
  id_machine: string;
  id_technicien_demandeur: string;
  nom_technicien_demandeur: string;
  material_class: NeedMaterialClass;
  id_ref_pdr?: string | null;
  designation_pdr?: string | null;
  id_part?: string | null;
  nom_part?: string | null;
  id_composant?: string | null;
  nom_composant?: string | null;
  quantite: number;
  description_besoin: string;
  statut: NeedRequestStatus;
  canal_appro?: NeedApproChannel | null;
  id_workshop_order?: string | null;
  code_workshop_order?: string | null;
  id_sortie_demand?: string | null;
  notes_superviseur?: string;
  motif_rejet?: string;
  observation_pose_essai?: string;
  requires_material: boolean;
  policy_tags_snapshot?: string[];
  date_creation: string;
  date_statut: string;
  timestamps?: Partial<Record<NeedRequestStatus, string>>;
}

export const NEED_MATERIAL_CLASS_LABELS: Record<NeedMaterialClass, string> = {
  PDR: 'Pièce de Rechange Standard (PDR Catalogue)',
  PART: 'Pièce Mécanique / Structurelle (Part)',
  COMPONENT: 'Organe / Composant Complet',
  OTHER: 'Autre Besoin / Consommable Spécifique',
};

export const NEED_APPRO_CHANNEL_LABELS: Record<NeedApproChannel, string> = {
  STOCK: 'Magasin PDR (Stock Interne)',
  ACHAT: 'Achat / Approvisionnement Fournisseur',
  ATELIER: 'Atelier Fabrication Mécanique (BR / RECT)',
  EXTERNE: 'Sous-Traitance / Réparation Externe',
};

export const NEED_STATUS_LABELS: Record<NeedRequestStatus, string> = {
  DEMANDE_TECH: 'Demande Technicien',
  REVUE_SUPERVISEUR: 'En Revue Superviseur',
  APPROVISIONNEMENT: 'En Approvisionnement / Atelier',
  RECU_STRUCTURE: 'Reçu Structure / Prêt',
  REMIS_TECHNICIEN: 'Remis au Technicien',
  POSE_ESSAI: 'Pose & Essai Machine',
  CLOTURE_FIELD: 'Essai Validé (Clôturé Terrain)',
  CLARIFICATION: 'Clarification Demandée',
  REJETE: 'Rejeté',
  ANNULE: 'Annulé',
};

export const VALID_NEED_STATUSES: ReadonlyArray<NeedRequestStatus> = [
  'DEMANDE_TECH',
  'REVUE_SUPERVISEUR',
  'APPROVISIONNEMENT',
  'RECU_STRUCTURE',
  'REMIS_TECHNICIEN',
  'POSE_ESSAI',
  'CLOTURE_FIELD',
  'REJETE',
  'ANNULE',
  'CLARIFICATION',
];

export const TERMINAL_NEED_STATUSES: ReadonlyArray<NeedRequestStatus> = [
  'CLOTURE_FIELD',
  'REJETE',
  'ANNULE',
];

/**
 * Guarded transition graph for `INeedRequest`.
 * Note: Supervisors reviewing a fresh `DEMANDE_TECH` can either step into `REVUE_SUPERVISEUR`
 * or directly arbitrate into `APPROVISIONNEMENT` / `CLARIFICATION` / `REJETE` / `ANNULE`
 * (which records the supervisor review decision atomically).
 */
const ALLOWED_NEED_TRANSITIONS: Record<NeedRequestStatus, ReadonlyArray<NeedRequestStatus>> = {
  DEMANDE_TECH: [
    'REVUE_SUPERVISEUR',
    'APPROVISIONNEMENT',
    'CLARIFICATION',
    'REJETE',
    'ANNULE',
  ],
  REVUE_SUPERVISEUR: ['APPROVISIONNEMENT', 'CLARIFICATION', 'REJETE', 'ANNULE'],
  CLARIFICATION: ['DEMANDE_TECH', 'REVUE_SUPERVISEUR', 'ANNULE'],
  APPROVISIONNEMENT: ['RECU_STRUCTURE', 'ANNULE'],
  RECU_STRUCTURE: ['REMIS_TECHNICIEN', 'ANNULE'],
  REMIS_TECHNICIEN: ['POSE_ESSAI', 'ANNULE'],
  POSE_ESSAI: ['CLOTURE_FIELD', 'CLARIFICATION', 'DEMANDE_TECH'],
  CLOTURE_FIELD: [],
  REJETE: [],
  ANNULE: [],
};

/**
 * Returns true if the given status is terminal (`CLOTURE_FIELD`, `REJETE`, `ANNULE`).
 */
export function isNeedRequestTerminal(status: unknown): boolean {
  const norm = String(status || '').trim().toUpperCase() as NeedRequestStatus;
  return TERMINAL_NEED_STATUSES.includes(norm);
}

/**
 * Returns true if a `NeedRequest` is still active (non-terminal).
 */
export function isNeedRequestActive(status: unknown): boolean {
  const norm = String(status || '').trim().toUpperCase() as NeedRequestStatus;
  return VALID_NEED_STATUSES.includes(norm) && !TERMINAL_NEED_STATUSES.includes(norm);
}

/**
 * Suggests valid supply channels (`NeedApproChannel[]`) based on `material_class`:
 *  - `PDR`: Standard catalog spare parts are bought/stocked (`['STOCK', 'ACHAT']`) — NEVER `'ATELIER'` by default.
 *  - `PART`: Mechanical/structural parts can be stocked, bought, or machined (`['STOCK', 'ACHAT', 'ATELIER']`).
 *  - `COMPONENT`: Complete assemblies (`['ACHAT', 'EXTERNE', 'ATELIER']`).
 *  - `OTHER`: All channels (`['STOCK', 'ACHAT', 'ATELIER', 'EXTERNE']`).
 */
export function getSuggestedChannelsForMaterialClass(
  materialClass: unknown
): ReadonlyArray<NeedApproChannel> {
  const norm = String(materialClass || 'PDR').trim().toUpperCase() as NeedMaterialClass;
  switch (norm) {
    case 'PDR':
      return ['STOCK', 'ACHAT'];
    case 'PART':
      return ['STOCK', 'ACHAT', 'ATELIER'];
    case 'COMPONENT':
      return ['ACHAT', 'EXTERNE', 'ATELIER'];
    case 'OTHER':
    default:
      return ['STOCK', 'ACHAT', 'ATELIER', 'EXTERNE'];
  }
}

export interface NeedTransitionContext {
  actorRole?: string;
  isTechnician?: boolean;
  canal_appro?: NeedApproChannel | null;
  existingCanalAppro?: NeedApproChannel | null;
  linkedWorkshopOrder?: IWorkshopOrder | null;
  hasOpenWorkshopOrder?: boolean;
  motif_rejet?: string;
  notes_superviseur?: string;
  observation_pose_essai?: string;
}

/**
 * Validates a state transition on a `NeedRequest` according to the guarded FSM,
 * role separation, channel requirement, and `COR-ATELIER` workshop synchronization.
 */
export function validateNeedRequestTransition(
  fromRaw: unknown,
  toRaw: unknown,
  context: NeedTransitionContext = {}
): { valid: boolean; reason?: string } {
  const from = String(fromRaw || 'DEMANDE_TECH').trim().toUpperCase() as NeedRequestStatus;
  const to = String(toRaw || '').trim().toUpperCase() as NeedRequestStatus;

  if (!VALID_NEED_STATUSES.includes(from)) {
    return {
      valid: false,
      reason: `Statut initial de demande de besoin invalide : '${String(fromRaw)}'.`,
    };
  }
  if (!VALID_NEED_STATUSES.includes(to)) {
    return {
      valid: false,
      reason: `Statut cible de demande de besoin invalide : '${String(toRaw)}'.`,
    };
  }

  if (from === to) {
    return { valid: true };
  }

  if (isNeedRequestTerminal(from)) {
    return {
      valid: false,
      reason: `Transition refusée : la demande de besoin est déjà dans un état terminal (${from}).`,
    };
  }

  const allowedTargets = ALLOWED_NEED_TRANSITIONS[from] || [];
  if (!allowedTargets.includes(to)) {
    return {
      valid: false,
      reason: `Transition illégale de demande de besoin : ${from} ➔ ${to}. Transitions autorisées depuis ${from} : [${
        allowedTargets.join(', ') || 'aucune'
      }].`,
    };
  }

  const roleNorm = String(context.actorRole || '').trim().toUpperCase();
  const isTech =
    context.isTechnician === true ||
    roleNorm === 'TECHNICIEN' ||
    roleNorm === 'OPERATEUR';

  // Supervisor-only transitions: REVUE_SUPERVISEUR, APPROVISIONNEMENT, RECU_STRUCTURE, REMIS_TECHNICIEN, REJETE
  const supervisorOnlyTargets: ReadonlyArray<NeedRequestStatus> = [
    'REVUE_SUPERVISEUR',
    'APPROVISIONNEMENT',
    'RECU_STRUCTURE',
    'REMIS_TECHNICIEN',
    'REJETE',
  ];
  if (isTech && supervisorOnlyTargets.includes(to)) {
    return {
      valid: false,
      reason: `Sécurité RBAC : un profil Technicien ne peut pas effectuer la transition administrative vers ${to}.`,
    };
  }

  // Guard 1: Entering APPROVISIONNEMENT requires a valid canal_appro
  const effectiveCanal = (context.canal_appro ?? context.existingCanalAppro ?? null) as
    | NeedApproChannel
    | null;
  if (to === 'APPROVISIONNEMENT') {
    const validChannels: ReadonlyArray<NeedApproChannel> = [
      'STOCK',
      'ACHAT',
      'ATELIER',
      'EXTERNE',
    ];
    if (!effectiveCanal || !validChannels.includes(effectiveCanal)) {
      return {
        valid: false,
        reason:
          "Passage en APPROVISIONNEMENT refusé : le responsable doit obligatoirement définir le canal d'approvisionnement (STOCK, ACHAT, ATELIER ou EXTERNE).",
      };
    }
  }

  // Guard 2: Entering RECU_STRUCTURE when canal_appro === 'ATELIER' requires the workshop order to be completed (RECEPTIONNE_MONTAGE)
  if (to === 'RECU_STRUCTURE' && effectiveCanal === 'ATELIER') {
    const workshopStillOpen =
      context.hasOpenWorkshopOrder === true ||
      (context.linkedWorkshopOrder != null &&
        isWorkshopOrderActive(context.linkedWorkshopOrder.statut));
    if (workshopStillOpen) {
      const codeInfo = context.linkedWorkshopOrder?.code_bon
        ? ` (${context.linkedWorkshopOrder.code_bon} : ${context.linkedWorkshopOrder.statut})`
        : '';
      return {
        valid: false,
        reason: `Réception structure refusée : le Bon d'Atelier Mécanique lié${codeInfo} est encore actif. L'atelier doit d'abord terminer et réceptionner la pièce (RECEPTIONNE_MONTAGE).`,
      };
    }
  }

  // Guard 3: REJETE requires a rejection reason if provided in strict mode
  if (to === 'REJETE' && context.motif_rejet !== undefined && !String(context.motif_rejet).trim()) {
    return {
      valid: false,
      reason: 'Veuillez indiquer le motif du rejet de la demande de besoin.',
    };
  }

  return { valid: true };
}

/**
 * Generates a sequential Need Request code (`ND-YYYY-NNN`).
 */
export function generateNeedRequestCode(
  existingRequests: ReadonlyArray<Partial<INeedRequest>> = [],
  year: number = new Date().getFullYear()
): string {
  const prefix = `ND-${year}-`;
  let maxSeq = 0;

  for (const item of existingRequests) {
    const code = String(item?.code_demande || item?.id || '').trim().toUpperCase();
    if (code.startsWith(prefix)) {
      const numPart = parseInt(code.slice(prefix.length), 10);
      if (!Number.isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export interface CreateNeedRequestInput {
  id?: string;
  code_demande?: string;
  id_bt?: string | null;
  id_di?: string | null;
  id_machine: string;
  id_technicien_demandeur?: string;
  nom_technicien_demandeur?: string;
  material_class?: NeedMaterialClass;
  id_ref_pdr?: string | null;
  designation_pdr?: string | null;
  id_part?: string | null;
  nom_part?: string | null;
  id_composant?: string | null;
  nom_composant?: string | null;
  quantite?: number;
  description_besoin: string;
  requires_material?: boolean;
  policy_tags_snapshot?: string[];
  date_creation?: string;
}

/**
 * Creates a normalized `INeedRequest` record.
 * Strictly enforces that field creation starts in `DEMANDE_TECH` with `canal_appro: null`
 * (the technician never chooses the final supply channel at creation time).
 */
export function createNeedRequestRecord(
  payload: CreateNeedRequestInput,
  existingRequests: ReadonlyArray<Partial<INeedRequest>> = []
): INeedRequest {
  const rawMaterialClass = String(payload.material_class || 'PDR')
    .trim()
    .toUpperCase();
  const validClasses: ReadonlyArray<NeedMaterialClass> = ['PDR', 'PART', 'COMPONENT', 'OTHER'];
  const material_class: NeedMaterialClass = validClasses.includes(
    rawMaterialClass as NeedMaterialClass
  )
    ? (rawMaterialClass as NeedMaterialClass)
    : 'PDR';

  const id_machine = String(payload.id_machine || '').trim();
  if (!id_machine) {
    throw new Error('id_machine est obligatoire pour créer une demande de besoin (NeedRequest).');
  }

  const description_besoin = String(payload.description_besoin || '').trim();
  if (!description_besoin) {
    throw new Error(
      'description_besoin est obligatoire pour créer une demande de besoin (NeedRequest).'
    );
  }

  const nowIso = payload.date_creation || new Date().toISOString();
  const year = new Date(nowIso).getFullYear() || new Date().getFullYear();
  const code_demande =
    payload.code_demande && String(payload.code_demande).trim()
      ? String(payload.code_demande).trim()
      : generateNeedRequestCode(existingRequests, year);

  const quantiteNum = Number(payload.quantite);
  const quantite = Number.isFinite(quantiteNum) && quantiteNum > 0 ? Math.round(quantiteNum) : 1;

  return {
    id: payload.id ? String(payload.id).trim() : code_demande,
    code_demande,
    id_bt: payload.id_bt ? String(payload.id_bt).trim() : null,
    id_di: payload.id_di ? String(payload.id_di).trim() : null,
    id_machine,
    id_technicien_demandeur: String(payload.id_technicien_demandeur || 'TECH').trim(),
    nom_technicien_demandeur: String(payload.nom_technicien_demandeur || 'Technicien').trim(),
    material_class,
    id_ref_pdr: payload.id_ref_pdr ? String(payload.id_ref_pdr).trim() : null,
    designation_pdr: payload.designation_pdr ? String(payload.designation_pdr).trim() : null,
    id_part: payload.id_part ? String(payload.id_part).trim() : null,
    nom_part: payload.nom_part ? String(payload.nom_part).trim() : null,
    id_composant: payload.id_composant ? String(payload.id_composant).trim() : null,
    nom_composant: payload.nom_composant ? String(payload.nom_composant).trim() : null,
    quantite,
    description_besoin,
    statut: 'DEMANDE_TECH',
    // Strictly null on initial creation: only supervisor review sets canal_appro
    canal_appro: null,
    id_workshop_order: null,
    code_workshop_order: null,
    id_sortie_demand: null,
    requires_material: payload.requires_material !== false,
    policy_tags_snapshot: Array.isArray(payload.policy_tags_snapshot)
      ? payload.policy_tags_snapshot
      : [],
    date_creation: nowIso,
    date_statut: nowIso,
    timestamps: {
      DEMANDE_TECH: nowIso,
    },
  };
}

/**
 * Returns all `INeedRequest` records linked to a corrective intervention (`BT` or `DI`).
 */
export function getLinkedNeedRequestsForIntervention(
  intervention: {
    id?: string | number;
    num_bt?: string;
    id_di?: string;
  } | null | undefined,
  needRequests: ReadonlyArray<INeedRequest> = []
): INeedRequest[] {
  if (!intervention || !Array.isArray(needRequests) || needRequests.length === 0) {
    return [];
  }
  const btId = String(intervention.id || '').trim().toUpperCase();
  const numBt = String(intervention.num_bt || '').trim().toUpperCase();
  const diId = String(intervention.id_di || '').trim().toUpperCase();

  return needRequests.filter((req) => {
    if (!req) return false;
    const reqBt = String(req.id_bt || '').trim().toUpperCase();
    const reqDi = String(req.id_di || '').trim().toUpperCase();
    if (reqBt && (reqBt === btId || reqBt === numBt)) return true;
    if (reqDi && diId && reqDi === diId) return true;
    return false;
  });
}

/**
 * Returns true if the given `INeedRequest` blocks the final closure (`CLOTURE`)
 * of its parent `BT`.
 * A `NeedRequest` blocks closure when `requires_material !== false` and its `statut`
 * is not in `['CLOTURE_FIELD', 'REJETE', 'ANNULE']`.
 */
export function isNeedRequestBlockingBtClosure(
  req: Partial<INeedRequest> | null | undefined
): boolean {
  if (!req) return false;
  if (req.requires_material === false) return false;
  return !isNeedRequestTerminal(req.statut);
}

/**
 * Returns true if the intervention has at least one incomplete `NeedRequest`
 * blocking `BT` closure (`CLOTURE`).
 */
export function hasBlockingNeedRequestForIntervention(
  intervention: {
    id?: string | number;
    num_bt?: string;
    id_di?: string;
    requires_material?: boolean;
    sans_materiel?: boolean;
  } | null | undefined,
  needRequests: ReadonlyArray<INeedRequest> = []
): boolean {
  if (!intervention) return false;
  if (intervention.requires_material === false || intervention.sans_materiel === true) {
    return false;
  }
  const linked = getLinkedNeedRequestsForIntervention(intervention, needRequests);
  return linked.some((req) => isNeedRequestBlockingBtClosure(req));
}
