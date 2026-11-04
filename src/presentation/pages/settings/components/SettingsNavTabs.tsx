import {
  HardDrive,
  Cpu,
  FileUp,
  FolderSync,
  ShieldAlert,
  FileCode,
  Shield,
  UserCheck,
  Activity,
  Palette,
} from 'lucide-react';
import { useTranslation } from '../../../../i18n/I18nContext';

const TAB_TRANSLATIONS: Record<
  string,
  { fr: { label: string; sub: string }; ar: { label: string; sub: string }; en: { label: string; sub: string } }
> = {
  overview: {
    fr: { label: 'Supervision & Stockage', sub: 'Statistiques & Excel' },
    ar: { label: 'الإشراف والتخزين', sub: 'الإحصائيات وملف Excel' },
    en: { label: 'Supervision & Storage', sub: 'Statistics & Excel' },
  },
  'mvt-logic': {
    fr: { label: 'Logique & Flux Mouvements', sub: '3 Catégories & 5 Flux' },
    ar: { label: 'منطق وتدفقات الحركات', sub: '3 فئات و 5 مسارات' },
    en: { label: 'Movement Logic & Flows', sub: '3 Categories & 5 Flows' },
  },
  injection: {
    fr: { label: 'Injection Données Excel', sub: 'Import Sécurisé' },
    ar: { label: 'حقن واستيراد البيانات', sub: 'استيراد آمن ومعاينة' },
    en: { label: 'Excel Data Injection', sub: 'Secure Import' },
  },
  directory: {
    fr: { label: 'Dossier Partagé & Sync', sub: 'Twin Dossier Réseau' },
    ar: { label: 'المجلد المشترك والمزامنة', sub: 'التوأم الرقمي للشبكة' },
    en: { label: 'Shared Folder & Sync', sub: 'Network Folder Twin' },
  },
  matching: {
    fr: { label: 'Appairage', sub: 'Audit & Synchro' },
    ar: { label: 'المطابقة والربط', sub: 'التدقيق والمزامنة' },
    en: { label: 'Entity Matching', sub: 'Audit & Sync' },
  },
  'json-editor': {
    fr: { label: 'Base JSON', sub: 'Éditeur de Base' },
    ar: { label: 'قاعدة JSON', sub: 'محرر قاعدة البيانات' },
    en: { label: 'JSON Database', sub: 'Raw Store Editor' },
  },
  'backup-audit': {
    fr: { label: "Logs d'Accès & Audit", sub: 'Historique, IP & Restauration' },
    ar: { label: 'سجلات الدخول والتدقيق', sub: 'السجل، الاستعادة والفحص' },
    en: { label: 'Access Logs & Audit', sub: 'History, IP & Restore' },
  },
  admin: {
    fr: { label: 'Compte Admin', sub: 'Profil & Sécurité' },
    ar: { label: 'حساب المسؤول', sub: 'الملف الشخصي والأمان' },
    en: { label: 'Admin Account', sub: 'Profile & Security' },
  },
  performance: {
    fr: { label: 'Performance & Cache', sub: 'Dashboard, Caching & Alertes' },
    ar: { label: 'الأداء وذاكرة التخزين', sub: 'السرعة، الفهرسة والتنبيهات' },
    en: { label: 'Performance & Cache', sub: 'Dashboard, Caching & Alerts' },
  },
  appearance: {
    fr: { label: 'Apparence', sub: 'Thème, disposition & interface' },
    ar: { label: 'المظهر والواجهة', sub: 'السمة، التخطيط والواجهة' },
    en: { label: 'Appearance', sub: 'Theme, Layout & UI' },
  },
};

/**
 * Navigation tabs for SettingsView.
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
  const langKey = (language === 'ar' || language === 'en' ? language : 'fr') as 'fr' | 'ar' | 'en';

  const getTabCopy = (id: string) => {
    const entry = TAB_TRANSLATIONS[id]?.[langKey] || TAB_TRANSLATIONS[id]?.fr || { label: id, sub: '' };
    if (id === 'matching') {
      return {
        label: `${entry.label} (${discoveredItemsCount})`,
        sub: entry.sub,
      };
    }
    return entry;
  };

  const tabs = [
    {
      id: 'overview',
      ...getTabCopy('overview'),
      icon: HardDrive,
      color: 'text-cyan-600',
      activeBg: 'bg-cyan-50/70',
      activeBorder: 'border-cyan-500',
      activeText: 'text-cyan-950',
      activeIconBg: 'bg-cyan-100/80',
    },
    {
      id: 'mvt-logic',
      ...getTabCopy('mvt-logic'),
      icon: Cpu,
      color: 'text-blue-600',
      activeBg: 'bg-blue-50/70',
      activeBorder: 'border-blue-500',
      activeText: 'text-blue-950',
      activeIconBg: 'bg-blue-100/80',
    },
    {
      id: 'injection',
      ...getTabCopy('injection'),
      icon: FileUp,
      color: 'text-emerald-600',
      activeBg: 'bg-emerald-50/70',
      activeBorder: 'border-emerald-500',
      activeText: 'text-emerald-950',
      activeIconBg: 'bg-emerald-100/80',
    },
    {
      id: 'directory',
      ...getTabCopy('directory'),
      icon: FolderSync,
      color: 'text-indigo-600',
      activeBg: 'bg-indigo-50/70',
      activeBorder: 'border-indigo-500',
      activeText: 'text-indigo-950',
      activeIconBg: 'bg-indigo-100/80',
    },
    {
      id: 'matching',
      ...getTabCopy('matching'),
      icon: ShieldAlert,
      color: 'text-amber-500',
      activeBg: 'bg-amber-50/70',
      activeBorder: 'border-amber-500',
      activeText: 'text-amber-950',
      activeIconBg: 'bg-amber-100/80',
    },
    {
      id: 'json-editor',
      ...getTabCopy('json-editor'),
      icon: FileCode,
      color: 'text-rose-500',
      activeBg: 'bg-rose-50/70',
      activeBorder: 'border-rose-500',
      activeText: 'text-rose-950',
      activeIconBg: 'bg-rose-100/80',
    },
    {
      id: 'backup-audit',
      ...getTabCopy('backup-audit'),
      icon: Shield,
      color: 'text-fuchsia-600',
      activeBg: 'bg-fuchsia-50/70',
      activeBorder: 'border-fuchsia-500',
      activeText: 'text-fuchsia-950',
      activeIconBg: 'bg-fuchsia-100/80',
    },
    {
      id: 'admin',
      ...getTabCopy('admin'),
      icon: UserCheck,
      color: 'text-violet-600',
      activeBg: 'bg-violet-50/70',
      activeBorder: 'border-violet-500',
      activeText: 'text-violet-950',
      activeIconBg: 'bg-violet-100/80',
    },
    {
      id: 'performance',
      ...getTabCopy('performance'),
      icon: Activity,
      color: 'text-teal-600',
      activeBg: 'bg-teal-50/70',
      activeBorder: 'border-teal-500',
      activeText: 'text-teal-950',
      activeIconBg: 'bg-teal-100/80',
    },
    {
      id: 'appearance',
      ...getTabCopy('appearance'),
      icon: Palette,
      color: 'text-purple-600',
      activeBg: 'bg-purple-50/70',
      activeBorder: 'border-purple-500',
      activeText: 'text-purple-950',
      activeIconBg: 'bg-purple-100/80',
    },
  ];

  const visibleTabs = Array.isArray(allowedTabIds)
    ? tabs.filter((t) => allowedTabIds.includes(t.id))
    : tabs;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {visibleTabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left cursor-pointer w-full ${
                isActive
                  ? `${tab.activeBg} ${tab.activeBorder} ${tab.activeText} shadow-xs font-bold scale-[1.01]`
                  : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200/80 text-slate-600'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 border transition-all ${
                  isActive ? `${tab.activeBorder} ${tab.activeIconBg}` : 'bg-white border-slate-200/80'
                }`}
              >
                <IconComponent className={`w-4 h-4 ${tab.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className={`text-xs font-bold leading-tight truncate ${
                    isActive ? 'text-slate-900' : 'text-slate-700'
                  }`}
                >
                  {tab.label}
                </div>
                <div
                  className={`text-[10px] mt-0.5 font-mono truncate ${
                    isActive ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {tab.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
