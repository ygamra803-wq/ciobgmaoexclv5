import { DiagnosticEntity } from '../entities/DiagnosticEntity';

export interface IDiagnosticRepository {
  create(diagnostic: DiagnosticEntity): Promise<DiagnosticEntity>;
  findById(id: string): Promise<DiagnosticEntity | null>;
  findByRef(ref: string): Promise<DiagnosticEntity[]>;
  findAll(filters?: { search?: string; id_type?: string }): Promise<DiagnosticEntity[]>;
  update(id: string, updates: Partial<DiagnosticEntity>): Promise<DiagnosticEntity>;
  delete(id: string): Promise<boolean>;
}
