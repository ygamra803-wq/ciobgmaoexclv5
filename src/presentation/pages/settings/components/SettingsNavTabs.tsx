import React from 'react';
import {
  Activity,
  RotateCcw,
  Sparkles,
  FolderSync,
  ShieldAlert,
  FileSpreadsheet,
  Shield,
  Lock,
  Gauge,
  Palette,
  Coins,
  Wrench,
  Sliders,
} from 'lucide-react';
import { useTranslation } from '../../../../i18n/I18nContext';

interface SettingsTabItem {
  id: string;
  category: 'factory' | 'advanced';
  icon: React.ComponentType<{ className?: string }>;
  title: { fr: string; ar: string; en: string };
  sub: { fr: string; ar: string; en: string };
}

const SETTINGS_TABS_LIST: SettingsTabItem[] = [
  {
    id: 'overview',
    category: 'factory',
    icon: Activity,
    title: {
      fr: "Vue d'ensemble",
      ar: 'نظرة عامة',
      en: 'System Overview',
    },
    sub: {
      fr: 'Capacité & état SSOT',
      ar: 'السعة وحالة التخزين',
      en: 'Storage & SSOT state',
    },
  },
  {
    id: 'appearance',
    category: 'factory',
    icon: Palette,
    title: {
      fr: 'Apparence & Layout',
      ar: 'المظهر والتخطيط',
      en: 'Appearance & Layout',
    },
    sub: {
      fr: 'PC, Mobile & Densité',
      ar: 'العرض والكثافة',
      en: 'Device mode & density',
    },
  },
  {
    id: 'currency',
    category: 'factory',
    icon: Coins,
    title: {
      fr: 'Devise & Fiscalité',
      ar: 'العملة والضرائب',
      en: 'Currency & Tax',
    },
    sub: {
      fr: 'MAD / EUR / USD & TVA',
      ar: 'العملة والضريبة',
      en: 'ISO 4217 & VAT',
    },
  },
  {
    id: 'directory',
    category: 'factory',
    icon: FolderSync,
    title: {
      fr: 'Réseau LAN & Excel',
      ar: 'الشبكة وملف Excel',
      en: 'LAN & Excel Sync',
    },
    sub: {
      fr: 'Poste Hôte/Client & QR',
      ar: 'مزامنة الشبكة والمرآة',
      en: 'Host/Client & Mirror',
    },
  },
  {
    id: 'backup-audit',
    category: 'factory',
    icon: Shield,
    title: {
      fr: 'Sauvegarde & Audit',
      ar: 'النسخ والتدقيق',
      en: 'Backups & Audit',
    },
    sub: {
      fr: 'Restauration & Intégrité',
      ar: 'الاستعادة وسلامة البيانات',
      en: 'Restore & Integrity',
    },
  },
  {
    id: 'admin',
    category: 'factory',
    icon: Lock,
    title: {
      fr: 'Sécurité & Comptes',
      ar: 'الأمان والحسابات',
      en: 'Security & Accounts',
    },
    sub: {
      fr: 'Master PIN & Accès',
      ar: 'رمز PIN والصلاحيات',
      en: 'Master PIN & Roles',
    },
  },
  {
    id: 'mvt-logic',
    category: 'factory',
    icon: RotateCcw,
    title: {
      fr: 'Logique Mouvements',
      ar: 'منطق الحركات',
      en: 'Movement Rules',
    },
    sub: {
      fr: '5 flux magasin usine',
      ar: 'قواعد تدفقات المخزن',
      en: '5 warehouse flows',
    },
  },
  {
    id: 'matching',
    category: 'advanced',
    icon: ShieldAlert,
    title: {
      fr: 'Appairage Données',
      ar: 'مطابقة البيانات',
      en: 'Data Matching',
    },
    sub: {
      fr: 'Réconciliation orphelins',
      ar: 'ربط السجلات غير المطابقة',
      en: 'Orphan reconciliation',
    },
  },
  {
    id: 'injection',
    category: 'advanced',
    icon: Sparkles,
    title: {
      fr: 'Données Démo & Reset',
      ar: 'بيانات التجربة والتصفير',
      en: 'Demo Data & Reset',
    },
    sub: {
      fr: 'Jeux de test & Remise à 0',
      ar: 'حقن تجريبي أو ضبط مصنع',
      en: 'Test seeds & Factory wipe',
    },
  },
  {
    id: 'json-editor',
    category: 'advanced',
    icon: FileSpreadsheet,
    title: {
      fr: 'Inspecteur JSON',
      ar: 'محرر JSON الخام',
      en: 'Raw JSON Inspector',
    },
    sub: {
      fr: 'Maintenance directe SSOT',
      ar: 'فحص وتعديل مباشر',
      en: 'Direct SSOT inspection',
    },
  },
  {
    id: 'performance',
    category: 'advanced',
    icon: Gauge,
    title: {
      fr: 'Performance & Cache',
      ar: 'الأداء وذاكرة الكاش',
      en: 'Performance & Cache',
    },
    sub: {
      fr: 'FPS & Cache L1/L2/L3',
      ar: 'سرعة الحساب والكاش',
      en: 'FPS & L1/L2/L3 Cache',
    },
  },
];

/**
 * Top navigation tab bar for SettingsView.
 * Uses a unified industrial light design: single active color, uniform height, and sans-serif subtitles.
 */
export default function SettingsNavTabs({
  activeTab,
  setActiveTab,
  discoveredItemsCount = 0,
  allowedTabIds,
}: {
  activeTab: string;
  setActiveTab: (id: string) => void;
  discoveredItemsCount?: number;
  allowedTabIds?: string[];
}) {
  const { language } = useTranslation();
  const langKey = language === 'ar' ? 'ar' : language === 'en' ? 'en' : 'fr';

  const visibleTabs = Array.isArray(allowedTabIds)
    ? SETTINGS_TABS_LIST.filter((t) => allowedTabIds.includes(t.id))
    : [];

  const factoryTabs = visibleTabs.filter((t) => t.category === 'factory');
  const advancedTabs = visibleTabs.filter((t) => t.category === 'advanced');

  const renderTabButton = (tab: SettingsTabItem) => {
    const isActive = activeTab === tab.id;
    const Icon = tab.icon;

    return (
      <button
        key={tab.id}
        type="button"
        onClick={() => setActiveTab(tab.id)}
        className={`group relative flex items-center gap-2.5 px-3 py-2.5 min-h-[48px] rounded-xl border text-left transition-all cursor-pointer select-none ${
          isActive
            ? 'bg-indigo-50/90 border-indigo-600 text-slate-900 shadow-2xs ring-1 ring-indigo-600/15'
            : 'bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
            isActive
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200/80 group-hover:text-slate-800'
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`text-xs font-bold truncate ${
                isActive ? 'text-indigo-950' : 'text-slate-800'
              }`}
            >
              {tab.title[langKey]}
            </span>
            {tab.id === 'matching' && discoveredItemsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                {discoveredItemsCount}
              </span>
            )}
          </div>
          <div
            className={`text-[11px] truncate mt-0.5 ${
              isActive ? 'text-indigo-700/90 font-medium' : 'text-slate-500'
            }`}
          >
            {tab.sub[langKey]}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3" data-testid="settings-nav-tabs">
      {factoryTabs.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            <span>
              {language === 'ar'
                ? 'إعدادات تشغيل المصنع اليومية'
                : language === 'en'
                  ? 'Daily Factory Operations'
                  : 'Exploitation Usine & Quotidien'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {factoryTabs.map(renderTabButton)}
          </div>
        </div>
      )}

      {advancedTabs.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <Wrench className="w-3.5 h-3.5 text-slate-500" />
            <span>
              {language === 'ar'
                ? 'أدوات الصيانة المتقدمة والنظام'
                : language === 'en'
                  ? 'Advanced System & Maintenance Tools'
                  : 'Maintenance Avancée & Diagnostic Système'}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {advancedTabs.map(renderTabButton)}
          </div>
        </div>
      )}
    </div>
  );
}
