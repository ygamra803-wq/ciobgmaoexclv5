import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({
  className = '',
  shimmer = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-md bg-slate-200/70 dark:bg-slate-800/70 ${
        shimmer ? 'wm-skeleton-shimmer' : ''
      } ${className}`.trim()}
      {...props}
    />
  );
}

export default Skeleton;
