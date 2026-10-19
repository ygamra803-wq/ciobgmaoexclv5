import { useState, useEffect } from 'react';

/**
 * useSmartTableLoader
 * Implements the intelligent two-phase rendering requested:
 * 1. Initial Frame: Page shell, banners, and table headers mount immediately,
 *    with table showing empty/skeleton rows.
 * 2. Next Frame: Table smoothly hydrates with data once the browser has painted the shell.
 *
 * @param {Array} data - The array of items to be rendered.
 * @param {number} delayMs - Delay in milliseconds before hydrating table (default: 60ms).
 */
export function useSmartTableLoader(data = [], delayMs = 120) {
  const [isDataReady, setIsDataReady] = useState(false);

  useEffect(() => {
    setIsDataReady(false);

    // Give browser one frame to paint the page shell and layout without blocking
    const rafId = requestAnimationFrame(() => {
      const timer = setTimeout(() => {
        setIsDataReady(true);
      }, delayMs);
      return () => clearTimeout(timer);
    });

    return () => cancelAnimationFrame(rafId);
  }, [delayMs]);

  return {
    isDataReady,
    data: isDataReady ? data : [],
  };
}

export default useSmartTableLoader;
