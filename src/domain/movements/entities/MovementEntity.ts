import { IMouvement, MovementType, ActionId } from '../../../types';

export class MovementEntity implements IMouvement {
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

  constructor({
    id,
    code_bon = '',
    date = '',
    ref = '',
    quantite = 0,
    type = 'Sortie',
    action_id = 'CORRECTIVE',
    id_machine_registered,
    id_zone,
    technicien,
    operation,
    usage_type,
    fournisseur,
    emplacement_reception,
    commentaire,
  }: Partial<IMouvement> = {}) {
    this.id = id || `MVT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.code_bon = code_bon || `BON-${Date.now()}`;
    this.date = date || new Date().toISOString().slice(0, 10);
    this.ref = (ref || '').toUpperCase().trim();
    this.quantite = Number(quantite) || 0;
    this.type = type;
    this.action_id = action_id;
    this.id_machine_registered = id_machine_registered;
    this.id_zone = id_zone;
    this.technicien = technicien;
    this.operation = operation;
    this.usage_type = usage_type;
    this.fournisseur = fournisseur;
    this.emplacement_reception = emplacement_reception;
    this.commentaire = commentaire;
  }

  isEntry(): boolean {
    const t = this.type.toLowerCase();
    return t.includes('entrée') || t.includes('entree') || t.includes('reappro');
  }

  isExit(): boolean {
    return this.type.toLowerCase().includes('sortie');
  }

  isUsage(): boolean {
    return this.action_id === 'USAGE';
  }

  isCorrective(): boolean {
    return this.action_id === 'CORRECTIVE';
  }
}
