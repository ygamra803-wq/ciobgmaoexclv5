export class CorrectiveIntervention {
  id: string;
  code_bt?: string;
  num_bt?: string;
  statut?: string;
  machine?: string;
  code_machine?: string;
  id_machine_registered?: string;
  panne?: string;
  anomalie?: string;
  type_panne?: string;
  description?: string;
  demande_date?: string;
  demande_heure?: string;
  date_debut?: string;
  heure_debut?: string;
  date_fin?: string;
  heure_fin?: string;
  date_creation?: string;
  date_cloture?: string;
  temps_intervention?: string;
  temps_intervention_mins?: number;
  temps_arret_minutes?: number;
  action_fermee?: string;
  rapport_redige?: string;
  cout_total?: number;
  intervenant?: string;
  intervenants?: string[];
  pdr_ref?: string;
  pdr_designation?: string;
  pdr_quantite?: number;
  pdr_prix?: number;
  pdr_unite?: string;
  pieces_utilisees?: Array<{ ref: string; quantite: number }>;
  [key: string]: any;

  constructor(data: Record<string, any> = {}) {
    this.id = data.id || `BT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    Object.assign(this, data);
    if (!this.action_fermee) {
      this.action_fermee = data.action_fermee || 'NON';
    }
    if (this.date_debut && this.heure_debut && this.date_fin && this.heure_fin && !this.temps_intervention_mins) {
      try {
        const start = new Date(`${this.date_debut}T${this.heure_debut}`);
        const end = new Date(`${this.date_fin}T${this.heure_fin}`);
        const diffMs = end.getTime() - start.getTime();
        if (diffMs > 0) {
          const mins = Math.round(diffMs / 60000);
          this.temps_intervention_mins = mins;
          const hours = Math.floor(mins / 60);
          const remainMins = mins % 60;
          this.temps_intervention = `${String(hours).padStart(2, '0')}:${String(remainMins).padStart(2, '0')}`;
        }
      } catch {}
    }
  }

  toJSON(): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(this)) {
      if (typeof v !== 'function') {
        out[k] = v;
      }
    }
    return out;
  }

  static fromJSON(data: Record<string, any>): CorrectiveIntervention {
    return new CorrectiveIntervention(data);
  }
}

export default CorrectiveIntervention;
