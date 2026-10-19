export class EntrepotItem {
  constructor(data) {
    this.id = data.id_warehouse_item || data.id || data.id_part;
    this.designation = data.designation;
    this.qte = Number(data.qte) || 0;
    this.category = data.category || 'PARTIE';
  }
  
  getStockActuel() { 
    return this.qte; 
  }
  
  isUsedInMachines(machines) {
    return machines.some(m =>
      (m.components_reels || []).some(c => c.id_component === this.id)
    );
  }
}