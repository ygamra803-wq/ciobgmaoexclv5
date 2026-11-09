export class ISparePartRepository {
  async create(_sparePart: any): Promise<any> { throw new Error('Not implemented'); }
  async findById(_id: string): Promise<any> { throw new Error('Not implemented'); }
  async findByRef(_ref: string): Promise<any> { throw new Error('Not implemented'); }
  async findAll(_filters: any = {}): Promise<any[]> { throw new Error('Not implemented'); }
  async update(_id: string, _sparePart: any): Promise<any> { throw new Error('Not implemented'); }
  async delete(_id: string): Promise<void> { throw new Error('Not implemented'); }
}
