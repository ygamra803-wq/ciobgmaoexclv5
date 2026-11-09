export class Operation {
  id_operation: string;
  nom: string;
  id_zone: string;
  type_profil: string;
  [key: string]: any;

  constructor(data: any = {}) {
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

  getZone(zones: any[] = []) {
    return zones.find(
      (z: any) => z.id_zone === this.id_zone || z.code === this.id_zone
    );
  }

  getInterventions(mouvements: any[] = []) {
    return mouvements.filter(
      (m: any) => m.operation === this.nom || m.operation === this.id_operation
    );
  }

  getTotalPiecesConsommees(mouvements: any[] = []) {
    return this.getInterventions(mouvements)
      .filter((m: any) => String(m.type).toLowerCase().includes('sortie'))
      .reduce((sum: number, m: any) => sum + (Number(m.quantite) || 0), 0);
  }
}
