import { Menu, Save, ShieldCheck, Smartphone, Monitor } from 'lucide-react';

export function MobileHeader({
  currentTab = 'dashboard',
  setMobileMenuOpen = () => {},
  linkedFileName = '',
  onDirectSave = () => {},
  mobileViewMode = 'compact',
  setMobileViewMode = () => {},
  currentUser = null,
}) {
  const getTabTitle = (tab) => {
    switch (tab) {
      case 'dashboard':
        return 'Tableau de bord';
      case 'stock':
        return 'Stock Pièces';
      case 'warehouse':
        return 'Entrepôt';
      case 'machines':
        return 'Parc Machines';
      case 'preventive':
        return 'Maintenance Préventive';
      case 'corrective':
      case 'corrective_di':
      case 'corrective_bt':
      case 'corrective_live':
      case 'corrective_cloture':
      case 'corrective_analyse':
        return 'Maintenance Corrective';
      case 'sorties_externes':
        return 'Sorties Externes';
      case 'users':
        return 'Utilisateurs & Équipe';
      case 'settings':
        return 'Paramètres';
      default:
        return 'GMAO Light Twin';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-3 py-2 flex items-center justify-between select-none shadow-md lg:hidden">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu"
          className="p-1.5 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition active:scale-95"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <span className="text-xs font-black tracking-wider text-emerald-400 font-mono">
            CIOB GMAO
          </span>
          <span className="text-sm font-bold text-white leading-tight truncate max-w-[150px] sm:max-w-[200px]">
            {getTabTitle(currentTab)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {/* Toggle Mode: Field Companion vs Desktop View on Mobile */}
        <button
          onClick={() => setMobileViewMode(mobileViewMode === 'compact' ? 'full' : 'compact')}
          title={mobileViewMode === 'compact' ? 'Passer en vue Bureau' : 'Passer en vue Terrain'}
          className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-emerald-400 text-xs font-semibold flex items-center gap-1 active:scale-95 transition"
        >
          {mobileViewMode === 'compact' ? (
            <>
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px]">Terrain</span>
            </>
          ) : (
            <>
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px]">Bureau</span>
            </>
          )}
        </button>

        {linkedFileName && (
          <button
            onClick={onDirectSave}
            title="Enregistrer les modifications"
            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition active:scale-95"
          >
            <Save className="w-4 h-4" />
          </button>
        )}

        {currentUser?.role === 'ADMIN' && (
          <span className="p-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30" title="Admin">
            <ShieldCheck className="w-4 h-4" />
          </span>
        )}
      </div>
    </header>
  );
}

export default MobileHeader;
