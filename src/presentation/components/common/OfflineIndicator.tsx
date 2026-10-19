import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-2xl bg-emerald-900/95 text-white px-4 py-2 text-xs font-semibold shadow-xl border border-emerald-700 backdrop-blur-md animate-fadeIn">
      <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
      <WifiOff className="w-4 h-4 text-emerald-300" />
      <div>
        <span className="font-bold">Mode Hors-Ligne Actif (100% Offline)</span>
        <span className="text-emerald-200 text-[11px] block font-normal">
          Toutes vos modifications sont sauvegardées localement.
        </span>
      </div>
    </div>
  );
}
