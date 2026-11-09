export class PartType {
  id_type: string;
  nom: string;
  description: string;
  [key: string]: any;

  constructor(data: any = {}) {
    this.id_type = data.id_type || data.id;
    this.nom = data.nom || '';
    this.description = data.description || '';
  }

  getDesignations(partDesignations: any[] = []) {
    return partDesignations.filter((d: any) => d.id_type === this.id_type);
  }

  getWarehouseItems(warehouseItems: any[] = []) {
    return warehouseItems.filter(
      (item: any) =>
        item.id_part_type === this.id_type || item.type === this.id_type
    );
  }
}
