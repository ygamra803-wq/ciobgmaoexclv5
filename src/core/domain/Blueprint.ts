export class Blueprint {
  constructor(data) {
    this.id = data.id_blueprint || data.id;
    this.specs = data.specs || {}; 
    this.components_theoriques = data.components_theoriques || []; 
    this.parts_theoriques = data.parts_theoriques || []; 
    this.pdr_theoriques = data.pdr_theoriques || []; 
  }

  isSameSpecs(other) {
    const clean = (s) => Object.fromEntries(Object.entries(s || {}).filter(([_, v]) => v != null && String(v).trim() !== ''));
    return JSON.stringify(clean(this.specs)) === JSON.stringify(clean(other.specs));
  }

  isTwin(other) {
    const key = (arr, field) => JSON.stringify([...(arr || [])].map(x => ({id: String(x[field] || '').trim(), q: Number(x.qte || 1)})).sort((a, b) => a.id.localeCompare(b.id)));
    return this.isSameSpecs(other) &&
           key(this.components_theoriques, 'id_component') === key(other.components_theoriques || other.components_reels, 'id_component') &&
           key(this.parts_theoriques, 'id_part') === key(other.parts_theoriques || other.parts_reels, 'id_part') &&
           key(this.pdr_theoriques, 'id_pdr') === key(other.pdr_theoriques || other.pdr_historique, 'id_pdr');
  }

  extractFromNexus(machine, mouvements) {
    const related = mouvements.filter(m => m.id_machine_registered === machine.id_machine_registered);
    this.components_theoriques = machine.components_reels || [];
    this.pdr_theoriques = related.map(m => ({ id_pdr: m.ref || m.id_article, qte: 1, criticite: 'Moyenne' }));
  }

  getMachinesLiees(machines) {
    return machines.filter(m => m.id_blueprint === this.id);
  }

  getMachinesLieesCount(machines) {
    return this.getMachinesLiees(machines).length;
  }

  getBOMSummary() {
    return `Comp:${this.components_theoriques.length} Parts:${this.parts_theoriques.length} PDR:${this.pdr_theoriques.length}`;
  }
}