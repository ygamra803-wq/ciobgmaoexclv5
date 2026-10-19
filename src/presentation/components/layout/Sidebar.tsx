import { useState, useEffect } from 'react';
import FloatingSidebar from './FloatingSidebar';
import MobileSidebarDrawer from './MobileSidebarDrawer';
import { storageService } from '../../../utils/storageService';

export default function Sidebar({
  currentTab,
  setCurrentTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  counts,
  currentUser,
  fileInputRef,
  handleImportFile,
  handleExportExcel,
  onLogout,
}) {
  const [sidebarStyle, setSidebarStyle] = useState(() => {
    return storageService.getItem('gmao_sidebar_style') || 'floating';
  });

  useEffect(() => {
    const handleAppearanceChanged = (e) => {
      if (e?.detail?.sidebarStyle) {
        setSidebarStyle(e.detail.sidebarStyle);
      }
    };
    window.addEventListener('gmao_appearance_changed', handleAppearanceChanged);
    return () => window.removeEventListener('gmao_appearance_changed', handleAppearanceChanged);
  }, []);

  const isFixedDesktop = sidebarStyle === 'standard';

  return (
    <>
      {/* Desktop Floating Icon Dock (Displayed when sidebar style is floating) */}
      {!isFixedDesktop && (
        <FloatingSidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onLogout={onLogout}
        />
      )}

      {/* The original full rich sidebar: permanently fixed on desktop (270px) in standard mode, or mobile drawer in floating mode */}
      <MobileSidebarDrawer
        isFixedDesktop={isFixedDesktop}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        counts={counts}
        currentUser={currentUser}
        fileInputRef={fileInputRef}
        handleImportFile={handleImportFile}
        handleExportExcel={handleExportExcel}
        onLogout={onLogout}
      />
    </>
  );
}
