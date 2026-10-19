import { useState, useCallback } from 'react';
import {
  Sun,
  Moon,
  Laptop,
  Smartphone,
  Monitor,
  PanelLeft,
  Layers,
  RefreshCw,
  Palette,
  Eye,
  CheckCircle2,
  Table,
  Sliders,
  Clock,
  Sparkles,
  Zap,
  FileSpreadsheet,
} from 'lucide-react';
import { storageService } from '../../../utils/storageService';
import { STORAGE_KEYS } from '../../../infrastructure/persistence/storageKeys';

/**
 * Composant de sélection et personnalisation de l'apparence
 * Design 100% Light UI Excel & Multi-Device Mode (Auto / Desktop / Mobile)
 * Entièrement Responsive (Mobile, Tablette, PC Bureau & Écrans Larges)
 */
export function AppearanceLayoutSelector({
  onChange,
  showToast,
  className = '',
}) {
  // 1. Mode de rendu de l'appareil : 'auto' (détection dynamique) | 'desktop' (bureau forcé) | 'mobile' (compagnon terrain)
  const [deviceMode, setDeviceMode] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.DEVICE_MODE) || 'auto';
  });

  // 2. Thème visuel (Par défaut Light UI Excel)
  const [theme, setTheme] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.THEME) || 'light';
  });

  // 3. Style du menu latéral : 'floating' (flottant rétractable) | 'standard' (fixe ancré déployé)
  const [sidebarStyle, setSidebarStyle] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.SIDEBAR_STYLE) || 'floating';
  });

  // 4. Comportement du menu : 'push' (décale le contenu) | 'overlay' (superposition)
  const [sidebarBehavior, setSidebarBehavior] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.SIDEBAR_BEHAVIOR) || 'push';
  });

  // 5. Densité d'affichage : 'comfortable' (standard) | 'compact' (haute densité)
  const [density, setDensity] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.DENSITY) || 'comfortable';
  });

  // 6. Couleur d'accentuation : 'emerald' | 'blue' | 'indigo' | 'slate'
  const [accentColor, setAccentColor] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.ACCENT_COLOR) || 'emerald';
  });

  // 7. Options ergonomiques additionnelles (Horloge et Animations)
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.ANIMATIONS) !== 'false';
  });

  const [headerClockEnabled, setHeaderClockEnabled] = useState(() => {
    return storageService.getItem(STORAGE_KEYS.HEADER_CLOCK) !== 'false';
  });

  // Mise à jour des attributs DOM (Densité et Couleur d'accentuation)
  const applyDOMPreferences = useCallback((currentDensity, currentAccent, currentDeviceMode, currentSidebarStyle) => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-density', currentDensity);
    document.documentElement.setAttribute('data-accent', currentAccent);
    document.documentElement.setAttribute('data-device-mode', currentDeviceMode);
    document.documentElement.setAttribute('data-sidebar-style', currentSidebarStyle);
  }, []);

  // Sauvegarde globale et notification de tous les composants (Header, Sidebar, MainLayout)
  const persistAndDispatch = (
    newDeviceMode,
    newTheme,
    newStyle,
    newBehavior,
    newDensity,
    newAccent,
    newAnims,
    newClock
  ) => {
    storageService.setItem(STORAGE_KEYS.DEVICE_MODE, newDeviceMode);
    storageService.setItem(STORAGE_KEYS.THEME, newTheme);
    storageService.setItem(STORAGE_KEYS.SIDEBAR_THEME, newTheme);
    storageService.setItem(STORAGE_KEYS.SIDEBAR_STYLE, newStyle);
    storageService.setItem(STORAGE_KEYS.SIDEBAR_BEHAVIOR, newBehavior);
    storageService.setItem(STORAGE_KEYS.DENSITY, newDensity);
    storageService.setItem(STORAGE_KEYS.ACCENT_COLOR, newAccent);
    storageService.setItem(STORAGE_KEYS.ANIMATIONS, String(newAnims));
    storageService.setItem(STORAGE_KEYS.HEADER_CLOCK, String(newClock));

    applyDOMPreferences(newDensity, newAccent, newDeviceMode, newStyle);

    window.dispatchEvent(
      new CustomEvent('gmao_appearance_changed', {
        detail: {
          deviceMode: newDeviceMode,
          theme: newTheme,
          sidebarStyle: newStyle,
          sidebarBehavior: newBehavior,
          density: newDensity,
          accentColor: newAccent,
          animationsEnabled: newAnims,
          headerClockEnabled: newClock,
        },
      })
    );

    if (onChange) {
      onChange({
        deviceMode: newDeviceMode,
        theme: newTheme,
        sidebarStyle: newStyle,
        sidebarBehavior: newBehavior,
        density: newDensity,
        accentColor: newAccent,
        animationsEnabled: newAnims,
        headerClockEnabled: newClock,
      });
    }
  };

  const handleDeviceModeChange = (newMode) => {
    setDeviceMode(newMode);
    persistAndDispatch(newMode, theme, sidebarStyle, sidebarBehavior, density, accentColor, animationsEnabled, headerClockEnabled);
    if (showToast) {
      if (newMode === 'auto') {
        showToast('Mode Auto (Adaptation intelligente au navigateur) activé', 'success');
      } else if (newMode === 'desktop') {
        showToast('Mode Bureau (Desktop Forcé - Suite complète 1440px) activé', 'success');
      } else {
        showToast('Mode Compagnon Mobile (Interface tactile de terrain) activé', 'info');
      }
    }
  };

  const handleThemeChange = (newTheme) => {
    setTheme(newTheme);
    persistAndDispatch(deviceMode, newTheme, sidebarStyle, sidebarBehavior, density, accentColor, animationsEnabled, headerClockEnabled);
    if (showToast) {
      if (newTheme === 'dark') {
        showToast('Mode Sombre appliqué à la barre latérale et navigation', 'info');
      } else {
        showToast('Thème Light UI Excel actif', 'info');
      }
    }
  };

  const handleSidebarStyleChange = (newStyle) => {
    setSidebarStyle(newStyle);
    persistAndDispatch(deviceMode, theme, newStyle, sidebarBehavior, density, accentColor, animationsEnabled, headerClockEnabled);
    if (showToast) {
      showToast(newStyle === 'floating' ? 'Menu latéral flottant rétractable activé' : 'Barre latérale fixe déployée activée', 'info');
    }
  };

  const handleSidebarBehaviorChange = (newBehavior) => {
    setSidebarBehavior(newBehavior);
    persistAndDispatch(deviceMode, theme, sidebarStyle, newBehavior, density, accentColor, animationsEnabled, headerClockEnabled);
    if (showToast) {
      showToast(newBehavior === 'push' ? 'Mode décalage du contenu (Push) actif' : 'Mode superposition (Overlay) actif', 'info');
    }
  };

  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    persistAndDispatch(deviceMode, theme, sidebarStyle, sidebarBehavior, newDensity, accentColor, animationsEnabled, headerClockEnabled);
    if (showToast) {
      showToast(newDensity === 'compact' ? 'Densité compacte (haute lisibilité tableur) activée' : 'Densité confortable activée', 'info');
    }
  };

  const handleAccentChange = (newAccent) => {
    setAccentColor(newAccent);
    persistAndDispatch(deviceMode, theme, sidebarStyle, sidebarBehavior, density, newAccent, animationsEnabled, headerClockEnabled);
    if (showToast) {
      showToast("Couleur d'accentuation mise à jour", 'info');
    }
  };

  const handleToggleAnimations = () => {
    const nextVal = !animationsEnabled;
    setAnimationsEnabled(nextVal);
    persistAndDispatch(deviceMode, theme, sidebarStyle, sidebarBehavior, density, accentColor, nextVal, headerClockEnabled);
    if (showToast) {
      showToast(nextVal ? 'Animations d’interface activées' : 'Animations réduites', 'info');
    }
  };

  const handleToggleClock = () => {
    const nextVal = !headerClockEnabled;
    setHeaderClockEnabled(nextVal);
    persistAndDispatch(deviceMode, theme, sidebarStyle, sidebarBehavior, density, accentColor, animationsEnabled, nextVal);
    if (showToast) {
      showToast(nextVal ? 'Horloge industrielle activée dans la barre supérieure' : 'Horloge masquée', 'info');
    }
  };

  const handleResetDefaults = () => {
    setDeviceMode('auto');
    setTheme('light');
    setSidebarStyle('floating');
    setSidebarBehavior('push');
    setDensity('comfortable');
    setAccentColor('emerald');
    setAnimationsEnabled(true);
    setHeaderClockEnabled(true);

    persistAndDispatch('auto', 'light', 'floating', 'push', 'comfortable', 'emerald', true, true);

    if (showToast) {
      showToast("Préférences réinitialisées au standard Light UI Excel", 'success');
    }
  };

  return (
    <div className={`w-full space-y-6 text-slate-800 ${className}`}>
      {/* 1. EN-TÊTE PRINCIPAL (Format Light UI Excel - Pleine Largeur) */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Palette className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Personnalisation de l'Apparence & Ergonomie
              </h3>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                CIOB GMAO v4
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
              Configurez le mode d'affichage (Auto / Desktop / Mobile), le style du menu flottant ou fixe, l'horloge supérieure et la densité des tableaux.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleResetDefaults}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs transition active:scale-95 shrink-0 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
          <span>Valeurs d'usine</span>
        </button>
      </div>

      {/* 2. GRILLE RESPONSIVE 2 COLONNES SUR PC / 1 COLONNE SUR MOBILE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* COLONNE GAUCHE */}
        <div className="space-y-6">
          {/* SECTION 1 : MODE D'AFFICHAGE ET APPAREIL (Auto vs Desktop vs Mobile) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Monitor className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Mode d'affichage & Cible de l'appareil
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Adaptation automatique ou mode Ordinateur de Bureau forcé.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Mode Automatique */}
              <button
                type="button"
                onClick={() => handleDeviceModeChange('auto')}
                className={`group relative rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  deviceMode === 'auto'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {deviceMode === 'auto' && (
                  <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Laptop className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-xs text-slate-900">
                      Mode Auto
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Détection intelligente de l'appareil.
                  </p>
                </div>
              </button>

              {/* Mode Desktop Forcé */}
              <button
                type="button"
                onClick={() => handleDeviceModeChange('desktop')}
                className={`group relative rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  deviceMode === 'desktop'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {deviceMode === 'desktop' && (
                  <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Monitor className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-xs text-slate-900">
                      Poste Bureau
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Suite complète 1440px sur tout écran.
                  </p>
                </div>
              </button>

              {/* Mode Mobile Forcé */}
              <button
                type="button"
                onClick={() => handleDeviceModeChange('mobile')}
                className={`group relative rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  deviceMode === 'mobile'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                {deviceMode === 'mobile' && (
                  <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                    <CheckCircle2 className="h-3 w-3" />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Smartphone className="w-4 h-4 text-purple-600" />
                    <span className="font-bold text-xs text-slate-900">
                      Compagnon
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Interface tactile simplifiée de terrain.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2 : STYLE ET DISPOSITION DU MENU LATÉRAL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shrink-0">
                  <PanelLeft className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Disposition & Style de la barre latérale
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Menu flottant rétractable ou barre fixe ancrée déployée.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Choix Style */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Style Flottant */}
                <button
                  type="button"
                  onClick={() => handleSidebarStyleChange('floating')}
                  className={`relative rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
                    sidebarStyle === 'floating'
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {sidebarStyle === 'floating' && (
                    <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                  )}
                  <span className="block text-xs font-bold text-slate-900">
                    Menu Flottant
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-1 leading-normal">
                    Dock rétractable (icône dans la page) + En-tête flottant capsule
                  </span>
                </button>

                {/* Style Standard Fixe */}
                <button
                  type="button"
                  onClick={() => handleSidebarStyleChange('standard')}
                  className={`relative rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
                    sidebarStyle === 'standard'
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {sidebarStyle === 'standard' && (
                    <div className="absolute top-2.5 right-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                      <CheckCircle2 className="h-3 w-3" />
                    </div>
                  )}
                  <span className="block text-xs font-bold text-slate-900">
                    Barre Fixe
                  </span>
                  <span className="block text-[11px] text-slate-500 mt-1 leading-normal">
                    Ancrée fixe (270px) + En-tête rectangulaire continue
                  </span>
                </button>
              </div>

              {/* Comportement Flottant (Overlay vs Push) */}
              {sidebarStyle !== 'standard' ? (
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Comportement en mode flottant
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSidebarBehaviorChange('overlay')}
                      className={`relative rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                        sidebarBehavior === 'overlay'
                          ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {sidebarBehavior === 'overlay' && (
                        <div className="absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        </div>
                      )}
                      <span className="block text-xs font-bold text-slate-900">
                        Superposition (Overlay)
                      </span>
                      <span className="block text-[10.5px] text-slate-500 mt-0.5">
                        L'icône flotte sur la page
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSidebarBehaviorChange('push')}
                      className={`relative rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                        sidebarBehavior === 'push'
                          ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {sidebarBehavior === 'push' && (
                        <div className="absolute top-2 right-2 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        </div>
                      )}
                      <span className="block text-xs font-bold text-slate-900">
                        Décalage (Push)
                      </span>
                      <span className="block text-[10.5px] text-slate-500 mt-0.5">
                        Décale le contenu à droite
                      </span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-800">Mode Fixe Déployé : </span>
                  La barre latérale reste ancrée à 270px sans masquer le contenu principal.
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3 : THÈME VISUEL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                  <Sun className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Thème d'affichage de la navigation
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Contraste visuel pour la barre latérale et les menus.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                type="button"
                onClick={() => handleThemeChange('light')}
                className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <div className="text-left">
                    <span className="block text-xs font-bold text-slate-900">Thème Clair (Standard)</span>
                    <span className="block text-[10.5px] text-slate-500">Haute lisibilité en atelier</span>
                  </div>
                </div>
                {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              </button>

              <button
                type="button"
                onClick={() => handleThemeChange('dark')}
                className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-slate-700 bg-slate-100 ring-2 ring-slate-400/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Moon className="w-4 h-4 text-slate-700" />
                  <div className="text-left">
                    <span className="block text-xs font-bold text-slate-900">Thème Sombre</span>
                    <span className="block text-[10.5px] text-slate-500">Barre latérale sombre</span>
                  </div>
                </div>
                {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-slate-800" />}
              </button>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE */}
        <div className="space-y-6">
          {/* SECTION 4 : APERÇU INTERACTIF EN DIRECT */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Aperçu en direct de l'espace de travail
                </h4>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <span>Mode : {deviceMode}</span>
                <span aria-hidden="true">·</span>
                <span>Menu : {sidebarStyle === 'floating' ? 'Flottant' : 'Barre Fixe'}</span>
              </div>
            </div>

            {/* Maquette dynamique en Light UI Excel */}
            <div className="h-52 w-full rounded-xl p-3 relative overflow-hidden border border-slate-200 bg-slate-50/90 text-slate-900 shadow-inner">
              {/* Barre supérieure simulée (Excel Header) */}
              <div
                className={`h-8 flex items-center justify-between mb-2.5 text-[11px] font-semibold border border-slate-200 bg-white transition-all ${
                  sidebarStyle === 'standard'
                    ? 'w-full rounded-none px-4 shadow-2xs border-b border-x-0 border-t-0'
                    : 'w-[calc(100%-0.5rem)] mx-auto rounded-full px-3 shadow-xs'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-900">CIOB GMAO</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-[10px] text-slate-500 font-normal">Supervision Ateliers</span>
                </div>

                <div className="flex items-center gap-2 font-mono text-[10px] text-slate-600">
                  {headerClockEnabled && (
                    <span className="flex items-center gap-1 text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      <Clock className="w-3 h-3 text-emerald-600" />
                      <span>14:30:00</span>
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                    <FileSpreadsheet className="w-2.5 h-2.5" />
                    <span>Excel Twin</span>
                  </span>
                </div>
              </div>

              {/* Corps de la fenêtre de simulation */}
              <div className="flex h-[calc(100%-2.75rem)] gap-2.5 relative">
                {/* Menu latéral simulé */}
                <div
                  className={`transition-all duration-300 flex flex-col justify-between p-2 shrink-0 ${
                    sidebarStyle === 'floating'
                      ? 'w-12 rounded-xl border border-emerald-200 bg-white shadow-xs text-emerald-700'
                      : 'w-28 rounded-none border-r border-slate-200 bg-white text-slate-800'
                  } ${sidebarStyle === 'floating' && sidebarBehavior === 'overlay' ? 'absolute top-0 left-0 bottom-0 z-20 shadow-lg' : ''}`}
                >
                  <div className="space-y-1.5">
                    <div className="h-2 w-3/4 rounded bg-emerald-600/80" />
                    <div className="h-1.5 w-full rounded bg-slate-200" />
                    <div className="h-1.5 w-5/6 rounded bg-slate-200" />
                  </div>
                  <div className="h-2 w-full rounded bg-slate-100 border border-slate-200" />
                </div>

                {/* Zone de tableau simulée */}
                <div className="flex-1 rounded-xl p-3 space-y-2 border border-slate-200 bg-white shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-700 font-mono">STOCK_PDR_ACTIF.XLSX</span>
                    </div>
                    <div className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                      10 000+ Lignes
                    </div>
                  </div>

                  {/* Lignes de données */}
                  <div className={density === 'compact' ? 'space-y-1' : 'space-y-1.5'}>
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-200/80 text-[10px] font-mono">
                      <span className="font-semibold text-slate-700">ROUL-SKF-6204-2RS</span>
                      <span className="font-bold text-emerald-700">142 unités</span>
                    </div>
                    <div className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-200/80 text-[10px] font-mono">
                      <span className="font-semibold text-slate-700">JOINT-TOR-NBR-45</span>
                      <span className="font-bold text-emerald-700">85 unités</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5 : DENSITÉ & IDENTITÉ VISUELLE */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 flex items-center justify-center shrink-0">
                  <Table className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Densité des tableaux & Couleur d'accent
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Espacement des lignes de données et palette dominante.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Densité */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleDensityChange('comfortable')}
                  className={`rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                    density === 'comfortable'
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">Confortable</span>
                    {density === 'comfortable' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    Espacement aéré adapté au tactile.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDensityChange('compact')}
                  className={`rounded-xl border-2 p-3 text-left transition-all cursor-pointer ${
                    density === 'compact'
                      ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-slate-900">Compacte</span>
                    {density === 'compact' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                  </div>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    Haute densité de lignes par écran.
                  </p>
                </button>
              </div>

              {/* Accents */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sliders className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Couleur d'accentuation
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'emerald', label: 'Vert Usine', colorClass: 'bg-emerald-600', borderActive: 'border-emerald-600' },
                    { id: 'blue', label: 'Bleu', colorClass: 'bg-blue-600', borderActive: 'border-blue-600' },
                    { id: 'indigo', label: 'Indigo', colorClass: 'bg-indigo-600', borderActive: 'border-indigo-600' },
                    { id: 'slate', label: 'Ardoise', colorClass: 'bg-slate-700', borderActive: 'border-slate-700' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleAccentChange(item.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border-2 transition-all cursor-pointer ${
                        accentColor === item.id
                          ? `${item.borderActive} bg-slate-50 ring-2 ring-slate-400/20`
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <span className={`w-3.5 h-3.5 rounded-full ${item.colorClass} shrink-0`} />
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6 : OPTIONS ERGONOMIQUES ET HORLOGE INDUSTRIELLE */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    Options de la barre supérieure et fluidité
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Horloge industrielle en direct et transitions fluides.
                  </p>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {/* Option Horloge en direct */}
              <div className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Horloge industrielle en direct (Barre Supérieure)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Affiche l'heure exacte locale par seconde dans la barre supérieure.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleClock}
                  role="switch"
                  aria-checked={headerClockEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                    headerClockEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      headerClockEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Option Animations */}
              <div className="py-2.5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Transitions et animations fluides (60fps)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Active les transitions douces des volets et des fenêtres modales.
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleToggleAnimations}
                  role="switch"
                  aria-checked={animationsEnabled}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                    animationsEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform ${
                      animationsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppearanceLayoutSelector;
