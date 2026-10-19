import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose }) {
  if (!message) return null;

  const bgColors = {
    success: 'bg-emerald-900 text-emerald-50 border-emerald-700',
    error: 'bg-rose-900 text-rose-50 border-rose-700',
    info: 'bg-slate-900 text-slate-50 border-slate-700',
  };

  const Icons = {
    success: CheckCircle2,
    error: AlertCircle,
    info: Info,
  };

  const IconComponent = Icons[type] || Info;

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      aria-live={type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className="fixed bottom-5 right-5 z-50 animate-bounce-in"
    >
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold ${bgColors[type] || bgColors.info}`}
      >
        <IconComponent className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer la notification"
            className="ml-2 hover:opacity-75 transition cursor-pointer p-0.5 rounded focus-visible:ring-1 focus-visible:ring-white"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
