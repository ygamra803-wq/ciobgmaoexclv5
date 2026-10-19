export class SparePartMapper {
  toResponse(entity) {
    if (!entity) return null;
    return {
      id: entity.id,
      ref: entity.ref,
      designation: entity.designation,
      id_type: entity.id_type,
      type: entity.type || entity.id_type,
      id_diag: entity.id_diag,
      stockInitial: entity.stockInitial,
      entrees: entity.entrees,
      sorties: entity.sorties,
      stockActuel: entity.stockActuel,
      seuil: entity.seuil,
      alerte: entity.alerte,
      emplacement: entity.emplacement,
      isLowStock: typeof entity.isLowStock === 'function' ? entity.isLowStock() : (entity.stockActuel <= entity.seuil)
    };
  }
}
