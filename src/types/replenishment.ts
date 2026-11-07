/**
 * @file replenishment.ts
 * @description Types and models for Automated Replenishment & Purchase Orders Engine (المحور 4).
 */

export type ReplenishmentOrderStatus =
  | 'BROUILLON'             // مسودة - Draft
  | 'COMMANDE'              // أمر الشراء مرسل للمورد - Ordered
  | 'RECEPTION_PARTIELLE'   // استلام جزئي - Partially Received
  | 'RECU_CONFORME'         // مستلم بالكامل ومدمج في المخزن - Received & Stocked
  | 'ANNULE';               // ملغى - Cancelled

export interface IReplenishmentOrderItem {
  ref: string;
  designation: string;
  quantite_demandee: number;
  quantite_recue: number;
  prix_unitaire_estime: number;
  stock_actuel_moment: number;
  seuil_alerte: number;
  unite?: string;
}

export interface IReplenishmentOrder {
  id: string; // BC-YYYYMMDD-XXXX
  numero_commande: string;
  date_creation: string;
  date_commande?: string;
  date_reception?: string;
  fournisseur: string;
  statut: ReplenishmentOrderStatus;
  cree_par: string;
  valide_par?: string;
  items: IReplenishmentOrderItem[];
  montant_total_estime: number;
  notes?: string;
  numero_bon_reception?: string;
  motif_annulation?: string;
}
