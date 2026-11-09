export class CompTemplate {
  id: string;
  id_comp_family: string;
  [key: string]: any;

  constructor(data: any = {}) {
    this.id = data.id_comp_template || data.id;
    this.id_comp_family = data.id_comp_family;
  }

  getParts(allParts: any[] = []) {
    return allParts.filter((p: any) => p.id_comp_template === this.id);
  }

  isUsedInBlueprint(blueprint: any) {
    if (!blueprint || !blueprint.components_theoriques) return false;
    return blueprint.components_theoriques.some((c: any) => c.id_component === this.id);
  }
}