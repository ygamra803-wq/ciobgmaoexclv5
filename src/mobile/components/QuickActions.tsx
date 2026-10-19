import { Wrench, Package, AlertTriangle, ScanLine } from 'lucide-react';

/**
 * ⚡ QuickActions Component for Mobile Technicians
 */
export const QuickActions = ({ onAction }) => {
  const actions = [
    { id: 'quick_out', label: 'صرف سريع', icon: Package, color: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    { id: 'create_di', label: 'طلب صيانة (DI)', icon: AlertTriangle, color: 'bg-amber-600 hover:bg-amber-700 text-white' },
    { id: 'create_bt', label: 'أمر عمل (BT)', icon: Wrench, color: 'bg-indigo-600 hover:bg-indigo-700 text-white' },
    { id: 'scan_qr', label: 'مسح QR الآلة', icon: ScanLine, color: 'bg-slate-800 hover:bg-slate-900 text-white' },
  ];

  return (
    <div className="p-3 bg-slate-900/90 backdrop-blur border-b border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">اختصارات الميدان السريعة</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">Mobile Quick v16</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {actions.map((act) => {
          const Icon = act.icon;
          return (
            <button
              key={act.id}
              onClick={() => onAction?.(act.id)}
              className={`flex flex-col items-center justify-center p-2.5 rounded-xl text-center shadow-lg transition-all active:scale-95 ${act.color}`}
              style={{ minHeight: '52px' }}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-bold leading-tight">{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default QuickActions;
