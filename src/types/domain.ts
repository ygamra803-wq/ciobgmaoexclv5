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

export type ProfileType = 'TECHNICIEN' | 'RESPONSABLE' | 'OPERATEUR' | 'CHEF';

export interface IStockItem {
  id: string | number;
  ref: string;
  designation: string;
  id_type?: string;
  type?: string;
  stockInitial: number;
  entrees: number;
  sorties: number;
  stockActuel: number;
  seuil: number;
  alerte: AlertStatus;
  emplacement?: string;
}

export interface IMachine {
  id_machine_registered: string;
  designation: string;
  id_family: string;
  id_templates: string;
  id_zone_default: string;
  technician?: string;
  status: MachineStatus;
  id_blueprint?: string;
  components_reels?: Array<{
    id_component: string;
    designation: string;
    ref_pdr?: string;
  }>;
}

export interface IMouvement {
  id: string | number;
  code_bon: string;
  date: string;
  ref: string;
  quantite: number;
  type: MovementType;
  action_id: ActionId;
  id_machine_registered?: string;
  id_zone?: string;
  technicien?: string;
  operation?: string;
  usage_type?: 'technician' | 'operation' | 'chef';
  fournisseur?: string;
  emplacement_reception?: string;
  commentaire?: string;
}

export interface IZone {
  code: string;
  id_zone?: string;
  libelle: string;
  description?: string;
  philosophie?: string;
}

export interface IOperation {
  id_operation: string;
  nom: string;
  id_zone?: string;
  type_profil?: ProfileType;
}

export interface ITechnician {
  id_technician: string;
  nom: string;
  prenom?: string;
  id_zone?: string;
  role?: string;
  active?: boolean;
}

export interface IDiagnostic {
  id_diag: string;
  ref: string;
  designation: string;
  id_type?: string;
  description?: string;
}

export interface IType {
  id_type: string;
  nom: string;
  description?: string;
  famille?: string;
}

export interface IBlueprint {
  id_blueprint: string;
  id_family: string;
  id_templates: string;
  nom: string;
  description?: string;
  pdr_theoriques: Array<{
    id_pdr: string;
    ref?: string;
    designation?: string;
    quantite_recommandee?: number;
    type?: string;
  }>;
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
}
