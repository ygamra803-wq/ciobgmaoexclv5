import { useAppComplexHandlers } from './useAppComplexHandlers';
import { applyBlueprintPlanToActiveMachines } from '../core/domain/Blueprint';

/**
 * Custom hook consolidating all GMAO entity handlers (Add, Update, Delete, Adjust).
 * Keeps App.jsx ultra-lean and focused on presentation layout.
 */
export function useAppEntityActions({ gmaoState, showToast, setCurrentTab }) {
  const {
    types,
    setTypes,
    designations,
    setDesignations,
    families,
    setFamilies,
    templates,
    setTemplates,
    setBlueprints,
    machines,
    setMachines,
    warehouseItems,
    setWarehouseItems,
    zones,
    setZones,
    technicians,
    setTechnicians,
    operations,
    setOperations,
    mouvements,
    setMouvements,
    rawStock,
    setRawStock,
    setCompGroups,
    compFamilies,
    setCompFamilies,
    compTemplates,
    setCompTemplates,
    partTypes,
    setPartTypes,
    partDesignations,
    setPartDesignations,
    preventiveTasks,
    correctiveInterventions,
    machineElementsLedger,
  } = gmaoState;

  const handleAddCompGroup = (newGrp) => {
    setCompGroups((prev) => [...prev, newGrp]);
    showToast(`Groupe "${newGrp.libelle || newGrp.code}" ajouté avec succès !`);
  };

  const handleAddCompFamily = (newFam) => {
    setCompFamilies((prev) => [...prev, newFam]);
  };

  const handleAddCompTemplate = (newTpl) => {
    setCompTemplates((prev) => [...prev, newTpl]);
  };

  const handleAddPartType = (newType) => {
    setPartTypes((prev) => [...prev, newType]);
  };

  const handleAddPartDesignation = (newDesig) => {
    setPartDesignations((prev) => [...prev, newDesig]);
  };

  const handleAddType = (newType) => {
    setTypes((prev) => [...prev, newType]);
  };

  const handleAddDesignation = (newDesig) => {
    const newItem = {
      id: crypto.randomUUID ? crypto.randomUUID() : `desig_${Date.now()}`,
      ref: newDesig.ref,
      designation: newDesig.designation,
      type: newDesig.id_type,
      id_type: newDesig.id_type,
      stockInitial: Number(newDesig.stockInitial) || 0,
      seuil: Number(newDesig.seuil) || 3,
      emplacement: newDesig.emplacement || 'A1-R1',
    };
    setRawStock((prev) => [newItem, ...prev]);
    setDesignations((prev) => [newItem, ...(prev || [])]);
  };

  const handleAddFamily = (newFam) => {
    setFamilies((prev) => [...prev, newFam]);
  };

  const handleAddTemplate = (newTpl) => {
    setTemplates((prev) => [...prev, newTpl]);
  };

  const handleAddBlueprint = (newBlueprint) => {
    const normalized = {
      ...newBlueprint,
      preventivePlanItems: Array.isArray(newBlueprint?.preventivePlanItems)
        ? newBlueprint.preventivePlanItems
        : [],
      commonFailures: Array.isArray(newBlueprint?.commonFailures)
        ? newBlueprint.commonFailures
        : [],
    };
    setBlueprints((prev) => [...prev, normalized]);
    showToast(`Blueprint "${normalized.id_blueprint}" ajouté avec succès !`);
  };

  const handleUpdateBlueprint = (idOrObj, updated) => {
    const isObj = typeof idOrObj === 'object' && idOrObj !== null;
    const targetId = isObj ? idOrObj.id_blueprint : idOrObj;
    const payload = isObj ? idOrObj : updated;
    if (!targetId || !payload) return;

    setBlueprints((prev) =>
      prev.map((b) =>
        b.id_blueprint === targetId
          ? {
              ...b,
              ...payload,
              preventivePlanItems: Array.isArray(payload.preventivePlanItems)
                ? payload.preventivePlanItems
                : Array.isArray(b.preventivePlanItems)
                ? b.preventivePlanItems
                : [],
              commonFailures: Array.isArray(payload.commonFailures)
                ? payload.commonFailures
                : Array.isArray(b.commonFailures)
                ? b.commonFailures
                : [],
            }
          : b
      )
    );
    showToast(`Blueprint "${targetId}" mis à jour avec succès !`);
  };

  const handleDeleteBlueprint = (id) => {
    const linkedMachines = (machines || []).filter((m) => m.id_blueprint === id);
    if (linkedMachines.length > 0) {
      showToast(
        `Suppression refusée : Blueprint "${id}" est lié à ${linkedMachines.length} machine(s).`,
        'warning'
      );
      return;
    }
    setBlueprints((prev) => prev.filter((b) => b.id_blueprint !== id));
    showToast(`Blueprint "${id}" supprimé avec succès !`, 'info');
  };

  const handleApplyBlueprintPreventivePlan = (blueprint) => {
    if (!blueprint) return { addedCount: 0, targetMachinesCount: 0 };
    const { addedTasks, updatedTasks, targetMachinesCount } = applyBlueprintPlanToActiveMachines(
      blueprint,
      machines,
      preventiveTasks,
      warehouseItems
    );
    if (targetMachinesCount === 0) {
      showToast(
        `Aucune machine active liée au Blueprint "${blueprint.id_blueprint}".`,
        'warning'
      );
      return { addedCount: 0, targetMachinesCount: 0 };
    }
    if (addedTasks.length === 0) {
      showToast(
        `Toutes les tâches du Blueprint "${blueprint.id_blueprint}" sont déjà appliquées aux ${targetMachinesCount} machine(s) active(s).`,
        'info'
      );
      return { addedCount: 0, targetMachinesCount };
    }
    gmaoState.setPreventiveTasks(updatedTasks);
    showToast(
      `${addedTasks.length} tâche(s) préventive(s) générée(s) pour ${targetMachinesCount} machine(s) active(s) liée(s) au Blueprint "${blueprint.id_blueprint}".`,
      'success'
    );
    return { addedCount: addedTasks.length, targetMachinesCount };
  };

  const handleAddZone = (newZone) => {
    setZones((prev) => [...prev, newZone]);
  };

  const complexHandlers = useAppComplexHandlers({
    zones,
    setZones,
    operations,
    setOperations,
    technicians,
    setTechnicians,
    machines,
    setMachines,
    mouvements,
    setMouvements,
    types,
    setTypes,
    rawStock,
    setRawStock,
    designations,
    setDesignations,
    families,
    setFamilies,
    templates,
    setTemplates,
    setCompGroups,
    compFamilies,
    setCompFamilies,
    compTemplates,
    setCompTemplates,
    partTypes,
    setPartTypes,
    partDesignations,
    setPartDesignations,
    warehouseItems,
    setWarehouseItems,
    blueprints: gmaoState.blueprints || [],
    sortiesExterne: gmaoState.sortiesExterne || [],
    setSortiesExterne: gmaoState.setSortiesExterne,
    sortieDemands: gmaoState.sortieDemands || [],
    setSortieDemands: gmaoState.setSortieDemands,
    preventiveTasks,
    setPreventiveTasks: gmaoState.setPreventiveTasks,
    preventiveExecutions: gmaoState.preventiveExecutions || [],
    setPreventiveExecutions: gmaoState.setPreventiveExecutions,
    correctiveInterventions,
    setCorrectiveInterventions: gmaoState.setCorrectiveInterventions,
    machineElementsLedger: machineElementsLedger || [],
    setMachineElementsLedger: gmaoState.setMachineElementsLedger,
    showToast,
    setCurrentTab,
  });

  return {
    ...complexHandlers,
    setMachines,
    setZones,
    setTechnicians,
    setOperations,
    setRawStock,
    setMouvements,
    setTypes,
    setFamilies,
    setTemplates,
    setPreventiveTasks: gmaoState.setPreventiveTasks,
    setCorrectiveInterventions: gmaoState.setCorrectiveInterventions,
    handleAddCompGroup,
    handleAddCompFamily,
    handleAddCompTemplate,
    handleAddPartType,
    handleAddPartDesignation,
    handleAddType,
    handleAddDesignation,
    handleAddFamily,
    handleAddTemplate,
    handleAddBlueprint,
    handleUpdateBlueprint,
    handleDeleteBlueprint,
    handleApplyBlueprintPreventivePlan,
    handleAddZone,
  };
}
