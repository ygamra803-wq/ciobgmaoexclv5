import { startTransition } from 'react';
import { SparePartApplicationService } from '../application/services/SparePartApplicationService';
import { MachineApplicationService } from '../application/services/MachineApplicationService';
import { TaskApplicationService } from '../application/services/TaskApplicationService';
import { Logger } from '../core/logger/LoggerService';
import { movementRepository } from '../application/MovementRepository';
import { dataIntegrityService } from '../services/dataIntegrityService';
import {
  reconcileMakerCheckerOnMovementDelete,
  reconcileMakerCheckerOnMovementUpdate,
} from '../core/security/auditLockReconciliation';
import {
  isArchivedMachine,
  transitionMachineLifecycle,
} from '../utils/activeMachines';

export function useAppComplexHandlers({
  zones, setZones,
  operations, setOperations,
  technicians, setTechnicians,
  machines, _machines, setMachines,
  mouvements, setMouvements,
  setTypes,
  rawStock, setRawStock,
  setDesignations,
  setFamilies,
  templates = [],
  setTemplates,
  setCompGroups,
  compFamilies = [],
  setCompFamilies,
  compTemplates = [],
  setCompTemplates,
  partTypes: _partTypes = [],
  setPartTypes,
  partDesignations = [],
  setPartDesignations,
  warehouseItems = [],
  setWarehouseItems,
  blueprints = [],
  sortiesExterne = [],
  setSortiesExterne,
  sortieDemands = [],
  setSortieDemands,
  preventiveTasks = [],
  setPreventiveTasks,
  preventiveExecutions = [],
  setPreventiveExecutions,
  correctiveInterventions = [],
  setCorrectiveInterventions,
  machineElementsLedger = [],
  setMachineElementsLedger,
  showToast,
  setCurrentTab,
}) {
  const activeMachines = machines || _machines || [];
  const handleUpdateZone = (id, updatedZone) => {
    setZones((prev) => prev.map((z) => (z.id_zone === id ? updatedZone : z)));
    const oldZone = zones.find((z) => z.id_zone === id);
    if (oldZone && oldZone.id_zone !== updatedZone.id_zone) {
      setTechnicians((prev) =>
        prev.map((t) => (t.id_zone === id ? { ...t, id_zone: updatedZone.id_zone } : t))
      );
      setOperations((prev) =>
        prev.map((o) => (o.id_zone === id ? { ...o, id_zone: updatedZone.id_zone } : o))
      );
      setMachines((prev) =>
        prev.map((m) =>
          m.id_zone_default === id ? { ...m, id_zone_default: updatedZone.id_zone } : m
        )
      );
      setMouvements((prev) =>
        prev.map((m) => (m.id_zone === id ? { ...m, id_zone: updatedZone.id_zone } : m))
      );
    }
  };
  const handleDeleteZone = (id) => {
    const hasMachines = activeMachines.some((m) => m.id_zone_default === id || m.id_zone === id);
    const hasTechs = (technicians || []).some((t) => t.id_zone === id);
    if (hasMachines || hasTechs) {
      showToast?.(`Zone ${id} contient des machines ou techniciens actifs. Supprimez ou réaffectez-les d'abord.`, 'warning');
      return;
    }
    setZones((prev) => prev.filter((z) => z.id_zone !== id));
    showToast?.(`Zone ${id} supprimée.`, 'info');
  };

  const handleUpdateOperation = (id, updatedOp) => {
    setOperations((prev) => prev.map((o) => (o.id_operation === id ? updatedOp : o)));
    const oldOp = operations.find((o) => o.id_operation === id);
    if (oldOp && oldOp.nom !== updatedOp.nom) {
      setMouvements((prev) =>
        prev.map((m) => (m.operation === oldOp.nom ? { ...m, operation: updatedOp.nom } : m))
      );
    }
  };
  const handleDeleteOperation = (id) =>
    setOperations((prev) => prev.filter((o) => o.id_operation !== id));

  const handleUpdateMachine = (id, updatedMch) => {
    const oldCodeNorm = String(id || '').trim().toUpperCase();
    const newId = updatedMch?.id_machine_registered || id;
    const newCodeNorm = String(newId || '').trim().toUpperCase();
    const newName = updatedMch?.designation || updatedMch?.nom;

    const existingMachine = (activeMachines || []).find(
      (m) => String(m?.id_machine_registered || m?.id || '').trim().toUpperCase() === oldCodeNorm
    );

    const prevStatusStr = String(existingMachine?.status || existingMachine?.statut || 'En Service').trim();
    const nextStatusStr = String(updatedMch?.status || updatedMch?.statut || prevStatusStr).trim();
    const wasArchived = isArchivedMachine(existingMachine);
    const targetArchived = isArchivedMachine({
      ...updatedMch,
      status: nextStatusStr,
      statut: nextStatusStr,
    });

    const effectiveTargetStatus = targetArchived ? 'ARCHIVEE' : nextStatusStr;
    const statusOrLifecycleChanged =
      existingMachine &&
      (wasArchived !== targetArchived ||
        prevStatusStr.toUpperCase() !== effectiveTargetStatus.toUpperCase());

    let finalMachinePayload = updatedMch;
    if (statusOrLifecycleChanged) {
      const transition = transitionMachineLifecycle({
        machine: { ...existingMachine, ...updatedMch, status: prevStatusStr },
        targetStatus: effectiveTargetStatus,
        preventiveTasks,
        reason: targetArchived
          ? 'Archivage machine via fiche équipement'
          : wasArchived
          ? 'Réactivation machine via fiche équipement'
          : `Changement de statut vers ${effectiveTargetStatus}`,
      });
      finalMachinePayload = transition.updatedMachine;

      if (transition.suspendedTasksCount > 0 || transition.restoredTasksCount > 0) {
        setPreventiveTasks?.(transition.updatedPreventiveTasks);
      }

      if (targetArchived) {
        showToast?.(
          `Machine ${newId} archivée (${transition.suspendedTasksCount} tâche(s) préventive(s) suspendue(s)).`,
          'info'
        );
      } else if (wasArchived) {
        showToast?.(
          `Machine ${newId} réactivée en statut « ${effectiveTargetStatus} » (${transition.restoredTasksCount} tâche(s) préventive(s) réactivée(s)).`,
          'success'
        );
      }
    }

    setMachines((prev) =>
      prev.map((m) => (m.id_machine_registered === id ? finalMachinePayload : m))
    );

    if (oldCodeNorm && newCodeNorm && oldCodeNorm !== newCodeNorm) {
      const matchesOldMachine = (val: unknown) =>
        String(val || '').trim().toUpperCase() === oldCodeNorm;

      setMouvements?.((prev) =>
        (prev || []).map((m) =>
          matchesOldMachine(m?.id_machine_registered) || matchesOldMachine(m?.machine)
            ? {
                ...m,
                id_machine_registered: newId,
                ...(m?.machine ? { machine: newId } : {}),
              }
            : m
        )
      );

      setPreventiveTasks?.((prev) =>
        (prev || []).map((t) =>
          matchesOldMachine(t?.id_machine || t?.code_machine || t?.machineCode || t?.machine_id)
            ? {
                ...t,
                id_machine: newId,
                ...(t?.code_machine !== undefined ? { code_machine: newId } : {}),
                ...(t?.machineCode !== undefined ? { machineCode: newId } : {}),
                ...(t?.machine_id !== undefined ? { machine_id: newId } : {}),
                ...(newName && t?.machine ? { machine: newName } : {}),
              }
            : t
        )
      );

      setPreventiveExecutions?.((prev) =>
        (prev || []).map((ex) =>
          matchesOldMachine(ex?.machineCode || ex?.id_machine)
            ? {
                ...ex,
                machineCode: newId,
                ...(ex?.id_machine !== undefined ? { id_machine: newId } : {}),
                ...(newName && ex?.machineName ? { machineName: newName } : {}),
              }
            : ex
        )
      );

      setCorrectiveInterventions?.((prev) =>
        (prev || []).map((ci) =>
          matchesOldMachine(ci?.code_machine || ci?.id_machine || ci?.id_machine_registered)
            ? {
                ...ci,
                code_machine: newId,
                ...(ci?.id_machine !== undefined ? { id_machine: newId } : {}),
                ...(ci?.id_machine_registered !== undefined
                  ? { id_machine_registered: newId }
                  : {}),
                ...(newName && ci?.nom_machine ? { nom_machine: newName } : {}),
              }
            : ci
        )
      );

      setMachineElementsLedger?.((prev) =>
        (prev || []).map((el) =>
          matchesOldMachine(el?.id_machine || el?.id_machine_registered)
            ? {
                ...el,
                id_machine: newId,
                ...(el?.id_machine_registered !== undefined
                  ? { id_machine_registered: newId }
                  : {}),
              }
            : el
        )
      );

      setWarehouseItems?.((prev) =>
        (prev || []).map((w) =>
          matchesOldMachine(w?.id_machine_registered || w?.id_machine)
            ? {
                ...w,
                id_machine_registered: newId,
                ...(w?.id_machine !== undefined ? { id_machine: newId } : {}),
                ...(matchesOldMachine(w?.emplacement) ? { emplacement: newId } : {}),
              }
            : w
        )
      );

      setSortiesExterne?.((prev) =>
        (prev || []).map((se) =>
          matchesOldMachine(se?.id_machine || se?.code_machine)
            ? {
                ...se,
                id_machine: newId,
                ...(se?.code_machine !== undefined ? { code_machine: newId } : {}),
              }
            : se
        )
      );

      setSortieDemands?.((prev) =>
        (prev || []).map((sd) =>
          matchesOldMachine(sd?.id_machine_registered || sd?.code_machine || sd?.id_machine)
            ? {
                ...sd,
                id_machine_registered: newId,
                ...(sd?.code_machine !== undefined ? { code_machine: newId } : {}),
                ...(sd?.id_machine !== undefined ? { id_machine: newId } : {}),
              }
            : sd
        )
      );
    }
  };

  const handleDeleteMachine = (id) => {
    const deps = dataIntegrityService.getMachineDependencies(id, {
      preventiveTasks,
      preventiveExecutions,
      correctiveInterventions,
      mouvements,
      machineElementsLedger,
      sortiesExterne,
      sortieDemands,
    });

    if (!deps.canHardDelete) {
      const targetCodeNorm = String(id || '').trim().toUpperCase();
      const archiveTimestamp = new Date().toISOString();

      const parts = [];
      if (deps.preventiveCount) parts.push(`${deps.preventiveCount} tâche(s) préventive(s)`);
      if (deps.preventiveExecutionsCount) parts.push(`${deps.preventiveExecutionsCount} exécution(s) PM`);
      if (deps.correctiveCount) parts.push(`${deps.correctiveCount} intervention(s) corrective(s)`);
      if (deps.movementsCount) parts.push(`${deps.movementsCount} mouvement(s)`);
      if (deps.bomCount) parts.push(`${deps.bomCount} élément(s) BOM`);
      if (deps.externalSortiesCount) parts.push(`${deps.externalSortiesCount} bobinage(s) externe(s)`);
      if (deps.sortieDemandsCount) parts.push(`${deps.sortieDemandsCount} demande(s) PDR`);

      const archiveReason = `Archivage automatique (historique protégé : ${parts.join(', ')})`;

      // Soft-archive machine + record lifecycle event to preserve Preventive / Corrective / Movements / External history
      setMachines((prev) =>
        prev.map((m) => {
          if (m.id_machine_registered !== id && String(m.id_machine_registered || '').trim().toUpperCase() !== targetCodeNorm) {
            return m;
          }
          const { updatedMachine } = transitionMachineLifecycle({
            machine: m,
            targetStatus: 'ARCHIVEE',
            preventiveTasks,
            timestamp: archiveTimestamp,
            reason: archiveReason,
          });
          return updatedMachine;
        })
      );

      // Suspend active/scheduled preventive tasks on this archived machine so they don't pollute technician mobile queues
      setPreventiveTasks?.((prev) => {
        const targetMachine = (activeMachines || []).find(
          (m) => String(m?.id_machine_registered || '').trim().toUpperCase() === targetCodeNorm
        ) || { id_machine_registered: id };
        const { updatedPreventiveTasks } = transitionMachineLifecycle({
          machine: targetMachine,
          targetStatus: 'ARCHIVEE',
          preventiveTasks: prev || [],
          timestamp: archiveTimestamp,
          reason: archiveReason,
        });
        return updatedPreventiveTasks;
      });

      showToast?.(
        `Machine ${id} archivée (et ses gammes suspendues) car liée à : ${parts.join(', ')}. L'historique est préservé.`,
        'info'
      );
      return;
    }

    // No dependencies → hard delete
    setMachines((prev) => prev.filter((m) => m.id_machine_registered !== id));
    showToast?.(`Machine ${id} supprimée définitivement.`, 'success');
  };

  const handleUpdateType = (id, updatedType) => {
    setTypes((prev) => prev.map((t) => (t.id_type === id ? updatedType : t)));
    if (id !== updatedType.id_type) {
      setRawStock((prev) =>
        prev.map((s) =>
          s.type === id || s.id_type === id
            ? { ...s, type: updatedType.id_type, id_type: updatedType.id_type }
            : s
        )
      );
    }
  };
  const handleDeleteType = (id) => {
    const linkedStockCount = (rawStock || []).filter(
      (s) => s.type === id || s.id_type === id
    ).length;
    if (linkedStockCount > 0) {
      showToast?.(
        `Suppression refusée : le type "${id}" est lié à ${linkedStockCount} article(s) PDR en stock.`,
        'warning'
      );
      return;
    }
    setTypes((prev) => prev.filter((t) => t.id_type !== id));
    showToast?.(`Type "${id}" supprimé avec succès.`, 'info');
  };

  const handleUpdateDesignation = (id, updatedDesig) => {
    const existingItem = (rawStock || []).find(
      (s) => s.ref === id || s.id_designation === id || s.id === id
    );
    const oldRef = String(existingItem?.ref || id || '').trim();
    const newRef = String(updatedDesig?.ref || oldRef).trim();

    const updater = (s) =>
      s.ref === id || s.id_designation === id || s.id === id
        ? {
            ...s,
            ref: updatedDesig.ref,
            designation: updatedDesig.designation,
            type: updatedDesig.id_type,
            id_type: updatedDesig.id_type,
            stockInitial: Number(updatedDesig.stockInitial),
            seuil: Number(updatedDesig.seuil),
            emplacement: updatedDesig.emplacement,
          }
        : s;
    setRawStock((prev) => prev.map(updater));
    setDesignations((prev) => (prev || []).map(updater));

    if (oldRef && newRef && oldRef.toUpperCase() !== newRef.toUpperCase()) {
      const oldUpper = oldRef.toUpperCase();
      setMouvements?.((prev) =>
        (prev || []).map((m) =>
          String(m?.ref || m?.code_article || '').trim().toUpperCase() === oldUpper
            ? {
                ...m,
                ref: newRef,
                ...(m?.code_article !== undefined ? { code_article: newRef } : {}),
                ...(updatedDesig?.designation ? { designation: updatedDesig.designation } : {}),
              }
            : m
        )
      );
      setSortieDemands?.((prev) =>
        (prev || []).map((sd) => {
          const topMatch = String(sd?.ref || '').trim().toUpperCase() === oldUpper;
          const hasItemMatch =
            Array.isArray(sd?.items) &&
            sd.items.some((it: any) => String(it?.ref || '').trim().toUpperCase() === oldUpper);
          if (!topMatch && !hasItemMatch) return sd;
          return {
            ...sd,
            ...(topMatch ? { ref: newRef } : {}),
            ...(Array.isArray(sd?.items)
              ? {
                  items: sd.items.map((it: any) =>
                    String(it?.ref || '').trim().toUpperCase() === oldUpper
                      ? { ...it, ref: newRef }
                      : it
                  ),
                }
              : {}),
          };
        })
      );
    }
  };

  const handleDeleteDesignation = (id) => {
    const targetItem = (rawStock || []).find(
      (s) => s.ref === id || s.id_designation === id || s.id === id
    );
    const refNorm = String(targetItem?.ref || id || '').trim().toUpperCase();

    const hasMovements = (mouvements || []).some(
      (m) => String(m?.ref || m?.code_article || '').trim().toUpperCase() === refNorm
    );
    const hasSortieDemands = (sortieDemands || []).some(
      (sd) =>
        String(sd?.ref || '').trim().toUpperCase() === refNorm ||
        (Array.isArray(sd?.items) &&
          sd.items.some((it: any) => String(it?.ref || '').trim().toUpperCase() === refNorm))
    );

    if (hasMovements || hasSortieDemands) {
      const archiveTimestamp = new Date().toISOString();
      const archiveUpdater = (item: any) =>
        item.ref === id || item.id_designation === id || item.id === id || String(item.ref || '').trim().toUpperCase() === refNorm
          ? {
              ...item,
              is_active: false,
              actif: false,
              statut: 'ARCHIVE',
              date_archivage: archiveTimestamp,
            }
          : item;
      setRawStock((prev) => prev.map(archiveUpdater));
      setDesignations((prev) => (prev || []).map(archiveUpdater));
      showToast?.(
        `Article ${targetItem?.ref || id} archivé (non supprimé) pour préserver l'historique des mouvements de stock.`,
        'info'
      );
      return;
    }

    setRawStock((prev) =>
      prev.filter((s) => s.ref !== id && s.id_designation !== id && s.id !== id)
    );
    setDesignations((prev) =>
      (prev || []).filter((d) => d.ref !== id && d.id_designation !== id && d.id !== id)
    );
  };
  const handleUpdateDiagnostic = handleUpdateDesignation;
  const handleDeleteDiagnostic = handleDeleteDesignation;

  const handleUpdateFamily = (id, updatedFamily) => {
    setFamilies((prev) => prev.map((f) => (f.id_family === id ? updatedFamily : f)));
    if (id !== updatedFamily.id_family) {
      setTemplates((prev) =>
        prev.map((t) => (t.id_family === id ? { ...t, id_family: updatedFamily.id_family } : t))
      );
      setMachines((prev) =>
        prev.map((m) => (m.id_family === id ? { ...m, id_family: updatedFamily.id_family } : m))
      );
    }
  };
  const handleDeleteFamily = (id) => {
    const linkedTemplates = (templates || []).filter((t) => t.id_family === id).length;
    const linkedMachines = activeMachines.filter((m) => m.id_family === id).length;
    const linkedBlueprints = (blueprints || []).filter((b) => b.id_family === id).length;
    if (linkedTemplates > 0 || linkedMachines > 0 || linkedBlueprints > 0) {
      showToast?.(
        `Suppression refusée : la famille "${id}" est utilisée (${linkedMachines} machine(s), ${linkedTemplates} modèle(s), ${linkedBlueprints} blueprint(s)).`,
        'warning'
      );
      return;
    }
    setFamilies((prev) => prev.filter((f) => f.id_family !== id));
    showToast?.(`Famille "${id}" supprimée.`, 'info');
  };

  // COMPONENT GROUPS, FAMILIES & TEMPLATES CRUD
  const handleUpdateCompGroup = (id, updatedGroup) => {
    setCompGroups((prev) =>
      prev.map((g) => (g.id === id || g.id_groupe === id ? updatedGroup : g))
    );
    if (id !== (updatedGroup.id_groupe || updatedGroup.id)) {
      const newGroupId = updatedGroup.id_groupe || updatedGroup.id;
      setCompFamilies((prev) =>
        prev.map((f) => (f.id_groupe === id ? { ...f, id_groupe: newGroupId } : f))
      );
    }
    showToast(`Groupe "${updatedGroup.libelle || id}" mis à jour avec succès !`);
  };

  const handleDeleteCompGroup = (id) => {
    const linkedFamilies = (compFamilies || []).filter(
      (f) => f.id_groupe === id || f.groupe === id
    ).length;
    if (linkedFamilies > 0) {
      showToast?.(
        `Suppression refusée : le groupe "${id}" contient ${linkedFamilies} famille(s) d'organes.`,
        'warning'
      );
      return;
    }
    setCompGroups((prev) => prev.filter((g) => g.id !== id && g.id_groupe !== id));
    showToast?.(`Groupe supprimé avec succès !`, 'info');
  };

  const handleUpdateCompFamily = (id, updatedFam) => {
    setCompFamilies((prev) => prev.map((f) => (f.id_family === id ? updatedFam : f)));
    if (id !== updatedFam.id_family) {
      setCompTemplates((prev) =>
        prev.map((t) => (t.id_family === id ? { ...t, id_family: updatedFam.id_family } : t))
      );
      setWarehouseItems((prev) =>
        prev.map((w) => (w.id_family === id ? { ...w, id_family: updatedFam.id_family } : w))
      );
    }
  };
  const handleDeleteCompFamily = (id) => {
    const linkedTemplates = (compTemplates || []).filter((t) => t.id_family === id).length;
    const linkedWh = (warehouseItems || []).filter((w) => w.id_family === id).length;
    const linkedBp = (blueprints || []).filter((b) =>
      (b.components_theoriques || []).some((c) => c.id_family === id)
    ).length;
    if (linkedTemplates > 0 || linkedWh > 0 || linkedBp > 0) {
      showToast?.(
        `Suppression refusée : la famille "${id}" est liée à ${linkedWh} organe(s) Entrepôt, ${linkedTemplates} modèle(s) et ${linkedBp} blueprint(s).`,
        'warning'
      );
      return;
    }
    setCompFamilies((prev) => prev.filter((f) => f.id_family !== id));
    showToast?.(`Famille d'organes "${id}" supprimée.`, 'info');
  };

  const handleUpdateCompTemplate = (id, updatedTpl) => {
    setCompTemplates((prev) => prev.map((t) => (t.id_templates === id ? updatedTpl : t)));
    if (id !== updatedTpl.id_templates) {
      setWarehouseItems((prev) =>
        prev.map((w) =>
          w.id_templates === id ? { ...w, id_templates: updatedTpl.id_templates } : w
        )
      );
    }
  };
  const handleDeleteCompTemplate = (id) => {
    const linkedWh = (warehouseItems || []).filter(
      (w) => w.id_templates === id || w.id_template === id
    ).length;
    const linkedBp = (blueprints || []).filter((b) =>
      (b.components_theoriques || []).some((c) => c.id_template === id || c.id_templates === id)
    ).length;
    if (linkedWh > 0 || linkedBp > 0) {
      showToast?.(
        `Suppression refusée : le modèle "${id}" est lié à ${linkedWh} organe(s) Entrepôt et ${linkedBp} blueprint(s).`,
        'warning'
      );
      return;
    }
    setCompTemplates((prev) => prev.filter((t) => t.id_templates !== id));
    showToast?.(`Modèle d'organe "${id}" supprimé.`, 'info');
  };

  // PART TYPES & PART DESIGNATIONS CRUD
  const handleUpdatePartType = (id, updatedType) => {
    setPartTypes((prev) => prev.map((t) => (t.id_type === id ? updatedType : t)));
    if (id !== updatedType.id_type) {
      setPartDesignations((prev) =>
        prev.map((d) =>
          d.id_type === id
            ? { ...d, id_type: updatedType.id_type, type: updatedType.id_type }
            : d
        )
      );
      setWarehouseItems((prev) =>
        prev.map((w) =>
          w.id_type === id
            ? { ...w, id_type: updatedType.id_type, type: updatedType.id_type }
            : w
        )
      );
    }
  };
  const handleDeletePartType = (id) => {
    const linkedDesig = (partDesignations || []).filter(
      (d) => d.id_type === id || d.type === id
    ).length;
    const linkedWh = (warehouseItems || []).filter(
      (w) => w.id_type === id || w.type === id
    ).length;
    const linkedBp = (blueprints || []).filter((b) =>
      (b.parts_theoriques || []).some((p) => p.id_type === id)
    ).length;
    if (linkedDesig > 0 || linkedWh > 0 || linkedBp > 0) {
      showToast?.(
        `Suppression refusée : le type "${id}" est lié à ${linkedDesig} désignation(s), ${linkedWh} élément(s) Entrepôt et ${linkedBp} blueprint(s).`,
        'warning'
      );
      return;
    }
    setPartTypes((prev) => prev.filter((t) => t.id_type !== id));
    showToast?.(`Type de pièce "${id}" supprimé.`, 'info');
  };

  const handleUpdatePartDesignation = (id, updatedDesig) => {
    setPartDesignations((prev) => prev.map((d) => (d.id === id || d.ref === id ? updatedDesig : d)));
    setWarehouseItems((prev) =>
      prev.map((w) =>
        w.id_part_designation === id || w.ref === id
          ? {
              ...w,
              ref: updatedDesig.ref || w.ref,
              designation: updatedDesig.designation || w.designation,
              id_type: updatedDesig.id_type || w.id_type,
              type: updatedDesig.id_type || w.type,
              emplacement: updatedDesig.emplacement || w.emplacement,
              seuil: updatedDesig.seuil !== undefined ? Number(updatedDesig.seuil) : w.seuil,
            }
          : w
      )
    );
  };
  const handleDeletePartDesignation = (id) => {
    const linkedWh = (warehouseItems || []).filter(
      (w) => w.id_part_designation === id || w.id_diag === id || w.ref === id
    ).length;
    const linkedBp = (blueprints || []).filter((b) =>
      (b.parts_theoriques || []).some((p) => p.id_part === id || p.ref === id)
    ).length;
    if (linkedWh > 0 || linkedBp > 0) {
      showToast?.(
        `Suppression refusée : la désignation "${id}" est liée à ${linkedWh} élément(s) Entrepôt et ${linkedBp} blueprint(s).`,
        'warning'
      );
      return;
    }
    setPartDesignations((prev) => prev.filter((d) => d.id !== id && d.ref !== id));
    showToast?.(`Désignation "${id}" supprimée.`, 'info');
  };

  const handleUpdateTemplate = (id, updatedTpl) => {
    setTemplates((prev) => prev.map((t) => (t.id_templates === id ? updatedTpl : t)));
    if (id !== updatedTpl.id_templates) {
      setMachines((prev) =>
        prev.map((m) =>
          m.id_templates === id ? { ...m, id_templates: updatedTpl.id_templates } : m
        )
      );
    }
  };
  const handleDeleteTemplate = (id) => {
    const linkedMachines = activeMachines.filter(
      (m) => m.id_templates === id || m.id_template === id
    ).length;
    const linkedBp = (blueprints || []).filter(
      (b) => b.id_templates === id || b.id_template === id
    ).length;
    if (linkedMachines > 0 || linkedBp > 0) {
      showToast?.(
        `Suppression refusée : le modèle "${id}" est lié à ${linkedMachines} machine(s) et ${linkedBp} blueprint(s).`,
        'warning'
      );
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id_templates !== id));
    showToast?.(`Modèle "${id}" supprimé.`, 'info');
  };

  const handleAddTechnician = (newTech) => {
    setTechnicians((prev) => [...prev, newTech]);
  };

  const handleUpdateTechnician = (id, updatedTech) => {
    setTechnicians((prev) => prev.map((t) => (t.id_technician === id ? updatedTech : t)));

    // Cascade update to Machines, Mouvements, Preventive & Corrective if name changed
    const oldTech = technicians.find((t) => t.id_technician === id);
    if (oldTech && oldTech.nom && updatedTech?.nom && oldTech.nom !== updatedTech.nom) {
      const oldName = oldTech.nom;
      const newName = updatedTech.nom;

      setMachines((prev) =>
        prev.map((m) => (m.technician === oldName ? { ...m, technician: newName } : m))
      );
      setMouvements((prev) =>
        prev.map((m) => (m.technicien === oldName ? { ...m, technicien: newName } : m))
      );
      setPreventiveTasks?.((prev) =>
        (prev || []).map((t) => {
          const matchResp = t?.responsable === oldName;
          const matchTech = t?.technicien === oldName;
          if (!matchResp && !matchTech) return t;
          return {
            ...t,
            ...(matchResp ? { responsable: newName } : {}),
            ...(matchTech ? { technicien: newName } : {}),
          };
        })
      );
      setPreventiveExecutions?.((prev) =>
        (prev || []).map((ex) =>
          ex?.executorName === oldName ? { ...ex, executorName: newName } : ex
        )
      );
      setCorrectiveInterventions?.((prev) =>
        (prev || []).map((ci) =>
          ci?.intervenant === oldName ? { ...ci, intervenant: newName } : ci
        )
      );
    }
  };

  const handleDeleteTechnician = (id) => {
    const targetTech = (technicians || []).find((t) => t.id_technician === id || t.id === id);
    const techName = String(targetTech?.nom || targetTech?.name || id || '').trim();
    const techIdNorm = String(id || '').trim().toUpperCase();
    const techNameNorm = techName.toUpperCase();

    const matchesTechRef = (val: unknown) => {
      const v = String(val || '').trim().toUpperCase();
      return Boolean(v && (v === techIdNorm || (techNameNorm && v === techNameNorm)));
    };

    // Check if technician is linked to movements, machines, corrective BTs, preventive tasks/executions, or external bobinage
    const hasMovements = (mouvements || []).some(
      (m) => matchesTechRef(m?.technicien) || matchesTechRef(m?.id_technicien)
    );
    const hasMachines = activeMachines.some((m) => matchesTechRef(m?.technician));
    const hasCorrective = (correctiveInterventions || []).some(
      (ci) =>
        matchesTechRef(ci?.intervenant) ||
        matchesTechRef(ci?.id_technicien) ||
        matchesTechRef(ci?.submitted_by_id) ||
        matchesTechRef(ci?.submitted_by_name)
    );
    const hasPreventiveTasks = (preventiveTasks || []).some(
      (pt) =>
        matchesTechRef(pt?.responsable) ||
        matchesTechRef(pt?.technicien) ||
        matchesTechRef(pt?.id_technicien)
    );
    const hasPreventiveExecs = (preventiveExecutions || []).some(
      (ex) =>
        matchesTechRef(ex?.executorName) ||
        matchesTechRef(ex?.technicien) ||
        matchesTechRef(ex?.id_technicien)
    );
    const hasExternalSorties = (sortiesExterne || []).some(
      (se) =>
        matchesTechRef(se?.technicien_demontage) || matchesTechRef(se?.technicien_montage)
    );

    if (
      hasMovements ||
      hasMachines ||
      hasCorrective ||
      hasPreventiveTasks ||
      hasPreventiveExecs ||
      hasExternalSorties
    ) {
      // Soft Delete: Mark as inactive / archived to preserve integrity of Work Orders, PMs & KPIs
      setTechnicians((prev) =>
        prev.map((t) =>
          t.id_technician === id || t.id === id
            ? {
                ...t,
                is_active: false,
                actif: false,
                statut: 'ARCHIVE',
                date_archivage: new Date().toISOString(),
              }
            : t
        )
      );
      showToast?.(
        `Technicien ${techName} archivé (désactivé) pour préserver l'historique et les KPI des interventions passées.`,
        'info'
      );
    } else {
      setTechnicians((prev) => prev.filter((t) => t.id_technician !== id && t.id !== id));
      showToast?.(`Technicien ${techName} supprimé avec succès.`, 'success');
    }
  };

  const handleAddOperation = (newOp) => {
    setOperations((prev) => [...prev, newOp]);
  };

  const handleAddMachine = async (newMch) => {
    const service = new MachineApplicationService();
    const saved = await service.createMachine(newMch);
    setMachines((prev) => [...prev, saved]);
  };

  const handleAddArticle = async (newArt) => {
    if (rawStock.some((s) => String(s.ref).toLowerCase() === String(newArt.ref).toLowerCase())) {
      showToast('Erreur: La référence existe déjà.', 'error');
      return;
    }
    const service = new SparePartApplicationService();
    const saved = await service.createSparePart({
      id: crypto.randomUUID(),
      ...newArt,
    });
    setRawStock((prev) => [saved, ...prev]);
  };

  const handleAddMouvement = async (newMvtOrArray) => {
    const service = new TaskApplicationService();
    if (Array.isArray(newMvtOrArray)) {
      const saved = await Promise.all(newMvtOrArray.map((m) => service.createTask(m)));
      for (const m of saved) {
        movementRepository.add(m);
      }
      setMouvements((prev) => [...saved, ...prev]);
    } else {
      const saved = await service.createTask(newMvtOrArray);
      movementRepository.add(saved);
      setMouvements((prev) => [saved, ...prev]);
    }
  };

  const handleUpdateArticle = async (id, updatedArt) => {
    const service = new SparePartApplicationService();
    try {
      await service.updateSparePart(id, updatedArt);
    } catch (err) {
      Logger.warn('[useAppComplexHandlers] SparePart update warning:', err);
    }
    setRawStock((prev) =>
      prev.map((a) =>
        a.id === id || a.ref === id || (updatedArt && updatedArt.ref && a.ref === updatedArt.ref)
          ? { ...a, ...updatedArt }
          : a
      )
    );
  };
  const handleDeleteArticle = async (id) => {
    const hasMovements = (mouvements || []).some((m) => m.ref === id || m.code_article === id);
    if (hasMovements) {
      setRawStock((prev) =>
        prev.map((a) =>
          a.id === id || a.ref === id
            ? { ...a, is_active: false, actif: false, statut: 'ARCHIVE', date_archivage: new Date().toISOString() }
            : a
        )
      );
      showToast?.(`Article ${id} archivé (désactivé) pour préserver l'historique des sorties et mouvements.`, 'info');
      return;
    }

    const service = new SparePartApplicationService();
    try {
      await service.deleteSparePart(id);
    } catch (err) {
      Logger.warn('[useAppComplexHandlers] SparePart delete warning:', err);
    }
    setRawStock((prev) => prev.filter((a) => a.id !== id && a.ref !== id));
    showToast?.(`Article ${id} supprimé définitivement.`, 'success');
  };

  const handleUpdateMouvement = async (id, updatedMvt) => {
    const oldMvt = (mouvements || []).find(
      (m) => m.id === id || m.code_bon === id || (updatedMvt && updatedMvt.code_bon && m.code_bon === updatedMvt.code_bon)
    );
    const service = new TaskApplicationService();
    try {
      await service.updateTask(id, updatedMvt);
    } catch (err) {
      Logger.warn('[useAppComplexHandlers] Task update warning:', err);
    }
    if (oldMvt) {
      movementRepository.edit(oldMvt, updatedMvt);
      const reconciliation = reconcileMakerCheckerOnMovementUpdate(
        oldMvt,
        { ...oldMvt, ...updatedMvt },
        {
          correctiveInterventions,
          preventiveExecutions,
          preventiveTasks,
          sortieDemands,
        }
      );
      if (reconciliation.correctiveChanged) {
        setCorrectiveInterventions?.(reconciliation.correctiveInterventions);
      }
      if (reconciliation.preventiveExecsChanged) {
        setPreventiveExecutions?.(reconciliation.preventiveExecutions);
      }
      if (reconciliation.preventiveTasksChanged) {
        setPreventiveTasks?.(reconciliation.preventiveTasks);
      }
      if (reconciliation.sortieDemandsChanged) {
        setSortieDemands?.(reconciliation.sortieDemands);
      }
      if (reconciliation.auditSummary) {
        showToast?.(reconciliation.auditSummary, 'info');
      }
    }
    setMouvements((prev) =>
      prev.map((m) =>
        m.id === id || m.code_bon === id || (updatedMvt && updatedMvt.code_bon && m.code_bon === updatedMvt.code_bon)
          ? { ...m, ...updatedMvt }
          : m
      )
    );
  };
  const handleDeleteMouvement = async (id) => {
    const oldMvt = (mouvements || []).find((m) => m.id === id || m.code_bon === id);
    const service = new TaskApplicationService();
    try {
      await service.deleteTask(id);
    } catch (err) {
      Logger.warn('[useAppComplexHandlers] Task delete warning:', err);
    }
    if (oldMvt) {
      movementRepository.remove(oldMvt);
      const reconciliation = reconcileMakerCheckerOnMovementDelete(oldMvt, {
        correctiveInterventions,
        preventiveExecutions,
        preventiveTasks,
        sortieDemands,
      });
      if (reconciliation.correctiveChanged) {
        setCorrectiveInterventions?.(reconciliation.correctiveInterventions);
      }
      if (reconciliation.preventiveExecsChanged) {
        setPreventiveExecutions?.(reconciliation.preventiveExecutions);
      }
      if (reconciliation.preventiveTasksChanged) {
        setPreventiveTasks?.(reconciliation.preventiveTasks);
      }
      if (reconciliation.sortieDemandsChanged) {
        setSortieDemands?.(reconciliation.sortieDemands);
      }
      if (reconciliation.auditSummary) {
        showToast?.(reconciliation.auditSummary, 'info');
      }
    }
    setMouvements((prev) => prev.filter((m) => m.id !== id && m.code_bon !== id));
  };

  const handleAddWarehouseItem = (newItem) => {
    setWarehouseItems((prev) => [newItem, ...prev]);
  };

  const handleUpdateWarehouseItem = (idOrCode, updatedItem) => {
    setWarehouseItems((prev) =>
      prev.map((it) => (it.id_warehouse_item === idOrCode || it.id === idOrCode ? updatedItem : it))
    );
    if (idOrCode !== updatedItem.id_warehouse_item) {
      setMouvements((prev) =>
        prev.map((m) => (m.ref === idOrCode ? { ...m, ref: updatedItem.id_warehouse_item } : m))
      );
    }
  };

  const handleDeleteWarehouseItem = (idOrCode) => {
    const target = (warehouseItems || []).find(
      (it) => it.id_warehouse_item === idOrCode || it.id === idOrCode || it.code === idOrCode
    );
    const attachedMachine =
      target?.rattachement_type === 'MACHINE'
        ? target?.id_machine_registered || target?.id_machine
        : '';

    if (attachedMachine) {
      showToast?.(
        `Suppression refusée : l'élément "${idOrCode}" est actuellement monté sur la machine ${attachedMachine}. Détachez-le vers l'Entrepôt d'abord.`,
        'warning'
      );
      return;
    }

    const hasMovements = (mouvements || []).some(
      (m) => m.ref === idOrCode || m.code_article === idOrCode
    );
    const hasInterventions = (correctiveInterventions || []).some(
      (i) => i.id_composant === idOrCode || i.id_part === idOrCode
    );
    const hasPreventive =
      (preventiveTasks || []).some(
        (t) => t.id_composant === idOrCode || t.id_part === idOrCode
      ) ||
      (preventiveExecutions || []).some(
        (e) => e.id_composant === idOrCode || e.id_part === idOrCode
      );
    const hasSortieExterne = (sortiesExterne || []).some(
      (s) => s.code_moteur === idOrCode || s.id_warehouse_item === idOrCode || s.id_composant === idOrCode
    );
    const hasBobinageHistory = Array.isArray(target?.historique_bobinage) && target.historique_bobinage.length > 0;

    if (hasMovements || hasInterventions || hasPreventive || hasSortieExterne || hasBobinageHistory) {
      setWarehouseItems((prev) =>
        prev.map((it) =>
          it.id_warehouse_item === idOrCode || it.id === idOrCode
            ? {
                ...it,
                status: 'Hors service',
                statut: 'Archivé',
                is_active: false,
                actif: false,
                date_archivage: new Date().toISOString(),
              }
            : it
        )
      );
      showToast?.(
        `Élément "${idOrCode}" archivé (Hors service) pour préserver l'historique des interventions et mouvements.`,
        'info'
      );
      return;
    }

    setWarehouseItems((prev) =>
      prev.filter((it) => it.id_warehouse_item !== idOrCode && it.id !== idOrCode)
    );
    showToast?.(`Élément "${idOrCode}" supprimé définitivement.`, 'success');
  };

  const handleDirectAdjustStock = (article, newTargetStock) => {
    const entrees = Number(article.entrees || 0);
    const sorties = Number(article.sorties || 0);
    const newStockInitial = Math.max(0, Number(newTargetStock) - entrees + sorties);

    setRawStock((prev) =>
      prev.map((item) =>
        item.id === article.id || item.ref === article.ref
          ? { ...item, stockInitial: newStockInitial }
          : item
      )
    );
  };

  const handleQuickSortie = () => {
    startTransition(() => setCurrentTab('sortie'));
  };

  return {
    handleUpdateZone, handleDeleteZone,
    handleUpdateOperation, handleDeleteOperation,
    handleUpdateMachine, handleDeleteMachine,
    handleUpdateType, handleDeleteType,
    handleUpdateDesignation, handleDeleteDesignation,
    handleUpdateDiagnostic, handleDeleteDiagnostic,
    handleUpdateFamily, handleDeleteFamily,
    handleUpdateCompGroup, handleDeleteCompGroup,
    handleUpdateCompFamily, handleDeleteCompFamily,
    handleUpdateCompTemplate, handleDeleteCompTemplate,
    handleUpdatePartType, handleDeletePartType,
    handleUpdatePartDesignation, handleDeletePartDesignation,
    handleUpdateTemplate, handleDeleteTemplate,
    handleAddTechnician, handleUpdateTechnician, handleDeleteTechnician,
    handleAddOperation, handleAddMachine, handleAddArticle, handleAddMouvement,
    handleUpdateArticle, handleDeleteArticle,
    handleUpdateMouvement, handleDeleteMouvement,
    handleAddWarehouseItem, handleUpdateWarehouseItem, handleDeleteWarehouseItem,
    handleDirectAdjustStock, handleQuickSortie,
  };
}
