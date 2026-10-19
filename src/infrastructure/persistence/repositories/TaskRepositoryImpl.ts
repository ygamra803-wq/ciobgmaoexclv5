import { ITaskRepository } from '../../../domain/maintenance/repositories/ITaskRepository';
import { TaskEntity } from '../../../domain/maintenance/entities/TaskEntity';
import { DatabaseService } from '../../../core/database/DatabaseService';

export class TaskRepositoryImpl extends ITaskRepository {
  constructor() {
    super();
    this.db = new DatabaseService();
    this.storeName = 'movements'; // Reusing movements store for tasks
  }

  async create(task) {
    await this.db.save(this.storeName, task);
    return task;
  }

  async findById(id) {
    const row = await this.db.getById(this.storeName, id);
    if (!row) return null;
    return new TaskEntity(row);
  }

  async findAll(filters = {}) {
    const all = await this.db.getAll(this.storeName);
    let filtered = all;
    
    // Sort by Date descending usually
    filtered.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter(item => 
        (item.code_bon || '').toLowerCase().includes(s) || 
        (item.ref || '').toLowerCase().includes(s) ||
        (item.technicien || '').toLowerCase().includes(s)
      );
    }
    return filtered.map(row => new TaskEntity(row));
  }

  async update(id, task) {
    await this.db.save(this.storeName, task);
    return task;
  }

  async delete(id) {
    await this.db.delete(this.storeName, id);
  }
}
