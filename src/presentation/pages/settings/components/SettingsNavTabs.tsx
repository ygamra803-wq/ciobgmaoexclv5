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
 * Mature Light UI Excel navigation tabs for SettingsView.
 * Pure unboxed icons, hairline slate borders, quiet inactive sheet tabs,
 * and crisp elevated white active sheets with restrained industrial steel-blue accent.
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
        className={`group relative flex items-center gap-3 px-3.5 py-2.5 min-h-[54px] rounded-xl border text-left transition-all duration-150 cursor-pointer select-none ${
          isActive
            ? 'bg-white border-sky-700/70 ring-1 ring-sky-700/15 text-slate-950 shadow-[0_2px_8px_-2px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)]'
            : 'bg-slate-50/75 hover:bg-white border-slate-200/90 hover:border-slate-300 text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.02)] hover:shadow-[0_2px_6px_-1px_rgba(15,23,42,0.06)]'
        } active:scale-[0.99]`}
      >
        <Icon
          className={`w-[18px] h-[18px] shrink-0 transition-colors duration-150 ${
            isActive ? 'text-sky-700' : 'text-slate-400 group-hover:text-slate-700'
          }`}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1.5">
            <span
              className={`text-xs font-bold truncate transition-colors ${
                isActive ? 'text-slate-950' : 'text-slate-700 group-hover:text-slate-950'
              }`}
            >
              {tab.title[langKey]}
            </span>
            {tab.id === 'matching' && discoveredItemsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-800 text-white shrink-0">
                {discoveredItemsCount}
              </span>
            )}
          </div>
          <div
            className={`text-[11px] truncate mt-0.5 transition-colors ${
              isActive ? 'text-sky-800 font-medium' : 'text-slate-500'
            }`}
          >
            {tab.sub[langKey]}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-3.5" data-testid="settings-nav-tabs">
      {factoryTabs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Sliders className="w-3.5 h-3.5 text-sky-700 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {language === 'ar'
                ? 'إعدادات تشغيل المصنع اليومية'
                : language === 'en'
                  ? 'Daily Factory Operations'
                  : 'Exploitation Usine & Quotidien'}
            </span>
            <div className="h-px flex-1 bg-slate-200/80" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
            {factoryTabs.map(renderTabButton)}
          </div>
        </div>
      )}

      {advancedTabs.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <Wrench className="w-3.5 h-3.5 text-sky-700 shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              {language === 'ar'
                ? 'أدوات الصيانة المتقدمة والنظام'
                : language === 'en'
                  ? 'Advanced System & Maintenance Tools'
                  : 'Maintenance Avancée & Diagnostic Système'}
            </span>
            <div className="h-px flex-1 bg-slate-200/80" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {advancedTabs.map(renderTabButton)}
          </div>
        </div>
      )}
    </div>
  );
}
