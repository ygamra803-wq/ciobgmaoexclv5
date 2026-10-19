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
    return {
      isValid: res.success,
      errors: res.success ? [] : res.error.issues.map((i) => i.message),
      data: res.success ? res.data : null,
    };
  }

  static validateArticle(article: any) {
    return this.validateStockItem(article);
  }

  static validateMovement(movement: any) {
    const res = MovementSchema.safeParse(movement);
    return {
      isValid: res.success,
      errors: res.success ? [] : res.error.issues.map((i) => i.message),
      data: res.success ? res.data : null,
    };
  }

  static validateUser(user: any) {
    const res = UserSchema.safeParse(user);
    return {
      isValid: res.success,
      errors: res.success ? [] : res.error.issues.map((i) => i.message),
      data: res.success ? res.data : null,
    };
  }

  static validateMachine(machine: any) {
    const res = MachineSchema.safeParse(machine);
    return {
      isValid: res.success,
      errors: res.success ? [] : res.error.issues.map((i) => i.message),
      data: res.success ? res.data : null,
    };
  }

  static validateTask(task: any) {
    const res = TaskSchema.safeParse(task);
    return {
      isValid: res.success,
      errors: res.success ? [] : res.error.issues.map((i) => i.message),
      data: res.success ? res.data : null,
    };
  }
}

export default ValidationService;
