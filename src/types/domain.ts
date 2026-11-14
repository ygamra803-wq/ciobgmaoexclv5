/**
 * TypeScript Type Definitions for CIOB GMAO Domain Entities
 * Enforces strict domain contracts across all 3-Tier Asset, Warehouse, Stock, Personnel, and Maintenance slices.
 */

export type AlertStatus = 'OK' | 'ALERTE' | 'RUPTURE';

export type MovementType = 'Sortie' | 'Entrée' | 'Sortie Interne' | 'Entrée Fournisseur';

export type ActionId =
  | 'CORRECTIVE'
  | 'PREVENTIVE'
  | 'AMELIORATIVE'
  | 'USAGE'
  | 'REAPPRO'
  | 'RETOUR'
  | 'INVENTAIRE';

export type MachineStatus = 'En service' | 'En maintenance' | 'Arrêt' | 'ARCHIVEE';

export type AssetClass = 'PRODUCTION' | 'SYSTEM_GENERAL';

export interface IGeneralSystemType {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export type ProfileType = 'TECHNICIEN' | 'RESPONSABLE' | 'OPERATEUR' | 'CHEF';

export type MaterialPolicyTag = 'REPLACING' | 'REPAIRABLE' | 'MODIFYING';
export type MaintenancePolicyTag = MaterialPolicyTag;

export type PdrUnitOfMeasure = 'PCS' | 'M' | 'L' | 'KG' | 'KIT' | 'JEU' | 'ROUL';
export type PdrCriticality = 'A' | 'B' | 'C';

export type TechnicalDomain =
  | 'MECANIQUE'
  | 'ELECTRIQUE'
  | 'HYDRAULIQUE'
  | 'PNEUMATIQUE'
  | 'AUTOMATISME'
  | 'LUBRIFIANTS'
  | 'CONSOMMABLES';

export type ComponentDefaultRepairMode =
  | 'REBOBINAGE_EXTERNE'
  | 'REVISION_ATELIER'
  | 'ECHANGE_STANDARD'
  | 'GARANTIE'
  | 'NON_DEFINI';

export type ValidationWorkflowStatus =
  | 'NONE'
  | 'PENDING_VALIDATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_CLARIFICATION';

/**
 * PDR Functional Classification Group (`CATALOG-GROUP-P1`)
 * Top-tier organizational entity for PDR stock catalog (e.g. GRP-ROUL, GRP-ETAN).
 */
export interface PdrGroup {
  id: string;              // e.g. 'GRP-ROUL'
  id_group?: string;       // Canonical alias
  code: string;            // 'ROUL' — unique short code
  libelle: string;         // 'Roulements & paliers'
  description?: string;
  domaine_technique?: TechnicalDomain | string;
  default_policy_tags?: MaterialPolicyTag[];  // default ['REPLACING'] for standard PDR
  sort_order?: number;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface StockType {
  id_type: string;
  libelle: string;
  id_group?: string | null;
  id_groupe?: string | null;
  domaine_technique?: TechnicalDomain | string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface IStockItem {
  id?: string | number;
  ref: string;
  designation: string;
  id_group?: string | null;
  id_groupe?: string | null;
  id_type?: string;
  type?: string;
  stockInitial: number;
  entrees?: number;
  sorties?: number;
  stockActuel?: number;
  seuil?: number;
  alerte?: AlertStatus | string;
  emplacement?: string;
  prixUnitaire?: number;
  prix_unitaire?: number;
  prix?: number;
  unite?: string;
  unite_mesure?: PdrUnitOfMeasure | string;
  criticite?: PdrCriticality | string;
  ref_constructeur?: string;
  code_equivalents?: string;
  equivalences?: string;
  delai_appro_jours?: number;
  domaine_technique?: TechnicalDomain | string;
  fournisseur?: string;
  code_barre?: string;
  policy_tags?: MaterialPolicyTag[];
  [key: string]: unknown;
}

export interface IMachineComponentReel {
  id_component: string;
  designation: string;
  ref_pdr?: string;
  id_family?: string;
  id_template?: string;
  quantite?: number;
  etat?: string;
  [key: string]: unknown;
}

export interface IMachine {
  id_machine_registered: string;
  id_machine?: string;
  id?: string;
  code?: string;
  designation: string;
  nom?: string;
  libelle?: string;
  id_family?: string;
  famille?: string;
  id_templates?: string;
  modele?: string;
  id_zone_default?: string;
  id_zone?: string;
  zone?: string;
  technician?: string;
  machine?: string;
  status?: MachineStatus | string;
  statut?: string;
  lifecycle_status?: string;
  is_active?: boolean;
  actif?: boolean;
  archived?: boolean;
  id_blueprint?: string;
  asset_class?: AssetClass | string;
  id_general_system_type?: string | null;
  parent_id?: string | null;
  id_parent?: string | null;
  previous_parent_id?: string | null;
  asset_level?: 'MACHINE' | 'LINE' | string;
  serial_number?: string;
  numero_serie?: string;
  date_mise_en_service?: string;
  date_installation?: string;
  annee?: string | number;
  components_reels?: IMachineComponentReel[];
  compteur_actuel?: number;
  compteur_heures?: number;
  compteur_cycles?: number;
  compteur_km?: number;
  dernier_releve_compteur?: number;
  date_releve_compteur?: string;
  date_dernier_releve?: string;
  compteur_unite_defaut?: 'Heures' | 'Cycles' | 'Km' | string;
  unite_compteur?: string;
  [key: string]: unknown;
}

export interface IMachineFamily {
  id_family?: string;
  id?: string;
  libelle?: string;
  nom?: string;
  name?: string;
  code?: string;
  componentCode?: string;
  description?: string;
  [key: string]: unknown;
}

export interface IMachineTemplate {
  id_templates?: string;
  id_template?: string;
  id?: string;
  libelle?: string;
  nom?: string;
  id_family?: string;
  family?: string;
  famille_lib?: string;
  constructeur?: string;
  puissance?: string;
  vitesse?: string;
  specs?: Record<string, unknown>;
  description?: string;
  [key: string]: unknown;
}

export interface IMouvement {
  id: string | number;
  code_bon: string;
  num_bon_saisi_par_tech?: string;
  date: string;
  heure?: string;
  ref: string;
  code_article?: string;
  designation?: string;
  quantite: number;
  type: MovementType | string;
  action_id?: ActionId | string;
  id_machine_registered?: string;
  id_zone?: string;
  technicien?: string;
  id_technician?: string;
  operation?: string;
  id_operation?: string;
  usage_type?: 'technician' | 'operation' | 'chef' | string;
  fournisseur?: string;
  emplacement_reception?: string;
  commentaire?: string;
  prix_unitaire?: number;
  cout_total?: number;
  [key: string]: unknown;
}

export interface ISortieDemandItem {
  source?: 'STOCK_PDR' | 'ENTREPOT' | string;
  ref: string;
  designation: string;
  quantite: number;
  approvedQty?: number;
  unit?: string;
  unite?: string;
  emplacement?: string;
  prix_unitaire?: number;
  [key: string]: unknown;
}

export interface ISortieDemand {
  id: string;
  code_bon_tech: string;
  code_bon_magasin?: string;
  num_commande?: string;
  date: string;
  heure?: string;
  type: MovementType | string;
  action_id?: ActionId | string;
  usage_type?: 'technician' | 'operation' | 'chef' | string;
  id_zone?: string;
  id_machine_registered?: string;
  technicien?: string;
  id_technician?: string;
  operation?: string;
  id_operation?: string;
  commentaire?: string;
  motif?: string;
  items: ISortieDemandItem[];
  validation_status: ValidationWorkflowStatus | string;
  discrepancy_status?: 'NONE' | 'QTY_ADJUSTED' | 'PARTIAL' | string;
  submitted_by_id?: string;
  submitted_by_name?: string;
  submitted_at?: string;
  validated_by_id?: string;
  validated_by_name?: string;
  validated_at?: string;
  validation_note?: string;
  stock_deducted?: boolean;
  emitted_movement_ids?: string[];
  [key: string]: unknown;
}

export interface IZone {
  id?: string;
  code: string;
  code_zone?: string;
  id_zone?: string;
  libelle: string;
  nom?: string;
  description?: string;
  philosophie?: string;
  [key: string]: unknown;
}

export interface IOperation {
  id_operation: string;
  id?: string;
  nom: string;
  id_zone?: string;
  zones?: string[];
  type_profil?: ProfileType | string;
  role?: string;
  specialite?: string;
  is_active?: boolean;
  actif?: boolean;
  [key: string]: unknown;
}

export interface ITechnician {
  id_technician: string;
  id?: string;
  nom: string;
  name?: string;
  prenom?: string;
  id_zone?: string;
  zone?: string;
  zones?: string[];
  role?: string;
  type_profil?: ProfileType | string;
  specialite?: string;
  active?: boolean;
  is_active?: boolean;
  actif?: boolean;
  statut?: string;
  [key: string]: unknown;
}

export interface IUserRecord {
  id: string;
  id_technician?: string;
  id_operation?: string;
  nom: string;
  name?: string;
  prenom?: string;
  username?: string;
  role: string;
  type_profil?: ProfileType | string;
  id_zone?: string;
  zones?: string[];
  specialite?: string;
  is_active?: boolean;
  actif?: boolean;
  statut?: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
  titleFr?: string;
  [key: string]: unknown;
}

export interface IDiagnostic {
  id_diag: string;
  ref: string;
  designation: string;
  id_type?: string;
  unite_mesure?: PdrUnitOfMeasure | string;
  criticite?: PdrCriticality | string;
  ref_constructeur?: string;
  code_equivalents?: string;
  delai_appro_jours?: number;
  domaine_technique?: TechnicalDomain | string;
  description?: string;
  [key: string]: unknown;
}

export interface IType {
  id_type?: string;
  id?: string;
  libelle?: string;
  nom?: string;
  type?: string;
  description?: string;
  famille?: string;
  [key: string]: unknown;
}

export interface IPartGroup {
  id?: string | number;
  id_groupe?: string;
  id_group?: string;
  code?: string;
  libelle: string;
  ref?: string;
  description?: string;
  domaine_technique?: TechnicalDomain | string;
  default_policy_tags?: MaterialPolicyTag[];
  sort_order?: number;
  is_active?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

export interface IPartType {
  id_type?: string;
  id?: string;
  id_group?: string | null;
  id_groupe?: string | null;
  libelle?: string;
  nom?: string;
  description?: string;
  domaine_technique?: TechnicalDomain | string;
  [key: string]: unknown;
}

export interface IPartDesignation {
  id_part?: string;
  id?: string | number;
  ref: string;
  designation: string;
  libelle?: string;
  id_group?: string | null;
  id_groupe?: string | null;
  id_type?: string;
  type?: string;
  id_diag?: string;
  seuil?: number;
  stockInitial?: number;
  emplacement?: string;
  matiere_nuance?: string;
  ref_plan?: string;
  dimensions_brut?: string;
  traitement_thermique?: string;
  policy_tags?: MaterialPolicyTag[];
  [key: string]: unknown;
}

export interface ICompGroup {
  id?: string | number;
  id_group?: string;
  id_groupe?: string;
  code?: string;
  libelle: string;
  ref?: string;
  description?: string;
  domaine_technique?: TechnicalDomain | string;
  created_at?: string;
  [key: string]: unknown;
}

export interface ICompFamily {
  id?: string | number;
  id_comp_family?: string;
  id_family?: string;
  id_group?: string;
  id_groupe?: string;
  libelle: string;
  code?: string;
  ref?: string;
  type?: string;
  description?: string;
  [key: string]: unknown;
}

export interface ICompTemplate {
  id?: string | number;
  id_template?: string;
  id_templates?: string;
  code?: string;
  ref?: string;
  libelle: string;
  id_family?: string;
  id_group?: string;
  id_groupe?: string;
  type?: string;
  mode_reparation_defaut?: ComponentDefaultRepairMode | string;
  tension_nominale?: string;
  courant_nominal_a?: number | string;
  indice_protection?: string;
  type_fixation?: string;
  specs?: Record<string, unknown>;
  description?: string;
  [key: string]: unknown;
}

export interface IEntrepotComponent {
  id?: string | number;
  id_entrepot?: string;
  id_warehouse_item?: string;
  code?: string;
  ref?: string;
  libelle?: string;
  designation?: string;
  id_family?: string;
  id_template?: string;
  id_templates?: string;
  id_machine?: string;
  id_machine_registered?: string;
  emplacement?: string;
  zone?: string;
  id_zone?: string;
  position?: string;
  nature?: string;
  etat?: string;
  status?: string;
  statut?: string;
  quantite?: number;
  historique_bobinage?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface IBlueprintPreventivePlanItem {
  id: string;
  action_code?: string;
  composant?: string;
  frequence: string;
  description?: string;
  duree_min?: number;
  [key: string]: unknown;
}

export interface IBlueprintCommonFailureItem {
  id: string;
  title: string;
  description?: string;
  type_panne?: string;
  urgence?: string;
  recommended_action?: string;
  pdr_ref?: string;
  [key: string]: unknown;
}

export interface IBlueprintTheoreticalPdr {
  id_pdr: string;
  ref?: string;
  designation?: string;
  quantite_recommandee?: number;
  type?: string;
  [key: string]: unknown;
}

export interface IBlueprint {
  id?: string;
  id_blueprint: string;
  id_family: string;
  id_templates: string;
  nom?: string;
  libelle?: string;
  famille_lib?: string;
  template_lib?: string;
  description?: string;
  specs?: Record<string, unknown>;
  statut?: string;
  ref_plan?: string;
  components_theoriques?: Array<Record<string, unknown>>;
  parts_theoriques?: Array<Record<string, unknown>>;
  pdr_theoriques: IBlueprintTheoreticalPdr[];
  preventivePlanItems?: IBlueprintPreventivePlanItem[];
  commonFailures?: IBlueprintCommonFailureItem[];
  [key: string]: unknown;
}

export interface IWarehouseItem {
  id?: string | number;
  id_warehouse_item?: string;
  code?: string;
  code_article?: string;
  ref?: string;
  designation: string;
  libelle?: string;
  id_group?: string | null;
  id_groupe?: string | null;
  id_family?: string;
  id_template?: string;
  id_templates?: string;
  id_type?: string;
  id_diag?: string;
  id_part_type?: string;
  id_part_designation?: string;
  rattachement_type?: string;
  id_machine?: string;
  id_machine_registered?: string;
  stock_actuel?: number;
  stockInitial?: number;
  quantite?: number;
  seuil_min?: number;
  seuil?: number;
  nature?: string;
  emplacement?: string;
  zone?: string;
  id_zone?: string;
  status?: string;
  statut?: string;
  etat?: string;
  technician?: string;
  remarques?: string;
  matiere_nuance?: string;
  ref_plan?: string;
  dimensions_brut?: string;
  traitement_thermique?: string;
  mode_reparation_defaut?: ComponentDefaultRepairMode | string;
  tension_nominale?: string;
  courant_nominal_a?: number | string;
  indice_protection?: string;
  type_fixation?: string;
  historique_bobinage?: Array<Record<string, unknown>>;
  policy_tags?: MaterialPolicyTag[];
  [key: string]: unknown;
}
