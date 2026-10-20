import * as XLSX from 'xlsx';
import { normalizeDateToYMD } from '../utils/datePeriodUtils';
import type { MonthOverMonthComparison } from '../application/services/MonthlyReportCalculationService';

export interface MonthlyExportRawData {
  mouvements?: any[];
  correctiveInterventions?: any[];
  preventiveExecutions?: any[];
}

export class MonthlyReportExportService {
  /**
   * Generates a multi-sheet Excel workbook (.xlsx) for the selected month (P2.2):
   * 1. Synthese_Direction (KPIs + Month-over-Month Deltas + MTTR/MTBF/OEE)
   * 2. Ruptures_et_Alertes (Critical stock shortages requiring immediate purchase)
   * 3. Mouvements_du_Mois (Filtered movements in YYYY-MM)
   * 4. Pannes_Correctives_Mois (Filtered corrective interventions in YYYY-MM)
   * 5. Executions_Preventives (Filtered preventive executions in YYYY-MM)
   */
  static exportMonthlyReportToExcel(
    comparison: MonthOverMonthComparison,
    raw: MonthlyExportRawData = {}
  ): string {
    const { currentMonth, previousMonth, currentReport, previousReport } = comparison;
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Synthese_Direction
    const syntheseRows = [
      ['RAPPORT MENSUEL EXÉCUTIF DIRECTION — CIOB GMAO v4'],
      ['Période du Rapport', currentMonth, 'Comparaison vs Mois Précédent', previousMonth],
      [],
      ['INDICATEUR EXÉCUTIF', `Mois (${currentMonth})`, `Mois Précédent (${previousMonth})`, 'Écart (Delta)', 'Tendance (%)'],
      [
        'Valorisation Totale du Stock (DT)',
        currentReport.stockValuationTotal,
        previousReport.stockValuationTotal,
        comparison.stockValuationDelta.diff,
        `${comparison.stockValuationDelta.percent}%`,
      ],
      [
        'Coût Consommation PDR du Mois (DT)',
        currentReport.monthConsumptionCost,
        previousReport.monthConsumptionCost,
        comparison.consumptionCostDelta.diff,
        `${comparison.consumptionCostDelta.percent}%`,
      ],
      [
        'Coût Réceptions / Entrées du Mois (DT)',
        currentReport.monthEntriesCost,
        previousReport.monthEntriesCost,
        Number((currentReport.monthEntriesCost - previousReport.monthEntriesCost).toFixed(2)),
        '-',
      ],
      [
        'Commandes Ouvertes en Attente (DT)',
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
        'Total Interventions Correctives (Pannes)',
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
        'MTTR (Temps Moyen de Réparation)',
        currentReport.mttrFormatted,
        previousReport.mttrFormatted,
        `${currentReport.mttrHours}h`,
        'Maintenabilité',
      ],
      [
        'MTBF (Temps Moyen Entre Pannes)',
        `${currentReport.mtbfHours}h`,
        `${previousReport.mtbfHours}h`,
        currentReport.mtbfHours - previousReport.mtbfHours,
        'Fiabilité',
      ],
      [
        'Taux de Disponibilité Opérationnelle (OEE/TRS)',
        `${currentReport.availabilityRate}%`,
        `${previousReport.availabilityRate}%`,
        `${Number((currentReport.availabilityRate - previousReport.availabilityRate).toFixed(2))}%`,
        'Cible >= 95%',
      ],
    ];
    const wsSynthese = XLSX.utils.aoa_to_sheet(syntheseRows);
    XLSX.utils.book_append_sheet(wb, wsSynthese, 'Synthese_Direction');

    // 2. Sheet: Ruptures_et_Alertes
    const shortagesHeader = [
      'Statut Critique',
      'Référence PDR',
      'Désignation',
      'Stock Actuel',
      'Seuil Minimum',
      'Quantité à Commander Conseillée',
      'Prix Unitaire (DT)',
      'Budget Estimé (DT)',
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
    const wsShortages = XLSX.utils.aoa_to_sheet([shortagesHeader, ...shortagesRows]);
    XLSX.utils.book_append_sheet(wb, wsShortages, 'Ruptures_et_Alertes');

    // 3. Sheet: Mouvements_du_Mois
    const monthMovements = (raw.mouvements || []).filter((m) => {
      const d = normalizeDateToYMD(m.date);
      return d && d.startsWith(currentMonth);
    });
    const mvtHeader = ['Date', 'Code Bon', 'Type', 'Référence', 'Quantité', 'Prix Unitaire', 'Machine', 'Technicien', 'Commentaire'];
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
    const wsMvt = XLSX.utils.aoa_to_sheet([mvtHeader, ...mvtRows]);
    XLSX.utils.book_append_sheet(wb, wsMvt, 'Mouvements_du_Mois');

    // 4. Sheet: Pannes_Correctives_Mois
    const monthCorrective = (raw.correctiveInterventions || []).filter((ci) => {
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
    const wsCorr = XLSX.utils.aoa_to_sheet([corrHeader, ...corrRows]);
    XLSX.utils.book_append_sheet(wb, wsCorr, 'Pannes_Correctives_Mois');

    // 5. Sheet: Executions_Preventives
    const monthExecs = (raw.preventiveExecutions || []).filter((ex) => {
      const d = normalizeDateToYMD(ex.executedAt);
      return (ex.periodMonth && ex.periodMonth === currentMonth) || (d && d.startsWith(currentMonth));
    });
    const prevHeader = ['ID Exécution', 'Date Exécution', 'Code Machine', 'Tâche ID', 'Exécutant', 'Durée (min)', 'Coût Total (DT)', 'Notes'];
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
    const wsPrev = XLSX.utils.aoa_to_sheet([prevHeader, ...prevRows]);
    XLSX.utils.book_append_sheet(wb, wsPrev, 'Executions_Preventives');

    const filename = `GMAO_Rapport_Mensuel_Direction_${currentMonth}.xlsx`;
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
