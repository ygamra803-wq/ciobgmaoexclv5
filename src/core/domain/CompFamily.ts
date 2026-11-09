export class CompFamily {
  id: string;
  libelle: string;
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id_family || data.id_comp_family;
    this.libelle = data.libelle;
  }
  
  getTemplates(allTemplates: any[] = []) {
    return allTemplates.filter((t: any) => t.id_comp_family === this.id);
  }
}