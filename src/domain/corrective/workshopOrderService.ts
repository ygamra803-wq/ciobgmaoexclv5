/**
 * @module workshopOrderService
 * @description
 * Domain service and Finite State Machine (FSM) for Internal Mechanical Workshop Orders
 * (`COR-ATELIER-P0`: Bon de Réalisation `BR` & Bon de Rectification `RECT` issued by
 * Section Maintenance `SM` to `Atelier Fabrication Mécanique`).
 *
 * ### Architectural Invariants:
 * 1. **Zero Stock Mutation:** Workshop orders represent internal manufacturing/machining tasks;
 *    they **never** deduct `stockActuel` or traverse `IncrementalStockIndex` / `StockCalculationService`.
 * 2. **Strict Separation from External Subcontracting:** Internal machining (`gmao_workshop_orders_v1`)
 *    is strictly separate from external vendor subcontracting (`SortieExterne` / bobinage).
 * 3. **Parent Work Order Coupling:** A workshop order optionally links to a corrective `BT` (`id_bt`)
 *    or `DI` (`id_di`). While the workshop order is in an active state (`EMIS`, `EN_COURS_FABRICATION`,
 *    `PRET_LIVRAISON`), closing the linked parent `BT` is blocked by `WorkOrderStateMachine`.
 */

import { safeId } from '../../utils/safeId';

/**
 * Nature of the internal mechanical workshop request:
 * - `'REALISATION'`: Manufacturing/fabricating a new part (`BR-YYYY-NNN`).
 * - `'RECTIFICATION'`: Machining, turning, grinding, or modifying an existing part (`RECT-YYYY-NNN`).
 */
export type WorkshopOrderType = 'REALISATION' | 'RECTIFICATION';

/**
 * Canonical 5-state lifecycle of an Internal Mechanical Workshop Order (`Bon d'Atelier`).
 * - `'EMIS'`: Issued by Section Maintenance (`SM`), awaiting workshop intake.
 * - `'EN_COURS_FABRICATION'`: Machining/fabrication actively underway in the mechanical workshop.
 * - `'PRET_LIVRAISON'`: Part finished and inspected, ready for handover to Maintenance (`SM`).
 * - `'RECEPTIONNE_MONTAGE'`: Terminal state — received and mounted on the target machine.
 * - `'ANNULE'`: Terminal state — request cancelled.
 */
export type WorkshopOrderStatus =
  | 'EMIS'
  | 'EN_COURS_FABRICATION'
  | 'PRET_LIVRAISON'
  | 'RECEPTIONNE_MONTAGE'
  | 'ANNULE';

/**
 * Granular machining/workshop operation item inside a {@link IWorkshopOrder}.
 */
export interface IWorkshopTaskItem {
  id: string;
  libelle: string;
  statut?: string;
}

/**
 * Canonical SSOT entity for Internal Mechanical Workshop Orders
 * (`Bon de Réalisation / Rectification` — `Section Maintenance -> Atelier Fabrication Mécanique`),
 * persisted under `STORAGE_KEYS.WORKSHOP_ORDERS` (`gmao_workshop_orders_v1`).
 * Strictly distinct from stock movements (`IncrementalStockIndex`) and external subcontracting (`SortieExterne`).
 */
export interface IWorkshopOrder {
  id: string;
  code_bon: string;
  type_demande: WorkshopOrderType;
  statut: WorkshopOrderStatus;
  id_machine: string;
  id_bt?: string | null;
  id_di?: string | null;
  id_part?: string | null;
  id_composant?: string | null;
  quantite: number;
  description_travaux: string;
  emetteur_section: string;
  emetteur_user_id?: string;
  emetteur_name?: string;
  destinataire: string;
  date_emission: string;
  date_statut?: string;
  observation?: string;
  taches_atelier?: IWorkshopTaskItem[];
}

export type BonAtelierMecanique = IWorkshopOrder;

/**
 * Validation result returned by {@link validateWorkshopOrderTransition}.
 */
export interface WorkshopTransitionValidation {
  valid: boolean;
  fromStatus: WorkshopOrderStatus;
  toStatus: WorkshopOrderStatus;
  normalizedTarget?: WorkshopOrderStatus;
  reason?: string;
}

/**
 * Directed transition matrix for {@link WorkshopOrderStatus}.
 */
const ALLOWED_WORKSHOP_TRANSITIONS: Record<
  WorkshopOrderStatus,
  ReadonlyArray<WorkshopOrderStatus>
> = {
  EMIS: ['EN_COURS_FABRICATION', 'ANNULE'],
  EN_COURS_FABRICATION: ['PRET_LIVRAISON', 'ANNULE'],
  PRET_LIVRAISON: ['RECEPTIONNE_MONTAGE', 'ANNULE'],
  RECEPTIONNE_MONTAGE: [],
  ANNULE: [],
};

/**
 * Human-readable French UI labels for each {@link WorkshopOrderStatus}.
 */
export const WORKSHOP_STATUS_LABELS: Record<WorkshopOrderStatus, string> = {
  EMIS: 'Émis (Attente Atelier)',
  EN_COURS_FABRICATION: 'En cours fabrication / usinage',
  PRET_LIVRAISON: 'Prêt livraison SM',
  RECEPTIONNE_MONTAGE: 'Réceptionné & Monté',
  ANNULE: 'Annulé',
};

/**
 * Human-readable French UI labels for each {@link WorkshopOrderType}.
 */
export const WORKSHOP_TYPE_LABELS: Record<WorkshopOrderType, string> = {
  REALISATION: 'Réalisation (BR)',
  RECTIFICATION: 'Rectification (RECT)',
};

/**
 * Normalizes an arbitrary input into a canonical {@link WorkshopOrderType}.
 * Recognizes `'RECTIFICATION'` and `'RECT'` (case-insensitive); defaults to `'REALISATION'`.
 *
 * @param raw - Raw request type value.
 * @returns Canonical {@link WorkshopOrderType} (`'REALISATION'` | `'RECTIFICATION'`).
 */
export function normalizeWorkshopOrderType(raw?: unknown): WorkshopOrderType {
  const clean = String(raw || '').trim().toUpperCase();
  if (clean === 'RECTIFICATION' || clean === 'RECT') return 'RECTIFICATION';
  return 'REALISATION';
}

/**
 * Normalizes an arbitrary input into a canonical {@link WorkshopOrderStatus}.
 * Unrecognized or empty values default safely to `'EMIS'`.
 *
 * @param raw - Raw status value.
 * @returns Canonical {@link WorkshopOrderStatus}.
 */
export function normalizeWorkshopOrderStatus(raw?: unknown): WorkshopOrderStatus {
  const clean = String(raw || '').trim().toUpperCase();
  if (
    clean === 'EMIS' ||
    clean === 'EN_COURS_FABRICATION' ||
    clean === 'PRET_LIVRAISON' ||
    clean === 'RECEPTIONNE_MONTAGE' ||
    clean === 'ANNULE'
  ) {
    return clean;
  }
  return 'EMIS';
}

/**
 * Single guarded FSM transition validator for {@link IWorkshopOrder} (`COR-ATELIER-P0`).
 *
 * ### Allowed Transitions:
 * - `EMIS` -> `EN_COURS_FABRICATION` | `ANNULE`
 * - `EN_COURS_FABRICATION` -> `PRET_LIVRAISON` | `ANNULE`
 * - `PRET_LIVRAISON` -> `RECEPTIONNE_MONTAGE` | `ANNULE`
 * - `RECEPTIONNE_MONTAGE` -> *(terminal)*
 * - `ANNULE` -> *(terminal)*
 *
 * @param currentRaw - Current status of the workshop order.
 * @param targetRaw - Requested target status.
 * @returns {@link WorkshopTransitionValidation} indicating validity and rejection reason if invalid.
 */
export function validateWorkshopOrderTransition(
  currentRaw: unknown,
  targetRaw: unknown
): WorkshopTransitionValidation {
  const fromStatus = normalizeWorkshopOrderStatus(currentRaw);
  const toStatus = normalizeWorkshopOrderStatus(targetRaw);

  if (fromStatus === 'RECEPTIONNE_MONTAGE' || fromStatus === 'ANNULE') {
    return {
      valid: false,
      fromStatus,
      toStatus,
      reason: `Transition non autorisée : le bon d'atelier est dans un état final (${fromStatus}).`,
    };
  }

  const allowed = ALLOWED_WORKSHOP_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      fromStatus,
      toStatus,
      reason: `Transition non autorisée : ${fromStatus} -> ${toStatus}. Attendu : ${allowed.join(' ou ')}.`,
    };
  }

  return {
    valid: true,
    fromStatus,
    toStatus,
    normalizedTarget: toStatus,
  };
}

/**
 * Returns the list of legal next statuses reachable from `currentRaw`.
 *
 * @param currentRaw - Current status string or value.
 * @returns Readonly array of allowed next {@link WorkshopOrderStatus} states.
 */
export function getAllowedNextWorkshopStatuses(
  currentRaw: unknown
): ReadonlyArray<WorkshopOrderStatus> {
  const status = normalizeWorkshopOrderStatus(currentRaw);
  return ALLOWED_WORKSHOP_TRANSITIONS[status] || [];
}

/**
 * Determines whether a workshop order (or raw status) is still active/in-progress
 * (`EMIS`, `EN_COURS_FABRICATION`, or `PRET_LIVRAISON`).
 * Active workshop orders block parent `BT` closure in {@link WorkOrderStateMachine}.
 *
 * @param orderOrStatus - Either an {@link IWorkshopOrder} object or a raw status string.
 * @returns `true` if the order has not yet reached `RECEPTIONNE_MONTAGE` or `ANNULE`.
 */
export function isWorkshopOrderActive(orderOrStatus: unknown): boolean {
  const status =
    orderOrStatus && typeof orderOrStatus === 'object'
      ? normalizeWorkshopOrderStatus((orderOrStatus as any).statut)
      : normalizeWorkshopOrderStatus(orderOrStatus);
  return (
    status === 'EMIS' ||
    status === 'EN_COURS_FABRICATION' ||
    status === 'PRET_LIVRAISON'
  );
}

/**
 * Generates a sequential, human-readable workshop order code scoped by type and year.
 * Format: `BR-YYYY-NNN` for `REALISATION` or `RECT-YYYY-NNN` for `RECTIFICATION`.
 *
 * @param typeDemande - `'REALISATION'` or `'RECTIFICATION'`.
 * @param existingOrders - Existing workshop orders used to compute the next sequence number.
 * @param year - Four-digit calendar year (defaults to current year).
 * @returns Formatted code such as `'BR-2026-001'` or `'RECT-2026-004'`.
 */
export function generateWorkshopOrderCode(
  typeDemande: WorkshopOrderType,
  existingOrders: ReadonlyArray<Partial<IWorkshopOrder>> = [],
  year: number = new Date().getFullYear()
): string {
  const prefix = typeDemande === 'RECTIFICATION' ? 'RECT' : 'BR';
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`, 'i');
  let maxSeq = 0;

  for (const ord of existingOrders || []) {
    const code = String(ord?.code_bon || '').trim();
    const match = code.match(pattern);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `${prefix}-${year}-${nextSeq}`;
}

/**
 * Factory function that validates and constructs a canonical {@link IWorkshopOrder} record
 * in initial state `'EMIS'`.
 *
 * @param payload - Partial workshop order fields (`id_machine` or `code_machine` and `description_travaux` are mandatory).
 * @param existingOrders - Existing collection used to generate a collision-free `code_bon`.
 * @returns Newly constructed {@link IWorkshopOrder} ready for persistence via `DataGateway.saveWorkshopOrders`.
 * @throws {Error} When `id_machine`/`code_machine` or `description_travaux` is missing/blank.
 */
export function createWorkshopOrderRecord(
  payload: Partial<IWorkshopOrder> & {
    id_machine?: string;
    code_machine?: string;
    description_travaux?: string;
  },
  existingOrders: ReadonlyArray<IWorkshopOrder> = []
): IWorkshopOrder {
  const idMachine = String(payload?.id_machine || payload?.code_machine || '').trim();
  if (!idMachine) {
    throw new Error('Machine obligatoire pour créer un Bon d’Atelier Mécanique.');
  }

  const descriptionTravaux = String(payload?.description_travaux || '').trim();
  if (!descriptionTravaux) {
    throw new Error('Description des travaux obligatoire pour créer un Bon d’Atelier Mécanique.');
  }

  const typeDemande = normalizeWorkshopOrderType(payload?.type_demande);
  const nowIso = new Date().toISOString();
  const dateEmission = String(payload?.date_emission || nowIso).trim() || nowIso;
  const year = new Date(dateEmission).getFullYear() || new Date().getFullYear();

  const codeBon =
    String(payload?.code_bon || '').trim() ||
    generateWorkshopOrderCode(typeDemande, existingOrders, year);

  return {
    id: String(payload?.id || '').trim() || safeId('BR'),
    code_bon: codeBon,
    type_demande: typeDemande,
    statut: 'EMIS',
    id_machine: idMachine,
    id_bt: payload?.id_bt ? String(payload.id_bt).trim() : null,
    id_di: payload?.id_di ? String(payload.id_di).trim() : null,
    id_part: payload?.id_part ? String(payload.id_part).trim() : null,
    id_composant: payload?.id_composant ? String(payload.id_composant).trim() : null,
    quantite: Math.max(1, Math.round(Number(payload?.quantite) || 1)),
    description_travaux: descriptionTravaux,
    emetteur_section: String(payload?.emetteur_section || 'SM').trim() || 'SM',
    emetteur_user_id: payload?.emetteur_user_id ? String(payload.emetteur_user_id).trim() : undefined,
    emetteur_name: payload?.emetteur_name ? String(payload.emetteur_name).trim() : undefined,
    destinataire:
      String(payload?.destinataire || 'Atelier Fabrication Mécanique').trim() ||
      'Atelier Fabrication Mécanique',
    date_emission: dateEmission,
    date_statut: nowIso,
    observation: payload?.observation ? String(payload.observation).trim() : '',
    taches_atelier: Array.isArray(payload?.taches_atelier) ? payload.taches_atelier : [],
  };
}

/**
 * Retrieves all {@link IWorkshopOrder} records linked to a specific corrective intervention
 * (`DI` or `BT`) by matching `id_bt` or `id_di` against `intervention.id` or `intervention.num_bt` (case-insensitive).
 *
 * @param intervention - Corrective intervention (`ICorrectiveIntervention`) to inspect.
 * @param workshopOrders - Full collection of workshop orders from store state.
 * @returns Array of matching {@link IWorkshopOrder} records.
 */
export function getLinkedWorkshopOrdersForIntervention(
  intervention: Record<string, any> | null | undefined,
  workshopOrders: ReadonlyArray<IWorkshopOrder> = []
): IWorkshopOrder[] {
  if (!intervention || !Array.isArray(workshopOrders) || workshopOrders.length === 0) {
    return [];
  }
  const intId = String(intervention.id || '').trim().toUpperCase();
  const numBt = String(intervention.num_bt || '').trim().toUpperCase();
  if (!intId && !numBt) return [];

  return workshopOrders.filter((ord) => {
    if (!ord) return false;
    const ordBt = String(ord.id_bt || '').trim().toUpperCase();
    const ordDi = String(ord.id_di || '').trim().toUpperCase();
    if (ordBt && (ordBt === intId || (numBt && ordBt === numBt))) return true;
    if (ordDi && (ordDi === intId || (numBt && ordDi === numBt))) return true;
    return false;
  });
}

