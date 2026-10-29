/**
 * Maker-Checker & Financial Audit Lock Reconciliation Service
 *
 * Ensures that any post-approval deletion or modification of an auto-generated
 * stock movement (`MVT-BT-`, `MVT-PRV-`, `MVT-SRT-`) stays 100% synchronized with:
 *  - Corrective Work Orders (`correctiveInterventions`: `pieces_utilisees`, `cout_pdr`, `pdr_cost`)
 *  - Preventive Executions & Tasks (`preventiveExecutions`: `sparesUsed`, `sparesCost`, `totalCost`, `stock_deducted`; `preventiveTasks`: `cout_cumule`)
 *  - Store Issue Demands (`sortieDemands`: `items`, `stock_deducted`, `validation_status`)
 *
 * This prevents phantom TCO costs on machines when a movement is cancelled in the warehouse,
 * and prevents discrepancies between Warehouse Stock and Executive Financial Reports.
 */

export interface AuditReconciliationInput {
  correctiveInterventions: any[];
  preventiveExecutions: any[];
  preventiveTasks: any[];
  sortieDemands: any[];
}

export interface AuditReconciliationResult {
  linkedType: 'CORRECTIVE_BT' | 'PREVENTIVE_EXEC' | 'SORTIE_DEMAND' | null;
  linkedId: string | null;
  correctiveChanged: boolean;
  preventiveExecsChanged: boolean;
  preventiveTasksChanged: boolean;
  sortieDemandsChanged: boolean;
  correctiveInterventions: any[];
  preventiveExecutions: any[];
  preventiveTasks: any[];
  sortieDemands: any[];
  auditSummary: string | null;
}

const norm = (val: unknown): string => String(val ?? '').trim().toUpperCase();

function matchesBtMovement(mvt: any, bt: any): boolean {
  if (!mvt || !bt) return false;
  const mvtId = String(mvt.id || '').trim();
  const btId = String(bt.id || '').trim();
  const numBt = String(bt.num_bt || bt.id || '').trim();

  if (mvt.source_bt_id && String(mvt.source_bt_id).trim() === btId) return true;
  if (Array.isArray(bt.emitted_movement_ids) && bt.emitted_movement_ids.includes(mvtId)) {
    return true;
  }

  const codeBon = norm(mvt.code_bon);
  if (numBt && (codeBon === norm(`BS-BT-${numBt}`) || codeBon.startsWith(norm(`BS-BT-${numBt}-`)))) {
    return true;
  }

  const motif = norm(mvt.motif || mvt.observation || mvt.commentaire);
  if (mvtId.startsWith('MVT-BT-') && numBt && motif.includes(norm(`BT ${numBt}`))) {
    return true;
  }

  return false;
}

function matchesPreventiveExecMovement(mvt: any, exec: any): boolean {
  if (!mvt || !exec) return false;
  const mvtId = String(mvt.id || '').trim();
  const execId = String(exec.id || '').trim();

  if (mvt.source_execution_id && String(mvt.source_execution_id).trim() === execId) return true;
  if (Array.isArray(exec.emitted_movement_ids) && exec.emitted_movement_ids.includes(mvtId)) {
    return true;
  }

  const shortExecId = execId.slice(-6);
  const codeBon = norm(mvt.code_bon);
  if (
    shortExecId &&
    (codeBon === norm(`BS-PRV-${shortExecId}`) || codeBon.startsWith(norm(`BS-PRV-${shortExecId}-`)))
  ) {
    return true;
  }

  return false;
}

function matchesSortieDemandMovement(mvt: any, demand: any): boolean {
  if (!mvt || !demand) return false;
  const mvtId = String(mvt.id || '').trim();
  const demandId = String(demand.id || '').trim();

  if (
    (mvt.source_demand_id && String(mvt.source_demand_id).trim() === demandId) ||
    (mvt.merged_demand_id && String(mvt.merged_demand_id).trim() === demandId)
  ) {
    return true;
  }

  if (Array.isArray(demand.emitted_movement_ids) && demand.emitted_movement_ids.includes(mvtId)) {
    return true;
  }

  return false;
}

/**
 * Reconciles Corrective BTs, Preventive Executions/Tasks, and Sortie Demands
 * when a stock movement is deleted from the warehouse ledger.
 */
export function reconcileMakerCheckerOnMovementDelete(
  mvt: any,
  state: AuditReconciliationInput
): AuditReconciliationResult {
  const result: AuditReconciliationResult = {
    linkedType: null,
    linkedId: null,
    correctiveChanged: false,
    preventiveExecsChanged: false,
    preventiveTasksChanged: false,
    sortieDemandsChanged: false,
    correctiveInterventions: state.correctiveInterventions || [],
    preventiveExecutions: state.preventiveExecutions || [],
    preventiveTasks: state.preventiveTasks || [],
    sortieDemands: state.sortieDemands || [],
    auditSummary: null,
  };

  if (!mvt) return result;

  const targetRef = norm(mvt.ref || mvt.code_article);
  const targetQty = Number(mvt.quantite ?? mvt.qty ?? 0) || 0;
  const mvtId = String(mvt.id || '').trim();
  const mvtBon = String(mvt.code_bon || mvtId).trim();

  // 1. Check Corrective Interventions (BT)
  const matchedBtIndex = result.correctiveInterventions.findIndex((bt) =>
    matchesBtMovement(mvt, bt)
  );
  if (matchedBtIndex >= 0) {
    const bt = result.correctiveInterventions[matchedBtIndex];
    const pieces = Array.isArray(bt.pieces_utilisees) ? [...bt.pieces_utilisees] : [];
    const updatedPieces: any[] = [];

    let removedMatch = false;
    for (const p of pieces) {
      const pRef = norm(p?.ref || p?.code_article);
      if (!removedMatch && pRef === targetRef) {
        const currentQty = Number(p?.quantite ?? p?.qty ?? 0) || 0;
        const remainingQty = currentQty - targetQty;
        removedMatch = true;
        if (remainingQty > 0) {
          updatedPieces.push({ ...p, quantite: remainingQty });
        }
      } else {
        updatedPieces.push(p);
      }
    }

    const newTotalPdrCost = Number(
      updatedPieces
        .reduce(
          (sum, p) =>
            sum + (Number(p?.quantite ?? p?.qty ?? 0) || 0) * (Number(p?.prix_unitaire ?? p?.prix ?? 0) || 0),
          0
        )
        .toFixed(2)
    );
    const primaryPiece = updatedPieces[0] || null;
    const prevNote = String(bt.validation_note || '').trim();
    const auditNote = `[Audit Magasin] Mouvement ${mvtBon} (${mvt.ref} x${targetQty}) supprimé — coût PDR recalculé (${newTotalPdrCost} DH).`;

    const updatedBt = {
      ...bt,
      pieces_utilisees: updatedPieces,
      pieces_proposees: updatedPieces,
      pdr_ref: primaryPiece ? primaryPiece.ref : '',
      pdr_designation: primaryPiece
        ? updatedPieces.length > 1
          ? `${primaryPiece.designation} (+${updatedPieces.length - 1} réf.)`
          : primaryPiece.designation
        : '',
      pdr_quantite: primaryPiece ? primaryPiece.quantite : 0,
      pdr_prix: primaryPiece ? primaryPiece.prix_unitaire : 0,
      cout_pdr: newTotalPdrCost,
      pdr_cost: newTotalPdrCost,
      emitted_movement_ids: Array.isArray(bt.emitted_movement_ids)
        ? bt.emitted_movement_ids.filter((id: string) => id !== mvtId)
        : [],
      validation_note: prevNote ? `${prevNote} | ${auditNote}` : auditNote,
      updated_at: new Date().toISOString(),
    };

    result.correctiveInterventions = result.correctiveInterventions.map((item, idx) =>
      idx === matchedBtIndex ? updatedBt : item
    );
    result.correctiveChanged = true;
    result.linkedType = 'CORRECTIVE_BT';
    result.linkedId = bt.num_bt || bt.id;
    result.auditSummary = `Coût PDR du BT ${bt.num_bt || bt.id} recalculé suite à la suppression du mouvement ${mvtBon}.`;
    return result;
  }

  // 2. Check Preventive Executions
  const matchedExecIndex = result.preventiveExecutions.findIndex((exec) =>
    matchesPreventiveExecMovement(mvt, exec)
  );
  if (matchedExecIndex >= 0) {
    const exec = result.preventiveExecutions[matchedExecIndex];
    const spares = Array.isArray(exec.sparesUsed) ? [...exec.sparesUsed] : [];
    const updatedSpares: any[] = [];
    let removedCostDelta = 0;
    let removedMatch = false;

    for (const s of spares) {
      const sRef = norm(s?.ref || s?.code_article);
      if (!removedMatch && sRef === targetRef) {
        const currentQty = Number(s?.qty ?? s?.quantite ?? 0) || 0;
        const unitPrice = Number(s?.unitPrice ?? s?.prix_unitaire ?? 0) || 0;
        const remainingQty = currentQty - targetQty;
        removedMatch = true;
        if (remainingQty > 0) {
          removedCostDelta += targetQty * unitPrice;
          updatedSpares.push({ ...s, qty: remainingQty });
        } else {
          removedCostDelta += currentQty * unitPrice;
        }
      } else {
        updatedSpares.push(s);
      }
    }

    const newSparesCost = Number(
      updatedSpares
        .reduce(
          (sum, s) =>
            sum + (Number(s?.qty ?? s?.quantite ?? 0) || 0) * (Number(s?.unitPrice ?? s?.prix_unitaire ?? 0) || 0),
          0
        )
        .toFixed(2)
    );
    const durationMinutes = Number(exec.durationMinutes || 15);
    const laborRate = Number(exec.laborRate ?? 35);
    const laborCost = (durationMinutes / 60) * laborRate;
    const newTotalCost = Number((newSparesCost + laborCost).toFixed(2));
    const prevNote = String(exec.validation_note || '').trim();
    const auditNote = `[Audit Magasin] Mouvement ${mvtBon} (${mvt.ref} x${targetQty}) supprimé — coût PDR recalculé (${newSparesCost} DH).`;

    const updatedExec = {
      ...exec,
      sparesUsed: updatedSpares,
      sparesProposed: updatedSpares,
      sparesCost: newSparesCost,
      totalCost: newTotalCost,
      stock_deducted: updatedSpares.length > 0,
      emitted_movement_ids: Array.isArray(exec.emitted_movement_ids)
        ? exec.emitted_movement_ids.filter((id: string) => id !== mvtId)
        : [],
      validation_note: prevNote ? `${prevNote} | ${auditNote}` : auditNote,
      updated_at: new Date().toISOString(),
    };

    result.preventiveExecutions = result.preventiveExecutions.map((item, idx) =>
      idx === matchedExecIndex ? updatedExec : item
    );
    result.preventiveExecsChanged = true;

    if (exec.taskId && removedCostDelta > 0) {
      result.preventiveTasks = result.preventiveTasks.map((t) => {
        if (String(t.id) === String(exec.taskId)) {
          const prevCumul = Number(t.cout_cumule || 0);
          return {
            ...t,
            pieces_proposees: updatedSpares,
            cout_cumule: Number(Math.max(0, prevCumul - removedCostDelta).toFixed(2)),
            updated_at: new Date().toISOString(),
          };
        }
        return t;
      });
      result.preventiveTasksChanged = true;
    }

    result.linkedType = 'PREVENTIVE_EXEC';
    result.linkedId = String(exec.id);
    result.auditSummary = `Coût PDR de l'exécution préventive ${exec.taskCode || exec.id} recalculé suite à la suppression du mouvement ${mvtBon}.`;
    return result;
  }

  // 3. Check Sortie Demands
  const matchedDemandIndex = result.sortieDemands.findIndex((d) =>
    matchesSortieDemandMovement(mvt, d)
  );
  if (matchedDemandIndex >= 0) {
    const demand = result.sortieDemands[matchedDemandIndex];
    const items = Array.isArray(demand.items) ? [...demand.items] : [];
    const remainingItems = items.filter((it: any) => norm(it?.ref) !== targetRef);
    const remainingMovementIds = Array.isArray(demand.emitted_movement_ids)
      ? demand.emitted_movement_ids.filter((id: string) => id !== mvtId)
      : [];
    const allCancelled = remainingMovementIds.length === 0 && remainingItems.length === 0;
    const prevNote = String(demand.validation_note || '').trim();
    const auditNote = `[Audit Magasin] Mouvement ${mvtBon} (${mvt.ref} x${targetQty}) annulé.`;

    const updatedDemand = {
      ...demand,
      items: remainingItems.length > 0 ? remainingItems : items,
      emitted_movement_ids: remainingMovementIds,
      ...(allCancelled
        ? {
            validation_status: 'REJECTED',
            stock_deducted: false,
          }
        : {}),
      validation_note: prevNote ? `${prevNote} | ${auditNote}` : auditNote,
      updated_at: new Date().toISOString(),
    };

    result.sortieDemands = result.sortieDemands.map((item, idx) =>
      idx === matchedDemandIndex ? updatedDemand : item
    );
    result.sortieDemandsChanged = true;
    result.linkedType = 'SORTIE_DEMAND';
    result.linkedId = String(demand.code_bon_tech || demand.id);
    result.auditSummary = `Demande de sortie ${demand.code_bon_tech || demand.id} mise à jour suite à l'annulation du mouvement ${mvtBon}.`;
    return result;
  }

  return result;
}

/**
 * Reconciles Corrective BTs, Preventive Executions/Tasks, and Sortie Demands
 * when a linked stock movement's quantity or unit price is modified in the warehouse.
 */
export function reconcileMakerCheckerOnMovementUpdate(
  oldMvt: any,
  updatedMvt: any,
  state: AuditReconciliationInput
): AuditReconciliationResult {
  const result: AuditReconciliationResult = {
    linkedType: null,
    linkedId: null,
    correctiveChanged: false,
    preventiveExecsChanged: false,
    preventiveTasksChanged: false,
    sortieDemandsChanged: false,
    correctiveInterventions: state.correctiveInterventions || [],
    preventiveExecutions: state.preventiveExecutions || [],
    preventiveTasks: state.preventiveTasks || [],
    sortieDemands: state.sortieDemands || [],
    auditSummary: null,
  };

  if (!oldMvt || !updatedMvt) return result;

  const targetRef = norm(oldMvt.ref || oldMvt.code_article || updatedMvt.ref);
  const newRef = String(updatedMvt.ref || oldMvt.ref || '').trim();
  const newQty = Number(updatedMvt.quantite ?? updatedMvt.qty ?? oldMvt.quantite ?? 0) || 0;
  const newPrice =
    updatedMvt.prix_unitaire !== undefined
      ? Number(updatedMvt.prix_unitaire) || 0
      : updatedMvt.unitPrice !== undefined
      ? Number(updatedMvt.unitPrice) || 0
      : undefined;

  // 1. Check Corrective BT
  const matchedBtIndex = result.correctiveInterventions.findIndex((bt) =>
    matchesBtMovement(oldMvt, bt)
  );
  if (matchedBtIndex >= 0) {
    const bt = result.correctiveInterventions[matchedBtIndex];
    const pieces = Array.isArray(bt.pieces_utilisees) ? [...bt.pieces_utilisees] : [];
    let matchedPiece = false;

    const updatedPieces = pieces.map((p: any) => {
      if (!matchedPiece && norm(p?.ref || p?.code_article) === targetRef) {
        matchedPiece = true;
        return {
          ...p,
          ref: newRef || p.ref,
          quantite: newQty,
          ...(newPrice !== undefined ? { prix_unitaire: newPrice } : {}),
        };
      }
      return p;
    });

    if (matchedPiece) {
      const newTotalPdrCost = Number(
        updatedPieces
          .reduce(
            (sum, p) =>
              sum + (Number(p?.quantite ?? p?.qty ?? 0) || 0) * (Number(p?.prix_unitaire ?? p?.prix ?? 0) || 0),
            0
          )
          .toFixed(2)
      );
      const primaryPiece = updatedPieces[0] || null;

      const updatedBt = {
        ...bt,
        pieces_utilisees: updatedPieces,
        pieces_proposees: updatedPieces,
        pdr_ref: primaryPiece ? primaryPiece.ref : '',
        pdr_quantite: primaryPiece ? primaryPiece.quantite : 0,
        pdr_prix: primaryPiece ? primaryPiece.prix_unitaire : 0,
        cout_pdr: newTotalPdrCost,
        pdr_cost: newTotalPdrCost,
        updated_at: new Date().toISOString(),
      };

      result.correctiveInterventions = result.correctiveInterventions.map((item, idx) =>
        idx === matchedBtIndex ? updatedBt : item
      );
      result.correctiveChanged = true;
      result.linkedType = 'CORRECTIVE_BT';
      result.linkedId = bt.num_bt || bt.id;
      result.auditSummary = `Coût PDR du BT ${bt.num_bt || bt.id} synchronisé (${newTotalPdrCost} DH).`;
    }
    return result;
  }

  // 2. Check Preventive Execution
  const matchedExecIndex = result.preventiveExecutions.findIndex((exec) =>
    matchesPreventiveExecMovement(oldMvt, exec)
  );
  if (matchedExecIndex >= 0) {
    const exec = result.preventiveExecutions[matchedExecIndex];
    const oldSparesCost = Number(exec.sparesCost || 0);
    const spares = Array.isArray(exec.sparesUsed) ? [...exec.sparesUsed] : [];
    let matchedSpare = false;

    const updatedSpares = spares.map((s: any) => {
      if (!matchedSpare && norm(s?.ref || s?.code_article) === targetRef) {
        matchedSpare = true;
        return {
          ...s,
          ref: newRef || s.ref,
          qty: newQty,
          ...(newPrice !== undefined ? { unitPrice: newPrice } : {}),
        };
      }
      return s;
    });

    if (matchedSpare) {
      const newSparesCost = Number(
        updatedSpares
          .reduce(
            (sum, s) =>
              sum + (Number(s?.qty ?? s?.quantite ?? 0) || 0) * (Number(s?.unitPrice ?? s?.prix_unitaire ?? 0) || 0),
            0
          )
          .toFixed(2)
      );
      const durationMinutes = Number(exec.durationMinutes || 15);
      const laborRate = Number(exec.laborRate ?? 35);
      const laborCost = (durationMinutes / 60) * laborRate;
      const newTotalCost = Number((newSparesCost + laborCost).toFixed(2));
      const costDiff = newSparesCost - oldSparesCost;

      const updatedExec = {
        ...exec,
        sparesUsed: updatedSpares,
        sparesProposed: updatedSpares,
        sparesCost: newSparesCost,
        totalCost: newTotalCost,
        updated_at: new Date().toISOString(),
      };

      result.preventiveExecutions = result.preventiveExecutions.map((item, idx) =>
        idx === matchedExecIndex ? updatedExec : item
      );
      result.preventiveExecsChanged = true;

      if (exec.taskId && costDiff !== 0) {
        result.preventiveTasks = result.preventiveTasks.map((t) => {
          if (String(t.id) === String(exec.taskId)) {
            const prevCumul = Number(t.cout_cumule || 0);
            return {
              ...t,
              pieces_proposees: updatedSpares,
              cout_cumule: Number(Math.max(0, prevCumul + costDiff).toFixed(2)),
              updated_at: new Date().toISOString(),
            };
          }
          return t;
        });
        result.preventiveTasksChanged = true;
      }

      result.linkedType = 'PREVENTIVE_EXEC';
      result.linkedId = String(exec.id);
      result.auditSummary = `Coût PDR de l'exécution préventive ${exec.taskCode || exec.id} synchronisé (${newSparesCost} DH).`;
    }
    return result;
  }

  return result;
}
