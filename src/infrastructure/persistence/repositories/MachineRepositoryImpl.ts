import { IMachineRepository } from '../../../domain/machines/repositories/IMachineRepository';
import { MachineEntity } from '../../../domain/machines/entities/MachineEntity';
import { DatabaseService } from '../../../core/database/DatabaseService';

export class MachineRepositoryImpl extends IMachineRepository {
  db: DatabaseService;
  storeName: string;

  constructor() {
    super();
    this.db = new DatabaseService();
    this.storeName = 'machines';
  }

  async create(machine: any) {
    await this.db.save(this.storeName, machine);
    return machine;
  }

  async findById(id: string) {
    const row = await this.db.getById(this.storeName, id);
    if (!row) return null;
    return new MachineEntity(row);
  }

  async findAll(filters: any = {}) {
    const all = await this.db.getAll(this.storeName);
    let filtered = Array.isArray(all) ? all : [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter((item: any) =>
        (item.designation || '').toLowerCase().includes(s) ||
        (item.id || item.id_machine_registered || '').toLowerCase().includes(s)
      );
    }
    return filtered.map((row: any) => new MachineEntity(row));
  }

  async update(id: string, machine: any) {
    await this.db.save(this.storeName, machine);
    return machine;
  }

  async delete(id: string) {
    await this.db.delete(this.storeName, id);
  }
}
