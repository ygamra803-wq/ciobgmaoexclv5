/**
 * @file financialExportService.ts
 * @module services/financialExportService
 * @description
 * توليد ملف Excel متعدد الجداول (.xlsx) للتقرير المالي وحسابات التكلفة والعملات لـ GMAO.
 */

import * as XLSX from 'xlsx';
import { FinancialSynthesis } from '../application/services/FinancialCalculationService';

export class FinancialExportService {
  static exportFinancialSynthesisToExcel(synthesis: FinancialSynthesis, currencySymbol: string = 'DH'): void {
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Synthèse Budgétaire
    const budgetRows = [
      ['Rapport Financier & Gestion Budgétaire GMAO', '', '', '', ''],
      [`Exercice Fiscal: ${synthesis.fiscalYear}`, `Date d'export: ${new Date().toLocaleDateString('fr-FR')}`, '', '', ''],
      ['', '', '', '', ''],
      ['Poste Budgétaire', `Budget Alloué (${currencySymbol})`, `Dépenses Réalisées (${currencySymbol})`, `Écart / Variance (${currencySymbol})`, 'Taux Consommation (%)', 'Statut'],
      ...synthesis.variances.map((v) => [
        v.labelFr,
        v.allocated,
        v.actual,
        v.variance,
        `${v.burnRatePercent}%`,
        v.status === 'FAVORABLE' ? 'Favorable' : v.status === 'WARNING' ? 'Sous surveillance' : 'Dépassement',
      ]),
      ['', '', '', '', ''],
      ['TOTAL GÉNÉRAL', synthesis.totalAllocated, synthesis.totalActual, synthesis.totalVariance, `${synthesis.totalBurnRate}%`, synthesis.totalVariance >= 0 ? 'Conforme' : 'Déficit'],
    ];
    const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);
    XLSX.utils.book_append_sheet(wb, wsBudget, 'Synthèse Budgétaire');

    // 2. Sheet: TCO & Amortissement Machines
    const tcoHeader = [
      'Code Machine',
      'Désignation',
      'Classe d\'actif',
      'Zone / Atelier',
      `Valeur à Neuf (${currencySymbol})`,
      'Année Service',
      'Âge (Ans)',
      'Durée de Vie (Ans)',
      `Amortissement Annuel (${currencySymbol})`,
      `VNC Actuelle (${currencySymbol})`,
      `Coût Maint. Cumulé (${currencySymbol})`,
      `TCO Global (${currencySymbol})`,
      'Indice BER (%)',
      'Avis Économique',
    ];
    const tcoRows = synthesis.machinesTCO.map((m) => [
      m.code,
      m.name,
      m.assetClass,
      m.zone,
      m.valeurANeuf,
      m.anneeMiseEnService,
      m.ageYears,
      m.dureeDeVieAns,
      m.tauxAmortissementAnnuel,
      m.valeurNetteComptable,
      m.coutMaintenanceCumule,
      m.tco,
      `${m.berIndexPercent}%`,
      m.berStatus === 'REPLACE_RECOMMENDED'
        ? 'Remplacement Recommandé (BER)'
        : m.berStatus === 'ATTENTION'
        ? 'Sous Surveillance'
        : 'Économique & Rentable',
    ]);
    const wsTco = XLSX.utils.aoa_to_sheet([tcoHeader, ...tcoRows]);
    XLSX.utils.book_append_sheet(wb, wsTco, 'TCO & Amortissement');

    // 3. Sheet: Main d'Œuvre & Arrêts de Production
    const laborHeader = ['Technicien / Intervenant', 'Heures Travaillées (h)', `Taux Horaire (${currencySymbol}/h)`, `Coût Main d'Œuvre (${currencySymbol})`, 'Nombre Interventions'];
    const laborRows = synthesis.technicianLaborBreakdown.map((t) => [
      t.name,
      t.hours,
      synthesis.budget.technicianHourlyRate,
      t.costMAD,
      t.interventionsCount,
    ]);
    const summaryLabor = [
      ['', '', '', '', ''],
      ['TOTAL MAIN D\'ŒUVRE INTERNE', synthesis.internalLaborHours, synthesis.budget.technicianHourlyRate, synthesis.internalLaborCostMAD, ''],
      ['', '', '', '', ''],
      ['Pertes Financières Arrêts Production', '', '', '', ''],
      ['Heures Totales d\'Arrêt Usine', `${synthesis.totalDowntimeHours} heures`, '', '', ''],
      ['Coût Horaire Arrêt Usine', `${synthesis.budget.productionDowntimeCostPerHour} ${currencySymbol}/h`, '', '', ''],
      ['Impact Financier Total Pertes', `${synthesis.totalDowntimeLossMAD} ${currencySymbol}`, '', '', ''],
    ];
    const wsLabor = XLSX.utils.aoa_to_sheet([laborHeader, ...laborRows, ...summaryLabor]);
    XLSX.utils.book_append_sheet(wb, wsLabor, 'Main d\'Œuvre & Pertes');

    const fileName = `GMAO_Synthese_Financiere_${synthesis.fiscalYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
