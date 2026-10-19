import { useState, useEffect } from 'react';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import initialStockSeed from '../data/stock/seedStockItems.json';
import initialStockTypes from '../data/stock/seedStockTypes.json';

/**
 * Hook managing Stock articles, raw items, types, and diagnostic designations.
 * Enforces SSOT: canonical keys only, no length thresholds, no automatic seed writes on startup.
 */
export function useStockSubState(groupedState = {}) {
  const [types, setTypes] = useState(() => {
    if (Array.isArray(groupedState.types)) {
      return groupedState.types;
    }
    return loadCollection(STORAGE_KEYS.STOCK_TYPES, {
      allowDemoFallback: true,
      demoSeed: initialStockTypes,
    });
  });

  const [rawStock, setRawStock] = useState(() => {
    if (Array.isArray(groupedState.rawStock)) {
      return groupedState.rawStock;
    }
    return loadCollection(STORAGE_KEYS.RAW_STOCK, {
      allowDemoFallback: true,
      demoSeed: initialStockSeed,
    });
  });

  const [designations, setDesignations] = useState(() => {
    if (Array.isArray(groupedState.designations)) {
      return groupedState.designations;
    }
    const demoDesignations = initialStockSeed.map((s) => ({
      id: s.id,
      ref: s.ref,
      designation: s.designation,
      id_type: s.id_type,
      type: s.type,
      stockInitial: s.stockInitial,
      seuil: s.seuil,
      emplacement: s.emplacement,
    }));
    return loadCollection(STORAGE_KEYS.DESIGNATIONS, {
      allowDemoFallback: true,
      demoSeed: demoDesignations,
    });
  });

  useEffect(() => {
    DataGateway.saveStockTypes(types);
  }, [types]);

  useEffect(() => {
    DataGateway.saveStock(rawStock);
  }, [rawStock]);

  useEffect(() => {
    DataGateway.saveDesignations(designations);
  }, [designations]);

  return {
    types,
    setTypes,
    rawStock,
    setRawStock,
    designations,
    setDesignations,
  };
}
