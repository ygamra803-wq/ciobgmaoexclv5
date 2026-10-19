import { Container } from '../../core/di/Container';
import { storageService } from '../../utils/storageService';
import { STORAGE_KEYS } from '../../infrastructure/persistence/storageKeys';

export class TaskApplicationService {
  private domainService: any;

  constructor() {
    try {
      this.domainService = Container.resolve('taskService');
    } catch {
      this.domainService = null;
    }
  }

  async listTasks(filters: any = {}): Promise<any[]> {
    if (this.domainService?.listTasks) {
      try {
        return await this.domainService.listTasks(filters);
      } catch {
        // Fallback to localStorage
      }
    }
    return storageService.getItem(STORAGE_KEYS.MOUVEMENTS) || [];
  }

  async createTask(data: any): Promise<any> {
    if (this.domainService?.createTask) {
      return this.domainService.createTask(data);
    }
    return data;
  }
}

export default TaskApplicationService;
