import { useState, useCallback } from 'react';

export interface ToastState {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
}

export function useAppViewController() {
  const [showSplash, setShowSplash] = useState(true);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  return {
    showSplash,
    setShowSplash,
    handleSplashComplete,
    toast,
    setToast,
    showToast,
    currentTab,
    setCurrentTab,
    mobileMenuOpen,
    setMobileMenuOpen,
  };
}

export default useAppViewController;
