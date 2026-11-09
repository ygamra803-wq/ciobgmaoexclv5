export class Technician {
  id_technician: string;
  nom: string;
  id_zone: string;
  [key: string]: any;

  constructor(data: any = {}) {
    this.id_technician = data.id_technician || data.id;
    this.nom = data.nom;
    this.id_zone = data.id_zone;
  }

  getZone(zones: any[] = []) {
    return zones.find((z: any) => z.id_zone === this.id_zone);
  }

  getMachinesResponsable(machines: any[] = []) {
    return machines.filter((m: any) => m.technician === this.id_technician || m.technician === this.nom);
  }

  getInterventions(mouvements: any[] = []) {
    return mouvements.filter((m: any) => m.technicien === this.nom || m.technicien === this.id_technician);
  }
}