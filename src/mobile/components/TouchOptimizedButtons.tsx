import { useTouch } from '../hooks/useMobileOptimization';

/**
 * 🔘 TouchOptimizedButton with Haptic Feedback & Accessible Touch Padding (min 48px)
 */
export const TouchOptimizedButton = ({
  children,
  onClick,
  variant = 'primary',
  fullWidth = false,
  disabled = false,
  className = '',
  icon: Icon,
  ...props
}) => {
  const { onTouchStart, onTouchEnd } = useTouch();

  const baseStyles =
    'relative inline-flex items-center justify-center font-bold text-sm rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none';

  const variantStyles = {
    primary: 'bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-500/30',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border border-rose-500/30',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white border border-amber-500/30',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700',
    outline: 'border border-slate-700 hover:bg-slate-800 text-slate-300',
  };

  const handleClick = (e) => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {
        // Vibrations not allowed/supported
      }
    }
    onClick?.(e);
  };

  return (
    <button
      onClick={handleClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      disabled={disabled}
      style={{ minHeight: '48px', minWidth: '48px' }}
      className={`${baseStyles} ${variantStyles[variant] || variantStyles.primary} ${
        fullWidth ? 'w-full' : ''
      } px-4 py-3 ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5 ml-2 shrink-0" />}
      <span>{children}</span>
    </button>
  );
};

export default TouchOptimizedButton;
