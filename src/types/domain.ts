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

export type ValidationWorkflowStatus =
  | 'NONE'
  | 'PENDING_VALIDATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_CLARIFICATION';

export interface IStockItem {
  id?: string | number;
  ref: string;
  designation: string;
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
  fournisseur?: string;
  code_barre?: string;
  [key: string]: any;
}

export interface IMachineComponentReel {
  id_component: string;
  designation: string;
  ref_pdr?: string;
  id_family?: string;
  id_template?: string;
  quantite?: number;
  etat?: string;
  [key: string]: any;
}

export interface IMachine {
  id_machine_registered: string;
  id_machine?: string;
  id?: string;
  code?: string;
  designation: string;
  libelle?: string;
  id_family?: string;
  id_templates?: string;
  id_zone_default?: string;
  zone?: string;
  technician?: string;
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
  date_mise_en_service?: string;
  components_reels?: IMachineComponentReel[];
  compteur_actuel?: number;
  compteur_heures?: number;
  compteur_cycles?: number;
  compteur_km?: number;
  dernier_releve_compteur?: number;
  date_releve_compteur?: string;
  compteur_unite_defaut?: 'Heures' | 'Cycles' | 'Km' | string;
  [key: string]: any;
}

export interface IMachineFamily {
  id_family?: string;
  id?: string;
  libelle?: string;
  nom?: string;
  name?: string;
  code?: string;
  description?: string;
  [key: string]: any;
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
  specs?: Record<string, any>;
  description?: string;
  [key: string]: any;
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
  [key: string]: any;
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
  [key: string]: any;
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
  [key: string]: any;
}

export interface IZone {
  code: string;
  code_zone?: string;
  id_zone?: string;
  libelle: string;
  description?: string;
  philosophie?: string;
  [key: string]: any;
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
  [key: string]: any;
}

export interface ITechnician {
  id_technician: string;
  id?: string;
  nom: string;
  prenom?: string;
  id_zone?: string;
  zones?: string[];
  role?: string;
  type_profil?: ProfileType | string;
  specialite?: string;
  active?: boolean;
  is_active?: boolean;
  actif?: boolean;
  statut?: string;
  [key: string]: any;
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
  [key: string]: any;
}

export interface IDiagnostic {
  id_diag: string;
  ref: string;
  designation: string;
  id_type?: string;
  description?: string;
  [key: string]: any;
}

export interface IType {
  id_type?: string;
  id?: string;
  libelle?: string;
  nom?: string;
  type?: string;
  description?: string;
  famille?: string;
  [key: string]: any;
}

export interface IPartType {
  id_type?: string;
  id?: string;
  libelle?: string;
  nom?: string;
  description?: string;
  [key: string]: any;
}

export interface IPartDesignation {
  id_part?: string;
  id?: string | number;
  ref: string;
  designation: string;
  id_type?: string;
  type?: string;
  id_diag?: string;
  seuil?: number;
  stockInitial?: number;
  emplacement?: string;
  [key: string]: any;
}

export interface ICompGroup {
  id?: string | number;
  id_groupe?: string;
  code?: string;
  libelle: string;
  ref?: string;
  description?: string;
  created_at?: string;
  [key: string]: any;
}

export interface ICompFamily {
  id?: string | number;
  id_comp_family?: string;
  id_family?: string;
  id_groupe?: string;
  libelle: string;
  code?: string;
  ref?: string;
  type?: string;
  description?: string;
  [key: string]: any;
}

export interface ICompTemplate {
  id?: string | number;
  id_template?: string;
  id_templates?: string;
  code?: string;
  ref?: string;
  libelle: string;
  id_family?: string;
  id_groupe?: string;
  type?: string;
  specs?: Record<string, any>;
  description?: string;
  [key: string]: any;
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
  historique_bobinage?: Array<Record<string, any>>;
  [key: string]: any;
}

export interface IBlueprintPreventivePlanItem {
  id: string;
  action_code?: string;
  composant?: string;
  frequence: string;
  description?: string;
  duree_min?: number;
  [key: string]: any;
}

export interface IBlueprintCommonFailureItem {
  id: string;
  title: string;
  description?: string;
  type_panne?: string;
  urgence?: string;
  recommended_action?: string;
  pdr_ref?: string;
  [key: string]: any;
}

export interface IBlueprintTheoreticalPdr {
  id_pdr: string;
  ref?: string;
  designation?: string;
  quantite_recommandee?: number;
  type?: string;
  [key: string]: any;
}

export interface IBlueprint {
  id_blueprint: string;
  id_family: string;
  id_templates: string;
  nom?: string;
  libelle?: string;
  famille_lib?: string;
  template_lib?: string;
  description?: string;
  specs?: Record<string, any>;
  statut?: string;
  ref_plan?: string;
  components_theoriques?: Array<Record<string, any>>;
  parts_theoriques?: Array<Record<string, any>>;
  pdr_theoriques: IBlueprintTheoreticalPdr[];
  preventivePlanItems?: IBlueprintPreventivePlanItem[];
  commonFailures?: IBlueprintCommonFailureItem[];
  [key: string]: any;
}

export interface IWarehouseItem {
  id?: string | number;
  id_warehouse_item?: string;
  code?: string;
  code_article?: string;
  ref?: string;
  designation: string;
  libelle?: string;
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
  historique_bobinage?: Array<Record<string, any>>;
  [key: string]: any;
}
