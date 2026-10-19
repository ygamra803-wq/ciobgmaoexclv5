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

/**
 * Navigation tabs for SettingsView.
 */
export default function SettingsNavTabs({ activeTab, setActiveTab, discoveredItemsCount = 0 }) {
  const tabs = [
    {
      id: 'overview',
      label: 'Supervision & Stockage',
      sub: 'Statistiques & Excel',
      icon: HardDrive,
      color: 'text-cyan-600',
      activeBg: 'bg-cyan-50/70',
      activeBorder: 'border-cyan-500',
      activeText: 'text-cyan-950',
      activeIconBg: 'bg-cyan-100/80',
    },
    {
      id: 'mvt-logic',
      label: 'Logique & Flux Mouvements',
      sub: '3 Catégories & 5 Flux',
      icon: Cpu,
      color: 'text-blue-600',
      activeBg: 'bg-blue-50/70',
      activeBorder: 'border-blue-500',
      activeText: 'text-blue-950',
      activeIconBg: 'bg-blue-100/80',
    },
    {
      id: 'injection',
      label: 'Injection Données Excel',
      sub: 'Import Sécurisé',
      icon: FileUp,
      color: 'text-emerald-600',
      activeBg: 'bg-emerald-50/70',
      activeBorder: 'border-emerald-500',
      activeText: 'text-emerald-950',
      activeIconBg: 'bg-emerald-100/80',
    },
    {
      id: 'directory',
      label: 'Dossier Partagé & Sync',
      sub: 'Twin Dossier Réseau',
      icon: FolderSync,
      color: 'text-indigo-600',
      activeBg: 'bg-indigo-50/70',
      activeBorder: 'border-indigo-500',
      activeText: 'text-indigo-950',
      activeIconBg: 'bg-indigo-100/80',
    },
    {
      id: 'matching',
      label: `Appairage (${discoveredItemsCount})`,
      sub: 'Audit & Synchro',
      icon: ShieldAlert,
      color: 'text-amber-500',
      activeBg: 'bg-amber-50/70',
      activeBorder: 'border-amber-500',
      activeText: 'text-amber-950',
      activeIconBg: 'bg-amber-100/80',
    },
    {
      id: 'json-editor',
      label: 'Base JSON',
      sub: 'Éditeur de Base',
      icon: FileCode,
      color: 'text-rose-500',
      activeBg: 'bg-rose-50/70',
      activeBorder: 'border-rose-500',
      activeText: 'text-rose-950',
      activeIconBg: 'bg-rose-100/80',
    },
    {
      id: 'backup-audit',
      label: "Logs d'Accès & Audit",
      sub: 'Historique, IP & Restauration',
      icon: Shield,
      color: 'text-fuchsia-600',
      activeBg: 'bg-fuchsia-50/70',
      activeBorder: 'border-fuchsia-500',
      activeText: 'text-fuchsia-950',
      activeIconBg: 'bg-fuchsia-100/80',
    },
    {
      id: 'admin',
      label: 'Compte Admin',
      sub: 'Profil & Sécurité',
      icon: UserCheck,
      color: 'text-violet-600',
      activeBg: 'bg-violet-50/70',
      activeBorder: 'border-violet-500',
      activeText: 'text-violet-950',
      activeIconBg: 'bg-violet-100/80',
    },
    {
      id: 'performance',
      label: 'Performance & Cache',
      sub: 'Dashboard, Caching & Alertes',
      icon: Activity,
      color: 'text-teal-600',
      activeBg: 'bg-teal-50/70',
      activeBorder: 'border-teal-500',
      activeText: 'text-teal-950',
      activeIconBg: 'bg-teal-100/80',
    },
    {
      id: 'appearance',
      label: 'Apparence',
      sub: 'Thème, disposition & interface',
      icon: Palette,
      color: 'text-purple-600',
      activeBg: 'bg-purple-50/70',
      activeBorder: 'border-purple-500',
      activeText: 'text-purple-950',
      activeIconBg: 'bg-purple-100/80',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {tabs.map((tab) => {
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
