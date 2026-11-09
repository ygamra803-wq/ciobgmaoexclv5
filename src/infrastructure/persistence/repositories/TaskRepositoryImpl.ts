import { ITaskRepository } from '../../../domain/maintenance/repositories/ITaskRepository';
import { TaskEntity } from '../../../domain/maintenance/entities/TaskEntity';
import { DatabaseService } from '../../../core/database/DatabaseService';

export class TaskRepositoryImpl extends ITaskRepository {
  db: DatabaseService;
  storeName: string;

  constructor() {
    super();
    this.db = new DatabaseService();
    this.storeName = 'movements'; // Reusing movements store for tasks
  }

  async create(task: any) {
    await this.db.save(this.storeName, task);
    return task;
  }

  async findById(id: string) {
    const row = await this.db.getById(this.storeName, id);
    if (!row) return null;
    return new TaskEntity(row);
  }

  async findAll(filters: any = {}) {
    const all = await this.db.getAll(this.storeName);
    let filtered = all;
    
    // Sort by Date descending usually
    filtered.sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter((item: any) => 
        (item.code_bon || '').toLowerCase().includes(s) || 
        (item.ref || '').toLowerCase().includes(s) ||
        (item.technicien || '').toLowerCase().includes(s)
      );
    }
    return filtered.map((row: any) => new TaskEntity(row));
  }

  async update(id: string, task: any) {
    await this.db.save(this.storeName, task);
    return task;
  }

  async delete(id: string) {
    await this.db.delete(this.storeName, id);
  }
}
