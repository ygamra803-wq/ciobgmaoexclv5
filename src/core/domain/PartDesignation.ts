export class PartDesignation {
  id_designation: string;
  id_type: string;
  nom: string;
  reference: string;
  [key: string]: any;

  constructor(data: any = {}) {
    this.id_designation = data.id_designation || data.id;
    this.id_type = data.id_type || '';
    this.nom = data.nom || '';
    this.reference = data.reference || '';
  }

  getType(partTypes: any[] = []) {
    return partTypes.find((t: any) => t.id_type === this.id_type);
  }

  getWarehouseStock(warehouseItems: any[] = []) {
    return warehouseItems.filter(
      (item: any) => item.id_part_designation === this.id_designation
    );
  }
}
