export class ITaskRepository {
  async create(_task) { throw new Error('Not implemented'); }
  async findById(_id) { throw new Error('Not implemented'); }
  async findAll(_filters = {}) { throw new Error('Not implemented'); }
  async update(_id, _task) { throw new Error('Not implemented'); }
  async delete(_id) { throw new Error('Not implemented'); }
}
