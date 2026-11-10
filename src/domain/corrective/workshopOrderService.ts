import { safeId } from '../../utils/safeId';

export type WorkshopOrderType = 'REALISATION' | 'RECTIFICATION';

export type WorkshopOrderStatus =
  | 'EMIS'
  | 'EN_COURS_FABRICATION'
  | 'PRET_LIVRAISON'
  | 'RECEPTIONNE_MONTAGE'
  | 'ANNULE';

export interface IWorkshopTaskItem {
  id: string;
  libelle: string;
  statut?: string;
}

/**
 * Canonical SSOT entity for Internal Mechanical Workshop Orders
 * (Bon de Réalisation / Rectification — Section Maintenance -> Atelier Fabrication Mécanique).
 * Strictly distinct from stock movements (IncrementalStockIndex) and external subcontracting (SortieExterne).
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

export interface WorkshopTransitionValidation {
  valid: boolean;
  fromStatus: WorkshopOrderStatus;
  toStatus: WorkshopOrderStatus;
  normalizedTarget?: WorkshopOrderStatus;
  reason?: string;
}

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

export const WORKSHOP_STATUS_LABELS: Record<WorkshopOrderStatus, string> = {
  EMIS: 'Émis (Attente Atelier)',
  EN_COURS_FABRICATION: 'En cours fabrication / usinage',
  PRET_LIVRAISON: 'Prêt livraison SM',
  RECEPTIONNE_MONTAGE: 'Réceptionné & Monté',
  ANNULE: 'Annulé',
};

export const WORKSHOP_TYPE_LABELS: Record<WorkshopOrderType, string> = {
  REALISATION: 'Réalisation (BR)',
  RECTIFICATION: 'Rectification (RECT)',
};

export function normalizeWorkshopOrderType(raw?: unknown): WorkshopOrderType {
  const clean = String(raw || '').trim().toUpperCase();
  if (clean === 'RECTIFICATION' || clean === 'RECT') return 'RECTIFICATION';
  return 'REALISATION';
}

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
 * Single guarded FSM transition validator for WorkshopOrder (COR-ATELIER-P0).
 * Allowed transitions:
 * - EMIS -> EN_COURS_FABRICATION | ANNULE
 * - EN_COURS_FABRICATION -> PRET_LIVRAISON | ANNULE
 * - PRET_LIVRAISON -> RECEPTIONNE_MONTAGE | ANNULE
 * - RECEPTIONNE_MONTAGE -> (terminal)
 * - ANNULE -> (terminal)
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

export function getAllowedNextWorkshopStatuses(
  currentRaw: unknown
): ReadonlyArray<WorkshopOrderStatus> {
  const status = normalizeWorkshopOrderStatus(currentRaw);
  return ALLOWED_WORKSHOP_TRANSITIONS[status] || [];
}

/**
 * Returns true if the workshop order is still active/in-progress (blocks parent BT closure).
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
