import type { ElementType } from 'react';

interface PageHeaderIconProps {
  icon: ElementType;
  colorClass?: string;
  className?: string;
}

/**
 * PageHeaderIcon - Flat, unboxed page header icon unified with SortieRapideHeader:
 * `w-7 h-7 ${colorClass} shrink-0 group-hover/header:scale-110 transition-transform duration-300`
 */
export default function PageHeaderIcon({
  icon: Icon,
  colorClass = 'text-indigo-600',
  className = '',
}: PageHeaderIconProps) {
  return (
    <Icon
      className={`w-7 h-7 ${colorClass} shrink-0 group-hover/header:scale-110 transition-transform duration-300 ${className}`.trim()}
    />
  );
}
