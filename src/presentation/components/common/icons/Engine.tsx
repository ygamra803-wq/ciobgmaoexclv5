
/**
 * Engine Icon - Exact match to the uploaded engine.svg reference
 */
export function Engine({
  className = 'w-4 h-4',
  size,
  color = 'currentColor',
  strokeWidth = 2,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 2v4" />
      <path d="M10 4h4" />
      <path d="M2 13h4" />
      <path d="M6 7.5A1.5 1.5 0 0 1 7.5 6h7a1.5 1.5 0 0 1 1.06.44l3 3A1.5 1.5 0 0 1 19 10.5v5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 15.5v-8z" />
      <path d="M15.5 6v5h3.5" />
    </svg>
  );
}

export default Engine;
