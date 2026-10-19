export class Diagnostic {
  constructor(data) {
    this.id = data.id_diag || data.id || data.ref;
    this.ref = data.ref || '';
    this.designation = data.designation || '';
    this.id_type = data.id_type || data.type || '';
    this.stockInitial = Number(data.stockInitial) || 0;
    this.seuil = Number(data.seuil) || 3;
    this.emplacement = data.emplacement || 'A1-R1';
  }

  getType(types = []) {
    return types.find((t) => t.id_type === this.id_type);
  }

  isReferencedInBlueprints(blueprints = []) {
    return blueprints.some(
      (b) =>
        Array.isArray(b.pdr_theoriques) &&
        b.pdr_theoriques.some(
          (p) => p.id_pdr === this.ref || p.ref === this.ref
        )
    );
  }

  getMatchingStockItem(stockItems = []) {
    return stockItems.find((s) => s.ref === this.ref || s.id === this.id);
  }
}
