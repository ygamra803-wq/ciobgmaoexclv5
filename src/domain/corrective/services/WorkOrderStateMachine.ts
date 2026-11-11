/**
 * @module WorkOrderStateMachine
 * @description
 * Deterministic Finite State Machine (FSM) governing the lifecycle of Corrective Maintenance
 * Work Orders (`DI` — Demande d'Intervention & `BT` — Bon de Travail).
 *
 * ### Architectural Invariants (`AGENTS.md` §1.5):
 * 1. **Canonical Lifecycle Graph:**
 *    - `DEMANDE` -> `BT_PLANIFIE` | `EN_COURS` | `ANNULE` (plus guarded emergency direct `CLOTURE` when `num_bt` is assigned)
 *    - `BT_PLANIFIE` -> `EN_COURS` | `EN_ATTENTE_PDR` | `CLOTURE` | `ANNULE`
 *    - `EN_COURS` -> `EN_ATTENTE_PDR` | `BT_PLANIFIE` | `CLOTURE` | `ANNULE`
 *    - `EN_ATTENTE_PDR` -> `EN_COURS` | `BT_PLANIFIE` | `CLOTURE` | `ANNULE`
 *    - `CLOTURE` -> `[]` (Terminal immutable state without explicit administrative reopen)
 *    - `ANNULE` -> `[]` (Terminal immutable state)
 * 2. **Alias Normalization (`COR-ATELIER-P0`):**
 *    - Legacy and domain-specific waiting states (`EN_ATTENTE_ATELIER`, `ON_HOLD`, `SUSPENDU`) normalize to `EN_ATTENTE_PDR` at the FSM layer while UI components (`BonsTravailTab`) distinguish `ATTENTE ATELIER` vs `ATTENTE PDR` via linked `WorkshopOrder` records.
 * 3. **Anti-False-Closure Guard:**
 *    - Transitioning to `CLOTURE` is strictly rejected if `hasOpenWorkshopOrder === true` (active `Bon d'Atelier` or external subcontracting order not yet received/mounted) or if work performed (`action_realisee`) is empty.
 */

/**
 * Canonical status values for a Corrective Work Order (`DI` / `BT`).
 */
export type WorkOrderStatus =
  | 'DEMANDE'
  | 'BT_PLANIFIE'
  | 'EN_COURS'
  | 'EN_ATTENTE_PDR'
  | 'CLOTURE'
  | 'ANNULE';

/**
 * Structured validation outcome returned by {@link WorkOrderStateMachine.validateTransition}.
 *
 * @property valid - `true` when both the state graph edge and all target domain invariants pass.
 * @property fromStatus - Normalized origin state of the intervention.
 * @property toStatus - Normalized target state requested by the caller.
 * @property reason - Human-readable French explanation when `valid === false`.
 */
export interface TransitionValidationResult {
  valid: boolean;
  fromStatus: WorkOrderStatus;
  toStatus: WorkOrderStatus;
  reason?: string;
}

/**
 * Lookup dictionary mapping legacy, French/English, and workshop waiting aliases
 * to their canonical {@link WorkOrderStatus}.
 */
const STATUS_ALIASES: Record<string, WorkOrderStatus> = {
  DEMANDE: 'DEMANDE',
  DEMANDE_CREEE: 'DEMANDE',
  EN_ATTENTE_VALIDATION: 'DEMANDE',
  DI: 'DEMANDE',
  OUVERT: 'DEMANDE',
  NOUVEAU: 'DEMANDE',

  BT_PLANIFIE: 'BT_PLANIFIE',
  PLANIFIE: 'BT_PLANIFIE',
  APPROUVE: 'BT_PLANIFIE',
  ASSIGNE: 'BT_PLANIFIE',

  EN_COURS: 'EN_COURS',
  IN_PROGRESS: 'EN_COURS',
  LIVE: 'EN_COURS',

  EN_ATTENTE_PDR: 'EN_ATTENTE_PDR',
  EN_ATTENTE_ATELIER: 'EN_ATTENTE_PDR',
  ON_HOLD: 'EN_ATTENTE_PDR',
  SUSPENDU: 'EN_ATTENTE_PDR',
  EN_ATTENTE: 'EN_ATTENTE_PDR',

  CLOTURE: 'CLOTURE',
  CLÔTURÉ: 'CLOTURE',
  CLOTUREE: 'CLOTURE',
  FERME: 'CLOTURE',
  TERMINE: 'CLOTURE',
  CLOSED: 'CLOTURE',

  ANNULE: 'ANNULE',
  ANNULÉ: 'ANNULE',
  CANCELLED: 'ANNULE',
};

/**
 * Adjacency list defining legal directed transitions between canonical work order states.
 */
const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, ReadonlyArray<WorkOrderStatus>> = {
  DEMANDE: ['BT_PLANIFIE', 'EN_COURS', 'ANNULE'],
  BT_PLANIFIE: ['EN_COURS', 'EN_ATTENTE_PDR', 'CLOTURE', 'ANNULE'],
  EN_COURS: ['EN_ATTENTE_PDR', 'BT_PLANIFIE', 'CLOTURE', 'ANNULE'],
  EN_ATTENTE_PDR: ['EN_COURS', 'BT_PLANIFIE', 'CLOTURE', 'ANNULE'],
  CLOTURE: [], // Terminal state: closed work orders are immutable without explicit administrative reopen
  ANNULE: [],  // Terminal state
};

/**
 * Stateless domain service enforcing Corrective Maintenance Work Order (`DI`/`BT`)
 * lifecycle transitions and business invariants.
 */
export class WorkOrderStateMachine {
  /**
   * Normalizes any raw or legacy status string into a canonical {@link WorkOrderStatus}.
   * Unrecognized, null, or empty inputs default safely to `'DEMANDE'`.
   *
   * @param rawStatus - Raw status string from UI, Excel import, or persisted record (e.g., `'EN_ATTENTE_ATELIER'`, `'CLÔTURÉ'`).
   * @returns Canonical {@link WorkOrderStatus}.
   *
   * @example
   * WorkOrderStateMachine.normalizeStatus('EN_ATTENTE_ATELIER'); // => 'EN_ATTENTE_PDR'
   * WorkOrderStateMachine.normalizeStatus('CLÔTURÉ');            // => 'CLOTURE'
   */
  static normalizeStatus(rawStatus?: string | null): WorkOrderStatus {
    if (!rawStatus) return 'DEMANDE';
    const key = String(rawStatus).trim().toUpperCase();
    return STATUS_ALIASES[key] || 'DEMANDE';
  }

  /**
   * Checks whether a transition between two status strings is permitted by the FSM graph.
   * Same-state updates (e.g., editing fields on an `EN_COURS` work order) are allowed
   * for non-terminal states (`DEMANDE`, `BT_PLANIFIE`, `EN_COURS`, `EN_ATTENTE_PDR`)
   * and rejected for terminal states (`CLOTURE`, `ANNULE`).
   *
   * @param fromRaw - Current status string of the work order.
   * @param toRaw - Requested target status string.
   * @returns `true` if the directed edge is valid in {@link ALLOWED_TRANSITIONS} or is a valid non-terminal self-update.
   */
  static canTransition(fromRaw?: string | null, toRaw?: string | null): boolean {
    const fromStatus = this.normalizeStatus(fromRaw);
    const toStatus = this.normalizeStatus(toRaw);

    // Same-state updates (e.g. editing fields on an EN_COURS BT) are allowed except re-triggering CLOTURE action
    if (fromStatus === toStatus) {
      return fromStatus !== 'CLOTURE' && fromStatus !== 'ANNULE';
    }

    const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  /**
   * Validates both the state transition graph edge and required domain invariants for the target state.
   *
   * ### Enforced Domain Invariants:
   * - **Terminal Immutability:** Rejects any transition out of `CLOTURE` or `ANNULE`.
   * - **Emergency Direct Closure:** Permits `DEMANDE -> CLOTURE` only when `num_bt` is already assigned on the intervention or supplied in `payload.num_bt`.
   * - **Machine Identification Guard:** Transitions into `BT_PLANIFIE` or `EN_COURS` require a non-empty `code_machine` (from `payload` or `intervention`).
   * - **Closure Completeness Guard:** Transitions into `CLOTURE` require a non-empty work description (`action_realisee`, `travail_a_faire`, or `anomalie`).
   * - **Workshop / External Order Guard (`COR-ATELIER-P0`):** Transitions into `CLOTURE` are blocked when `hasOpenWorkshopOrder === true` on either `payload` or `intervention`.
   *
   * @param intervention - Existing persisted intervention/work order object (`ICorrectiveIntervention`).
   * @param targetRawStatus - Desired target status string.
   * @param payload - Optional partial update payload being applied during the transition.
   * @returns {@link TransitionValidationResult} indicating whether the transition is legal and providing `reason` on failure.
   */
  static validateTransition(
    intervention: Record<string, any>,
    targetRawStatus: string,
    payload: Record<string, any> = {}
  ): TransitionValidationResult {
    const fromStatus = this.normalizeStatus(intervention?.statut || intervention?.etat);
    const toStatus = this.normalizeStatus(targetRawStatus);

    if (fromStatus === 'CLOTURE') {
      return {
        valid: false,
        fromStatus,
        toStatus,
        reason: `Transition refusée : le Bon de Travail (${intervention?.num_bt || intervention?.id}) est déjà CLOTURE.`,
      };
    }

    if (fromStatus === 'ANNULE') {
      return {
        valid: false,
        fromStatus,
        toStatus,
        reason: `Transition refusée : l'intervention (${intervention?.id}) est annulée.`,
      };
    }

    // Allow direct emergency closure from DEMANDE only if num_bt is present or generated in payload
    const isEmergencyDirectClose =
      fromStatus === 'DEMANDE' &&
      toStatus === 'CLOTURE' &&
      Boolean(intervention?.num_bt || payload?.num_bt);

    if (!isEmergencyDirectClose && !this.canTransition(fromStatus, toStatus) && fromStatus !== toStatus) {
      return {
        valid: false,
        fromStatus,
        toStatus,
        reason: `Transition d'état invalide : ${fromStatus} -> ${toStatus}.`,
      };
    }

    // Domain invariant for BT_PLANIFIE and EN_COURS: must have machine code
    const machineCode = payload.code_machine || intervention?.code_machine || intervention?.machine;
    if ((toStatus === 'BT_PLANIFIE' || toStatus === 'EN_COURS') && !machineCode) {
      return {
        valid: false,
        fromStatus,
        toStatus,
        reason: 'Code machine obligatoire pour planifier ou démarrer un Bon de Travail.',
      };
    }

    // Domain invariant for CLOTURE: must have num_bt (or auto-assigned), work description, and no open workshop order
    if (toStatus === 'CLOTURE') {
      const hasAction = Boolean(
        String(
          payload.action_realisee ||
          payload.travail_a_faire ||
          intervention?.action_realisee ||
          intervention?.travail_a_faire ||
          intervention?.anomalie ||
          ''
        ).trim()
      );
      if (!hasAction) {
        return {
          valid: false,
          fromStatus,
          toStatus,
          reason: 'Veuillez renseigner le travail réalisé avant de clôturer le Bon de Travail.',
        };
      }

      if (payload.hasOpenWorkshopOrder === true || intervention?.hasOpenWorkshopOrder === true) {
        return {
          valid: false,
          fromStatus,
          toStatus,
          reason:
            "Clôture refusée : un Bon d'Atelier / Réparation Externe lié à ce BT est encore en cours. Réceptionnez ou montez l'organe avant de clôturer le BT.",
        };
      }

      const explicitlySansMateriel =
        payload.requires_material === false ||
        payload.sans_materiel === true ||
        intervention?.requires_material === false ||
        intervention?.sans_materiel === true;

      if (
        !explicitlySansMateriel &&
        (payload.hasOpenNeedRequest === true || intervention?.hasOpenNeedRequest === true)
      ) {
        return {
          valid: false,
          fromStatus,
          toStatus,
          reason:
            "Clôture refusée : une Demande de Besoin liée à ce BT n'a pas encore atteint la clôture terrain (POSE_ESSAI ➔ CLOTURE_FIELD). Terminez la remise et l'essai sur machine avant de clôturer le BT.",
        };
      }
    }

    return {
      valid: true,
      fromStatus,
      toStatus,
    };
  }
}

export default WorkOrderStateMachine;
