/**
 * @file financialExportService.ts
 * @module services/financialExportService
 * @description
 * توليد ملف Excel متعدد الجداول (.xlsx) لتقرير ضبط تكاليف الصيانة والميزانية والأصول (Coûts Validés GMAO).
 */

import * as XLSX from 'xlsx';
import { FinancialSynthesis } from '../application/services/FinancialCalculationService';

export class FinancialExportService {
  static exportFinancialSynthesisToExcel(synthesis: FinancialSynthesis, currencySymbol: string = 'DH'): void {
    const wb = XLSX.utils.book_new();

    // 1. Sheet: Synthèse Budgétaire (Annuelle + Alertes)
    const budgetRows = [
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
        `Budget Alloué (${currencySymbol})`,
        `Dépenses Validées (${currencySymbol})`,
        `Écart / Variance (${currencySymbol})`,
        'Taux Consommation (%)',
        'Statut',
      ],
      ...synthesis.variances.map((v) => [
        v.labelFr,
        v.allocated,
        v.actual,
        v.variance,
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
        synthesis.totalAllocated,
        synthesis.totalActual,
        synthesis.totalVariance,
        synthesis.totalAllocated > 0 ? `${synthesis.totalBurnRate}%` : '0%',
        synthesis.totalAllocated === 0 && synthesis.totalActual === 0
          ? 'Budget non défini'
          : synthesis.totalVariance >= 0
          ? 'Conforme'
          : 'Déficit',
      ],
    ];
    const wsBudget = XLSX.utils.aoa_to_sheet(budgetRows);
    XLSX.utils.book_append_sheet(wb, wsBudget, 'Synthèse Budgétaire');

    // 2. Sheet: Suivi Mensuel & Alertes (FIN-P2)
    const monthlyHeader = [
      'Période',
      `Budget Total Alloué (${currencySymbol})`,
      `Dépenses Totales Validées (${currencySymbol})`,
      `Écart (${currencySymbol})`,
      'Taux Burn (%)',
      'Statut Période',
      `Préventif Réel (${currencySymbol})`,
      `Correctif Réel (${currencySymbol})`,
      `Externe Réel (${currencySymbol})`,
      `Achats PDR Réel (${currencySymbol})`,
    ];
    const monthlyRows = synthesis.monthlyBreakdown.map((m) => {
      const prev = m.variances.find((v) => v.key === 'preventive')?.actual || 0;
      const corr = m.variances.find((v) => v.key === 'corrective')?.actual || 0;
      const ext = m.variances.find((v) => v.key === 'external')?.actual || 0;
      const sp = m.variances.find((v) => v.key === 'spares')?.actual || 0;
      return [
        `${m.periodCode} - ${m.labelFr}`,
        m.totalAllocated,
        m.totalActual,
        m.totalVariance,
        m.totalAllocated > 0 ? `${m.totalBurnRate}%` : '0%',
        m.status,
        prev,
        corr,
        ext,
        sp,
      ];
    });
    const wsMonthly = XLSX.utils.aoa_to_sheet([monthlyHeader, ...monthlyRows]);
    XLSX.utils.book_append_sheet(wb, wsMonthly, 'Suivi Mensuel (12 Mois)');

    // 3. Sheet: TCO & Coûts par Machine (Zero Synthetic Assumptions)
    const tcoHeader = [
      'Code Machine',
      'Désignation',
      "Classe d'actif",
      'Zone / Atelier',
      `Valeur à Neuf (${currencySymbol})`,
      'Année Service',
      'Âge (Ans)',
      'Durée de Vie (Ans)',
      `Amortissement Annuel (${currencySymbol})`,
      `VNC Actuelle (${currencySymbol})`,
      `Coût Préventif (${currencySymbol})`,
      `Coût Correctif (${currencySymbol})`,
      `Coût Externe (${currencySymbol})`,
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
      m.valeurANeuf !== null ? m.valeurANeuf : 'Non évalué',
      m.anneeMiseEnService !== null ? m.anneeMiseEnService : 'Non renseigné',
      m.ageYears !== null ? m.ageYears : '—',
      m.dureeDeVieAns,
      m.tauxAmortissementAnnuel !== null ? m.tauxAmortissementAnnuel : 'Non évalué',
      m.valeurNetteComptable !== null ? m.valeurNetteComptable : 'Non évalué',
      m.preventiveCost,
      m.correctiveCost,
      m.externalCost,
      m.coutMaintenanceCumule,
      m.tco,
      m.berIndexPercent !== null ? `${m.berIndexPercent}%` : 'Non évalué',
      m.berStatus === 'REPLACE_RECOMMENDED'
        ? 'Remplacement Recommandé (BER)'
        : m.berStatus === 'ATTENTION'
        ? 'Sous Surveillance'
        : m.berStatus === 'NON_EVALUE'
        ? 'Valeur à neuf non renseignée'
        : 'Économique & Rentable',
    ]);
    const wsTco = XLSX.utils.aoa_to_sheet([tcoHeader, ...tcoRows]);
    XLSX.utils.book_append_sheet(wb, wsTco, 'TCO & Amortissement');

    // 4. Sheet: Main d'Œuvre & Arrêts de Production
    const laborHeader = [
      'Technicien / Intervenant',
      'Heures Travaillées Validées (h)',
      `Taux Horaire (${currencySymbol}/h)`,
      `Coût Main d'Œuvre (${currencySymbol})`,
      'Nombre Interventions',
    ];
    const laborRows = synthesis.technicianLaborBreakdown.map((t) => [
      t.name,
      t.hours,
      synthesis.budget.technicianHourlyRate,
      t.costMAD,
      t.interventionsCount,
    ]);
    const summaryLabor = [
      ['', '', '', '', ''],
      [
        "TOTAL MAIN D'ŒUVRE INTERNE",
        synthesis.internalLaborHours,
        synthesis.budget.technicianHourlyRate,
        synthesis.internalLaborCostMAD,
        '',
      ],
      ['', '', '', '', ''],
      ['Pertes Financières Arrêts Production (BT avec arrêt confirmé)', '', '', '', ''],
      ["Heures Totales d'Arrêt Usine", `${synthesis.totalDowntimeHours} heures`, '', '', ''],
      ['Coût Horaire Arrêt Usine', `${synthesis.budget.productionDowntimeCostPerHour} ${currencySymbol}/h`, '', '', ''],
      ['Impact Financier Total Pertes', `${synthesis.totalDowntimeLossMAD} ${currencySymbol}`, '', '', ''],
    ];
    const wsLabor = XLSX.utils.aoa_to_sheet([laborHeader, ...laborRows, ...summaryLabor]);
    XLSX.utils.book_append_sheet(wb, wsLabor, "Main d'Œuvre & Pertes");

    const fileName = `GMAO_Pilotage_Couts_${synthesis.fiscalYear}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }
}
