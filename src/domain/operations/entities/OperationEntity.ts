import { ProfileType, IOperation } from '../../../types';

export class OperationEntity implements IOperation {
  id: string;
  id_operation: string;
  nom: string;
  id_zone: string;
  type_profil: ProfileType;

  constructor({
    id,
    id_operation,
    nom = '',
    id_zone = '',
    type_profil = 'OPERATEUR',
  }: Partial<IOperation & { id?: string }> = {}) {
    this.id_operation = id_operation || id || `OP-${Date.now()}`;
    this.id = id || this.id_operation;
    this.nom = nom;
    this.id_zone = id_zone;
    this.type_profil = type_profil;
  }

  isChef(): boolean {
    return this.type_profil === 'CHEF';
  }

  isOperateur(): boolean {
    return this.type_profil === 'OPERATEUR';
  }

  getDisplayName(): string {
    return `${this.id_operation} - ${this.nom}`;
  }
}
