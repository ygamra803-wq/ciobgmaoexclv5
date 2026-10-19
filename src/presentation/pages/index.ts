// Centralized exports for all application pages
export { default as DashboardView } from './dashboard';
export { default as StockView } from './stock';
export { default as MachinesRegisteredView } from './machines';
export { default as SortieRapideView } from './sortie-rapide';
export { default as EntrepotView } from './entrepot';
export { default as ZonesView } from './zones';
export { default as UtilisateursView } from './utilisateurs';
export { default as SettingsView } from './settings';

// Nomenclature pages
export { default as TypeView } from './types';
export { default as DesignationView, DiagnosticView } from './designations';
export { default as FamilyView } from './families';
export { default as TemplatesView } from './templates';
export { default as CompFamilyView } from './comp-families';
export { default as CompTemplateView } from './comp-templates';
export { default as PartTypeView } from './part-types';
export { default as PartDesignationView } from './part-designations';

// Auth and system pages
export * from './auth';
export * from './system';
