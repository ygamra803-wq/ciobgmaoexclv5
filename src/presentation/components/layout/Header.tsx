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
  Layers,
  Boxes,
  Truck,
  Clock,
  Cloud
} from 'lucide-react';
import PWAInstallButton from '../common/PWAInstallButton';
import LanguageSwitcher from '../common/LanguageSwitcher';
import SyncButtons from '../common/SyncButtons';
import { analytics } from '../../../services/AnalyticsService';
import { notificationService } from '../../../services/NotificationService';
import { getParentModuleForTab } from './navConfig';
import { storageService } from '../../../utils/storageService';

export default function Header({
  currentTab,
  setCurrentTab,
  filters,
  _navigation,
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
  showToast,
}) {
  const [topologyMenuOpen, setTopologyMenuOpen] = useState(false);
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);
  const topologyMenuRef = useRef(null);
  const syncMenuRef = useRef(null);
  const [sidebarStyle, setSidebarStyle] = useState(() => {
    return storageService.getItem('gmao_sidebar_style') || 'floating';
  });

  const [headerClockEnabled, setHeaderClockEnabled] = useState(() => {
    return storageService.getItem('gmao_header_clock') !== 'false';
  });

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
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const activeParent = getParentModuleForTab(currentTab);
  const childTabs = activeParent.children || [];

  // Smart Dynamic Breadcrumbs Calculation
  const breadcrumbs = useMemo(() => {
    // 1. MODULE: STOCK PDR & ITS SUB-PAGES
    if (activeParent.id === 'stock') {
      const rootCrumb = {
        id: 'stock-root',
        label: 'Stock PDR',
        onClick: () => {
          filters?.setStockTypeFilter?.('ALL');
          filters?.setStockSearch?.('');
          filters?.setDiagTypeFilter?.('ALL');
          setCurrentTab('stock');
        },
        title: 'Retourner au Stock PDR (Réinitialiser les filtres)',
      };

      if (currentTab === 'stock') {
        if (filters?.stockTypeFilter && filters.stockTypeFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'stock-type-filter',
              label: `Type: ${filters.stockTypeFilter}`,
              onClick: () => setCurrentTab('types'),
              title: `Aller à Types PDR (${filters.stockTypeFilter})`,
            },
            {
              id: 'stock-articles',
              label: 'Articles',
              active: true,
            },
          ];
        }
        if (filters?.stockSearch) {
          return [
            rootCrumb,
            {
              id: 'stock-search-filter',
              label: `Réf: ${filters.stockSearch}`,
              onClick: () => filters?.setStockSearch?.(''),
              title: 'Effacer la recherche par référence',
              active: true,
            },
          ];
        }
        return [
          {
            ...rootCrumb,
            label: 'Stock PDR',
            active: false,
          },
          {
            id: 'stock-articles',
            label: 'Stock Articles',
            active: true,
          },
        ];
      }

      if (currentTab === 'types') {
        return [
          rootCrumb,
          {
            id: 'types-page',
            label: 'Types PDR',
            active: true,
          },
        ];
      }

      if (currentTab === 'designations') {
        if (filters?.diagTypeFilter && filters.diagTypeFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'type-filtered-breadcrumb',
              label: `Type: ${filters.diagTypeFilter}`,
              onClick: () => {
                setCurrentTab('types');
              },
              title: `Retourner à Types PDR (${filters.diagTypeFilter})`,
            },
            {
              id: 'designations-page',
              label: 'Désignations',
              active: true,
            },
          ];
        }
        return [
          rootCrumb,
          {
            id: 'designations-page',
            label: 'Désignations PDR',
            active: true,
          },
        ];
      }

      if (currentTab === 'sortie') {
        return [
          rootCrumb,
          {
            id: 'mouvements-page',
            label: 'Mouvements',
            active: true,
          },
        ];
      }
    }

    // 2. MODULE: ENTREPÔT & ITS SUB-PAGES
    if (activeParent.id === 'entrepot') {
      const rootCrumb = {
        id: 'entrepot-root',
        label: 'Entrepôt',
        onClick: () => {
          filters?.setWhFamilyFilter?.('ALL');
          filters?.setWhTemplateFilter?.('ALL');
          filters?.setWhTypeFilter?.('ALL');
          filters?.setWhNatureFilter?.('ALL');
          filters?.setCompTemplateFamilyFilter?.('');
          filters?.setPartDesignationTypeFilter?.('');
          setCurrentTab('entrepot');
        },
        title: "Aller à l'Entrepôt",
      };

      if (currentTab === 'entrepot') {
        return [
          rootCrumb,
          { id: 'wh-stock', label: 'Stock Entrepôt', active: true },
        ];
      }
      if (currentTab === 'comp_groups') {
        return [
          rootCrumb,
          { id: 'comp-groups', label: 'Groupes Composants', active: true },
        ];
      }
      if (currentTab === 'comp_families') {
        return [
          rootCrumb,
          { id: 'comp-families', label: 'Familles Composants', active: true },
        ];
      }
      if (currentTab === 'comp_templates') {
        if (filters?.compTemplateFamilyFilter) {
          return [
            rootCrumb,
            {
              id: 'comp-fam-link',
              label: `Famille: ${filters.compTemplateFamilyFilter}`,
              onClick: () => setCurrentTab('comp_families'),
              title: 'Retourner aux Familles Composants',
            },
            { id: 'comp-templates', label: 'Templates Composants', active: true },
          ];
        }
        return [
          rootCrumb,
          { id: 'comp-templates', label: 'Templates Composants', active: true },
        ];
      }
      if (currentTab === 'part_types') {
        return [
          rootCrumb,
          { id: 'part-types', label: 'Types Parts', active: true },
        ];
      }
      if (currentTab === 'part_designations') {
        if (filters?.partDesignationTypeFilter) {
          return [
            rootCrumb,
            {
              id: 'part-type-link',
              label: `Type: ${filters.partDesignationTypeFilter}`,
              onClick: () => setCurrentTab('part_types'),
              title: 'Retourner aux Types Parts',
            },
            { id: 'part-designations', label: 'Désignations Parts', active: true },
          ];
        }
        return [
          rootCrumb,
          { id: 'part-designations', label: 'Désignations Parts', active: true },
        ];
      }
    }

    // 3. MODULE: MACHINES & ITS SUB-PAGES
    if (activeParent.id === 'machines') {
      const rootCrumb = {
        id: 'machines-root',
        label: 'Machines',
        onClick: () => {
          filters?.setMchFamilyFilter?.('ALL');
          filters?.setMchTemplateFilter?.('ALL');
          filters?.setTemplateFamilyFilter?.('ALL');
          setCurrentTab('machines');
        },
        title: 'Aller aux Machines',
      };

      if (currentTab === 'machines') {
        if (filters?.mchFamilyFilter && filters.mchFamilyFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'mch-fam-link',
              label: `Famille: ${filters.mchFamilyFilter}`,
              onClick: () => setCurrentTab('families'),
              title: 'Voir la Famille',
            },
            { id: 'mch-list', label: 'Machines Registered', active: true },
          ];
        }
        return [
          rootCrumb,
          { id: 'mch-list', label: 'Machines Registered', active: true },
        ];
      }
      if (currentTab === 'families') {
        return [rootCrumb, { id: 'mch-fam', label: 'Familles', active: true }];
      }
      if (currentTab === 'templates') {
        if (filters?.templateFamilyFilter && filters.templateFamilyFilter !== 'ALL') {
          return [
            rootCrumb,
            {
              id: 'tmpl-fam-link',
              label: `Famille: ${filters.templateFamilyFilter}`,
              onClick: () => setCurrentTab('families'),
              title: 'Retourner aux Familles',
            },
            { id: 'tmpl-list', label: 'Templates', active: true },
          ];
        }
        return [rootCrumb, { id: 'tmpl-list', label: 'Templates', active: true }];
      }
      if (currentTab === 'blueprints') {
        return [rootCrumb, { id: 'mch-blueprints', label: 'Blueprints', active: true }];
      }
    }

    // 4. OTHER MODULES & FALLBACK
    const activeChild = childTabs.find((c) => c.id === currentTab);
    if (activeChild && activeChild.label !== activeParent.label) {
      return [
        {
          id: `${activeParent.id}-parent`,
          label: activeParent.label,
          onClick: () => setCurrentTab(activeParent.children?.[0]?.id || activeParent.id),
          title: `Aller à ${activeParent.label}`,
        },
        {
          id: `${activeChild.id}-child`,
          label: activeChild.label,
          active: true,
        },
      ];
    }

    return [
      {
        id: `${activeParent.id}-current`,
        label: activeParent.label,
        active: true,
      },
    ];
  }, [activeParent, currentTab, setCurrentTab, childTabs, filters]);

  const onExportWithTracking = () => {
    analytics.track('excel_exported', 'excel', { timestamp: Date.now() });
    handleExportExcel?.();
  };

  const onImportWithTracking = (e) => {
    analytics.track('excel_imported', 'excel', { fileName: e.target.files?.[0]?.name });
    handleImportFile?.(e);
  };

  const onSaveWithTracking = () => {
    analytics.track('excel_direct_save', 'excel', { fileName: linkedFileName });
    onDirectSave?.();
  };

  const handleNotificationClick = async () => {
    if (notificationService.isSupported()) {
      const perm = await notificationService.requestPermission();
      if (perm === 'granted') {
        notificationService.notify('🔔 Notifications CIOB GMAO', {
          body: 'Les notifications d’alertes de stock et de sauvegarde sont maintenant actives.',
        });
      }
    }
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
          : 'top-2 sm:top-3 z-30 w-[calc(100%-0.75rem)] sm:w-[calc(100%-1.25rem)] lg:w-[calc(100%-2rem)] xl:w-[calc(100%-2.5rem)] 2xl:w-[calc(100%-3rem)] max-w-[2200px] mx-auto rounded-[22px] sm:rounded-full bg-white/95 backdrop-blur-xl border border-zinc-200/90 shadow-[0_12px_32px_-6px_rgba(0,0,0,0.12),0_4px_12px_-2px_rgba(0,0,0,0.06)] my-2 sm:my-3 overflow-hidden'
      }`}
    >
      <div className={`flex items-center justify-between gap-1.5 sm:gap-3 w-full min-w-0 ${isStandardFixed ? 'px-4 sm:px-6 py-0' : 'px-2.5 sm:px-5 py-2'}`}>
        {/* Left: Brand Capsule & Breadcrumbs (Clean & De-duplicated in Fixed Mode) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
          {/* Menu Drawer Button: visible on mobile always; in floating mode also on desktop */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className={`w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-white border border-zinc-200/90 items-center justify-center text-zinc-700 hover:text-black hover:border-zinc-300 shadow-xs hover:shadow-md cursor-pointer transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
              isStandardFixed ? 'flex lg:hidden' : 'flex'
            }`}
            aria-label="Ouvrir le menu de navigation complet"
            title="Menu complet des modules et sections (Toutes les pages)"
            aria-haspopup="dialog"
          >
            <Menu size={16} />
          </button>

          {/* Brand Capsule Pill: Only shown in Floating Mode (In Fixed mode, sidebar already has the brand logo & title) */}
          {!isStandardFixed && (
            <button
              onClick={() => setCurrentTab('dashboard')}
              className="flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-1.5 rounded-full bg-white border border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-emerald-300 hover:shadow-[0_4px_14px_rgba(16,185,129,0.12)] transition-all cursor-pointer shrink-0 group focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              title="CIOB GMAO Light - Dashboard"
              aria-label="Tableau de bord CIOB GMAO Light"
            >
              {/* Dedicated 3D-styled green Excel workbook SVG Icon */}
              <div className="relative w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-xs shrink-0 ring-2 ring-emerald-500/20 overflow-hidden group-hover:scale-105 transition-transform">
                <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4px_4px]" />
                <svg
                  className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-white relative z-10"
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
              <div className="text-left leading-tight pr-0.5 hidden sm:block">
                <div className="font-bold text-[12.5px] tracking-tight text-zinc-900 flex items-center gap-1">
                  <span>Ciob PDR</span>
                  <span className="text-[8.5px] font-extrabold uppercase px-1 py-0.1 rounded-md bg-emerald-500/15 text-emerald-700 border border-emerald-500/25">
                    XLS
                  </span>
                </div>
                <div className="text-[9.5px] font-semibold text-emerald-700 tracking-tight truncate max-w-[120px]">
                  Pièces de Rechange
                </div>
              </div>
            </button>
          )}

          {/* Smart Breadcrumb Navigation Capsule */}
          <div
            className={`flex items-center gap-2 max-w-[280px] lg:max-w-[460px] shrink-0 ${
              isStandardFixed
                ? 'px-3 py-1.5 rounded-lg bg-zinc-100/80 border border-zinc-200/70 text-xs shadow-none'
                : 'hidden md:flex px-3 sm:px-3.5 py-1.5 rounded-full bg-white border border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)]'
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

        {/* Center: Scrollable Responsive Sub-Tabs Navigation */}
        <nav
          role="navigation"
          aria-label="Sous-onglets de navigation"
          className="flex items-center justify-center flex-1 min-w-0 mx-1 sm:mx-2 overflow-hidden"
        >
          {childTabs.length > 0 && (
            <div
              role="tablist"
              aria-label={activeParent.label}
              className="inline-flex items-center p-1 sm:p-1.5 rounded-full bg-[#EFEFEE] border border-[#E5E5E3] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06),0_2px_10px_rgba(0,0,0,0.03)] overflow-x-auto max-w-full scrollbar-none no-scrollbar flex-nowrap shrink-0 sm:shrink min-w-0 gap-0.5 sm:gap-1"
            >
              {childTabs.map((child, index) => {
                const isActive = currentTab === child.id;
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
                    className={`whitespace-nowrap px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11.5px] sm:text-[12.5px] font-semibold transition-all duration-200 cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
                      isActive
                        ? 'bg-[#111111] text-white shadow-[0_4px_14px_rgba(0,0,0,0.25)] scale-[1.02]'
                        : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/60'
                    }`}
                  >
                    {child.label}
                  </button>
                );
              })}
            </div>
          )}
        </nav>

        {/* Right: Actions & Tools (De-duplicated in fixed mode) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={onImportWithTracking}
            accept=".json,.xlsx,.xls"
            className="hidden"
            aria-label="Importer un fichier JSON ou Excel"
          />

          {/* Direct Link / Direct Save Button - Icon-Only in Emerald Theme */}
          {linkedFileName ? (
            <div className="flex items-center gap-1 shrink-0">
              <span
                className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/90 shadow-2xs truncate max-w-[130px]"
                title={`Fichier lié : ${linkedFileName}`}
                aria-label={`Fichier lié : ${linkedFileName}`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                <span className="truncate">{linkedFileName}</span>
              </span>
              <button
                onClick={onSaveWithTracking}
                className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white flex items-center justify-center transition shadow-[0_2px_8px_rgba(4,120,87,0.25)] cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
                title={`Enregistrer dans ${linkedFileName}`}
                aria-label="Sauvegarder dans le fichier Excel lié"
              >
                <Save size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={onDirectLink}
              className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 flex items-center justify-center text-emerald-700 hover:text-emerald-900 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              title="Lier un fichier Excel (.xlsx)"
              aria-label="Lier directement un fichier Excel .xlsx"
            >
              <Link size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
            </button>
          )}

          <PWAInstallButton variant="header" />

          {/* Explicit Server Sync Capsule & Popover Menu */}
          <div className="relative" ref={syncMenuRef}>
            <button
              type="button"
              onClick={() => setSyncMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-50/90 hover:bg-emerald-100/90 border border-emerald-200/90 text-emerald-800 text-xs font-bold transition shadow-[0_2px_6px_rgba(4,120,87,0.08)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden group"
              title="مزامنة الخادم الصريحة (حفظ على الخادم / استعادة من الخادم)"
              aria-label="Synchronisation Serveur gmao_state.json"
              aria-expanded={syncMenuOpen}
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              <Cloud size={14} className="text-emerald-700 group-hover:scale-110 transition-transform shrink-0" />
              <span className="hidden xl:inline text-[11px] font-extrabold tracking-tight">Sync Serveur</span>
              <ChevronDown
                size={12}
                className={`text-emerald-600 transition-transform duration-200 ${syncMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {syncMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <SyncButtons
                  variant="dropdown"
                  showToast={showToast}
                  onCloseDropdown={() => setSyncMenuOpen(false)}
                />
              </div>
            )}
          </div>

          {/* Live Industrial Shift Clock (Configurable via Appearance) */}
          {headerClockEnabled && (
            <div
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/90 text-slate-700 text-[11px] font-mono font-bold tabular-nums shadow-2xs select-none shrink-0"
              title="Horloge de poste industrielle (Temps Réel)"
              aria-label={`Heure locale de poste : ${currentTime}`}
            >
              <Clock className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" aria-hidden="true" />
              <span>{currentTime}</span>
            </div>
          )}

          {/* Offline Language Switcher (Expands on hover) */}
          <LanguageSwitcher className="inline-flex" />

          {/* Export Excel Dropdown Menu - Only in Floating Mode (Fixed sidebar already has Export button) */}
          {!isStandardFixed && (
            <div className="relative hidden sm:block" ref={topologyMenuRef}>
              <button
                onClick={() => setTopologyMenuOpen((prev) => !prev)}
                className="flex items-center gap-1 pl-2.5 pr-2 py-1.5 rounded-full bg-slate-900 hover:bg-black text-white text-xs font-bold transition shadow-[0_2px_8px_rgba(0,0,0,0.18)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden group"
                title="Exporter Excel & المصنفات الثلاثة (3-Workbook Topology)"
                aria-label="Menu d'exportation Excel et topologie industrielle"
                aria-expanded={topologyMenuOpen}
              >
                <Download size={14} className="text-emerald-400 group-hover:scale-110 transition-transform" aria-hidden="true" />
                <span className="text-[11px] font-mono tracking-tight text-slate-100 hidden md:inline">Export</span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${topologyMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {topologyMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-1.5 border-b border-slate-100 mb-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 font-mono">
                      3-Workbook Topology Hub
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      Exportation des données industrielles
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
                        Modèle Complet GMAO (.xlsx)
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Classeur maître avec formules vivantes et KPIs
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

          {/* Import JSON/Excel Button - Only in Floating Mode (Fixed sidebar already has Import button) */}
          {!isStandardFixed && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="hidden sm:flex w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-white border border-zinc-200 items-center justify-center text-zinc-600 hover:text-black hover:border-zinc-300 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              title="Importer JSON / Excel"
              aria-label="Importer un fichier de données JSON ou Excel"
            >
              <Upload size={16} aria-hidden="true" />
            </button>
          )}

          <button
            onClick={onOpenShortcuts}
            className="hidden sm:flex w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-white border border-zinc-200 items-center justify-center text-zinc-600 hover:text-black hover:border-zinc-300 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
            title="Raccourcis clavier (F1 / ?)"
            aria-label="Afficher la liste des raccourcis clavier"
          >
            <Keyboard size={16} aria-hidden="true" />
          </button>

          <button
            onClick={handleNotificationClick}
            className="w-8 sm:w-9 h-8 sm:h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-zinc-600 hover:text-black hover:border-zinc-300 transition shadow-[0_2px_6px_rgba(0,0,0,0.04)] hover:shadow-md relative cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
            title="Activer les notifications système"
            aria-label="Centre de notifications et alertes"
          >
            <Bell size={16} aria-hidden="true" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full ring-2 ring-white" aria-hidden="true" />
          </button>

          {/* User Profile Account Card Pill - Only in Floating Mode (Fixed sidebar already has User Card at bottom) */}
          {!isStandardFixed && (
            <button
              onClick={() => setCurrentTab('settings')}
              className="flex items-center gap-2 px-2 sm:px-2.5 py-1 rounded-full bg-white border border-zinc-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-emerald-300 hover:shadow-[0_4px_14px_rgba(16,185,129,0.12)] transition-all cursor-pointer shrink-0 group focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden"
              title="Mon Compte / Paramètres"
              aria-label={`Compte utilisateur de ${currentUser?.name || 'Achraf'} - Accéder aux paramètres`}
            >
              {/* Rounded Emerald Avatar Icon matching sidebar */}
              <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white font-extrabold text-[10.5px] flex items-center justify-center shadow-2xs shrink-0 group-hover:scale-105 transition-transform" aria-hidden="true">
                {currentUser?.avatar || 'RM'}
              </div>
              {/* User Name & Role matching sidebar typography */}
              <div className="hidden xl:block text-left leading-tight min-w-0 pr-0.5">
                <div className="text-[11.5px] font-bold text-slate-900 truncate">
                  {currentUser?.name || 'Achraf'}
                </div>
                <div className="text-[9.5px] font-semibold text-emerald-700 truncate">
                  {currentUser?.titleFr || currentUser?.role || 'Administrateur'}
                </div>
              </div>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
