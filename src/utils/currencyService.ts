import { useState, useEffect, useCallback } from 'react';
import { storageService } from './storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';

export type CurrencyCode = 'MAD' | 'USD' | 'EUR';
export type MadSymbolVariant = 'DH' | 'MAD' | 'د.م.';

export interface Iso4217CurrencySpec {
  code: CurrencyCode;
  numericIsoCode: string;
  defaultSymbol: string;
  symbolPosition: 'PREFIX' | 'SUFFIX';
  nameEn: string;
  nameFr: string;
  nameAr: string;
  subUnitEn: string;
  subUnitFr: string;
  subUnitAr: string;
  iconMeta: {
    material: string;
    fontAwesome: string;
    standardNoteFr: string;
    standardNoteAr: string;
  };
}

export const ISO_4217_CURRENCIES: Record<CurrencyCode, Iso4217CurrencySpec> = {
  MAD: {
    code: 'MAD',
    numericIsoCode: '504',
    defaultSymbol: 'DH',
    symbolPosition: 'SUFFIX',
    nameEn: 'Moroccan Dirham',
    nameFr: 'Dirham Marocain',
    nameAr: 'الدرهم المغربي',
    subUnitEn: 'Centime (1/100)',
    subUnitFr: 'Centime (1/100)',
    subUnitAr: 'السنتيم (Centime)',
    iconMeta: {
      material: 'payments / account_balance_wallet',
      fontAwesome: 'fa-coins / fa-money-bill-wave',
      standardNoteFr: 'Symbole ou code placé après le montant avec un espace (ex: 1,500.00 DH / 1,500.00 MAD)',
      standardNoteAr: 'يوضع الرمز أو الاختصار بعد الرقم مع مسافة (مثل: 1,500.00 MAD أو 1,500.00 DH أو 1,500.00 د.م.)',
    },
  },
  USD: {
    code: 'USD',
    numericIsoCode: '840',
    defaultSymbol: '$',
    symbolPosition: 'PREFIX',
    nameEn: 'US Dollar',
    nameFr: 'Dollar Américain',
    nameAr: 'الدولار الأمريكي',
    subUnitEn: 'Cent (1/100)',
    subUnitFr: 'Cent (1/100)',
    subUnitAr: 'السنت (Cent)',
    iconMeta: {
      material: 'attach_money / monetization_on',
      fontAwesome: 'fa-dollar-sign / fa-usd',
      standardNoteFr: 'Symbole placé avant le montant (ex: $150.00)',
      standardNoteAr: 'يوضع الرمز قبل الرقم عادةً (مثل: $150.00)',
    },
  },
  EUR: {
    code: 'EUR',
    numericIsoCode: '978',
    defaultSymbol: '€',
    symbolPosition: 'PREFIX',
    nameEn: 'Euro',
    nameFr: 'Euro Européen',
    nameAr: 'اليورو الأوروبي',
    subUnitEn: 'Cent (1/100)',
    subUnitFr: 'Centime (1/100)',
    subUnitAr: 'السنت (Cent)',
    iconMeta: {
      material: 'euro / euro_symbol',
      fontAwesome: 'fa-euro-sign / fa-eur',
      standardNoteFr: 'Symbole placé avant le montant (ex: €100.00)',
      standardNoteAr: 'يوضع الرمز قبل الرقم عادةً (مثل: €100.00)',
    },
  },
};

export interface CurrencyFinancialConfig {
  /** Active display currency (ISO 4217 code: MAD, USD, EUR) */
  activeCurrencyCode: CurrencyCode;
  /** Base / Local accounting currency of the plant (default: MAD) */
  baseCurrencyCode: CurrencyCode;
  /** Graphical symbol variant when MAD is active: 'DH' | 'MAD' | 'د.م.' */
  madSymbolVariant: MadSymbolVariant;
  /** Exchange rates: how many units of target currency per 1 unit of Base Currency (MAD) */
  exchangeRates: Record<CurrencyCode, number>;
  /** Whether to multiply displayed amounts by the exchange rate when activeCurrencyCode !== baseCurrencyCode */
  applyExchangeRateConversion: boolean;
  /** Tax / VAT rate percentage (TVA Maroc = 20% by default) */
  vatRatePercent: number;
  /** Financial / Fiscal Year (Année Fiscale) */
  fiscalYear: number;
}

export const DEFAULT_CURRENCY_CONFIG: CurrencyFinancialConfig = {
  activeCurrencyCode: 'MAD',
  baseCurrencyCode: 'MAD',
  madSymbolVariant: 'DH',
  exchangeRates: {
    MAD: 1,
    USD: 0.1,
    EUR: 0.092,
  },
  applyExchangeRateConversion: false,
  vatRatePercent: 20,
  fiscalYear: new Date().getFullYear(),
};

const CURRENCY_CHANGE_EVENT = 'gmao:currency-config-changed';

function isValidCurrencyCode(code: unknown): code is CurrencyCode {
  return code === 'MAD' || code === 'USD' || code === 'EUR';
}

function isValidMadVariant(v: unknown): v is MadSymbolVariant {
  return v === 'DH' || v === 'MAD' || v === 'د.م.';
}

export function getCurrencyConfig(): CurrencyFinancialConfig {
  try {
    const raw = storageService.getItem(STORAGE_KEYS.CURRENCY_CONFIG);
    if (!raw) return { ...DEFAULT_CURRENCY_CONFIG };
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_CURRENCY_CONFIG };

    const activeCurrencyCode: CurrencyCode = isValidCurrencyCode(parsed.activeCurrencyCode)
      ? parsed.activeCurrencyCode
      : 'MAD';
    const baseCurrencyCode: CurrencyCode = isValidCurrencyCode(parsed.baseCurrencyCode)
      ? parsed.baseCurrencyCode
      : 'MAD';
    const madSymbolVariant: MadSymbolVariant = isValidMadVariant(parsed.madSymbolVariant)
      ? parsed.madSymbolVariant
      : 'DH';

    const rawRates = parsed.exchangeRates && typeof parsed.exchangeRates === 'object' ? parsed.exchangeRates : {};
    const exchangeRates: Record<CurrencyCode, number> = {
      MAD: Number(rawRates.MAD) > 0 ? Number(rawRates.MAD) : 1,
      USD: Number(rawRates.USD) > 0 ? Number(rawRates.USD) : 0.1,
      EUR: Number(rawRates.EUR) > 0 ? Number(rawRates.EUR) : 0.092,
    };

    const vatRatePercent =
      Number.isFinite(Number(parsed.vatRatePercent)) && Number(parsed.vatRatePercent) >= 0
        ? Number(parsed.vatRatePercent)
        : 20;

    const fiscalYear =
      Number.isFinite(Number(parsed.fiscalYear)) && Number(parsed.fiscalYear) >= 2000
        ? Number(parsed.fiscalYear)
        : new Date().getFullYear();

    return {
      activeCurrencyCode,
      baseCurrencyCode,
      madSymbolVariant,
      exchangeRates,
      applyExchangeRateConversion: Boolean(parsed.applyExchangeRateConversion),
      vatRatePercent,
      fiscalYear,
    };
  } catch {
    return { ...DEFAULT_CURRENCY_CONFIG };
  }
}

export function saveCurrencyConfig(partial: Partial<CurrencyFinancialConfig>): CurrencyFinancialConfig {
  const current = getCurrencyConfig();
  const next: CurrencyFinancialConfig = {
    ...current,
    ...partial,
    exchangeRates: {
      ...current.exchangeRates,
      ...(partial.exchangeRates || {}),
    },
  };
  storageService.setItem(STORAGE_KEYS.CURRENCY_CONFIG, next);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CURRENCY_CHANGE_EVENT, { detail: next }));
  }
  return next;
}

/**
 * Returns the active ISO 4217 Currency Code ('MAD' | 'USD' | 'EUR').
 * Recommended for backend persistence, Excel column headers, and accounting exports.
 */
export function getCurrencyCode(config?: CurrencyFinancialConfig): CurrencyCode {
  const cfg = config || getCurrencyConfig();
  return cfg.activeCurrencyCode;
}

/**
 * Returns the active graphical currency symbol ('DH' | 'MAD' | 'د.م.' | '$' | '€') for UI badges and labels.
 */
export function getCurrencySymbol(config?: CurrencyFinancialConfig): string {
  const cfg = config || getCurrencyConfig();
  if (cfg.activeCurrencyCode === 'MAD') {
    return cfg.madSymbolVariant || 'DH';
  }
  return ISO_4217_CURRENCIES[cfg.activeCurrencyCode]?.defaultSymbol || 'DH';
}

export interface FormatCurrencyOptions {
  /** Minimum fraction digits (default: 0 if integer, else 2; can force 2 for strict accounting) */
  decimals?: number;
  /** Force ISO 4217 code instead of graphical symbol (e.g. '1,500.00 MAD') */
  useIsoCode?: boolean;
  /** Override config */
  config?: CurrencyFinancialConfig;
}

/**
 * Converts a raw amount from Base Currency to Active Display Currency if applyExchangeRateConversion is enabled.
 */
export function convertCurrencyAmount(amount: number, config?: CurrencyFinancialConfig): number {
  const num = Number(amount);
  if (!Number.isFinite(num)) return 0;
  const cfg = config || getCurrencyConfig();
  if (!cfg.applyExchangeRateConversion || cfg.activeCurrencyCode === cfg.baseCurrencyCode) {
    return num;
  }
  const baseRate = cfg.exchangeRates[cfg.baseCurrencyCode] || 1;
  const targetRate = cfg.exchangeRates[cfg.activeCurrencyCode] || 1;
  return Math.round((num / baseRate) * targetRate * 100) / 100;
}

/**
 * Formats a numeric amount according to international ISO 4217 & Intl conventions:
 * - USD ($) and EUR (€): Symbol placed BEFORE the number (e.g. $150.00, €100.00)
 * - MAD (DH, MAD, د.م.): Symbol placed AFTER the number with a space (e.g. 1,500.00 DH, 1,500.00 MAD, 1,500.00 د.م.)
 */
export function formatCurrency(amount: unknown, options: FormatCurrencyOptions = {}): string {
  const cfg = options.config || getCurrencyConfig();
  const rawNum = Number(amount);
  const safeNum = Number.isFinite(rawNum) ? convertCurrencyAmount(rawNum, cfg) : 0;
  const isNegative = safeNum < 0;
  const absNum = Math.abs(safeNum);

  const hasFraction = Math.abs(absNum - Math.round(absNum)) > 0.001;
  const fractionDigits =
    typeof options.decimals === 'number' ? options.decimals : hasFraction ? 2 : 0;

  const formattedNumber = absNum.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  const spec = ISO_4217_CURRENCIES[cfg.activeCurrencyCode] || ISO_4217_CURRENCIES.MAD;
  const label = options.useIsoCode ? cfg.activeCurrencyCode : getCurrencySymbol(cfg);

  if (spec.symbolPosition === 'PREFIX' && !options.useIsoCode) {
    return isNegative ? `-${label}${formattedNumber}` : `${label}${formattedNumber}`;
  }
  return isNegative ? `-${formattedNumber} ${label}` : `${formattedNumber} ${label}`;
}

/**
 * Reactive React Hook for consuming and updating ISO 4217 currency configuration across views.
 */
export function useCurrency() {
  const [config, setConfig] = useState<CurrencyFinancialConfig>(() => getCurrencyConfig());

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent<CurrencyFinancialConfig>;
      if (customEvent.detail) {
        setConfig(customEvent.detail);
      } else {
        setConfig(getCurrencyConfig());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key === STORAGE_KEYS.CURRENCY_CONFIG) {
        setConfig(getCurrencyConfig());
      }
    };

    window.addEventListener(CURRENCY_CHANGE_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(CURRENCY_CHANGE_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const updateConfig = useCallback((partial: Partial<CurrencyFinancialConfig>) => {
    const next = saveCurrencyConfig(partial);
    setConfig(next);
    return next;
  }, []);

  const resetToDefault = useCallback(() => {
    const next = saveCurrencyConfig(DEFAULT_CURRENCY_CONFIG);
    setConfig(next);
    return next;
  }, []);

  const currencyCode = config.activeCurrencyCode;
  const currencySymbol = getCurrencySymbol(config);
  const spec = ISO_4217_CURRENCIES[currencyCode] || ISO_4217_CURRENCIES.MAD;

  const format = useCallback(
    (amount: unknown, opts?: Omit<FormatCurrencyOptions, 'config'>) =>
      formatCurrency(amount, { ...opts, config }),
    [config]
  );

  return {
    config,
    currencyCode,
    currencySymbol,
    spec,
    formatCurrency: format,
    convertAmount: useCallback((amt: number) => convertCurrencyAmount(amt, config), [config]),
    updateConfig,
    resetToDefault,
  };
}
