import { describe, it, expect } from 'vitest';
import { MonthlyReportCalculationService } from '../../application/services/MonthlyReportCalculationService';
import { dataIntegrityService } from '../../services/dataIntegrityService';
import { filterActiveMachines, filterProductionMachines, getMachineAssetClass } from '../../utils/activeMachines';
import { computeReservedStockMap } from '../../core/security/validationReconciliation';
import { evaluateComponentWearAndLifecycle } from '../../utils/componentHealthScore';
import { networkConfigService } from '../../services/networkConfigService';

describe('Audit Fixes — 5 Core GMAO Blind Spots', () => {
  describe('Point #1a & #1b: MonthlyReportCalculationService Production Machines & Maker-Checker Filtering', () => {
    it('excludes SYSTEM_GENERAL and ARCHIVEE machines from scheduledPlantHours (MTBF/Availability)', () => {
      const machines = [
        { id_machine_registered: 'PRS-01', nom: 'Presse 1', status: 'ACTIF', asset_class: 'PRODUCTION' },
        { id_machine_registered: 'PRS-02', nom: 'Presse 2', status: 'ACTIF', asset_class: 'PRODUCTION' },
        { id_machine_registered: 'PRS-OLD', nom: 'Ancienne Presse', status: 'ARCHIVEE', asset_class: 'PRODUCTION' },
        { id_machine_registered: 'SEC-01', nom: 'Extincteur CO2', status: 'ACTIF', asset_class: 'SYSTEM_GENERAL' },
        { id_machine_registered: 'AIR-01', nom: 'Compresseur Air', status: 'ACTIF', asset_class: 'SYSTEM_GENERAL' },
      ];

      const correctiveInterventions = [
        {
          id: 'BT-100',
          code_machine: 'PRS-01',
          date_demande: '2026-05-10',
          statut: 'CLOTURE',
          arret_machine: 'OUI',
          temps_arret_minutes: 120, // 2h downtime
          validation_status: 'APPROVED',
        },
      ];

      const report = MonthlyReportCalculationService.calculateMonthlyReport({
        month: '2026-05',
        machines,
        correctiveInterventions,
      });

      // Only 2 active PRODUCTION machines => 2 * 160 = 320 scheduled plant hours
      // With 1 failure of 2h downtime: MTBF = (320 - 2) / 1 = 318h
      expect(report.mtbfHours).toBe(318);
    });

    it('excludes PENDING_VALIDATION, REJECTED, and NEEDS_CLARIFICATION claims from monthly report', () => {
      const correctiveInterventions = [
        {
          id: 'BT-APPROVED',
          code_machine: 'PRS-01',
          date_demande: '2026-05-10',
          statut: 'CLOTURE',
          temps_arret_minutes: 60,
          cout_pdr: 150,
          validation_status: 'APPROVED',
        },
        {
          id: 'BT-PENDING',
          code_machine: 'PRS-01',
          date_demande: '2026-05-11',
          statut: 'CLOTURE',
          temps_arret_minutes: 180,
          cout_pdr: 900,
          validation_status: 'PENDING_VALIDATION',
        },
        {
          id: 'BT-REJECTED',
          code_machine: 'PRS-01',
          date_demande: '2026-05-12',
          statut: 'CLOTURE',
          temps_arret_minutes: 120,
          cout_pdr: 500,
          validation_status: 'REJECTED',
        },
      ];

      const preventiveExecutions = [
        {
          id: 'EX-1',
          taskId: 'PM-1',
          machineCode: 'PRS-01',
          executedAt: '2026-05-05T10:00:00Z',
          periodMonth: '2026-05',
          durationMinutes: 60,
          totalCost: 80,
          sparePartsUsed: [],
          validation_status: 'APPROVED' as const,
        },
        {
          id: 'EX-2-PENDING',
          taskId: 'PM-2',
          machineCode: 'PRS-01',
          executedAt: '2026-05-06T10:00:00Z',
          periodMonth: '2026-05',
          durationMinutes: 120,
          totalCost: 400,
          sparePartsUsed: [],
          validation_status: 'PENDING_VALIDATION' as const,
        },
      ];

      const report = MonthlyReportCalculationService.calculateMonthlyReport({
        month: '2026-05',
        correctiveInterventions,
        preventiveExecutions,
      });

      expect(report.correctiveCount).toBe(1);
      expect(report.totalDowntimeHours).toBe(1);
      expect(report.correctiveSparesCost).toBe(150);
      expect(report.preventiveExecutedCount).toBe(1);
      expect(report.preventiveTotalCost).toBe(80);
    });
  });

  describe('Point #2: dataIntegrityService Movement Normalization Parity with IncrementalStockIndex', () => {
    it('recognizes Sortie Interne, Sortie Externe, Entrée Interne, Retour, and COMMANDE without false drift or type errors', () => {
      const stock = [
        {
          ref: 'RLM-6205',
          stockInitial: 10,
          // 10 + 5 (Entrée Interne) + 2 (Retour) - 3 (Sortie Interne) - 1 (Sortie Externe) = 13
          // COMMANDE of 20 should NOT mutate stockActuel
          stockActuel: 13,
          seuil: 2,
        },
      ];

      const movements = [
        { ref: 'RLM-6205', type: 'Entrée Interne', quantite: 5, date: '2026-05-01' },
        { ref: 'RLM-6205', type: 'Retour', quantite: 2, date: '2026-05-02' },
        { ref: 'RLM-6205', type: 'Sortie Interne', quantite: 3, date: '2026-05-03' },
        { ref: 'RLM-6205', type: 'Sortie Externe', quantite: 1, date: '2026-05-04' },
        { ref: 'RLM-6205', type: 'COMMANDE', quantite: 20, date: '2026-05-05' },
      ];

      const stockCheck = dataIntegrityService.validateStockIntegrity(stock as any, movements as any);
      expect(stockCheck.valid).toBe(true);
      expect(stockCheck.warnings.filter((w: any) => w.type === 'STOCK_CALCULATION_DRIFT')).toHaveLength(0);

      const mvtCheck = dataIntegrityService.validateMovementIntegrity(movements as any);
      expect(mvtCheck.valid).toBe(true);
      expect(mvtCheck.errors).toHaveLength(0);
    });
  });

  describe('Point #3 & #4: Active Production vs Système Général Filtering', () => {
    it('correctly separates PRODUCTION and SYSTEM_GENERAL active machines', () => {
      const machines = [
        { id_machine_registered: 'PRS-01', status: 'ACTIF', asset_class: 'PRODUCTION' },
        { id_machine_registered: 'SEC-01', status: 'ACTIF', asset_class: 'SYSTEM_GENERAL' },
        { id_machine_registered: 'PRS-ARCH', status: 'ARCHIVEE', asset_class: 'PRODUCTION' },
      ];

      const active = filterActiveMachines(machines);
      expect(active).toHaveLength(2);

      const prodOnly = filterProductionMachines(machines);
      expect(prodOnly).toHaveLength(1);
      expect(prodOnly[0].id_machine_registered).toBe('PRS-01');

      const sysGenOnly = active.filter((m) => getMachineAssetClass(m) === 'SYSTEM_GENERAL');
      expect(sysGenOnly).toHaveLength(1);
      expect(sysGenOnly[0].id_machine_registered).toBe('SEC-01');
    });
  });

  describe('Point #5: MonthlyReportCalculationService Fair Preventive Scheduled Count', () => {
    it('excludes tasks on archived machines and tasks scheduled strictly for future months from current month discipline penalty', () => {
      const machines = [
        { id_machine_registered: 'PRS-01', status: 'ACTIF', asset_class: 'PRODUCTION' },
        { id_machine_registered: 'PRS-ARCH', status: 'ARCHIVEE', asset_class: 'PRODUCTION' },
      ];

      const preventiveTasks = [
        { id: 'PM-DUE-NOW', code_machine: 'PRS-01', nextDueDate: '2026-05-15' },
        { id: 'PM-FUTURE-ANNUAL', code_machine: 'PRS-01', nextDueDate: '2026-11-20' },
        { id: 'PM-ARCHIVED-MACHINE', code_machine: 'PRS-ARCH', nextDueDate: '2026-05-10' },
        { id: 'PM-INACTIVE', code_machine: 'PRS-01', active: false, nextDueDate: '2026-05-10' },
      ];

      const preventiveExecutions = [
        {
          id: 'EX-1',
          taskId: 'PM-DUE-NOW',
          machineCode: 'PRS-01',
          executedAt: '2026-05-14T09:00:00Z',
          periodMonth: '2026-05',
          durationMinutes: 45,
          totalCost: 0,
          sparePartsUsed: [],
        },
      ];

      const report = MonthlyReportCalculationService.calculateMonthlyReport({
        month: '2026-05',
        machines,
        preventiveTasks,
        preventiveExecutions,
      });

      expect(report.preventiveScheduledCount).toBe(1);
      expect(report.preventiveExecutedCount).toBe(1);
      expect(report.preventiveDisciplineRate).toBe(100);
    });
  });

  describe('Quick Win #2: dataIntegrityService BOM Immunity for SYSTEM_GENERAL Assets', () => {
    it('flags BOM_ON_SYSTEM_GENERAL_ASSET errors and purges BOM elements attached to SYSTEM_GENERAL machines', () => {
      const machines = [
        { id_machine_registered: 'PRS-01', nom: 'Presse 1', status: 'ACTIF', asset_class: 'PRODUCTION' },
        { id_machine_registered: 'SEC-01', nom: 'Extincteur CO2', status: 'ACTIF', asset_class: 'SYSTEM_GENERAL' },
      ];

      const machineElementsLedger = [
        { id_element_instance: 'EL-PROD-1', id_machine: 'PRS-01', designation_element: 'Vérin Hydraulique' },
        { id_element_instance: 'EL-SYS-LEAK', id_machine: 'SEC-01', designation_element: 'Organe erroné sur sécurité' },
      ];

      const result = dataIntegrityService.validateReferentialIntegrity({
        machines,
        machineElementsLedger,
      });

      const bomLeakIssue = result.errors.find((i) => i.type === 'BOM_ON_SYSTEM_GENERAL_ASSET');
      expect(bomLeakIssue).toBeDefined();
      expect(bomLeakIssue?.id).toBe('EL-SYS-LEAK');
      expect(bomLeakIssue?.key).toBe('SEC-01');

      const leaks = dataIntegrityService.getSystemGeneralBomLeaks(machineElementsLedger, machines);
      expect(leaks).toHaveLength(1);
      expect(leaks[0].id_element_instance).toBe('EL-SYS-LEAK');

      const { kept, removedCount } = dataIntegrityService.purgeSystemGeneralBomLeaks(
        machineElementsLedger,
        machines
      );
      expect(removedCount).toBe(1);
      expect(kept).toHaveLength(1);
      expect(kept[0].id_element_instance).toBe('EL-PROD-1');
    });
  });

  describe('Idea 2, 3 & 4: QR Offline Matrix, Virtual Stock Reservation & Component BER Wear Score', () => {
    it('computes virtual reserved stock across Corrective, Preventive & Sortie pending claims without mutating stockActuel', () => {
      const reservedMap = computeReservedStockMap({
        correctiveInterventions: [
          {
            id: 'BT-101',
            num_bt: 'BT-101',
            code_machine: 'PRS-01',
            validation_status: 'PENDING_VALIDATION',
            pieces_proposees: [{ ref: 'RLM-6205', quantite: 2 }],
          },
          {
            id: 'BT-102-APPROVED',
            validation_status: 'APPROVED',
            pieces_proposees: [{ ref: 'RLM-6205', quantite: 5 }],
          },
        ],
        preventiveExecutions: [
          {
            id: 'EX-201',
            machineCode: 'SEC-01',
            validation_status: 'PENDING_VALIDATION',
            sparesProposed: [{ ref: 'RLM-6205', qty: 1 }, { ref: 'CRR-A42', qty: 3 }],
          },
        ],
        sortieDemands: [
          {
            id: 'DEM-301',
            code_bon_tech: 'BS-301',
            id_machine_registered: 'PRS-02',
            validation_status: 'NEEDS_CLARIFICATION',
            items: [{ ref: 'RLM-6205', quantite: 1 }],
          },
        ],
      });

      const rlmEntry = reservedMap.get('RLM-6205');
      expect(rlmEntry).toBeDefined();
      expect(rlmEntry?.reservedQty).toBe(4); // 2 (BT) + 1 (PM) + 1 (Sortie)
      expect(rlmEntry?.sources).toHaveLength(3);

      const crrEntry = reservedMap.get('CRR-A42');
      expect(crrEntry?.reservedQty).toBe(3);
    });

    it('flags a component as À réformer (BER >= 70% or >= 3 failures in 6 months)', () => {
      const motorComponent = {
        id_warehouse_item: 'MOT-01',
        code: 'MOT-01',
        id_family: 'FAM-MOT',
        designation: 'Moteur Asynchrone 5.5kW',
        prix_achat: 1000,
        historique_bobinage: [
          { societe_bobinage: 'STE AMAL', cout: 300, date_demontage: '2026-04-10' },
          { societe_bobinage: 'STE AMAL', cout: 300, date_demontage: '2026-05-01' },
        ],
      };

      const analysis = evaluateComponentWearAndLifecycle(motorComponent, {
        correctiveInterventions: [
          {
            id: 'BT-501',
            id_composant: 'MOT-01',
            cout_pdr: 180,
            date_demande: '2026-05-12',
            validation_status: 'APPROVED',
          },
        ],
        referenceDate: new Date('2026-05-20T00:00:00Z'),
      });

      // 300 + 300 (bobinages) + 180 (BT) = 780 DT / 1000 DT = 78% >= 70% BER threshold
      expect(analysis.cumulativeRepairCost).toBe(780);
      expect(analysis.costRatioPercent).toBe(78);
      expect(analysis.shouldReform).toBe(true);
      expect(analysis.statusLevel).toBe('REFORM');
      expect(analysis.recommendation).toContain('À réformer');
    });

    it('generates a deterministic 21x21 offline QR matrix for machine field URLs', () => {
      const matrix = networkConfigService.generateQrMatrix('http://192.168.1.100:3000/?machine_qr=PRS-01');
      expect(matrix).toHaveLength(21);
      expect(matrix[0]).toHaveLength(21);
      // Finder pattern corners are always true
      expect(matrix[0][0]).toBe(true);
      expect(matrix[0][20]).toBe(true);
      expect(matrix[20][0]).toBe(true);
    });
  });
});


