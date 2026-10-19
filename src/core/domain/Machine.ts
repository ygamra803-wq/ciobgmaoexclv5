export class Machine {
  constructor(data) {
    this.id_machine_registered = data.id_machine_registered || data.id;
    this.id_family = data.id_family;
    this.id_templates = data.id_templates;
    this.id_blueprint = data.id_blueprint;
    this.components_reels = data.components_reels || [];
  }

  getPDRHistory(mouvements) {
    return mouvements.filter(m => m.id_machine_registered === this.id_machine_registered && String(m.type || '').toLowerCase().includes('sortie'));
  }

  getComponentsReels() {
    return this.components_reels;
  }

  hasBlueprint() {
    return !!this.id_blueprint;
  }

  getBlueprint() {
    return this.hasBlueprint() ? `BPT lié: ${this.id_blueprint}` : 'Sans Blueprint - Machine neuve';
  }

  getEvolution() {
    if (!this.hasBlueprint() && this.components_reels.length === 0) return 'Jour 1 : Famille + Modèle (Neuve)';
    if (!this.hasBlueprint() && this.components_reels.length > 0) return 'En cours de découverte (Tabs accumulés)';
    return 'Documentée avec Blueprint';
  }

  findTwins(allMachines) {
    return allMachines.filter(m => m.id_machine_registered !== this.id_machine_registered && m.id_family === this.id_family && m.id_templates === this.id_templates);
  }
}