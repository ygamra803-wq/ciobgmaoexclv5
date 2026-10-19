export class MachineMapper {
  toResponse(entity) {
    if (!entity) return null;
    return {
      id: entity.id,
      id_machine_registered: entity.id_machine_registered || entity.id,
      designation: entity.designation,
      id_family: entity.id_family,
      id_templates: entity.id_templates,
      id_blueprint: entity.id_blueprint || '',
      id_zone_default: entity.id_zone_default,
      technician: entity.technician,
      status: entity.status,
      isOperational: typeof entity.isOperational === 'function' ? entity.isOperational() : entity.status === 'En service'
    };
  }
}
