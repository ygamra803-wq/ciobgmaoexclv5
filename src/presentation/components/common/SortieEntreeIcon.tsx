
/**
 * SortieEntreeIcon - Unified dual-arrow movement icon for CIOB GMAO Light.
 *
 * - Down Arrow (Entrée / Stock In): GREEN (#10b981 / emerald)
 * - Up Arrow (Sortie / Stock Out): RED (#f43f5e / rose)
 */
export default function SortieEntreeIcon({
  className = 'w-4 h-4',
  downColor = 'text-emerald-500',
  upColor = 'text-rose-500',
  strokeWidth = 2.25,
  ...props
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      className={`shrink-0 inline-block align-middle ${className}`}
      aria-hidden="true"
      {...props}
    >
      {/* Down Arrow (Green / Entrée) */}
      <g className={downColor} stroke="currentColor">
        <path d="M7 4v16" />
        <path d="m3 16 4 4 4-4" />
      </g>

      {/* Up Arrow (Red / Sortie) */}
      <g className={upColor} stroke="currentColor">
        <path d="M17 20V4" />
        <path d="m21 8-4-4-4 4" />
      </g>
    </svg>
  );
}
