import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';
import { storageService } from '../../utils/storageService';
import { sanitizeObject } from '../../utils/sanitize';
import {
  DEMO_FISCAL_BUDGET,
  EMPTY_FISCAL_BUDGET,
  type BudgetAuditEntry,
  type BudgetPeriodMode,
  type FiscalBudgetConfig,
} from '../../domain/finance/entities/FinancialBudget';
import { AuditRepo } from './AuditRepo';

function sanitizeSeries(arr: unknown, len: number): number[] {
  if (!Array.isArray(arr)) return Array(len).fill(0);
  return Array.from({ length: len }, (_, i) =>
    Math.max(0, Math.round((Number(arr[i]) || 0) * 100) / 100)
  );
}

/**
 * Domain repository owning fiscal budgets and costing parameters (`STORAGE_KEYS.FINANCIAL_BUDGETS`).
 */
export const FinanceRepo = {
  getFinancialBudget(): FiscalBudgetConfig {
    const startMode = storageService.getItem(STORAGE_KEYS.START_MODE);
    const saved = storageService.getItem(STORAGE_KEYS.FINANCIAL_BUDGETS) as Partial<FiscalBudgetConfig> | null;
    if (saved && typeof saved === 'object' && typeof saved.fiscalYear === 'number') {
      if (startMode === 'empty' && saved.updatedBy === 'DEMO_SEED') {
        return { ...EMPTY_FISCAL_BUDGET };
      }
      return {
        ...EMPTY_FISCAL_BUDGET,
        ...saved,
        periodMode:
          saved.periodMode === 'MONTHLY' || saved.periodMode === 'QUARTERLY' ? saved.periodMode : 'ANNUAL',
        burnWarningPercent: Math.max(50, Math.min(100, Number(saved.burnWarningPercent ?? 90))),
        budgetChangeLog: Array.isArray(saved.budgetChangeLog) ? saved.budgetChangeLog.slice(0, 5) : [],
      } as FiscalBudgetConfig;
    }
    const isDemo = storageService.getItem(STORAGE_KEYS.DEMO_MODE) === true;
    return isDemo && startMode !== 'empty' ? { ...DEMO_FISCAL_BUDGET } : { ...EMPTY_FISCAL_BUDGET };
  },

  saveFinancialBudget(budget: Partial<FiscalBudgetConfig>, actorName?: string): FiscalBudgetConfig {
    const clean = sanitizeObject(budget || {}) as Partial<FiscalBudgetConfig>;
    const prevSaved = storageService.getItem(STORAGE_KEYS.FINANCIAL_BUDGETS) as Partial<FiscalBudgetConfig> | null;

    const fiscalYear = Number(clean.fiscalYear) || new Date().getFullYear();
    const allocatedPreventive = Math.max(0, Number(clean.allocatedPreventive) || 0);
    const allocatedCorrective = Math.max(0, Number(clean.allocatedCorrective) || 0);
    const allocatedExternal = Math.max(0, Number(clean.allocatedExternal) || 0);
    const allocatedSparesStock = Math.max(0, Number(clean.allocatedSparesStock) || 0);
    const periodMode: BudgetPeriodMode =
      clean.periodMode === 'MONTHLY' || clean.periodMode === 'QUARTERLY' ? clean.periodMode : 'ANNUAL';
    const burnWarningPercent = Math.max(50, Math.min(100, Number(clean.burnWarningPercent ?? 90)));
    const updatedAt = clean.updatedAt || new Date().toISOString();
    const updatedBy = actorName || clean.updatedBy || 'ADMIN';

    const monthlyAllocations = clean.monthlyAllocations
      ? {
          preventive: sanitizeSeries(clean.monthlyAllocations.preventive, 12),
          corrective: sanitizeSeries(clean.monthlyAllocations.corrective, 12),
          external: sanitizeSeries(clean.monthlyAllocations.external, 12),
          spares: sanitizeSeries(clean.monthlyAllocations.spares, 12),
        }
      : undefined;

    const quarterlyAllocations = clean.quarterlyAllocations
      ? {
          preventive: sanitizeSeries(clean.quarterlyAllocations.preventive, 4),
          corrective: sanitizeSeries(clean.quarterlyAllocations.corrective, 4),
          external: sanitizeSeries(clean.quarterlyAllocations.external, 4),
          spares: sanitizeSeries(clean.quarterlyAllocations.spares, 4),
        }
      : undefined;

    const totalAllocated =
      allocatedPreventive + allocatedCorrective + allocatedExternal + allocatedSparesStock;

    let budgetChangeLog: BudgetAuditEntry[] = Array.isArray(clean.budgetChangeLog)
      ? clean.budgetChangeLog
      : Array.isArray(prevSaved?.budgetChangeLog)
      ? prevSaved.budgetChangeLog
      : [];

    if (updatedBy === 'FACTORY_RESET') {
      budgetChangeLog = [];
    } else if (updatedBy !== 'DEMO_SEED') {
      const auditEntry: BudgetAuditEntry = {
        id: `bgt-log-${Date.now()}`,
        timestamp: updatedAt,
        updatedBy,
        fiscalYear,
        periodMode,
        totalAllocated,
        summary: `Ex. ${fiscalYear} (${periodMode}) — Plafond: ${totalAllocated.toLocaleString('fr-FR')} MAD (Seuil alerte: ${burnWarningPercent}%)`,
      };
      budgetChangeLog = [auditEntry, ...budgetChangeLog].slice(0, 5);
    }

    const next: FiscalBudgetConfig = {
      fiscalYear,
      allocatedPreventive,
      allocatedCorrective,
      allocatedExternal,
      allocatedSparesStock,
      technicianHourlyRate: Math.max(0, Number(clean.technicianHourlyRate ?? EMPTY_FISCAL_BUDGET.technicianHourlyRate)),
      productionDowntimeCostPerHour: Math.max(
        0,
        Number(clean.productionDowntimeCostPerHour ?? EMPTY_FISCAL_BUDGET.productionDowntimeCostPerHour)
      ),
      berThresholdPercent: Math.max(10, Math.min(200, Number(clean.berThresholdPercent) || 70)),
      defaultVatRate: Math.max(0, Math.min(100, Number(clean.defaultVatRate ?? 20))),
      periodMode,
      burnWarningPercent,
      ...(monthlyAllocations ? { monthlyAllocations } : {}),
      ...(quarterlyAllocations ? { quarterlyAllocations } : {}),
      budgetChangeLog,
      updatedAt,
      updatedBy,
    };

    storageService.setItem(STORAGE_KEYS.FINANCIAL_BUDGETS, next);

    if (updatedBy !== 'FACTORY_RESET' && updatedBy !== 'DEMO_SEED') {
      AuditRepo.appendAuditEvent({
        actorId: updatedBy,
        actorName: updatedBy,
        actorRole: 'ADMIN',
        actionType: 'BUDGET_UPDATED',
        entityType: 'FINANCIAL_BUDGET',
        entityId: String(fiscalYear),
        before: prevSaved
          ? {
              fiscalYear: prevSaved.fiscalYear,
              periodMode: prevSaved.periodMode,
              allocatedPreventive: prevSaved.allocatedPreventive,
              allocatedCorrective: prevSaved.allocatedCorrective,
              allocatedExternal: prevSaved.allocatedExternal,
              allocatedSparesStock: prevSaved.allocatedSparesStock,
            }
          : null,
        after: {
          fiscalYear,
          periodMode,
          totalAllocated,
          allocatedPreventive,
          allocatedCorrective,
          allocatedExternal,
          allocatedSparesStock,
        },
        meta: {
          summary: `Budget Ex. ${fiscalYear} (${periodMode}) mis à jour: ${totalAllocated} MAD`,
        },
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('gmao_financial_budget_updated', { detail: next }));
    }
    return next;
  },
};
