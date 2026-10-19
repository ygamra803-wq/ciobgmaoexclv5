import { useEffect, useRef } from 'react';
import { Logger } from '../core/logger/LoggerService';
import { ConflictResolutionService } from '../services/ConflictResolutionService';
import { tabSyncService } from '../services/TabSyncService';

/**
 * 🏛️ High-Performance Hook for Real-Time Multi-Tab / Multi-Window State Synchronization
 *
 * Powered by tabSyncService (BroadcastChannel API + StorageEvent fallback)
 * - Zero latency IPC between all open browser tabs and windows
 * - Echo suppression to avoid cascading render cycles
 * - Deterministic Last-Write-Wins conflict resolution for movements and transactional entities
 * - Stable reference bindings preventing unnecessary unmount/remount cycles
 */
export function useStateSync(setters = {}, validators = {}) {
  const settersRef = useRef(setters);
  const validatorsRef = useRef(validators);

  // Keep references fresh without triggering useEffect re-execution
  useEffect(() => {
    settersRef.current = setters;
    validatorsRef.current = validators;
  });

  useEffect(() => {
    const handleRemoteState = (fresh, isBroadcast) => {
      if (!fresh || typeof fresh !== 'object') return;

      const currentSetters = settersRef.current || {};
      const currentValidators = validatorsRef.current || {};

      try {
        // If the store provides an atomic applyRemoteStateUpdate method, use it first
        if (typeof currentSetters.applyRemoteStateUpdate === 'function') {
          currentSetters.applyRemoteStateUpdate(fresh);
        }

        // 1. Stock Slice
        if (fresh.types && typeof currentSetters.setTypes === 'function') {
          currentSetters.setTypes(fresh.types);
        }
        if (fresh.designations && typeof currentSetters.setDesignations === 'function') {
          currentSetters.setDesignations(fresh.designations);
        }
        if (fresh.rawStock && typeof currentSetters.setRawStock === 'function') {
          currentSetters.setRawStock(fresh.rawStock);
        }

        // 2. Machines & Topology Slice
        if (
          fresh.families &&
          typeof currentSetters.setFamilies === 'function' &&
          (!currentValidators.isValidMachineFamilies || currentValidators.isValidMachineFamilies(fresh.families))
        ) {
          currentSetters.setFamilies(fresh.families);
        }
        if (
          fresh.templates &&
          typeof currentSetters.setTemplates === 'function' &&
          (!currentValidators.isValidMachineTemplates || currentValidators.isValidMachineTemplates(fresh.templates))
        ) {
          currentSetters.setTemplates(fresh.templates);
        }
        if (fresh.blueprints && Array.isArray(fresh.blueprints) && typeof currentSetters.setBlueprints === 'function') {
          currentSetters.setBlueprints(fresh.blueprints);
        }
        if (fresh.machines && typeof currentSetters.setMachines === 'function') {
          currentSetters.setMachines(fresh.machines);
        }
        if (fresh.zones && typeof currentSetters.setZones === 'function') {
          currentSetters.setZones(fresh.zones);
        }
        if (fresh.machineElementsLedger && typeof currentSetters.setMachineElementsLedger === 'function') {
          currentSetters.setMachineElementsLedger(fresh.machineElementsLedger);
        }

        // 3. Warehouse Slice
        if (fresh.warehouseItems && typeof currentSetters.setWarehouseItems === 'function') {
          currentSetters.setWarehouseItems(fresh.warehouseItems);
        }
        if (fresh.entrepotComponents && typeof currentSetters.setEntrepotComponents === 'function') {
          currentSetters.setEntrepotComponents(fresh.entrepotComponents);
        }
        if (fresh.compGroups && typeof currentSetters.setCompGroups === 'function') {
          currentSetters.setCompGroups(fresh.compGroups);
        }
        if (fresh.compFamilies && typeof currentSetters.setCompFamilies === 'function') {
          currentSetters.setCompFamilies(fresh.compFamilies);
        }
        if (fresh.compTemplates && typeof currentSetters.setCompTemplates === 'function') {
          currentSetters.setCompTemplates(fresh.compTemplates);
        }
        if (fresh.partTypes && typeof currentSetters.setPartTypes === 'function') {
          currentSetters.setPartTypes(fresh.partTypes);
        }
        if (fresh.partDesignations && typeof currentSetters.setPartDesignations === 'function') {
          currentSetters.setPartDesignations(fresh.partDesignations);
        }

        // 4. Users & Personnel Slice
        if (fresh.users && typeof currentSetters.setUsers === 'function') {
          currentSetters.setUsers(fresh.users);
        }
        if (fresh.technicians && typeof currentSetters.setTechnicians === 'function') {
          currentSetters.setTechnicians(fresh.technicians);
        }
        if (fresh.operations && typeof currentSetters.setOperations === 'function') {
          currentSetters.setOperations(fresh.operations);
        }

        // 5. Movements Slice with Conflict Resolution
        if (fresh.mouvements && typeof currentSetters.setMouvements === 'function') {
          if (isBroadcast) {
            currentSetters.setMouvements((prevMouvementList) => {
              if (!Array.isArray(prevMouvementList) || prevMouvementList.length === 0) {
                return fresh.mouvements;
              }
              const freshLen = fresh.mouvements.length;
              const localLen = prevMouvementList.length;
              if (freshLen === localLen && JSON.stringify(fresh.mouvements) === JSON.stringify(prevMouvementList)) {
                return prevMouvementList;
              }
              return ConflictResolutionService.resolveMultipleConflicts(
                prevMouvementList,
                fresh.mouvements,
                ConflictResolutionService.STRATEGIES.LAST_WRITE_WINS
              );
            });
          } else {
            currentSetters.setMouvements(fresh.mouvements);
          }
        }

        // 6. Preventive Maintenance Slice
        if (fresh.preventiveTasks && typeof currentSetters.setPreventiveTasks === 'function') {
          currentSetters.setPreventiveTasks(fresh.preventiveTasks);
        }
        if (fresh.preventiveActions && typeof currentSetters.setPreventiveActions === 'function') {
          currentSetters.setPreventiveActions(fresh.preventiveActions);
        }
        if (fresh.preventiveGuides && typeof currentSetters.setPreventiveGuides === 'function') {
          currentSetters.setPreventiveGuides(fresh.preventiveGuides);
        }
        if (fresh.preventivePlans && typeof currentSetters.setPreventivePlans === 'function') {
          currentSetters.setPreventivePlans(fresh.preventivePlans);
        }
        if (fresh.preventiveExecutions && typeof currentSetters.setPreventiveExecutions === 'function') {
          currentSetters.setPreventiveExecutions(fresh.preventiveExecutions);
        }

        // 7. Sorties Externe Slice
        if (fresh.sortiesExterne && typeof currentSetters.setSortiesExterne === 'function') {
          currentSetters.setSortiesExterne(fresh.sortiesExterne);
        }

        // 8. Corrective Nexus Slice
        if (fresh.correctiveInterventions && typeof currentSetters.setCorrectiveInterventions === 'function') {
          currentSetters.setCorrectiveInterventions(fresh.correctiveInterventions);
        }
        if (fresh.correctiveActionsByPanne && typeof currentSetters.setCorrectiveActionsByPanne === 'function') {
          currentSetters.setCorrectiveActionsByPanne(fresh.correctiveActionsByPanne);
        }
        if (fresh.correctivePanneCategories && typeof currentSetters.setCorrectivePanneCategories === 'function') {
          currentSetters.setCorrectivePanneCategories(fresh.correctivePanneCategories);
        }
        if (fresh.correctiveTravauxAFaire && typeof currentSetters.setCorrectiveTravauxAFaire === 'function') {
          currentSetters.setCorrectiveTravauxAFaire(fresh.correctiveTravauxAFaire);
        }
        if (fresh.correctiveIntervenants && typeof currentSetters.setCorrectiveIntervenants === 'function') {
          currentSetters.setCorrectiveIntervenants(fresh.correctiveIntervenants);
        }

        Logger.info(`[useStateSync] State synchronized across tabs via ${isBroadcast ? 'BroadcastChannel' : 'StorageEvent'}`);
      } catch (err) {
        Logger.error('Failed to sync across tabs:', err, 'useStateSync');
      }
    };

    const unsubscribe = tabSyncService.subscribe((payload, isBroadcast) => {
      handleRemoteState(payload, isBroadcast);
    });

    return () => {
      unsubscribe();
    };
  }, []);
}
