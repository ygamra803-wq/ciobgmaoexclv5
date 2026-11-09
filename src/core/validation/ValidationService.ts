import {
  StockItemSchema,
  MovementSchema,
  MachineSchema,
  UserSchema,
  TaskSchema,
} from '../../utils/validation';

export class ValidationService {
  static validateStockItem(item: any) {
    const res = StockItemSchema.safeParse(item);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateArticle(article: any) {
    return this.validateStockItem(article);
  }

  static validateMovement(movement: any) {
    const res = MovementSchema.safeParse(movement);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateUser(user: any) {
    const res = UserSchema.safeParse(user);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateMachine(machine: any) {
    const res = MachineSchema.safeParse(machine);
    const errors = res.success ? [] : res.error.issues.map((i) => i.message);
    return {
      isValid: res.success,
      error: errors[0],
      errors,
      data: res.success ? res.data : null,
    };
  }

  static validateTask(task: any) {
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
