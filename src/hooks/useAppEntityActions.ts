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
    blueprints,
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
    partGroups,
    setPartGroups,
    partTypes,
    setPartTypes,
    partDesignations,
    setPartDesignations,
    preventiveTasks,
    meterReadings,
    setMeterReadings,
    correctiveInterventions,
    machineElementsLedger,
    appendAuditEvent,
  } = gmaoState;

  const handleAddCompGroup = (newGrp) => {
    setCompGroups((prev) => [...prev, newGrp]);
    showToast(`Groupe "${newGrp.libelle || newGrp.code}" ajouté avec succès !`);
  };

  const handleAddPartGroup = (newGrp) => {
    setPartGroups((prev) => [...(prev || []), newGrp]);
    showToast(`Groupe Part "${newGrp.libelle || newGrp.code}" ajouté avec succès !`);
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
    const codeNorm = String(newFam?.id_family || '').trim().toUpperCase();
    const libelleClean = String(newFam?.libelle || '').trim();
    if (!codeNorm || !libelleClean) {
      showToast?.('Veuillez renseigner le code et le libellé de la famille.', 'warning');
      return false;
    }
    const exists = (families || []).some(
      (f) => String(f?.id_family || '').trim().toUpperCase() === codeNorm
    );
    if (exists) {
      showToast?.(`Erreur : La famille "${codeNorm}" existe déjà.`, 'error');
      return false;
    }
    const normalized = { ...newFam, id_family: codeNorm, libelle: libelleClean };
    setFamilies((prev) => [...prev, normalized]);
    appendAuditEvent?.({
      actionType: 'FAMILY_CREATED',
      entityType: 'MACHINE_FAMILY',
      entityId: codeNorm,
      before: null,
      after: normalized,
    });
    return true;
  };

  const handleAddTemplate = (newTpl) => {
    const codeNorm = String(newTpl?.id_templates || '').trim().toUpperCase();
    const libelleClean = String(newTpl?.libelle || '').trim();
    const familyNorm = String(newTpl?.id_family || '').trim().toUpperCase();
    if (!codeNorm || !libelleClean || !familyNorm) {
      showToast?.('Veuillez renseigner le code, le libellé et la famille du template.', 'warning');
      return false;
    }
    const exists = (templates || []).some(
      (t) => String(t?.id_templates || '').trim().toUpperCase() === codeNorm
    );
    if (exists) {
      showToast?.(`Erreur : Le template "${codeNorm}" existe déjà.`, 'error');
      return false;
    }
    const normalized = {
      ...newTpl,
      id_templates: codeNorm,
      libelle: libelleClean,
      id_family: familyNorm,
    };
    setTemplates((prev) => [...prev, normalized]);
    appendAuditEvent?.({
      actionType: 'TEMPLATE_CREATED',
      entityType: 'MACHINE_TEMPLATE',
      entityId: codeNorm,
      before: null,
      after: normalized,
    });
    return true;
  };

  const handleAddBlueprint = (newBlueprint) => {
    const codeNorm = String(newBlueprint?.id_blueprint || '').trim().toUpperCase();
    if (!codeNorm) {
      showToast?.('Veuillez renseigner un code Blueprint valide.', 'warning');
      return false;
    }
    const existingList = blueprints || gmaoState.blueprints || [];
    if (existingList.some((b) => String(b?.id_blueprint || '').trim().toUpperCase() === codeNorm)) {
      showToast?.(`Erreur : Le Blueprint "${codeNorm}" existe déjà.`, 'error');
      return false;
    }
    const normalized = {
      ...newBlueprint,
      id_blueprint: codeNorm,
      preventivePlanItems: Array.isArray(newBlueprint?.preventivePlanItems)
        ? newBlueprint.preventivePlanItems
        : [],
      commonFailures: Array.isArray(newBlueprint?.commonFailures)
        ? newBlueprint.commonFailures
        : [],
    };
    setBlueprints((prev) => [...prev, normalized]);
    appendAuditEvent?.({
      actionType: 'BLUEPRINT_CREATED',
      entityType: 'BLUEPRINT',
      entityId: codeNorm,
      before: null,
      after: {
        id_blueprint: normalized.id_blueprint,
        libelle: normalized.libelle,
        id_family: normalized.id_family,
        id_templates: normalized.id_templates,
      },
    });
    showToast(`Blueprint "${normalized.id_blueprint}" ajouté avec succès !`);
    return true;
  };

  const handleUpdateBlueprint = (idOrObj, updated) => {
    const isObj = typeof idOrObj === 'object' && idOrObj !== null;
    const targetId = isObj ? idOrObj.id_blueprint : idOrObj;
    const payload = isObj ? idOrObj : updated;
    if (!targetId || !payload) return;
    const targetNorm = String(targetId).trim().toUpperCase();
    const existingList = blueprints || gmaoState.blueprints || [];
    const oldBp = existingList.find(
      (b) => String(b?.id_blueprint || '').trim().toUpperCase() === targetNorm
    );

    setBlueprints((prev) =>
      prev.map((b) =>
        String(b?.id_blueprint || '').trim().toUpperCase() === targetNorm
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
    appendAuditEvent?.({
      actionType: 'BLUEPRINT_UPDATED',
      entityType: 'BLUEPRINT',
      entityId: String(targetId).trim(),
      before: oldBp ? { id_blueprint: oldBp.id_blueprint, libelle: oldBp.libelle, revision: oldBp.revision, statut: oldBp.statut } : null,
      after: { id_blueprint: payload.id_blueprint || targetId, libelle: payload.libelle, revision: payload.revision, statut: payload.statut },
    });
    showToast(`Blueprint "${targetId}" mis à jour avec succès !`);
  };

  const handleDeleteBlueprint = (id) => {
    const targetNorm = String(id || '').trim().toUpperCase();
    const linkedMachines = (machines || []).filter(
      (m) => String(m?.id_blueprint || '').trim().toUpperCase() === targetNorm
    );
    const linkedTasks = (preventiveTasks || []).filter(
      (t) => String(t?.id_blueprint || '').trim().toUpperCase() === targetNorm
    );
    if (linkedMachines.length > 0 || linkedTasks.length > 0) {
      showToast(
        `Suppression refusée : Blueprint "${id}" est lié à ${linkedMachines.length} machine(s) et ${linkedTasks.length} tâche(s) préventive(s).`,
        'warning'
      );
      return;
    }
    const existingList = blueprints || gmaoState.blueprints || [];
    const oldBp = existingList.find(
      (b) => String(b?.id_blueprint || '').trim().toUpperCase() === targetNorm
    );
    setBlueprints((prev) =>
      prev.filter((b) => String(b?.id_blueprint || '').trim().toUpperCase() !== targetNorm)
    );
    appendAuditEvent?.({
      actionType: 'BLUEPRINT_DELETED',
      entityType: 'BLUEPRINT',
      entityId: String(id || '').trim(),
      before: oldBp || { id_blueprint: id },
      after: null,
    });
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
    partGroups,
    setPartGroups,
    partTypes,
    setPartTypes,
    partDesignations,
    setPartDesignations,
    warehouseItems,
    setWarehouseItems,
    blueprints: blueprints || gmaoState.blueprints || [],
    setBlueprints,
    sortiesExterne: gmaoState.sortiesExterne || [],
    setSortiesExterne: gmaoState.setSortiesExterne,
    sortieDemands: gmaoState.sortieDemands || [],
    setSortieDemands: gmaoState.setSortieDemands,
    preventiveTasks,
    setPreventiveTasks: gmaoState.setPreventiveTasks,
    preventiveExecutions: gmaoState.preventiveExecutions || [],
    setPreventiveExecutions: gmaoState.setPreventiveExecutions,
    meterReadings: meterReadings || [],
    setMeterReadings,
    correctiveInterventions,
    setCorrectiveInterventions: gmaoState.setCorrectiveInterventions,
    machineElementsLedger: machineElementsLedger || [],
    setMachineElementsLedger: gmaoState.setMachineElementsLedger,
    appendAuditEvent,
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
    handleAddPartGroup,
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
