/**
 * @file FinancialBudget.ts
 * @module domain/finance/entities/FinancialBudget
 * @description
 * الكيانات المحاسبية وضبط تكاليف الصيانة لنظام GMAO وفق المعايير الصناعية (ISO 55000 / ISO 4217).
 * يحترم دستور AGENTS.md (Zero Silent Seed Reinjection: الميزانية الافتراضية للمصنع الفارغ = 0).
 */

export interface FiscalBudgetConfig {
  fiscalYear: number;
  allocatedPreventive: number;           // الميزانية المخصصة للصيانة الوقائية (MAD)
  allocatedCorrective: number;           // الميزانية المخصصة للصيانة التصحيحية والطوارئ (MAD)
  allocatedExternal: number;             // الميزانية المخصصة للمقاولات والبوبيناج الخارجي (MAD)
  allocatedSparesStock: number;          // ميزانية مشتريات وتجديد قطع الغيار PDR (MAD)
  technicianHourlyRate: number;          // كلفة ساعة عمل التقني الداخلي المعتمدة (درهم/ساعة)
  productionDowntimeCostPerHour: number; // كلفة توقف خط الإنتاج المعتمدة لكل ساعة (درهم/ساعة)
  berThresholdPercent: number;           // عتبة الإهلاك الاقتصادي الموصى باستبدال الآلة عندها (افتراضياً 70%)
  defaultVatRate: number;                // نسبة الضريبة على القيمة المضافة TVA (المغرب: 20%)
  updatedAt: string;
  updatedBy?: string;                    // اسم أو معرّف المسؤول الذي عدّل الميزانية (سجل تدقيق)
}

export interface HistoricalExchangeRate {
  id: string;
  date: string;                          // YYYY-MM-DD
  sourceCurrency: 'USD' | 'EUR';
  targetCurrency: 'MAD';
  rate: number;                          // 1 Source = rate MAD (e.g., 1 EUR = 10.85 MAD)
  note?: string;                         // مرجع الفاتورة أو ملاحظة البنك
  updatedBy?: string;
}

export interface MultiCurrencyPurchaseRecord {
  id: string;
  date: string;
  supplier: string;
  invoiceNumber: string;
  partRef: string;
  partName: string;
  quantity: number;
  foreignPrice: number;
  foreignCurrency: 'USD' | 'EUR' | 'MAD';
  exchangeRate: number;
  convertedPriceMAD: number;
  vatPercent: number;
  totalPriceWithVatMAD: number;
}

/**
 * FIN-P0: الميزانية الافتراضية للمصنع الفارغ (Zero Silent Seed Reinjection).
 * لا يتم حقن أرقام ميزانية وهمية تلقائياً؛ المخصصات تبدأ من 0 حتى يدخلها المسؤول صراحةً أو يفعّل وضع الديمو.
 */
export const EMPTY_FISCAL_BUDGET: FiscalBudgetConfig = {
  fiscalYear: new Date().getFullYear(),
  allocatedPreventive: 0,
  allocatedCorrective: 0,
  allocatedExternal: 0,
  allocatedSparesStock: 0,
  technicianHourlyRate: 55,              // 55 DH / heure (معيار تسعير اليد العاملة عند غياب تخصيص)
  productionDowntimeCostPerHour: 2500,   // 2,500 DH / heure
  berThresholdPercent: 70,               // 70% Beyond Economical Repair
  defaultVatRate: 20,                    // 20% TVA au Maroc
  updatedAt: new Date().toISOString(),
};

/**
 * ميزانية بيانات العرض التجريبي (Demo Mode) — تُحمّل حصرياً عند استدعاء DataGateway.loadDemoData.
 */
export const DEMO_FISCAL_BUDGET: FiscalBudgetConfig = {
  fiscalYear: 2026,
  allocatedPreventive: 180000,
  allocatedCorrective: 140000,
  allocatedExternal: 75000,
  allocatedSparesStock: 250000,
  technicianHourlyRate: 55,
  productionDowntimeCostPerHour: 2500,
  berThresholdPercent: 70,
  defaultVatRate: 20,
  updatedAt: new Date().toISOString(),
  updatedBy: 'DEMO_SEED',
};

/**
 * Default export alias: points to EMPTY_FISCAL_BUDGET to guarantee zero silent seed reinjection.
 */
export const DEFAULT_FISCAL_BUDGET: FiscalBudgetConfig = EMPTY_FISCAL_BUDGET;

export const INITIAL_EXCHANGE_RATES: HistoricalExchangeRate[] = [
  {
    id: 'rate-eur-initial',
    date: new Date().toISOString().split('T')[0],
    sourceCurrency: 'EUR',
    targetCurrency: 'MAD',
    rate: 10.85,
    note: 'Taux indicatif Bank Al-Maghrib',
  },
  {
    id: 'rate-usd-initial',
    date: new Date().toISOString().split('T')[0],
    sourceCurrency: 'USD',
    targetCurrency: 'MAD',
    rate: 9.95,
    note: 'Taux indicatif Bank Al-Maghrib',
  },
];
