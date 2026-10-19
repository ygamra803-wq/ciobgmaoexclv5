import { IDiagnostic } from '../../../types';

export class DiagnosticEntity implements IDiagnostic {
  id: string;
  id_diag: string;
  ref: string;
  designation: string;
  id_type?: string;
  description?: string;

  constructor({
    id,
    id_diag,
    ref = '',
    designation = '',
    id_type = '',
    description = '',
  }: Partial<IDiagnostic & { id?: string }> = {}) {
    this.id_diag = id_diag || id || `DIAG-${Date.now()}`;
    this.id = id || this.id_diag;
    this.ref = ref;
    this.designation = designation;
    this.id_type = id_type;
    this.description = description;
  }

  getSearchableText(): string {
    return `${this.id_diag} ${this.ref} ${this.designation} ${this.description || ''}`.toLowerCase();
  }

  matches(query: string): boolean {
    if (!query) return true;
    const q = query.toLowerCase().trim();
    return this.getSearchableText().includes(q);
  }
}
