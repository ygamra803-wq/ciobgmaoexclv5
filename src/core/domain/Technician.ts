export class Technician {
  constructor(data) {
    this.id_technician = data.id_technician || data.id;
    this.nom = data.nom;
    this.id_zone = data.id_zone;
  }

  getZone(zones) {
    return zones.find(z => z.id_zone === this.id_zone);
  }

  getMachinesResponsable(machines) {
    return machines.filter(m => m.technician === this.id_technician || m.technician === this.nom);
  }

  getInterventions(mouvements) {
    return mouvements.filter(m => m.technicien === this.nom || m.technicien === this.id_technician);
  }
}