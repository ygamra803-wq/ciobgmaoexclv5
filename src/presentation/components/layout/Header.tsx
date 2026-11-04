import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Menu,
  Upload,
  Download,
  Link,
  Save,
  FileSpreadsheet,
  Bell,
  Keyboard,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Boxes,
  Truck,
  Clock,
  Cloud,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import PWAInstallButton from '../common/PWAInstallButton';
import LanguageSwitcher from '../common/LanguageSwitcher';
import SyncButtons from '../common/SyncButtons';
import { analytics } from '../../../services/AnalyticsService';
import { notificationService } from '../../../services/NotificationService';
import { getParentModuleForTab } from './navConfig';
import { storageService } from '../../../utils/storageService';
import { AuthorizationService } from '../../../core/security/AuthorizationService';
import { isTechnicianRole } from '../../../core/security/technicianScope';
import ShellModeSwitcher from '../common/ShellModeSwitcher';
import { useTranslation } from '../../../i18n/I18nContext';

// NH-9: Isolated 1Hz Shift Clock component to prevent re-rendering the entire Header every second
function HeaderShiftClock({ tooltip }: { tooltip?: string }) {
  const [currentTime, setCurrentTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="hidden 2xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/90 text-slate-700 text-[11px] font-mono font-bold tabular-nums shadow-2xs select-none shrink-0"
      title={tooltip || 'Horloge de poste industrielle (Temps Réel)'}
      aria-label={`Heure locale de poste : ${currentTime}`}
    >
      <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" aria-hidden="true" />
      <span>{currentTime}</span>
    </div>
  );
}

export default function Header({
  currentTab,
  setCurrentTab,
  filters,
  _navigation,
  counts = {},
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
  currentUser,
  onOpenShortcuts,
  onLogout,
  showToast,
}: any) {
  const { t } = useTranslation();
  const [topologyMenuOpen, setTopologyMenuOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const topologyMenuRef = useRef<HTMLDivElement | null>(null);
  const syncMenuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const notifMenuRef = useRef<HTMLDivElement | null>(null);
  const [sidebarStyle, setSidebarStyle] = useState(() => {
    return storageService.getItem('gmao_sidebar_style') || 'floating';
  });

  // RBAC Capability Guards (NH-1)
  const canExportData =
    !currentUser ||
    AuthorizationService.hasPermission(currentUser, 'stock.export') ||
    AuthorizationService.hasPermission(currentUser, 'report.export');
  const canImportData =
    !currentUser ||
    AuthorizationService.hasPermission(currentUser, 'settings.restore') ||
    AuthorizationService.hasPermission(currentUser, 'settings.manage');
  const canDirectLinkOrSave =
    !currentUser ||
    (!AuthorizationService.isReadOnly(currentUser) &&
      (AuthorizationService.hasPermission(currentUser, 'settings.backup') ||
        AuthorizationService.hasPermission(currentUser, 'stock.export')));
  const canSyncServer =
    !currentUser ||
    (!AuthorizationService.isReadOnly(currentUser) &&
      (AuthorizationService.hasPermission(currentUser, 'settings.backup') ||
        AuthorizationService.hasPermission(currentUser, 'stock.export')));
  const canAccessSettings =
    !currentUser || AuthorizationService.canAccessTab(currentUser, 'settings');

  const [headerClockEnabled, setHeaderClockEnabled] = useState(() => {
    return storageService.getItem('gmao_header_clock') !== 'false';
  });

  useEffect(() => {
    const handleAppearanceChanged = (e) => {
      if (e?.detail?.headerClockEnabled !== undefined) {
        setHeaderClockEnabled(e.detail.headerClockEnabled);
      }
      if (e?.detail?.sidebarStyle !== undefined) {
        setSidebarStyle(e.detail.sidebarStyle);
      }
    };
    window.addEventListener('gmao_appearance_changed', handleAppearanceChanged);
    return () => window.removeEventListener('gmao_appearance_changed', handleAppearanceChanged);
  }, []);



  useEffect(() => {
    function handleClickOutside(event) {
      if (topologyMenuRef.current && !topologyMenuRef.current.contains(event.target)) {
        setTopologyMenuOpen(false);
      }
      if (syncMenuRef.current && !syncMenuRef.current.contains(event.target)) {
        setSyncMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setNotifMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const activeParent = getParentModuleForTab(currentTab);
  const childTabs = useMemo(() => {
    const rawChildren = activeParent.children || [];
    if (!currentUser) return rawChildren;
    return rawChildren.filter((c) => AuthorizationService.canAccessTab(currentUser, c.id));
  }, [activeParent, currentUser]);

  // Smart Dynamic Breadcrumbs Calculation (NH-8: RBAC-guarded links & NH-6: Corrective sub-routes)
  const breadcrumbs = useMemo(() => {
    const canGoTo = (tabId: string) =>
      !currentUser || AuthorizationService.canAccessTab(currentUser, tabId);

    // 1. MODULE: STOCK PDR & ITS SUB-PAGES
    if (activeParent.id === 'stock') {
      const rootCrumb = {
        id: 'stock-root',
        label: t('nav.stock', 'Stock PDR'),
        onClick: canGoTo('stock')
          ? () => {
              filters?.setStockTypeFilter?.('ALL');
              filters?.setStockSearch?.('');
              filters?.setDiagTypeFilter?.('ALL');
              setCurrentTab('stock');
            }
          : undefined,
        title: t('nav.stock', 'Retourner au Stock PDR (Réinitialiser les filtres)'),
      };

      if (currentTab === 'stock') {
        if (filters?.stockTypeFilter && filters.stockTypeFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'stock-type-filter',
              label: `${t('common.type', 'Type')}: ${filters.stockTypeFilter}`,
              onClick: canGoTo('types') ? () => setCurrentTab('types') : undefined,
              title: canGoTo('types')
                ? `${t('nav.subtabs.types', 'Types PDR')} (${filters.stockTypeFilter})`
                : `${t('common.type', 'Type')}: ${filters.stockTypeFilter}`,
            },
            {
              id: 'stock-articles',
              label: t('nav.subtabs.stock', 'Articles'),
              active: true,
            },
          ];
        }
        if (filters?.stockSearch) {
          return [
            rootCrumb,
            {
              id: 'stock-search-filter',
              label: `${t('common.reference', 'Réf')}: ${filters.stockSearch}`,
              onClick: () => filters?.setStockSearch?.(''),
              title: t('common.filters.reset', 'Effacer la recherche par référence'),
              active: true,
            },
          ];
        }
        return [
          {
            ...rootCrumb,
            label: t('nav.stock', 'Stock PDR'),
            active: false,
          },
          {
            id: 'stock-articles',
            label: t('nav.subtabs.stock', 'Stock Articles'),
            active: true,
          },
        ];
      }

      if (currentTab === 'types') {
        return [
          rootCrumb,
          {
            id: 'types-page',
            label: t('nav.subtabs.types', 'Types PDR'),
            active: true,
          },
        ];
      }

      if (currentTab === 'designations' || currentTab === 'diagnostics') {
        if (filters?.diagTypeFilter && filters.diagTypeFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'type-filtered-breadcrumb',
              label: `${t('common.type', 'Type')}: ${filters.diagTypeFilter}`,
              onClick: canGoTo('types') ? () => setCurrentTab('types') : undefined,
              title: canGoTo('types')
                ? `${t('nav.subtabs.types', 'Types PDR')} (${filters.diagTypeFilter})`
                : `${t('common.type', 'Type')}: ${filters.diagTypeFilter}`,
            },
            {
              id: 'designations-page',
              label: t('nav.subtabs.designations', 'Désignations'),
              active: true,
            },
          ];
        }
        return [
          rootCrumb,
          {
            id: 'designations-page',
            label: t('nav.subtabs.designations', 'Désignations PDR'),
            active: true,
          },
        ];
      }

      if (currentTab === 'sortie') {
        return [
          rootCrumb,
          {
            id: 'mouvements-page',
            label: t('nav.subtabs.sortie', 'Mouvements'),
            active: true,
          },
        ];
      }
    }

    // 2. MODULE: ENTREPÔT & ITS SUB-PAGES
    if (activeParent.id === 'entrepot') {
      const rootCrumb = {
        id: 'entrepot-root',
        label: t('nav.entrepot', 'Entrepôt'),
        onClick: canGoTo('entrepot')
          ? () => {
              filters?.setWhFamilyFilter?.('ALL');
              filters?.setWhTemplateFilter?.('ALL');
              filters?.setWhTypeFilter?.('ALL');
              filters?.setWhNatureFilter?.('ALL');
              filters?.setCompTemplateFamilyFilter?.('');
              filters?.setPartDesignationTypeFilter?.('');
              setCurrentTab('entrepot');
            }
          : undefined,
        title: t('nav.entrepot', "Aller à l'Entrepôt"),
      };

      if (currentTab === 'entrepot') {
        return [
          rootCrumb,
          { id: 'wh-stock', label: t('nav.subtabs.entrepot', 'Stock Entrepôt'), active: true },
        ];
      }
      if (currentTab === 'comp_groups') {
        return [
          rootCrumb,
          { id: 'comp-groups', label: t('nav.subtabs.comp_groups', 'Groupes Composants'), active: true },
        ];
      }
      if (currentTab === 'comp_families') {
        return [
          rootCrumb,
          { id: 'comp-families', label: t('nav.subtabs.comp_families', 'Familles Composants'), active: true },
        ];
      }
      if (currentTab === 'comp_templates') {
        if (filters?.compTemplateFamilyFilter) {
          return [
            rootCrumb,
            {
              id: 'comp-fam-link',
              label: `${t('nav.subtabs.families', 'Famille')}: ${filters.compTemplateFamilyFilter}`,
              onClick: canGoTo('comp_families') ? () => setCurrentTab('comp_families') : undefined,
              title: t('nav.subtabs.comp_families', 'Retourner aux Familles Composants'),
            },
            { id: 'comp-templates', label: t('nav.subtabs.comp_templates', 'Templates Composants'), active: true },
          ];
        }
        return [
          rootCrumb,
          { id: 'comp-templates', label: t('nav.subtabs.comp_templates', 'Templates Composants'), active: true },
        ];
      }
      if (currentTab === 'part_types') {
        return [
          rootCrumb,
          { id: 'part-types', label: t('nav.subtabs.part_types', 'Types Parts'), active: true },
        ];
      }
      if (currentTab === 'part_designations') {
        if (filters?.partDesignationTypeFilter) {
          return [
            rootCrumb,
            {
              id: 'part-type-link',
              label: `${t('common.type', 'Type')}: ${filters.partDesignationTypeFilter}`,
              onClick: canGoTo('part_types') ? () => setCurrentTab('part_types') : undefined,
              title: t('nav.subtabs.part_types', 'Retourner aux Types Parts'),
            },
            { id: 'part-designations', label: t('nav.subtabs.part_designations', 'Désignations Parts'), active: true },
          ];
        }
        return [
          rootCrumb,
          { id: 'part-designations', label: t('nav.subtabs.part_designations', 'Désignations Parts'), active: true },
        ];
      }
    }

    // 3. MODULE: MACHINES & ITS SUB-PAGES
    if (activeParent.id === 'machines') {
      const rootCrumb = {
        id: 'machines-root',
        label: t('nav.machines', 'Machines'),
        onClick: canGoTo('machines')
          ? () => {
              filters?.setMchFamilyFilter?.('ALL');
              filters?.setMchTemplateFilter?.('ALL');
              filters?.setTemplateFamilyFilter?.('ALL');
              setCurrentTab('machines');
            }
          : undefined,
        title: t('nav.machines', 'Aller aux Machines'),
      };

      if (currentTab === 'machines') {
        if (filters?.mchFamilyFilter && filters.mchFamilyFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'mch-fam-link',
              label: `${t('nav.subtabs.families', 'Famille')}: ${filters.mchFamilyFilter}`,
              onClick: canGoTo('families') ? () => setCurrentTab('families') : undefined,
              title: canGoTo('families') ? t('nav.subtabs.families', 'Voir la Famille') : `${t('nav.subtabs.families', 'Famille')}: ${filters.mchFamilyFilter}`,
            },
            { id: 'mch-list', label: t('nav.subtabs.machines', 'Machines Registered'), active: true },
          ];
        }
        return [
          rootCrumb,
          { id: 'mch-list', label: t('nav.subtabs.machines', 'Machines Registered'), active: true },
        ];
      }
      if (currentTab === 'families') {
        return [rootCrumb, { id: 'mch-fam', label: t('nav.subtabs.families', 'Familles'), active: true }];
      }
      if (currentTab === 'templates') {
        if (filters?.templateFamilyFilter && filters.templateFamilyFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'tmpl-fam-link',
              label: `${t('nav.subtabs.families', 'Famille')}: ${filters.templateFamilyFilter}`,
              onClick: canGoTo('families') ? () => setCurrentTab('families') : undefined,
              title: canGoTo('families')
                ? t('nav.subtabs.families', 'Retourner aux Familles')
                : `${t('nav.subtabs.families', 'Famille')}: ${filters.templateFamilyFilter}`,
            },
            { id: 'tmpl-list', label: t('nav.subtabs.templates', 'Templates'), active: true },
          ];
        }
        return [rootCrumb, { id: 'tmpl-list', label: t('nav.subtabs.templates', 'Templates'), active: true }];
      }
      if (currentTab === 'blueprints') {
        return [rootCrumb, { id: 'mch-blueprints', label: t('nav.subtabs.blueprints', 'Blueprints'), active: true }];
      }
    }

    // 4. MODULE: CORRECTIVE SUB-TABS (NH-6 & NH-10)
    if (
      activeParent.id === 'corrective' &&
      String(currentTab || '').startsWith('corrective_') &&
      currentTab !== 'corrective_referentiel'
    ) {
      const subTabLabels: Record<string, string> = {
        corrective_di: t('nav.subtabs.corrective_di', 'Demandes (DI)'),
        corrective_bt: t('nav.subtabs.corrective_bt', 'Bons de Travail (BT)'),
        corrective_live: t('nav.subtabs.corrective_live', 'Intervention Live'),
        corrective_cloture: t('nav.subtabs.corrective_cloture', 'Clôture & Rapports'),
        corrective_analytics: t('nav.subtabs.corrective_analytics', 'Analytique & Pareto'),
        corrective_history: t('nav.subtabs.corrective_history', 'Historique'),
        corrective_pieces: t('nav.subtabs.corrective_pieces', 'Pièces Consommées'),
      };
      const parentLabel = t(`nav.${activeParent.id}`, activeParent.label);
      return [
        {
          id: 'corrective-parent',
          label: parentLabel,
          onClick: canGoTo('corrective') ? () => setCurrentTab('corrective') : undefined,
          title: parentLabel,
        },
        {
          id: `${currentTab}-child`,
          label: subTabLabels[currentTab] || t('nav.subtabs.corrective', 'Correctif Hub'),
          active: true,
        },
      ];
    }

    // 5. OTHER MODULES & FALLBACK (NH-7: Only navigate to allowed child & NH-10: Localized)
    const activeChild = childTabs.find((c) => c.id === currentTab);
    const parentLabel = t(`nav.${activeParent.id}`, activeParent.label);
    if (activeChild && activeChild.label !== activeParent.label) {
      const firstAllowedChild = childTabs[0]?.id;
      const childLabel = t(`nav.subtabs.${activeChild.id}`, activeChild.label);
      return [
        {
          id: `${activeParent.id}-parent`,
          label: parentLabel,
          onClick: firstAllowedChild ? () => setCurrentTab(firstAllowedChild) : undefined,
          title: parentLabel,
        },
        {
          id: `${activeChild.id}-child`,
          label: childLabel,
          active: true,
        },
      ];
    }

    return [
      {
        id: `${activeParent.id}-current`,
        label: parentLabel,
        active: true,
      },
    ];
  }, [activeParent, currentTab, setCurrentTab, childTabs, filters, currentUser, t]);

  const onExportWithTracking = () => {
    if (!canExportData) return;
    analytics.track('excel_exported', 'excel', { timestamp: Date.now() });
    handleExportExcel?.();
  };

  const onImportWithTracking = (e) => {
    if (!canImportData) return;
    analytics.track('excel_imported', 'excel', { fileName: e.target.files?.[0]?.name });
    handleImportFile?.(e);
  };

  const onSaveWithTracking = () => {
    if (!canDirectLinkOrSave) return;
    analytics.track('excel_direct_save', 'excel', { fileName: linkedFileName });
    onDirectSave?.();
  };

  const handleEnableBrowserNotifications = async () => {
    if (notificationService.isSupported()) {
      const perm = await notificationService.requestPermission();
      if (perm === 'granted') {
        notificationService.notify('🔔 Notifications CIOB GMAO', {
          body: 'Les notifications d’alertes de stock et de sauvegarde sont maintenant actives.',
        });
        showToast?.(t('header.notifications_enabled_toast', 'Notifications système actives'), 'success');
        setNotifMenuOpen(false);
        return;
      }
    }
    showToast?.(t('header.notifications_enabled_toast', 'Notifications système actives'), 'info');
    setNotifMenuOpen(false);
  };

  const handleChildTabKeyDown = (e, index) => {
    if (childTabs.length === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIdx = (index + 1) % childTabs.length;
      setCurrentTab(childTabs[nextIdx].id);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIdx = (index - 1 + childTabs.length) % childTabs.length;
      setCurrentTab(childTabs[prevIdx].id);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCurrentTab(childTabs[0].id);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCurrentTab(childTabs[childTabs.length - 1].id);
    }
  };

  const isStandardFixed = sidebarStyle === 'standard';

  return (
    <header
      role="banner"
      className={`sticky select-none transition-all ${
        isStandardFixed
          ? 'top-0 z-30 w-full lg:w-[calc(100%-270px)] lg:ml-[270px] bg-white/95 backdrop-blur-md border-b border-zinc-200/90 shadow-2xs my-0 rounded-none h-16 flex items-center'
          : 'top-2 sm:top-3 z-30 w-[calc(100%-0.75rem)] sm:w-[calc(100%-1.25rem)] lg:w-[calc(100%-2rem)] xl:w-[calc(100%-2.5rem)] 2xl:w-[calc(100%-3rem)] max-w-[2200px] mx-auto rounded-[22px] sm:rounded-full bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] my-2 sm:my-3 overflow-visible'
      }`}
    >
      <div className={`flex items-center justify-between gap-1.5 sm:gap-2.5 w-full min-w-0 ${isStandardFixed ? 'px-4 sm:px-6 py-0' : 'px-2.5 sm:px-4 py-1.5 sm:py-2'}`}>
        {/* Left: Brand Capsule & Breadcrumbs (Clean & De-duplicated in Fixed Mode) */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
          {/* Menu Drawer Button: visible exclusively on mobile/tablet (drawer); hidden on desktop where sidebar (fixed or floating dock) is already active */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex lg:hidden w-8 h-8 rounded-full bg-white border border-zinc-200/90 items-center justify-center text-zinc-700 hover:text-black hover:border-zinc-300 shadow-xs hover:shadow-md cursor-pointer transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
            aria-label="Ouvrir le menu de navigation complet"
            title="Menu complet des modules et sections (Toutes les pages)"
            aria-haspopup="dialog"
          >
            <Menu size={15} />
          </button>

          {/* Brand Capsule Pill: Only shown in Floating Mode (In Fixed mode, sidebar already has the brand logo & title) */}
          {!isStandardFixed && (
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2 px-1.5 xl:px-2.5 py-1 rounded-full bg-white border border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-emerald-300 hover:shadow-[0_4px_14px_rgba(16,185,129,0.12)] transition-all cursor-pointer shrink-0 group focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              title="CIOB GMAO Light - Dashboard"
              aria-label="Tableau de bord CIOB GMAO Light"
            >
              {/* Dedicated 3D-styled green Excel workbook SVG Icon */}
              <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-xs shrink-0 ring-2 ring-emerald-500/20 overflow-hidden group-hover:scale-105 transition-transform">
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4px_4px]" />
                <svg
                  className="w-3.5 h-3.5 text-white relative z-10"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3.5"
                    fill="currentColor"
                    fillOpacity="0.15"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  />
                  <line
                    x1="9.5"
                    y1="3"
                    x2="9.5"
                    y2="21"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeOpacity="0.6"
                    strokeDasharray="1.5 1.5"
                  />
                  <line
                    x1="3"
                    y1="9.5"
                    x2="21"
                    y2="9.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeOpacity="0.6"
                    strokeDasharray="1.5 1.5"
                  />
                  <line
                    x1="3"
                    y1="15.5"
                    x2="21"
                    y2="15.5"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeOpacity="0.6"
                    strokeDasharray="1.5 1.5"
                  />
                  <path
                    d="M12.5 7.5L18 16.5M18 7.5L12.5 16.5"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <rect x="5" y="6" width="3" height="1.8" rx="0.5" fill="currentColor" />
                  <rect x="5" y="11" width="3" height="1.8" rx="0.5" fill="currentColor" />
                  <rect x="5" y="16" width="3" height="1.8" rx="0.5" fill="currentColor" />
                </svg>
              </div>

              {/* Brand Title & Subtitle */}
              <div className="text-left leading-tight pr-0.5 hidden xl:block">
                <div className="font-bold text-[12px] tracking-tight text-zinc-900 flex items-center gap-1">
                  <span>Ciob PDR</span>
                  <span className="text-[8.5px] font-extrabold uppercase px-1 py-0.1 rounded-md bg-emerald-500/15 text-emerald-700 border border-emerald-500/25">
                    XLS
                  </span>
                </div>
                <div className="hidden 2xl:block text-[9.5px] font-semibold text-emerald-700 tracking-tight truncate max-w-[115px]">
                  Pièces de Rechange
                </div>
              </div>
            </button>
          )}

          {/* Smart Breadcrumb Navigation Capsule */}
          <div
            className={`flex items-center gap-1.5 min-w-0 shrink max-w-[140px] lg:max-w-[180px] xl:max-w-[240px] 2xl:max-w-[360px] ${
              isStandardFixed
                ? 'px-2.5 py-1 rounded-lg bg-zinc-100/80 border border-zinc-200/70 text-xs shadow-none'
                : 'hidden md:flex px-2.5 py-1 rounded-full bg-white border border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
            }`}
            role="navigation"
            aria-label="Fil d'Ariane intelligent (Breadcrumbs)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" aria-hidden="true" />
            <ol className="flex items-center gap-1.5 text-xs tracking-tight truncate m-0 p-0 list-none">
              {breadcrumbs.map((crumb, idx) => {
                const isLast = idx === breadcrumbs.length - 1;
                return (
                  <li key={`${crumb.id || 'crumb'}-${idx}`} className="inline-flex items-center gap-1.5 min-w-0">
                    {idx > 0 && (
                      <span className="text-zinc-300 font-normal select-none shrink-0" aria-hidden="true">
                        /
                      </span>
                    )}
                    {crumb.onClick && !isLast ? (
                      <button
                        type="button"
                        onClick={crumb.onClick}
                        title={crumb.title || `Aller à ${crumb.label}`}
                        className="text-zinc-500 hover:text-emerald-700 hover:underline font-semibold cursor-pointer truncate transition-colors focus-visible:outline-hidden"
                      >
                        {crumb.label}
                      </button>
                    ) : (
                      <span
                        className={`truncate ${
                          isLast
                            ? 'font-bold text-zinc-900'
                            : 'font-semibold text-zinc-600'
                        }`}
                        title={crumb.label}
                      >
                        {crumb.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        {/* Center: Scrollable Responsive Sub-Tabs Navigation with Overflow Affordance */}
        <nav
          role="navigation"
          aria-label="Sous-onglets de navigation"
          className="flex items-center justify-center flex-1 min-w-0 mx-1 sm:mx-1.5 overflow-hidden gap-1"
        >
          {childTabs.length > 0 && (
            <>
              {childTabs.length >= 4 && (
                <button
                  type="button"
                  onClick={(e) => {
                    const container = e.currentTarget.parentElement?.querySelector('[role="tablist"]');
                    container?.scrollBy({ left: -160, behavior: 'smooth' });
                  }}
                  className="hidden md:flex 2xl:hidden w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 items-center justify-center text-zinc-600 hover:text-zinc-900 shrink-0 cursor-pointer transition"
                  title="Faire défiler les onglets vers la gauche"
                  aria-label="Défiler les onglets vers la gauche"
                >
                  <ChevronLeft size={13} />
                </button>
              )}
              <div
                role="tablist"
                aria-label={activeParent.label}
                className="inline-flex items-center p-1 rounded-full bg-[#EFEFEE] border border-[#E5E5E3] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06),0_2px_10px_rgba(0,0,0,0.03)] overflow-x-auto max-w-full scrollbar-none no-scrollbar flex-nowrap shrink min-w-0 gap-0.5 sm:gap-1 scroll-smooth"
              >
                {childTabs.map((child, index) => {
                  const isActive =
                    currentTab === child.id ||
                    (child.id === 'designations' && currentTab === 'diagnostics') ||
                    (child.id === 'corrective' &&
                      String(currentTab || '').startsWith('corrective_') &&
                      currentTab !== 'corrective_referentiel');
                  const isTech = isTechnicianRole(currentUser);
                  const totalPendingValidation =
                    Number(counts?.pendingSortieDemands || 0) +
                    Number(counts?.pendingPreventiveValidation || 0) +
                    Number(counts?.pendingCorrectiveValidation || 0);
                  const childPending = !isTech
                    ? child.id === 'validation_center'
                      ? totalPendingValidation
                      : child.id === 'sortie'
                      ? Number(counts?.pendingSortieDemands || 0)
                      : child.id === 'preventive'
                      ? Number(counts?.pendingPreventiveValidation || 0)
                      : child.id === 'corrective'
                      ? Number(counts?.pendingCorrectiveValidation || 0)
                      : 0
                    : 0;
                  return (
                    <button
                      key={child.id}
                      role="tab"
                      id={`tab-${child.id}`}
                      aria-selected={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      tabIndex={isActive ? 0 : -1}
                      onKeyDown={(e) => handleChildTabKeyDown(e, index)}
                      onClick={() => setCurrentTab(child.id)}
                      className={`whitespace-nowrap px-2.5 lg:px-3 xl:px-3.5 py-1 rounded-full text-[11px] lg:text-[12px] font-semibold transition-all duration-200 cursor-pointer shrink-0 inline-flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
                        isActive
                          ? 'bg-[#111111] text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] scale-[1.02]'
                          : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/60'
                      }`}
                    >
                      <span>{t(`nav.subtabs.${child.id}`, child.label)}</span>
                      {childPending > 0 && (
                        <span
                          className="px-1.5 py-0.2 rounded-full bg-rose-600 text-white text-[10px] font-black font-mono leading-tight"
                          title={`${childPending} ${t('header.to_validate', 'À valider')}`}
                        >
                          {childPending}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {childTabs.length >= 4 && (
                <button
                  type="button"
                  onClick={(e) => {
                    const container = e.currentTarget.parentElement?.querySelector('[role="tablist"]');
                    container?.scrollBy({ left: 160, behavior: 'smooth' });
                  }}
                  className="hidden md:flex 2xl:hidden w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200/80 items-center justify-center text-zinc-600 hover:text-zinc-900 shrink-0 cursor-pointer transition"
                  title="Faire défiler les onglets vers la droite"
                  aria-label="Défiler les onglets vers la droite"
                >
                  <ChevronRight size={13} />
                </button>
              )}
            </>
          )}
        </nav>

        {/* Right: Actions & Tools (De-duplicated in fixed mode) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {!isTechnicianRole(currentUser) &&
            (!currentUser || AuthorizationService.canAccessTab(currentUser, 'validation_center')) && (() => {
              const totalPending =
                Number(counts?.pendingSortieDemands || 0) +
                Number(counts?.pendingPreventiveValidation || 0) +
                Number(counts?.pendingCorrectiveValidation || 0);
              const isValidationCenterActive = currentTab === 'validation_center';
              return (
                <button
                  type="button"
                  onClick={() => setCurrentTab('validation_center')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-extrabold transition cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
                    isValidationCenterActive
                      ? 'bg-slate-900 text-white border border-slate-900 shadow-sm'
                      : totalPending > 0
                      ? 'bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 shadow-[0_2px_6px_rgba(225,29,72,0.12)]'
                      : 'bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-slate-700'
                  }`}
                  title={t('header.open_validation_center', 'Ouvrir le Centre de Validation unifié (Maker-Checker)')}
                  aria-label={`Centre de validation : ${totalPending} élément(s) à valider`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      totalPending > 0 ? 'bg-rose-600 animate-pulse' : 'bg-emerald-500'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="hidden 2xl:inline text-[11px] tracking-tight">{t('header.to_validate', 'À valider')}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono leading-tight ${
                      isValidationCenterActive
                        ? 'bg-white/20 text-white'
                        : totalPending > 0
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {totalPending}
                  </span>
                </button>
              );
            })()}

          {canImportData && (
            <input
              type="file"
              ref={fileInputRef}
              onChange={onImportWithTracking}
              accept=".json,.xlsx,.xls"
              className="hidden"
              aria-label={t('header.import_excel', 'Importer un fichier JSON ou Excel')}
            />
          )}

          {/* Direct Link / Direct Save Button - Icon-Only in Emerald Theme (RBAC Guarded) */}
          {canDirectLinkOrSave && (
            linkedFileName ? (
              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/90 shadow-2xs truncate max-w-[130px]"
                  title={`${t('header.linked_file', 'Fichier lié')} : ${linkedFileName}`}
                  aria-label={`${t('header.linked_file', 'Fichier lié')} : ${linkedFileName}`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span className="truncate">{linkedFileName}</span>
                </span>
                <button
                  onClick={onSaveWithTracking}
                  className="w-8 h-8 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center transition shadow-[0_2px_8px_rgba(4,120,87,0.25)] cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
                  title={`${t('header.save_to_excel', 'Enregistrer vers Excel')} (${linkedFileName})`}
                  aria-label="Sauvegarder dans le fichier Excel lié"
                >
                  <Save size={15} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                onClick={onDirectLink}
                className="w-8 h-8 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 flex items-center justify-center text-emerald-700 hover:text-emerald-900 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
                title={t('header.link_excel', 'Lier un fichier Excel (.xlsx)')}
                aria-label="Lier directement un fichier Excel .xlsx"
              >
                <Link size={15} className="text-emerald-600 shrink-0" aria-hidden="true" />
              </button>
            )
          )}

          <PWAInstallButton variant="header" />

          {/* Explicit Server Sync Capsule & Popover Menu (RBAC Guarded) */}
          {canSyncServer && (
            <div className="relative shrink-0" ref={syncMenuRef}>
              <button
                type="button"
                onClick={() => setSyncMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-full bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-200/90 text-emerald-800 text-xs font-bold transition shadow-[0_2px_6px_rgba(4,120,87,0.08)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden group"
                title={t('header.sync_server', 'Synchronisation Serveur (Sauvegarde / Restauration)')}
                aria-label="Synchronisation Serveur gmao_state.json"
                aria-expanded={syncMenuOpen}
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                <Cloud size={14} className="text-emerald-700 group-hover:scale-110 transition-transform shrink-0" />
                <span className="hidden 2xl:inline text-[11px] font-extrabold tracking-tight">{t('header.sync_server', 'Sync Serveur')}</span>
                <ChevronDown
                  size={12}
                  className={`text-emerald-600 transition-transform duration-200 shrink-0 ${syncMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {syncMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <SyncButtons
                    variant="dropdown"
                    showToast={showToast}
                    onCloseDropdown={() => setSyncMenuOpen(false)}
                  />
                </div>
              )}
            </div>
          )}

          {/* Live Industrial Shift Clock (Configurable via Appearance — NH-9 isolated 1Hz component) */}
          {headerClockEnabled && <HeaderShiftClock tooltip={t('header.clock_tooltip', 'Horloge de poste industrielle (Temps Réel)')} />}

          {/* Offline Language Switcher (Fixed-width trigger + floating popover — NH-13) */}
          <LanguageSwitcher />

          {/* Export Excel Dropdown Menu - Only in Floating Mode & RBAC Guarded (Fixed sidebar already has Export button) */}
          {!isStandardFixed && canExportData && (
            <div className="relative hidden sm:block shrink-0" ref={topologyMenuRef}>
              <button
                onClick={() => setTopologyMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden group"
                title={t('header.export_excel', 'Exporter Excel & 3-Workbook Topology')}
                aria-label="Menu d'exportation Excel et topologie industrielle"
                aria-expanded={topologyMenuOpen}
              >
                <Download size={14} className="text-emerald-400 group-hover:scale-110 transition-transform shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-mono tracking-tight text-slate-100 hidden xl:inline">{t('header.export_short', 'Export')}</span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 shrink-0 ${topologyMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {topologyMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 mb-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                      3-Workbook Topology Hub
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {t('header.topology_hub_subtitle', 'Exportation des données industrielles')}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setTopologyMenuOpen(false);
                      onExportWithTracking();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-emerald-50/70 flex items-start gap-2.5 transition group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition">
                      <FileSpreadsheet size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-800">
                        {t('header.workbook_full_title', 'Modèle Complet GMAO (.xlsx)')}
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        {t('header.workbook_full_desc', 'Classeur maître avec formules vivantes et KPIs')}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTopologyMenuOpen(false);
                      exportMasterTopologyWorkbook?.();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-blue-50/70 flex items-start gap-2.5 transition group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition">
                      <Layers size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-800">
                        Classeur 1 : GMAO_Topology_Master
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        6 feuilles (Zones, Machines, Staff, BOM...)
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTopologyMenuOpen(false);
                      exportInventoryMaterialsWorkbook?.();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-amber-50/70 flex items-start gap-2.5 transition group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition">
                      <Boxes size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-amber-800">
                        Classeur 2 : GMAO_Inventory_Materials
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        3 feuilles (PDR, Warehouse, Part Types)
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setTopologyMenuOpen(false);
                      exportMovementsUnifiedWorkbook?.();
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-purple-50/70 flex items-start gap-2.5 transition group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition">
                      <Truck size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-purple-800">
                        Classeur 3 : GMAO_Movements_Unified
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        2 feuilles (Mouvements, Sortie Externe)
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Import JSON/Excel Button - Only in Floating Mode & RBAC Guarded (Fixed sidebar already has Import button) */}
          {!isStandardFixed && canImportData && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex w-8 h-8 rounded-full bg-white border border-zinc-200 items-center justify-center text-zinc-600 hover:text-black hover:border-zinc-300 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              title={t('header.import_excel', 'Importer JSON / Excel')}
              aria-label="Importer un fichier de données JSON ou Excel"
            >
              <Upload size={15} aria-hidden="true" />
            </button>
          )}

          {/* 1-Click ShellPolicy Switcher (Auto / Desktop / Mobile) */}
          <div className="hidden md:block shrink-0">
            <ShellModeSwitcher compact />
          </div>

          <button
            onClick={onOpenShortcuts}
            className="hidden lg:flex w-8 h-8 rounded-full bg-white border border-zinc-200 items-center justify-center text-zinc-600 hover:text-black hover:border-zinc-300 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
            title={t('header.shortcuts', 'Raccourcis clavier (F1)')}
            aria-label="Afficher la liste des raccourcis clavier"
          >
            <Keyboard size={15} aria-hidden="true" />
          </button>

          {/* NH-12: Interactive Notification Bell & Alert Status Popover */}
          {(() => {
            const isTech = isTechnicianRole(currentUser);
            const totalPendingAlerts = !isTech
              ? Number(counts?.pendingSortieDemands || 0) +
                Number(counts?.pendingPreventiveValidation || 0) +
                Number(counts?.pendingCorrectiveValidation || 0)
              : 0;
            const canOpenValidation =
              !isTech &&
              (!currentUser || AuthorizationService.canAccessTab(currentUser, 'validation_center'));
            return (
              <div className="relative shrink-0" ref={notifMenuRef}>
                <button
                  type="button"
                  onClick={() => setNotifMenuOpen((prev) => !prev)}
                  aria-expanded={notifMenuOpen}
                  aria-haspopup="menu"
                  className="w-8 h-8 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-black hover:border-zinc-300 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md relative cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
                  title={
                    totalPendingAlerts > 0
                      ? t('header.notifications_pending', `${totalPendingAlerts} élément(s) en attente de validation`, { count: totalPendingAlerts })
                      : t('header.notifications_title', "Centre d'alertes & notifications")
                  }
                  aria-label={t('header.notifications_title', "Centre d'alertes & notifications")}
                >
                  <Bell size={15} aria-hidden="true" />
                  <span
                    className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-white ${
                      totalPendingAlerts > 0 ? 'bg-rose-600 animate-pulse' : 'bg-emerald-500'
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {notifMenuOpen && (
                  <div
                    role="menu"
                    aria-label={t('header.notifications_title', "Centre d'alertes & notifications")}
                    className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-2.5"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-extrabold text-slate-900">
                        {t('header.notifications_title', "Centre d'alertes & notifications")}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold font-mono ${
                          totalPendingAlerts > 0
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {totalPendingAlerts > 0 ? totalPendingAlerts : 'OK'}
                      </span>
                    </div>

                    {totalPendingAlerts > 0 ? (
                      <div className="rounded-xl bg-rose-50/80 border border-rose-200/80 p-2.5 space-y-2">
                        <div className="text-[11.5px] font-bold text-rose-900">
                          {t('header.notifications_pending', `${totalPendingAlerts} élément(s) en attente de validation`, { count: totalPendingAlerts })}
                        </div>
                        {canOpenValidation && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotifMenuOpen(false);
                              setCurrentTab('validation_center');
                            }}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold transition cursor-pointer"
                          >
                            {t('header.open_validation_center', 'Ouvrir le Centre de Validation')}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200/70 p-2.5 text-[11.5px] font-semibold text-emerald-800 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>{t('header.notifications_all_clear', 'Aucune alerte de validation en attente')}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleEnableBrowserNotifications}
                      className="w-full py-1.5 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Bell size={13} className="text-emerald-600 shrink-0" />
                      <span>{t('header.notifications_enable_browser', 'Activer les alertes navigateur')}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* User Profile Account Card Pill & Popover Menu (NH-3: Interactive for all roles with Logout & guarded Settings) */}
          {!isStandardFixed && (
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                aria-expanded={userMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white border border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-emerald-300 hover:shadow-[0_4px_14px_rgba(16,185,129,0.12)] transition-all cursor-pointer shrink-0 group focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
                title={
                  currentUser?.personnelId
                    ? `${currentUser.name} (${currentUser.personnelId})`
                    : 'Mon Compte'
                }
                aria-label={`Compte utilisateur de ${currentUser?.name || 'Administrateur'}`}
              >
                {/* Rounded Emerald Avatar Icon matching sidebar */}
                <div
                  className="w-6.5 h-6.5 rounded-lg bg-emerald-700 text-white font-extrabold text-[10px] flex items-center justify-center shadow-2xs shrink-0 group-hover:scale-105 transition-transform"
                  aria-hidden="true"
                >
                  {currentUser?.avatar || 'RM'}
                </div>
                {/* User Name & Role matching sidebar typography */}
                <div className="hidden 2xl:block text-left leading-tight min-w-0 pr-0.5">
                  <div className="text-[11.5px] font-bold text-slate-900 truncate flex items-center gap-1">
                    <span>{currentUser?.name || 'Administrateur'}</span>
                    {currentUser?.personnelId && (
                      <span className="text-[9.5px] font-mono text-blue-700 bg-blue-50 px-1 rounded border border-blue-200">
                        {currentUser.personnelId}
                      </span>
                    )}
                  </div>
                  <div className="text-[9.5px] font-semibold text-emerald-700 truncate">
                    {currentUser?.titleFr || currentUser?.role || 'Administrateur'}
                  </div>
                </div>
                <ChevronDown
                  size={12}
                  className={`text-slate-400 transition-transform duration-200 hidden sm:block shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  aria-label="Menu du compte utilisateur"
                  className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                >
                  <div className="px-3.5 py-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center shadow-xs shrink-0">
                        {currentUser?.avatar || 'RM'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-extrabold text-slate-900 truncate flex items-center gap-1">
                          <span className="truncate">{currentUser?.name || 'Administrateur'}</span>
                          {currentUser?.personnelId && (
                            <span className="text-[9.5px] font-mono text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200 shrink-0">
                              {currentUser.personnelId}
                            </span>
                          )}
                        </div>
                        <div className="text-[10.5px] font-semibold text-emerald-700 truncate mt-0.5 flex items-center gap-1">
                          <ShieldCheck size={11} className="shrink-0" />
                          <span className="truncate">{currentUser?.titleFr || currentUser?.role || 'Administrateur'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="py-1 px-1.5 space-y-0.5">
                    {canAccessSettings && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          setCurrentTab('settings');
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-100 flex items-center gap-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition cursor-pointer"
                      >
                        <Settings size={14} className="text-slate-500 shrink-0" />
                        <span>{t('header.settings_security', 'Paramètres & Sécurité')}</span>
                      </button>
                    )}

                    {onOpenShortcuts && (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenShortcuts();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-slate-100 flex items-center gap-2.5 text-xs font-semibold text-slate-700 hover:text-slate-900 transition cursor-pointer"
                      >
                        <Keyboard size={14} className="text-slate-500 shrink-0" />
                        <span>{t('header.shortcuts', 'Raccourcis clavier (F1)')}</span>
                      </button>
                    )}
                  </div>

                  {onLogout && (
                    <div className="pt-1 mt-1 border-t border-slate-100 px-1.5">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full px-2.5 py-2 rounded-xl text-left hover:bg-rose-50 flex items-center gap-2.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition cursor-pointer"
                      >
                        <LogOut size={14} className="text-rose-600 shrink-0" />
                        <span>{t('nav.logout', 'Déconnexion')}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
