import { DiagnosticEntity } from '../entities/DiagnosticEntity';
import { IDiagnosticRepository } from '../repositories/IDiagnosticRepository';

export class DiagnosticService {
  constructor(private repository: IDiagnosticRepository) {}

  async getAllDiagnostics(filters?: { search?: string; id_type?: string }): Promise<DiagnosticEntity[]> {
    return this.repository.findAll(filters);
  }

  async getDiagnosticById(id: string): Promise<DiagnosticEntity | null> {
    return this.repository.findById(id);
  }

  async getDiagnosticsByRef(ref: string): Promise<DiagnosticEntity[]> {
    return this.repository.findByRef(ref);
  }

  async createDiagnostic(data: Partial<DiagnosticEntity>): Promise<DiagnosticEntity> {
    const entity = new DiagnosticEntity(data);
    return this.repository.create(entity);
  }

  async updateDiagnostic(id: string, updates: Partial<DiagnosticEntity>): Promise<DiagnosticEntity> {
    return this.repository.update(id, updates);
  }

  async deleteDiagnostic(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }
}
