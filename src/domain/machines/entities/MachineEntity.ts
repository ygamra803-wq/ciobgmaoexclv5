export class MachineEntity {
  constructor({
    id,
    id_machine_registered,
    designation,
    id_family,
    id_templates,
    id_blueprint,
    id_zone_default,
    technician,
    status
  } = {}) {
    this.id = id || id_machine_registered || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `MCH-${Date.now()}`);
    this.id_machine_registered = id_machine_registered || this.id;
    this.designation = designation || '';
    this.id_family = id_family || '';
    this.id_templates = id_templates || '';
    this.id_blueprint = id_blueprint || '';
    this.id_zone_default = id_zone_default || '';
    this.technician = technician || '';
    this.status = status || 'En service'; // En service, En maintenance, Arrêt
  }

  isOperational() {
    return this.status === 'En service';
  }
}
