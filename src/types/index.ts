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
  | 'pdr_groups'
  | 'types'
  | 'designations'
  | 'machines'
  | 'comp_groups'
  | 'comp_families'
  | 'comp_templates'
  | 'part_groups'
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
  pdr_groups?: number;
  pdrGroups?: number;
  types?: number;
  designations?: number;
  diagnostics?: number;
  machines?: number;
  families?: number;
  templates?: number;
  blueprints?: number;
  warehouse?: number;
  entrepot?: number;
  comp_groups?: number;
  compGroups?: number;
  comp_families?: number;
  compFamilies?: number;
  comp_templates?: number;
  compTemplates?: number;
  part_groups?: number;
  partGroups?: number;
  partTypes?: number;
  partDesignations?: number;
  zones?: number;
  technicians?: number;
  operations?: number;
}

