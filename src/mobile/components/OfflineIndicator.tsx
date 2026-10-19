import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useMobileOptimization } from '../hooks/useMobileOptimization';

/**
 * 📡 OfflineIndicator Banner & Sync Status Badge
 */
export const OfflineIndicator = ({ pendingSyncCount = 0, onSyncNow }) => {
  const { isOnline } = useMobileOptimization();

  if (isOnline && pendingSyncCount === 0) return null;

  return (
    <div
      className={`px-3 py-2 flex items-center justify-between text-xs font-medium transition-colors ${
        !isOnline
          ? 'bg-amber-500/10 border-b border-amber-500/20 text-amber-400'
          : 'bg-indigo-500/10 border-b border-indigo-500/20 text-indigo-400'
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>وضع العمل بدون إنترنت (Offline Active)</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4 text-indigo-400" />
            <span>تم استعادة الاتصال بالشبكة</span>
          </>
        )}
      </div>

      {pendingSyncCount > 0 && (
        <button
          onClick={onSyncNow}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-all font-bold text-[11px]"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>مزامنة ({pendingSyncCount})</span>
        </button>
      )}
    </div>
  );
};

export default OfflineIndicator;
