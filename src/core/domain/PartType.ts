export class PartType {
  constructor(data) {
    this.id_type = data.id_type || data.id;
    this.nom = data.nom || '';
    this.description = data.description || '';
  }

  getDesignations(partDesignations = []) {
    return partDesignations.filter((d) => d.id_type === this.id_type);
  }

  getWarehouseItems(warehouseItems = []) {
    return warehouseItems.filter(
      (item) =>
        item.id_part_type === this.id_type || item.type === this.id_type
    );
  }
}
