import { OperationEntity } from '../entities/OperationEntity';
import { IOperationRepository } from '../repositories/IOperationRepository';

export class OperationService {
  constructor(private repository: IOperationRepository) {}

  async getAllOperations(filters?: { type_profil?: string; search?: string }): Promise<OperationEntity[]> {
    return this.repository.findAll(filters);
  }

  async getOperationById(id: string): Promise<OperationEntity | null> {
    return this.repository.findById(id);
  }

  async createOperation(data: Partial<OperationEntity>): Promise<OperationEntity> {
    const entity = new OperationEntity(data);
    return this.repository.create(entity);
  }

  async updateOperation(id: string, updates: Partial<OperationEntity>): Promise<OperationEntity> {
    return this.repository.update(id, updates);
  }

  async deleteOperation(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  calculateNextId(existingOps: OperationEntity[], type: 'OPERATEUR' | 'CHEF'): string {
    const prefix = type === 'CHEF' ? 'CHEF-' : 'OP-';
    const matching = existingOps.filter((o) => o.type_profil === type);
    const maxNum = matching.reduce((max, op) => {
      const match = op.id_operation.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 0;
      return Math.max(max, num);
    }, 0);
    return `${prefix}${String(maxNum + 1).padStart(2, '0')}`;
  }
}
