import {
  LayoutDashboard,
  Package,
  Factory,
  Warehouse,
  MapPin,
  Users,
  GitBranch,
  BookOpen,
  Calendar,
  Wrench
} from 'lucide-react';

export const PARENT_MODULES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-blue-500',
    colorDark: 'text-blue-400',
    bgLight: 'bg-blue-50',
    children: [
      { id: 'dashboard', label: 'Dashboard Opérations' },
      { id: 'executive_report', label: 'Rapport Mensuel Direction' }
    ]
  },
  {
    id: 'stock',
    label: 'Stock PDR',
    icon: Package,
    color: 'text-cyan-500',
    colorDark: 'text-cyan-400',
    bgLight: 'bg-cyan-50',
    children: [
      { id: 'stock', label: 'Stock Articles' },
      { id: 'types', label: 'Types PDR' },
      { id: 'designations', label: 'Désignations PDR' },
      { id: 'sortie', label: 'Mouvements' }
    ]
  },
  {
    id: 'machines',
    label: 'Machines',
    icon: Factory,
    color: 'text-emerald-500',
    colorDark: 'text-emerald-400',
    bgLight: 'bg-emerald-50',
    children: [
      { id: 'machines', label: 'Machines Registered' },
      { id: 'families', label: 'Familles' },
      { id: 'templates', label: 'Templates' },
      { id: 'blueprints', label: 'Blueprints' }
    ]
  },
  {
    id: 'preventive',
    label: 'Préventif',
    icon: Calendar,
    color: 'text-indigo-500',
    colorDark: 'text-indigo-400',
    bgLight: 'bg-indigo-50',
    children: [
      { id: 'preventive', label: 'Planning Préventif' },
      { id: 'preventive_referentiel', label: 'Ingénierie & Référentiel' }
    ]
  },
  {
    id: 'corrective',
    label: 'Correctif Nexus',
    icon: Wrench,
    color: 'text-amber-500',
    colorDark: 'text-amber-400',
    bgLight: 'bg-amber-50',
    children: [
      { id: 'corrective', label: 'Correctif Hub' },
      { id: 'corrective_referentiel', label: 'Catalogue & Données GMAO' }
    ]
  },
  {
    id: 'entrepot',
    label: 'Entrepôt',
    icon: Warehouse,
    color: 'text-indigo-500',
    colorDark: 'text-indigo-400',
    bgLight: 'bg-indigo-50',
    children: [
      { id: 'entrepot', label: 'Stock Entrepôt' },
      { id: 'comp_groups', label: 'Groupes Composants' },
      { id: 'comp_families', label: 'Familles Composants' },
      { id: 'comp_templates', label: 'Templates Composants' },
      { id: 'part_types', label: 'Types Parts' },
      { id: 'part_designations', label: 'Désignations Parts' }
    ]
  },
  {
    id: 'zones',
    label: 'Zones & Ateliers',
    icon: MapPin,
    color: 'text-purple-500',
    colorDark: 'text-purple-400',
    bgLight: 'bg-purple-50',
    children: [
      { id: 'zones', label: 'Zones & Ateliers' }
    ]
  },
  {
    id: 'utilisateurs',
    label: 'Utilisateurs',
    icon: Users,
    color: 'text-violet-500',
    colorDark: 'text-violet-400',
    bgLight: 'bg-violet-50',
    children: [
      { id: 'utilisateurs', label: 'Utilisateurs & Rôles' }
    ]
  },
  {
    id: 'nexus',
    label: 'Nexus Matrix',
    icon: GitBranch,
    color: 'text-emerald-500',
    colorDark: 'text-emerald-400',
    bgLight: 'bg-emerald-50',
    children: [
      { id: 'nexus', label: 'Nexus Matrix' }
    ]
  },
  {
    id: 'guide',
    label: 'Guide & Manuel',
    icon: BookOpen,
    color: 'text-amber-500',
    colorDark: 'text-amber-400',
    bgLight: 'bg-amber-50',
    children: [
      { id: 'guide', label: "Guide d'utilisation" },
      { id: 'settings', label: 'Paramètres' }
    ]
  }
];

export function getParentModuleForTab(currentTab) {
  const match = PARENT_MODULES.find(p => p.children.some(c => c.id === currentTab));
  return match || PARENT_MODULES[0];
}
