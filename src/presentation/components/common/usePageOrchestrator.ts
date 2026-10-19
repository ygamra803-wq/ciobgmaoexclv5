import { useState, useEffect, useRef } from 'react';

/**
 * usePageOrchestrator
 * Controls the lifecycle of page loading states:
 * 1. Shows the dedicated Skeleton when a tab is visited for the FIRST time in the session.
 * 2. When the skeleton timer finishes, the tab is marked as visited, transitioning to the page with its streaming cascade.
 * 3. On all subsequent visits to already-visited tabs, the Skeleton NEVER shows; the page renders immediately with its streaming cascade.
 * 4. Zero flash / zero flicker on tab transitions because visited state is derived synchronously.
 */
export function usePageOrchestrator(currentTab, options = {}) {
  const {
    initialLoadDuration = 450, // Duration for the very first app launch (ms)
    tabFirstLoadDuration = 380, // Duration for an unvisited tab first load (ms)
  } = options;

  // Set of tabs that have completed their first-time skeleton loading
  const [visitedTabs, setVisitedTabs] = useState(() => new Set());
  const isInitialMountRef = useRef(true);

  // Synchronously determine if the current tab is loading:
  // If it's NOT yet in visitedTabs, it is loading its skeleton for the first time!
  const isCurrentTabLoading = !visitedTabs.has(currentTab);

  useEffect(() => {
    // If this tab was already visited, no timer needed
    if (visitedTabs.has(currentTab)) {
      return;
    }

    const duration = isInitialMountRef.current ? initialLoadDuration : tabFirstLoadDuration;
    isInitialMountRef.current = false;

    const timer = setTimeout(() => {
      setVisitedTabs((prev) => {
        if (prev.has(currentTab)) return prev;
        const next = new Set(prev);
        next.add(currentTab);
        return next;
      });
    }, duration);

    return () => {
      clearTimeout(timer);
    };
  }, [currentTab, visitedTabs, initialLoadDuration, tabFirstLoadDuration]);

  return {
    isCurrentTabLoading,
    isTabVisited: visitedTabs.has(currentTab),
    visitedTabs,
  };
}

export default usePageOrchestrator;
