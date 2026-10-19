import { OperationEntity } from '../entities/OperationEntity';

export interface IOperationRepository {
  create(operation: OperationEntity): Promise<OperationEntity>;
  findById(id: string): Promise<OperationEntity | null>;
  findAll(filters?: { type_profil?: string; search?: string }): Promise<OperationEntity[]>;
  update(id: string, updates: Partial<OperationEntity>): Promise<OperationEntity>;
  delete(id: string): Promise<boolean>;
}
