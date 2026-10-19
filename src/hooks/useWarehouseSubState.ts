import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import initialWarehouseItems from '../data/warehouse/seedWarehouseItems.json';
import initialCompGroups from '../data/warehouse/seedCompGroups.json';
import initialCompFamilies from '../data/warehouse/seedCompFamilies.json';
import initialCompTemplates from '../data/warehouse/seedCompTemplates.json';
import initialEntrepotComponents from '../data/warehouse/seedEntrepotComponents.json';
import initialPartTypes from '../data/warehouse/seedPartTypes.json';
import initialPartDesignations from '../data/warehouse/seedPartDesignations.json';

/**
 * Hook managing Entrepôt items, component groups/families/templates, and part types/designations.
 * Enforces SSOT: canonical keys only, no arbitrary length checks, no automatic seed writes on startup.
 */
export function useWarehouseSubState(groupedState = {}) {
  const [compGroups, setCompGroups] = useState(() => {
    if (Array.isArray(groupedState.compGroups)) {
      return groupedState.compGroups;
    }
    return loadCollection(STORAGE_KEYS.COMP_GROUPS, {
      allowDemoFallback: true,
      demoSeed: initialCompGroups,
    });
  });

  const [warehouseItems, setWarehouseItems] = useState(() => {
    if (Array.isArray(groupedState.warehouseItems)) {
      return groupedState.warehouseItems;
    }
    return loadCollection(STORAGE_KEYS.WAREHOUSE_ITEMS, {
      allowDemoFallback: true,
      demoSeed: initialWarehouseItems,
    });
  });

  const [entrepotComponents, setEntrepotComponents] = useState(() => {
    if (Array.isArray(groupedState.entrepotComponents)) {
      return groupedState.entrepotComponents;
    }
    return loadCollection(STORAGE_KEYS.ENTREPOT_COMPONENTS, {
      allowDemoFallback: true,
      demoSeed: initialEntrepotComponents,
    });
  });

  const [compFamilies, setCompFamilies] = useState(() => {
    if (Array.isArray(groupedState.compFamilies)) {
      return groupedState.compFamilies;
    }
    return loadCollection(STORAGE_KEYS.COMP_FAMILIES, {
      allowDemoFallback: true,
      demoSeed: initialCompFamilies,
    });
  });

  const [compTemplates, setCompTemplates] = useState(() => {
    if (Array.isArray(groupedState.compTemplates)) {
      return groupedState.compTemplates;
    }
    const formattedDemo = initialCompTemplates.map((t, idx) => ({
      ...t,
      id_templates: t.id_templates || t.id_template || t.id_comp_template || `TPL-${idx + 1}`,
    }));
    return loadCollection(STORAGE_KEYS.COMP_TEMPLATES, {
      allowDemoFallback: true,
      demoSeed: formattedDemo,
    });
  });

  const [partTypes, setPartTypes] = useState(() => {
    if (Array.isArray(groupedState.partTypes)) {
      return groupedState.partTypes;
    }
    return loadCollection(STORAGE_KEYS.PART_TYPES, {
      allowDemoFallback: true,
      demoSeed: initialPartTypes,
    });
  });

  const [partDesignations, setPartDesignations] = useState(() => {
    if (Array.isArray(groupedState.partDesignations)) {
      return groupedState.partDesignations;
    }
    return loadCollection(STORAGE_KEYS.PART_DESIGNATIONS, {
      allowDemoFallback: true,
      demoSeed: initialPartDesignations,
    });
  });

  useEffect(() => {
    DataGateway.saveCompGroups(compGroups);
  }, [compGroups]);

  useEffect(() => {
    DataGateway.saveWarehouseItems(warehouseItems);
  }, [warehouseItems]);

  useEffect(() => {
    DataGateway.saveEntrepotComponents(entrepotComponents);
  }, [entrepotComponents]);

  useEffect(() => {
    DataGateway.saveCompFamilies(compFamilies);
  }, [compFamilies]);

  useEffect(() => {
    DataGateway.saveCompTemplates(compTemplates);
  }, [compTemplates]);

  useEffect(() => {
    DataGateway.savePartTypes(partTypes);
  }, [partTypes]);

  useEffect(() => {
    DataGateway.savePartDesignations(partDesignations);
  }, [partDesignations]);

  return {
    compGroups,
    setCompGroups,
    warehouseItems,
    setWarehouseItems,
    entrepotComponents,
    setEntrepotComponents,
    compFamilies,
    setCompFamilies,
    compTemplates,
    setCompTemplates,
    partTypes,
    setPartTypes,
    partDesignations,
    setPartDesignations,
  };
}
