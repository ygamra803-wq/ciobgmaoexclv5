import { IMachineRepository } from '../../../domain/machines/repositories/IMachineRepository';
import { MachineEntity } from '../../../domain/machines/entities/MachineEntity';
import { DatabaseService } from '../../../core/database/DatabaseService';

export class MachineRepositoryImpl extends IMachineRepository {
  constructor() {
    super();
    this.db = new DatabaseService();
    this.storeName = 'machines';
  }

  async create(machine) {
    await this.db.save(this.storeName, machine);
    return machine;
  }

  async findById(id) {
    const row = await this.db.getById(this.storeName, id);
    if (!row) return null;
    return new MachineEntity(row);
  }

  async findAll(filters = {}) {
    const all = await this.db.getAll(this.storeName);
    let filtered = Array.isArray(all) ? all : [];
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(item =>
        (item.designation || '').toLowerCase().includes(s) ||
        (item.id || item.id_machine_registered || '').toLowerCase().includes(s)
      );
    }
    return filtered.map(row => new MachineEntity(row));
  }

  async update(id, machine) {
    await this.db.save(this.storeName, machine);
    return machine;
  }

  async delete(id) {
    await this.db.delete(this.storeName, id);
  }
}
