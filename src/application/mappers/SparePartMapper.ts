export class SparePartMapper {
  toResponse(entity: any) {
    if (!entity) return null;
    return {
      ...entity,
      id: entity.id,
      ref: entity.ref,
      designation: entity.designation,
      id_group: entity.id_group ?? entity.id_groupe ?? null,
      id_type: entity.id_type,
      type: entity.type || entity.id_type,
      id_diag: entity.id_diag,
      unite_mesure: entity.unite_mesure || entity.unite || 'PCS',
      criticite: entity.criticite || 'B',
      ref_constructeur: entity.ref_constructeur,
      domaine_technique: entity.domaine_technique,
      code_equivalents: entity.code_equivalents,
      delai_appro_jours: entity.delai_appro_jours,
      prix_unitaire: entity.prix_unitaire,
      policy_tags: entity.policy_tags,
      stockInitial: entity.stockInitial,
      entrees: entity.entrees,
      sorties: entity.sorties,
      stockActuel: entity.stockActuel,
      seuil: entity.seuil,
      alerte: entity.alerte,
      emplacement: entity.emplacement,
      isLowStock:
        typeof entity.isLowStock === 'function'
          ? entity.isLowStock()
          : entity.stockActuel <= entity.seuil,
    };
  }
}

