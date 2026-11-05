import React from 'react';
import {
  Coins,
  Wallet,
  DollarSign,
  Euro,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Calculator,
  Calendar,
  Percent,
  ArrowRightLeft,
  Info,
  FileSpreadsheet,
} from 'lucide-react';
import {
  useCurrency,
  ISO_4217_CURRENCIES,
  formatCurrency,
  type CurrencyCode,
  type MadSymbolVariant,
} from '../../../../utils/currencyService';
import { useTranslation } from '../../../../i18n/I18nContext';
import { useAuth } from '../../../../context/AuthContext';
import { AuthorizationService } from '../../../../core/security/AuthorizationService';

interface SettingsCurrencyTabProps {
  showToast?: (msg: string, type?: string) => void;
}

export default function SettingsCurrencyTab({ showToast }: SettingsCurrencyTabProps) {
  const { language } = useTranslation();
  const langKey = (language === 'ar' || language === 'en' ? language : 'fr') as 'fr' | 'ar' | 'en';
  const { user: currentUser } = useAuth();
  const canManageSettings =
    Boolean(currentUser) && AuthorizationService.hasPermission(currentUser, 'settings.manage');

  const { config, currencyCode, currencySymbol, updateConfig, resetToDefault } = useCurrency();

  const copy = {
    fr: {
      title: 'Devise & Normes Financières GMAO (ISO 4217)',
      subtitle:
        'Configuration de la devise par défaut (Dirham Marocain — MAD / DH), du formatage international, des taux de change et des paramètres comptables.',
      baseBadge: 'Devise de Base Usine : MAD (Maroc)',
      selectTitle: '1. Sélection de la Devise Active (Multi-Currency Support)',
      selectDesc:
        'Le code ISO (MAD, USD, EUR) est utilisé dans la base de données et les exports comptables, tandis que le symbole graphique est affiché dans l’interface.',
      madVariantTitle: 'Symbole Graphique d’Affichage pour le Dirham Marocain (MAD)',
      madVariantDesc:
        'Choisissez l’abréviation affichée après les montants dans les tableaux et cartes KPI (ex: 1,500.00 DH ou 1,500.00 MAD ou 1,500.00 د.م.).',
      accountingTitle: '2. Paramètres Comptables & Fiscaux GMAO',
      fiscalYearLabel: 'Année Financière / Exercice Fiscal (Financial Year)',
      vatLabel: 'Taxe / TVA par défaut (Tax / VAT %)',
      conversionToggleLabel: 'Convertir automatiquement les montants selon le taux de change (Exchange Rate)',
      conversionToggleSub:
        'Si désactivé, les montants enregistrés dans la devise de base (MAD) sont affichés directement avec la devise choisie.',
      exchangeRatesTitle: 'Taux de Change (Exchange Rates vs 1 MAD)',
      previewTitle: '3. Aperçu du Formatage International (Intl / ISO 4217) & Calcul TTC',
      isoTableTitle: '4. Référentiel Officiel ISO 4217, Icônes & Terminologie Comptable GMAO',
      resetBtn: 'Rétablir Défaut Maroc (MAD / DH)',
      readOnlyNotice: 'Mode lecture seule — Seul un Administrateur peut modifier la devise du système.',
    },
    ar: {
      title: 'العملة والمعايير المحاسبية الدولية لـ GMAO (معيار ISO 4217)',
      subtitle:
        'إعداد العملة الافتراضية للتطبيق (الدرهم المغربي — MAD / DH / د.م.)، صيغة العرض العالمية، أسعار الصرف، والمعاملات المالية للمصنع.',
      baseBadge: 'العملة الأساسية للنظام (Base Currency): MAD (المغرب)',
      selectTitle: '1. اختيار العملة المعتمدة في التطبيق (Multi-Currency Support)',
      selectDesc:
        'ملاحظة محاسبية: يُستخدم رمز الـ ISO (مثل MAD, USD, EUR) برمجياً وفي الجداول الخلفية لتفادي مشاكل الترميز، بينما يُعرض الرمز الرسومي (DH, د.م., $, €) في الواجهات.',
      madVariantTitle: 'اختيار الرمز الرسومي لعرض الدرهم المغربي (MAD Symbol)',
      madVariantDesc:
        'يوضع رمز الدرهم المغربي دائماً بعد الرقم مع مسافة وفق المعايير الدولية (مثل: 1,500.00 DH أو 1,500.00 MAD أو 1,500.00 د.م.).',
      accountingTitle: '2. المعاملات المحاسبية والضريبية (Financial & Tax Settings)',
      fiscalYearLabel: 'السنة المالية (Financial / Fiscal Year)',
      vatLabel: 'نسبة الضريبة / القيمة المضافة (Tax / VAT %)',
      conversionToggleLabel: 'تطبيق تحويل الأسعار تلقائياً حسب سعر الصرف (Exchange Rate Conversion)',
      conversionToggleSub:
        'عند التعطيل، تُعرض الأرقام المسجلة بالعملة الأساسية (MAD) مباشرةً برمز العملة المختارة دون ضربها في معامل الصرف.',
      exchangeRatesTitle: 'أسعار الصرف المعتمدة (Exchange Rates مقابل 1 MAD)',
      previewTitle: '3. معاينة حية للتنسيق الدولي (Formatting) وإجمالي التكلفة (Grand Total TTC)',
      isoTableTitle: '4. جدول المعايير الدولية (ISO 4217)، الأيقونات المعتمدة، والمصطلحات المحاسبية',
      resetBtn: 'استعادة الإعداد الافتراضي (MAD / DH)',
      readOnlyNotice: 'وضع القراءة فقط — يتطلب تعديل إعدادات العملة صلاحية المسؤول (ADMIN).',
    },
    en: {
      title: 'Currency & GMAO Financial Standards (ISO 4217)',
      subtitle:
        'Configure the default plant currency (Moroccan Dirham — MAD / DH), international formatting rules, exchange rates, and accounting parameters.',
      baseBadge: 'Plant Base Currency: MAD (Morocco)',
      selectTitle: '1. Active Currency Selection (Multi-Currency Support)',
      selectDesc:
        'Accounting note: ISO 4217 codes (MAD, USD, EUR) are used in backend records and exports, while graphical symbols are rendered in the UI.',
      madVariantTitle: 'Moroccan Dirham (MAD) Graphical Display Symbol',
      madVariantDesc:
        'Placed after the amount with a space per international formatting standards (e.g., 1,500.00 DH, 1,500.00 MAD, or 1,500.00 د.م.).',
      accountingTitle: '2. GMAO Accounting & Fiscal Parameters',
      fiscalYearLabel: 'Financial Year / Fiscal Year',
      vatLabel: 'Default Tax / VAT Rate (%)',
      conversionToggleLabel: 'Automatically convert amounts using Exchange Rate',
      conversionToggleSub:
        'When disabled, base amounts are displayed as-is with the selected currency symbol.',
      exchangeRatesTitle: 'Exchange Rates (Relative to 1 MAD Base Currency)',
      previewTitle: '3. Live International Formatting Preview & Grand Total (Tax / VAT)',
      isoTableTitle: '4. Official ISO 4217 Reference, Standard Icons & GMAO Accounting Keywords',
      resetBtn: 'Reset to Morocco Default (MAD / DH)',
      readOnlyNotice: 'Read-only mode — Administrator privileges required to modify system currency.',
    },
  }[langKey];

  const handleSelectCurrency = (code: CurrencyCode) => {
    if (!canManageSettings) return;
    updateConfig({ activeCurrencyCode: code });
    const spec = ISO_4217_CURRENCIES[code];
    showToast?.(
      langKey === 'ar'
        ? `تم تعيين عملة التطبيق إلى ${spec.nameAr} (${code})`
        : `Devise active définie sur ${spec.nameFr} (${code})`,
      'success'
    );
  };

  const handleSelectMadVariant = (variant: MadSymbolVariant) => {
    if (!canManageSettings) return;
    updateConfig({ madSymbolVariant: variant });
    showToast?.(
      langKey === 'ar'
        ? `تم تحديث رمز عرض الدرهم المغربي إلى (${variant})`
        : `Symbole du Dirham Marocain défini sur (${variant})`,
      'success'
    );
  };

  const renderCurrencyIcon = (code: CurrencyCode, className = 'w-6 h-6') => {
    if (code === 'USD') return <DollarSign className={className} />;
    if (code === 'EUR') return <Euro className={className} />;
    return <Wallet className={className} />;
  };

  // Sample calculation for preview: 1,500.00 base maintenance cost
  const sampleBaseCost = 1500;
  const sampleVatAmount = (sampleBaseCost * (config.vatRatePercent || 0)) / 100;
  const sampleGrandTotal = sampleBaseCost + sampleVatAmount;

  return (
    <div className="space-y-6" data-testid="settings-currency-tab">
      {/* Top Header Banner */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-black text-slate-900">{copy.title}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-200">
                ISO 4217 : {currencyCode} ({currencySymbol})
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                {copy.baseBadge}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{copy.subtitle}</p>
          </div>
        </div>

        {canManageSettings ? (
          <button
            type="button"
            onClick={() => {
              resetToDefault();
              showToast?.(
                langKey === 'ar'
                  ? 'تمت استعادة العملة الافتراضية: الدرهم المغربي (MAD / DH)'
                  : 'Configuration devise réinitialisée sur MAD (DH)',
                'info'
              );
            }}
            className="h-10 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold inline-flex items-center gap-2 shrink-0 cursor-pointer transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{copy.resetBtn}</span>
          </button>
        ) : (
          <div className="px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{copy.readOnlyNotice}</span>
          </div>
        )}
      </div>

      {/* Section 1: ISO 4217 Currency Cards (MAD, USD, EUR) */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
        <div>
          <h3 className="text-sm font-black text-slate-900">{copy.selectTitle}</h3>
          <p className="text-xs text-slate-500 mt-0.5">{copy.selectDesc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['MAD', 'USD', 'EUR'] as CurrencyCode[]).map((code) => {
            const spec = ISO_4217_CURRENCIES[code];
            const isSelected = currencyCode === code;
            const previewFormatted = formatCurrency(1500, {
              decimals: 2,
              config: { ...config, activeCurrencyCode: code, applyExchangeRateConversion: false },
            });
            const previewIsoFormatted = formatCurrency(1500, {
              decimals: 2,
              useIsoCode: true,
              config: { ...config, activeCurrencyCode: code, applyExchangeRateConversion: false },
            });

            return (
              <button
                key={code}
                type="button"
                disabled={!canManageSettings}
                onClick={() => handleSelectCurrency(code)}
                data-testid={`currency-card-${code}`}
                className={`text-left p-5 rounded-2xl border-2 transition-all flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                } ${canManageSettings ? 'cursor-pointer' : 'opacity-80 cursor-not-allowed'}`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center border font-black ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {renderCurrencyIcon(code, 'w-5 h-5')}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {code === 'MAD' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                          {langKey === 'ar' ? 'الافتراضية (المغرب)' : 'Défaut (Maroc)'}
                        </span>
                      )}
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-slate-900 text-white">
                        {spec.code}
                      </span>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                    </div>
                  </div>

                  <div>
                    <div className="text-base font-black text-slate-900">
                      {spec.nameAr} — {spec.nameFr}
                    </div>
                    <div className="text-xs font-semibold text-slate-500">
                      {spec.nameEn} • ISO #{spec.numericIsoCode}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {langKey === 'ar' ? 'الرمز الرسومي' : 'Symbole UI'}
                      </div>
                      <div className="font-mono font-black text-slate-900 text-sm">
                        {code === 'MAD' ? `${config.madSymbolVariant} (د.م. / DH)` : spec.defaultSymbol}
                      </div>
                    </div>
                    <div className="p-2 rounded-xl bg-white border border-slate-200/80">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {langKey === 'ar' ? 'الأجزاء (الكسور)' : 'Sous-unité'}
                      </div>
                      <div className="font-bold text-slate-800 text-xs">{spec.subUnitAr}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">
                      {langKey === 'ar' ? 'تنسيق العرض (Intl):' : 'Formatage UI :'}
                    </span>
                    <span className="font-mono font-black text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {previewFormatted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{langKey === 'ar' ? 'صيغة ISO للمحاسبة:' : 'Format ISO Comptable :'}</span>
                    <span className="font-mono font-bold text-slate-700">{previewIsoFormatted}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono truncate" title={spec.iconMeta.material}>
                    Icons: {spec.iconMeta.material} • {spec.iconMeta.fontAwesome}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Moroccan Dirham Symbol Variant Selector */}
        {currencyCode === 'MAD' && (
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-black text-emerald-950 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-700" />
                <span>{copy.madVariantTitle}</span>
              </div>
              <p className="text-[11px] text-emerald-800">{copy.madVariantDesc}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(
                [
                  { id: 'DH', label: '1,500.00 DH (Standard Maroc)' },
                  { id: 'MAD', label: '1,500.00 MAD (ISO 4217)' },
                  { id: 'د.م.', label: '1,500.00 د.م. (عربي)' },
                ] as { id: MadSymbolVariant; label: string }[]
              ).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  disabled={!canManageSettings}
                  onClick={() => handleSelectMadVariant(v.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition ${
                    config.madSymbolVariant === v.id
                      ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-100/50'
                  } ${canManageSettings ? 'cursor-pointer' : 'opacity-70 cursor-not-allowed'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 2 & 3: Accounting / Tax / Fiscal Year & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 2: GMAO Financial & Exchange Rate Parameters */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <Calculator className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900">{copy.accountingTitle}</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{copy.fiscalYearLabel}</span>
              </label>
              <input
                type="number"
                min={2020}
                max={2099}
                disabled={!canManageSettings}
                value={config.fiscalYear}
                onChange={(e) => updateConfig({ fiscalYear: Number(e.target.value) || new Date().getFullYear() })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 bg-white focus:border-emerald-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-slate-500" />
                <span>{copy.vatLabel}</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                disabled={!canManageSettings}
                value={config.vatRatePercent}
                onChange={(e) => updateConfig({ vatRatePercent: Math.max(0, Number(e.target.value) || 0) })}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 bg-white focus:border-emerald-600 outline-none"
              />
            </div>
          </div>

          {/* Exchange Rates Table */}
          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
                <span>{copy.exchangeRatesTitle}</span>
              </span>
              <span className="text-[11px] font-mono text-slate-500">Base = 1.00 MAD</span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {(['MAD', 'USD', 'EUR'] as CurrencyCode[]).map((c) => (
                <div key={c} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] font-mono font-bold text-slate-500">1 MAD ➔ {c}</div>
                  <input
                    type="number"
                    step="0.001"
                    min="0.0001"
                    disabled={!canManageSettings || c === 'MAD'}
                    value={config.exchangeRates[c]}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val > 0) {
                        updateConfig({
                          exchangeRates: {
                            ...config.exchangeRates,
                            [c]: val,
                          },
                        });
                      }
                    }}
                    className="mt-1 w-full px-2 py-1 rounded-lg border border-slate-200 bg-white font-mono font-bold text-xs text-slate-900"
                  />
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canManageSettings}
                checked={config.applyExchangeRateConversion}
                onChange={(e) => updateConfig({ applyExchangeRateConversion: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div>
                <div className="text-xs font-bold text-slate-800">{copy.conversionToggleLabel}</div>
                <div className="text-[11px] text-slate-500">{copy.conversionToggleSub}</div>
              </div>
            </label>
          </div>
        </div>

        {/* Section 3: Live International Formatting & Grand Total Preview */}
        <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">{copy.previewTitle}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                FY {config.fiscalYear}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Simulation Bon de Travail / Commande PDR</span>
                <span className="font-mono text-emerald-400">ISO 4217: {currencyCode}</span>
              </div>

              <div className="space-y-2 border-t border-slate-800 pt-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Coût Hors Taxe (Total Cost HT) :</span>
                  <span className="font-mono font-bold text-white">
                    {formatCurrency(sampleBaseCost, { decimals: 2, config })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Taxe / TVA ({config.vatRatePercent}%) :</span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatCurrency(sampleVatAmount, { decimals: 2, config })}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-sm">
                  <span className="font-black text-emerald-400">Grand Total TTC :</span>
                  <span className="font-mono font-black text-emerald-400 text-base">
                    {formatCurrency(sampleGrandTotal, { decimals: 2, config })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-slate-900">
                {langKey === 'ar'
                  ? 'قاعدة وضع رمز العملة (Intl Formatting Standard):'
                  : 'Règle Internationale de Positionnement du Symbole (Intl) :'}
              </div>
              <p className="text-[11px]">
                {ISO_4217_CURRENCIES[currencyCode][langKey === 'ar' ? 'iconMeta' : 'iconMeta'][
                  langKey === 'ar' ? 'standardNoteAr' : 'standardNoteFr'
                ]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Official ISO 4217 Reference Table & GMAO Accounting Terminology */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-4">
        <h3 className="text-sm font-black text-slate-900">{copy.isoTableTitle}</h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase text-slate-600">
                <th className="py-2.5 px-3">Devise / العملة</th>
                <th className="py-2.5 px-3">Code ISO 4217</th>
                <th className="py-2.5 px-3">Symbole Graphique</th>
                <th className="py-2.5 px-3">Nom Anglais</th>
                <th className="py-2.5 px-3">الأجزاء (الكسور)</th>
                <th className="py-2.5 px-3">Formatage Standard</th>
                <th className="py-2.5 px-3">Icônes Standard (Material / FA)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className={currencyCode === 'MAD' ? 'bg-emerald-50/60 font-semibold' : ''}>
                <td className="py-2.5 px-3 font-bold text-slate-900">الدرهم المغربي (Défaut)</td>
                <td className="py-2.5 px-3 font-mono font-black text-emerald-800">MAD</td>
                <td className="py-2.5 px-3 font-mono font-bold">د.م. أو DH</td>
                <td className="py-2.5 px-3">Moroccan Dirham</td>
                <td className="py-2.5 px-3">السنتيم (Centime)</td>
                <td className="py-2.5 px-3 font-mono text-slate-800">1,500.00 MAD / 1,500.00 DH</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                  payments / account_balance_wallet • fa-coins
                </td>
              </tr>
              <tr className={currencyCode === 'USD' ? 'bg-emerald-50/60 font-semibold' : ''}>
                <td className="py-2.5 px-3 font-bold text-slate-900">الدولار الأمريكي</td>
                <td className="py-2.5 px-3 font-mono font-black text-indigo-800">USD</td>
                <td className="py-2.5 px-3 font-mono font-bold">$</td>
                <td className="py-2.5 px-3">US Dollar</td>
                <td className="py-2.5 px-3">السنت (Cent)</td>
                <td className="py-2.5 px-3 font-mono text-slate-800">$150.00</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                  attach_money / monetization_on • fa-dollar-sign
                </td>
              </tr>
              <tr className={currencyCode === 'EUR' ? 'bg-emerald-50/60 font-semibold' : ''}>
                <td className="py-2.5 px-3 font-bold text-slate-900">اليورو الأوروبي</td>
                <td className="py-2.5 px-3 font-mono font-black text-blue-800">EUR</td>
                <td className="py-2.5 px-3 font-mono font-bold">€</td>
                <td className="py-2.5 px-3">Euro</td>
                <td className="py-2.5 px-3">السنت (Cent)</td>
                <td className="py-2.5 px-3 font-mono text-slate-800">€100.00</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                  euro / euro_symbol • fa-euro-sign
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
