import { describe, it, expect, beforeEach } from 'vitest';
import { FinancialCalculationService } from '../application/services/FinancialCalculationService';
import {
  DEFAULT_FISCAL_BUDGET,
  EMPTY_FISCAL_BUDGET,
  DEMO_FISCAL_BUDGET,
} from '../domain/finance/entities/FinancialBudget';
import { DataGateway } from '../application/DataGateway';
import { storageService } from '../utils/storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';

describe('FinancialCalculationService', () => {
  beforeEach(() => {
    storageService.removeItem(STORAGE_KEYS.FINANCIAL_BUDGETS);
  });

  it('converts foreign currencies to MAD correctly', () => {
    const rates = [
      {
        id: 'r1',
        date: '2026-01-15',
        sourceCurrency: 'EUR' as const,
        targetCurrency: 'MAD' as const,
        rate: 10.80,
      },
      {
        id: 'r2',
        date: '2026-01-15',
        sourceCurrency: 'USD' as const,
        targetCurrency: 'MAD' as const,
        rate: 10.00,
      },
    ];

    expect(FinancialCalculationService.convertToMAD(100, 'MAD', rates).amountMAD).toBe(100);
    expect(FinancialCalculationService.convertToMAD(100, 'DH', rates).amountMAD).toBe(100);
    expect(FinancialCalculationService.convertToMAD(50, 'EUR', rates).amountMAD).toBe(540);
    expect(FinancialCalculationService.convertToMAD(200, 'USD', rates).amountMAD).toBe(2000);
  });

  it('FIN-P0 & P2-3: starts with zero budget allocations in empty factory mode and emits zero false alerts', () => {
    expect(DEFAULT_FISCAL_BUDGET.allocatedPreventive).toBe(0);
    expect(DEFAULT_FISCAL_BUDGET.allocatedCorrective).toBe(0);
    expect(DEFAULT_FISCAL_BUDGET.allocatedExternal).toBe(0);
    expect(DEFAULT_FISCAL_BUDGET.allocatedSparesStock).toBe(0);

    // Demo budget remains distinct for explicit loadDemoData only
    expect(DEMO_FISCAL_BUDGET.allocatedPreventive).toBeGreaterThan(0);

    const synthesis = FinancialCalculationService.computeFinancialSynthesis({
      budget: EMPTY_FISCAL_BUDGET,
      machines: [],
      stockItems: [],
      correctiveInterventions: [],
      preventiveExecutions: [],
    });

    expect(synthesis.totalAllocated).toBe(0);
    expect(synthesis.totalActual).toBe(0);
    expect(synthesis.variances.every((v) => v.status === 'UNCONFIGURED')).toBe(true);
    expect(synthesis.monthlyBreakdown.every((m) => m.status === 'UNCONFIGURED')).toBe(true);
    expect(synthesis.budgetAlerts).toHaveLength(0);
  });

  it('FIN-P0 (Non-regression): does not invent valeur_a_neuf (120k) or annee_mise_en_service (2021) for unvalued machines', () => {
    const machines = [
      {
        id_machine_registered: 'MCH-UNVALUED',
        nom: 'Tour CNC Sans Prix',
        status: 'OPERATIONNELLE',
      },
    ];

    const synthesis = FinancialCalculationService.computeFinancialSynthesis({
      budget: DEFAULT_FISCAL_BUDGET,
      machines,
      correctiveInterventions: [
        {
          id: 'CI-1',
          code_machine: 'MCH-UNVALUED',
          cout_total: 4500,
          validation_status: 'VALIDE',
        },
      ],
    });

    const m = synthesis.machinesTCO[0];
    expect(m).toBeDefined();
    expect(m.isValued).toBe(false);
    expect(m.valeurANeuf).toBeNull();
    expect(m.anneeMiseEnService).toBeNull();
    expect(m.tauxAmortissementAnnuel).toBeNull();
    expect(m.valeurNetteComptable).toBeNull();
    expect(m.berIndexPercent).toBeNull();
    expect(m.berStatus).toBe('NON_EVALUE');
    expect(m.coutMaintenanceCumule).toBe(4500);
    expect(synthesis.machinesUnvaluedCount).toBe(1);
    expect(synthesis.machinesValuedCount).toBe(0);
  });

  it('FIN-P0: attributes preventive cost strictly per machine (never divides equally across active machines)', () => {
    const budget = {
      ...DEFAULT_FISCAL_BUDGET,
      fiscalYear: 2026,
      technicianHourlyRate: 50,
    };

    const machines = [
      {
        id_machine_registered: 'MCH-01',
        nom: 'Presse Hydraulique 100T',
        valeur_a_neuf: 100000,
        status: 'OPERATIONNELLE',
      },
      {
        id_machine_registered: 'MCH-02',
        nom: 'Compresseur Atlas',
        valeur_a_neuf: 50000,
        status: 'OPERATIONNELLE',
      },
    ];

    const preventiveExecutions = [
      {
        id: 'PE-1',
        machineCode: 'MCH-01',
        executedAt: '2026-03-10T10:00:00.000Z',
        durationMinutes: 60, // 1h -> 50 DH
        sparesCost: 200,     // 200 DH -> total 250 DH
        statut: 'CLOTUREE',
      },
    ];

    const synthesis = FinancialCalculationService.computeFinancialSynthesis({
      budget,
      machines,
      preventiveExecutions,
    });

    const m1 = synthesis.machinesTCO.find((m) => m.code === 'MCH-01');
    const m2 = synthesis.machinesTCO.find((m) => m.code === 'MCH-02');

    expect(m1?.preventiveCost).toBe(250);
    expect(m1?.coutMaintenanceCumule).toBe(250);
    expect(m2?.preventiveCost).toBe(0);
    expect(m2?.coutMaintenanceCumule).toBe(0);
  });

  it('FIN-P0: filters annual budget spend strictly by fiscalYear and does not invent downtime from repair duration', () => {
    const budget = {
      ...DEFAULT_FISCAL_BUDGET,
      fiscalYear: 2026,
      technicianHourlyRate: 50,
      productionDowntimeCostPerHour: 2000,
    };

    const machines = [
      {
        id_machine_registered: 'MCH-01',
        nom: 'Presse 100T',
        valeur_a_neuf: 100000,
        status: 'OPERATIONNELLE',
      },
    ];

    const stockItems = [
      { id: 'ART-PMP', code_article: 'RLM-6205', stockActuel: 10, prix_unitaire: 120 },
    ];

    const correctiveInterventions = [
      {
        id: 'CI-2026',
        code_machine: 'MCH-01',
        date_cloture: '2026-04-12',
        duree_intervention_min: 120, // 2h repair = 100 DH labor, NO downtime recorded
        pieces_utilisees: [{ code_article: 'RLM-6205', quantite: 2 }], // PMP lookup: 2 * 120 = 240 DH
        validation_status: 'VALIDE',
      },
      {
        id: 'CI-2024-OLD',
        code_machine: 'MCH-01',
        date_cloture: '2024-06-15',
        cout_total: 5000,
        validation_status: 'VALIDE',
      },
    ];

    const synthesis = FinancialCalculationService.computeFinancialSynthesis({
      budget,
      machines,
      stockItems,
      correctiveInterventions,
    });

    expect(synthesis.spendCorrective).toBe(340);
    expect(synthesis.totalDowntimeHours).toBe(0);
    expect(synthesis.totalDowntimeLossMAD).toBe(0);

    const m1 = synthesis.machinesTCO[0];
    expect(m1.coutMaintenanceExercice).toBe(340);
    expect(m1.coutMaintenanceCumule).toBe(5340);
  });

  it('FIN-P2 (P2-1, P2-2, P2-3, P2-4): aggregates monthly spend within fiscalYear and triggers WARNING (>=90%) and DEFICIT (>100%) alerts', () => {
    const budget = {
      ...DEFAULT_FISCAL_BUDGET,
      fiscalYear: 2026,
      periodMode: 'MONTHLY' as const,
      burnWarningPercent: 90,
      allocatedPreventive: 12000,   // 1,000 MAD / month
      allocatedCorrective: 24000,   // 2,000 MAD / month
      allocatedExternal: 12000,     // 1,000 MAD / month
      allocatedSparesStock: 12000,  // 1,000 MAD / month
      technicianHourlyRate: 50,
    };

    const machines = [
      {
        id_machine_registered: 'MCH-A',
        nom: 'Presse Zone A',
        id_zone_default: 'Atelier Emboutissage',
        valeur_a_neuf: 80000,
        status: 'OPERATIONNELLE',
      },
    ];

    const preventiveExecutions = [
      {
        id: 'PE-M03-WARN',
        machineCode: 'MCH-A',
        periodMonth: '2026-03',
        totalCost: 920, // 92% of 1,000 MAD monthly preventive envelope -> WARNING (>=90%)
        statut: 'CLOTUREE',
      },
      {
        id: 'PE-2025-EXCLUDED',
        machineCode: 'MCH-A',
        periodMonth: '2025-03',
        totalCost: 9999, // Different year -> must be excluded from 2026 monthly & annual spend
        statut: 'CLOTUREE',
      },
    ];

    const correctiveInterventions = [
      {
        id: 'CI-M05-DEFICIT',
        code_machine: 'MCH-A',
        date_cloture: '2026-05-18',
        cout_total: 2500, // 125% of 2,000 MAD monthly corrective envelope -> DEFICIT (>100%)
        validation_status: 'VALIDE',
      },
      {
        id: 'CI-M05-UNAPPROVED',
        code_machine: 'MCH-A',
        date_cloture: '2026-05-20',
        cout_total: 4000,
        validation_status: 'EN_ATTENTE_VALIDATION', // Unapproved -> excluded
      },
    ];

    const synthesis = FinancialCalculationService.computeFinancialSynthesis({
      budget,
      machines,
      preventiveExecutions,
      correctiveInterventions,
    });

    expect(synthesis.monthlyBreakdown).toHaveLength(12);
    expect(synthesis.quarterlyBreakdown).toHaveLength(4);

    // Month 3 (Mars - M03): Preventive is 920 / 1000 = 92% -> WARNING
    const march = synthesis.monthlyBreakdown[2];
    expect(march.periodCode).toBe('M03');
    const marchPrev = march.variances.find((v) => v.key === 'preventive');
    expect(marchPrev?.allocated).toBe(1000);
    expect(marchPrev?.actual).toBe(920);
    expect(marchPrev?.burnRatePercent).toBe(92);
    expect(marchPrev?.status).toBe('WARNING');
    expect(march.zoneCostBreakdown[0].zone).toBe('Atelier Emboutissage');
    expect(march.zoneCostBreakdown[0].preventiveCost).toBe(920);

    // Month 5 (Mai - M05): Corrective is 2500 / 2000 = 125% -> DEFICIT
    const may = synthesis.monthlyBreakdown[4];
    expect(may.periodCode).toBe('M05');
    const mayCorr = may.variances.find((v) => v.key === 'corrective');
    expect(mayCorr?.allocated).toBe(2000);
    expect(mayCorr?.actual).toBe(2500);
    expect(mayCorr?.burnRatePercent).toBe(125);
    expect(mayCorr?.status).toBe('DEFICIT');

    // Alerts: DEFICIT sorted first, followed by WARNING
    expect(synthesis.budgetAlerts.length).toBeGreaterThanOrEqual(2);
    expect(synthesis.budgetAlerts[0].status).toBe('DEFICIT');
    expect(synthesis.budgetAlerts[0].periodCode).toBe('M05');
    expect(synthesis.budgetAlerts[1].status).toBe('WARNING');
    expect(synthesis.budgetAlerts[1].periodCode).toBe('M03');
  });

  it('FIN-P2 (P2-5): records updatedBy, updatedAt, and caps budgetChangeLog at last 5 entries in DataGateway', () => {
    for (let i = 1; i <= 7; i++) {
      DataGateway.saveFinancialBudget(
        {
          fiscalYear: 2026,
          periodMode: 'MONTHLY',
          allocatedPreventive: i * 10000,
          allocatedCorrective: 20000,
          allocatedExternal: 5000,
          allocatedSparesStock: 15000,
        },
        `Manager_${i}`
      );
    }

    const saved = DataGateway.getFinancialBudget();
    expect(saved.updatedBy).toBe('Manager_7');
    expect(saved.periodMode).toBe('MONTHLY');
    expect(saved.budgetChangeLog).toBeDefined();
    expect(saved.budgetChangeLog).toHaveLength(5);
    // Most recent entry is first
    expect(saved.budgetChangeLog?.[0].updatedBy).toBe('Manager_7');
    expect(saved.budgetChangeLog?.[4].updatedBy).toBe('Manager_3');
  });

  it('flags machine with BER recommendation when maintenance spend exceeds threshold', () => {
    const budget = {
      ...DEFAULT_FISCAL_BUDGET,
      technicianHourlyRate: 50,
      berThresholdPercent: 70,
    };

    const machines = [
      {
        id_machine_registered: 'MCH-CRITIC',
        nom: 'Ancien Broyeur',
        valeur_a_neuf: 10000,
        status: 'OPERATIONNELLE',
      },
    ];

    const correctiveInterventions = [
      {
        id: 'CI-HEAVY',
        code_machine: 'MCH-CRITIC',
        cout_total: 8500, // 85% of 10,000 -> exceeds 70% BER
        validation_status: 'VALIDE',
      },
    ];

    const synthesis = FinancialCalculationService.computeFinancialSynthesis({
      budget,
      machines,
      correctiveInterventions,
    });

    const m = synthesis.machinesTCO.find((x) => x.code === 'MCH-CRITIC');
    expect(m?.berIndexPercent).toBeGreaterThanOrEqual(70);
    expect(m?.berStatus).toBe('REPLACE_RECOMMENDED');
    expect(synthesis.machinesBerCount).toBe(1);
  });

  it('verifies finance is configured as a dedicated parent module in navConfig.ts', async () => {
    const { PARENT_MODULES, getParentModuleForTab } = await import('../presentation/components/layout/navConfig');
    const financeModule = PARENT_MODULES.find((m) => m.id === 'finance');
    expect(financeModule).toBeDefined();
    expect(financeModule?.children[0].id).toBe('finance');

    const financeIndex = PARENT_MODULES.findIndex((m) => m.id === 'finance');
    expect(financeIndex).toBe(1);

    const resolvedParent = getParentModuleForTab('finance');
    expect(resolvedParent.id).toBe('finance');
  });
});
