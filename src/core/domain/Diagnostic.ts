export class Diagnostic {
  id: string;
  ref: string;
  designation: string;
  id_type: string;
  stockInitial: number;
  seuil: number;
  emplacement: string;
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id_diag || data.id || data.ref;
    this.ref = data.ref || '';
    this.designation = data.designation || '';
    this.id_type = data.id_type || data.type || '';
    this.stockInitial = Number(data.stockInitial) || 0;
    this.seuil = Number(data.seuil) || 3;
    this.emplacement = data.emplacement || 'A1-R1';
  }

  getType(types: any[] = []) {
    return types.find((t: any) => t.id_type === this.id_type);
  }

  isReferencedInBlueprints(blueprints: any[] = []) {
    return blueprints.some(
      (b: any) =>
        Array.isArray(b.pdr_theoriques) &&
        b.pdr_theoriques.some(
          (p: any) => p.id_pdr === this.ref || p.ref === this.ref
        )
    );
  }

  getMatchingStockItem(stockItems: any[] = []) {
    return stockItems.find((s: any) => s.ref === this.ref || s.id === this.id);
  }
}
