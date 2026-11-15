import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({
  className = '',
  shimmer = true,
  ...props
}: SkeletonProps) {
  const baseClasses =
    'relative overflow-hidden rounded-md bg-slate-200/70 dark:bg-slate-800/70';
  const shimmerClasses = shimmer
    ? 'after:absolute after:inset-0 after:-translate-x-full after:animate-[neuralShimmer_2s_infinite] after:bg-gradient-to-r after:from-transparent after:via-white/60 dark:after:via-white/10 after:to-transparent'
    : '';

  return (
    <div
      className={`${baseClasses} ${shimmerClasses} ${className}`.trim()}
      {...props}
    />
  );
}

export default Skeleton;
