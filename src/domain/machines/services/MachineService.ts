import { Logger } from '../../../core/logger/LoggerService';
import { CacheService } from '../../../core/cache/CacheService';
import { MachineEntity } from '../entities/MachineEntity';

export class MachineService {
  repository: any;
  cache: CacheService;

  constructor(repository: any) {
    this.repository = repository;
    this.cache = new CacheService();
  }

  async createMachine(data: any) {
    Logger.info('Creating machine', { id: data.id });
    const machine = new MachineEntity(data);
    const result = await this.repository.create(machine);
    this.cache.invalidateByTag('machines');
    return result;
  }

  async getMachine(id: string) {
    const cached = this.cache.get(`machine:${id}`);
    if (cached) return cached;
    const machine = await this.repository.findById(id);
    if (machine) {
      this.cache.set(`machine:${id}`, machine, 10 * 60 * 1000, ['machines']);
    }
    return machine;
  }

  async listMachines(filters: any = {}) {
    const cacheKey = `machines:${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const machines = await this.repository.findAll(filters);
    this.cache.set(cacheKey, machines, 5 * 60 * 1000, ['machines']);
    return machines;
  }

  async updateMachine(id: string, data: any) {
    Logger.info('Updating machine', { id });
    const machine = new MachineEntity({ id, ...data });
    const result = await this.repository.update(id, machine);
    this.cache.delete(`machine:${id}`);
    this.cache.invalidateByTag('machines');
    return result;
  }

  async deleteMachine(id: string) {
    Logger.info('Deleting machine', { id });
    await this.repository.delete(id);
    this.cache.delete(`machine:${id}`);
    this.cache.invalidateByTag('machines');
  }
}
