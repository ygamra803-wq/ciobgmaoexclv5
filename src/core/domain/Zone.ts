export class Zone {
  code: string;
  libelle: string;
  philosophie: string;
  [key: string]: any;

  constructor(data: any = {}) {
    this.code = data.id_zone || data.code;
    this.libelle = data.libelle;
    this.philosophie = data.description || data.philosophie || 'Aucune philosophie définie';
  }

  getPhilosophie() { 
    return this.philosophie; 
  }

  getMachines(allMachines: any[] = []) { 
    return allMachines.filter((m: any) => m.id_zone_default === this.code); 
  }

  getMachinesCount(allMachines: any[] = []) {
    return this.getMachines(allMachines).length;
  }

  getTechnicians(allTechs: any[] = []) { 
    return allTechs.filter((t: any) => t.id_zone === this.code); 
  }

  getTechniciansCount(allTechs: any[] = []) {
    return this.getTechnicians(allTechs).length;
  }

  getPDRConsomme(machines: any[] = [], mouvements: any[] = []) {
    const machinesInZone = this.getMachines(machines).map((m: any) => m.id_machine_registered);
    return mouvements.filter((m: any) => machinesInZone.includes(m.id_machine_registered));
  }
}