import { startTransition } from 'react';
import { SparePartApplicationService } from '../application/services/SparePartApplicationService';
import { MachineApplicationService } from '../application/services/MachineApplicationService';
import { TaskApplicationService } from '../application/services/TaskApplicationService';
import { Logger } from '../core/logger/LoggerService';
import { movementRepository } from '../application/MovementRepository';
import { dataIntegrityService } from '../services/dataIntegrityService';

export function useAppComplexHandlers({
  zones, setZones,
  operations, setOperations,
  technicians, setTechnicians,
  _machines, setMachines,
  mouvements, setMouvements,
  setTypes,
  rawStock, setRawStock,
  setDesignations,
  setFamilies,
  setTemplates,
  setCompGroups,
  setCompFamilies,
  setCompTemplates,
  setPartTypes,
  setPartDesignations,
  setWarehouseItems,
  preventiveTasks = [],
  correctiveInterventions = [],
  machineElementsLedger = [],
  showToast,
  setCurrentTab,
}) {
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
    const hasMachines = (_machines || []).some((m) => m.id_zone_default === id || m.id_zone === id);
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
    setMachines((prev) => prev.map((m) => (m.id_machine_registered === id ? updatedMch : m)));
    if (id !== updatedMch.id_machine_registered) {
      setMouvements((prev) =>
        prev.map((m) =>
          m.id_machine_registered === id
            ? { ...m, id_machine_registered: updatedMch.id_machine_registered }
            : m
        )
      );
    }
  };
  const handleDeleteMachine = (id) => {
    const deps = dataIntegrityService.getMachineDependencies(id, {
      preventiveTasks,
      correctiveInterventions,
      mouvements,
      machineElementsLedger,
    });

    if (!deps.canHardDelete) {
      // Soft-archive to preserve Preventive / Corrective / Movements history
      setMachines((prev) =>
        prev.map((m) =>
          m.id_machine_registered === id
            ? {
                ...m,
                status: 'ARCHIVEE',
                statut: 'Archivée',
                is_active: false,
                actif: false,
                date_archivage: new Date().toISOString(),
              }
            : m
        )
      );

      const parts = [];
      if (deps.preventiveCount) parts.push(`${deps.preventiveCount} tâche(s) préventive(s)`);
      if (deps.correctiveCount) parts.push(`${deps.correctiveCount} intervention(s) corrective(s)`);
      if (deps.movementsCount) parts.push(`${deps.movementsCount} mouvement(s)`);
      if (deps.bomCount) parts.push(`${deps.bomCount} élément(s) BOM`);

      showToast?.(
        `Machine ${id} archivée (non supprimée) car liée à : ${parts.join(', ')}. L'historique est préservé.`,
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
  const handleDeleteType = (id) => setTypes((prev) => prev.filter((t) => t.id_type !== id));

  const handleUpdateDesignation = (id, updatedDesig) => {
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
  };
  const handleDeleteDesignation = (id) => {
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
  const handleDeleteFamily = (id) => setFamilies((prev) => prev.filter((f) => f.id_family !== id));

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
    setCompGroups((prev) => prev.filter((g) => g.id !== id && g.id_groupe !== id));
    showToast(`Groupe supprimé avec succès !`, 'info');
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
    setCompFamilies((prev) => prev.filter((f) => f.id_family !== id));
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
    setCompTemplates((prev) => prev.filter((t) => t.id_templates !== id));
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
    setPartTypes((prev) => prev.filter((t) => t.id_type !== id));
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
    setPartDesignations((prev) => prev.filter((d) => d.id !== id && d.ref !== id));
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
  const handleDeleteTemplate = (id) =>
    setTemplates((prev) => prev.filter((t) => t.id_templates !== id));

  const handleAddTechnician = (newTech) => {
    setTechnicians((prev) => [...prev, newTech]);
  };

  const handleUpdateTechnician = (id, updatedTech) => {
    setTechnicians((prev) => prev.map((t) => (t.id_technician === id ? updatedTech : t)));

    // Cascade update to Machines (technician field) if name changed
    const oldTech = technicians.find((t) => t.id_technician === id);
    if (oldTech && oldTech.nom !== updatedTech.nom) {
      setMachines((prev) =>
        prev.map((m) => (m.technician === oldTech.nom ? { ...m, technician: updatedTech.nom } : m))
      );
      // Cascade update to Mouvements if it stores the name
      setMouvements((prev) =>
        prev.map((m) => (m.technicien === oldTech.nom ? { ...m, technicien: updatedTech.nom } : m))
      );
    }
  };

  const handleDeleteTechnician = (id) => {
    const targetTech = (technicians || []).find((t) => t.id_technician === id || t.id === id);
    const techName = targetTech?.nom || targetTech?.name || id;

    // Check if technician is linked to movements or machine responsibilities
    const hasMovements = (mouvements || []).some((m) => m.technicien === techName || m.technicien === id);
    const hasMachines = (_machines || []).some((m) => m.technician === techName);

    if (hasMovements || hasMachines) {
      // Soft Delete: Mark as inactive / archived to preserve integrity of Work Orders & KPIs
      setTechnicians((prev) =>
        prev.map((t) =>
          t.id_technician === id || t.id === id
            ? { ...t, is_active: false, actif: false, statut: 'ARCHIVE', date_archivage: new Date().toISOString() }
            : t
        )
      );
      showToast?.(`Technicien ${techName} archivé (désactivé) pour préserver l'historique et les KPI des interventions passées.`, 'info');
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
    setWarehouseItems((prev) =>
      prev.filter((it) => it.id_warehouse_item !== idOrCode && it.id !== idOrCode)
    );
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
