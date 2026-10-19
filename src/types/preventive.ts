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

export interface IPreventiveTask {
  id_task: string | number;
  id_plan?: string;
  titre: string;
  description: string;
  ordre_execution?: number;
  duree_estimee_min: number;
  specialite?: 'MECANIQUE' | 'ELECTRIQUE' | 'HYDRAULIQUE' | 'PNEUMATIQUE' | 'AUTOMATISME' | 'GENERAL';
  consignes_securite?: string[];
  outillage_requis?: string[];
  pdr_requises?: Array<{
    ref: string;
    designation: string;
    quantite: number;
  }>;
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

/**
 * Historical event record for a preventive maintenance execution (P1.1 Event Log)
 */
export interface PreventiveExecutionRecord {
  id: string;
  taskId: string;
  taskCode?: string;
  machineCode: string;
  machineName?: string;
  zone?: string;
  organe: string;
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
  createdAt: string;
}

