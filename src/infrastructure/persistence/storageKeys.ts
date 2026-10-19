/**
 * Canonical keys only — single source of truth for persistence key names.
 * Refer to docs/DATA_SSOT.md for the full entity & relational schema.
 */
export const STORAGE_KEYS = {
  // 1. Machines & Topology Master
  MACHINES: 'gmao_machines_v2',
  FAMILIES: 'gmao_families_v2',
  TEMPLATES: 'gmao_templates_v2',
  BLUEPRINTS: 'gmao_blueprints_v2',
  ZONES: 'gmao_zones_v2',
  MACHINE_BOM: 'gmao_machine_bom_ledger_v1',

  // 2. Stock & Movements
  RAW_STOCK: 'gmao_raw_stock_v8',
  STOCK_TYPES: 'gmao_types_v5',
  DESIGNATIONS: 'gmao_designations_v3',
  MOUVEMENTS: 'gmao_mouvements_v2',

  // 3. Preventive Maintenance
  PREVENTIVE_TASKS: 'gmao_preventive_tasks_v9',
  PREVENTIVE_ACTIONS: 'gmao_preventive_actions_v3',
  PREVENTIVE_GUIDES: 'gmao_preventive_guides_v3',
  PREVENTIVE_PLANS: 'gmao_preventive_plans_v3',
  PREVENTIVE_EXECUTIONS: 'gmao_preventive_executions_v1',

  // 4. Corrective Maintenance
  CORRECTIVE_INTERVENTIONS: 'gmao_corrective_interventions_v4',
  CORRECTIVE_ACTIONS_BY_PANNE: 'gmao_corrective_actions_by_panne_v4',
  CORRECTIVE_PANNE_CATEGORIES: 'gmao_corrective_panne_categories_v4',
  CORRECTIVE_TRAVAUX: 'gmao_corrective_travaux_v4',
  CORRECTIVE_INTERVENANTS: 'gmao_corrective_intervenants_v4',
  CORRECTIVE_ACTIVE_LIVE: 'gmao_corrective_active_live',

  // 5. Personnel & Users
  PERSONNEL: 'gmao_personnel_users_v2',
  TECHNICIANS: 'gmao_technicians_v2',
  OPERATIONS: 'gmao_operations_v2',

  // 6. Warehouse / Entrepôt
  WAREHOUSE_ITEMS: 'gmao_warehouse_items_v3',
  ENTREPOT_COMPONENTS: 'gmao_entrepot_components_v3',
  COMP_GROUPS: 'gmao_comp_groups_v2',
  COMP_FAMILIES: 'gmao_comp_families_v3',
  COMP_TEMPLATES: 'gmao_comp_templates_v3',
  PART_TYPES: 'gmao_part_types_v2',
  PART_DESIGNATIONS: 'gmao_part_designations_v2',

  // 7. Sortie Externe & Bobinage
  SORTIE_EXTERNE: 'gmao_sortie_externe_bobinage_v1',

  // 8. System & Migration Flags
  DEMO_MODE: 'gmao_demo_data_loaded_v1',
  START_MODE: 'gmao_start_mode',
  STORAGE_MIGRATED: 'gmao_storage_migrated_v1',
  FULL_STATE_SNAPSHOT: 'gmao_full_state_v1',

  // 9. Appearance & Ergonomics Preferences
  DEVICE_MODE: 'gmao_device_mode',
  SIDEBAR_STYLE: 'gmao_sidebar_style',
  SIDEBAR_BEHAVIOR: 'gmao_sidebar_behavior',
  SIDEBAR_THEME: 'gmao_sidebar_theme',
  THEME: 'gmao_theme',
  DENSITY: 'gmao_density',
  ACCENT_COLOR: 'gmao_accent_color',
  ANIMATIONS: 'gmao_animations',
  HEADER_CLOCK: 'gmao_header_clock',
  ACTIVE_TAB: 'gmao_active_tab',
};

/**
 * Legacy keys to migrate FROM → canonical (read once on startup, then removed).
 * Order matters: newer legacy versions are listed first so the freshest legacy data wins if multiple exist.
 */
export const LEGACY_KEY_MAP = {
  // Machines & Topology
  gmao_machines: STORAGE_KEYS.MACHINES,
  gmao_machines_registered_v6: STORAGE_KEYS.MACHINES,
  gmao_machines_catalog_v3: STORAGE_KEYS.MACHINES,
  gmao_machines_catalog_v2: STORAGE_KEYS.MACHINES,
  gmao_machines_catalog_v1: STORAGE_KEYS.MACHINES,
  gmao_families: STORAGE_KEYS.FAMILIES,
  gmao_families_v1: STORAGE_KEYS.FAMILIES,
  gmao_templates: STORAGE_KEYS.TEMPLATES,
  gmao_templates_v1: STORAGE_KEYS.TEMPLATES,
  gmao_blueprints_v1: STORAGE_KEYS.BLUEPRINTS,
  gmao_zones: STORAGE_KEYS.ZONES,
  gmao_zones_v1: STORAGE_KEYS.ZONES,

  // Stock & Movements
  gmao_raw_stock_v7: STORAGE_KEYS.RAW_STOCK,
  gmao_raw_stock_v6: STORAGE_KEYS.RAW_STOCK,
  gmao_raw_stock_v5: STORAGE_KEYS.RAW_STOCK,
  gmao_raw_stock_v4: STORAGE_KEYS.RAW_STOCK,
  gmao_raw_stock_v3: STORAGE_KEYS.RAW_STOCK,
  gmao_raw_stock_v2: STORAGE_KEYS.RAW_STOCK,
  gmao_raw_stock_v1: STORAGE_KEYS.RAW_STOCK,
  gmao_spare_parts: STORAGE_KEYS.RAW_STOCK,
  gmao_types: STORAGE_KEYS.STOCK_TYPES,
  gmao_types_v4: STORAGE_KEYS.STOCK_TYPES,
  gmao_types_v3: STORAGE_KEYS.STOCK_TYPES,
  gmao_types_v2: STORAGE_KEYS.STOCK_TYPES,
  gmao_types_v1: STORAGE_KEYS.STOCK_TYPES,
  gmao_designations_v2: STORAGE_KEYS.DESIGNATIONS,
  gmao_designations_v1: STORAGE_KEYS.DESIGNATIONS,
  gmao_diagnostics: STORAGE_KEYS.DESIGNATIONS,
  gmao_mouvements: STORAGE_KEYS.MOUVEMENTS,
  gmao_mouvements_v1: STORAGE_KEYS.MOUVEMENTS,
  gmao_movements: STORAGE_KEYS.MOUVEMENTS,

  // Preventive
  gmao_preventive_tasks_v8: STORAGE_KEYS.PREVENTIVE_TASKS,
  gmao_preventive_tasks_v7: STORAGE_KEYS.PREVENTIVE_TASKS,
  gmao_preventive_tasks_v6: STORAGE_KEYS.PREVENTIVE_TASKS,
  gmao_preventive_tasks_v2: STORAGE_KEYS.PREVENTIVE_TASKS,
  gmao_preventive_tasks: STORAGE_KEYS.PREVENTIVE_TASKS,
  gmao_preventive_actions_v2: STORAGE_KEYS.PREVENTIVE_ACTIONS,
  gmao_preventive_actions_v1: STORAGE_KEYS.PREVENTIVE_ACTIONS,
  gmao_preventive_guides_v2: STORAGE_KEYS.PREVENTIVE_GUIDES,
  gmao_preventive_guides_v1: STORAGE_KEYS.PREVENTIVE_GUIDES,
  gmao_preventive_plans_v2: STORAGE_KEYS.PREVENTIVE_PLANS,
  gmao_preventive_plans_v1: STORAGE_KEYS.PREVENTIVE_PLANS,

  // Corrective
  gmao_corrective_interventions: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  gmao_corrective_interventions_v3: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  gmao_corrective_interventions_v2: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  gmao_corrective_interventions_v1: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  gmao_corrective_interventions_v800: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  gmao_interventions_history: STORAGE_KEYS.CORRECTIVE_INTERVENTIONS,
  gmao_corrective_actions_by_panne_v2: STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE,
  gmao_corrective_actions_by_panne_v1: STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE,
  gmao_corrective_panne_categories_v1: STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES,
  gmao_corrective_travaux_v1: STORAGE_KEYS.CORRECTIVE_TRAVAUX,
  gmao_corrective_intervenants_v1: STORAGE_KEYS.CORRECTIVE_INTERVENANTS,

  // Users & Personnel
  gmao_users_v2: STORAGE_KEYS.PERSONNEL,
  gmao_users: STORAGE_KEYS.PERSONNEL,
  gmao_technicians: STORAGE_KEYS.TECHNICIANS,
  gmao_technicians_v1: STORAGE_KEYS.TECHNICIANS,
  gmao_operations: STORAGE_KEYS.OPERATIONS,
  gmao_operations_v1: STORAGE_KEYS.OPERATIONS,

  // Warehouse
  gmao_warehouse_items_v2: STORAGE_KEYS.WAREHOUSE_ITEMS,
  gmao_warehouse_items_v1: STORAGE_KEYS.WAREHOUSE_ITEMS,
  gmao_warehouse_items: STORAGE_KEYS.WAREHOUSE_ITEMS,
  gmao_entrepot_components_v2: STORAGE_KEYS.ENTREPOT_COMPONENTS,
  gmao_entrepot_components_v1: STORAGE_KEYS.ENTREPOT_COMPONENTS,
  gmao_comp_groups_v1: STORAGE_KEYS.COMP_GROUPS,
  gmao_comp_families_v2: STORAGE_KEYS.COMP_FAMILIES,
  gmao_comp_families_v1: STORAGE_KEYS.COMP_FAMILIES,
  gmao_comp_templates_v2: STORAGE_KEYS.COMP_TEMPLATES,
  gmao_comp_templates_v1: STORAGE_KEYS.COMP_TEMPLATES,
  gmao_part_types_v1: STORAGE_KEYS.PART_TYPES,
  gmao_part_types: STORAGE_KEYS.PART_TYPES,
  gmao_part_designations_v1: STORAGE_KEYS.PART_DESIGNATIONS,
  gmao_part_designations: STORAGE_KEYS.PART_DESIGNATIONS,
};

/**
 * Obsolete initialization / flag keys to clean up during migration
 */
export const OBSOLETE_FLAG_KEYS = [
  'gmao_preventive_initialized_v1',
  'gmao_corrective_initialized_v800',
  'gmao_sortie_externe_initialized_v1',
];

/**
 * All legacy keys as an array for quota cleanup and migration sweeps
 */
export const ALL_LEGACY_KEYS = [
  ...Object.keys(LEGACY_KEY_MAP),
  ...OBSOLETE_FLAG_KEYS,
];
