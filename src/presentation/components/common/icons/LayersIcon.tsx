/**
 * LayersIcon - Google Material Symbols "layers" icon
 * 100% Offline SVG component
 * Represents Part Types (Types de Parts d'Entrepôt)
 */
export function LayersIcon({
  className = 'w-4 h-4',
  size,
  color = 'currentColor',
  ...props
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      width={size || 24}
      height={size || 24}
      fill={color}
      className={className}
      {...props}
    >
      <path d="M480-118 120-398l66-50 294 228 294-228 66 50-360 280Zm0-202L120-600l360-280 360 280-360 280Zm0-280Zm0 178 230-178-230-178-230 178 230 178Z" />
    </svg>
  );
}

export const Layers = LayersIcon;
export const PartTypeIcon = LayersIcon;
export default LayersIcon;
