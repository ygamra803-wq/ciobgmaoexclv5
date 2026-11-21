import { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as XLSX from 'xlsx';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useGmaoStore } from '../../store/useGmaoStore';
import { ROLES } from '../../core/security/Roles';
import {
  buildAdminValidationRadar,
  createClaimReconciliationIndex,
  reconcileFieldClaim,
  selectValidationCenterQueues,
} from '../../core/security/validationReconciliation';
import {
  MonthlyReportCalculationService,
} from '../../application/services/MonthlyReportCalculationService';
import {
  buildShiftOrWeeklyReport,
  buildShiftWeeklyReportCsv,
  buildShiftWeeklyReportJson,
} from '../../application/services/ShiftWeeklyReportEngine';
import { MonthlyReportExportService } from '../../services/monthlyReportExportService';
import {
  sanitizeCsvCell,
  sanitizeSpreadsheetCell,
  sanitizeSpreadsheetRows,
} from '../../utils/spreadsheetSanitize';
import type { CurrencyFinancialConfig } from '../../utils/currencyService';
import ValidationCenterView from '../../presentation/pages/validation/ValidationCenterView';
import { useDashboardController, type DashboardViewProps } from '../../presentation/pages/dashboard/hooks/useDashboardController';
import { I18nProvider } from '../../i18n/I18nContext';

let mockAuthUser = {
  id: 'ADM-SUP-01',
  name: 'Superviseur Indépendant',
  nom: 'Superviseur Indépendant',
  role: 'ADMIN',
  matricule: 'ADM-01',
};

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));

function setSessionUser(role: string, id: string, name: string) {
  mockAuthUser = { id, name, nom: name, role, matricule: id };
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem('gmao_session_v2', JSON.stringify({ id, name, role }));
  }
}

function clearSessionUser() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem('gmao_session_v2');
  }
}

function DashboardControllerHarness({
  props,
  onCapture,
}: {
  props: DashboardViewProps;
  onCapture: (ctrl: ReturnType<typeof useDashboardController>) => void;
}) {
  const ctrl = useDashboardController(props);
  onCapture(ctrl);
  return null;
}

describe('Phase C — O(1) Reconciliation Indexing, PM Compliance & Atelier Cost Parity, SoD & Security Exports', () => {
  beforeEach(() => {
    clearSessionUser();
    setSessionUser(ROLES.ADMIN, 'ADM-SUP-01', 'Superviseur Indépendant');
  });

  afterEach(() => {
    clearSessionUser();
    vi.restoreAllMocks();
  });

  describe('1. O(1) Pre-Indexed reconcileFieldClaim Parity & High-Volume Benchmark', () => {
    it('produces identical results between indexed and non-indexed reconcileFieldClaim across all 3 claim types', () => {
      const stockItems = [
        { ref: 'PDR-RLM-6205', designation: 'Roulement 6205', stockActuel: 5 },
        { ref: 'PDR-JNT-10', designation: 'Joint Torique', stockActuel: 3 },
        { ref: 'PDR-CR-100', designation: 'Courroie SPZ', stockActuel: 10 },
      ];
      const mouvements = [
        {
          id: 'MVT-1',
          code_bon: 'BS-MAG-100',
          type: 'Sortie',
          ref: 'PDR-RLM-6205',
          quantite: 2,
          id_machine_registered: 'M-101',
          date: '2026-06-10',
        },
        {
          id: 'MVT-2',
          code_bon: 'BS-DUP-777',
          type: 'Sortie',
          ref: 'PDR-CR-100',
          quantite: 1,
          id_machine_registered: 'M-102',
          date: '2026-06-10',
        },
      ];
      const correctiveInterventions = [
        {
          id: 'BT-1',
          num_bt: 'BT-01',
          code_machine: 'M-101',
          validation_status: 'PENDING_VALIDATION',
          num_bon_saisi_par_tech: 'BS-TECH-01', // differs from BS-MAG-100 -> candidate match
          pieces_proposees: [{ ref: 'PDR-RLM-6205', quantite: 2 }],
        },
        {
          id: 'BT-2',
          num_bt: 'BT-02',
          code_machine: 'M-102',
          validation_status: 'PENDING_VALIDATION',
          num_bon_saisi_par_tech: 'BS-DUP-777', // exact movement match + dup bon
          pieces_proposees: [{ ref: 'PDR-RLM-6205', quantite: 4 }], // triggers concurrent overflow with BT-1 (2+4 > 5)
        },
        {
          id: 'BT-3-REJ',
          num_bt: 'BT-03',
          code_machine: 'M-103',
          validation_status: 'REJECTED',
          num_bon_saisi_par_tech: 'BS-UNIQUE-OK',
          pieces_proposees: [{ ref: 'PDR-JNT-10', quantite: 2 }],
        },
      ];
      const preventiveExecutions = [
        {
          id: 'PM-1',
          taskCode: 'T-PM-01',
          machineCode: 'M-103',
          validation_status: 'PENDING_VALIDATION',
          num_bon_saisi_par_tech: '', // triggers MISSING_BON_WITH_PDR
          sparesProposed: [{ ref: 'PDR-JNT-10', qty: 8 }], // triggers STOCK_SHORTAGE (8 > 3)
        },
      ];
      const sortieDemands = [
        {
          id: 'SD-1',
          code_bon_tech: 'BS-DUP-777', // matches BT-2 + MVT-2
          id_machine_registered: 'M-102',
          validation_status: 'PENDING_VALIDATION',
          items: [{ ref: 'PDR-CR-100', quantite: 1 }],
        },
      ];

      const index = createClaimReconciliationIndex({
        stockItems,
        mouvements,
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands,
      });

      const shared = {
        stockItems,
        mouvements,
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands,
      };

      for (const bt of correctiveInterventions) {
        const baseline = reconcileFieldClaim({
          claimType: 'CORRECTIVE',
          claimId: bt.id,
          numBonSaisi: bt.num_bon_saisi_par_tech,
          machineCode: bt.code_machine,
          proposedSpares: bt.pieces_proposees,
          ...shared,
        });
        const indexed = reconcileFieldClaim({
          claimType: 'CORRECTIVE',
          claimId: bt.id,
          numBonSaisi: bt.num_bon_saisi_par_tech,
          machineCode: bt.code_machine,
          proposedSpares: bt.pieces_proposees,
          ...shared,
          reconciliationIndex: index,
        });
        expect(indexed).toEqual(baseline);
      }

      for (const ex of preventiveExecutions) {
        const baseline = reconcileFieldClaim({
          claimType: 'PREVENTIVE',
          claimId: ex.id,
          numBonSaisi: ex.num_bon_saisi_par_tech,
          machineCode: ex.machineCode,
          proposedSpares: ex.sparesProposed,
          ...shared,
        });
        const indexed = reconcileFieldClaim({
          claimType: 'PREVENTIVE',
          claimId: ex.id,
          numBonSaisi: ex.num_bon_saisi_par_tech,
          machineCode: ex.machineCode,
          proposedSpares: ex.sparesProposed,
          ...shared,
          reconciliationIndex: index,
        });
        expect(indexed).toEqual(baseline);
      }

      for (const dem of sortieDemands) {
        const baseline = reconcileFieldClaim({
          claimType: 'SORTIE',
          claimId: dem.id,
          numBonSaisi: dem.code_bon_tech,
          machineCode: dem.id_machine_registered,
          proposedSpares: dem.items,
          ...shared,
        });
        const indexed = reconcileFieldClaim({
          claimType: 'SORTIE',
          claimId: dem.id,
          numBonSaisi: dem.code_bon_tech,
          machineCode: dem.id_machine_registered,
          proposedSpares: dem.items,
          ...shared,
          reconciliationIndex: index,
        });
        expect(indexed).toEqual(baseline);
      }
    });

    it('reconciles 20,000 movements and 300 pending claims in O(M + N) well under latency budget', () => {
      const stockItems = Array.from({ length: 500 }, (_, i) => ({
        ref: `PDR-${String(i).padStart(4, '0')}`,
        designation: `Pièce Industrielle ${i}`,
        stockActuel: 25,
      }));
      const mouvements = Array.from({ length: 20000 }, (_, i) => ({
        id: `MVT-${i}`,
        code_bon: `BS-HIST-${i}`,
        type: i % 5 === 0 ? 'Entrée' : 'Sortie',
        ref: `PDR-${String(i % 500).padStart(4, '0')}`,
        quantite: 1,
        id_machine_registered: `M-${i % 25}`,
        date: '2026-06-05',
      }));
      const correctiveInterventions = Array.from({ length: 150 }, (_, i) => ({
        id: `BT-PERF-${i}`,
        num_bt: `BT-${i}`,
        code_machine: `M-${i % 25}`,
        validation_status: 'PENDING_VALIDATION',
        num_bon_saisi_par_tech: i === 0 ? 'BS-HIST-0' : `BS-PERF-BT-${i}`,
        pieces_proposees: [
          { ref: `PDR-${String(i % 500).padStart(4, '0')}`, quantite: i === 1 ? 30 : 2 },
        ],
      }));
      const preventiveExecutions = Array.from({ length: 75 }, (_, i) => ({
        id: `PM-PERF-${i}`,
        taskCode: `T-${i}`,
        machineCode: `M-${i % 25}`,
        validation_status: 'PENDING_VALIDATION',
        num_bon_saisi_par_tech: `BS-PERF-PM-${i}`,
        sparesProposed: [{ ref: `PDR-${String((i + 100) % 500).padStart(4, '0')}`, qty: 1 }],
      }));
      const sortieDemands = Array.from({ length: 75 }, (_, i) => ({
        id: `SD-PERF-${i}`,
        code_bon_tech: `BS-PERF-SD-${i}`,
        id_machine_registered: `M-${i % 25}`,
        validation_status: 'PENDING_VALIDATION',
        items: [{ ref: `PDR-${String((i + 200) % 500).padStart(4, '0')}`, quantite: 1 }],
      }));

      const t0 = performance.now();
      const radar = buildAdminValidationRadar({
        stockItems,
        mouvements,
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands,
      });
      const elapsedMs = performance.now() - t0;

      expect(radar.totalPendingCount).toBe(300);
      expect(radar.criticalAlertCount).toBeGreaterThanOrEqual(2); // DUPLICATE_BON on BT-PERF-0 + STOCK_SHORTAGE on BT-PERF-1
      expect(elapsedMs).toBeLessThan(1000);
    });
  });

  describe('2. Unified PM Compliance & cout_atelier Separation Parity', () => {
    it('computes identical ON_TIME / LATE / OVERDUE PM compliance and strictly excludes cout_atelier from correctiveSparesCost across Monthly and Shift/Weekly reports', () => {
      const machines = [
        { id_machine_registered: 'M-101', nom: 'Presse 1', statut: 'Active', asset_class: 'PRODUCTION' },
        { id_machine_registered: 'M-102', nom: 'Tour 2', statut: 'Active', asset_class: 'PRODUCTION' },
      ];

      const correctiveInterventions = [
        {
          id: 'BT-WITH-ATELIER-1',
          num_bt: 'BT-2026-101',
          code_machine: 'M-101',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-06-12',
          pdr_cost: 300,
          cout_pdr: 300,
          cout_atelier: 550, // workshop fabrication/repair -> MUST NOT leak into correctiveSparesCost
          cout_total: 850,
          temps_arret_minutes: 60,
        },
        {
          id: 'BT-ATELIER-ONLY-LEGACY',
          num_bt: 'BT-2026-102',
          code_machine: 'M-102',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-06-14',
          // Explicitly tests legacy fallback where pdr_cost is omitted and cout_total == cout_atelier
          cout_atelier: 400,
          cout_total: 400,
          temps_arret_minutes: 30,
        },
        {
          id: 'BT-MIXED-LEGACY-FALLBACK',
          num_bt: 'BT-2026-103',
          code_machine: 'M-101',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-06-15',
          // pdr_cost omitted, cout_total = 700, cout_atelier = 500 -> PDR spares = 200, Atelier = 500
          cout_atelier: 500,
          cout_total: 700,
          temps_arret_minutes: 30,
        },
      ];

      const preventiveTasks = [
        {
          id: 'T-ONTIME',
          code_machine: 'M-101',
          tache: 'Graissage M-101',
          prochaine_echeance: '2026-06-10',
          active: true,
        },
        {
          id: 'T-LATE',
          code_machine: 'M-102',
          tache: 'Alignement M-102',
          prochaine_echeance: '2026-06-10',
          active: true,
        },
        {
          id: 'T-OVERDUE',
          code_machine: 'M-101',
          tache: 'Vidange M-101',
          prochaine_echeance: '2026-06-20',
          active: true,
        },
      ];

      const preventiveExecutions = [
        {
          id: 'EX-ONTIME',
          taskId: 'T-ONTIME',
          machineCode: 'M-101',
          executedAt: '2026-06-09',
          scheduledDueDate: '2026-06-10',
          periodMonth: '2026-06',
          validation_status: 'APPROVED',
          sparesCost: 120,
          durationMinutes: 60,
          executorName: 'Karim',
        },
        {
          id: 'EX-LATE',
          taskId: 'T-LATE',
          machineCode: 'M-102',
          executedAt: '2026-06-15',
          scheduledDueDate: '2026-06-10',
          periodMonth: '2026-06',
          validation_status: 'APPROVED',
          sparesCost: 80,
          durationMinutes: 45,
          executorName: 'Sami',
        },
        {
          // Pending claim MUST NOT count as completed -> T-OVERDUE stays OVERDUE
          id: 'EX-PENDING-OVERDUE',
          taskId: 'T-OVERDUE',
          machineCode: 'M-101',
          executedAt: '2026-06-22',
          periodMonth: '2026-06',
          validation_status: 'PENDING_VALIDATION',
          sparesCost: 999,
          durationMinutes: 30,
        },
      ];

      const monthly = MonthlyReportCalculationService.calculateMonthlyReport({
        month: '2026-06',
        machines,
        correctiveInterventions,
        preventiveTasks,
        preventiveExecutions,
        stockItems: [],
        mouvements: [],
        sortiesExterne: [],
      });

      const shiftMonthly = buildShiftOrWeeklyReport({
        from: '2026-06-01',
        to: '2026-06-30',
        machines,
        correctiveInterventions,
        preventiveTasks,
        preventiveExecutions,
        stockItems: [],
        mouvements: [],
        sortieDemands: [],
        sortiesExterne: [],
      });

      // Strictly separated PDR vs Workshop cost in both engines:
      // PDR spares = 300 + 0 + 200 = 500; Workshop = 550 + 400 + 500 = 1450
      expect(monthly.correctiveSparesCost).toBe(500);
      expect(shiftMonthly.correctiveSparesCost).toBe(500);
      expect(monthly.correctiveWorkshopCost).toBe(1450);
      expect(shiftMonthly.correctiveWorkshopCost).toBe(1450);

      // Machine C1 rows keep PDR separate from Atelier
      const m102Monthly = monthly.machineCostBreakdown.find((r) => r.machineCode === 'M-102');
      const m102Shift = shiftMonthly.machineCostBreakdown.find((r) => r.machineCode === 'M-102');
      expect(m102Monthly?.correctivePdrCost).toBe(0);
      expect(m102Monthly?.correctiveWorkshopCost).toBe(400);
      expect(m102Shift?.correctivePdrCost).toBe(0);
      expect(m102Shift?.correctiveWorkshopCost).toBe(400);

      // Unified PM Compliance parity (1 ON_TIME, 1 LATE, 1 OVERDUE out of 3 eligible)
      expect(monthly.pmCompliance.onTimeCount).toBe(1);
      expect(monthly.pmCompliance.lateCompletedCount).toBe(1);
      expect(monthly.pmCompliance.overdueCount).toBe(1);
      expect(monthly.pmCompliance.totalEligibleCount).toBe(3);
      expect(monthly.pmCompliance.onTimeComplianceRate).toBe(33);
      expect(monthly.pmCompliance.overallCompletionRate).toBe(67);
      expect(monthly.preventiveDisciplineRate).toBe(67);

      expect(shiftMonthly.pmCompliance).toEqual(monthly.pmCompliance);
      expect(shiftMonthly.preventiveDisciplineRate).toBe(monthly.preventiveDisciplineRate);
    });
  });

  describe('3. RBAC & Segregation of Duties (Self-Approval Rejection)', () => {
    beforeEach(() => {
      const store = useGmaoStore.getState();
      store.setRawStock([
        {
          ref: 'PDR-RLM-6205',
          designation: 'Roulement SKF 6205',
          stockInitial: 20,
          stockActuel: 20,
          prix: 100,
          unite: 'Pièce',
        },
      ]);
      store.setMouvements([]);
      useGmaoStore.setState({
        correctiveInterventions: [
          {
            id: 'BT-SOD-1',
            num_bt: 'BT-SOD-001',
            code_machine: 'M-101',
            statut: 'EN_COURS',
            action_fermee: 'NON',
            validation_status: 'PENDING_VALIDATION',
            submitted_by_id: 'TECH-ALI',
            submitted_by_name: 'Ali Technicien',
            intervenant: 'Ali Technicien',
            action_realisee: 'Remplacement roulement',
            pieces_proposees: [{ ref: 'PDR-RLM-6205', quantite: 2 }],
            date_debut: '2026-06-10',
            heure_debut: '08:00',
          },
        ],
        preventiveTasks: [
          {
            id: 'TASK-SOD-1',
            code_tache: 'PM-SOD-01',
            id_machine: 'M-101',
            code_machine: 'M-101',
            tache: 'Contrôle palier',
            etat: 'À valider',
            validation_status: 'PENDING_VALIDATION',
            prochaine_echeance: '2026-06-15',
            active: true,
          },
        ],
        preventiveExecutions: [
          {
            id: 'EXEC-SOD-1',
            taskId: 'TASK-SOD-1',
            taskCode: 'PM-SOD-01',
            machineCode: 'M-101',
            executedAt: '2026-06-15',
            periodMonth: '2026-06',
            durationMinutes: 30,
            validation_status: 'PENDING_VALIDATION',
            submitted_by_id: 'TECH-ALI',
            submitted_by_name: 'Ali Technicien',
            executorName: 'Ali Technicien',
            sparesProposed: [{ ref: 'PDR-RLM-6205', qty: 1 }],
            sparesUsed: [],
            stock_deducted: false,
          },
        ],
        sortieDemands: [
          {
            id: 'SD-SOD-1',
            type: 'Sortie',
            code_bon_tech: 'BS-SOD-01',
            id_machine_registered: 'M-101',
            date: '2026-06-15',
            validation_status: 'PENDING_VALIDATION',
            submitted_by_id: 'TECH-ALI',
            submitted_by_name: 'Ali Technicien',
            technicien: 'Ali Technicien',
            items: [{ ref: 'PDR-RLM-6205', designation: 'Roulement SKF 6205', quantite: 1 }],
          },
        ],
      });
    });

    it('blocks technician role and blocks same-author self-approval across BT, Preventive, and SortieDemand, while allowing an independent supervisor', () => {
      const store = useGmaoStore.getState();

      // 1) Technician role cannot approve any validation queue item
      setSessionUser(ROLES.TECHNICIEN, 'TECH-ALI', 'Ali Technicien');
      expect(
        store.handleReviewInterventionValidation('BT-SOD-1', { decision: 'APPROVED', actorRole: ROLES.TECHNICIEN })
      ).toBeNull();
      expect(
        store.handleReviewPreventiveExecutionValidation('EXEC-SOD-1', { decision: 'APPROVED', actorRole: ROLES.TECHNICIEN })
      ).toBeNull();
      expect(
        store.handleReviewSortieDemandValidation('SD-SOD-1', { decision: 'APPROVED', actorRole: ROLES.TECHNICIEN })
      ).toBeNull();

      // 2) Same submitter ID cannot self-approve even when carrying ADMIN role (Segregation of Duties)
      setSessionUser(ROLES.ADMIN, 'TECH-ALI', 'Ali Technicien');
      expect(
        store.handleReviewInterventionValidation('BT-SOD-1', {
          decision: 'APPROVED',
          validated_by_id: 'TECH-ALI',
          validated_by_name: 'Ali Technicien',
        })
      ).toBeNull();
      expect(
        store.handleReviewPreventiveExecutionValidation('EXEC-SOD-1', {
          decision: 'APPROVED',
          validated_by_id: 'TECH-ALI',
          validated_by_name: 'Ali Technicien',
        })
      ).toBeNull();
      expect(
        store.handleReviewSortieDemandValidation('SD-SOD-1', {
          decision: 'APPROVED',
          validated_by_id: 'TECH-ALI',
          validated_by_name: 'Ali Technicien',
        })
      ).toBeNull();
      expect(useGmaoStore.getState().mouvements).toHaveLength(0);

      // 3) Second independent supervisor succeeds and triggers official deductions cleanly
      setSessionUser(ROLES.ADMIN, 'SUP-NADIA', 'Nadia Responsable');
      const approvedBt = useGmaoStore.getState().handleReviewInterventionValidation('BT-SOD-1', {
        decision: 'APPROVED',
        validated_by_id: 'SUP-NADIA',
        validated_by_name: 'Nadia Responsable',
      });
      expect(approvedBt?.validation_status).toBe('APPROVED');

      const approvedPm = useGmaoStore.getState().handleReviewPreventiveExecutionValidation('EXEC-SOD-1', {
        decision: 'APPROVED',
        validated_by_id: 'SUP-NADIA',
        validated_by_name: 'Nadia Responsable',
      });
      expect(approvedPm?.validation_status).toBe('APPROVED');

      const approvedSd = useGmaoStore.getState().handleReviewSortieDemandValidation('SD-SOD-1', {
        decision: 'APPROVED',
        validated_by_id: 'SUP-NADIA',
        validated_by_name: 'Nadia Responsable',
      });
      expect(approvedSd?.validation_status).toBe('APPROVED');
      expect(useGmaoStore.getState().mouvements).toHaveLength(3);
    });
  });

  describe('4. Multi-Currency EUR/USD Conversion & CSV/XLSX Formula Neutralization', () => {
    it('neutralizes CSV and XLSX formula injection payloads while preserving native numeric totals', () => {
      const payloads = [
        "=CMD|' /C calc'!A0",
        '+SUM(1,2)',
        '-2+3*cmd|...',
        '@HYPERLINK("http://evil.example","click")',
        '\t=1+1',
        '\r=1+1',
        '  =1+1',
      ];

      for (const payload of payloads) {
        const sanitized = sanitizeSpreadsheetCell(payload);
        expect(String(sanitized).startsWith("'")).toBe(true);
        const csvCell = sanitizeCsvCell(payload);
        expect(csvCell.startsWith(`"'`)).toBe(true);
      }

      const [row] = sanitizeSpreadsheetRows([['Presse', 1500, '-', '=2+2', true]]);
      expect(row).toEqual(['Presse', 1500, '-', "'=2+2", true]);
    });

    it('applies exact EUR & USD conversions across CSV, JSON, Shift/Weekly XLSX, and Monthly XLSX and neutralizes formula payloads inside exported cells', () => {
      const capturedWorkbooks: Array<{ wb: XLSX.WorkBook; filename: string }> = [];
      vi.spyOn(XLSX, 'writeFile').mockImplementation((wb: XLSX.WorkBook, filename: string) => {
        capturedWorkbooks.push({ wb, filename });
      });

      const machines = [
        {
          id_machine_registered: 'M-INJ',
          nom: '=HYPERLINK("http://bad.local","Presse 1")',
          statut: 'Active',
          asset_class: 'PRODUCTION',
        },
      ];
      const correctiveInterventions = [
        {
          id: 'BT-EXP-1',
          num_bt: '+BT-001',
          code_machine: 'M-INJ',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-06-10',
          pdr_cost: 1000,
          cout_atelier: 200,
          cout_total: 1200,
          intervenant: '@AdminAttack',
        },
      ];
      const mouvements = [
        {
          id: 'MVT-EXP-1',
          code_bon: '\t=CMD|calc',
          date: '2026-06-10',
          type: 'Sortie',
          ref: 'PDR-01',
          designation: ' -Roulement',
          quantite: 2,
          prix_unitaire: 500,
          id_machine_registered: 'M-INJ',
        },
      ];

      const comparison = MonthlyReportCalculationService.calculateMonthOverMonthComparison({
        month: '2026-06',
        machines,
        correctiveInterventions,
        mouvements,
        stockItems: [],
        preventiveTasks: [],
        preventiveExecutions: [],
        sortiesExterne: [],
      });

      const shiftReport = buildShiftOrWeeklyReport({
        from: '2026-06-01',
        to: '2026-06-30',
        machines,
        correctiveInterventions,
        mouvements,
        stockItems: [],
        preventiveTasks: [],
        preventiveExecutions: [],
        sortieDemands: [],
        sortiesExterne: [],
      });

      const eurConfig: CurrencyFinancialConfig = {
        activeCurrencyCode: 'EUR',
        baseCurrencyCode: 'MAD',
        madSymbolVariant: 'DH',
        exchangeRates: { MAD: 1, EUR: 0.1, USD: 0.12 },
        applyExchangeRateConversion: true,
        vatRatePercent: 20,
        fiscalYear: 2026,
      };
      const usdConfig: CurrencyFinancialConfig = {
        ...eurConfig,
        activeCurrencyCode: 'USD',
      };

      // CSV: EUR (1000 * 0.1 = 100, workshop 200 * 0.1 = 20) + formula neutralization
      const csvEur = buildShiftWeeklyReportCsv(shiftReport, eurConfig);
      expect(csvEur).toContain('"Cout PDR Correctif (Approuve)";"100";"EUR"');
      expect(csvEur).toContain('"Cout Atelier / Fabrication BT (Separe)";"20";"EUR"');
      expect(csvEur).toContain(`"'=HYPERLINK(""http://bad.local"",""Presse 1"")"`);
      expect(csvEur).toContain(`"'\t=CMD|calc"`);

      // JSON: USD (1000 * 0.12 = 120, workshop 200 * 0.12 = 24)
      const jsonUsd = JSON.parse(buildShiftWeeklyReportJson(shiftReport, usdConfig));
      expect(jsonUsd.currency).toEqual({ code: 'USD', symbol: '$', rateApplied: 0.12 });
      expect(jsonUsd.summary.correctiveSparesCost).toBe(120);
      expect(jsonUsd.summary.correctiveWorkshopCost).toBe(24);
      expect(jsonUsd.officialMovementsInPeriod[0].totalCost).toBe(120);

      // XLSX: Shift/Weekly USD & Monthly EUR
      MonthlyReportExportService.exportShiftWeeklyReportToExcel(shiftReport, usdConfig);
      MonthlyReportExportService.exportMonthlyReportToExcel(comparison, {
        currencyConfig: eurConfig,
        correctiveInterventions,
        mouvements,
      });

      expect(capturedWorkbooks).toHaveLength(2);
      const shiftSheetRows = XLSX.utils.sheet_to_json<unknown[]>(
        capturedWorkbooks[0].wb.Sheets['Synthese_Exploitation'],
        { header: 1 }
      );
      const sparesRowShift = shiftSheetRows.find((r) => r[0] === 'Coût PDR Correctif Approuvé');
      const atelierRowShift = shiftSheetRows.find((r) => String(r[0]).includes('Coût Atelier'));
      expect(sparesRowShift?.[1]).toBe(120);
      expect(sparesRowShift?.[2]).toBe('USD');
      expect(atelierRowShift?.[1]).toBe(24);

      const monthlySheetRows = XLSX.utils.sheet_to_json<unknown[]>(
        capturedWorkbooks[1].wb.Sheets['Synthese_Direction'],
        { header: 1 }
      );
      const sparesRowMonthly = monthlySheetRows.find((r) =>
        String(r[0]).includes('Coût PDR Correctif Approuvé')
      );
      expect(sparesRowMonthly?.[1]).toBe(100); // 1000 * 0.1 EUR
      const pannesSheetRows = XLSX.utils.sheet_to_json<unknown[]>(
        capturedWorkbooks[1].wb.Sheets['Pannes_Correctives_Mois'],
        { header: 1 }
      );
      expect(String(pannesSheetRows[1]?.[0])).toBe("'+BT-001");
      expect(String(pannesSheetRows[1]?.[7])).toBe("'@AdminAttack");
    });
  });

  describe('5. ValidationCenter Queue & Counter Parity Across Selector, Engines, Dashboard & UI', () => {
    it('maintains 100% numeric parity between selectValidationCenterQueues, ShiftWeeklyReport, Dashboard controller, and rendered ValidationCenterView counters', () => {
      const machines = [
        { id_machine_registered: 'M-101', nom: 'Presse 1', statut: 'Active', asset_class: 'PRODUCTION' },
      ];
      const stockItems = [
        { ref: 'PDR-01', designation: 'Roulement', stockActuel: 2, seuil: 5 },
      ];
      const correctiveInterventions = [
        {
          id: 'BT-Q-1',
          num_bt: 'BT-001',
          code_machine: 'M-101',
          statut: 'EN_COURS',
          validation_status: 'PENDING_VALIDATION',
          pieces_proposees: [{ ref: 'PDR-01', quantite: 5 }], // triggers STOCK_SHORTAGE
        },
        {
          id: 'BT-Q-2',
          num_bt: 'BT-002',
          code_machine: 'M-101',
          statut: 'EN_COURS',
          validation_status: 'NEEDS_CLARIFICATION',
          pieces_proposees: [],
        },
      ];
      const preventiveExecutions = [
        {
          id: 'PM-Q-1',
          taskId: 'T-1',
          taskCode: 'PM-01',
          machineCode: 'M-101',
          executedAt: '2026-06-15',
          periodMonth: '2026-06',
          validation_status: 'PENDING_VALIDATION',
          sparesProposed: [],
        },
        {
          id: 'PM-Q-2',
          taskId: 'T-2',
          taskCode: 'PM-02',
          machineCode: 'M-101',
          executedAt: '2026-06-16',
          periodMonth: '2026-06',
          validation_status: 'PENDING_VALIDATION',
          sparesProposed: [],
        },
      ];
      const sortieDemands = [
        {
          id: 'SD-Q-1',
          code_bon_tech: 'BS-001',
          id_machine_registered: 'M-101',
          date: '2026-06-15',
          validation_status: 'PENDING_VALIDATION',
          items: [{ ref: 'PDR-01', quantite: 1 }],
        },
        {
          id: 'SD-Q-2',
          code_bon_tech: 'BS-002',
          id_machine_registered: 'M-101',
          date: '2026-06-16',
          validation_status: 'NEEDS_CLARIFICATION',
          items: [],
        },
      ];

      const selectorQueues = selectValidationCenterQueues({
        correctiveInterventions,
        preventiveExecutions,
        sortieDemands,
      });

      const report = buildShiftOrWeeklyReport({
        from: '2026-06-01',
        to: '2026-06-30',
        machines,
        stockItems,
        mouvements: [],
        correctiveInterventions,
        preventiveTasks: [],
        preventiveExecutions,
        sortieDemands,
        sortiesExterne: [],
      });

      expect(report.makerCheckerQueue.pendingCorrectiveCount).toBe(selectorQueues.pendingCorrective.length);
      expect(report.makerCheckerQueue.pendingPreventiveCount).toBe(selectorQueues.pendingPreventive.length);
      expect(report.makerCheckerQueue.pendingSortieDemandsCount).toBe(selectorQueues.pendingSortieDemands.length);
      expect(report.makerCheckerQueue.totalPendingCount).toBe(selectorQueues.totalPending);
      expect(report.makerCheckerQueue.totalClarificationCount).toBe(selectorQueues.totalClarification);
      expect(report.makerCheckerQueue.totalPendingCount).toBe(4);
      expect(report.makerCheckerQueue.totalClarificationCount).toBe(2);

      // Seed store before Dashboard & ValidationCenter checks
      useGmaoStore.getState().setRawStock(stockItems as any[]);
      useGmaoStore.setState({
        machines: machines as any[],
        mouvements: [],
        correctiveInterventions: correctiveInterventions as any[],
        preventiveExecutions: preventiveExecutions as any[],
        sortieDemands: sortieDemands as any[],
      });

      // Dashboard Controller parity
      let dashboardCtrl: ReturnType<typeof useDashboardController> | null = null;
      const dashContainer = document.createElement('div');
      document.body.appendChild(dashContainer);
      const dashRoot = createRoot(dashContainer);

      act(() => {
        dashRoot.render(
          <I18nProvider>
            <DashboardControllerHarness
              props={{
                machines,
                stockItems,
                mouvements: [],
                correctiveInterventions,
                preventiveTasks: [],
                preventiveExecutions,
              }}
              onCapture={(ctrl) => {
                dashboardCtrl = ctrl;
              }}
            />
          </I18nProvider>
        );
      });

      expect(dashboardCtrl).not.toBeNull();
      expect(dashboardCtrl!.validationQueues.totalPending).toBe(selectorQueues.totalPending);
      expect(dashboardCtrl!.validationQueues.totalClarification).toBe(selectorQueues.totalClarification);
      expect(dashboardCtrl!.validationQueues.pendingCorrective).toHaveLength(1);
      expect(dashboardCtrl!.validationQueues.pendingPreventive).toHaveLength(2);
      expect(dashboardCtrl!.validationQueues.pendingSortieDemands).toHaveLength(1);

      act(() => {
        dashRoot.unmount();
      });
      dashContainer.remove();

      const vcContainer = document.createElement('div');
      document.body.appendChild(vcContainer);
      const vcRoot = createRoot(vcContainer);

      act(() => {
        vcRoot.render(
          <ValidationCenterView
            stockItems={stockItems as any[]}
            machines={machines as any[]}
            mouvements={[]}
            correctiveInterventions={correctiveInterventions as any[]}
            preventiveExecutions={preventiveExecutions as any[]}
            sortieDemands={sortieDemands as any[]}
          />
        );
      });

      const readTestIdText = (id: string) =>
        vcContainer.querySelector(`[data-testid="${id}"]`)?.textContent?.trim();

      expect(readTestIdText('vc-total-pending')).toBe(String(selectorQueues.totalPending));
      expect(readTestIdText('vc-corrective-count')).toBe(String(selectorQueues.pendingCorrective.length));
      expect(readTestIdText('vc-preventive-count')).toBe(String(selectorQueues.pendingPreventive.length));
      expect(readTestIdText('vc-sortie-count')).toBe(String(selectorQueues.pendingSortieDemands.length));
      // Pre-indexed reconciliation alert renders cleanly on BT-Q-1 row
      expect(vcContainer.querySelector('[data-testid="vc-corrective-row-BT-Q-1"]')?.textContent).toContain(
        'Stock insuffisant'
      );

      act(() => {
        vcRoot.unmount();
      });
      vcContainer.remove();
    });
  });
});
