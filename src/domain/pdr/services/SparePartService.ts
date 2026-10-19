import { Logger } from '../../../core/logger/LoggerService';
import { CacheService } from '../../../core/cache/CacheService';
import { SparePartEntity } from '../entities/SparePartEntity';


export class SparePartService {
  constructor(repository) {
    this.repository = repository;
    this.cache = new CacheService();
  }

  async createSparePart(data) {
    Logger.info('Creating spare part', { ref: data.ref });
    const sparePart = new SparePartEntity(data);
    const result = await this.repository.create(sparePart);
    this.cache.invalidateByTag('spare_parts');
    return result;
  }

  async getSparePart(id) {
    const cached = this.cache.get(`spare_part:${id}`);
    if (cached) return cached;

    const sparePart = await this.repository.findById(id);
    if (sparePart) {
      this.cache.set(`spare_part:${id}`, sparePart, 10 * 60 * 1000, ['spare_parts']);
    }
    return sparePart;
  }

  async listSpareParts(filters = {}) {
    const cacheKey = `spare_parts:${JSON.stringify(filters)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const spareParts = await this.repository.findAll(filters);
    this.cache.set(cacheKey, spareParts, 5 * 60 * 1000, ['spare_parts']);
    return spareParts;
  }

  async updateSparePart(id, data) {
    Logger.info('Updating spare part', { id });
    const sparePart = new SparePartEntity({ id, ...data });
    const result = await this.repository.update(id, sparePart);
    this.cache.delete(`spare_part:${id}`);
    this.cache.invalidateByTag('spare_parts');
    return result;
  }

  async deleteSparePart(id) {
    Logger.info('Deleting spare part', { id });
    await this.repository.delete(id);
    this.cache.delete(`spare_part:${id}`);
    this.cache.invalidateByTag('spare_parts');
  }
}
