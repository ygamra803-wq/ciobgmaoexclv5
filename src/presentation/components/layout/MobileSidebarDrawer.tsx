import { useState, useEffect } from 'react';
import { storageService } from '../../../utils/storageService';
import SortieEntreeIcon from '../common/SortieEntreeIcon';
import PWAInstallButton from '../common/PWAInstallButton';
import {
  LayoutDashboard,
  Package,
  Tag,
  BadgeCheck,
  MapPin,
  Users,
  GitBranch,
  BookOpen,
  X,
  Database,
  Factory,
  Warehouse,
  Lightbulb,
  Settings,
  Settings2,
  Sun,
  Moon,
  LogOut,
  FingerprintPattern,
  Boxes,
  Calendar,
  Wrench,
  Download,
  Upload,
} from 'lucide-react';
import { HubIcon } from '../common/icons/HubIcon';
import { CategoryIcon } from '../common/icons/CategoryIcon';
import PartInfoIcon from '../common/icons/PartInfoIcon';
import { SpokeIcon } from '../common/icons/SpokeIcon';
import { CubeIcon } from '../common/icons/CubeIcon';
import { LayersIcon } from '../common/icons/LayersIcon';

export default function MobileSidebarDrawer({
  isFixedDesktop = false,
  currentTab,
  setCurrentTab,
  mobileMenuOpen,
  setMobileMenuOpen,
  counts = {},
  currentUser,
  fileInputRef,
  _handleImportFile,
  handleExportExcel,
  onLogout,
}) {
  // Sidebar Dark / Light Theme state (persisted in storageService)
  const [sidebarTheme, setSidebarTheme] = useState(() => {
    return storageService.getItem('gmao_sidebar_theme') || 'dark';
  });

  useEffect(() => {
    const handleAppearanceChanged = (e) => {
      if (e?.detail?.theme) {
        setSidebarTheme(e.detail.theme);
      }
    };
    window.addEventListener('gmao_appearance_changed', handleAppearanceChanged);
    return () => window.removeEventListener('gmao_appearance_changed', handleAppearanceChanged);
  }, []);

  useEffect(() => {
    storageService.setItem('gmao_sidebar_theme', sidebarTheme);
  }, [sidebarTheme]);

  // Accessibility: Close mobile drawer on Escape key
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  const toggleSidebarTheme = () => {
    setSidebarTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const navTo = (tab) => {
    setCurrentTab(tab);
    setMobileMenuOpen(false);
  };

  const isDark = sidebarTheme === 'dark';

  // Dynamic styling based on sidebarTheme
  const getTabClass = (tabName, isSubItem = false) => {
    const isActive =
      currentTab === tabName || (tabName === 'designations' && currentTab === 'diagnostics');
    const basePadding = isSubItem ? 'pl-6 pr-3 py-2' : 'px-3 py-2.5';

    if (isDark) {
      if (isActive) {
        return `w-full flex items-center justify-between ${basePadding} rounded-xl text-[13px] font-bold bg-white text-slate-900 shadow-sm transition-all duration-150 cursor-pointer`;
      }
      return `w-full flex items-center justify-between ${basePadding} rounded-xl text-[13px] font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-all duration-150 cursor-pointer`;
    } else {
      if (isActive) {
        return `w-full flex items-center justify-between ${basePadding} rounded-xl text-[13px] font-bold bg-slate-900 text-white shadow-sm transition-all duration-150 cursor-pointer`;
      }
      return `w-full flex items-center justify-between ${basePadding} rounded-xl text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 cursor-pointer`;
    }
  };

  // Badge styling
  const getBadgeClass = (tabName) => {
    const isActive =
      currentTab === tabName || (tabName === 'designations' && currentTab === 'diagnostics');
    if (isDark) {
      if (isActive) {
        return 'text-[11px] px-2 py-0.5 rounded-full font-mono bg-slate-900 text-white font-bold';
      }
      return 'text-[11px] px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-400 font-medium group-hover:bg-slate-700 group-hover:text-slate-200';
    } else {
      if (isActive) {
        return 'text-[11px] px-2 py-0.5 rounded-full font-mono bg-slate-800 text-slate-100 font-bold';
      }
      return 'text-[11px] px-2 py-0.5 rounded-full font-mono bg-slate-100 text-slate-500 font-medium group-hover:bg-slate-200';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container - Exact Rich Original Design (Fixed on Desktop if isFixedDesktop, Drawer on Mobile) */}
      <aside
        role={isFixedDesktop ? 'navigation' : 'dialog'}
        aria-modal={isFixedDesktop ? undefined : 'true'}
        aria-label="Menu principal de navigation"
        className={`fixed top-0 bottom-0 left-0 z-40 w-[270px] flex flex-col transition-all duration-200 ease-in-out select-none ${
          isFixedDesktop
            ? (mobileMenuOpen ? 'translate-x-0' : 'max-lg:-translate-x-full lg:translate-x-0')
            : (mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:hidden')
        } ${
          isDark
            ? 'bg-slate-900 text-white border-r border-slate-800 shadow-xl'
            : 'bg-white text-slate-800 border-r border-slate-200 shadow-xs'
        }`}
      >

        {/* Brand Header with Dedicated Offline SVG Excel GMAO Icon */}
        <div
          id="sidebar-header-brand"
          className={`h-16 px-4 flex items-center justify-between border-b shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-950/60' : 'border-zinc-200/90 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Custom Modern Excel Icon: 3D-styled green workbook with iconic X and grid */}
            <div
              id="excel-brand-logo"
              className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white shadow-md shrink-0 ring-2 ring-emerald-500/30 overflow-hidden"
            >
              {/* Excel Grid Texture Behind */}
              <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:5px_5px]" />

              {/* Excel Badge & Symbol */}
              <svg
                id="excel-svg-icon"
                className="w-6 h-6 text-white relative z-10 drop-shadow-xs"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Excel Workbook Sheet */}
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
                {/* Spreadsheet inner division */}
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
                {/* The Classic Excel 'X' Symbol in left panel */}
                <path
                  d="M12.5 7.5L18 16.5M18 7.5L12.5 16.5"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Left Mini Data Bars */}
                <rect x="5" y="6" width="3" height="1.8" rx="0.5" fill="currentColor" />
                <rect x="5" y="11" width="3" height="1.8" rx="0.5" fill="currentColor" />
                <rect x="5" y="16" width="3" height="1.8" rx="0.5" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div
                id="brand-title-text"
                className={`font-bold text-[15px] tracking-tight leading-tight flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}
              >
                <span>Ciob PDR</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  XLS
                </span>
              </div>
              <div
                className={`text-[11px] font-semibold tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}
              >
                Pièces de Rechange & GMAO
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className={`p-1.5 rounded-lg lg:hidden cursor-pointer ${
              isDark
                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
            }`}
            aria-label="Fermer le menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-4 text-xs">
          {/* Main Global Navigation */}
          <div className="space-y-1">
            {/* Dashboard Tab */}
            <button onClick={() => navTo('dashboard')} className={getTabClass('dashboard')}>
              <span className="flex items-center gap-2.5">
                <LayoutDashboard
                  className={`w-4 h-4 shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                />
                <span>Dashboard</span>
              </span>
              <span className={getBadgeClass('dashboard')}>KPI</span>
            </button>

            {/* Sortie Rapide Tab */}
            <button onClick={() => navTo('sortie')} className={getTabClass('sortie')}>
              <span className="flex items-center gap-2.5">
                <SortieEntreeIcon className="w-4 h-4 shrink-0" />
                <span>Sortie & Entrée Rapide</span>
              </span>
              <span className={getBadgeClass('sortie')}>Mvt</span>
            </button>
          </div>

          {/* GROUPE 1: STOCK & COMPOSANTS */}
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              <span>Stock & Articles</span>
            </div>
            <div className="space-y-1">
              {/* Stock Actuel */}
              <button onClick={() => navTo('stock')} className={getTabClass('stock')}>
                <span className="flex items-center gap-2.5">
                  <Package
                    className={`w-4 h-4 shrink-0 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}
                  />
                  <span>Stock (Articles)</span>
                </span>
                <span className={getBadgeClass('stock')}>{counts.stock || 0}</span>
              </button>

              {/* Types */}
              <button onClick={() => navTo('types')} className={getTabClass('types', true)}>
                <span className="flex items-center gap-2">
                  <Tag
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}
                  />
                  <span>Types</span>
                </span>
                <span className={getBadgeClass('types')}>{counts.types || 0}</span>
              </button>

              {/* Désignations */}
              <button
                onClick={() => navTo('designations')}
                className={getTabClass('designations', true)}
              >
                <span className="flex items-center gap-2">
                  <BadgeCheck
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                  />
                  <span>Désignations</span>
                </span>
                <span className={getBadgeClass('designations')}>
                  {counts.designations || counts.diagnostics || 0}
                </span>
              </button>
            </div>
          </div>

          {/* GROUPE 2: PARC MACHINES */}
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-slate-400" />
              <span>Parc Machines</span>
            </div>
            <div className="space-y-1">
              {/* Machines Registered */}
              <button onClick={() => navTo('machines')} className={getTabClass('machines')}>
                <span className="flex items-center gap-2.5">
                  <Factory
                    className={`w-4 h-4 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                  />
                  <span>Machines Registered</span>
                </span>
                <span className={getBadgeClass('machines')}>{counts.machines || 0}</span>
              </button>

              {/* Families (Machines) */}
              <button onClick={() => navTo('families')} className={getTabClass('families', true)}>
                <span className="flex items-center gap-2">
                  <HubIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}
                  />
                  <span>Familles Machines</span>
                </span>
                <span className={getBadgeClass('families')}>{counts.families || 0}</span>
              </button>

              {/* Templates (Machines) */}
              <button onClick={() => navTo('templates')} className={getTabClass('templates', true)}>
                <span className="flex items-center gap-2">
                  <CategoryIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                  />
                  <span>Templates Machines</span>
                </span>
                <span className={getBadgeClass('templates')}>{counts.templates || 0}</span>
              </button>

              {/* Blueprint Machine (Level 3) */}
              <button onClick={() => navTo('blueprints')} className={getTabClass('blueprints', true)}>
                <span className="flex items-center gap-2">
                  <FingerprintPattern
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                  />
                  <span>Blueprint Machine</span>
                </span>
                <span className={getBadgeClass('blueprints')}>{counts.blueprints || 0}</span>
              </button>
            </div>
          </div>

          {/* GROUPE: MAINTENANCE PRÉVENTIVE */}
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Maintenance & Préventif</span>
            </div>
            <div className="space-y-1">
              <button onClick={() => navTo('preventive')} className={getTabClass('preventive')}>
                <span className="flex items-center gap-2.5">
                  <Calendar
                    className={`w-4 h-4 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                  />
                  <span>Planning Préventif</span>
                </span>
                <span className={getBadgeClass('preventive')}>{counts.preventive || 150}</span>
              </button>

              {/* Référentiel, Guides, Actions & Concepteur de Plans */}
              <button
                onClick={() => navTo('preventive_referentiel')}
                className={getTabClass('preventive_referentiel', true)}
              >
                <span className="flex items-center gap-2">
                  <Settings2
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}
                  />
                  <span>Ingénierie & Référentiel</span>
                </span>
                <span className={getBadgeClass('preventive_referentiel')}>
                  {(counts.preventiveGuides || 0) + (counts.preventiveActions || 0) || 'Guides'}
                </span>
              </button>
            </div>
          </div>

          {/* GROUPE: MAINTENANCE CORRECTIVE */}
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-amber-500" />
              <span>Maintenance Corrective</span>
            </div>
            <div className="space-y-1">
              {/* Item 1: Correctif Hub (Main page) */}
              <button onClick={() => navTo('corrective')} className={getTabClass('corrective')}>
                <span className="flex items-center gap-2.5">
                  <Wrench
                    className={`w-4 h-4 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                  />
                  <span>Correctif Hub</span>
                </span>
                <span className={getBadgeClass('corrective')}>{counts.corrective || 'Live'}</span>
              </button>

              {/* Item 2: Catalogue & Données GMAO (Second position) */}
              <button
                onClick={() => navTo('corrective_referentiel')}
                className={getTabClass('corrective_referentiel', true)}
              >
                <span className="flex items-center gap-2">
                  <Database
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                  />
                  <span>Catalogue & Données GMAO</span>
                </span>
                <span className={getBadgeClass('corrective_referentiel')}>
                  Catalogue
                </span>
              </button>
            </div>
          </div>

          {/* GROUPE 3: GROUPE ENTREPÔT (COMPONENTS & PARTS) */}
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-slate-400" />
              <span>Groupe Entrepôt</span>
            </div>
            <div className="space-y-1">
              {/* Entrepôt Principal (Éléments, Composants & Parts) */}
              <button onClick={() => navTo('entrepot')} className={getTabClass('entrepot')}>
                <span className="flex items-center gap-2.5">
                  <Warehouse
                    className={`w-4 h-4 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                  />
                  <span>Entrepôt (Inventaire)</span>
                </span>
                <span className={getBadgeClass('entrepot')}>
                  {counts.warehouse || counts.entrepot || 0}
                </span>
              </button>

              {/* Components section: Groupes -> Familles -> Templates */}
              <button
                onClick={() => navTo('comp_groups')}
                className={getTabClass('comp_groups', true)}
              >
                <span className="flex items-center gap-2">
                  <Boxes
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                  />
                  <span>Groupes (Composants)</span>
                </span>
                <span className={getBadgeClass('comp_groups')}>
                  {counts.compGroups || 0}
                </span>
              </button>

              <button
                onClick={() => navTo('comp_families')}
                className={getTabClass('comp_families', true)}
              >
                <span className="flex items-center gap-2">
                  <SpokeIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                  />
                  <span>Familles (Composants)</span>
                </span>
                <span className={getBadgeClass('comp_families')}>
                  {counts.compFamilies || 0}
                </span>
              </button>

              <button
                onClick={() => navTo('comp_templates')}
                className={getTabClass('comp_templates', true)}
              >
                <span className="flex items-center gap-2">
                  <CubeIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}
                  />
                  <span>Templates (Composants)</span>
                </span>
                <span className={getBadgeClass('comp_templates')}>
                  {counts.compTemplates || 0}
                </span>
              </button>

              {/* Parts section sub-items */}
              <button
                onClick={() => navTo('part_types')}
                className={getTabClass('part_types', true)}
              >
                <span className="flex items-center gap-2">
                  <LayersIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                  />
                  <span>Types (Parts)</span>
                </span>
                <span className={getBadgeClass('part_types')}>
                  {counts.partTypes || 0}
                </span>
              </button>

              <button
                onClick={() => navTo('part_designations')}
                className={getTabClass('part_designations', true)}
              >
                <span className="flex items-center gap-2">
                  <PartInfoIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}
                  />
                  <span>Désignations (Parts)</span>
                </span>
                <span className={getBadgeClass('part_designations')}>
                  {counts.partDesignations || 0}
                </span>
              </button>
            </div>
          </div>

          {/* GROUPE 4: ZONES & ÉQUIPES */}
          <div>
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Zones & Équipes</span>
            </div>
            <div className="space-y-1">
              {/* Zones */}
              <button onClick={() => navTo('zones')} className={getTabClass('zones')}>
                <span className="flex items-center gap-2.5">
                  <MapPin
                    className={`w-4 h-4 shrink-0 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}
                  />
                  <span>Zones & Ateliers</span>
                </span>
                <span className={getBadgeClass('zones')}>{counts.zones || 0}</span>
              </button>

              {/* Utilisateurs */}
              <button
                onClick={() => navTo('utilisateurs')}
                className={getTabClass('utilisateurs', true)}
              >
                <span className="flex items-center gap-2">
                  <Users
                    className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}
                  />
                  <span>Utilisateurs (Membres)</span>
                </span>
                <span className={getBadgeClass('utilisateurs')}>
                  {(counts.technicians || 0) + (counts.operations || 0)}
                </span>
              </button>
            </div>
          </div>

          {/* GROUPE 5: OUTILS & RÉFÉRENTIEL */}
          <div
            className={`space-y-1 pt-2 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}
          >
            <button onClick={() => navTo('nexus')} className={getTabClass('nexus')}>
              <span className="flex items-center gap-2.5">
                <GitBranch
                  className={`w-4 h-4 shrink-0 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}
                />
                <span>Nexus Matrix</span>
              </span>
            </button>
            <button onClick={() => navTo('guide')} className={getTabClass('guide')}>
              <span className="flex items-center gap-2.5">
                <BookOpen
                  className={`w-4 h-4 shrink-0 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}
                />
                <span>Guide d'utilisation</span>
              </span>
            </button>
          </div>
        </div>

        {/* Guided Tip Box */}
        <div
          className={`p-3 border-t ${isDark ? 'border-slate-800 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`}
        >
          <div
            className={`rounded-xl p-3 text-[11.5px] leading-relaxed space-y-1 border ${
              isDark
                ? 'bg-slate-800/80 text-slate-300 border-slate-700/60 shadow-inner'
                : 'bg-white text-slate-600 border-slate-200 shadow-2xs'
            }`}
          >
            <div
              className={`font-semibold flex items-center gap-1.5 text-[12px] ${isDark ? 'text-slate-100' : 'text-slate-800'}`}
            >
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Astuce Excel Twin</span>
            </div>
            <div
              className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
            >
              • Cliquez sur n'importe quel code (Zone, Famille, Type) pour filtrer les tables
              associées.
            </div>
          </div>
        </div>

        {/* Quick Excel Synchronization for Mobile */}
        <div className="px-3 pb-2 flex items-center gap-2">
          {handleExportExcel && (
            <button
              onClick={() => {
                handleExportExcel();
                setMobileMenuOpen(false);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-emerald-400 hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50'
              }`}
              title="Exporter les données au format Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel</span>
            </button>
          )}
          {fileInputRef && (
            <button
              onClick={() => {
                fileInputRef.current?.click();
                setMobileMenuOpen(false);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                isDark
                  ? 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Importer un fichier Excel ou JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import Excel</span>
            </button>
          )}
        </div>

        {/* PWA Install Button Container */}
        <div className="px-3 pb-2">
          <PWAInstallButton variant="sidebar" />
        </div>

        {/* Bottom Control Actions: Settings (Parameters) & Light/Dark Theme Switcher */}
        <div
          className={`p-3 border-t flex items-center justify-between gap-2 shrink-0 ${
            isDark ? 'border-slate-800 bg-slate-950/80' : 'border-slate-200 bg-slate-100/70'
          }`}
        >
          {/* Settings Button */}
          <button
            onClick={() => navTo('settings')}
            className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
              currentTab === 'settings'
                ? isDark
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-slate-900 text-white shadow-sm'
                : isDark
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/80'
            }`}
            title="Paramètres du système"
          >
            <Settings
              className={`w-4 h-4 shrink-0 ${currentTab === 'settings' ? (isDark ? 'text-slate-900' : 'text-white') : 'text-slate-400'}`}
            />
            <span>Paramètres</span>
          </button>

          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleSidebarTheme}
            className={`p-2 rounded-xl border flex items-center justify-center transition-all duration-150 cursor-pointer ${
              isDark
                ? 'bg-slate-800 border-slate-700 text-amber-400 hover:bg-slate-700 hover:text-amber-300'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
            }`}
            title={
              isDark
                ? 'Passer au mode Light pour le volet latéral'
                : 'Passer au mode Dark pour le volet latéral'
            }
            aria-label="Toggle Sidebar Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>

        {/* User Account Card & Logout Section */}
        {currentUser && (
          <div
            className={`p-3 border-t flex items-center justify-between gap-2 shrink-0 ${
              isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
            }`}
          >
            {/* Account Card */}
            <div
              className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl border min-w-0 flex-1 ${
                isDark
                  ? 'bg-slate-900 border-slate-800 text-white'
                  : 'bg-white border-slate-200/90 text-slate-900 shadow-2xs'
              }`}
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white font-bold text-[10.5px] flex items-center justify-center shadow-2xs shrink-0">
                {currentUser.avatar || 'RM'}
              </div>
              <div className="text-left leading-tight min-w-0 flex-1">
                <div
                  className={`text-[11.5px] font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
                >
                  {currentUser.name}
                </div>
                <div
                  className={`text-[9.5px] font-semibold truncate ${isDark ? 'text-emerald-400' : 'text-emerald-800'}`}
                >
                  {currentUser.titleFr || currentUser.role}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            {onLogout && (
              <button
                onClick={onLogout}
                className={`p-2 rounded-xl transition shrink-0 cursor-pointer ${
                  isDark
                    ? 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                    : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                }`}
                title="Déconnexion"
                aria-label="Déconnexion"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
