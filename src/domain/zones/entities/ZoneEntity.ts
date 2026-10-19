import { IZone } from '../../../types';

export class ZoneEntity implements IZone {
  code: string;
  id_zone: string;
  libelle: string;
  description?: string;
  philosophie?: string;

  constructor({
    code = '',
    id_zone,
    libelle = '',
    description = '',
    philosophie = '',
  }: Partial<IZone> = {}) {
    this.code = code || id_zone || 'ZONE-00';
    this.id_zone = id_zone || this.code;
    this.libelle = libelle;
    this.description = description;
    this.philosophie = philosophie;
  }

  getDisplayName(): string {
    return `${this.code} - ${this.libelle}`;
  }

  matches(query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    return (
      this.code.toLowerCase().includes(q) ||
      this.libelle.toLowerCase().includes(q) ||
      (this.description || '').toLowerCase().includes(q)
    );
  }
}
