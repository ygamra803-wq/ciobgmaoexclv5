/**
 * Service de Vérification de l'Intégrité des Données & Moteur Auto-Guérison (Data Integrity & Self-Healing Service)
 * 🏛️ Conforme à la Constitution GMAO : Logique relationnelle stricte, formules jumelles Excel,
 * détection des clés orphelines, calcul d'empreinte Checksum et routines de réparation bidirectionnelle.
 */
class DataIntegrityService {
  constructor() {
    this.checksums = new Map();
  }

  /**
   * Calcul d'une empreinte numérique (Checksum) rapide pour un jeu de données
   */
  calculateChecksum(data) {
    if (!data) return '0';
    const str = typeof data === 'string' ? data : JSON.stringify(data);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convertir en entier 32-bit
    }

    return Math.abs(hash).toString(16);
  }

  /**
   * Vérification de conformité par rapport à un checksum attendu
   */
  verify(data, checksum) {
    const currentChecksum = this.calculateChecksum(data);
    return currentChecksum === checksum;
  }

  /**
   * Enregistrer le checksum actuel d'une entité
   */
  save(key, data) {
    const checksum = this.calculateChecksum(data);
    this.checksums.set(key, checksum);
    return checksum;
  }

  /**
   * Vérifie si les données ont changé par rapport au dernier checksum enregistré
   */
  hasChanged(key, data) {
    const currentChecksum = this.calculateChecksum(data);
    const savedChecksum = this.checksums.get(key);
    return currentChecksum !== savedChecksum;
  }

  /**
   * Vérification approfondie de l'intégrité du Stock par rapport aux Mouvements
   * Formule Jumelle Excel: Stock Actuel = Stock Initial + Somme(Entrées) - Somme(Sorties)
   */
  validateStockIntegrity(stock = [], movements = []) {
    const errors = [];
    const warnings = [];

    // Table de pré-agrégation des mouvements par référence d'article
    const mvtsByRef = new Map();
    (movements || []).forEach((m) => {
      const r = (m.ref || '').toString().trim().toUpperCase();
      if (!r) return;
      if (!mvtsByRef.has(r)) {
        mvtsByRef.set(r, { entrees: 0, sorties: 0, count: 0 });
      }
      const agg = mvtsByRef.get(r);
      const qte = Number(m.quantite) || 0;
      if (m.type === 'Entrée') {
        agg.entrees += qte;
      } else if (m.type === 'Sortie') {
        agg.sorties += qte;
      }
      agg.count++;
    });

    (stock || []).forEach((item, index) => {
      const ref = (item.ref || `Ligne ${index + 1}`).toString().trim();
      const refKey = ref.toUpperCase();

      // 1. Contrôle Stock Initial
      const initVal = Number(item.stockInitial);
      if (isNaN(initVal)) {
        errors.push({
          type: 'NAN_INITIAL_STOCK',
          ref,
          message: `Le stock initial de l'article "${ref}" n'est pas un nombre valide.`,
        });
      } else if (initVal < 0) {
        errors.push({
          type: 'NEGATIVE_INITIAL_STOCK',
          ref,
          message: `Le stock initial de l'article "${ref}" est négatif (${initVal}).`,
        });
      }

      // 2. Contrôle Seuil d'Alerte
      const seuilVal = Number(item.seuil);
      if (isNaN(seuilVal)) {
        warnings.push({
          type: 'NAN_THRESHOLD',
          ref,
          message: `Le seuil d'alerte pour "${ref}" n'est pas renseigné ou invalide.`,
        });
      } else if (seuilVal < 0) {
        errors.push({
          type: 'NEGATIVE_THRESHOLD',
          ref,
          message: `Le seuil d'alerte pour "${ref}" est négatif (${seuilVal}).`,
        });
      }

      // 3. Validation de la formule jumelle Excel: Stock Actuel = Initial + Entrées - Sorties
      const agg = mvtsByRef.get(refKey) || { entrees: 0, sorties: 0 };
      const expectedStock = (isNaN(initVal) ? 0 : initVal) + agg.entrees - agg.sorties;

      if (typeof item.stockActuel !== 'undefined') {
        const currentStockVal = Number(item.stockActuel);
        if (!isNaN(currentStockVal) && currentStockVal !== expectedStock) {
          warnings.push({
            type: 'STOCK_CALCULATION_DRIFT',
            ref,
            message: `Décalage détecté sur "${ref}": Stock mémorisé = ${currentStockVal}, Stock recalculé selon formule = ${expectedStock}.`,
            expected: expectedStock,
            actual: currentStockVal,
          });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedCount: stock.length,
    };
  }

  /**
   * Vérification de l'intégrité des lignes du Journal des Mouvements
   */
  validateMovementIntegrity(movements = []) {
    const errors = [];
    const warnings = [];

    (movements || []).forEach((movement, index) => {
      const rowNum = index + 1;
      const ref = movement.ref || `Ligne ${rowNum}`;

      // Contrôle Quantité
      const qte = Number(movement.quantite);
      if (isNaN(qte) || qte <= 0) {
        errors.push({
          type: 'INVALID_QUANTITY',
          row: rowNum,
          ref,
          message: `La quantité du mouvement ligne ${rowNum} (${ref}) doit être strictement positive (valeur: ${movement.quantite}).`,
        });
      }

      // Contrôle Type
      if (!['Entrée', 'Sortie'].includes(movement.type)) {
        errors.push({
          type: 'INVALID_TYPE',
          row: rowNum,
          ref,
          message: `Type de mouvement invalide ligne ${rowNum}: "${movement.type}". Doit être "Entrée" ou "Sortie".`,
        });
      }

      // Contrôle Date
      if (!movement.date) {
        warnings.push({
          type: 'MISSING_DATE',
          row: rowNum,
          ref,
          message: `Date absente pour le mouvement ligne ${rowNum}.`,
        });
      } else {
        const d = new Date(movement.date);
        if (isNaN(d.getTime())) {
          errors.push({
            type: 'INVALID_DATE',
            row: rowNum,
            ref,
            message: `Format de date invalide ligne ${rowNum}: "${movement.date}".`,
          });
        }
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedCount: movements.length,
    };
  }

  /**
   * Vérification de l'intégrité relationnelle stricte (Foreign Keys)
   * Détecte les références orphelines entre tous les modules GMAO
   */
  validateReferentialIntegrity({
    rawStock = [],
    mouvements = [],
    machines = [],
    zones = [],
    technicians = [],
    operations = [],
    preventiveTasks = [],
    correctiveInterventions = [],
  } = {}) {
    const errors = [];
    const warnings = [];

    // 1. Dictionnaires de clés valides
    const registeredRefs = new Set(
      (rawStock || []).map((s) => String(s.ref || '').toUpperCase().trim()).filter(Boolean)
    );
    const registeredMachines = new Set(
      (machines || []).map((m) => String(m.id_machine_registered || '').toUpperCase().trim()).filter(Boolean)
    );
    const registeredZones = new Set([
      ...(zones || []).map((z) => String(z.id_zone || '').toUpperCase().trim()).filter(Boolean),
      ...(zones || []).map((z) => String(z.libelle || '').toUpperCase().trim()).filter(Boolean),
      ...(zones || []).map((z) => String(z.nom || '').toUpperCase().trim()).filter(Boolean),
    ]);
    const registeredUsers = new Set([
      ...(technicians || []).map((t) => String(t.nom || '').toUpperCase().trim()).filter(Boolean),
      ...(technicians || []).map((t) => String(t.id_technician || '').toUpperCase().trim()).filter(Boolean),
      ...(operations || []).map((o) => String(o.nom || '').toUpperCase().trim()).filter(Boolean),
      ...(operations || []).map((o) => String(o.id_operation || '').toUpperCase().trim()).filter(Boolean),
    ]);

    // 2. Contrôle des références d'articles orphelines dans les mouvements
    (mouvements || []).forEach((m, idx) => {
      const rowNum = idx + 1;
      const ref = String(m.ref || '').trim();
      if (ref && !registeredRefs.has(ref.toUpperCase())) {
        errors.push({
          type: 'ORPHAN_STOCK_REF',
          entity: 'Mouvement',
          key: ref,
          row: rowNum,
          message: `Ligne de mouvement #${rowNum}: La référence d'article "${ref}" n'existe pas dans le Stock officiel.`,
        });
      }

      // Contrôle Machine dans Mouvement
      const mch = String(m.id_machine_registered || '').trim();
      if (mch && !registeredMachines.has(mch.toUpperCase())) {
        warnings.push({
          type: 'ORPHAN_MACHINE_IN_MOUVEMENT',
          entity: 'Mouvement',
          key: mch,
          row: rowNum,
          message: `Ligne de mouvement #${rowNum}: La machine "${mch}" n'existe pas dans le Parc Machines.`,
        });
      }

      // Contrôle Zone dans Mouvement
      const zn = String(m.id_zone || '').trim();
      if (zn && !registeredZones.has(zn.toUpperCase())) {
        warnings.push({
          type: 'ORPHAN_ZONE_IN_MOUVEMENT',
          entity: 'Mouvement',
          key: zn,
          row: rowNum,
          message: `Ligne de mouvement #${rowNum}: La zone "${zn}" n'existe pas dans le Référentiel Zones.`,
        });
      }

      // Contrôle Technicien dans Mouvement
      const tech = String(m.technicien || '').trim();
      if (tech && !registeredUsers.has(tech.toUpperCase()) && !/^(TECH-|CHEF-|OP-)/i.test(tech)) {
        warnings.push({
          type: 'ORPHAN_TECHNICIAN_IN_MOUVEMENT',
          entity: 'Mouvement',
          key: tech,
          row: rowNum,
          message: `Ligne de mouvement #${rowNum}: L'intervenant "${tech}" n'est pas un utilisateur répertorié.`,
        });
      }
    });

    // 3. Contrôle des machines, techniciens et PDR orphelins dans les interventions correctives
    (correctiveInterventions || []).forEach((interv) => {
      const mch = String(interv.code_machine || interv.id_machine || interv.machine_id || '').trim();
      if (mch && !registeredMachines.has(mch.toUpperCase())) {
        warnings.push({
          type: 'ORPHAN_MACHINE_IN_CORRECTIVE',
          entity: 'Correctif',
          key: mch,
          id: interv.id || interv.num_bt || interv.code_bon,
          message: `Intervention ${interv.id || interv.num_bt || interv.code_bon || 'Sans ID'}: Machine associée "${mch}" non répertoriée.`,
        });
      }

      const techKey = String(interv.technicien_matricule || interv.intervenant || '').trim();
      if (techKey && !registeredUsers.has(techKey.toUpperCase())) {
        warnings.push({
          type: 'ORPHAN_TECHNICIAN_IN_CORRECTIVE',
          entity: 'Correctif',
          key: techKey,
          id: interv.id || interv.num_bt || interv.code_bon,
          message: `Intervention ${interv.id || interv.num_bt || interv.code_bon || 'Sans ID'}: Technicien associé "${techKey}" non répertorié.`,
        });
      }

      const pdr = String(interv.pdr_ref || interv.pdr || '').trim();
      if (pdr && !registeredRefs.has(pdr.toUpperCase())) {
        warnings.push({
          type: 'ORPHAN_PDR_IN_CORRECTIVE',
          entity: 'Correctif',
          key: pdr,
          id: interv.id || interv.num_bt || interv.code_bon,
          message: `Intervention ${interv.id || interv.num_bt || interv.code_bon || 'Sans ID'}: Pièce PDR "${pdr}" non répertoriée.`,
        });
      }
    });

    // 4. Contrôle des machines orphelines dans les tâches préventives
    (preventiveTasks || []).forEach((task) => {
      const mch = String(task.machine_id || task.id_machine || '').trim();
      if (mch && !registeredMachines.has(mch.toUpperCase())) {
        warnings.push({
          type: 'ORPHAN_MACHINE_IN_PREVENTIVE',
          entity: 'Préventif',
          key: mch,
          id: task.id || task.code,
          message: `Tâche préventive ${task.id || task.code || 'Sans ID'}: Machine "${mch}" non répertoriée.`,
        });
      }
    });

    // 5. Contrôle des zones orphelines dans les machines
    (machines || []).forEach((mch) => {
      const zn = String(mch.id_zone_default || mch.id_zone || '').trim();
      if (zn && !registeredZones.has(zn.toUpperCase())) {
        warnings.push({
          type: 'ORPHAN_ZONE_IN_MACHINE',
          entity: 'Machine',
          key: zn,
          id: mch.id_machine_registered,
          message: `Machine "${mch.id_machine_registered}": Zone par défaut "${zn}" inconnue.`,
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      checkedCount: (mouvements || []).length + (correctiveInterventions || []).length + (preventiveTasks || []).length + (machines || []).length,
    };
  }

  /**
   * Diagnostic d'intégrité relationnelle rapide avec résumé et score de santé pour le tableau de bord
   */
  scanReferentialIntegrity(params = {}) {
    const rawStock = params.rawStock || params.stock || [];
    const mouvements = params.mouvements || params.movements || [];
    const machines = params.machines || [];
    const zones = params.zones || [];
    const technicians = params.technicians || [];
    const operations = params.operations || [];
    const preventiveTasks = params.preventiveTasks || [];
    const correctiveInterventions = params.correctiveInterventions || [];

    const refValidation = this.validateReferentialIntegrity({
      rawStock,
      mouvements,
      machines,
      zones,
      technicians,
      operations,
      preventiveTasks,
      correctiveInterventions,
    });

    const totalErrors = refValidation.errors.length;
    const totalWarnings = refValidation.warnings.length;
    const totalIssues = totalErrors + totalWarnings;
    const checkedCount = Math.max(1, refValidation.checkedCount || 1);

    // Score de conformité (0 à 100%)
    const penalty = totalErrors * 10 + totalWarnings * 2;
    const healthScore = Math.max(0, Math.min(100, Math.round(100 - (penalty / (Math.max(10, checkedCount * 0.05))))));

    let statusGrade = 'A+';
    if (healthScore < 50) statusGrade = 'D';
    else if (healthScore < 70) statusGrade = 'C';
    else if (healthScore < 85) statusGrade = 'B';
    else if (healthScore < 98) statusGrade = 'A';

    return {
      valid: totalErrors === 0,
      healthScore,
      statusGrade,
      summary: {
        isFullyAligned: totalErrors === 0,
        totalOrphanErrors: totalErrors,
        totalWarnings,
        totalIssues,
        checkedCount,
      },
      errors: refValidation.errors,
      warnings: refValidation.warnings,
      details: refValidation,
    };
  }

  /**
   * Routine d'auto-guérison avancée (Self-Healing & Auto-Repair)
   * 1. Recalcule le stock actuel selon la formule jumelle exacte
   * 2. Assainit les stocks initiaux et seuils négatifs ou corrompus
   * 3. Retourne les données guéries et le journal des actions correctives
   */
  autoHealData({ rawStock = [], mouvements = [] } = {}) {
    const mvtsByRef = new Map();
    (mouvements || []).forEach((m) => {
      const r = (m.ref || '').toString().trim().toUpperCase();
      if (!r) return;
      if (!mvtsByRef.has(r)) {
        mvtsByRef.set(r, { entrees: 0, sorties: 0 });
      }
      const agg = mvtsByRef.get(r);
      const qte = Number(m.quantite) || 0;
      if (m.type === 'Entrée') agg.entrees += qte;
      else if (m.type === 'Sortie') agg.sorties += qte;
    });

    const fixes = [];
    const repairedStock = (rawStock || []).map((item) => {
      const repaired = { ...item };
      const ref = (repaired.ref || '').trim();
      const refKey = ref.toUpperCase();

      // 1. Correction Stock Initial
      let init = Number(repaired.stockInitial);
      if (isNaN(init) || init < 0) {
        fixes.push({
          ref,
          field: 'stockInitial',
          before: repaired.stockInitial,
          after: 0,
          reason: 'Valeur NaN ou négative corrigée à 0',
        });
        init = 0;
        repaired.stockInitial = 0;
      }

      // 2. Correction Seuil
      const seuil = Number(repaired.seuil);
      if (isNaN(seuil) || seuil < 0) {
        fixes.push({
          ref,
          field: 'seuil',
          before: repaired.seuil,
          after: 0,
          reason: 'Seuil NaN ou négatif corrigé à 0',
        });
        repaired.seuil = 0;
      }

      // 3. Recalcul Formule Jumelle Excel: Stock Actuel = Initial + In - Out
      const agg = mvtsByRef.get(refKey) || { entrees: 0, sorties: 0 };
      const expectedStock = init + agg.entrees - agg.sorties;
      const currentStock = Number(repaired.stockActuel);

      if (isNaN(currentStock) || currentStock !== expectedStock) {
        fixes.push({
          ref,
          field: 'stockActuel',
          before: repaired.stockActuel,
          after: expectedStock,
          reason: `Recalcul Formule Jumelle (Initial: ${init} + Entrées: ${agg.entrees} - Sorties: ${agg.sorties})`,
        });
        repaired.stockActuel = expectedStock;
      }

      return repaired;
    });

    return {
      repairedStock,
      fixedCount: fixes.length,
      fixes,
    };
  }

  /**
   * Réparation automatique unitaire d'un article
   */
  repairData(item) {
    if (!item) return item;
    const repaired = { ...item };

    const init = Number(repaired.stockInitial);
    repaired.stockInitial = isNaN(init) || init < 0 ? 0 : init;

    const seuil = Number(repaired.seuil);
    repaired.seuil = isNaN(seuil) || seuil < 0 ? 0 : seuil;

    return repaired;
  }

  /**
   * Rattachement et cascade d'une clé étrangère erronée (Cascade Re-link)
   * Permet de rediriger un code mal saisi (ex: MCH-001 -> MCH-01) dans tous les mouvements et interventions
   */
  relinkForeignKey({
    entityType, // 'machine' | 'zone' | 'user' | 'article'
    oldKey,
    newKey,
    datasets: {
      mouvements = [],
      correctiveInterventions = [],
      preventiveTasks = [],
      machines = [],
    } = {},
  }) {
    if (!oldKey || !newKey) {
      return { success: false, affectedCount: 0 };
    }

    let affectedCount = 0;
    const oldNormalized = String(oldKey).trim().toUpperCase();

    // 1. Mouvements
    const nextMouvements = (mouvements || []).map((m) => {
      let updated = false;
      const mCopy = { ...m };

      if (entityType === 'article' && String(m.ref || '').trim().toUpperCase() === oldNormalized) {
        mCopy.ref = newKey;
        updated = true;
      }
      if (entityType === 'machine' && String(m.id_machine_registered || '').trim().toUpperCase() === oldNormalized) {
        mCopy.id_machine_registered = newKey;
        updated = true;
      }
      if (entityType === 'zone' && String(m.id_zone || '').trim().toUpperCase() === oldNormalized) {
        mCopy.id_zone = newKey;
        updated = true;
      }
      if (entityType === 'user' && String(m.technicien || '').trim().toUpperCase() === oldNormalized) {
        mCopy.technicien = newKey;
        updated = true;
      }

      if (updated) affectedCount++;
      return mCopy;
    });

    // 2. Interventions Correctives
    const nextInterventions = (correctiveInterventions || []).map((ci) => {
      let updated = false;
      const cCopy = { ...ci };

      if (entityType === 'machine') {
        const mKey = String(ci.id_machine || ci.machine_id || '').trim().toUpperCase();
        if (mKey === oldNormalized) {
          if (ci.id_machine) cCopy.id_machine = newKey;
          if (ci.machine_id) cCopy.machine_id = newKey;
          updated = true;
        }
      }
      if (entityType === 'user') {
        const tKey = String(ci.technicien_id || ci.technicien || '').trim().toUpperCase();
        if (tKey === oldNormalized) {
          if (ci.technicien_id) cCopy.technicien_id = newKey;
          if (ci.technicien) cCopy.technicien = newKey;
          updated = true;
        }
      }

      if (updated) affectedCount++;
      return cCopy;
    });

    // 3. Tâches Préventives
    const nextPreventiveTasks = (preventiveTasks || []).map((pt) => {
      let updated = false;
      const pCopy = { ...pt };

      if (entityType === 'machine') {
        const mKey = String(pt.machine_id || pt.id_machine || '').trim().toUpperCase();
        if (mKey === oldNormalized) {
          if (pt.machine_id) pCopy.machine_id = newKey;
          if (pt.id_machine) pCopy.id_machine = newKey;
          updated = true;
        }
      }

      if (updated) affectedCount++;
      return pCopy;
    });

    // 4. Parc Machines (Zones de défaut)
    const nextMachines = (machines || []).map((mch) => {
      let updated = false;
      const mCopy = { ...mch };

      if (entityType === 'zone') {
        const zKey = String(mch.id_zone_default || mch.id_zone || '').trim().toUpperCase();
        if (zKey === oldNormalized) {
          if (mch.id_zone_default) mCopy.id_zone_default = newKey;
          if (mch.id_zone) mCopy.id_zone = newKey;
          updated = true;
        }
      }

      if (updated) affectedCount++;
      return mCopy;
    });

    return {
      success: true,
      affectedCount,
      nextMouvements,
      nextInterventions,
      nextPreventiveTasks,
      nextMachines,
    };
  }

  /**
   * Diagnostic d'intégrité global et complet
   */
  getIntegrityReport({
    stock = [],
    movements = [],
    machines = [],
    zones = [],
    technicians = [],
    operations = [],
    preventiveTasks = [],
    correctiveInterventions = [],
  } = {}) {
    const stockValidation = this.validateStockIntegrity(stock, movements);
    const movementValidation = this.validateMovementIntegrity(movements);
    const referentialValidation = this.validateReferentialIntegrity({
      rawStock: stock,
      mouvements: movements,
      machines,
      zones,
      technicians,
      operations,
      preventiveTasks,
      correctiveInterventions,
    });

    const totalErrors = stockValidation.errors.length + movementValidation.errors.length + referentialValidation.errors.length;
    const totalWarnings = stockValidation.warnings.length + movementValidation.warnings.length + referentialValidation.warnings.length;

    return {
      timestamp: new Date().toISOString(),
      stock: stockValidation,
      movements: movementValidation,
      referential: referentialValidation,
      overall: {
        valid: totalErrors === 0,
        totalErrors,
        totalWarnings,
      },
    };
  }

  /**
   * Dependencies of a machine across modules (Preventive / Corrective / Movements / BOM).
   * Used before delete to decide hard-delete vs soft-archive.
   */
  getMachineDependencies(machineId, {
    preventiveTasks = [],
    correctiveInterventions = [],
    mouvements = [],
    machineElementsLedger = [],
  } = {}) {
    const id = String(machineId || '').trim().toUpperCase();
    if (!id) {
      return {
        machineId,
        preventiveCount: 0,
        correctiveCount: 0,
        movementsCount: 0,
        bomCount: 0,
        total: 0,
        canHardDelete: true,
        preventiveSample: [],
        correctiveSample: [],
      };
    }

    const matchMachine = (value) => String(value || '').trim().toUpperCase() === id;

    const preventiveHits = (preventiveTasks || []).filter(
      (t) =>
        matchMachine(t.id_machine) ||
        matchMachine(t.machine_id) ||
        matchMachine(t.code_machine) ||
        matchMachine(t.id_machine_registered)
    );

    const correctiveHits = (correctiveInterventions || []).filter(
      (i) =>
        matchMachine(i.code_machine) ||
        matchMachine(i.id_machine) ||
        matchMachine(i.machine_id) ||
        matchMachine(i.id_machine_registered)
    );

    const movementsHits = (mouvements || []).filter(
      (m) =>
        matchMachine(m.id_machine_registered) ||
        matchMachine(m.machine) ||
        matchMachine(m.code_machine) ||
        matchMachine(m.id_machine)
    );

    const bomHits = (machineElementsLedger || []).filter(
      (e) =>
        matchMachine(e.id_machine_registered) ||
        matchMachine(e.id_machine) ||
        matchMachine(e.code_machine)
    );

    const total =
      preventiveHits.length + correctiveHits.length + movementsHits.length + bomHits.length;

    return {
      machineId,
      preventiveCount: preventiveHits.length,
      correctiveCount: correctiveHits.length,
      movementsCount: movementsHits.length,
      bomCount: bomHits.length,
      total,
      canHardDelete: total === 0,
      preventiveSample: preventiveHits.slice(0, 5).map((t) => t.id || t.code),
      correctiveSample: correctiveHits.slice(0, 5).map((i) => i.id || i.num_bt || i.code_bon),
    };
  }

  /**
   * Build a Set of ACTIVE machine ids (excludes archived / inactive).
   */
  buildActiveMachineIdSet(machines = []) {
    const set = new Set();
    (machines || []).forEach((m) => {
      const archived =
        m.status === 'ARCHIVEE' ||
        m.statut === 'Archivée' ||
        m.is_active === false ||
        m.actif === false;
      if (archived) return;
      const id = String(m.id_machine_registered || m.id || m.code || m.id_machine || '')
        .trim()
        .toUpperCase();
      if (id) set.add(id);
    });
    return set;
  }

  /**
   * True if task/intervention machine ref is missing or points to archived machine.
   */
  isOrphanMachineRef(machineRef, activeMachineIds) {
    const id = String(machineRef || '').trim().toUpperCase();
    if (!id) return true;
    return !activeMachineIds.has(id);
  }

  /**
   * Annotate preventive tasks with _isOrphan flag.
   */
  annotatePreventiveOrphans(tasks = [], machines = []) {
    const active = this.buildActiveMachineIdSet(machines);
    return (tasks || []).map((t) => {
      const ref = t.id_machine || t.machine_id || t.code_machine;
      const isOrphan = this.isOrphanMachineRef(ref, active);
      return isOrphan ? { ...t, _isOrphan: true } : { ...t, _isOrphan: false };
    });
  }

  /**
   * Annotate corrective interventions with _isOrphan flag.
   */
  annotateCorrectiveOrphans(interventions = [], machines = []) {
    const active = this.buildActiveMachineIdSet(machines);
    return (interventions || []).map((i) => {
      const ref = i.code_machine || i.id_machine || i.machine_id || i.id_machine_registered;
      const isOrphan = this.isOrphanMachineRef(ref, active);
      return isOrphan ? { ...i, _isOrphan: true } : { ...i, _isOrphan: false };
    });
  }

  /**
   * Preview impact of a destructive action before Clear/Reset.
   */
  previewClearImpact({
    action, // 'CLEAR_PREVENTIVE' | 'RESET_PREVENTIVE_BASELINE' | 'CLEAR_CORRECTIVE' | 'RESET_MACHINES' | ...
    machines = [],
    preventiveTasks = [],
    correctiveInterventions = [],
  } = {}) {
    const activeIds = this.buildActiveMachineIdSet(machines);
    const prevOrphans = (preventiveTasks || []).filter((t) =>
      this.isOrphanMachineRef(t.id_machine || t.machine_id || t.code_machine, activeIds)
    );
    const corrOrphans = (correctiveInterventions || []).filter((i) =>
      this.isOrphanMachineRef(
        i.code_machine || i.id_machine || i.machine_id || i.id_machine_registered,
        activeIds
      )
    );

    const warnings = [];
    if (action === 'CLEAR_PREVENTIVE') {
      warnings.push(
        `Cette action va supprimer ${(preventiveTasks || []).length} tâche(s) préventive(s). La liste des machines restera intacte.`
      );
    } else if (action === 'RESET_PREVENTIVE_BASELINE') {
      warnings.push(
        `Cette action va réinitialiser / recharger le planning préventif de base. ${prevOrphans.length} tâche(s) orpheline(s) détectée(s) actuellement.`
      );
      warnings.push(
        `⚠️ Si le parc machines diffère du seed, des orphelins peuvent apparaître — utilisez Purger dans Paramètres > Intégrité.`
      );
    } else if (action === 'RESET_CORRECTIVE') {
      warnings.push(
        `Cette action va réinitialiser le correctif au seed d'origine. ${corrOrphans.length} intervention(s) orpheline(s) détectée(s) actuellement.`
      );
      warnings.push(
        `⚠️ Si le parc machines diffère du seed, des orphelins peuvent apparaître — utilisez Purger dans Paramètres > Intégrité.`
      );
    } else if (action === 'CLEAR_CORRECTIVE') {
      warnings.push(
        `Cette action va vider les demandes et interventions correctives (${(correctiveInterventions || []).length} éléments).`
      );
    }

    return {
      action,
      preventiveOrphanCount: prevOrphans.length,
      correctiveOrphanCount: corrOrphans.length,
      machineCount: (machines || []).length,
      preventiveCount: (preventiveTasks || []).length,
      correctiveCount: (correctiveInterventions || []).length,
      warnings,
    };
  }

  /**
   * Purge orphan preventive tasks.
   */
  purgeOrphanPreventiveTasks(tasks = [], machines = []) {
    const active = this.buildActiveMachineIdSet(machines);
    const kept = [];
    const removed = [];
    (tasks || []).forEach((t) => {
      const ref = t.id_machine || t.machine_id || t.code_machine;
      if (this.isOrphanMachineRef(ref, active)) removed.push(t);
      else kept.push(t);
    });
    return { kept, removed, removedCount: removed.length };
  }

  /**
   * Purge orphan corrective interventions.
   */
  purgeOrphanCorrectiveInterventions(interventions = [], machines = []) {
    const active = this.buildActiveMachineIdSet(machines);
    const kept = [];
    const removed = [];
    (interventions || []).forEach((i) => {
      const ref = i.code_machine || i.id_machine || i.machine_id || i.id_machine_registered;
      if (this.isOrphanMachineRef(ref, active)) removed.push(i);
      else kept.push(i);
    });
    return { kept, removed, removedCount: removed.length };
  }

  /**
   * Bulk relink orphan items to a target active machine.
   */
  bulkRelinkOrphans({
    entityType, // 'preventive' | 'corrective'
    items = [],
    machines = [],
    newMachineId,
  } = {}) {
    const active = this.buildActiveMachineIdSet(machines);
    const target = String(newMachineId || '').trim().toUpperCase();
    if (!target || !active.has(target)) {
      return { updated: items, changedCount: 0, error: 'INVALID_TARGET_MACHINE' };
    }
    let changedCount = 0;
    const updated = (items || []).map((item) => {
      const ref =
        entityType === 'preventive'
          ? item.id_machine || item.machine_id || item.code_machine
          : item.code_machine || item.id_machine || item.machine_id || item.id_machine_registered;
      if (!this.isOrphanMachineRef(ref, active)) return item;
      changedCount++;
      if (entityType === 'preventive') {
        return { ...item, id_machine: target, machine_id: target, code_machine: target, _isOrphan: false };
      }
      return {
        ...item,
        code_machine: target,
        id_machine: target,
        machine_id: target,
        _isOrphan: false,
      };
    });
    return { updated, changedCount, error: null };
  }
}

export const dataIntegrityService = new DataIntegrityService();
export default dataIntegrityService;
