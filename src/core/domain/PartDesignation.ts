export class PartDesignation {
  constructor(data) {
    this.id_designation = data.id_designation || data.id;
    this.id_type = data.id_type || '';
    this.nom = data.nom || '';
    this.reference = data.reference || '';
  }

  getType(partTypes = []) {
    return partTypes.find((t) => t.id_type === this.id_type);
  }

  getWarehouseStock(warehouseItems = []) {
    return warehouseItems.filter(
      (item) => item.id_part_designation === this.id_designation
    );
  }
}
