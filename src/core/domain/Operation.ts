export class Operation {
  constructor(data) {
    this.id_operation = data.id_operation || data.id;
    this.nom = data.nom || '';
    this.id_zone = data.id_zone || '';
    this.type_profil = data.type_profil || 'OPERATEUR';
  }

  isOperator() {
    return (
      String(this.type_profil).toUpperCase() === 'OPERATEUR' ||
      String(this.id_operation).startsWith('OP-')
    );
  }

  isChef() {
    return (
      String(this.type_profil).toUpperCase() === 'CHEF' ||
      String(this.id_operation).startsWith('CHEF-')
    );
  }

  getZone(zones = []) {
    return zones.find(
      (z) => z.id_zone === this.id_zone || z.code === this.id_zone
    );
  }

  getInterventions(mouvements = []) {
    return mouvements.filter(
      (m) => m.operation === this.nom || m.operation === this.id_operation
    );
  }

  getTotalPiecesConsommees(mouvements = []) {
    return this.getInterventions(mouvements)
      .filter((m) => String(m.type).toLowerCase().includes('sortie'))
      .reduce((sum, m) => sum + (Number(m.quantite) || 0), 0);
  }
}
