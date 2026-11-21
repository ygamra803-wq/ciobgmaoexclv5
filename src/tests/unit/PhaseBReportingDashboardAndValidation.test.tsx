import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MonthlyReportCalculationService,
} from '../../application/services/MonthlyReportCalculationService';
import {
  buildShiftOrWeeklyReport,
  buildShiftWeeklyReportJson,
} from '../../application/services/ShiftWeeklyReportEngine';
import { useDashboardController, type DashboardViewProps } from '../../presentation/pages/dashboard/hooks/useDashboardController';
import { I18nProvider } from '../../i18n/I18nContext';
import { ROLES } from '../../core/security/Roles';
import type { CurrencyFinancialConfig } from '../../utils/currencyService';
import { FinanceBudgetEditModal } from '../../presentation/pages/finance/components/FinanceModals';
import { EMPTY_FISCAL_BUDGET } from '../../domain/finance/entities/FinancialBudget';
import ValidationCenterView from '../../presentation/pages/validation/ValidationCenterView';
import FinanceView from '../../presentation/pages/finance/FinanceView';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'ADM-1',
      name: 'Superviseur Test',
      nom: 'Superviseur Test',
      role: 'ADMIN',
      matricule: 'ADM-01',
    },
  }),
}));

function setSessionUser(role: string, id = 'USR-ADMIN', name = 'Superviseur Test') {
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

describe('Phase B — Reporting C1/JSON Parity, Dashboard Integrity, Validation Guards & Finance UI', () => {
  beforeEach(() => {
    clearSessionUser();
    storageService.removeItem(STORAGE_KEYS.FINANCIAL_BUDGETS);
    storageService.removeItem('gmao_currency_config_v1');
  });

  describe('1. Monthly & Shift/Weekly Report Engine Parity', () => {
    it('reconciles C1 machineCostBreakdown with totalOfficialMaintenanceCost including archived historical costs & PM sparesCost fallback', () => {
      const machines = [
        { id: 'M-ACT', id_machine_registered: 'M-ACT', nom: 'Presse Active', statut: 'Active', asset_class: 'PRODUCTION' },
        { id: 'M-OLD', id_machine_registered: 'M-OLD', nom: 'Ancienne Presse', statut: 'ARCHIVEE', is_active: false, asset_class: 'PRODUCTION' },
      ];

      const correctiveInterventions = [
        {
          id: 'BT-OLD-1',
          num_bt: 'BT-2026-801',
          code_machine: 'M-OLD',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-06-10',
          pdr_cost: 420,
          temps_arret_minutes: 60,
          intervenant: 'Ali',
        },
        {
          id: 'BT-ACT-1',
          num_bt: 'BT-2026-802',
          code_machine: 'M-ACT',
          statut: 'CLOTURE',
          validation_status: 'APPROVED',
          date_cloture: '2026-06-12',
          pdr_cost: 180,
          temps_arret_minutes: 30,
          intervenant: 'Karim',
        },
      ];

      const preventiveExecutions = [
        {
          id: 'EX-PM-1',
          taskCode: 'PM-01',
          machineCode: 'M-ACT',
          executedAt: '2026-06-15',
          periodMonth: '2026-06',
          validation_status: 'APPROVED',
          sparesCost: 150, // totalCost omitted intentionally
          durationMinutes: 0, // zero logged minutes -> no phantom 30m!
          executorName: 'Sami',
        },
      ];

      const sortiesExterne = [
        {
          id: 'EXT-OLD-1',
          id_machine: 'M-OLD',
          date_sortie: '2026-06-18',
          cout_bobinage: 300,
          validation_status: 'APPROVED',
        },
      ];

      const report = MonthlyReportCalculationService.calculateMonthlyReport({
        month: '2026-06',
        machines,
        correctiveInterventions,
        preventiveExecutions,
        preventiveTasks: [
          { id: 'T-ACT', code_machine: 'M-ACT', active: true, periodMonth: '2026-06' },
          { id: 'T-OLD', code_machine: 'M-OLD', active: true, periodMonth: '2026-06' },
        ],
        sortiesExterne,
        stockItems: [],
        mouvements: [],
      });

      // C1 exact reconciliation: 420 + 180 + 150 + 300 = 1050
      expect(report.correctiveSparesCost).toBe(600);
      expect(report.preventiveTotalCost).toBe(150);
      expect(report.externalBobinageCost).toBe(300);
      expect(report.totalOfficialMaintenanceCost).toBe(1050);

      const c1Sum = report.machineCostBreakdown.reduce((s, r) => s + r.totalOfficialCost, 0);
      expect(c1Sum).toBe(report.totalOfficialMaintenanceCost);
      expect(report.machineCostBreakdown.map((r) => r.machineCode).sort()).toEqual(['M-ACT', 'M-OLD']);

      // Archived machine still excluded from active topFailingMachines and scheduled PM count
      expect(report.topFailingMachines.map((m) => m.machineCode)).toEqual(['M-ACT']);
      expect(report.preventiveScheduledCount).toBe(1);

      // Zero-minute preventive execution does not invent 0.5h (30m) phantom labor
      const sami = report.technicianBreakdown.find((t) => t.name === 'Sami');
      expect(sami?.totalHours).toBe(0);
      expect(report.preventiveLaborHours).toBe(0);
    });

    it('exports Shift/Weekly JSON with converted multi-currency amounts and currency metadata while removing phantom 30m labor', () => {
      const report = buildShiftOrWeeklyReport({
        from: '2026-06-01',
        to: '2026-06-07',
        machines: [{ id_machine_registered: 'M-01', nom: 'Tour CNC', asset_class: 'PRODUCTION' }],
        correctiveInterventions: [
          {
            id: 'BT-1',
            num_bt: 'BT-10',
            code_machine: 'M-01',
            statut: 'CLOTURE',
            validation_status: 'APPROVED',
            date_cloture: '2026-06-03',
            pdr_cost: 1000,
          },
        ],
        preventiveExecutions: [
          {
            id: 'EX-1',
            machineCode: 'M-01',
            executedAt: '2026-06-04',
            validation_status: 'APPROVED',
            totalCost: 100,
            durationMinutes: 0,
            executorName: 'TechPM',
          },
        ],
        mouvements: [
          {
            id: 'MVT-1',
            code_bon: 'BS-01',
            date: '2026-06-03',
            type: 'Sortie',
            ref: 'RLT-01',
            quantite: 2,
            prix_unitaire: 500,
            id_machine_registered: 'M-01',
          },
        ],
        stockItems: [],
        preventiveTasks: [],
        sortieDemands: [],
        sortiesExterne: [],
      });

      const techPm = report.technicianBreakdown.find((t) => t.name === 'TechPM');
      expect(techPm?.totalHours).toBe(0);
      expect(report.preventiveLaborHours).toBe(0);

      const eurConfig: CurrencyFinancialConfig = {
        activeCurrencyCode: 'EUR',
        baseCurrencyCode: 'MAD',
        madSymbolVariant: 'DH',
        exchangeRates: {
          MAD: 1,
          USD: 0.1,
          EUR: 0.1,
        },
        applyExchangeRateConversion: true,
        vatRatePercent: 20,
        fiscalYear: 2026,
      };
      const parsed = JSON.parse(buildShiftWeeklyReportJson(report, eurConfig));
      expect(parsed.currency).toEqual({ code: 'EUR', symbol: '€', rateApplied: 0.1 });
      expect(parsed.summary.currencyCode).toBe('EUR');
      expect(parsed.summary.correctiveSparesCost).toBe(100); // 1000 * 0.1
      expect(parsed.summary.preventiveTotalCost).toBe(10); // 100 * 0.1
      expect(parsed.summary.totalOfficialMaintenanceCost).toBe(110); // 1100 * 0.1
      expect(parsed.machineCostBreakdown[0].totalOfficialCost).toBe(110);
      expect(parsed.officialMovementsInPeriod[0].totalCost).toBe(100);
    });
  });

  describe('2. Dashboard Controller Integrity & PO Guards', () => {
    it('filters unapproved Maker-Checker claims & archived machines from KPIs/charts and enforces PO validation + reception idempotency', () => {
      setSessionUser(ROLES.ADMIN, 'ADM-1', 'Directeur');
      let captured: ReturnType<typeof useDashboardController> | null = null;
      const onAddMouvement = vi.fn();
      const onUpdateMouvement = vi.fn();
      const showToast = vi.fn();

      const props: DashboardViewProps = {
        currentUser: { id: 'ADM-1', name: 'Directeur', role: ROLES.ADMIN },
        machines: [
          { id_machine_registered: 'M-ACT', nom: 'Presse Active', statut: 'Active' },
          { id_machine_registered: 'M-OLD', nom: 'Presse Archivée', statut: 'ARCHIVEE', is_active: false },
        ],
        stockItems: [{ ref: 'ROUL-6205', designation: 'Roulement 6205', stockActuel: 10, seuil: 3 }],
        mouvements: [
          {
            id: 'MVT-APPROVED',
            code_bon: 'BS-OK-1',
            type: 'Sortie',
            action_id: 'CORRECTIVE',
            ref: 'ROUL-6205',
            quantite: 2,
            id_machine_registered: 'M-ACT',
          },
          {
            id: 'MVT-PENDING',
            code_bon: 'BS-PEND-1',
            type: 'Sortie',
            action_id: 'CORRECTIVE',
            ref: 'ROUL-6205',
            quantite: 50,
            id_machine_registered: 'M-ACT',
            validation_status: 'PENDING_VALIDATION',
          },
          {
            id: 'CMD-EXISTING',
            code_bon: 'CMD-2026-001',
            type: 'COMMANDE',
            action_id: 'COMMANDE',
            ref: 'ROUL-6205',
            quantite: 4,
            tags: ['#COMMANDE_EN_ATTENTE'],
          },
          {
            id: 'CMD-RECEIVED',
            code_bon: 'CMD-2026-000',
            type: 'Entrée Externe',
            action_id: 'REAPPRO',
            ref: 'ROUL-6205',
            quantite: 4,
            tags: ['#RECEPTION_VALIDE', '#ENTREE_EXTERNE'],
          },
        ],
        correctiveInterventions: [
          {
            id: 'BT-OK',
            num_bt: 'BT-01',
            code_machine: 'M-ACT',
            statut: 'CLOTURE',
            validation_status: 'APPROVED',
            duree_intervention_min: 90,
          },
          {
            id: 'BT-PEND-CLOSE',
            num_bt: 'BT-02',
            code_machine: 'M-ACT',
            statut: 'CLOTURE',
            validation_status: 'PENDING_VALIDATION',
            duree_intervention_min: 300,
          },
          {
            id: 'BT-ARCH',
            num_bt: 'BT-03',
            code_machine: 'M-OLD',
            statut: 'CLOTURE',
            validation_status: 'APPROVED',
            duree_intervention_min: 120,
          },
        ],
        preventiveTasks: [
          { id: 'PM-1', code_machine: 'M-ACT', active: true, etat: 'Fait' },
          { id: 'PM-OLD', code_machine: 'M-OLD', active: true, etat: 'En retard' },
          { id: 'PM-ARCH', code_machine: 'M-ACT', statut: 'ARCHIVE', etat: 'En retard' },
        ],
        onAddMouvement,
        onUpdateMouvement,
        showToast,
      };

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <I18nProvider>
            <DashboardControllerHarness
              props={props}
              onCapture={(ctrl) => {
                captured = ctrl;
              }}
            />
          </I18nProvider>
        );
      });

      expect(captured).not.toBeNull();
      // Pending sortie (qty=50) must NOT inflate totalSortieQty or topConsumedArticles
      expect(captured!.actionStats.totalSortieQty).toBe(2);
      expect(captured!.topConsumedArticles[0]?.qty).toBe(2);

      // Archived machine M-OLD must NOT appear in topMachines
      expect(captured!.machineHealth.topMachines.map((m) => m.id)).toEqual(['M-ACT']);

      // Archived task & task for archived machine must NOT inflate pmTotalCount or pmOverdueCount
      expect(captured!.executiveMaintenanceSummary.pmTotalCount).toBe(1);
      expect(captured!.executiveMaintenanceSummary.pmDoneCount).toBe(1);
      expect(captured!.executiveMaintenanceSummary.pmOverdueCount).toBe(0);
      expect(captured!.executiveMaintenanceSummary.pmComplianceRate).toBe(100);

      // Unapproved CLOTURE (BT-PEND-CLOSE = 300m) must NOT be counted in closedBtCount or MTTR;
      // MTTR reflects approved closed BTs (BT-01 90m + BT-ARCH 120m -> avg 105m -> 1.8 h)
      expect(captured!.executiveMaintenanceSummary.closedBtCount).toBe(2); // BT-01 + BT-ARCH
      expect(captured!.executiveMaintenanceSummary.mttrDisplay).toBe('1.8 h');

      // PO Validation: reject quantity <= 0
      act(() => {
        captured!.setOrderForm((prev) => ({
          ...prev,
          ref: 'ROUL-6205',
          quantite: 0,
          code_bon: 'CMD-2026-099',
        }));
      });
      act(() => {
        captured!.handleSubmitOrder({ preventDefault: () => {} } as any);
      });
      expect(onAddMouvement).not.toHaveBeenCalled();

      // PO Validation: reject duplicate code_bon
      act(() => {
        captured!.setOrderForm((prev) => ({
          ...prev,
          ref: 'ROUL-6205',
          quantite: 5,
          code_bon: 'CMD-2026-001',
        }));
      });
      act(() => {
        captured!.handleSubmitOrder({ preventDefault: () => {} } as any);
      });
      expect(onAddMouvement).not.toHaveBeenCalled();

      // Reception Idempotency: already received order must NOT trigger onUpdateMouvement again
      act(() => {
        captured!.handleValidateReception({
          id: 'CMD-RECEIVED',
          tags: ['#RECEPTION_VALIDE', '#ENTREE_EXTERNE'],
        });
      });
      expect(onUpdateMouvement).not.toHaveBeenCalled();

      act(() => {
        root.unmount();
        container.remove();
      });
    });
  });

  describe('3. Validation Center & Finance UI Integrity', () => {
    it('blocks Auto-DI preventive approval when anomaly text is empty and exposes missing-PDR selector in Preventive modal', () => {
      setSessionUser(ROLES.ADMIN, 'ADM-1', 'Superviseur');
      const onReviewPreventive = vi.fn(() => ({ id: 'EX-1' }));
      const showToast = vi.fn();

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <I18nProvider>
            <ValidationCenterView
              stockItems={[{ ref: 'FILT-01', designation: 'Filtre Huile', stockActuel: 5 } as any]}
              machines={[{ id_machine_registered: 'M-01', nom: 'Presse 01' } as any]}
              mouvements={[]}
              correctiveInterventions={[]}
              preventiveExecutions={[
                {
                  id: 'EX-1',
                  taskId: 'T-1',
                  taskCode: 'PM-01',
                  actionCode: 'PM-01',
                  machineCode: 'M-01',
                  organe: 'Bloc Hydraulique',
                  notes: '',
                  anomalyDetected: true,
                  validation_status: 'PENDING_VALIDATION',
                  submitted_by_id: 'TECH-01',
                  submitted_by_name: 'Karim',
                  executedAt: '2026-06-15',
                  sparesProposed: [],
                } as any,
              ]}
              sortieDemands={[]}
              onReviewPreventiveValidation={onReviewPreventive}
              showToast={showToast}
            />
          </I18nProvider>
        );
      });

      const openBtn = container.querySelector('[data-testid="vc-open-prev-review-EX-1"]') as HTMLButtonElement;
      expect(openBtn).not.toBeNull();
      act(() => {
        openBtn.click();
      });

      // Missing-PDR panel is now present in Preventive modal
      expect(container.querySelector('[data-testid="vc-prev-add-pdr-panel"]')).not.toBeNull();

      // Clear auto-DI anomaly input and ensure Auto-DI checkbox is checked
      const autoDiCheckbox = container.querySelector('[data-testid="vc-prev-auto-di-checkbox"]') as HTMLInputElement;
      if (!autoDiCheckbox.checked) {
        act(() => {
          autoDiCheckbox.click();
        });
      }
      const anomalyInput = container.querySelector('[data-testid="vc-prev-auto-di-anomalie-input"]') as HTMLInputElement;
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        setter?.call(anomalyInput, '   ');
        anomalyInput.dispatchEvent(new Event('input', { bubbles: true }));
      });

      const approveBtn = container.querySelector('[data-testid="vc-prev-approve-btn"]') as HTMLButtonElement;
      act(() => {
        approveBtn.click();
      });

      expect(onReviewPreventive).not.toHaveBeenCalled();
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining('Auto-DI'),
        'warning'
      );

      act(() => {
        root.unmount();
        container.remove();
      });
    });

    it('renders active currency code in Finance simulator, excludes unapproved external dossiers from Finance KPI, and labels base MAD in budget modal', () => {
      setSessionUser(ROLES.ADMIN, 'ADM-1', 'DAF');
      storageService.setItem(STORAGE_KEYS.CURRENCY_CONFIG, {
        activeCurrencyCode: 'EUR',
        baseCurrencyCode: 'MAD',
        madSymbolVariant: 'DH',
        exchangeRates: {
          MAD: 1,
          USD: 0.1,
          EUR: 0.092,
        },
        applyExchangeRateConversion: true,
        vatRatePercent: 20,
        fiscalYear: 2026,
      });

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <I18nProvider>
            <FinanceView
              machines={[{ id_machine_registered: 'M-01', nom: 'Presse 01' }]}
              stockItems={[]}
              mouvements={[]}
              correctiveInterventions={[]}
              preventiveExecutions={[]}
              sortiesExterne={[
                { id: 'SE-OK', designation_organe: 'Moteur', validation_status: 'APPROVED', cout_bobinage: 500 },
                { id: 'SE-PEND', designation_organe: 'Pompe', validation_status: 'PENDING_VALIDATION', cout_bobinage: 999 },
                { id: 'SE-REJ', designation_organe: 'Vérin', validation_status: 'REJECTED', cout_bobinage: 888 },
              ]}
            />
          </I18nProvider>
        );
      });

      // Only 1 approved external dossier should be counted
      expect(container.textContent).toContain('1 dossier(s)');
      expect(container.textContent).not.toContain('3 dossier(s)');

      // Switch to inventory_procurement tab to check simulator currency label
      const tabs = Array.from(container.querySelectorAll('button'));
      const invTab = tabs.find((b) => b.textContent?.includes('Valorisation PDR'));
      expect(invTab).toBeDefined();
      act(() => {
        invTab!.click();
      });
      expect(container.textContent).toContain('Total Converti TTC (EUR)');
      expect(container.textContent).not.toContain('Total Converti TTC (MAD)');

      // Verify FinanceBudgetEditModal explicitly displays canonical MAD labels even if symbol prop is '€'
      act(() => {
        root.render(
          <FinanceBudgetEditModal
            open={true}
            canManage={true}
            editBudgetDraft={EMPTY_FISCAL_BUDGET}
            setEditBudgetDraft={() => {}}
            symbol="€"
            onClose={() => {}}
            onSave={() => {}}
          />
        );
      });
      expect(container.textContent).toContain('Budget Maintenance Préventive (MAD)');
      expect(container.textContent).toContain('Taux Horaire Technicien (MAD/h)');

      act(() => {
        root.unmount();
        container.remove();
      });
    });
  });
});
