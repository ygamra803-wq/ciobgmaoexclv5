export class SparePartEntity {
  constructor({
    id,
    ref,
    designation,
    id_type,
    id_diag,
    stockInitial,
    entrees,
    sorties,
    stockActuel,
    seuil,
    alerte,
    emplacement,
    type
  } = {}) {
    this.id = id || ref || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `part_${Date.now()}`);
    this.ref = ref || String(this.id);
    this.designation = designation || '';
    this.id_type = id_type || type || '';
    this.type = type || id_type || '';
    this.id_diag = id_diag || '';
    this.stockInitial = stockInitial || 0;
    this.entrees = entrees || 0;
    this.sorties = sorties || 0;
    this.stockActuel = stockActuel != null ? stockActuel : (this.stockInitial + this.entrees - this.sorties);
    this.seuil = seuil || 0;
    this.alerte = alerte || this.calculateAlert();
    this.emplacement = emplacement || '';
  }

  calculateAlert() {
    if (this.stockActuel <= 0) return 'RUPTURE';
    if (this.stockActuel <= this.seuil) return 'ALERTE';
    return 'OK';
  }

  isLowStock() {
    return this.stockActuel <= this.seuil;
  }
}
