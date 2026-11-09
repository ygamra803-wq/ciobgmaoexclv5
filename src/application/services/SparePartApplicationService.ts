import { Container } from '../../core/di/Container';
import { SparePartMapper } from '../mappers/SparePartMapper';

export class SparePartApplicationService {
  domainService: any;
  mapper: SparePartMapper;

  constructor() {
    this.domainService = Container.resolve('sparePartService');
    this.mapper = new SparePartMapper();
  }

  async createSparePart(request: any) {
    const entity = await this.domainService.createSparePart(request);
    return this.mapper.toResponse(entity);
  }

  async getSparePart(id: any) {
    const entity = await this.domainService.getSparePart(id);
    return this.mapper.toResponse(entity);
  }

  async listSpareParts(filters: any = {}) {
    const entities = await this.domainService.listSpareParts(filters);
    return entities.map((e: any) => this.mapper.toResponse(e));
  }

  async updateSparePart(id, request) {
    const entity = await this.domainService.updateSparePart(id, request);
    return this.mapper.toResponse(entity);
  }

  async deleteSparePart(id) {
    await this.domainService.deleteSparePart(id);
  }
}
