/**
 * Shared TypeScript contracts for Movement context sub-sections (`SortieInterne` / `EntreeInterne`).
 * Models the internal shopfloor form projection and referent directory items without leaking `any`.
 */

export interface MovementZoneOption {
  id_zone: string;
  libelle: string;
}

export interface MovementMachineOption {
  id_machine_registered?: string;
  designation?: string;
  nom?: string;
  id_zone_default?: string;
  technician?: string;
}

export interface MovementTechnicianOption {
  id_technician: string;
  nom: string;
  id_zone?: string;
  specialite?: string;
}

export interface MovementOperationPersonOption {
  id_operation: string;
  nom: string;
  id_zone?: string;
  template_label?: string;
  template_id?: string;
  type_profil?: string;
}

export interface InternalMovementFormState {
  action_id?: string;
  usage_type?: string;
  id_zone?: string;
  id_machine_registered?: string;
  technicien?: string;
  id_technician?: string;
  demandeur?: string;
  operation?: string;
  id_operation?: string;
  responsable_validation?: string;
  id_responsable_validation?: string;
  emplacement_reception?: string;
  entrepot_etat?: string;
  temps_fabrication?: string | number;
  matiere_premiere?: string;
  commentaire?: string;
}
