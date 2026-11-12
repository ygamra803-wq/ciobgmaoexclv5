import { useState, useEffect } from 'react';
import {
  Coins,
  CheckCircle2,
  RefreshCw,
  Calendar,
  Percent,
  ArrowRightLeft,
  Info,
  Save,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import {
  useCurrency,
  ISO_4217_CURRENCIES,
  type CurrencyCode,
  type MadSymbolVariant,
} from '../../../../utils/currencyService';
import { useTranslation } from '../../../../i18n/I18nContext';
import { useAuth } from '../../../../context/AuthContext';
import { AuthorizationService } from '../../../../core/security/AuthorizationService';
import { SettingsSectionCard, SETTINGS_BUTTON_STYLES } from './settingsUi';

const CURRENCY_ORDER: CurrencyCode[] = ['MAD', 'USD', 'EUR'];
const MAD_VARIANTS: Array<{
  id: MadSymbolVariant;
  labelFr: string;
  labelAr: string;
  example: string;
}> = [
  { id: 'DH', labelFr: 'Abréviation Locale (DH)', labelAr: 'الاختصار المحلي (DH)', example: '1,500 DH' },
  { id: 'MAD', labelFr: 'Code ISO 4217 (MAD)', labelAr: 'رمز الأيزو (MAD)', example: '1,500 MAD' },
  { id: 'د.م.', labelFr: 'Symbole Arabe (د.م.)', labelAr: 'الرمز العربي (د.م.)', example: '1,500 د.م.' },
];

export default function SettingsCurrencyTab({
  showToast,
}: {
  showToast?: (msg: string, type?: string) => void;
}) {
  const {
    config,
    currencyCode,
    currencySymbol,
    spec,
    formatCurrency,
    updateConfig,
    setCurrency,
    resetToDefault,
  } = useCurrency();
  const { language } = useTranslation();
  const { currentUser } = useAuth();
  const canManageSettings = AuthorizationService.hasPermission(currentUser, 'settings:manage');

  const [vatInput, setVatInput] = useState<string>(String(config.vatRatePercent));
  const [fiscalYearInput, setFiscalYearInput] = useState<string>(String(config.fiscalYear));
  const [usdRateInput, setUsdRateInput] = useState<string>(String(config.exchangeRates.USD));
  const [eurRateInput, setEurRateInput] = useState<string>(String(config.exchangeRates.EUR));

  useEffect(() => {
    setVatInput(String(config.vatRatePercent));
    setFiscalYearInput(String(config.fiscalYear));
    setUsdRateInput(String(config.exchangeRates.USD));
    setEurRateInput(String(config.exchangeRates.EUR));
  }, [config]);

  const handleSelectCurrency = (code: CurrencyCode) => {
    if (!canManageSettings) {
      showToast?.('Mode lecture seule : Rôle Administrateur requis.', 'error');
      return;
    }
    setCurrency(code);
    const meta = ISO_4217_CURRENCIES[code];
    showToast?.(
      language === 'ar'
        ? `تم تفعيل العملة: ${meta.nameAr} (${code})`
        : `Devise active définie sur : ${meta.nameFr} (${code})`,
      'success'
    );
  };

  const handleSelectMadVariant = (variant: MadSymbolVariant) => {
    if (!canManageSettings) {
      showToast?.('Mode lecture seule : Rôle Administrateur requis.', 'error');
      return;
    }
    updateConfig({ madSymbolVariant: variant });
    showToast?.(
      language === 'ar'
        ? `تم تحديث رمز الدرهم إلى: ${variant}`
        : `Symbole du Dirham mis à jour : ${variant}`,
      'success'
    );
  };

  const handleSaveRatesAndFiscal = () => {
    if (!canManageSettings) {
      showToast?.('Mode lecture seule : Rôle Administrateur requis.', 'error');
      return;
    }
    const vat = Math.max(0, Math.min(100, Number(vatInput) || 0));
    const fy = Math.max(2020, Math.min(2099, Math.round(Number(fiscalYearInput) || 2026)));
    const usd = Number(usdRateInput) > 0 ? Number(usdRateInput) : 0.1;
    const eur = Number(eurRateInput) > 0 ? Number(eurRateInput) : 0.092;

    updateConfig({
      vatRatePercent: vat,
      fiscalYear: fy,
      exchangeRates: {
        MAD: 1,
        USD: usd,
        EUR: eur,
      },
    });
    showToast?.(
      language === 'ar'
        ? 'تم حفظ إعدادات الضرائب وأسعار الصرف بنجاح'
        : 'Paramètres fiscaux et taux de change enregistrés avec succès',
      'success'
    );
  };

  const handleReset = () => {
    if (!canManageSettings) return;
    resetToDefault();
    showToast?.(
      language === 'ar'
        ? 'تمت استعادة الإعدادات الافتراضية للعملة (MAD / DH)'
        : 'Configuration monétaire réinitialisée aux valeurs par défaut (MAD / DH)',
      'info'
    );
  };

  const sampleUnitPrice = 1500;
  const sampleVatAmount = (sampleUnitPrice * (Number(config.vatRatePercent) || 0)) / 100;
  const sampleTtcAmount = sampleUnitPrice + sampleVatAmount;
  const sampleGlobalStock = 284500;

  return (
    <div className="space-y-6" data-testid="settings-currency-tab">
      {!canManageSettings && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Mode lecture seule : privilèges Administrateur requis pour modifier la devise ou la fiscalité.
          </span>
        </div>
      )}

      {/* 1. Primary ISO 4217 Currency Selector */}
      <SettingsSectionCard
        title="1. Choix de la Devise de Référence (Standard ISO 4217)"
        description="Sélectionnez l'unité monétaire officielle utilisée dans les tableaux de bord, la valorisation du stock PDR, les achats et l'analyse TCO."
        icon={<Coins className="w-4 h-4" />}
        headerRight={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/80 text-xs font-bold text-indigo-950">
              <span className="text-slate-500">Devise Active :</span>
              <span className="font-mono text-indigo-700">
                {currencyCode} ({currencySymbol})
              </span>
            </span>
            <button
              type="button"
              onClick={handleReset}
              disabled={!canManageSettings}
              className={SETTINGS_BUTTON_STYLES.secondary}
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Par défaut</span>
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {CURRENCY_ORDER.map((code) => {
              const item = ISO_4217_CURRENCIES[code];
              const isSelected = currencyCode === code;
              const displaySym = code === 'MAD' ? config.madSymbolVariant : item.defaultSymbol;

              return (
                <button
                  key={code}
                  type="button"
                  data-testid={`currency-card-${code}`}
                  onClick={() => handleSelectCurrency(code)}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/80 shadow-2xs ring-1 ring-indigo-600/15'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {item.code}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">
                        ISO #{item.numericIsoCode}
                      </span>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </div>
                    <div className="font-bold text-xs text-slate-900 pt-0.5 truncate">
                      {language === 'ar'
                        ? item.nameAr
                        : language === 'en'
                          ? item.nameEn
                          : item.nameFr}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Sous-unité :{' '}
                      <span className="font-medium text-slate-700">
                        {language === 'ar' ? item.subUnitAr : item.subUnitFr}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-extrabold shrink-0 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {displaySym}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Moroccan Dirham Symbol Variant Selector */}
          {currencyCode === 'MAD' && (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Variante d&apos;Affichage du Dirham Marocain (MAD)
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Choisissez comment représenter le Dirham dans les tableaux, KPIs et bons de commande.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200 self-start sm:self-auto">
                  ISO 4217: MAD (504)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {MAD_VARIANTS.map((v) => {
                  const active = config.madSymbolVariant === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      data-testid={`mad-symbol-${v.id}`}
                      onClick={() => handleSelectMadVariant(v.id)}
                      className={`px-3.5 py-2.5 rounded-xl border text-left transition cursor-pointer flex items-center justify-between ${
                        active
                          ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <span className="text-xs">
                        {language === 'ar' ? v.labelAr : v.labelFr}
                      </span>
                      <span
                        className={`font-mono text-xs px-2 py-0.5 rounded ${
                          active ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {v.example}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </SettingsSectionCard>

      {/* 2. Exchange Rates, Tax & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SettingsSectionCard
          title="2. Fiscalité, TVA & Taux de Change"
          description="Paramètres appliqués aux bons de commande (PO), rapports budgétaires et conversions multi-devises."
          icon={<ArrowRightLeft className="w-4 h-4" />}
          footer={
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-slate-500">
                Base comptable usine : <b className="font-mono text-slate-800">MAD</b>
              </span>
              <button
                type="button"
                onClick={handleSaveRatesAndFiscal}
                disabled={!canManageSettings}
                className={SETTINGS_BUTTON_STYLES.primary}
              >
                <Save className="w-4 h-4" />
                <span>Enregistrer Taux &amp; Fiscalité</span>
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Année Fiscale de Référence
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min={2020}
                    max={2099}
                    value={fiscalYearInput}
                    onChange={(e) => setFiscalYearInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Taux de TVA Standard (%)
                </label>
                <div className="relative">
                  <Percent className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={vatInput}
                    onChange={(e) => setVatInput(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Taux 1 MAD ➔ USD ($)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.0001"
                  value={usdRateInput}
                  onChange={(e) => setUsdRateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Taux 1 MAD ➔ EUR (€)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.0001"
                  value={eurRateInput}
                  onChange={(e) => setEurRateInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 outline-none"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Conversion mathématique automatique à l&apos;affichage
                </span>
                <span className="text-[11px] text-slate-500">
                  Si activé, multiplie les prix de base (MAD) par le taux de change lorsque USD ou EUR est sélectionné.
                </span>
              </div>
              <input
                type="checkbox"
                checked={config.applyExchangeRateConversion}
                onChange={(e) => {
                  if (!canManageSettings) return;
                  updateConfig({ applyExchangeRateConversion: e.target.checked });
                }}
                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
            </div>
          </div>
        </SettingsSectionCard>

        {/* Live Formatting Simulation (Light Industrial Invoice Card) */}
        <SettingsSectionCard
          testId="currency-preview-box"
          title="3. Simulation d'Affichage Comptable & Bons de Commande"
          description="Aperçu en temps réel du formatage monétaire dans les grilles Stock PDR, Achats et Finance."
          icon={<Info className="w-4 h-4" />}
        >
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/80">
                <span className="font-bold text-slate-700">
                  Simulation Bon de Commande ({config.fiscalYear})
                </span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 text-indigo-700 font-bold">
                  ISO: {spec.code} ({spec.numericIsoCode})
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-600">Montant Hors Taxes (HT)</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatCurrency(sampleUnitPrice, { decimals: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-600">TVA ({config.vatRatePercent}%)</span>
                <span className="font-mono font-semibold text-slate-700">
                  {formatCurrency(sampleVatAmount, { decimals: 2 })}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80">
                <span className="font-bold text-slate-800">Total TTC Facturé</span>
                <span className="font-mono font-extrabold text-indigo-700 text-sm">
                  {formatCurrency(sampleTtcAmount, { decimals: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/60 rounded-xl p-3.5 border border-emerald-200/80 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950">
                Valorisation Globale Stock PDR (Exemple)
              </span>
              <span className="font-mono font-extrabold text-emerald-700 text-sm">
                {formatCurrency(sampleGlobalStock)}
              </span>
            </div>

            <div className="text-[11px] text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/70">
              {language === 'ar' ? spec.iconMeta.standardNoteAr : spec.iconMeta.standardNoteFr}
            </div>
          </div>
        </SettingsSectionCard>
      </div>
    </div>
  );
}
