import * as XLSX from 'xlsx';
import { normalizeDateToYMD } from '../utils/datePeriodUtils';
import { getCurrencyCode } from '../utils/currencyService';
import {
  isUnapprovedFieldClaim,
  type MonthOverMonthComparison,
  type ShiftOrWeeklyReportData,
} from '../application/services/MonthlyReportCalculationService';

export interface MonthlyExportRawData {
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
}

function applyAutoFitColumns(ws: XLSX.WorkSheet, rows: any[][]): void {
  if (!rows || rows.length === 0) return;
  const maxCols = rows.reduce((max, r) => Math.max(max, Array.isArray(r) ? r.length : 0), 0);
  const cols: XLSX.ColInfo[] = [];
  for (let c = 0; c < maxCols; c++) {
    let maxLen = 12;
    for (let r = 0; r < rows.length; r++) {
      const cell = rows[r]?.[c];
      const len = cell !== null && cell !== undefined ? String(cell).length : 0;
      if (len > maxLen) maxLen = len;
    }
    cols.push({ wch: Math.min(48, maxLen + 4) });
  }
  ws['!cols'] = cols;
}

export class MonthlyReportExportService {
  /**
   * Generates a multi-sheet Excel workbook (.xlsx) for the selected month (P2.2):
   * 1. Synthese_Direction (KPIs + Month-over-Month Deltas + MTTR/MTBF/OEE + C1 Costs)
   * 2. Couts_Machines_C1 (Per-machine official costs: BT + PM + External Bobinage)
   * 3. Ruptures_et_Alertes (Critical stock shortages requiring immediate purchase)
   * 4. Mouvements_du_Mois (Filtered APPROVED movements in YYYY-MM)
   * 5. Pannes_Correctives_Mois (Filtered APPROVED corrective interventions in YYYY-MM)
   * 6. Executions_Preventives (Filtered APPROVED preventive executions in YYYY-MM)
   */
  static exportMonthlyReportToExcel(
    comparison: MonthOverMonthComparison,
    raw: MonthlyExportRawData = {}
  ): string {
    const { currentMonth, previousMonth, currentReport, previousReport } = comparison;
    const isoCode = getCurrencyCode();
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Synthese_Direction
    const syntheseRows = [
      ['RAPPORT MENSUEL EXÉCUTIF DIRECTION — CIOB GMAO v4'],
      [
        'Période du Rapport',
        currentMonth,
        'Comparaison vs Mois Précédent',
        previousMonth,
        `Périmètre: ${currentReport.assetClassFilter || 'ALL'} • Devise ISO: ${isoCode}`,
      ],
      [],
      ['INDICATEUR EXÉCUTIF', `Mois (${currentMonth})`, `Mois Précédent (${previousMonth})`, 'Écart (Delta)', 'Tendance (%)'],
      [
        `Valorisation Totale du Stock (${isoCode})`,
        currentReport.stockValuationTotal,
        previousReport.stockValuationTotal,
        comparison.stockValuationDelta.diff,
        `${comparison.stockValuationDelta.percent}%`,
      ],
      [
        `Coût Consommation PDR Magasin du Mois (${isoCode})`,
        currentReport.monthConsumptionCost,
        previousReport.monthConsumptionCost,
        comparison.consumptionCostDelta.diff,
        `${comparison.consumptionCostDelta.percent}%`,
      ],
      [
        `Coût PDR Correctif Approuvé (${isoCode})`,
        currentReport.correctiveSparesCost,
        previousReport.correctiveSparesCost,
        Number((currentReport.correctiveSparesCost - previousReport.correctiveSparesCost).toFixed(2)),
        '-',
      ],
      [
        `Coût Préventif Approuvé du Mois (${isoCode})`,
        currentReport.preventiveTotalCost,
        previousReport.preventiveTotalCost,
        Number((currentReport.preventiveTotalCost - previousReport.preventiveTotalCost).toFixed(2)),
        '-',
      ],
      [
        `Coût Bobinage / Sous-traitance Externe (${isoCode})`,
        currentReport.externalBobinageCost || 0,
        previousReport.externalBobinageCost || 0,
        Number(((currentReport.externalBobinageCost || 0) - (previousReport.externalBobinageCost || 0)).toFixed(2)),
        `${currentReport.externalBobinageCount || 0} dossier(s)`,
      ],
      [
        `Coût Total Maintenance Officiel (C1: BT + PM + Externe) (${isoCode})`,
        currentReport.totalOfficialMaintenanceCost,
        previousReport.totalOfficialMaintenanceCost,
        Number((currentReport.totalOfficialMaintenanceCost - previousReport.totalOfficialMaintenanceCost).toFixed(2)),
        comparison.totalOfficialCostDelta ? `${comparison.totalOfficialCostDelta.percent}%` : '-',
      ],
      [
        `Coût Réceptions / Entrées du Mois (${isoCode})`,
        currentReport.monthEntriesCost,
        previousReport.monthEntriesCost,
        Number((currentReport.monthEntriesCost - previousReport.monthEntriesCost).toFixed(2)),
        '-',
      ],
      [
        `Commandes Ouvertes en Attente (${isoCode})`,
        currentReport.openOrdersValue,
        previousReport.openOrdersValue,
        currentReport.openOrdersCount,
        'Commandes actives',
      ],
      [
        'Articles en Rupture Critique (Stock = 0)',
        currentReport.ruptureCount,
        previousReport.ruptureCount,
        currentReport.ruptureCount - previousReport.ruptureCount,
        '-',
      ],
      [
        'Articles en Alerte Seuil',
        currentReport.alerteCount,
        previousReport.alerteCount,
        currentReport.alerteCount - previousReport.alerteCount,
        '-',
      ],
      [
        'Taux de Discipline Préventive (%)',
        `${currentReport.preventiveDisciplineRate}%`,
        `${previousReport.preventiveDisciplineRate}%`,
        `${comparison.preventiveDisciplineDelta.diff}%`,
        `${comparison.preventiveDisciplineDelta.percent}%`,
      ],
      [
        'Exécutions Préventives Réalisées / Planifiées',
        `${currentReport.preventiveExecutedCount} / ${currentReport.preventiveScheduledCount}`,
        `${previousReport.preventiveExecutedCount} / ${previousReport.preventiveScheduledCount}`,
        currentReport.preventiveExecutedCount - previousReport.preventiveExecutedCount,
        `${currentReport.preventiveLaborHours}h MO`,
      ],
      [
        'Total Interventions Correctives (Pannes Approuvées)',
        currentReport.correctiveCount,
        previousReport.correctiveCount,
        comparison.correctiveCountDelta.diff,
        `${comparison.correctiveCountDelta.percent}%`,
      ],
      [
        'Cumul Heures d’Arrêt Machine (Downtime)',
        currentReport.totalDowntimeHours,
        previousReport.totalDowntimeHours,
        comparison.downtimeHoursDelta.diff,
        `${comparison.downtimeHoursDelta.percent}%`,
      ],
      [
        'MTTR Production (Temps Moyen de Réparation)',
        currentReport.mttrFormatted,
        previousReport.mttrFormatted,
        `${currentReport.mttrHours}h`,
        'Maintenabilité',
      ],
      [
        'MTBF Production (Temps Moyen Entre Pannes)',
        `${currentReport.mtbfHours}h`,
        `${previousReport.mtbfHours}h`,
        currentReport.mtbfHours - previousReport.mtbfHours,
        'Fiabilité Production',
      ],
      [
        'Taux de Disponibilité Opérationnelle Production (OEE/TRS)',
        `${currentReport.availabilityRate}%`,
        `${previousReport.availabilityRate}%`,
        `${Number((currentReport.availabilityRate - previousReport.availabilityRate).toFixed(2))}%`,
        'Cible >= 95%',
      ],
    ];
    const wsSynthese = XLSX.utils.aoa_to_sheet(syntheseRows);
    applyAutoFitColumns(wsSynthese, syntheseRows);
    XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthese_Direction');

    // 2. Sheet: Couts_Machines_C1
    const c1Header = [
      'Code Machine',
      'Désignation Équipement',
      'Classe Actif',
      'Nb BT Correctifs',
      `Coût BT Approuvé (${isoCode})`,
      'Nb Exécutions PM',
      `Coût PM Approuvé (${isoCode})`,
      'Nb Bobinage Externe',
      `Coût Bobinage Externe (${isoCode})`,
      `Coût Total Officiel (${isoCode})`,
      'Arrêt Cumulé (h)',
    ];
    const c1Rows = (currentReport.machineCostBreakdown || []).map((m) => [
      m.machineCode,
      m.machineName,
      m.assetClass,
      m.correctiveCount,
      m.correctiveCost,
      m.preventiveCount,
      m.preventiveCost,
      m.externalBobinageCount,
      m.externalBobinageCost,
      m.totalOfficialCost,
      m.totalDowntimeHours,
    ]);
    const c1AllRows = [c1Header, ...c1Rows];
    const wsC1 = XLSX.utils.aoa_to_sheet(c1AllRows);
    applyAutoFitColumns(wsC1, c1AllRows);
    XLSX.utils.book_append_sheet(wb, wsC1, 'Couts_Machines_C1');

    // 3. Sheet: Ruptures_et_Alertes
    const shortagesHeader = [
      'Statut Critique',
      'Référence PDR',
      'Désignation',
      'Stock Actuel',
      'Seuil Minimum',
      'Quantité à Commander Conseillée',
      `Prix Unitaire (${isoCode})`,
      `Budget Estimé (${isoCode})`,
    ];
    const shortagesRows = [
      ...currentReport.ruptureItems.map((it) => {
        const reorderQty = Math.max(5, it.seuil * 2 - it.stockActuel);
        return [
          'RUPTURE (0)',
          it.ref,
          it.designation,
          it.stockActuel,
          it.seuil,
          reorderQty,
          it.prixUnitaire,
          Number((reorderQty * it.prixUnitaire).toFixed(2)),
        ];
      }),
      ...(currentReport.alerteItems || []).map((it) => {
        const reorderQty = Math.max(2, it.seuil * 2 - it.stockActuel);
        return [
          'ALERTE SEUIL',
          it.ref,
          it.designation,
          it.stockActuel,
          it.seuil,
          reorderQty,
          it.prixUnitaire,
          Number((reorderQty * it.prixUnitaire).toFixed(2)),
        ];
      }),
    ];
    const shortagesAllRows = [shortagesHeader, ...shortagesRows];
    const wsShortages = XLSX.utils.aoa_to_sheet(shortagesAllRows);
    applyAutoFitColumns(wsShortages, shortagesAllRows);
    XLSX.utils.book_append_sheet(wb, wsShortages, 'Ruptures_et_Alertes');

    // 4. Sheet: Mouvements_du_Mois (Approved only — never export PENDING_VALIDATION / REJECTED)
    const monthMovements = (raw.mouvements || []).filter((m) => {
      if (!m || isUnapprovedFieldClaim(m)) return false;
      const d = normalizeDateToYMD(m.date);
      return d && d.startsWith(currentMonth);
    });
    const mvtHeader = ['Date', 'Code Bon', 'Type', 'Référence', 'Quantité', `Prix Unitaire (${isoCode})`, 'Machine', 'Technicien', 'Commentaire'];
    const mvtRows = monthMovements.map((m) => [
      normalizeDateToYMD(m.date),
      m.code_bon || '',
      m.type || '',
      m.ref || m.code_article || '',
      Number(m.quantite || 0),
      Number(m.prix_unitaire ?? m.prix ?? 0),
      m.id_machine_registered || m.machine || '',
      m.technicien || '',
      m.commentaire || m.observation || '',
    ]);
    const mvtAllRows = [mvtHeader, ...mvtRows];
    const wsMvt = XLSX.utils.aoa_to_sheet(mvtAllRows);
    applyAutoFitColumns(wsMvt, mvtAllRows);
    XLSX.utils.book_append_sheet(wb, wsMvt, 'Mouvements_du_Mois');

    // 5. Sheet: Pannes_Correctives_Mois (Approved only)
    const monthCorrective = (raw.correctiveInterventions || []).filter((ci) => {
      if (!ci || isUnapprovedFieldClaim(ci)) return false;
      const d = normalizeDateToYMD(
        ci.date_demande || ci.demande_date || ci.date || ci.date_cloture || ci.date_fin || ci.created_at
      );
      return d && d.startsWith(currentMonth);
    });
    const corrHeader = [
      'N° BT',
      'Date',
      'Code Machine',
      'Statut',
      'Type Panne',
      'Anomalie',
      'Travail Réalisé',
      'Intervenant',
      'Durée (min)',
      'PDR Utilisée',
      'Qté PDR',
    ];
    const corrRows = monthCorrective.map((ci) => [
      ci.num_bt || ci.id || '',
      normalizeDateToYMD(ci.date_demande || ci.demande_date || ci.date || ci.date_fin),
      ci.code_machine || '',
      ci.statut || '',
      ci.type_panne || '',
      ci.anomalie || '',
      ci.action_realisee || ci.travail_a_faire || '',
      ci.intervenant || '',
      Number(ci.temps_intervention_mins || ci.temps_minutes || 0),
      ci.pdr_ref || ci.pdr || '',
      Number(ci.pdr_quantite || 0),
    ]);
    const corrAllRows = [corrHeader, ...corrRows];
    const wsCorr = XLSX.utils.aoa_to_sheet(corrAllRows);
    applyAutoFitColumns(wsCorr, corrAllRows);
    XLSX.utils.book_append_sheet(wb, wsCorr, 'Pannes_Correctives_Mois');

    // 6. Sheet: Executions_Preventives (Approved only)
    const monthExecs = (raw.preventiveExecutions || []).filter((ex) => {
      if (!ex || isUnapprovedFieldClaim(ex)) return false;
      const d = normalizeDateToYMD(ex.executedAt);
      return (ex.periodMonth && ex.periodMonth === currentMonth) || (d && d.startsWith(currentMonth));
    });
    const prevHeader = ['ID Exécution', 'Date Exécution', 'Code Machine', 'Tâche ID', 'Exécutant', 'Durée (min)', `Coût Total (${isoCode})`, 'Notes'];
    const prevRows = monthExecs.map((ex) => [
      ex.id || '',
      normalizeDateToYMD(ex.executedAt),
      ex.machineCode || '',
      ex.taskId || '',
      ex.executorName || '',
      Number(ex.durationMinutes || 0),
      Number(ex.totalCost || 0),
      ex.notes || '',
    ]);
    const prevAllRows = [prevHeader, ...prevRows];
    const wsPrev = XLSX.utils.aoa_to_sheet(prevAllRows);
    applyAutoFitColumns(wsPrev, prevAllRows);
    XLSX.utils.book_append_sheet(wb, wsPrev, 'Executions_Preventives');

    const filename = `GMAO_Rapport_Mensuel_Direction_${currentMonth}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /**
   * Generates a multi-sheet Excel workbook (.xlsx) for the Shift / Weekly Operational Report:
   * 1. Synthese_Exploitation (All 5 operational sections + Maker-Checker queue + Production reliability)
   * 2. Couts_Machines_C1 (Per-machine official costs: BT + PM + External Bobinage)
   * 3. Conformite_PM_B3 (Temporal PM compliance: ON_TIME | LATE | OVERDUE)
   * 4. Mouvements_Valides_C2 (Official validated store movements in period)
   * 5. Alertes_Reappro_C3 (Rupture / Sous Seuil / Risque après réservation)
   */
  static exportShiftWeeklyReportToExcel(report: ShiftOrWeeklyReportData): string {
    const wb = XLSX.utils.book_new();
    const isoCode = getCurrencyCode();

    // 1. Sheet: Synthese_Exploitation
    const syntheseRows = [
      ['RAPPORT OPÉRATIONNEL DE VACATION & HEBDOMADAIRE — CIOB GMAO v4'],
      ['Période Début', report.fromYMD, 'Période Fin', report.toYMD, `${report.daysCount} jour(s) • Devise ISO: ${isoCode}`],
      ['Périmètre Actifs', report.assetClassFilter, 'Machines Production Actives', report.productionMachinesCount, ''],
      [],
      ['INDICATEUR OPÉRATIONNEL (APPROUVÉS UNIQUEMENT)', 'VALEUR', 'UNITÉ / DÉTAIL', 'PÉRIMÈTRE'],
      ['Correctif Clôturés sur la Période', report.correctiveClosedInPeriodCount, 'BT clôturés', report.assetClassFilter],
      ['Correctif Total sur la Période', report.correctiveTotalInPeriodCount, 'BT enregistrés', report.assetClassFilter],
      ['Correctif Ouverts Actuellement (Snapshot)', report.correctiveOpenSnapshotCount, 'BT en cours', report.assetClassFilter],
      ['Temps d’Arrêt Correctif Cumulé', report.totalDowntimeHours, 'heures', report.assetClassFilter],
      ['Coût PDR Correctif Approuvé', report.correctiveSparesCost, isoCode, report.assetClassFilter],
      ['Exécutions Préventives Approuvées', report.preventiveExecutedInPeriodCount, `${report.preventiveLaborHours}h MO`, report.assetClassFilter],
      ['Coût Préventif Approuvé', report.preventiveTotalCost, isoCode, report.assetClassFilter],
      ['Dossiers Bobinage / Externe Approuvés', report.externalBobinageCount || 0, 'dossiers', report.assetClassFilter],
      ['Coût Bobinage / Externe Approuvé', report.externalBobinageCost || 0, isoCode, report.assetClassFilter],
      ['Coût Total Maintenance Officiel (C1: BT + PM + Externe)', report.totalOfficialMaintenanceCost, isoCode, report.assetClassFilter],
      ['Conformité PM À Temps (ON_TIME)', report.pmCompliance.onTimeCount, `${report.pmCompliance.onTimeComplianceRate}%`, report.assetClassFilter],
      ['Conformité PM Fait en Retard (LATE)', report.pmCompliance.lateCompletedCount, 'tâches', report.assetClassFilter],
      ['Conformité PM Non Réalisé / En Retard (OVERDUE)', report.pmCompliance.overdueCount, 'tâches', report.assetClassFilter],
      ['Discipline Préventive Globale', `${report.preventiveDisciplineRate}%`, `${report.pmCompliance.totalEligibleCount} tâche(s) éligible(s)`, report.assetClassFilter],
      ['Sorties Magasin Validées', report.sortiesCount, `${report.sortiesTotalQuantity} pcs`, report.assetClassFilter],
      ['Coût Consommation Magasin Validé', report.consumptionCost, isoCode, report.assetClassFilter],
      ['MTTR Production', report.mttrFormatted, `${report.mttrHours}h`, 'PRODUCTION'],
      ['MTBF Production', `${report.mtbfHours}h`, `${report.scheduledProductionHours}h planifiées`, 'PRODUCTION'],
      ['Disponibilité Opérationnelle Production', `${report.availabilityRate}%`, 'Cible >= 95%', 'PRODUCTION'],
      ['File Maker-Checker En Attente', report.makerCheckerQueue.totalPendingCount, `${report.makerCheckerQueue.totalClarificationCount} en clarification`, 'GLOBAL'],
      ['Réservations Virtuelles Stock', report.makerCheckerQueue.totalReservedUnits, `${report.makerCheckerQueue.reservedRefsCount} réf. réservée(s)`, 'GLOBAL'],
      ['Éléments Non Approuvés Exclus de la Période', report.excludedUnapprovedInPeriod.totalExcludedCount, 'exclus des coûts officiels', report.assetClassFilter],
    ];
    const wsSynthese = XLSX.utils.aoa_to_sheet(syntheseRows);
    applyAutoFitColumns(wsSynthese, syntheseRows);
    XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthese_Exploitation');

    // 2. Sheet: Couts_Machines_C1
    const c1Header = [
      'Code Machine',
      'Désignation Équipement',
      'Classe Actif',
      'Nb BT',
      `Coût BT Approuvé (${isoCode})`,
      'Nb PM',
      `Coût PM Approuvé (${isoCode})`,
      'Nb Bobinage Externe',
      `Coût Bobinage Externe (${isoCode})`,
      `Coût Total Officiel (${isoCode})`,
      'Heures d’Arrêt (h)',
    ];
    const c1Rows = (report.machineCostBreakdown || []).map((m) => [
      m.machineCode,
      m.machineName,
      m.assetClass,
      m.correctiveCount,
      m.correctiveCost,
      m.preventiveCount,
      m.preventiveCost,
      m.externalBobinageCount,
      m.externalBobinageCost,
      m.totalOfficialCost,
      m.totalDowntimeHours,
    ]);
    const c1All = [c1Header, ...c1Rows];
    const wsC1 = XLSX.utils.aoa_to_sheet(c1All);
    applyAutoFitColumns(wsC1, c1All);
    XLSX.utils.book_append_sheet(wb, wsC1, 'Couts_Machines_C1');

    // 3. Sheet: Conformite_PM_B3
    const b3Header = [
      'ID Tâche',
      'Code Machine',
      'Équipement',
      'Classe',
      'Tâche Préventive',
      'Échéance Prévue',
      'Exécution Approuvée',
      'Statut Conformité',
      'Intervenant',
      'Réclamation En Attente',
    ];
    const b3Rows = (report.pmCompliance.items || []).map((item) => [
      item.taskId,
      item.machineCode,
      item.machineName,
      item.assetClass,
      item.taskName,
      item.dueDate,
      item.approvedExecutedAt || '-',
      item.statusLabelFr,
      item.assignedTo,
      item.hasPendingClaim ? 'OUI (Non approuvé)' : 'NON',
    ]);
    const b3All = [b3Header, ...b3Rows];
    const wsB3 = XLSX.utils.aoa_to_sheet(b3All);
    applyAutoFitColumns(wsB3, b3All);
    XLSX.utils.book_append_sheet(wb, wsB3, 'Conformite_PM_B3');

    // 4. Sheet: Mouvements_Valides_C2
    const c2Header = [
      'ID Mouvement',
      'Date',
      'N° Bon',
      'Type',
      'Code Machine',
      'Référence PDR',
      'Désignation',
      'Quantité',
      'Unité',
      `Prix Unitaire (${isoCode})`,
      `Coût Total (${isoCode})`,
    ];
    const c2Rows = (report.officialMovementsInPeriod || []).map((mvt) => [
      mvt.id,
      mvt.date,
      mvt.codeBon,
      mvt.type,
      mvt.machineCode,
      mvt.ref,
      mvt.designation,
      mvt.quantity,
      mvt.unit,
      mvt.unitPrice,
      mvt.totalCost,
    ]);
    const c2All = [c2Header, ...c2Rows];
    const wsC2 = XLSX.utils.aoa_to_sheet(c2All);
    applyAutoFitColumns(wsC2, c2All);
    XLSX.utils.book_append_sheet(wb, wsC2, 'Mouvements_Valides_C2');

    // 5. Sheet: Alertes_Reappro_C3
    const c3Header = [
      'Référence PDR',
      'Désignation',
      'Stock Actuel',
      'Réservé (En Attente)',
      'Net Disponible',
      'Seuil Minimum',
      'Statut Alerte',
    ];
    const c3Rows = (report.stockReorderAlerts?.items || []).map((it) => [
      it.ref,
      it.designation,
      it.stockActuel,
      it.reservedQty,
      it.netAvailable,
      it.seuil,
      it.statusLabelFr,
    ]);
    const c3All = [c3Header, ...c3Rows];
    const wsC3 = XLSX.utils.aoa_to_sheet(c3All);
    applyAutoFitColumns(wsC3, c3All);
    XLSX.utils.book_append_sheet(wb, wsC3, 'Alertes_Reappro_C3');

    const filename = `GMAO_Rapport_Exploitation_${report.fromYMD}_${report.toYMD}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  }

  /**
   * Triggers browser print dialog formatted for Executive PDF export (P2.2)
   */
  static triggerMonthlyReportPrint(): void {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }
}

export default MonthlyReportExportService;
