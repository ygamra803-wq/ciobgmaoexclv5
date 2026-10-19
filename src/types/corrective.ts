/**
 * Corrective Maintenance Types (GMAO / CMMS)
 */

export type UrgenceLevel = 'FAIBLE' | 'NORMALE' | 'HAUTE' | 'URGENTE' | 'CRITIQUE';

export type StatutDI = 'BROUILLON' | 'OUVERTE' | 'PRISE_EN_CHARGE' | 'EN_COURS' | 'REJETEE' | 'CLOTUREE';

export type StatutBT = 'EMIS' | 'ASSIGNE' | 'EN_COURS' | 'EN_ATTENTE_PDR' | 'TERMINE' | 'ANNULE';

export type CausePanneType = 'USURE_NORMALE' | 'DEFAUT_MATERIEL' | 'ERREUR_OPERATEUR' | 'ENVIRONNEMENT' | 'INCONNUE';

export interface IDemandeIntervention {
  id: string | number;
  code_di: string;
  date_emission: string;
  heure_emission?: string;
  emetteur: string;
  id_machine: string;
  machine_designation?: string;
  id_zone?: string;
  zone_libelle?: string;
  urgence: UrgenceLevel;
  statut: StatutDI;
  description_panne: string;
  symptome?: string;
  arret_machine?: boolean;
  duree_arret_estimee_min?: number;
  date_prise_en_charge?: string;
  id_bt_associe?: string;
  created_at?: string;
  updated_at?: string;
}

export interface IBonTravail {
  id: string | number;
  code_bt: string;
  code_di?: string;
  date_creation: string;
  id_machine: string;
  machine_designation?: string;
  id_zone?: string;
  priorite: UrgenceLevel;
  statut: StatutBT;
  technicien_assigne?: string;
  techniciens_intervenants?: string[];
  diagnostic_initial?: string;
  description_travaux?: string;
  date_debut_prevue?: string;
  date_fin_prevue?: string;
  duree_estimee_h?: number;
  pieces_demandees?: Array<{
    ref_pdr: string;
    designation: string;
    quantite_demandee: number;
    quantite_accordee?: number;
    statut_dispo?: 'DISPONIBLE' | 'PARTIEL' | 'COMMANDE';
  }>;
  cout_total_estime?: number;
  created_at?: string;
  updated_at?: string;
}

export interface IRapportIntervention {
  id: string | number;
  code_rapport: string;
  code_bt: string;
  code_di?: string;
  id_machine: string;
  date_intervention: string;
  heure_debut: string;
  heure_fin: string;
  duree_totale_min: number;
  duree_arret_reel_min: number;
  intervenants: string[];
  cause_racine: CausePanneType;
  travaux_realises: string;
  pdr_consommees: Array<{
    ref_pdr: string;
    designation: string;
    quantite: number;
    prix_unitaire?: number;
    cout_total?: number;
  }>;
  observations?: string;
  recommandations?: string;
  etat_machine_apres: 'FONCTIONNELLE' | 'FONCTIONNEMENT_DEGRADE' | 'NON_CONFORME';
  visa_technicien?: string;
  visa_responsable?: string;
  date_cloture: string;
}
