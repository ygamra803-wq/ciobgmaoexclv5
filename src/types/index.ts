export * from './domain';
export * from './corrective';
export * from './preventive';
export * from './security';
export * from './sync';
export * from './kpis';
export * from './store';

export type NavigationTab =
  | 'dashboard'
  | 'stock'
  | 'sortie'
  | 'entrepot'
  | 'types'
  | 'designations'
  | 'machines'
  | 'comp_groups'
  | 'comp_families'
  | 'comp_templates'
  | 'part_types'
  | 'part_designations'
  | 'families'
  | 'templates'
  | 'blueprints'
  | 'zones'
  | 'utilisateurs'
  | 'settings'
  | 'nexus'
  | 'guide';

export interface IToast {
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export interface ICounts {
  stock?: number;
  types?: number;
  designations?: number;
  diagnostics?: number;
  machines?: number;
  families?: number;
  templates?: number;
  blueprints?: number;
  warehouse?: number;
  entrepot?: number;
  compGroups?: number;
  compFamilies?: number;
  compTemplates?: number;
  partTypes?: number;
  partDesignations?: number;
  zones?: number;
  technicians?: number;
  operations?: number;
}

