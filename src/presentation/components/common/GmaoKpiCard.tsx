import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type GmaoKpiColor =
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'cyan'
  | 'indigo'
  | 'teal'
  | 'slate';

export interface GmaoKpiCardProps {
  id?: string;
  title: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  color?: GmaoKpiColor;
  /** Default true: colors the main value with the theme color (false keeps slate-900 with hover color) */
  valueColored?: boolean;
  /** Optional custom content in the 3rd tier (badges/pills row) */
  badges?: React.ReactNode;
  /** Shortcut for a single primary badge pill in the 3rd tier */
  badgeText?: React.ReactNode;
  /** Optional prefix text before the badge in the 3rd tier */
  badgePrefix?: React.ReactNode;
  /** Left label in the 4th tier footer */
  footerLabel?: React.ReactNode;
  /** Right value in the 4th tier footer */
  footerValue?: React.ReactNode;
  /** Optional progress bar percentage (0-100) rendered inside the footer */
  progressBarPercent?: number;
  /** Interactive filter active state */
  isActive?: boolean;
  /** Click handler for filtering or navigation */
  onClick?: () => void;
  /** Pulse animation on the icon (e.g., critical alerts) */
  pulseIcon?: boolean;
  /** Pulse animation on the badge */
  pulseBadge?: boolean;
  className?: string;
}

interface ColorThemeStyles {
  activeBorder: string;
  hoverBorder: string;
  glow: string;
  iconText: string;
  valueText: string;
  valueHover: string;
  badgeBg: string;
  footerText: string;
  progressBarBg: string;
  progressBarFill: string;
}

const COLOR_MAP: Record<GmaoKpiColor, ColorThemeStyles> = {
  blue: {
    activeBorder: 'border-blue-400 ring-2 ring-blue-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-blue-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(59,130,246,0.12)]',
    glow: 'bg-blue-500/5 group-hover:bg-blue-500/10',
    iconText: 'text-blue-600',
    valueText: 'text-blue-600',
    valueHover: 'text-slate-900 group-hover:text-blue-600',
    badgeBg: 'text-blue-700 bg-blue-50 border-blue-200/80',
    footerText: 'text-blue-700',
    progressBarBg: 'bg-blue-100',
    progressBarFill: 'bg-blue-600',
  },
  emerald: {
    activeBorder: 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-emerald-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(16,185,129,0.12)]',
    glow: 'bg-emerald-500/5 group-hover:bg-emerald-500/10',
    iconText: 'text-emerald-600',
    valueText: 'text-emerald-600',
    valueHover: 'text-slate-900 group-hover:text-emerald-600',
    badgeBg: 'text-emerald-700 bg-emerald-50 border-emerald-200/80',
    footerText: 'text-emerald-700',
    progressBarBg: 'bg-emerald-100',
    progressBarFill: 'bg-emerald-600',
  },
  amber: {
    activeBorder: 'border-amber-400 ring-2 ring-amber-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-amber-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(245,158,11,0.12)]',
    glow: 'bg-amber-500/5 group-hover:bg-amber-500/10',
    iconText: 'text-amber-600',
    valueText: 'text-amber-600',
    valueHover: 'text-slate-900 group-hover:text-amber-600',
    badgeBg: 'text-amber-800 bg-amber-50 border-amber-200/80',
    footerText: 'text-amber-700',
    progressBarBg: 'bg-amber-100',
    progressBarFill: 'bg-amber-600',
  },
  rose: {
    activeBorder: 'border-rose-400 ring-2 ring-rose-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-rose-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(244,63,94,0.12)]',
    glow: 'bg-rose-500/5 group-hover:bg-rose-500/10',
    iconText: 'text-rose-600',
    valueText: 'text-rose-600',
    valueHover: 'text-slate-900 group-hover:text-rose-600',
    badgeBg: 'text-rose-700 bg-rose-50 border-rose-200/80',
    footerText: 'text-rose-700',
    progressBarBg: 'bg-rose-100',
    progressBarFill: 'bg-rose-600',
  },
  purple: {
    activeBorder: 'border-purple-400 ring-2 ring-purple-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-purple-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(168,85,247,0.12)]',
    glow: 'bg-purple-500/5 group-hover:bg-purple-500/10',
    iconText: 'text-purple-600',
    valueText: 'text-purple-600',
    valueHover: 'text-slate-900 group-hover:text-purple-600',
    badgeBg: 'text-purple-700 bg-purple-50 border-purple-200/80',
    footerText: 'text-purple-700',
    progressBarBg: 'bg-purple-100',
    progressBarFill: 'bg-purple-600',
  },
  cyan: {
    activeBorder: 'border-cyan-400 ring-2 ring-cyan-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-cyan-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(6,182,212,0.12)]',
    glow: 'bg-cyan-500/5 group-hover:bg-cyan-500/10',
    iconText: 'text-cyan-600',
    valueText: 'text-cyan-600',
    valueHover: 'text-slate-900 group-hover:text-cyan-600',
    badgeBg: 'text-cyan-700 bg-cyan-50 border-cyan-200/80',
    footerText: 'text-cyan-700',
    progressBarBg: 'bg-cyan-100',
    progressBarFill: 'bg-cyan-600',
  },
  indigo: {
    activeBorder: 'border-indigo-400 ring-2 ring-indigo-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-indigo-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(99,102,241,0.12)]',
    glow: 'bg-indigo-500/5 group-hover:bg-indigo-500/10',
    iconText: 'text-indigo-600',
    valueText: 'text-indigo-600',
    valueHover: 'text-slate-900 group-hover:text-indigo-600',
    badgeBg: 'text-indigo-700 bg-indigo-50 border-indigo-200/80',
    footerText: 'text-indigo-700',
    progressBarBg: 'bg-indigo-100',
    progressBarFill: 'bg-indigo-600',
  },
  teal: {
    activeBorder: 'border-teal-400 ring-2 ring-teal-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-teal-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(20,184,166,0.12)]',
    glow: 'bg-teal-500/5 group-hover:bg-teal-500/10',
    iconText: 'text-teal-600',
    valueText: 'text-teal-600',
    valueHover: 'text-slate-900 group-hover:text-teal-600',
    badgeBg: 'text-teal-700 bg-teal-50 border-teal-200/80',
    footerText: 'text-teal-700',
    progressBarBg: 'bg-teal-100',
    progressBarFill: 'bg-teal-600',
  },
  slate: {
    activeBorder: 'border-slate-400 ring-2 ring-slate-400/30 shadow-md',
    hoverBorder: 'border-slate-200/90 hover:border-slate-300/80 shadow-[0_4px_16px_-2px_rgba(0,0,0,0.05)] hover:shadow-[0_12px_28px_-4px_rgba(100,116,139,0.12)]',
    glow: 'bg-slate-500/5 group-hover:bg-slate-500/10',
    iconText: 'text-slate-600',
    valueText: 'text-slate-800',
    valueHover: 'text-slate-900 group-hover:text-slate-700',
    badgeBg: 'text-slate-700 bg-slate-100 border-slate-200/80',
    footerText: 'text-slate-700',
    progressBarBg: 'bg-slate-100',
    progressBarFill: 'bg-slate-600',
  },
};

/**
 * 🏛️ Unified Mature Light Excel KPI Card Archetype (4-Tier Structure)
 * Standardized across all L1 operational pages:
 * - Tier 1: Uppercase Title + Free Icon (w-6 h-6)
 * - Tier 2: 3xl Monospace Value + Unit
 * - Tier 3: Contextual Light Excel Badges / Formula Cues
 * - Tier 4: Divided Footer (border-t border-slate-100) with Label + Metric/Progress
 */
export function GmaoKpiCard({
  id,
  title,
  value,
  unit,
  icon: Icon,
  color = 'blue',
  valueColored = true,
  badges,
  badgeText,
  badgePrefix,
  footerLabel,
  footerValue,
  progressBarPercent,
  isActive = false,
  onClick,
  pulseIcon = false,
  pulseBadge = false,
  className = '',
}: GmaoKpiCardProps) {
  const theme = COLOR_MAP[color] || COLOR_MAP.blue;
  const isClickable = typeof onClick === 'function';

  return (
    <div
      id={id}
      onClick={onClick}
      className={`bg-white p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden group flex flex-col justify-between ${
        isClickable ? 'cursor-pointer hover:-translate-y-1' : ''
      } ${isActive ? theme.activeBorder : theme.hoverBorder} ${className}`}
    >
      {/* Ambient Corner Glow */}
      <div
        className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-xl pointer-events-none transition-colors ${theme.glow}`}
      />

      <div>
        {/* Tier 1: Title & Free Icon */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10.5px] font-extrabold text-slate-500 uppercase tracking-wider truncate">
            {title}
          </span>
          <Icon
            className={`w-6 h-6 shrink-0 group-hover:scale-110 transition-transform ${theme.iconText} ${
              pulseIcon ? 'animate-pulse' : ''
            }`}
          />
        </div>

        {/* Tier 2: Main Monospace Number & Unit */}
        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-black font-mono tracking-tight transition-colors ${
              valueColored ? theme.valueText : theme.valueHover
            }`}
          >
            {value}
          </span>
          {unit && (
            <span className="text-xs font-bold text-slate-400 font-mono truncate">
              {unit}
            </span>
          )}
        </div>

        {/* Tier 3: Contextual Light Excel Badges */}
        {(badges || badgeText) && (
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
            {badges ? (
              badges
            ) : (
              <>
                {badgePrefix && (
                  <>
                    <span className="font-semibold text-slate-700">{badgePrefix}</span>
                    <span>•</span>
                  </>
                )}
                <span
                  className={`font-bold px-1.5 py-0.5 rounded border font-mono ${theme.badgeBg} ${
                    pulseBadge ? 'animate-pulse' : ''
                  }`}
                >
                  {badgeText}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tier 4: Analytical Footer */}
      {(footerLabel !== undefined || footerValue !== undefined || progressBarPercent !== undefined) && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          {(footerLabel !== undefined || footerValue !== undefined) && (
            <div className="flex items-center justify-between text-[11px] gap-2">
              <span className="text-slate-400 font-medium truncate">{footerLabel}</span>
              <span className={`font-mono font-bold shrink-0 ${theme.footerText}`}>
                {footerValue}
              </span>
            </div>
          )}
          {progressBarPercent !== undefined && (
            <div className={`w-full ${theme.progressBarBg} h-1.5 rounded-full mt-1.5 overflow-hidden`}>
              <div
                className={`${theme.progressBarFill} h-full rounded-full transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, progressBarPercent))}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface GmaoKpiGridProps {
  id?: string;
  columns?: 4 | 5;
  children: React.ReactNode;
  className?: string;
}

/**
 * 🏛️ Unified KPI Grid Container supporting 4 or 5 columns flexibly
 */
export function GmaoKpiGrid({
  id,
  columns = 4,
  children,
  className = '',
}: GmaoKpiGridProps) {
  const gridColsClass =
    columns === 5
      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div id={id} className={`grid ${gridColsClass} gap-4 ${className}`}>
      {children}
    </div>
  );
}

export default GmaoKpiCard;
