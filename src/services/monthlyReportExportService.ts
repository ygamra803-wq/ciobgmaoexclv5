import ExcelJS from 'exceljs';
import type {
  MonthlyFactoryReportData,
  MonthOverMonthComparison,
} from '../application/services/MonthlyReportCalculationService';
import type { PreventiveExecutionRecord } from '../types/preventive';
import { normalizeDateToYMD } from '../utils/datePeriodUtils';

export class MonthlyReportExportService {
  /**
   * Generates a multi-sheet ExcelJS workbook containing the complete monthly executive data.
   */
  static async generateMonthlyWorkbook({
    comparison,
    mouvements = [],
    correctiveInterventions = [],
    preventiveExecutions = [],
    stockItems = [],
  }: {
    comparison: MonthOverMonthComparison;
    mouvements?: any[];
    correctiveInterventions?: any[];
    preventiveExecutions?: PreventiveExecutionRecord[];
    stockItems?: any[];
  }): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CIOB GMAO v4 Industrial Engine';
    workbook.created = new Date();

    const report = comparison.currentReport;
    const targetMonth = comparison.currentMonth;

    // Palette de styles industriels
    const headerFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }, // Slate 800
    };
    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    const accentFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Teal 700
    };
    const zebraFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF8FAFC' },
    };
    const alertFill: ExcelJS.Fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFEE2E2' },
    };
    const borderThin: Partial<ExcelJS.Borders> = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };

    // =========================================================================
    // FEUILLE 1: SYNTHÈSE DIRECTION
    // =========================================================================
    const ws1 = workbook.addWorksheet('Synthèse Direction', {
      views: [{ showGridLines: true }],
    });

    ws1.columns = [
      { width: 5 },
      { width: 35 },
      { width: 20 },
      { width: 20 },
      { width: 16 },
      { width: 24 },
    ];

    // Titre Officiel
    ws1.mergeCells('B2:F2');
    const titleCell = ws1.getCell('B2');
    titleCell.value = `RAPPORT MENSUEL EXÉCUTIF DIRECTION — PÉRIODE : ${targetMonth}`;
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF0F172A' } };
    titleCell.alignment = { vertical: 'middle' };
    ws1.getRow(2).height = 30;

    // Métadonnées
    ws1.getCell('B3').value = `Généré le : ${new Date().toLocaleString('fr-FR')} | GMAO Usine V4`;
    ws1.getCell('B3').font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };

    // Tableau des KPI Exécutifs
    ws1.getRow(5).values = ['', 'Indicateur Clé (KPI Direction)', `Mois (${targetMonth})`, `Mois Précédent (${comparison.previousMonth})`, 'Évolution (MoM)', 'Statut'];
    const r5 = ws1.getRow(5);
    r5.height = 24;
    for (let c = 2; c <= 6; c++) {
      const cell = r5.getCell(c);
      cell.fill = accentFill;
      cell.font = headerFont;
      cell.alignment = { vertical: 'middle', horizontal: c >= 3 && c <= 5 ? 'right' : 'left' };
      cell.border = borderThin;
    }

    const kpiRows = [
      [
        'Consommation Pièces & Matières (DT)',
        report.monthConsumptionCost,
        comparison.previousReport.monthConsumptionCost,
        `${comparison.consumptionCostDelta.percent > 0 ? '+' : ''}${comparison.consumptionCostDelta.percent}%`,
        comparison.consumptionCostDelta.trend === 'UP' ? 'Hausse des sorties' : 'Optimisation',
      ],
      [
        'Pannes & Interventions Correctives',
        report.correctiveCount,
        comparison.previousReport.correctiveCount,
        `${comparison.correctiveCountDelta.percent > 0 ? '+' : ''}${comparison.correctiveCountDelta.percent}%`,
        report.correctiveCount === 0 ? 'Excellente fiabilité' : `${report.correctiveClosedCount} clôturés`,
      ],
      [
        'Temps Total d\'Arrêt Machine (Heures)',
        report.totalDowntimeHours,
        comparison.previousReport.totalDowntimeHours,
        `${comparison.downtimeHoursDelta.percent > 0 ? '+' : ''}${comparison.downtimeHoursDelta.percent}%`,
        report.totalDowntimeHours > 10 ? 'Alerte indisponibilité' : 'Normal',
      ],
      [
        'Taux d\'Incurrence Préventif (%)',
        `${report.preventiveDisciplineRate}%`,
        `${comparison.previousReport.preventiveDisciplineRate}%`,
        `${comparison.preventiveDisciplineDelta.diff > 0 ? '+' : ''}${comparison.preventiveDisciplineDelta.diff}%`,
        report.preventiveDisciplineRate >= 80 ? 'Conforme' : 'Attention retard',
      ],
      [
        'Valorisation Totale du Stock PDR (DT)',
        report.stockValuationTotal,
        comparison.previousReport.stockValuationTotal,
        `${comparison.stockValuationDelta.percent > 0 ? '+' : ''}${comparison.stockValuationDelta.percent}%`,
        `${report.ruptureCount} Ruptures / ${report.alerteCount} Alertes`,
      ],
      [
        'Dépenses Main-d\'Œuvre & Pièces Préventif (DT)',
        report.preventiveTotalCost,
        comparison.previousReport.preventiveTotalCost,
        '-',
        `${report.preventiveLaborHours} h MO passées`,
      ],
    ];

    kpiRows.forEach((row, idx) => {
      const rowNum = 6 + idx;
      const r = ws1.getRow(rowNum);
      r.values = ['', ...row];
      r.height = 20;
      for (let c = 2; c <= 6; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Segoe UI', size: 9.5 };
        cell.border = borderThin;
        if (idx % 2 === 1) cell.fill = zebraFill;
        if (c >= 3 && c <= 5) cell.alignment = { horizontal: 'right' };
      }
    });

    // Top 5 Pièces consommées
    const topRowStart = 14;
    ws1.getCell(`B${topRowStart}`).value = 'Top 5 Pièces Consommées sur le Mois';
    ws1.getCell(`B${topRowStart}`).font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };

    ws1.getRow(topRowStart + 1).values = ['', 'Référence Article', 'Désignation', 'Quantité Sortie', 'Prix Unitaire (DT)', 'Montant Total (DT)'];
    const rTopHead = ws1.getRow(topRowStart + 1);
    rTopHead.height = 22;
    for (let c = 2; c <= 6; c++) {
      const cell = rTopHead.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
    }

    report.topConsumedParts.forEach((p, idx) => {
      const rowNum = topRowStart + 2 + idx;
      const r = ws1.getRow(rowNum);
      r.values = ['', p.ref, p.designation, `${p.quantity} ${p.unit}`, p.unitPrice, p.totalCost];
      for (let c = 2; c <= 6; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Segoe UI', size: 9 };
        cell.border = borderThin;
        if (c >= 4) cell.alignment = { horizontal: 'right' };
      }
    });

    // =========================================================================
    // FEUILLE 2: MOUVEMENTS DU MOIS
    // =========================================================================
    const ws2 = workbook.addWorksheet('Mouvements du Mois', { views: [{ showGridLines: true }] });
    ws2.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Type', key: 'type', width: 18 },
      { header: 'Réf Article', key: 'ref', width: 18 },
      { header: 'Désignation', key: 'designation', width: 30 },
      { header: 'Quantité', key: 'quantite', width: 12 },
      { header: 'Prix U. (DT)', key: 'prix', width: 14 },
      { header: 'Total (DT)', key: 'total', width: 16 },
      { header: 'Machine', key: 'machine', width: 16 },
      { header: 'Technicien / Auteur', key: 'technicien', width: 22 },
    ];

    const r2Head = ws2.getRow(1);
    r2Head.height = 24;
    for (let c = 1; c <= 9; c++) {
      const cell = r2Head.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
    }

    const monthMovements = (mouvements || []).filter((m) => {
      const d = normalizeDateToYMD(m.date);
      return d && d.startsWith(targetMonth);
    });

    monthMovements.forEach((m, idx) => {
      const qty = Math.abs(Number(m.quantite || 1));
      const price = Number(m.prix_unitaire ?? m.prix_achat_ht ?? m.prix ?? 0);
      const total = Number((qty * price).toFixed(2));
      const r = ws2.addRow({
        date: normalizeDateToYMD(m.date),
        type: m.type || 'Sortie Interne',
        ref: m.ref || '',
        designation: m.designation || '',
        quantite: qty,
        prix: price,
        total,
        machine: m.id_machine_registered || m.machine || '-',
        technicien: m.technicien || m.user || '-',
      });
      r.font = { name: 'Segoe UI', size: 9 };
      for (let c = 1; c <= 9; c++) {
        const cell = r.getCell(c);
        cell.border = borderThin;
        if (idx % 2 === 1) cell.fill = zebraFill;
      }
    });

    // =========================================================================
    // FEUILLE 3: PANNES & CORRECTIF
    // =========================================================================
    const ws3 = workbook.addWorksheet('Pannes & Correctif', { views: [{ showGridLines: true }] });
    ws3.columns = [
      { header: 'N° BT / DI', key: 'id', width: 16 },
      { header: 'Machine', key: 'machine', width: 18 },
      { header: 'Date Demande', key: 'date', width: 14 },
      { header: 'Description Panne', key: 'desc', width: 35 },
      { header: 'Arrêt (Heures)', key: 'downtime', width: 14 },
      { header: 'Coût PDR (DT)', key: 'pdr_cost', width: 14 },
      { header: 'Statut', key: 'statut', width: 16 },
      { header: 'Intervenant', key: 'technicien', width: 20 },
    ];

    const r3Head = ws3.getRow(1);
    r3Head.height = 24;
    for (let c = 1; c <= 8; c++) {
      const cell = r3Head.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
    }

    const monthCorrective = (correctiveInterventions || []).filter((ci) => {
      const d = normalizeDateToYMD(ci.date_demande || ci.date || ci.date_cloture);
      return d && d.startsWith(targetMonth);
    });

    monthCorrective.forEach((ci, idx) => {
      const dt = Number(ci.downtimeHours ?? (ci.temps_arret_minutes ? Number(ci.temps_arret_minutes) / 60 : 0) ?? 0);
      const r = ws3.addRow({
        id: ci.id || ci.code_bon || '-',
        machine: ci.code_machine || ci.nom_machine || '-',
        date: normalizeDateToYMD(ci.date_demande || ci.date),
        desc: ci.description_panne || ci.panne || ci.description || '-',
        downtime: Number(dt.toFixed(1)),
        pdr_cost: Number((ci.pdr_cost || 0).toFixed(2)),
        statut: ci.statut || ci.etat || 'CLOTURE',
        technicien: ci.technicien || ci.intervenant || '-',
      });
      r.font = { name: 'Segoe UI', size: 9 };
      for (let c = 1; c <= 8; c++) {
        const cell = r.getCell(c);
        cell.border = borderThin;
        if (idx % 2 === 1) cell.fill = zebraFill;
      }
    });

    // =========================================================================
    // FEUILLE 4: EXÉCUTION PRÉVENTIF
    // =========================================================================
    const ws4 = workbook.addWorksheet('Exécutions Préventif', { views: [{ showGridLines: true }] });
    ws4.columns = [
      { header: 'Code Exécution', key: 'id', width: 18 },
      { header: 'Machine', key: 'machine', width: 16 },
      { header: 'Composant / Organe', key: 'organe', width: 22 },
      { header: 'Date Exécution', key: 'date', width: 14 },
      { header: 'Technicien', key: 'technicien', width: 20 },
      { header: 'Durée (min)', key: 'duree', width: 12 },
      { header: 'Coût Pièces (DT)', key: 'sparesCost', width: 14 },
      { header: 'Coût Total (DT)', key: 'totalCost', width: 14 },
      { header: 'Statut', key: 'statut', width: 12 },
    ];

    const r4Head = ws4.getRow(1);
    r4Head.height = 24;
    for (let c = 1; c <= 9; c++) {
      const cell = r4Head.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
    }

    const monthExecs = (preventiveExecutions || []).filter((e) => {
      const d = normalizeDateToYMD(e.executedAt);
      return (e.periodMonth && e.periodMonth === targetMonth) || (d && d.startsWith(targetMonth));
    });

    monthExecs.forEach((e, idx) => {
      const r = ws4.addRow({
        id: e.id || '-',
        machine: e.machineCode || e.machineName || '-',
        organe: e.organe || '-',
        date: normalizeDateToYMD(e.executedAt),
        technicien: e.executorName || '-',
        duree: e.durationMinutes || 0,
        sparesCost: Number((e.sparesCost || 0).toFixed(2)),
        totalCost: Number((e.totalCost || 0).toFixed(2)),
        statut: e.status || 'DONE',
      });
      r.font = { name: 'Segoe UI', size: 9 };
      for (let c = 1; c <= 9; c++) {
        const cell = r.getCell(c);
        cell.border = borderThin;
        if (idx % 2 === 1) cell.fill = zebraFill;
      }
    });

    // =========================================================================
    // FEUILLE 5: BESOINS D'ACHATS & RUPTURES
    // =========================================================================
    const ws5 = workbook.addWorksheet('Achats & Ruptures', { views: [{ showGridLines: true }] });
    ws5.columns = [
      { header: 'Réf PDR', key: 'ref', width: 18 },
      { header: 'Désignation Article', key: 'designation', width: 32 },
      { header: 'Stock Actuel', key: 'stock', width: 14 },
      { header: 'Seuil Min', key: 'seuil', width: 12 },
      { header: 'Statut Alerte', key: 'alerte', width: 14 },
      { header: 'Prix Unitaire (DT)', key: 'prix', width: 16 },
      { header: 'Quantité à Commander', key: 'commande', width: 20 },
    ];

    const r5Head = ws5.getRow(1);
    r5Head.height = 24;
    for (let c = 1; c <= 7; c++) {
      const cell = r5Head.getCell(c);
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.border = borderThin;
    }

    const criticalItems = (stockItems || []).filter((s) => {
      const st = Number(s.stockActuel ?? s.stock ?? s.stockInitial ?? 0);
      const seuil = Number(s.seuil ?? s.stockMin ?? 5);
      return st <= seuil;
    });

    criticalItems.forEach((item, idx) => {
      const st = Number(item.stockActuel ?? item.stock ?? item.stockInitial ?? 0);
      const seuil = Number(item.seuil ?? item.stockMin ?? 5);
      const isRupture = st <= 0;
      const qteCommander = Math.max(1, (seuil * 2) - Math.max(0, st));
      const r = ws5.addRow({
        ref: item.ref || '',
        designation: item.designation || '',
        stock: st,
        seuil,
        alerte: isRupture ? 'RUPTURE' : 'ALERTE',
        prix: Number(item.prix_unitaire ?? item.prix ?? 0),
        commande: qteCommander,
      });
      r.font = { name: 'Segoe UI', size: 9 };
      for (let c = 1; c <= 7; c++) {
        const cell = r.getCell(c);
        cell.border = borderThin;
        if (isRupture) {
          cell.fill = alertFill;
        } else if (idx % 2 === 1) {
          cell.fill = zebraFill;
        }
      }
    });

    return workbook;
  }

  /**
   * Downloads the monthly Excel report in browser environment
   */
  static async exportMonthlyReportToExcel(params: {
    comparison: MonthOverMonthComparison;
    mouvements?: any[];
    correctiveInterventions?: any[];
    preventiveExecutions?: PreventiveExecutionRecord[];
    stockItems?: any[];
  }): Promise<void> {
    const workbook = await this.generateMonthlyWorkbook(params);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GMAO_Rapport_Direction_${params.comparison.currentMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
  }
}

export default MonthlyReportExportService;
