export class TaskMapper {
  toResponse(entity: any) {
    if (!entity) return null;
    return {
      id: entity.id,
      title: entity.title || entity.designation || '',
      description: entity.description || '',
      status: entity.status || 'En attente',
      counter: entity.counter || 0,
      machineId: entity.machineId || entity.id_machine || '',
      dueDate: entity.dueDate || '',
      ...entity
    };
  }
}

export default TaskMapper;
