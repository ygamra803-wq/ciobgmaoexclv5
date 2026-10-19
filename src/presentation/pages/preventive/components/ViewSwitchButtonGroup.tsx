import { Grid, Factory, CalendarDays, List, CalendarRange, BarChart3 } from 'lucide-react';
import { useI18n } from '../../../../i18n/I18nContext';

const VIEW_DEFINITIONS = [
  {
    id: 'monthly_grid',
    key: 'preventive.view_modes.days_grid',
    fallbackLabel: 'Grille Planning Mensuel (Jours J1→J31)',
    icon: CalendarRange,
    activeClasses: 'hover:bg-cyan-50/80 hover:border-cyan-400 text-cyan-700 hover:text-cyan-950 hover:shadow-[0_8px_20px_-3px_rgba(6,182,212,0.3),0_3px_8px_-2px_rgba(6,182,212,0.15)]',
    pingColor: 'bg-cyan-400',
    ringColor: 'bg-cyan-600',
  },
  {
    id: 'matrix',
    key: 'preventive.view_modes.weeks_matrix',
    fallbackLabel: 'Matrice Préventive S1→S52',
    icon: Grid,
    activeClasses: 'hover:bg-indigo-50/80 hover:border-indigo-400 text-indigo-700 hover:text-indigo-950 hover:shadow-[0_8px_20px_-3px_rgba(99,102,241,0.3),0_3px_8px_-2px_rgba(99,102,241,0.15)]',
    pingColor: 'bg-indigo-400',
    ringColor: 'bg-indigo-600',
  },
  {
    id: 'grouped',
    key: 'preventive.view_modes.by_machine',
    fallbackLabel: 'Vue Synthétique par Machine',
    icon: Factory,
    activeClasses: 'hover:bg-amber-50/80 hover:border-amber-400 text-amber-700 hover:text-amber-950 hover:shadow-[0_8px_20px_-3px_rgba(245,158,11,0.3),0_3px_8px_-2px_rgba(245,158,11,0.15)]',
    pingColor: 'bg-amber-400',
    ringColor: 'bg-amber-600',
  },
  {
    id: 'calendar',
    key: 'preventive.view_modes.monthly_calendar',
    fallbackLabel: 'Planning Calendrier Mensuel',
    icon: CalendarDays,
    activeClasses: 'hover:bg-teal-50/80 hover:border-teal-400 text-teal-700 hover:text-teal-950 hover:shadow-[0_8px_20px_-3px_rgba(20,184,166,0.3),0_3px_8px_-2px_rgba(20,184,166,0.15)]',
    pingColor: 'bg-teal-400',
    ringColor: 'bg-teal-600',
  },
  {
    id: 'list',
    key: 'preventive.view_modes.tasks_list',
    fallbackLabel: 'Tableau Détaillé des Tâches',
    icon: List,
    activeClasses: 'hover:bg-blue-50/80 hover:border-blue-400 text-blue-700 hover:text-blue-950 hover:shadow-[0_8px_20px_-3px_rgba(59,130,246,0.3),0_3px_8px_-2px_rgba(59,130,246,0.15)]',
    pingColor: 'bg-blue-400',
    ringColor: 'bg-blue-600',
  },
  {
    id: 'analytics',
    key: 'preventive.view_modes.analytics',
    fallbackLabel: 'Statistiques & Ratios KPIs',
    icon: BarChart3,
    activeClasses: 'hover:bg-purple-50/80 hover:border-purple-400 text-purple-700 hover:text-purple-950 hover:shadow-[0_8px_20px_-3px_rgba(168,85,247,0.3),0_3px_8px_-2px_rgba(168,85,247,0.15)]',
    pingColor: 'bg-purple-400',
    ringColor: 'bg-purple-600',
  },
];

/**
 * Reusable 3D Iconic Switch Button Group for Preventive View Navigation.
 * Shows distinct 3D tactile buttons for all OTHER view modes to allow instantaneous switching.
 */
export default function ViewSwitchButtonGroup({
  currentView = 'matrix',
  onSwitchView = () => {},
  className = '',
}) {
  const { t } = useI18n();

  // Exclude current view to leave exactly the other navigation destinations
  const destinationViews = VIEW_DEFINITIONS.filter((v) => v.id !== currentView);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {destinationViews.map((view) => {
        const IconComponent = view.icon;
        const resolvedLabel = t(view.key, view.fallbackLabel);

        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onSwitchView(view.id)}
            className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white border border-slate-200/90 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.05)] active:translate-y-0.5 active:scale-95 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center group/switch cursor-pointer shrink-0 ${view.activeClasses}`}
            title={`${t('preventive.view_modes.switch_to', 'Basculer vers :')} ${resolvedLabel}`}
          >
            <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-300 group-hover/switch:scale-110" />
            <span className="sr-only">{resolvedLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
