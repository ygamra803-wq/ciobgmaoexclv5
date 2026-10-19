import { ISparePartRepository } from '../../../domain/pdr/repositories/ISparePartRepository';
import { SparePartEntity } from '../../../domain/pdr/entities/SparePartEntity';
import { DatabaseService } from '../../../core/database/DatabaseService';

export class SparePartRepositoryImpl extends ISparePartRepository {
  constructor() {
    super();
    // Use the DI container resolved instance, or fetch singleton
    this.db = new DatabaseService(); 
    this.storeName = 'spare_parts';
  }

  async create(sparePart) {
    await this.db.save(this.storeName, sparePart);
    return sparePart;
  }

  async findById(id) {
    const row = await this.db.getById(this.storeName, id);
    if (!row) return null;
    return new SparePartEntity(row);
  }

  async findByRef(ref) {
    const all = await this.db.getAll(this.storeName);
    const row = all.find(item => item.ref === ref);
    if (!row) return null;
    return new SparePartEntity(row);
  }

  async findAll(filters = {}) {
    const all = await this.db.getAll(this.storeName);
    let filtered = all;

    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(item => 
        item.ref.toLowerCase().includes(s) || 
        item.designation.toLowerCase().includes(s)
      );
    }
    
    return filtered.map(row => new SparePartEntity(row));
  }

  async update(id, sparePart) {
    await this.db.save(this.storeName, sparePart);
    return sparePart;
  }

  async delete(id) {
    await this.db.delete(this.storeName, id);
  }
}
