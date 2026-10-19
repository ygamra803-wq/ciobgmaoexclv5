/**
 * Industrial KPI, Maintenance Metrics & Analytics Types
 */

export interface IMtbfMttrData {
  mtbfHours: number;
  mttrHours: number;
  totalOperatingHours: number;
  totalDowntimeHours: number;
  failureCount: number;
  availabilityRate: number; // 0 to 100 %
}

export interface IStockKpiSummary {
  totalSkus: number;
  totalValue: number;
  ruptureCount: number;
  alerteCount: number;
  okCount: number;
  turnoverRate: number;
  dormantStockSkus: number;
}

export interface IMaintenanceKpiSummary {
  correctiveInterventionsCount: number;
  preventiveInterventionsCount: number;
  preventiveAdherenceRate: number; // 0 to 100 %
  meanTimeToRepairMin: number;
  meanTimeBetweenFailuresHours: number;
  overallEquipmentEffectivenessPercent: number;
  topFailingMachines: Array<{
    id_machine: string;
    designation: string;
    failureCount: number;
    totalDowntimeMin: number;
  }>;
}
