import { Container } from '../../core/di/Container';
import { MachineService } from '../../domain/machines/services/MachineService';

export class MachineApplicationService {
  private service: MachineService;

  constructor(repository?: any) {
    if (repository) {
      this.service = new MachineService(repository);
    } else {
      try {
        this.service = Container.resolve('machineService');
      } catch {
        const repo = Container.resolve('machineRepository');
        this.service = new MachineService(repo);
      }
    }
  }

  async createMachine(data: any) {
    return this.service.createMachine(data);
  }

  async getMachine(id: string) {
    return this.service.getMachine(id);
  }

  async listMachines(filters?: any) {
    return this.service.listMachines(filters);
  }

  async updateMachine(id: string, data: any) {
    return this.service.updateMachine(id, data);
  }

  async deleteMachine(id: string) {
    return this.service.deleteMachine(id);
  }
}

export default MachineApplicationService;
