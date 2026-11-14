import {
  StockItemSchema,
  MovementSchema,
  MachineSchema,
  UserSchema,
  TaskSchema,
} from '../../utils/validation';

export interface DomainValidationResult<T = unknown> {
  isValid: boolean;
  error?: string;
  errors: string[];
  data: T | null;
}

/**
 * Schema validation facade backed by Zod domain validators (`utils/validation`).
 * Accepts unvalidated `unknown` payloads at API/store boundaries and returns typed parsed data.
 */
export class ValidationService {
  static validateStockItem(item: unknown): DomainValidationResult {
    const res = StockItemSchema.safeParse(item);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateArticle(article: unknown): DomainValidationResult {
    return this.validateStockItem(article);
  }

  static validateMovement(movement: unknown): DomainValidationResult {
    const res = MovementSchema.safeParse(movement);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateUser(user: unknown): DomainValidationResult {
    const res = UserSchema.safeParse(user);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateMachine(machine: unknown): DomainValidationResult {
    const res = MachineSchema.safeParse(machine);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateTask(task: unknown): DomainValidationResult {
    const res = TaskSchema.safeParse(task);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }
}

export default ValidationService;
