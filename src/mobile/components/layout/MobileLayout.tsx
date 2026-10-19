import MobileHeader from './MobileHeader';
import BottomNavigation from './BottomNavigation';
import QuickActions from '../QuickActions';
import OfflineIndicator from '../OfflineIndicator';

/**
 * 📱 MobileLayout Container Component
 */
export const MobileLayout = ({
  children,
  activeTab = 'dashboard',
  onTabChange,
  onQuickAction,
  pendingSyncCount = 0,
  onSyncNow,
  title = 'GMAO Nexus Mobile'
}) => {
  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 max-w-md mx-auto shadow-2xl overflow-hidden font-sans border-x border-slate-800">
      <MobileHeader title={title} />
      <OfflineIndicator pendingSyncCount={pendingSyncCount} onSyncNow={onSyncNow} />
      <QuickActions onAction={onQuickAction} />

      <main className="flex-1 overflow-y-auto p-4 pb-24 space-y-4">
        {children}
      </main>

      <BottomNavigation activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
};

export default MobileLayout;
