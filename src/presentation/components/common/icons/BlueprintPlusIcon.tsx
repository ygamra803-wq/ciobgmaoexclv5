/**
 * BlueprintPlusIcon - Machine Blueprint creation quick action icon
 * Displays FingerprintPattern / Blueprint architecture with a dedicated plus (+) badge
 * 100% Offline SVG component
 */
export function BlueprintPlusIcon({
  className = 'w-3.5 h-3.5',
  size,
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size || 24}
      height={size || 24}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
      <path d="M2 12a10 10 0 0 1 18-6" />
      <path d="M2 16h.01" />
      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
      {/* Plus badge at bottom-right */}
      <circle cx="17.5" cy="17.5" r="5" fill="currentColor" stroke="none" />
      <line x1="17.5" y1="14.8" x2="17.5" y2="20.2" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="14.8" y1="17.5" x2="20.2" y2="17.5" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export default BlueprintPlusIcon;
