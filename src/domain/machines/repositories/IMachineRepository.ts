export class IMachineRepository {
  async create(_machine: any): Promise<any> { throw new Error('Not implemented'); }
  async findById(_id: string): Promise<any> { throw new Error('Not implemented'); }
  async findAll(_filters: any = {}): Promise<any[]> { throw new Error('Not implemented'); }
  async update(_id: string, _machine: any): Promise<any> { throw new Error('Not implemented'); }
  async delete(_id: string): Promise<void> { throw new Error('Not implemented'); }
}
