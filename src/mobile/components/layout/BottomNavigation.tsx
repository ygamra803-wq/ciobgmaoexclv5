import { 
  LayoutDashboard, 
  Package, 
  Wrench, 
  Calendar, 
  Layers, 
  Menu 
} from 'lucide-react';

export function BottomNavigation({
  activeTab = 'dashboard',
  isMobile = false,
  onTabChange = () => {},
  onOpenMenu = () => {},
  counts = {},
}) {
  if (!isMobile) return null;

  const tabs = [
    { id: 'dashboard', label: 'Tableau', icon: LayoutDashboard },
    { id: 'stock', label: 'Stock', icon: Package, badge: counts?.ruptureCount || 0 },
    { id: 'corrective', label: 'Correctif', icon: Wrench, badge: counts?.openBtCount || 0 },
    { id: 'preventive', label: 'Préventif', icon: Calendar, badge: counts?.pendingTasksCount || 0 },
    { id: 'machines', label: 'Parc', icon: Layers },
  ];

  return (
    <nav
      aria-label="Navigation Mobile"
      className="fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around select-none safe-area-bottom shadow-2xl lg:hidden"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (tab.id === 'corrective' && activeTab?.startsWith('corrective_'));

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all relative cursor-pointer active:scale-90 ${
              isActive
                ? 'text-emerald-400 font-bold bg-slate-800/80 shadow-inner'
                : 'text-slate-400 hover:text-slate-200 font-medium'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {tab.badge > 0 && (
                <span className="absolute -top-1.5 -right-2.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-bold font-mono animate-pulse">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5">{tab.label}</span>
          </button>
        );
      })}

      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl text-slate-400 hover:text-slate-200 transition-all cursor-pointer active:scale-90"
      >
        <Menu className="w-5 h-5 stroke-2" />
        <span className="text-[10px] tracking-tight mt-0.5">Plus</span>
      </button>
    </nav>
  );
}

export default BottomNavigation;
