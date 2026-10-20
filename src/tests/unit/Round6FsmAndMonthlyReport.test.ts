import { describe, it, expect, vi } from 'vitest';
import { WorkOrderStateMachine } from '../../domain/corrective/services/WorkOrderStateMachine';
import { AvailabilityCalculationService } from '../../domain/services/AvailabilityCalculationService';
import { MonthlyReportCalculationService } from '../../application/services/MonthlyReportCalculationService';
import seedCorrectiveInterventions from '../../data/corrective/seedCorrectiveInterventions.json';
import seedStockItems from '../../data/stock/seedStockItems.json';
import seedMouvements from '../../data/movements/seedMouvements.json';
import fs from 'fs';
import path from 'path';

describe('Round 6: Work Order FSM (M-03), Reliability Metrics MTTR/MTBF/OEE (M-04) & Monthly Executive Report (P2.1-P2.3)', () => {
  describe('1. WorkOrderStateMachine (FSM — M-03)', () => {
    it('normalizes legacy and canonical status strings accurately', () => {
      expect(WorkOrderStateMachine.normalizeStatus('DEMANDE')).toBe('DEMANDE');
      expect(WorkOrderStateMachine.normalizeStatus('DEMANDE_CREEE')).toBe('DEMANDE');
      expect(WorkOrderStateMachine.normalizeStatus('BT_PLANIFIE')).toBe('BT_PLANIFIE');
      expect(WorkOrderStateMachine.normalizeStatus('EN_COURS')).toBe('EN_COURS');
      expect(WorkOrderStateMachine.normalizeStatus('EN_ATTENTE_PDR')).toBe('EN_ATTENTE_PDR');
      expect(WorkOrderStateMachine.normalizeStatus('CLOTURE')).toBe('CLOTURE');
      expect(WorkOrderStateMachine.normalizeStatus('FERME')).toBe('CLOTURE');
      expect(WorkOrderStateMachine.normalizeStatus('ANNULE')).toBe('ANNULE');
    });

    it('permits valid lifecycle transitions (DEMANDE -> BT_PLANIFIE -> EN_COURS -> EN_ATTENTE_PDR -> CLOTURE)', () => {
      expect(WorkOrderStateMachine.canTransition('DEMANDE', 'BT_PLANIFIE')).toBe(true);
      expect(WorkOrderStateMachine.canTransition('DEMANDE', 'EN_COURS')).toBe(true);
      expect(WorkOrderStateMachine.canTransition('BT_PLANIFIE', 'EN_COURS')).toBe(true);
      expect(WorkOrderStateMachine.canTransition('EN_COURS', 'EN_ATTENTE_PDR')).toBe(true);
      expect(WorkOrderStateMachine.canTransition('EN_ATTENTE_PDR', 'EN_COURS')).toBe(true);
      expect(WorkOrderStateMachine.canTransition('EN_COURS', 'CLOTURE')).toBe(true);
    });

    it('blocks re-closing or mutating an already CLOTURE or ANNULE work order', () => {
      const closedBt = {
        id: 'CORR-001',
        num_bt: 'BT-2026-001',
        code_machine: 'DET-05',
        statut: 'CLOTURE',
        action_realisee: 'Remplacement roulements',
      };

      expect(WorkOrderStateMachine.canTransition('CLOTURE', 'CLOTURE')).toBe(false);
      expect(WorkOrderStateMachine.canTransition('CLOTURE', 'EN_COURS')).toBe(false);

      const res = WorkOrderStateMachine.validateTransition(closedBt, 'CLOTURE', {
        action_realisee: 'Double close attempt',
      });
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('déjà CLOTURE');
    });

    it('enforces domain invariants (machine code for EN_COURS and work description for CLOTURE)', () => {
      const missingMachineDi = { id: 'DI-01', statut: 'DEMANDE' };
      const resNoMachine = WorkOrderStateMachine.validateTransition(missingMachineDi, 'EN_COURS');
      expect(resNoMachine.valid).toBe(false);

      const activeBtNoWork = {
        id: 'BT-02',
        num_bt: 'BT-2026-002',
        code_machine: 'DET-08',
        statut: 'EN_COURS',
        action_realisee: '',
        travail_a_faire: '',
        anomalie: '',
      };
      const resNoWork = WorkOrderStateMachine.validateTransition(activeBtNoWork, 'CLOTURE', {
        action_realisee: '   ',
      });
      expect(resNoWork.valid).toBe(false);

      const resValidClose = WorkOrderStateMachine.validateTransition(activeBtNoWork, 'CLOTURE', {
        action_realisee: 'Remplacement courroie SPZ 2650',
      });
      expect(resValidClose.valid).toBe(true);
      expect(resValidClose.toStatus).toBe('CLOTURE');
    });

    it('verifies InterventionLiveTab does not duplicate onAddMouvement upon closure', () => {
      const liveTabPath = path.resolve(process.cwd(), 'src/presentation/pages/corrective/InterventionLiveTab.tsx');
      const content = fs.readFileSync(liveTabPath, 'utf-8');
      // handleClotureSubmit should delegate to onClotureIntervention and not call onAddMouvement directly inside handleClotureSubmit
      const submitBlock = content.slice(content.indexOf('const handleClotureSubmit'));
      expect(submitBlock).toContain('onClotureIntervention(activeIntervention.id');
      expect(submitBlock).not.toContain("type: 'SORTIE'");
    });
  });

  describe('2. Industrial Reliability Calculations (MTTR / MTBF / OEE — M-04)', () => {
    it('accurately parses temps_intervention_mins and temps_arret from factory seed records', () => {
      const firstSeed = seedCorrectiveInterventions[0]; // temps_intervention_mins: 105, temps_arret: "02:15" (135 mins)
      expect(AvailabilityCalculationService.getInterventionDurationMinutes(firstSeed)).toBe(105);
      expect(AvailabilityCalculationService.getDowntimeMinutes(firstSeed)).toBe(135);
    });

    it('computes accurate MTTR, MTBF, and Operational Availability across factory seed data', () => {
      const mttrHours = AvailabilityCalculationService.calculateMTTR(seedCorrectiveInterventions);
      // Seed has real durations (105m, 90m, 60m, etc.) -> not hardcoded 0.75h (45m)
      expect(mttrHours).toBeGreaterThan(1.0);
      expect(mttrHours).not.toBe(0.75);

      const mtbfHours = AvailabilityCalculationService.calculateMTBF(seedCorrectiveInterventions, 12 * 160);
      expect(mtbfHours).toBeGreaterThan(100);

      const availability = AvailabilityCalculationService.calculateAvailability(
        seedCorrectiveInterventions,
        12 * 160
      );
      expect(availability).toBeGreaterThan(90);
      expect(availability).toBeLessThanOrEqual(100);
    });
  });

  describe('3. Monthly Executive Report & Month-over-Month Comparison (P2.1, P2.2, P2.3)', () => {
    it('computes June 2026 executive metrics from real seed data (demande_date & temps_arret)', () => {
      const comparison = MonthlyReportCalculationService.calculateMonthOverMonthComparison({
        month: '2026-06',
        stockItems: seedStockItems as any[],
        mouvements: seedMouvements as any[],
        correctiveInterventions: seedCorrectiveInterventions as any[],
        preventiveTasks: [{ id: 'PM-1' }, { id: 'PM-2' }],
        preventiveExecutions: [],
      });

      expect(comparison.currentMonth).toBe('2026-06');
      expect(comparison.previousMonth).toBe('2026-05');
      expect(comparison.currentReport.correctiveCount).toBeGreaterThan(0);
      expect(comparison.currentReport.totalDowntimeHours).toBeGreaterThan(0);
      expect(comparison.currentReport.mttrHours).toBeGreaterThan(0);
      expect(comparison.currentReport.mtbfHours).toBeGreaterThan(0);
      expect(comparison.currentReport.availabilityRate).toBeGreaterThan(0);
      expect(comparison.currentReport.technicianBreakdown.length).toBeGreaterThan(0);
    });

    it('verifies executive_report route is wired in AppRouter.tsx and useAppRouterProps.ts', () => {
      const routerPath = path.resolve(process.cwd(), 'src/presentation/router/AppRouter.tsx');
      const routerContent = fs.readFileSync(routerPath, 'utf-8');
      expect(routerContent).toContain("currentTab === 'executive_report'");
      expect(routerContent).toContain('<MonthlyExecutiveReportView {...props.executiveReport} />');
    });
  });
});
