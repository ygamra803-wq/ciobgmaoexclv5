import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { FileSpreadsheet, UploadCloud } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';
import ContextMenu from '../common/ContextMenu';
import AutoSaveIndicator from '../common/AutoSaveIndicator';
import KeyboardShortcutsModal from '../common/KeyboardShortcutsModal';
import { keyboardShortcuts } from '../../../services/KeyboardShortcutsService';
import { useAuth } from '../../../context/AuthContext';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';

export default function MainLayout({
  children,
  currentTab,
  setCurrentTab,
  filters,
  navigation,
  counts,
  mobileMenuOpen,
  setMobileMenuOpen,
  fileInputRef,
  handleImportFile,
  handleExportExcel,
  exportMasterTopologyWorkbook,
  exportInventoryMaterialsWorkbook,
  exportMovementsUnifiedWorkbook,
  linkedFileName,
  onDirectLink,
  onDirectSave,
  stockItems,
  machines,
  zones,
  technicians,
  preventiveTasks,
  onMarkTaskDone,
  onAddMouvement,
  showToast,
  operationProgress,
}) {
  const { user, logout } = useAuth();
  const [shortcutsModalOpen, setShortcutsModalOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  // Appearance & Layout States
  const [deviceMode, setDeviceMode] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.DEVICE_MODE) || 'auto';
  });

  const [sidebarStyle, setSidebarStyle] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.SIDEBAR_STYLE) || 'floating';
  });

  const [sidebarBehavior, setSidebarBehavior] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.SIDEBAR_BEHAVIOR) || 'push';
  });

  useEffect(() => {
    const handleAppearanceChanged = (e) => {
      if (e?.detail?.theme !== undefined && typeof document !== 'undefined') {
        if (e.detail.theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      if (e?.detail?.deviceMode !== undefined) {
        setDeviceMode(e.detail.deviceMode);
      }
      if (e?.detail?.sidebarStyle !== undefined) {
        setSidebarStyle(e.detail.sidebarStyle);
      }
      if (e?.detail?.sidebarBehavior !== undefined) {
        setSidebarBehavior(e.detail.sidebarBehavior);
      }
      if (e?.detail?.accentColor !== undefined && typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-accent', e.detail.accentColor);
      }
      if (e?.detail?.density !== undefined && typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-density', e.detail.density);
      }
    };
    window.addEventListener('gmao_appearance_changed', handleAppearanceChanged);
    return () => window.removeEventListener('gmao_appearance_changed', handleAppearanceChanged);
  }, []);

  // MainLayout is rendered exclusively for desktop (ShellPolicy.resolved === 'desktop').
  // The dedicated mobile field companion shell is handled separately by MobileShell.

  // RBAC Capability Guards for Global Drag-and-Drop & Shortcuts (NH-1 & NH-2)
  const canImportData =
    !user ||
    AuthorizationService.hasPermission(user, 'settings.restore') ||
    AuthorizationService.hasPermission(user, 'settings.manage');

  const canDirectSave =
    !user ||
    (!AuthorizationService.isReadOnly(user) &&
      (AuthorizationService.hasPermission(user, 'settings.backup') ||
        AuthorizationService.hasPermission(user, 'stock.export')));

  const navigateIfAllowed = useCallback(
    (targetTab: string) => {
      if (user && !AuthorizationService.canAccessTab(user, targetTab)) {
        showToast?.(
          `Accès restreint : votre rôle (${user.titleFr || user.role}) ne dispose pas des droits requis pour accéder à cette section.`,
          'warning'
        );
        return;
      }
      setCurrentTab(targetTab);
    },
    [user, setCurrentTab, showToast]
  );

  const handleLogout = useCallback(() => {
    try {
      localStorage.setItem('gmao_active_tab', 'dashboard');
    } catch {
      /* ignore */
    }
    setCurrentTab('dashboard');
    logout();
  }, [setCurrentTab, logout]);

  // Drag and Drop File Handlers (Window level — RBAC Guarded)
  const handleDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canImportData) return;
      dragCounter.current += 1;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragOver(true);
      }
    },
    [canImportData]
  );

  const handleDragLeave = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canImportData) return;
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragOver(false);
      }
    },
    [canImportData]
  );

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);

      if (!canImportData) {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          showToast?.(
            'Action non autorisée : seuls les administrateurs peuvent importer un fichier global.',
            'warning'
          );
        }
        return;
      }

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        // Synthesize standard change event for handleImportFile
        const syntheticEvent = {
          target: {
            files,
          },
        };
        handleImportFile(syntheticEvent);
      }
    },
    [canImportData, handleImportFile, showToast]
  );

  // Global Keyboard Shortcuts Registry (RBAC Guarded — NH-2)
  useEffect(() => {
    const unregisters = [
      keyboardShortcuts.registerShortcut({
        id: 'nav-dashboard',
        key: '1',
        label: 'Alt+1',
        description: 'Aller au Tableau de bord',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('dashboard'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'nav-stock',
        key: '2',
        label: 'Alt+2',
        description: 'Aller au Stock PDR',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('stock'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'nav-entrepot',
        key: '3',
        label: 'Alt+3',
        description: 'Aller à l’Entrepôt Parts',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('entrepot'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'nav-machines',
        key: '4',
        label: 'Alt+4',
        description: 'Aller aux Machines Enregistrées',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('machines'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'nav-users',
        key: '5',
        label: 'Alt+5',
        description: 'Aller aux Opérations & Chefs',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('utilisateurs'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'nav-settings',
        key: '6',
        label: 'Alt+6',
        description: 'Aller aux Paramètres & Sécurité',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('settings'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'nav-preventive',
        key: '7',
        label: 'Alt+7',
        description: 'Aller à la Maintenance Préventive',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('preventive'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'nav-corrective',
        key: '8',
        label: 'Alt+8',
        description: 'Aller à la Maintenance Corrective (Nexus)',
        category: 'navigation',
        alt: true,
        callback: () => navigateIfAllowed('corrective'),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'action-save',
        key: 's',
        label: 'Ctrl+S',
        description: 'Sauvegarder directement dans le fichier lié',
        category: 'actions',
        ctrl: true,
        allowInInputs: true,
        callback: () => {
          if (!canDirectSave) return;
          onDirectSave?.();
        },
      }),
      keyboardShortcuts.registerShortcut({
        id: 'system-shortcuts-f1',
        key: 'F1',
        label: 'F1',
        description: 'Afficher la liste des raccourcis clavier',
        category: 'system',
        allowInInputs: true,
        callback: () => setShortcutsModalOpen((prev) => !prev),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'system-shortcuts-slash',
        key: '/',
        label: 'Ctrl+/',
        description: 'Afficher la liste des raccourcis clavier',
        category: 'system',
        ctrl: true,
        allowInInputs: true,
        callback: () => setShortcutsModalOpen((prev) => !prev),
      }),
      keyboardShortcuts.registerShortcut({
        id: 'system-escape',
        key: 'Escape',
        label: 'Échap',
        description: 'Fermer les menus et fenêtres modales',
        category: 'system',
        allowInInputs: true,
        callback: () => {
          setShortcutsModalOpen(false);
          setMobileMenuOpen(false);
        },
      }),
    ];

    return () => {
      unregisters.forEach((unreg) => unreg());
    };
  }, [navigateIfAllowed, canDirectSave, onDirectSave, setMobileMenuOpen]);

  const mainContentSpacingClass = useMemo(() => {
    if (sidebarStyle === 'standard') {
      return 'lg:ml-[270px] p-2.5 sm:p-4 lg:p-6 pb-24 lg:pb-6';
    }
    if (sidebarStyle === 'floating') {
      if (sidebarBehavior === 'push') {
        return 'lg:pl-20 p-2.5 sm:p-4 lg:p-6 pb-24 lg:pb-6';
      }
      // overlay mode: floating icon sits inside the page comfortably
      return 'p-2.5 sm:p-4 lg:p-6 pb-24 lg:pb-6';
    }
    return 'p-2.5 sm:p-4 lg:p-6 pb-24 lg:pb-6';
  }, [sidebarStyle, sidebarBehavior]);


  return (
    <div

      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="min-h-screen bg-[#FAFAF9] text-zinc-900 flex flex-col relative isolate select-none font-sans antialiased"
    >
      {/* Drag & Drop Visual Dropzone Overlay */}
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-white text-center animate-in fade-in duration-150 pointer-events-none">
          <div className="w-24 h-24 rounded-3xl bg-emerald-500/20 border-2 border-dashed border-emerald-400 flex items-center justify-center mb-6 shadow-2xl animate-bounce">
            <UploadCloud className="w-12 h-12 text-emerald-300" />
          </div>
          <h2 className="text-2xl font-black mb-2 tracking-tight">
            Glissez-déposez votre fichier ici
          </h2>
          <p className="text-sm text-emerald-200/90 max-w-md mb-4">
            Importation automatique et instantanée de vos classeurs Excel (<code>.xlsx</code>, <code>.xls</code>) ou sauvegardes JSON.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-800/60 border border-emerald-500/30 text-xs font-mono text-emerald-200">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Format GMAO Light Twin V2 pris en charge</span>
          </div>
        </div>
      )}

      {/* Accessible Skip Link for Keyboard & Screen-reader navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-accent-main focus:text-white focus:rounded-full focus:shadow-xl focus:outline-hidden font-bold text-xs tracking-tight transition"
      >
        Passer directement au contenu principal
      </a>

      {/* Subtle Background Accent Glows */}
      <div className="fixed -top-32 -right-32 w-96 h-96 bg-accent-500/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed -bottom-32 -left-32 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Heavy Operation Progress Overlay */}
      {operationProgress?.active && (
        <div className="fixed inset-0 z-100 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6 select-none">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-accent-subtle flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-6 h-6 text-accent-main animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 leading-tight uppercase tracking-tight">
                  Opération en cours
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {operationProgress.status || 'Traitement des données...'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-slate-600 font-mono">
                <span>PROGRESSION</span>
                <span>{operationProgress.percent}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full bg-accent-main transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${operationProgress.percent}%` }}
                />
              </div>
            </div>
            
            <p className="text-[9px] text-slate-400 mt-4 text-center font-medium leading-relaxed italic">
              Veuillez patienter pendant la finalisation de l'opération Excel Twin...
            </p>
          </div>
        </div>
      )}

      {/* Sticky Top Header: Desktop Back-Office Header */}
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        filters={filters}
        navigation={navigation}
        counts={counts}
        setMobileMenuOpen={setMobileMenuOpen}
        fileInputRef={fileInputRef}
        handleImportFile={handleImportFile}
        handleExportExcel={handleExportExcel}
        exportMasterTopologyWorkbook={exportMasterTopologyWorkbook}
        exportInventoryMaterialsWorkbook={exportInventoryMaterialsWorkbook}
        exportMovementsUnifiedWorkbook={exportMovementsUnifiedWorkbook}
        linkedFileName={linkedFileName}
        onDirectLink={onDirectLink}
        onDirectSave={onDirectSave}
        currentUser={user}
        onOpenShortcuts={() => setShortcutsModalOpen(true)}
        onLogout={handleLogout}
        showToast={showToast}
      />

      {/* Content Layout */}
      <div className="flex-1 flex w-full relative min-w-0">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          counts={counts}
          currentUser={user}
          fileInputRef={fileInputRef}
          handleImportFile={handleImportFile}
          handleExportExcel={handleExportExcel}
          onLogout={handleLogout}
        />

        {/* Main Page Content - Full width layout with responsive touch-friendly padding */}
        <main
          id="main-content"
          role="main"
          tabIndex={-1}
          aria-label="Contenu principal"
          className={`flex-1 w-full min-w-0 focus:outline-hidden overflow-x-hidden ${mainContentSpacingClass}`}
        >
          {children}
        </main>
      </div>

      {/* Context Menu Global Portal */}
      <ContextMenu />

      {/* Live AutoSave Floating Indicator */}
      <AutoSaveIndicator />

      {/* Keyboard Shortcuts Help Dialog */}
      <KeyboardShortcutsModal
        isOpen={shortcutsModalOpen}
        onClose={() => setShortcutsModalOpen(false)}
      />
    </div>
  );
}
