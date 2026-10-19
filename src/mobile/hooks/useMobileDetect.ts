import { useState, useEffect } from 'react';

/**
 * useMobileDetect Hook
 * Accurately detects mobile/tablet viewports and touch capability
 */
export function useMobileDetect(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < breakpoint;
  });

  const [isTouchDevice, setIsTouchDevice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < breakpoint);
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [breakpoint]);

  return { isMobile, isTouchDevice };
}
export default useMobileDetect;
