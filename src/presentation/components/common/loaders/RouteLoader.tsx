import LoadingSkeleton from '../LoadingSkeleton';
import { Skeleton } from './Skeleton';
import { NeuralWatermark } from './NeuralWatermark';

function DefaultPageSkeleton() {
  return (
    <div className="space-y-6 w-full p-4 sm:p-6 select-none" aria-hidden="true">
      <div className="flex flex-col items-center justify-center gap-4 text-center mb-2">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2 flex flex-col items-center">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      </div>

      <div className="my-4 h-px w-full bg-slate-200/70 dark:bg-slate-800/70 max-w-4xl mx-auto" />

      <div className="mx-auto max-w-lg rounded-2xl border border-slate-200/80 dark:border-slate-800 p-2 backdrop-blur-md">
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pt-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 p-4 space-y-4 flex flex-col h-48"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="space-y-2 py-2 flex-grow">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-[85%]" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface RouteLoaderProps {
  /** Active tab key to render the matching domain skeleton behind the watermark */
  currentTab?: string;
  /** Optional status label shown beneath the centered glass cube */
  label?: string;
}

/**
 * RouteLoader
 * Combines the translucent 40% page skeleton (shimmer) with the animated NeuralWatermark.
 * Uses z-10 stacking context so NeuralWatermark's internal z-40 remains strictly scoped
 * beneath the app's Header (z-30) and Sidebar (z-40).
 */
export function RouteLoader({ currentTab, label }: RouteLoaderProps) {
  return (
    <div className="relative z-10 w-full h-full min-h-[500px] overflow-hidden">
      {/* Background: 40% translucent skeleton */}
      <div className="opacity-40 pointer-events-none select-none">
        {currentTab ? (
          <LoadingSkeleton currentTab={currentTab} />
        ) : (
          <DefaultPageSkeleton />
        )}
      </div>

      {/* Foreground: Live animated NeuralWatermark */}
      <NeuralWatermark label={label} />
    </div>
  );
}

export default RouteLoader;
