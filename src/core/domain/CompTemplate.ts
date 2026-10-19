export class CompTemplate {
  constructor(data) {
    this.id = data.id_comp_template || data.id;
    this.id_comp_family = data.id_comp_family;
  }

  getParts(allParts) {
    return allParts.filter(p => p.id_comp_template === this.id);
  }

  isUsedInBlueprint(blueprint) {
    if (!blueprint || !blueprint.components_theoriques) return false;
    return blueprint.components_theoriques.some(c => c.id_component === this.id);
  }
}