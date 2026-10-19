import { useState, useEffect } from 'react';

/**
 * 📱 Hook لتحسين أداء وتقنيات الهاتف المحمول
 */
export function useMobileOptimization() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [batteryLevel, setBatteryLevel] = useState(100);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        setBatteryLevel(battery.level * 100);
        battery.addEventListener('levelchange', () => {
          setBatteryLevel(battery.level * 100);
        });
      }).catch(() => {});
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isMobile,
    isOnline,
    batteryLevel,
    shouldOptimize: isMobile || batteryLevel < 20
  };
}

/**
 * 👆 Hook للـ Swipe Gestures على الشاشات اللمسية
 */
export function useSwipe(onSwipeLeft, onSwipeRight) {
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const handleTouchStart = (e) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    setTouchEnd(e.changedTouches[0].clientX);
    
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      onSwipeLeft?.();
    } else if (isRightSwipe) {
      onSwipeRight?.();
    }
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd
  };
}

/**
 * 🎯 Hook لإنشاء تفاعلات اللمس المتجاوبة
 */
export function useTouch() {
  const [isPressed, setIsPressed] = useState(false);

  const handleTouchStart = (e) => {
    setIsPressed(true);
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '0.7';
    }
  };

  const handleTouchEnd = (e) => {
    setIsPressed(false);
    if (e.currentTarget) {
      e.currentTarget.style.opacity = '1';
    }
  };

  return {
    isPressed,
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd
  };
}

/**
 * 🚀 Hook لتحسين الأداء وتقليل جودة الرسومات على الهواتف الضعيفة
 */
export function useMobilePerformance() {
  const [shouldReduceAnimations, setShouldReduceAnimations] = useState(false);
  const [shouldReduceImages, setShouldReduceImages] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setShouldReduceAnimations(prefersReducedMotion);

    const handleConnectionChange = () => {
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (connection) {
        const effectiveType = connection.effectiveType;
        setShouldReduceImages(effectiveType !== '4g');
      }
    };

    handleConnectionChange();
    navigator.connection?.addEventListener('change', handleConnectionChange);

    return () => {
      navigator.connection?.removeEventListener('change', handleConnectionChange);
    };
  }, []);

  return {
    shouldReduceAnimations,
    shouldReduceImages,
    animationDuration: shouldReduceAnimations ? 0 : 300,
    imageQuality: shouldReduceImages ? 'low' : 'high'
  };
}
