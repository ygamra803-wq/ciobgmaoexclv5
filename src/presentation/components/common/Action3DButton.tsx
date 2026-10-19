
/**
 * Action3DButton — 3D Interactive Action Button Component
 * 
 * Provides a tactile 3D depth effect with soft floating shadow, illuminated hover state,
 * icon scale transition, and subtle micro-interactions across the CIOB GMAO app.
 * 
 * @param {Object} props
 * @param {React.ReactNode} [props.icon] - Lucide icon component or SVG
 * @param {string} [props.label] - Text label for pill/button variant
 * @param {'circle' | 'pill' | 'square'} [props.variant='circle'] - Button shape archetype
 * @param {'cyan' | 'teal' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'slate' | 'rose'} [props.color='cyan'] - Color theme palette
 * @param {string} [props.title] - Tooltip title text
 * @param {string} [props.ariaLabel] - Accessibility label
 * @param {function} [props.onClick] - Click handler
 * @param {boolean} [props.disabled=false] - Disabled state
 * @param {string} [props.className=''] - Additional custom CSS classes
 * @param {React.ReactNode} [props.children] - Children elements
 */
export default function Action3DButton({
  icon: Icon,
  label,
  variant = 'circle',
  color = 'cyan',
  title,
  ariaLabel,
  onClick,
  disabled = false,
  className = '',
  showAddBadge = false,
  children,
  ...restProps
}) {
  // Color palette themes mapping with individual 3D glows and border highlights
  const colorThemes = {
    cyan: {
      border: 'border-slate-200/90 hover:border-cyan-400',
      bgHover: 'hover:bg-cyan-50/80',
      text: 'text-cyan-700 hover:text-cyan-950',
      iconText: 'text-cyan-700 group-hover:text-cyan-800',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(6,182,212,0.3),0_3px_8px_-2px_rgba(6,182,212,0.15)]',
      solidBg: 'bg-gradient-to-b from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white border-cyan-500/50 shadow-[0_4px_14px_rgba(6,182,212,0.35)]',
    },
    teal: {
      border: 'border-slate-200/90 hover:border-teal-400',
      bgHover: 'hover:bg-teal-50/80',
      text: 'text-teal-700 hover:text-teal-950',
      iconText: 'text-teal-700 group-hover:text-teal-800',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(20,184,166,0.3),0_3px_8px_-2px_rgba(20,184,166,0.15)]',
      solidBg: 'bg-gradient-to-b from-teal-600 to-teal-700 hover:from-teal-500 hover:to-teal-600 text-white border-teal-500/50 shadow-[0_4px_14px_rgba(20,184,166,0.35)]',
    },
    indigo: {
      border: 'border-slate-200/90 hover:border-indigo-400',
      bgHover: 'hover:bg-indigo-50/80',
      text: 'text-indigo-700 hover:text-indigo-950',
      iconText: 'text-indigo-700 group-hover:text-indigo-800',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(99,102,241,0.3),0_3px_8px_-2px_rgba(99,102,241,0.15)]',
      solidBg: 'bg-gradient-to-b from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border-indigo-500/50 shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
    },
    purple: {
      border: 'border-slate-200/90 hover:border-purple-400',
      bgHover: 'hover:bg-purple-50/80',
      text: 'text-purple-700 hover:text-purple-950',
      iconText: 'text-purple-700 group-hover:text-purple-800',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(168,85,247,0.3),0_3px_8px_-2px_rgba(168,85,247,0.15)]',
      solidBg: 'bg-gradient-to-b from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white border-purple-500/50 shadow-[0_4px_14px_rgba(168,85,247,0.35)]',
    },
    emerald: {
      border: 'border-slate-200/90 hover:border-emerald-400',
      bgHover: 'hover:bg-emerald-50/80',
      text: 'text-emerald-700 hover:text-emerald-950',
      iconText: 'text-emerald-700 group-hover:text-emerald-800',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(16,185,129,0.3),0_3px_8px_-2px_rgba(16,185,129,0.15)]',
      solidBg: 'bg-gradient-to-b from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border-emerald-500/50 shadow-[0_4px_14px_rgba(16,185,129,0.35)]',
    },
    amber: {
      border: 'border-slate-200/90 hover:border-amber-400',
      bgHover: 'hover:bg-amber-50/80',
      text: 'text-amber-700 hover:text-amber-950',
      iconText: 'text-amber-700 group-hover:text-amber-800',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(245,158,11,0.3),0_3px_8px_-2px_rgba(245,158,11,0.15)]',
      solidBg: 'bg-gradient-to-b from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border-amber-500/50 shadow-[0_4px_14px_rgba(245,158,11,0.35)]',
    },
    slate: {
      border: 'border-slate-200/90 hover:border-slate-400',
      bgHover: 'hover:bg-slate-100/90',
      text: 'text-slate-700 hover:text-slate-950',
      iconText: 'text-slate-700 group-hover:text-slate-900',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(100,116,139,0.25),0_3px_8px_-2px_rgba(100,116,139,0.1)]',
      solidBg: 'bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white border-slate-600/50 shadow-[0_4px_14px_rgba(100,116,139,0.3)]',
    },
    rose: {
      border: 'border-slate-200/90 hover:border-rose-400',
      bgHover: 'hover:bg-rose-50/80',
      text: 'text-rose-700 hover:text-rose-950',
      iconText: 'text-rose-700 group-hover:text-rose-800',
      glow: 'hover:shadow-[0_8px_20px_-3px_rgba(244,63,94,0.3),0_3px_8px_-2px_rgba(244,63,94,0.15)]',
      solidBg: 'bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white border-rose-500/50 shadow-[0_4px_14px_rgba(244,63,94,0.35)]',
    },
  };

  const theme = colorThemes[color] || colorThemes.cyan;

  // Base 3D elevation + tactile interaction styles
  const base3DStyles = `
    group relative inline-flex items-center justify-center font-bold transition-all duration-300 ease-out
    shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)]
    hover:-translate-y-1 ${theme.glow}
    active:translate-y-0.5 active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)]
    disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none
  `;

  let variantStyles = '';

  if (variant === 'circle') {
    variantStyles = `w-10 sm:w-11 h-10 sm:h-11 rounded-full bg-white border ${theme.border} ${theme.bgHover} ${theme.text} shrink-0`;
  } else if (variant === 'pill') {
    variantStyles = `px-4 py-2 rounded-full bg-white border text-xs gap-2 ${theme.border} ${theme.bgHover} ${theme.text} shrink-0`;
  } else if (variant === 'square') {
    variantStyles = `px-4 py-2.5 rounded-xl border text-xs gap-2 ${theme.border} ${theme.bgHover} ${theme.text} shrink-0`;
  } else if (variant === 'solid') {
    variantStyles = `px-4 py-2.5 rounded-xl text-xs gap-2 ${theme.solidBg} shrink-0`;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel || title || label}
      className={`${base3DStyles} ${variantStyles} ${className}`.trim()}
      {...restProps}
    >
      {Icon && (
        <div className="relative inline-flex items-center justify-center shrink-0">
          <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 shrink-0 ${variant === 'solid' ? 'text-white' : theme.iconText}`} />
          {showAddBadge && (
            <span className="absolute -top-1.5 -right-2 bg-emerald-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black shadow-[0_2px_6px_rgba(0,0,0,0.22)] ring-2 ring-white transform scale-95 group-hover:scale-110 transition-transform">
              +
            </span>
          )}
        </div>
      )}
      {label && <span className="truncate">{label}</span>}
      {children}
    </button>
  );
}
