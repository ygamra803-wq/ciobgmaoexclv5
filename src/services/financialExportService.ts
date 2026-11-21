/**
 * @file financialExportService.ts
 * @module services/financialExportService
 * @description
 * توليد ملف Excel متعدد الجداول (.xlsx) لتقرير ضبط تكاليف الصيانة والميزانية والأصول (Coûts Validés GMAO).
 */

import * as XLSX from 'xlsx';
import { FinancialSynthesis } from '../application/services/FinancialCalculationService';
import {
  convertCurrencyAmount,
  getCurrencyConfig,
  getCurrencySymbol,
  type CurrencyFinancialConfig,
} from '../utils/currencyService';
import { sanitizeSpreadsheetRows } from '../utils/spreadsheetSanitize';

export class FinancialExportService {
  static exportFinancialSynthesisToExcel(
    synthesis: FinancialSynthesis,
    currencySymbol?: string,
    currencyConfig?: CurrencyFinancialConfig
  ): void {
    const cfg = currencyConfig || getCurrencyConfig();
    const resolvedSymbol = currencySymbol || getCurrencySymbol(cfg);
    const conv = (amount: number): number => convertCurrencyAmount(amount, cfg);
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Synthèse Budgétaire (Annuelle + Alertes)
    const budgetRows = sanitizeSpreadsheetRows([
      ['Pilotage des Coûts & Budgets Maintenance (Coûts Validés GMAO)', '', '', '', '', ''],
      [
        `Exercice Fiscal: ${synthesis.fiscalYear}`,
        `Mode Période: ${synthesis.periodMode}`,
        `Seuil Alerte Burn: ${synthesis.burnWarningPercent}%`,
        `Date d'export: ${new Date().toLocaleDateString('fr-FR')}`,
        synthesis.budget.updatedBy ? `Configuré par: ${synthesis.budget.updatedBy}` : '',
        '',
      ],
      ['', '', '', '', '', ''],
      [
        'Poste Budgétaire',
        `Budget Alloué (${resolvedSymbol})`,
        `Dépenses Validées (${resolvedSymbol})`,
        `Écart / Variance (${resolvedSymbol})`,
        'Taux Consommation (%)',
        'Statut',
      ],
      ...synthesis.variances.map((v) => [
        v.labelFr,
        conv(v.allocated),
        conv(v.actual),
        conv(v.variance),
        v.allocated > 0 ? `${v.burnRatePercent}%` : 'Non alloué (0)',
        v.status === 'FAVORABLE'
          ? 'Favorable'
          : v.status === 'WARNING'
          ? `Sous surveillance (>=${synthesis.burnWarningPercent}%)`
          : v.status === 'UNCONFIGURED'
          ? 'Budget non défini (0)'
          : 'Dépassement (Déficit)',
      ]),
      ['', '', '', '', '', ''],
      [
        'TOTAL GÉNÉRAL',
        conv(synthesis.totalAllocated),
        conv(synthesis.totalActual),
        conv(synthesis.totalVariance),
        synthesis.totalAllocated > 0 ? `${synthesis.totalBurnRate}%` : '0%',
        synthesis.totalAllocated === 0 && synthesis.totalActual === 0
          ? 'Budget non défini'
          : synthesis.totalVariance >= 0
          ? 'Conforme'
          : 'Déficit',
      ],
    ]);
    const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);
    XLSX.utils.book_append_sheet(wb, wsBudget, 'Synthèse Budgétaire');

    // 2. Sheet: Suivi Mensuel & Alertes (FIN-P2)
    const monthlyHeader = [
      'Période',
      `Budget Total Alloué (${resolvedSymbol})`,
      `Dépenses Totales Validées (${resolvedSymbol})`,
      `Écart (${resolvedSymbol})`,
      'Taux Burn (%)',
      'Statut Période',
      `Préventif Réel (${resolvedSymbol})`,
      `Correctif Réel (${resolvedSymbol})`,
      `Externe Réel (${resolvedSymbol})`,
      `Achats PDR Réel (${resolvedSymbol})`,
    ];
    const monthlyRows = synthesis.monthlyBreakdown.map((m) => {
      const prev = m.variances.find((v) => v.key === 'preventive')?.actual || 0;
      const corr = m.variances.find((v) => v.key === 'corrective')?.actual || 0;
      const ext = m.variances.find((v) => v.key === 'external')?.actual || 0;
      const sp = m.variances.find((v) => v.key === 'spares')?.actual || 0;
      return [
        `${m.periodCode} - ${m.labelFr}`,
        conv(m.totalAllocated),
        conv(m.totalActual),
        conv(m.totalVariance),
        m.totalAllocated > 0 ? `${m.totalBurnRate}%` : '0%',
        m.status,
        conv(prev),
        conv(corr),
        conv(ext),
        conv(sp),
      ];
    });
    const wsMonthly = XLSX.utils.aoa_to_sheet(sanitizeSpreadsheetRows([monthlyHeader, ...monthlyRows]));
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Suivi Mensuel (12 Mois)');

    // 3. Sheet: TCO & Coûts par Machine (Zero Synthetic Assumptions)
    const tcoHeader = [
      'Code Machine',
      'Désignation',
      "Classe d'actif",
      'Zone / Atelier',
      `Valeur à Neuf (${resolvedSymbol})`,
      'Année Service',
      'Âge (Ans)',
      'Durée de Vie (Ans)',
      `Amortissement Annuel (${resolvedSymbol})`,
      `VNC Actuelle (${resolvedSymbol})`,
      `Coût Préventif (${resolvedSymbol})`,
      `Coût Correctif (${resolvedSymbol})`,
      `Coût Externe (${resolvedSymbol})`,
      `Coût Maint. Cumulé (${resolvedSymbol})`,
      `TCO Global (${resolvedSymbol})`,
      'Indice BER (%)',
      'Avis Économique',
    ];
    const tcoRows = synthesis.machinesTCO.map((m) => [
      m.code,
      m.name,
      m.assetClass,
      m.zone,
      m.valeurANeuf !== null ? conv(m.valeurANeuf) : 'Non évalué',
      m.anneeMiseEnService !== null ? m.anneeMiseEnService : 'Non renseigné',
      m.ageYears !== null ? m.ageYears : '—',
      m.dureeDeVieAns,
      m.tauxAmortissementAnnuel !== null ? conv(m.tauxAmortissementAnnuel) : 'Non évalué',
      m.valeurNetteComptable !== null ? conv(m.valeurNetteComptable) : 'Non évalué',
      conv(m.preventiveCost),
      conv(m.correctiveCost),
      conv(m.externalCost),
      conv(m.coutMaintenanceCumule),
      conv(m.tco),
      m.berIndexPercent !== null ? `${m.berIndexPercent}%` : 'Non évalué',
      m.berStatus === 'REPLACE_RECOMMENDED'
        ? 'Remplacement Recommandé (BER)'
        : m.berStatus === 'ATTENTION'
        ? 'Sous Surveillance'
        : m.berStatus === 'NON_EVALUE'
        ? 'Valeur à neuf non renseignée'
        : 'Économique & Rentable',
    ]);
    const wsTco = XLSX.utils.aoa_to_sheet(sanitizeSpreadsheetRows([tcoHeader, ...tcoRows]));
    XLSX.utils.book_append_sheet(wb, wsTco, 'TCO & Amortissement');

    // 4. Sheet: Main d'Œuvre & Arrêts de Production
    const laborHeader = [
      'Technicien / Intervenant',
      'Heures Travaillées Validées (h)',
      `Taux Horaire (${resolvedSymbol}/h)`,
      `Coût Main d'Œuvre (${resolvedSymbol})`,
      'Nombre Interventions',
    ];
    const laborRows = synthesis.technicianLaborBreakdown.map((t) => [
      t.name,
      t.hours,
      conv(synthesis.budget.technicianHourlyRate),
      conv(t.costMAD),
      t.interventionsCount,
    ]);
    const summaryLabor = [
      ['', '', '', '', ''],
      [
        "TOTAL MAIN D'ŒUVRE INTERNE",
        synthesis.internalLaborHours,
        conv(synthesis.budget.technicianHourlyRate),
        conv(synthesis.internalLaborCostMAD),
        '',
      ],
      ['', '', '', '', ''],
      ['Pertes Financières Arrêts Production (BT avec arrêt confirmé)', '', '', '', ''],
      ["Heures Totales d'Arrêt Usine", `${synthesis.totalDowntimeHours} heures`, '', '', ''],
      ['Coût Horaire Arrêt Usine', `${conv(synthesis.budget.productionDowntimeCostPerHour)} ${resolvedSymbol}/h`, '', '', ''],
      ['Impact Financier Total Pertes', `${conv(synthesis.totalDowntimeLossMAD)} ${resolvedSymbol}`, '', '', ''],
    ];
    const wsLabor = XLSX.utils.aoa_to_sheet(
      sanitizeSpreadsheetRows([laborHeader, ...laborRows, ...summaryLabor])
    );
    XLSX.utils.book_append_sheet(wb, wsLabor, "Main d'Œuvre & Pertes");

    const fileName = `GMAO_Pilotage_Couts_${synthesis.fiscalYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
