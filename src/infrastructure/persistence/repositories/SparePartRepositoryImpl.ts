import { ISparePartRepository } from '../../../domain/pdr/repositories/ISparePartRepository';
import { SparePartEntity } from '../../../domain/pdr/entities/SparePartEntity';
import { DatabaseService } from '../../../core/database/DatabaseService';

export class SparePartRepositoryImpl extends ISparePartRepository {
  db: DatabaseService;
  storeName: string;

  constructor() {
    super();
    // Use the DI container resolved instance, or fetch singleton
    this.db = new DatabaseService(); 
    this.storeName = 'spare_parts';
  }

  async create(sparePart: any) {
    await this.db.save(this.storeName, sparePart);
    return sparePart;
  }

  async findById(id: string) {
    const row = await this.db.getById(this.storeName, id);
    if (!row) return null;
    return new SparePartEntity(row);
  }

  async findByRef(ref: string) {
    const all = await this.db.getAll(this.storeName);
    const row = all.find((item: any) => item.ref === ref);
    if (!row) return null;
    return new SparePartEntity(row);
  }

  async findAll(filters: any = {}) {
    const all = await this.db.getAll(this.storeName);
    let filtered = all;

    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter((item: any) => 
        item.ref.toLowerCase().includes(s) || 
        item.designation.toLowerCase().includes(s)
      );
    }
    
    return filtered.map((row: any) => new SparePartEntity(row));
  }

  async update(id: string, sparePart: any) {
    await this.db.save(this.storeName, sparePart);
    return sparePart;
  }

  async delete(id: string) {
    await this.db.delete(this.storeName, id);
  }
}
