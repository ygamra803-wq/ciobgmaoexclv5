export class MachineEntity {
  [key: string]: any;

  constructor(data: Record<string, any> = {}) {
    const {
      id,
      id_machine_registered,
      designation,
      id_family,
      id_templates,
      id_blueprint,
      id_zone_default,
      technician,
      status,
      asset_class,
      id_general_system_type,
      serial_number,
      date_mise_en_service,
      ...rest
    } = data;

    Object.assign(this, rest);
    this.id =
      id ||
      id_machine_registered ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `MCH-${Date.now()}`);
    this.id_machine_registered = id_machine_registered || this.id;
    this.designation = designation || '';
    this.id_family = id_family || '';
    this.id_templates = id_templates || '';
    this.id_blueprint = id_blueprint || '';
    this.id_zone_default = id_zone_default || '';
    this.technician = technician || '';
    this.status = status || 'En service'; // En service, En maintenance, Arrêt
    this.asset_class = asset_class === 'SYSTEM_GENERAL' ? 'SYSTEM_GENERAL' : 'PRODUCTION';
    this.id_general_system_type =
      this.asset_class === 'SYSTEM_GENERAL' ? id_general_system_type || null : null;
    if (serial_number !== undefined) this.serial_number = serial_number;
    if (date_mise_en_service !== undefined) this.date_mise_en_service = date_mise_en_service;
  }

  isOperational() {
    return String(this.status || '').toLowerCase() === 'en service';
  }
}
