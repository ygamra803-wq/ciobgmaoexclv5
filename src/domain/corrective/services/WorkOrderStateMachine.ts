export type WorkOrderStatus =
  | 'DEMANDE'
  | 'BT_PLANIFIE'
  | 'EN_COURS'
  | 'EN_ATTENTE_PDR'
  | 'CLOTURE'
  | 'ANNULE';

export interface TransitionValidationResult {
  valid: boolean;
  fromStatus: WorkOrderStatus;
  toStatus: WorkOrderStatus;
  reason?: string;
}

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

const ALLOWED_TRANSITIONS: Record<WorkOrderStatus, ReadonlyArray<WorkOrderStatus>> = {
  DEMANDE: ['BT_PLANIFIE', 'EN_COURS', 'ANNULE'],
  BT_PLANIFIE: ['EN_COURS', 'EN_ATTENTE_PDR', 'CLOTURE', 'ANNULE'],
  EN_COURS: ['EN_ATTENTE_PDR', 'BT_PLANIFIE', 'CLOTURE', 'ANNULE'],
  EN_ATTENTE_PDR: ['EN_COURS', 'BT_PLANIFIE', 'CLOTURE', 'ANNULE'],
  CLOTURE: [], // Terminal state: closed work orders are immutable without explicit administrative reopen
  ANNULE: [],  // Terminal state
};

export class WorkOrderStateMachine {
  /**
   * Normalizes any raw status string into a canonical WorkOrderStatus.
   */
  static normalizeStatus(rawStatus?: string | null): WorkOrderStatus {
    if (!rawStatus) return 'DEMANDE';
    const key = String(rawStatus).trim().toUpperCase();
    return STATUS_ALIASES[key] || 'DEMANDE';
  }

  /**
   * Checks if a transition between two states is permitted by the FSM graph.
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
   * Validates both the state transition and required domain invariants for the target state.
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

    // Domain invariant for CLOTURE: must have num_bt (or auto-assigned) and work description
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
    }

    return {
      valid: true,
      fromStatus,
      toStatus,
    };
  }
}

export default WorkOrderStateMachine;
