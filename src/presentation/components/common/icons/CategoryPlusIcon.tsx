/**
 * CategoryPlusIcon - Machine Template creation quick action icon
 * Displays CategoryIcon geometry with a dedicated plus (+) badge on the circle element
 * 100% Offline SVG component
 */
export function CategoryPlusIcon({
  className = 'w-3.5 h-3.5',
  size,
  color = 'currentColor',
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size || 24}
      height={size || 24}
      className={className}
      {...props}
    >
      {/* Triangle at top */}
      <path
        d="M12 2l-5.5 9h11L12 2zm0 3.84L13.93 9h-3.87L12 5.84z"
        fill={color}
      />
      {/* Square at bottom left */}
      <path
        d="M3 21.5h8v-8H3v8zm2-6h4v4H5v-4z"
        fill={color}
      />
      {/* Circle badge at bottom right with white plus */}
      <circle cx="17.5" cy="17.5" r="5" fill={color} />
      <line x1="17.5" y1="14.8" x2="17.5" y2="20.2" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="14.8" y1="17.5" x2="20.2" y2="17.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default CategoryPlusIcon;
