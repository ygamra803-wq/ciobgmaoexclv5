import { Logger } from '../../../core/logger/LoggerService';
import { CacheService } from '../../../core/cache/CacheService';
import { TaskEntity } from '../entities/TaskEntity';

export class TaskService {
  constructor(repository) {
    this.repository = repository;
    this.cache = new CacheService();
  }

  async createTask(data) {
    Logger.info('Creating task/movement', { code_bon: data.code_bon });
    const task = new TaskEntity(data);
    const result = await this.repository.create(task);
    this.cache.invalidateByTag('tasks');
    return result;
  }

  async getTask(id) {
    const cached = this.cache.get(`task:${id}`);
    if (cached) return cached;
    const task = await this.repository.findById(id);
    if (task) {
      this.cache.set(`task:${id}`, task, 10 * 60 * 1000, ['tasks']);
    }
    return task;
  }

  async listTasks(filters = {}) {
    const cacheKey = `tasks:${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const tasks = await this.repository.findAll(filters);
    this.cache.set(cacheKey, tasks, 5 * 60 * 1000, ['tasks']);
    return tasks;
  }

  async updateTask(id, data) {
    Logger.info('Updating task/movement', { id });
    const existing = await this.repository.findById(id);
    const merged = existing ? { ...(typeof existing.toJSON === 'function' ? existing.toJSON() : existing), ...data, id } : { id, ...data };
    const task = new TaskEntity(merged);
    const result = await this.repository.update(id, task);
    this.cache.delete(`task:${id}`);
    this.cache.invalidateByTag('tasks');
    return result;
  }

  async deleteTask(id) {
    Logger.info('Deleting task/movement', { id });
    await this.repository.delete(id);
    this.cache.delete(`task:${id}`);
    this.cache.invalidateByTag('tasks');
  }
}
