/**
 * @file FinancialBudget.ts
 * @module domain/finance/entities/FinancialBudget
 * @description
 * الكيانات المحاسبية والمالية لنظام GMAO وفقاً للمعايير الدولية (ISO 4217, IFRS / Industrial Cost Accounting).
 */

export interface FiscalBudgetConfig {
  fiscalYear: number;
  allocatedPreventive: number;      // الميزانية المخصصة للصيانة الوقائية (MAD)
  allocatedCorrective: number;      // الميزانية المخصصة للصيانة التصحيحية والطوارئ (MAD)
  allocatedExternal: number;        // الميزانية المخصصة للمقاولات والبوبيناج الخارجي (MAD)
  allocatedSparesStock: number;     // ميزانية مشتريات وتجديد قطع الغيار PDR (MAD)
  technicianHourlyRate: number;     // كلفة ساعة عمل التقني الداخلي (درهم/ساعة)
  productionDowntimeCostPerHour: number; // كلفة توقف خط الإنتاج لكل ساعة (درهم/ساعة)
  berThresholdPercent: number;      // عتبة الإهلاك الاقتصادي الموصى باستبدال الآلة عندها (افتراضياً 70%)
  defaultVatRate: number;           // نسبة الضريبة على القيمة المضافة TVA (المغرب: 20%)
  updatedAt: string;
}

export interface HistoricalExchangeRate {
  id: string;
  date: string;                     // YYYY-MM-DD
  sourceCurrency: 'USD' | 'EUR';
  targetCurrency: 'MAD';
  rate: number;                     // 1 Source = rate MAD (e.g., 1 EUR = 10.85 MAD)
  note?: string;                    // مرجع الفاتورة أو ملاحظة البنك
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

export const DEFAULT_FISCAL_BUDGET: FiscalBudgetConfig = {
  fiscalYear: new Date().getFullYear(),
  allocatedPreventive: 180000,
  allocatedCorrective: 140000,
  allocatedExternal: 75000,
  allocatedSparesStock: 250000,
  technicianHourlyRate: 55,         // 55 DH / heure
  productionDowntimeCostPerHour: 2500, // 2,500 DH / heure de perte industrielle
  berThresholdPercent: 70,          // 70% Beyond Economical Repair
  defaultVatRate: 20,               // 20% TVA au Maroc
  updatedAt: new Date().toISOString(),
};

export const INITIAL_EXCHANGE_RATES: HistoricalExchangeRate[] = [
  {
    id: 'rate-eur-initial',
    date: new Date().toISOString().split('T')[0],
    sourceCurrency: 'EUR',
    targetCurrency: 'MAD',
    rate: 10.85,
    note: 'Taux officiel Bank Al-Maghrib',
  },
  {
    id: 'rate-usd-initial',
    date: new Date().toISOString().split('T')[0],
    sourceCurrency: 'USD',
    targetCurrency: 'MAD',
    rate: 9.95,
    note: 'Taux officiel Bank Al-Maghrib',
  },
];
