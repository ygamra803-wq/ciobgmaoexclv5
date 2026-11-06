import { describe, it, expect } from 'vitest';
import { FinancialCalculationService } from '../application/services/FinancialCalculationService';
import {
  DEFAULT_FISCAL_BUDGET,
  EMPTY_FISCAL_BUDGET,
  DEMO_FISCAL_BUDGET,
} from '../domain/finance/entities/FinancialBudget';

describe('FinancialCalculationService', () => {
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

  it('FIN-P0: starts with zero budget allocations in empty factory mode (no silent demo budget)', () => {
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
  });

  it('FIN-P0: does not invent valeur_a_neuf (120k) or annee_mise_en_service (2021) for unvalued machines', () => {
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
    // MCH-02 had zero preventive executions -> must be 0, NOT 125!
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

    // Only 2026 intervention is counted in 2026 fiscal spend: 240 (PMP parts) + 100 (labor) = 340 DH
    expect(synthesis.spendCorrective).toBe(340);

    // No downtime was recorded on CI-2026 -> must be 0, NOT 2 hours from duree_intervention_min
    expect(synthesis.totalDowntimeHours).toBe(0);
    expect(synthesis.totalDowntimeLossMAD).toBe(0);

    // Machine TCO tracks both fiscal year (340 DH) and lifetime cumulative (5340 DH)
    const m1 = synthesis.machinesTCO[0];
    expect(m1.coutMaintenanceExercice).toBe(340);
    expect(m1.coutMaintenanceCumule).toBe(5340);
  });

  it('computes financial synthesis with budget variances, PMP valuation, and explicit downtime losses', () => {
    const budget = {
      ...DEFAULT_FISCAL_BUDGET,
      fiscalYear: 2026,
      allocatedPreventive: 100000,
      allocatedCorrective: 80000,
      allocatedExternal: 50000,
      allocatedSparesStock: 120000,
      technicianHourlyRate: 50,
      productionDowntimeCostPerHour: 2000,
      berThresholdPercent: 70,
      defaultVatRate: 20,
    };

    const machines = [
      {
        id_machine_registered: 'MCH-01',
        nom: 'Presse Hydraulique 100T',
        valeur_a_neuf: 100000,
        annee_mise_en_service: 2022,
        duree_vie_ans: 10,
        status: 'OPERATIONNELLE',
      },
      {
        id_machine_registered: 'MCH-02',
        nom: 'Compresseur Atlas',
        valeur_a_neuf: 50000,
        annee_mise_en_service: 2018,
        duree_vie_ans: 8,
        status: 'OPERATIONNELLE',
      },
    ];

    const stockItems = [
      { id: 'ART-1', stockActuel: 10, prix_unitaire: 150 },
      { id: 'ART-2', stockActuel: 5, prix_unitaire: 300 },
    ];

    const correctiveInterventions = [
      {
        id: 'CI-1',
        code_machine: 'MCH-01',
        duree_intervention_min: 120, // 2h -> 2 * 50 = 100 DH
        duree_arret_minutes: 60,     // 1h explicit downtime -> 2000 DH loss
        pieces_utilisees: [{ quantite: 2, prix_unitaire: 150 }], // 300 DH
        validation_status: 'VALIDE',
      },
      {
        id: 'CI-PENDING',
        code_machine: 'MCH-01',
        duree_intervention_min: 600,
        validation_status: 'EN_ATTENTE_VALIDATION', // Should be excluded
      },
    ];

    const preventiveExecutions = [
      {
        id: 'PE-1',
        machineCode: 'MCH-01',
        duree_minutes: 60, // 1h -> 50 DH
        pieces_cout: 200,  // 200 DH -> total 250 DH
        statut: 'CLOTUREE',
      },
    ];

    const synthesis = FinancialCalculationService.computeFinancialSynthesis({
      budget,
      machines,
      stockItems,
      correctiveInterventions,
      preventiveExecutions,
    });

    // PMP Stock Valuation: 10*150 + 5*300 = 1500 + 1500 = 3000
    expect(synthesis.stockValuationPMP_MAD).toBe(3000);
    expect(synthesis.stockValuationWithVAT_MAD).toBe(3600); // 3000 * 1.20

    // Corrective spend on approved CI-1: 300 (parts) + 100 (labor) = 400
    expect(synthesis.spendCorrective).toBe(400);

    // Preventive spend: 200 + 50 = 250
    expect(synthesis.spendPreventive).toBe(250);

    // Downtime: 60 min = 1h * 2000 DH = 2000 DH
    expect(synthesis.totalDowntimeHours).toBe(1);
    expect(synthesis.totalDowntimeLossMAD).toBe(2000);

    // Variances
    const prevVar = synthesis.variances.find((v) => v.key === 'preventive');
    expect(prevVar?.allocated).toBe(100000);
    expect(prevVar?.actual).toBe(250);
    expect(prevVar?.status).toBe('FAVORABLE');

    // Machines TCO calculation
    expect(synthesis.machinesTCO.length).toBe(2);
    const m1 = synthesis.machinesTCO.find((m) => m.code === 'MCH-01');
    expect(m1).toBeDefined();
    expect(m1?.valeurANeuf).toBe(100000);
    expect(m1?.preventiveCost).toBe(250);
    expect(m1?.correctiveCost).toBe(400);
    expect(m1?.berIndexPercent).toBeLessThan(70);
    expect(m1?.berStatus).toBe('OPTIMAL');
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

    // Index is right at the top (index 1, directly beside dashboard)
    const financeIndex = PARENT_MODULES.findIndex((m) => m.id === 'finance');
    expect(financeIndex).toBe(1);

    // Resolves correctly as parent module
    const resolvedParent = getParentModuleForTab('finance');
    expect(resolvedParent.id).toBe('finance');
  });
});
