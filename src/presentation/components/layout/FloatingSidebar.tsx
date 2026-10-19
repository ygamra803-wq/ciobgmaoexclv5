import { useState, useEffect, useRef } from 'react';
import { Settings, LogOut, Sun, Moon, LayoutDashboard } from 'lucide-react';
import { PARENT_MODULES, getParentModuleForTab } from './navConfig';
import { useTranslation } from '../../../i18n/I18nContext';
import { analytics } from '../../../services/AnalyticsService';
import { storageService } from '../../../utils/storageService';

const MODULE_THEME = {
  dashboard: {
    borderLight: 'border-blue-400/50',
    borderDark: 'border-blue-400/40',
    ringLight: 'ring-blue-400/20',
    ringDark: 'ring-blue-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(59,130,246,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(59,130,246,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-blue-600',
    iconDark: 'text-blue-300',
    sidebarBorderLight: 'border-blue-300/80',
    sidebarBorderDark: 'border-blue-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(59,130,246,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(59,130,246,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  stock: {
    borderLight: 'border-cyan-400/50',
    borderDark: 'border-cyan-400/40',
    ringLight: 'ring-cyan-400/20',
    ringDark: 'ring-cyan-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(6,182,212,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(6,182,212,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-cyan-600',
    iconDark: 'text-cyan-300',
    sidebarBorderLight: 'border-cyan-300/80',
    sidebarBorderDark: 'border-cyan-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(6,182,212,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(6,182,212,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  machines: {
    borderLight: 'border-emerald-400/50',
    borderDark: 'border-emerald-400/40',
    ringLight: 'ring-emerald-400/20',
    ringDark: 'ring-emerald-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(16,185,129,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-emerald-600',
    iconDark: 'text-emerald-300',
    sidebarBorderLight: 'border-emerald-300/80',
    sidebarBorderDark: 'border-emerald-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(16,185,129,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(16,185,129,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  preventive: {
    borderLight: 'border-indigo-400/50',
    borderDark: 'border-indigo-400/40',
    ringLight: 'ring-indigo-400/20',
    ringDark: 'ring-indigo-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(99,102,241,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(99,102,241,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-indigo-600',
    iconDark: 'text-indigo-300',
    sidebarBorderLight: 'border-indigo-300/80',
    sidebarBorderDark: 'border-indigo-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(99,102,241,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(99,102,241,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  corrective: {
    borderLight: 'border-amber-400/50',
    borderDark: 'border-amber-400/40',
    ringLight: 'ring-amber-400/20',
    ringDark: 'ring-amber-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(245,158,11,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-amber-600',
    iconDark: 'text-amber-300',
    sidebarBorderLight: 'border-amber-300/80',
    sidebarBorderDark: 'border-amber-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(245,158,11,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(245,158,11,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  entrepot: {
    borderLight: 'border-indigo-400/50',
    borderDark: 'border-indigo-400/40',
    ringLight: 'ring-indigo-400/20',
    ringDark: 'ring-indigo-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(99,102,241,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(99,102,241,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-indigo-600',
    iconDark: 'text-indigo-300',
    sidebarBorderLight: 'border-indigo-300/80',
    sidebarBorderDark: 'border-indigo-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(99,102,241,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(99,102,241,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  zones: {
    borderLight: 'border-purple-400/50',
    borderDark: 'border-purple-400/40',
    ringLight: 'ring-purple-400/20',
    ringDark: 'ring-purple-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(168,85,247,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(168,85,247,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-purple-600',
    iconDark: 'text-purple-300',
    sidebarBorderLight: 'border-purple-300/80',
    sidebarBorderDark: 'border-purple-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(168,85,247,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(168,85,247,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  utilisateurs: {
    borderLight: 'border-violet-400/50',
    borderDark: 'border-violet-400/40',
    ringLight: 'ring-violet-400/20',
    ringDark: 'ring-violet-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(139,92,246,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(139,92,246,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-violet-600',
    iconDark: 'text-violet-300',
    sidebarBorderLight: 'border-violet-300/80',
    sidebarBorderDark: 'border-violet-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(139,92,246,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(139,92,246,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  nexus: {
    borderLight: 'border-emerald-400/50',
    borderDark: 'border-emerald-400/40',
    ringLight: 'ring-emerald-400/20',
    ringDark: 'ring-emerald-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(16,185,129,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(16,185,129,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-emerald-600',
    iconDark: 'text-emerald-300',
    sidebarBorderLight: 'border-emerald-300/80',
    sidebarBorderDark: 'border-emerald-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(16,185,129,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(16,185,129,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  guide: {
    borderLight: 'border-amber-400/50',
    borderDark: 'border-amber-400/40',
    ringLight: 'ring-amber-400/20',
    ringDark: 'ring-amber-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(245,158,11,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-amber-600',
    iconDark: 'text-amber-300',
    sidebarBorderLight: 'border-amber-300/80',
    sidebarBorderDark: 'border-amber-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(245,158,11,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(245,158,11,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
  settings: {
    borderLight: 'border-amber-400/50',
    borderDark: 'border-amber-400/40',
    ringLight: 'ring-amber-400/20',
    ringDark: 'ring-amber-400/15',
    shadowLight: 'shadow-[0_6px_16px_-2px_rgba(245,158,11,0.18),0_2px_6px_-1px_rgba(0,0,0,0.04),inset_0_1px_2px_rgba(255,255,255,0.9)]',
    shadowDark: 'shadow-[0_6px_18px_-2px_rgba(0,0,0,0.4),0_0_10px_rgba(245,158,11,0.15),inset_0_1px_1px_rgba(255,255,255,0.12)]',
    iconLight: 'text-amber-600',
    iconDark: 'text-amber-300',
    sidebarBorderLight: 'border-amber-300/80',
    sidebarBorderDark: 'border-amber-500/35',
    sidebarShadowLight: 'shadow-[0_20px_50px_-8px_rgba(245,158,11,0.22),0_8px_20px_-4px_rgba(0,0,0,0.12),inset_0_1px_3px_rgba(255,255,255,0.95)]',
    sidebarShadowDark: 'shadow-[0_20px_50px_-8px_rgba(0,0,0,0.7),0_0_35px_rgba(245,158,11,0.35),inset_0_1px_2px_rgba(255,255,255,0.2)]',
  },
};

export default function FloatingSidebar({
  currentTab,
  setCurrentTab,
  onLogout,
}) {
  const { t } = useTranslation();
  const [sidebarTheme, setSidebarTheme] = useState(() => {
    return storageService.getItem('gmao_sidebar_theme') || 'light';
  });
  const [sidebarBehavior, setSidebarBehavior] = useState(() => {
    return storageService.getItem('gmao_sidebar_behavior') || 'push';
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isTranslucent, setIsTranslucent] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const translucencyTimerRef = useRef(null);

  const isAlwaysOpen = sidebarBehavior === 'push';
  const effectiveExpanded = isAlwaysOpen ? true : isExpanded;

  useEffect(() => {
    storageService.setItem('gmao_sidebar_theme', sidebarTheme);
  }, [sidebarTheme]);

  useEffect(() => {
    const handleAppearanceChanged = (e) => {
      const savedTheme = e?.detail?.theme || storageService.getItem('gmao_sidebar_theme') || storageService.getItem('gmao_theme') || 'light';
      setSidebarTheme(savedTheme);
      if (e?.detail?.sidebarBehavior !== undefined) {
        setSidebarBehavior(e.detail.sidebarBehavior);
      } else {
        const savedBehavior = storageService.getItem('gmao_sidebar_behavior') || 'push';
        setSidebarBehavior(savedBehavior);
      }
    };

    window.addEventListener('gmao_appearance_changed', handleAppearanceChanged);
    return () => window.removeEventListener('gmao_appearance_changed', handleAppearanceChanged);
  }, []);

  // Delayed translucency effect: when sidebar is collapsed in overlay mode, remain solid for 2 seconds before slowly fading to translucent
  useEffect(() => {
    if (!effectiveExpanded) {
      if (translucencyTimerRef.current) clearTimeout(translucencyTimerRef.current);
      translucencyTimerRef.current = setTimeout(() => {
        setIsTranslucent(true);
      }, 2000);
    } else {
      if (translucencyTimerRef.current) clearTimeout(translucencyTimerRef.current);
      setIsTranslucent(false);
    }
    return () => {
      if (translucencyTimerRef.current) clearTimeout(translucencyTimerRef.current);
    };
  }, [effectiveExpanded]);

  const toggleSidebarTheme = () => {
    setSidebarTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (translucencyTimerRef.current) clearTimeout(translucencyTimerRef.current);
    setIsTranslucent(false);
    if (!isAlwaysOpen) {
      setIsExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (isAlwaysOpen) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 380);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (translucencyTimerRef.current) clearTimeout(translucencyTimerRef.current);
    };
  }, []);

  const activeParent = getParentModuleForTab(currentTab);
  const isDark = sidebarTheme === 'dark';
  const isSettings = currentTab === 'settings';
  const activeModuleTheme = isSettings
    ? MODULE_THEME.settings
    : (MODULE_THEME[activeParent?.id] || MODULE_THEME.dashboard);

  const ActiveIconComponent = isSettings
    ? Settings
    : (activeParent?.icon || LayoutDashboard);

  const activeLabel = isSettings
    ? (t('nav.settings') || 'Paramètres')
    : (t(`nav.${activeParent?.id}`) !== `nav.${activeParent?.id}` ? t(`nav.${activeParent?.id}`) : activeParent?.label || 'Navigation');

  const handleSelectParent = (module) => {
    const firstChild = module.children[0]?.id || module.id;
    analytics.track('navigation_tab_changed', 'navigation', {
      fromTab: currentTab,
      toTab: firstChild,
      moduleId: module.id,
    });
    setCurrentTab(firstChild);
    if (!isAlwaysOpen) {
      setIsExpanded(false);
    }
  };


  const handleModuleKeyDown = (e, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = (index + 1) % PARENT_MODULES.length;
      handleSelectParent(PARENT_MODULES[nextIdx]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = (index - 1 + PARENT_MODULES.length) % PARENT_MODULES.length;
      handleSelectParent(PARENT_MODULES[prevIdx]);
    }
  };

  return (
    <aside
      role="navigation"
      aria-label="Navigation principale"
      className="hidden lg:block select-none"
    >
      {/* Hover bridge when expanded: provides a seamless path between center dock and bottom capsule */}
      {effectiveExpanded && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="fixed left-0 top-[15%] bottom-2 w-24 z-30 pointer-events-auto"
          aria-hidden="true"
        />
      )}

      {/* 1. Primary Page Modules Container - Vertically Centered on Screen (Expands symmetrically up and down) */}
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="fixed left-3.5 top-1/2 -translate-y-1/2 z-40 flex flex-col items-center"
      >
        {!effectiveExpanded ? (
          /* Messenger-Style Floating Dock Active Bubble (With 2s delayed smooth translucency) */
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsExpanded(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setIsExpanded(true);
              }
            }}
            aria-label={`Menu de navigation (Actuellement : ${activeLabel}) - Survoler pour ouvrir`}
            title={`Module actif : ${activeLabel}\nApprochez la souris pour ouvrir la navigation`}
            className={`group relative w-[54px] h-[54px] rounded-[22px] border flex items-center justify-center transition-all duration-300 ease-out cursor-pointer shadow-md hover:shadow-xl hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
              isTranslucent
                ? 'opacity-90 hover:opacity-100'
                : 'opacity-100'
            } ${
              isDark
                ? 'bg-slate-900/90 hover:bg-slate-800/95 border-slate-700/80 hover:border-slate-600 backdrop-blur-md hover:backdrop-blur-xl'
                : 'bg-white/95 hover:bg-white border-slate-200/90 hover:border-slate-300 backdrop-blur-md hover:backdrop-blur-xl'
            }`}
          >

            {/* Glass magnifying convex light reflection */}
            <span
              className={`absolute inset-0 rounded-[22px] pointer-events-none transition-opacity duration-500 ${
                isDark
                  ? 'bg-gradient-to-b from-white/10 via-white/5 to-transparent opacity-50 group-hover:opacity-100'
                  : 'bg-gradient-to-b from-white/70 via-white/20 to-transparent opacity-60 group-hover:opacity-100'
              }`}
              aria-hidden="true"
            />

            {/* Active Icon with smooth transition */}
            <ActiveIconComponent
              size={23}
              strokeWidth={2.4}
              className={`relative z-10 transition-all duration-500 group-hover:scale-110 ${
                isTranslucent ? 'opacity-75 group-hover:opacity-100' : 'opacity-100'
              } ${isDark ? activeModuleTheme.iconDark : activeModuleTheme.iconLight}`}
              aria-hidden="true"
            />

            {/* Subtle dock indicator dot at bottom */}
            <span
              className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white/80 dark:ring-slate-800 animate-pulse transition-opacity duration-500 ${
                isTranslucent ? 'opacity-65 group-hover:opacity-100' : 'opacity-100'
              }`}
              aria-hidden="true"
            />

            {/* Floating tooltip on hover */}
            <div
              role="tooltip"
              className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900/95 border border-slate-800 text-white text-[11px] font-bold rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
            >
              {activeLabel} <span className="text-emerald-400 font-normal ml-1">· Navigation</span>
            </div>
          </div>
        ) : (
          /* Symmetrically Expanded Capsule around Center (Smooth 450ms graceful growth) */
          <div
            role="tablist"
            aria-label="Modules principaux"
            aria-orientation="vertical"
            className={`w-[60px] rounded-[28px] border px-2 py-3 flex flex-col items-center gap-2 transition-all duration-500 ease-out origin-center animate-in fade-in zoom-in-95 ${
              isDark
                ? 'bg-slate-800/95 border-slate-700/80 shadow-[0_20px_50px_-8px_rgba(0,0,0,0.6),0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl'
                : 'bg-white/95 border-slate-200/90 shadow-[0_16px_40px_-6px_rgba(0,0,0,0.12),0_6px_16px_-3px_rgba(0,0,0,0.06)] backdrop-blur-xl'
            }`}
          >
            {PARENT_MODULES.map((module, index) => {
              const isActive = !isSettings && activeParent.id === module.id;
              const IconComponent = module.icon;
              const translatedLabel = t(`nav.${module.id}`) !== `nav.${module.id}` ? t(`nav.${module.id}`) : module.label;
              const theme = MODULE_THEME[module.id] || MODULE_THEME.dashboard;

              return (
                <button
                  key={module.id}
                  role="tab"
                  id={`nav-module-${module.id}`}
                  aria-selected={isActive}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={translatedLabel}
                  tabIndex={isActive ? 0 : -1}
                  onKeyDown={(e) => handleModuleKeyDown(e, index)}
                  onClick={() => {
                    handleSelectParent(module);
                  }}
                  className={`group relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ease-out cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
                    isActive
                      ? isDark
                        ? 'z-20 scale-105 bg-slate-700/90 border border-slate-600 shadow-xs'
                        : 'z-20 scale-105 bg-slate-100/95 border border-slate-300/80 shadow-xs'
                      : isDark
                      ? 'hover:bg-slate-700/50 hover:scale-105 hover:-translate-y-0.5'
                      : 'hover:bg-zinc-100 hover:scale-105 hover:-translate-y-0.5 hover:shadow-xs'
                  }`}
                  title={translatedLabel}
                >
                  {/* Glass magnifying convex light reflection */}
                  {isActive && (
                    <span
                      className={`absolute inset-0 rounded-full pointer-events-none ${
                        isDark
                          ? 'bg-gradient-to-b from-white/10 via-white/5 to-transparent'
                          : 'bg-gradient-to-b from-white/70 via-white/20 to-transparent'
                      }`}
                      aria-hidden="true"
                    />
                  )}

                  <IconComponent
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.9}
                    aria-hidden="true"
                    className={`relative z-10 transition-all duration-300 ${
                      isActive
                        ? isDark
                          ? `${theme.iconDark} scale-110`
                          : `${theme.iconLight} scale-110`
                        : isDark
                        ? `${module.colorDark} opacity-75 group-hover:opacity-100 group-hover:scale-105`
                        : `${module.color} opacity-80 group-hover:opacity-100 group-hover:scale-105`
                    }`}
                  />

                  {/* Tooltip on hover with floating depth */}
                  <div
                    role="tooltip"
                    className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900/95 border border-slate-800 text-white text-[11px] font-bold rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-150 whitespace-nowrap z-50 shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
                  >
                    {translatedLabel}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Bottom Controls Container Card (Settings, Theme & Logout) - Delayed smooth entrance after sidebar expands */}
      <div
        role="toolbar"
        aria-label="Actions du système"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-3.5 bottom-5 z-40 w-[60px] rounded-[24px] border px-1.5 py-2 flex flex-col items-center gap-1.5 transition-all ${
          effectiveExpanded
            ? 'opacity-100 translate-y-0 pointer-events-auto delay-150 duration-300 ease-out'
            : 'opacity-0 translate-y-3 pointer-events-none delay-0 duration-200 ease-in'
        } ${
          isDark
            ? 'bg-slate-800/95 border-slate-700/80 shadow-[0_20px_50px_-8px_rgba(0,0,0,0.6),0_6px_20px_rgba(0,0,0,0.4)] backdrop-blur-xl'
            : 'bg-white/95 border-slate-200/90 shadow-[0_16px_40px_-6px_rgba(0,0,0,0.12),0_6px_16px_-3px_rgba(0,0,0,0.06)] backdrop-blur-xl'
        }`}
      >
        {/* Settings button */}
        <button
          onClick={() => {
            setCurrentTab('settings');
            if (!isAlwaysOpen) {
              setIsExpanded(false);
            }
          }}
          className={`group relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:outline-hidden ${
            isSettings
              ? isDark
                ? 'z-20 scale-105 bg-slate-700/90 border border-slate-600 shadow-xs text-amber-300'
                : 'z-20 scale-105 bg-slate-100/95 border border-slate-300/80 shadow-xs text-amber-600'
              : isDark
              ? 'text-slate-400 hover:text-white hover:bg-slate-700/50 hover:scale-105 hover:-translate-y-0.5'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 hover:scale-105 hover:-translate-y-0.5'
          }`}
          title={t('nav.settings')}
        >
          <Settings
            size={20}
            strokeWidth={isSettings ? 2.5 : 1.9}
            className="transition-transform group-hover:scale-110"
          />
        </button>

        {/* Theme toggle button */}
        <button
          onClick={toggleSidebarTheme}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-slate-700/50 hover:scale-105 hover:-translate-y-0.5 cursor-pointer"
          title={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
        >
          {isDark ? (
            <Sun size={19} className="text-amber-400 transition-transform group-hover:rotate-45" />
          ) : (
            <Moon size={19} className="text-slate-600 transition-transform group-hover:-rotate-12" />
          )}
        </button>

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="group relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:scale-105 hover:-translate-y-0.5 cursor-pointer"
          title={t('nav.logout') || 'Déconnexion'}
        >
          <LogOut size={19} className="transition-transform group-hover:scale-110" />
        </button>
      </div>
    </aside>
  );
}
