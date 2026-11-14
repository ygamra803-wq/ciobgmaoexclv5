import { describe, expect, it } from 'vitest';
import { computeReservedStockMap } from '../../core/security/validationReconciliation';
import {
  evaluateBatchSpareAllocation,
  evaluateSpareAllocation,
} from '../../domain/stock/stockReservationService';
import {
  allocateStockSortieFifoFefo,
  buildItemLotsAndBins,
  computeDynamicCump,
  evaluateLotExpiryStatus,
} from '../../domain/stock/stockLotValuationService';
import {
  evaluateSensorTelemetry,
  ingestTelemetryPayload,
  type ICbmSensorRule,
} from '../../domain/preventive/cbmTelemetryService';
import {
  computeTechnicianShiftWorkload,
  evaluateTechniciansForIntervention,
  inferRequiredHabilitations,
} from '../../domain/workforce/workforceCapacityService';
import type { IMouvement, IStockItem, ITechnician } from '../../types/domain';
import type { CorrectiveInterventionItem, PreventiveTaskItem } from '../../types/store';

describe('Enterprise GMAO v5.0.2 — 5 Industrial Capabilities Suite', () => {
  describe('1. Stock Réservé vs Disponible (Inter-Machine Pre-Reservation Guard)', () => {
    const mockCatalog: IStockItem[] = [
      {
        id: 'pdr-skf-6205',
        ref: 'RLT-6205-2RS',
        designation: 'Roulement à billes SKF 6205-2RS',
        categorie: 'Roulements',
        unite: 'pcs',
        stockInitial: 2,
        entrees: 0,
        sorties: 0,
        stockActuel: 2,
        seuilAlerte: 1,
        prixUnitaire: 120,
      },
    ];

    it('includes pre-reserved parts from planned BTs (BT_PLANIFIE) and scheduled Preventive Plans in reserved stock map', () => {
      const reservedMap = computeReservedStockMap({
        correctiveInterventions: [
          {
            id: 'BT-2026-001',
            num_bt: 'BT-2026-001',
            statut: 'BT_PLANIFIE',
            code_machine: 'PRS-01',
            pieces_reservees: [{ ref: 'RLT-6205-2RS', designation: 'Roulement SKF', qty: 1 }],
          },
        ],
        preventiveTasks: [
          {
            id: 'PM-2026-010',
            code_tache: 'PM-2026-010',
            machine: 'CNV-02',
            etat: 'Planifié',
            reserve_stock: true,
            pieces_reservees: [{ ref: 'RLT-6205-2RS', designation: 'Roulement SKF', qty: 1 }],
          },
        ],
      });

      const entry = reservedMap.get('RLT-6205-2RS');
      expect(entry).toBeDefined();
      expect(entry?.reservedQty).toBe(2);
      expect(entry?.sources).toHaveLength(2);
      expect(entry?.sources.map((s) => s.status)).toEqual([
        'BT_RESERVE',
        'PLAN_PREVENTIF_RESERVE',
      ]);
    });

    it('detects DOUBLE_MACHINE_RESERVATION_CONFLICT when Machine B tries to book a spare part already reserved for Machine A', () => {
      const evalResult = evaluateSpareAllocation({
        ref: 'RLT-6205-2RS',
        requestedQty: 2,
        machineCode: 'COMP-03',
        stockItems: mockCatalog,
        correctiveInterventions: [
          {
            id: 'BT-2026-001',
            num_bt: 'BT-2026-001',
            statut: 'BT_PLANIFIE',
            code_machine: 'PRS-01',
            pieces_reservees: [{ ref: 'RLT-6205-2RS', designation: 'Roulement SKF', qty: 1 }],
          },
        ],
      });

      expect(evalResult.stockPhysique).toBe(2);
      expect(evalResult.reservedByOtherClaimsQty).toBe(1);
      expect(evalResult.reservedByOtherMachinesQty).toBe(1);
      expect(evalResult.stockDisponible).toBe(1);
      expect(evalResult.canAllocate).toBe(false);
      expect(evalResult.conflictCode).toBe('DOUBLE_MACHINE_RESERVATION_CONFLICT');
      expect(evalResult.conflictMessageFr).toContain('PRS-01');
    });

    it('aggregates duplicate lines in batch allocation and approves when net available stock is sufficient', () => {
      const batch = evaluateBatchSpareAllocation(
        [
          { ref: 'RLT-6205-2RS', qty: 1 },
          { ref: 'RLT-6205-2RS', qty: 1 },
        ],
        {
          machineCode: 'PRS-01',
          stockItems: mockCatalog,
          correctiveInterventions: [],
        }
      );

      expect(batch.canAllocateAll).toBe(true);
      expect(batch.evaluations[0]?.requestedQty).toBe(2);
      expect(batch.evaluations[0]?.remainingAfterAllocation).toBe(0);
    });
  });

  describe('2. Multi-Bin, Lot & Expiry (FEFO / FIFO), and Dynamic CUMP Valuation', () => {
    const sampleItem: IStockItem = {
      id: 'oil-hyd-46',
      ref: 'HUILE-ISO-VG46',
      designation: 'Huile Hydraulique ISO VG 46 (Bidon 20L)',
      categorie: 'Lubrifiants',
      unite: 'bidon',
      emplacement: 'MAG-A-01',
      stockInitial: 10,
      entrees: 15,
      sorties: 5,
      stockActuel: 20,
      seuilAlerte: 4,
      prixUnitaire: 100, // Initial CUMP = 100 MAD
    };

    const sampleMovements: IMouvement[] = [
      {
        id: 'mvt-1',
        code_bon: 'BE-2026-001',
        date: '2026-02-01',
        type: 'Entrée',
        ref: 'HUILE-ISO-VG46',
        quantite: 10,
        prix_unitaire: 140,
        lot_number: 'LOT-2026-A',
        emplacement_reception: 'MAG-B-02',
        date_peremption: '2026-03-01', // Expired relative to 2026-06-01
      },
      {
        id: 'mvt-2',
        code_bon: 'BS-2026-001',
        date: '2026-03-10',
        type: 'Sortie',
        ref: 'HUILE-ISO-VG46',
        quantite: 5,
      },
      {
        id: 'mvt-3',
        code_bon: 'BE-2026-002',
        date: '2026-04-15',
        type: 'Entrée',
        ref: 'HUILE-ISO-VG46',
        quantite: 5,
        prix_unitaire: 180,
        lot_number: 'LOT-2026-B',
        emplacement_reception: 'MAG-C-03',
        date_peremption: '2026-06-20', // Expiring soon relative to 2026-06-01
      },
    ];

    it('computes exact CUMP weighted average unit cost across chronological Entrées and Sorties without mutating stockActuel', () => {
      // Step 0: Initial 10 units @ 100 MAD => CUMP = 100
      // Step 1 (Entrée 10 @ 140): (10*100 + 10*140)/20 = 2400/20 = 120 MAD
      // Step 2 (Sortie 5): remaining 15 units @ CUMP 120 MAD
      // Step 3 (Entrée 5 @ 180): (15*120 + 5*180)/20 = (1800 + 900)/20 = 135 MAD
      const valuation = computeDynamicCump(sampleItem, sampleMovements);

      expect(valuation.stockActuel).toBe(20);
      expect(valuation.initialPrice).toBe(100);
      expect(valuation.cump).toBe(135);
      expect(valuation.lastPurchasePrice).toBe(180);
      expect(valuation.totalValuationValue).toBe(2700);
      expect(valuation.historySteps).toHaveLength(2);
    });

    it('quarantines EXPIRED lots automatically and picks earliest valid expiry first under FEFO strategy', () => {
      const { lots, bins, expiredQty, expiringSoonQty } = buildItemLotsAndBins(
        sampleItem,
        sampleMovements,
        '2026-06-01'
      );

      expect(bins.length).toBeGreaterThanOrEqual(2);
      expect(expiredQty).toBe(10); // LOT-2026-A expired on 2026-03-01
      expect(expiringSoonQty).toBe(5); // LOT-2026-B expires on 2026-06-20 (19 days from 2026-06-01)

      const fefoPlan = allocateStockSortieFifoFefo(lots, 8, 'FEFO', '2026-06-01');
      expect(fefoPlan.excludedExpiredQty).toBe(10);
      expect(fefoPlan.isFullySatisfied).toBe(true);
      expect(fefoPlan.allocatedQty).toBe(8);
      // First pick must be LOT-2026-B (5 units expiring soon on 2026-06-20), then LOT-INIT (3 units, no expiry)
      expect(fefoPlan.picks[0]?.lotNumber).toBe('LOT-2026-B');
      expect(fefoPlan.picks[0]?.pickedQty).toBe(5);
      expect(fefoPlan.picks[1]?.lotNumber).toBe('LOT-INIT-HUILE-ISO-VG46');
      expect(fefoPlan.picks[1]?.pickedQty).toBe(3);
    });

    it('evaluates lot expiry status accurately across VALID, EXPIRING_SOON, EXPIRED, and NO_EXPIRY', () => {
      expect(evaluateLotExpiryStatus(null, '2026-06-01').status).toBe('NO_EXPIRY');
      expect(evaluateLotExpiryStatus('2026-05-15', '2026-06-01').status).toBe('EXPIRED');
      expect(evaluateLotExpiryStatus('2026-06-15', '2026-06-01').status).toBe('EXPIRING_SOON');
      expect(evaluateLotExpiryStatus('2026-12-31', '2026-06-01').status).toBe('VALID');
    });
  });

  describe('3. CBM / IoT Telemetry Rules (MQTT / OPC-UA / Modbus) & Deduplicated DI Generation', () => {
    const vibrationRule: ICbmSensorRule = {
      id: 'CBM-VIB-PRS01',
      machineCode: 'PRS-01',
      organe: 'Palier Arbre Principal',
      parameter: 'VIBRATION_RMS',
      unit: 'mm/s',
      protocol: 'MQTT',
      endpointAddress: 'usine/atelier1/prs01/vib_rms',
      direction: 'HIGH_BAD',
      warningThreshold: 4.5,
      criticalThreshold: 7.1,
      hysteresis: 0.3,
      minPhysicalBound: 0,
      maxPhysicalBound: 100,
      autoTriggerDi: true,
      recommendedPdrRef: 'RLT-6205-2RS',
    };

    it('rejects physically impossible sensor readings as OUT_OF_RANGE_FAULT without triggering a false DI', () => {
      const faultEval = evaluateSensorTelemetry(vibrationRule, -5.2);
      expect(faultEval.status).toBe('OUT_OF_RANGE_FAULT');
      expect(faultEval.shouldTriggerCorrectiveDi).toBe(false);
    });

    it('applies deadband hysteresis so a sensor in CRITICAL state stays CRITICAL until dropping below (criticalThreshold - hysteresis)', () => {
      const ruleInCritical: ICbmSensorRule = {
        ...vibrationRule,
        lastStatus: 'CRITICAL',
        lastValue: 7.4,
      };
      // 6.95 mm/s is below 7.1 but above (7.1 - 0.3 = 6.8), so hysteresis holds CRITICAL
      const heldCritical = evaluateSensorTelemetry(ruleInCritical, 6.95);
      expect(heldCritical.status).toBe('CRITICAL');

      // 6.7 mm/s drops below 6.8, clearing CRITICAL down to WARNING
      const clearedToWarning = evaluateSensorTelemetry(ruleInCritical, 6.7);
      expect(clearedToWarning.status).toBe('WARNING');
    });

    it('generates an automatic Corrective DI payload on CRITICAL breach and deduplicates if an open CBM DI already exists', () => {
      const firstBreach = ingestTelemetryPayload(
        { sensorId: 'CBM-VIB-PRS01', value: 8.4, timestamp: '2026-06-01T10:00:00Z' },
        [vibrationRule],
        []
      );

      expect(firstBreach.evaluation?.status).toBe('CRITICAL');
      expect(firstBreach.autoCreatedDiPayload).not.toBeNull();
      expect(firstBreach.autoCreatedDiPayload?.code_machine).toBe('PRS-01');
      expect(firstBreach.autoCreatedDiPayload?.source).toBe('IOT_CBM_AUTO');
      expect(firstBreach.autoCreatedDiPayload?.pdr_ref).toBe('RLT-6205-2RS');
      expect(firstBreach.skippedDuplicateOpenDi).toBe(false);

      // Simulate existing open DI from the first breach
      const existingOpenDi: CorrectiveInterventionItem[] = [
        {
          id: 'DI-2026-900',
          code_machine: 'PRS-01',
          statut: 'DEMANDE',
          source: 'IOT_CBM_AUTO',
          cbm_sensor_id: 'CBM-VIB-PRS01',
          anomalie: firstBreach.autoCreatedDiPayload?.anomalie || '',
        },
      ];

      const secondBreach = ingestTelemetryPayload(
        { sensorId: 'CBM-VIB-PRS01', value: 8.9, timestamp: '2026-06-01T10:05:00Z' },
        firstBreach.updatedRules,
        existingOpenDi
      );

      expect(secondBreach.evaluation?.status).toBe('CRITICAL');
      expect(secondBreach.autoCreatedDiPayload).toBeNull();
      expect(secondBreach.skippedDuplicateOpenDi).toBe(true);
    });
  });

  describe('4. Technician Habilitations & Shift Workload Capacity Planning', () => {
    const technicians: ITechnician[] = [
      {
        id_technician: 'TECH-01',
        nom: 'Karim El Mansouri',
        specialite: 'Électromécanique',
        id_zone: 'ATELIER-A',
        shift_poste: 'MATIN',
        capacite_journaliere_min: 480,
        habilitations: [
          { code: 'B2V', expiresAt: '2027-12-31' },
          { code: 'BC', expiresAt: '2027-12-31' },
        ],
      },
      {
        id_technician: 'TECH-02',
        nom: 'Youssef Benali',
        specialite: 'Électricité',
        id_zone: 'ATELIER-A',
        shift_poste: 'MATIN',
        capacite_journaliere_min: 480,
        habilitations: [
          { code: 'BR', expiresAt: '2025-01-01' }, // Expired relative to 2026-06-01
          { code: 'BC', expiresAt: '2027-12-31' },
        ],
      },
    ];

    it('infers required electrical (BR) and LOTO (BC) habilitations and ranks compliant non-overloaded technicians first', () => {
      const diElectricalLoto: Partial<CorrectiveInterventionItem> = {
        code_machine: 'PRS-01',
        type_panne: 'E',
        anomalie: 'Court-circuit armoire variateur avec consignation LOTO obligatoire',
        zone: 'ATELIER-A',
      };

      const required = inferRequiredHabilitations(diElectricalLoto);
      expect(required).toContain('BR');
      expect(required).toContain('BC');

      const rankings = evaluateTechniciansForIntervention({
        intervention: diElectricalLoto,
        technicians,
        activeInterventions: [],
        preventiveTasks: [],
        estimatedTaskMinutes: 120,
        referenceDate: '2026-06-01',
      });

      expect(rankings).toHaveLength(2);
      // TECH-01 holds valid B2V (which satisfies BR) + valid BC => compliant & ranked #1
      expect(rankings[0]?.technicianId).toBe('TECH-01');
      expect(rankings[0]?.isHabilitationCompliant).toBe(true);

      // TECH-02 has expired BR => non-compliant & ranked #2
      expect(rankings[1]?.technicianId).toBe('TECH-02');
      expect(rankings[1]?.isHabilitationCompliant).toBe(false);
      expect(rankings[1]?.expiredHabilitations).toContain('BR');
    });

    it('flags shift overload (> 100% of 480 min shift) when active BTs and due PM tasks saturate capacity', () => {
      const activeInterventions: CorrectiveInterventionItem[] = [
        {
          id: 'BT-1',
          statut: 'EN_COURS',
          intervenant: 'Karim El Mansouri',
          duree_prevue_mins: 360,
        },
      ];
      const preventiveTasks: PreventiveTaskItem[] = [
        {
          id: 'PM-1',
          etat: 'Planifié',
          responsable: 'Karim El Mansouri',
          duree_estimee_min: 180,
        },
      ];

      const workload = computeTechnicianShiftWorkload({
        technician: technicians[0]!,
        activeInterventions,
        preventiveTasks,
      });

      expect(workload.totalAssignedMinutes).toBe(540);
      expect(workload.capacityMinutes).toBe(480);
      expect(workload.utilizationRatePct).toBe(113);
      expect(workload.loadStatus).toBe('OVERLOADED');
    });
  });
});
