/**
 * TypeScript Type Definitions for CIOB GMAO Domain Entities
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

export type MachineStatus = 'En service' | 'En maintenance' | 'Arrêt';

export type AssetClass = 'PRODUCTION' | 'SYSTEM_GENERAL';

export interface IGeneralSystemType {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export type ProfileType = 'TECHNICIEN' | 'RESPONSABLE' | 'OPERATEUR' | 'CHEF';

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
  [key: string]: any;
}

export interface IMachine {
  id_machine_registered: string;
  id_machine?: string;
  id?: string;
  designation: string;
  id_family?: string;
  id_templates?: string;
  id_zone_default?: string;
  technician?: string;
  status?: MachineStatus | string;
  id_blueprint?: string;
  asset_class?: AssetClass | string;
  id_general_system_type?: string | null;
  parent_id?: string | null;
  id_parent?: string | null;
  previous_parent_id?: string | null;
  asset_level?: 'MACHINE' | 'LINE' | string;
  serial_number?: string;
  date_mise_en_service?: string;
  components_reels?: Array<{
    id_component: string;
    designation: string;
    ref_pdr?: string;
    [key: string]: any;
  }>;
  compteur_heures?: number;
  compteur_cycles?: number;
  compteur_km?: number;
  dernier_releve_compteur?: number;
  date_releve_compteur?: string;
  compteur_unite_defaut?: 'Heures' | 'Cycles' | 'Km' | string;
  [key: string]: any;
}

export interface IMouvement {
  id: string | number;
  code_bon: string;
  date: string;
  ref: string;
  quantite: number;
  type: MovementType | string;
  action_id?: ActionId | string;
  id_machine_registered?: string;
  id_zone?: string;
  technicien?: string;
  operation?: string;
  usage_type?: 'technician' | 'operation' | 'chef' | string;
  fournisseur?: string;
  emplacement_reception?: string;
  commentaire?: string;
  [key: string]: any;
}

export interface IZone {
  code: string;
  id_zone?: string;
  libelle: string;
  description?: string;
  philosophie?: string;
  [key: string]: any;
}

export interface IOperation {
  id_operation: string;
  nom: string;
  id_zone?: string;
  type_profil?: ProfileType | string;
  [key: string]: any;
}

export interface ITechnician {
  id_technician: string;
  nom: string;
  prenom?: string;
  id_zone?: string;
  role?: string;
  active?: boolean;
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
  id_type: string;
  nom: string;
  description?: string;
  famille?: string;
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

export interface IBlueprint {
  id_blueprint: string;
  id_family: string;
  id_templates: string;
  nom?: string;
  libelle?: string;
  description?: string;
  pdr_theoriques: Array<{
    id_pdr: string;
    ref?: string;
    designation?: string;
    quantite_recommandee?: number;
    type?: string;
    [key: string]: any;
  }>;
  preventivePlanItems?: IBlueprintPreventivePlanItem[];
  commonFailures?: IBlueprintCommonFailureItem[];
  [key: string]: any;
}

export interface IWarehouseItem {
  id: string | number;
  code_article?: string;
  designation: string;
  id_family?: string;
  id_templates?: string;
  id_part_type?: string;
  id_part_designation?: string;
  stock_actuel: number;
  seuil_min: number;
  nature?: string;
  emplacement?: string;
  [key: string]: any;
}
