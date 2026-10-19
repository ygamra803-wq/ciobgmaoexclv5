/**
 * SpokeIcon - Google Material Symbols "spoke" icon
 * 100% Offline SVG component
 * Represents Component Families (Familles de Composants)
 */
export function SpokeIcon({
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
      <path d="M480-520q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-680q0-33-23.5-56.5T480-760q-33 0-56.5 23.5T400-680q0 33 23.5 56.5T480-600ZM280-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T360-280q0-33-23.5-56.5T280-360q-33 0-56.5 23.5T200-280q0 33 23.5 56.5T280-200Zm400 80q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T760-280q0-33-23.5-56.5T680-360q-33 0-56.5 23.5T600-280q0 33 23.5 56.5T680-200ZM480-680ZM280-280Zm400 0Z" />
    </svg>
  );
}

export const Spoke = SpokeIcon;
export const CompFamilyIcon = SpokeIcon;
export default SpokeIcon;
