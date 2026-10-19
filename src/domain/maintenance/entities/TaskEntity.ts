export class TaskEntity {
  constructor({
    id,
    code_bon,
    num_commande,
    date,
    ref,
    quantite,
    type, // Sortie ou Entrée
    action_id, // CORRECTIVE, PREVENTIVE, etc.
    usage_type,
    technicien,
    id_zone,
    id_machine_registered,
    operation,
    fournisseur,
    emplacement_reception,
    demandeur,
    commentaire
  } = {}) {
    this.id = id || code_bon || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `task_${Date.now()}`);
    this.code_bon = code_bon || String(this.id);
    this.num_commande = num_commande || '';
    this.date = date || new Date().toISOString().split('T')[0];
    this.ref = ref || '';
    this.quantite = quantite || 0;
    this.type = type || 'Sortie Interne';
    this.action_id = action_id || 'CORRECTIVE';
    this.usage_type = usage_type || '';
    this.technicien = technicien || '';
    this.id_zone = id_zone || '';
    this.id_machine_registered = id_machine_registered || '';
    this.operation = operation || '';
    this.fournisseur = fournisseur || '';
    this.emplacement_reception = emplacement_reception || '';
    this.demandeur = demandeur || '';
    this.commentaire = commentaire || '';
  }
}
