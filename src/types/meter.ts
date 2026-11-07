/**
 * Meter & Counter-based Maintenance Domain Types (GMAO / CMMS)
 * Supports Horomètres (operating hours), Compteurs de cycles (production strokes), and Kilométrage.
 */

export type MeterUnit = 'Heures' | 'Cycles' | 'Km';

export type MeterReadingSource =
  | 'MANUEL'
  | 'IOT'
  | 'PREVENTIVE_EXECUTION'
  | 'CORRECTIVE_INTERVENTION'
  | 'IMPORT';

export type MeterTriggerStatus = 'OK' | 'WARNING' | 'OVERDUE';

export interface IMeterReading {
  id: string;
  machineId: string;
  machineDesignation?: string;
  valeur: number;
  valeur_precedente: number;
  delta: number;
  unite: MeterUnit;
  compteur_type?: 'PRINCIPAL' | 'SECONDAIRE';
  date_releve: string;
  releve_par: string;
  source: MeterReadingSource;
  commentaire?: string;
  createdAt: string;
}

export interface MeterEvaluationResult {
  status: MeterTriggerStatus;
  currentValue: number;
  targetValue: number;
  intervalValue: number;
  remainingValue: number;
  percentProgress: number;
  unit: MeterUnit;
  isOverdue: boolean;
  isWarning: boolean;
  message: string;
}
