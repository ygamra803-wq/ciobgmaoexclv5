/**
 * Preventive Maintenance Types (GMAO / CMMS)
 */

export type FrequenceType =
  | 'JOURNALIER'
  | 'HEBDOMADAIRE'
  | 'BI_HEBDOMADAIRE'
  | 'MENSUEL'
  | 'TRIMESTRIEL'
  | 'SEMESTRIEL'
  | 'ANNUEL'
  | 'HEURES_FONCTIONNEMENT'
  | 'CYCLES_PRODUCTION';

export type StatutPlan = 'ACTIF' | 'EN_PAUSE' | 'ARCHIVE' | 'BROUILLON';

export type StatutTachePreventive = 'A_FAIRE' | 'EN_COURS' | 'REALISE' | 'REPORTE' | 'ANNULE' | 'EN_RETARD';

export interface PreventiveRequiredPdrItem {
  ref: string;
  nom?: string;
  designation?: string;
  quantite: number;
  unite?: string;
  prix_unitaire?: number;
}

export interface IPreventiveTask {
  id_task: string | number;
  id_plan?: string;
  titre: string;
  description: string;
  composant?: string;
  id_composant?: string;
  nom_composant?: string;
  id_part?: string;
  nom_part?: string;
  ordre_execution?: number;
  duree_estimee_min: number;
  specialite?: 'MECANIQUE' | 'ELECTRIQUE' | 'HYDRAULIQUE' | 'PNEUMATIQUE' | 'AUTOMATISME' | 'GENERAL';
  consignes_securite?: string[];
  outillage_requis?: string[];
  pdr_requises?: PreventiveRequiredPdrItem[];
}

export interface IPreventivePlan {
  id_plan: string;
  code_plan: string;
  titre: string;
  id_machine: string;
  machine_designation?: string;
  id_zone?: string;
  frequence: FrequenceType;
  intervalle_valeur: number;
  intervalle_unite: 'JOURS' | 'SEMAINES' | 'MOIS' | 'HEURES' | 'CYCLES';
  date_prochaine_echeance: string;
  date_derniere_execution?: string;
  statut: StatutPlan;
  technicien_responsable?: string;
  taches: IPreventiveTask[];
  est_actif: boolean;
  seuil_alerte_jours?: number;
}

export interface IPreventiveExecution {
  id_execution: string | number;
  id_plan: string;
  id_composant?: string;
  nom_composant?: string;
  id_part?: string;
  nom_part?: string;
  date_programmee: string;
  date_realisation?: string;
  statut: StatutTachePreventive;
  technicien_executant?: string;
  duree_reelle_min?: number;
  remarques?: string;
  anomalies_detectees?: boolean;
  actions_correctives_requises?: string;
}

export interface PreventiveExecutionSpareItem {
  ref: string;
  designation?: string;
  qty: number;
  unit?: string;
  unitPrice?: number;
}

export type PreventiveValidationStatus =
  | 'NONE'
  | 'PENDING_VALIDATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_CLARIFICATION';

/**
 * Historical event record for a preventive maintenance execution (P1.1 Event Log + P7.1 Organe FKs + V3 Maker-Checker)
 */
export interface PreventiveExecutionRecord {
  id: string;
  taskId: string;
  taskCode?: string;
  machineCode: string;
  machineName?: string;
  zone?: string;
  organe: string;
  id_composant?: string;
  nom_composant?: string;
  id_part?: string;
  nom_part?: string;
  actionCode: string;
  taskDescription?: string;
  frequence?: string;
  executedAt: string; // ISO date or YYYY-MM-DD
  periodMonth: string; // YYYY-MM
  periodWeek?: string; // e.g., S14
  executorName: string;
  durationMinutes: number;
  laborRate?: number;
  sparesCost?: number;
  totalCost?: number;
  status: 'DONE' | 'SKIPPED' | 'PARTIAL';
  notes?: string;
  sparesUsed?: PreventiveExecutionSpareItem[];
  sparesProposed?: PreventiveExecutionSpareItem[];
  num_bon_saisi_par_tech?: string;
  validation_status?: PreventiveValidationStatus;
  submitted_by_id?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  validated_by_id?: string;
  validated_by_name?: string;
  validated_at?: string;
  validation_note?: string;
  stock_deducted?: boolean;
  createdAt: string;
}



