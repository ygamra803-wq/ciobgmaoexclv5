export class Zone {
  constructor(data) {
    this.code = data.id_zone || data.code;
    this.libelle = data.libelle;
    this.philosophie = data.description || data.philosophie || 'Aucune philosophie définie';
  }

  getPhilosophie() { 
    return this.philosophie; 
  }

  getMachines(allMachines) { 
    return allMachines.filter(m => m.id_zone_default === this.code); 
  }

  getMachinesCount(allMachines) {
    return this.getMachines(allMachines).length;
  }

  getTechnicians(allTechs) { 
    return allTechs.filter(t => t.id_zone === this.code); 
  }

  getTechniciansCount(allTechs) {
    return this.getTechnicians(allTechs).length;
  }

  getPDRConsomme(machines, mouvements) {
    const machinesInZone = this.getMachines(machines).map(m => m.id_machine_registered);
    return mouvements.filter(m => machinesInZone.includes(m.id_machine_registered));
  }
}