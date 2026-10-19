export class CompFamily {
  constructor(data) {
    this.id = data.id_family || data.id_comp_family;
    this.libelle = data.libelle;
  }
  
  getTemplates(allTemplates) {
    return allTemplates.filter(t => t.id_comp_family === this.id);
  }
}