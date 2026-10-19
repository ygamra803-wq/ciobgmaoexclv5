import { useAppComplexHandlers } from './useAppComplexHandlers';

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
    setBlueprints((prev) => [...prev, newBlueprint]);
    showToast(`Blueprint "${newBlueprint.id_blueprint}" ajouté avec succès !`);
  };

  const handleUpdateBlueprint = (id, updated) => {
    setBlueprints((prev) =>
      prev.map((b) => (b.id_blueprint === id ? { ...b, ...updated } : b))
    );
    showToast(`Blueprint "${id}" mis à jour avec succès !`);
  };

  const handleDeleteBlueprint = (id) => {
    setBlueprints((prev) => prev.filter((b) => b.id_blueprint !== id));
    showToast(`Blueprint "${id}" supprimé avec succès !`, 'info');
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
    preventiveTasks,
    correctiveInterventions,
    machineElementsLedger: machineElementsLedger || [],
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
    handleAddZone,
  };
}
