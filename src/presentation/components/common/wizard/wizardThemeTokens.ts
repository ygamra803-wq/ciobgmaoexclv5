import type { WizardModuleKey, WizardThemeColor } from './wizard.types';

/**
 * Canonical module-to-theme color rule for Mature Light Excel consistency:
 * - Machines & Actifs -> emerald
 * - Stock / Sortie & Entrée / Entrepôt -> teal
 * - Maintenance Corrective (DI / BT) -> amber
 * - Maintenance Préventive -> indigo
 */
export const WIZARD_MODULE_THEME_MAP: Record<WizardModuleKey, WizardThemeColor> = {
  global: 'emerald',
  machines_onboarding: 'emerald',
  stock_rapid_movement: 'teal',
  stock_article: 'teal',
  entrepot_component: 'teal',
  corrective_di: 'amber',
  corrective_bt: 'amber',
  preventive_plan: 'indigo',
};

export function resolveWizardThemeColor(
  themeColor?: WizardThemeColor,
  moduleKey?: WizardModuleKey
): WizardThemeColor {
  if (moduleKey && WIZARD_MODULE_THEME_MAP[moduleKey]) {
    return WIZARD_MODULE_THEME_MAP[moduleKey];
  }
  return themeColor ?? 'emerald';
}

export interface WizardThemeTokens {
  headerBadgeBg: string;
  headerBadgeText: string;
  headerBadgeBorder: string;
  activeCircleBg: string;
  activeCircleBorder: string;
  activeCircleText: string;
  activeHalo: string;
  activeTitleText: string;
  activeCardBg: string;
  activeCardBorder: string;
  progressBarFill: string;
  primaryButtonBg: string;
  primaryButtonHover: string;
  primaryButtonShadow: string;
  stepIconBoxBg: string;
  stepIconBoxBorder: string;
  stepIconColor: string;
}

export const WIZARD_THEME_TOKENS: Record<WizardThemeColor, WizardThemeTokens> = {
  emerald: {
    headerBadgeBg: 'bg-emerald-50/90',
    headerBadgeText: 'text-emerald-700',
    headerBadgeBorder: 'border-emerald-200/80',
    activeCircleBg: 'bg-white',
    activeCircleBorder: 'border-emerald-600',
    activeCircleText: 'text-emerald-700',
    activeHalo: 'ring-4 ring-emerald-500/15',
    activeTitleText: 'text-emerald-950',
    activeCardBg: 'bg-emerald-50/50',
    activeCardBorder: 'border-emerald-200/80',
    progressBarFill: 'bg-emerald-600',
    primaryButtonBg: 'bg-emerald-600',
    primaryButtonHover: 'hover:bg-emerald-700',
    primaryButtonShadow: 'shadow-emerald-600/20',
    stepIconBoxBg: 'bg-emerald-50/80',
    stepIconBoxBorder: 'border-emerald-200/80',
    stepIconColor: 'text-emerald-600',
  },
  indigo: {
    headerBadgeBg: 'bg-indigo-50/90',
    headerBadgeText: 'text-indigo-700',
    headerBadgeBorder: 'border-indigo-200/80',
    activeCircleBg: 'bg-white',
    activeCircleBorder: 'border-indigo-600',
    activeCircleText: 'text-indigo-700',
    activeHalo: 'ring-4 ring-indigo-500/15',
    activeTitleText: 'text-indigo-950',
    activeCardBg: 'bg-indigo-50/50',
    activeCardBorder: 'border-indigo-200/80',
    progressBarFill: 'bg-indigo-600',
    primaryButtonBg: 'bg-indigo-600',
    primaryButtonHover: 'hover:bg-indigo-700',
    primaryButtonShadow: 'shadow-indigo-600/20',
    stepIconBoxBg: 'bg-indigo-50/80',
    stepIconBoxBorder: 'border-indigo-200/80',
    stepIconColor: 'text-indigo-600',
  },
  blue: {
    headerBadgeBg: 'bg-blue-50/90',
    headerBadgeText: 'text-blue-700',
    headerBadgeBorder: 'border-blue-200/80',
    activeCircleBg: 'bg-white',
    activeCircleBorder: 'border-blue-600',
    activeCircleText: 'text-blue-700',
    activeHalo: 'ring-4 ring-blue-500/15',
    activeTitleText: 'text-blue-950',
    activeCardBg: 'bg-blue-50/50',
    activeCardBorder: 'border-blue-200/80',
    progressBarFill: 'bg-blue-600',
    primaryButtonBg: 'bg-blue-600',
    primaryButtonHover: 'hover:bg-blue-700',
    primaryButtonShadow: 'shadow-blue-600/20',
    stepIconBoxBg: 'bg-blue-50/80',
    stepIconBoxBorder: 'border-blue-200/80',
    stepIconColor: 'text-blue-600',
  },
  amber: {
    headerBadgeBg: 'bg-amber-50/90',
    headerBadgeText: 'text-amber-700',
    headerBadgeBorder: 'border-amber-200/80',
    activeCircleBg: 'bg-white',
    activeCircleBorder: 'border-amber-600',
    activeCircleText: 'text-amber-700',
    activeHalo: 'ring-4 ring-amber-500/15',
    activeTitleText: 'text-amber-950',
    activeCardBg: 'bg-amber-50/50',
    activeCardBorder: 'border-amber-200/80',
    progressBarFill: 'bg-amber-600',
    primaryButtonBg: 'bg-amber-600',
    primaryButtonHover: 'hover:bg-amber-700',
    primaryButtonShadow: 'shadow-amber-600/20',
    stepIconBoxBg: 'bg-amber-50/80',
    stepIconBoxBorder: 'border-amber-200/80',
    stepIconColor: 'text-amber-600',
  },
  purple: {
    headerBadgeBg: 'bg-purple-50/90',
    headerBadgeText: 'text-purple-700',
    headerBadgeBorder: 'border-purple-200/80',
    activeCircleBg: 'bg-white',
    activeCircleBorder: 'border-purple-600',
    activeCircleText: 'text-purple-700',
    activeHalo: 'ring-4 ring-purple-500/15',
    activeTitleText: 'text-purple-950',
    activeCardBg: 'bg-purple-50/50',
    activeCardBorder: 'border-purple-200/80',
    progressBarFill: 'bg-purple-600',
    primaryButtonBg: 'bg-purple-600',
    primaryButtonHover: 'hover:bg-purple-700',
    primaryButtonShadow: 'shadow-purple-600/20',
    stepIconBoxBg: 'bg-purple-50/80',
    stepIconBoxBorder: 'border-purple-200/80',
    stepIconColor: 'text-purple-600',
  },
  teal: {
    headerBadgeBg: 'bg-teal-50/90',
    headerBadgeText: 'text-teal-700',
    headerBadgeBorder: 'border-teal-200/80',
    activeCircleBg: 'bg-white',
    activeCircleBorder: 'border-teal-600',
    activeCircleText: 'text-teal-700',
    activeHalo: 'ring-4 ring-teal-500/15',
    activeTitleText: 'text-teal-950',
    activeCardBg: 'bg-teal-50/50',
    activeCardBorder: 'border-teal-200/80',
    progressBarFill: 'bg-teal-600',
    primaryButtonBg: 'bg-teal-600',
    primaryButtonHover: 'hover:bg-teal-700',
    primaryButtonShadow: 'shadow-teal-600/20',
    stepIconBoxBg: 'bg-teal-50/80',
    stepIconBoxBorder: 'border-teal-200/80',
    stepIconColor: 'text-teal-600',
  },
};
