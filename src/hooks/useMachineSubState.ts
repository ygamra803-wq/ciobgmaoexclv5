import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import initialFamilies from '../data/machines/seedFamilies.json';
import initialTemplates from '../data/machines/seedTemplates.json';
import initialBlueprints from '../data/machines/seedBlueprints.json';
import initialMachines from '../data/machines/seedMachines.json';
import initialZones from '../data/machines/seedZones.json';
import initialMachineBomLedger from '../data/machines/seedMachineBomLedger.json';

/**
 * Hook managing Machine hierarchy: Families, Templates, Blueprints, Machines, Zones, and BOM Ledger.
 * Enforces SSOT: canonical keys only, no arbitrary length thresholds, no automatic seed writes on startup.
 */
export function useMachineSubState(groupedState = {}) {
  const isValidMachineTemplates = useCallback((arr) => {
    if (!Array.isArray(arr)) return false;
    return arr.every(
      (item) =>
        item &&
        (item.id_templates || item.id) &&
        (item.id_family || item.libelle || item.family)
    );
  }, []);

  const isValidMachineFamilies = useCallback((arr) => {
    if (!Array.isArray(arr)) return false;
    return arr.every(
      (item) =>
        item &&
        (item.id_family || item.id) &&
        (item.libelle || item.nom || item.name)
    );
  }, []);

  const [families, setFamilies] = useState(() => {
    if (Array.isArray(groupedState.families)) {
      return groupedState.families;
    }
    return loadCollection(STORAGE_KEYS.FAMILIES, {
      allowDemoFallback: true,
      demoSeed: initialFamilies,
    });
  });

  const [templates, setTemplates] = useState(() => {
    if (Array.isArray(groupedState.templates)) {
      return groupedState.templates;
    }
    return loadCollection(STORAGE_KEYS.TEMPLATES, {
      allowDemoFallback: true,
      demoSeed: initialTemplates,
    });
  });

  const [blueprints, setBlueprints] = useState(() => {
    if (Array.isArray(groupedState.blueprints)) {
      return groupedState.blueprints;
    }
    return loadCollection(STORAGE_KEYS.BLUEPRINTS, {
      allowDemoFallback: true,
      demoSeed: initialBlueprints,
    });
  });

  const [machines, setMachines] = useState(() => {
    if (Array.isArray(groupedState.machines)) {
      return groupedState.machines;
    }
    return loadCollection(STORAGE_KEYS.MACHINES, {
      allowDemoFallback: true,
      demoSeed: initialMachines,
    });
  });

  const [zones, setZones] = useState(() => {
    if (Array.isArray(groupedState.zones)) {
      return groupedState.zones;
    }
    const loaded = loadCollection(STORAGE_KEYS.ZONES, {
      allowDemoFallback: true,
      demoSeed: initialZones,
    });
    return loaded.map((z) => ({
      ...z,
      code_zone: z.code_zone || z.code || z.id_zone,
      id_zone: z.id_zone || z.code_zone || z.code,
    }));
  });

  const [machineElementsLedger, setMachineElementsLedger] = useState(() => {
    if (Array.isArray(groupedState.machineElementsLedger)) {
      return groupedState.machineElementsLedger;
    }
    return loadCollection(STORAGE_KEYS.MACHINE_BOM, {
      allowDemoFallback: true,
      demoSeed: initialMachineBomLedger,
    });
  });

  useEffect(() => {
    DataGateway.saveFamilies(families);
  }, [families]);

  useEffect(() => {
    DataGateway.saveTemplates(templates);
  }, [templates]);

  useEffect(() => {
    DataGateway.saveBlueprints(blueprints);
  }, [blueprints]);

  useEffect(() => {
    DataGateway.saveMachines(machines);
  }, [machines]);

  useEffect(() => {
    DataGateway.saveZones(zones);
  }, [zones]);

  useEffect(() => {
    DataGateway.saveMachineBom(machineElementsLedger);
  }, [machineElementsLedger]);

  const addMachineElement = useCallback((element) => {
    setMachineElementsLedger((prev) => {
      const id = element.id || `BOM-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const newEntry = { ...element, id };
      const updated = [newEntry, ...prev];
      DataGateway.saveMachineBom(updated);
      return updated;
    });
  }, []);

  const updateMachineElement = useCallback((id, updates) => {
    setMachineElementsLedger((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates } : item));
      DataGateway.saveMachineBom(updated);
      return updated;
    });
  }, []);

  const deleteMachineElement = useCallback((id) => {
    setMachineElementsLedger((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      DataGateway.saveMachineBom(updated);
      return updated;
    });
  }, []);

  const duplicateBOMToTwins = useCallback((sourceMachineId, targetMachineIds = []) => {
    setMachineElementsLedger((prev) => {
      const sourceElements = prev.filter((e) => e.id_machine_registered === sourceMachineId);
      if (sourceElements.length === 0 || !Array.isArray(targetMachineIds) || targetMachineIds.length === 0) {
        return prev;
      }
      const cloned = [];
      targetMachineIds.forEach((targetId) => {
        sourceElements.forEach((src) => {
          const exists = prev.some((e) => e.id_machine_registered === targetId && e.ref_element === src.ref_element);
          if (!exists) {
            cloned.push({
              ...src,
              id: `BOM-${targetId}-${Math.random().toString(36).substring(2, 7)}`,
              id_machine_registered: targetId,
              date_installation: new Date().toISOString().split('T')[0],
              heures_actuelles: 0,
            });
          }
        });
      });
      const updated = [...cloned, ...prev];
      DataGateway.saveMachineBom(updated);
      return updated;
    });
  }, []);

  return {
    families,
    setFamilies,
    templates,
    setTemplates,
    blueprints,
    setBlueprints,
    machines,
    setMachines,
    zones,
    setZones,
    machineElementsLedger,
    setMachineElementsLedger,
    addMachineElement,
    updateMachineElement,
    deleteMachineElement,
    duplicateBOMToTwins,
    isValidMachineFamilies,
    isValidMachineTemplates,
  };
}
