import { useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import SortieExterneService, { INITIAL_SORTIES_BOBINAGE } from '../application/services/SortieExterneService';

/**
 * Sub-state Hook for Sortie Externe & Motor Bobinage Repairs.
 * Enforces SSOT: canonical STORAGE_KEYS.SORTIE_EXTERNE only, no automatic seed writes on startup.
 */
export function useSortieExterneSubState(groupedState = {}) {
  const [sorties, setSorties] = useState(() => {
    if (Array.isArray(groupedState.sortiesExterne)) {
      return groupedState.sortiesExterne;
    }
    return loadCollection(STORAGE_KEYS.SORTIE_EXTERNE, {
      allowDemoFallback: true,
      demoSeed: INITIAL_SORTIES_BOBINAGE,
    });
  });

  useEffect(() => {
    DataGateway.saveSortiesExterne(sorties);
  }, [sorties]);

  // Listen to broadcast / custom events for cross-tab or external changes
  useEffect(() => {
    const handleSortiesUpdated = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSorties(e.detail);
      } else {
        const fresh = SortieExterneService.getSorties();
        if (Array.isArray(fresh)) setSorties(fresh);
      }
    };

    window.addEventListener('sortie_externe_updated', handleSortiesUpdated);
    return () => window.removeEventListener('sortie_externe_updated', handleSortiesUpdated);
  }, []);

  // CRUD Handlers
  const handleAddSortieExterne = useCallback((sortieData) => {
    const created = SortieExterneService.addSortie(sortieData);
    setSorties((prev) => [created, ...prev]);
    return created;
  }, []);

  const handleUpdateSortieExterne = useCallback((id, sortieData) => {
    const updated = SortieExterneService.updateSortie(id, sortieData);
    setSorties((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const handleDeleteSortieExterne = useCallback((id) => {
    SortieExterneService.deleteSortie(id);
    setSorties((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleMarkSortieReturned = useCallback((id, returnData) => {
    const updated = SortieExterneService.markAsReturned(id, returnData);
    setSorties((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const handleMarkSortieMounted = useCallback((id, mountData) => {
    const updated = SortieExterneService.markAsMounted(id, mountData);
    setSorties((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const handleClearSortiesForRealFactory = useCallback(() => {
    DataGateway.saveSortiesExterne([]);
    setSorties([]);
  }, []);

  const handleResetSortiesToBaseline = useCallback(() => {
    DataGateway.saveSortiesExterne(INITIAL_SORTIES_BOBINAGE);
    setSorties(INITIAL_SORTIES_BOBINAGE);
  }, []);

  return {
    sortiesExterne: sorties,
    setSortiesExterne: setSorties,
    handleAddSortieExterne,
    handleUpdateSortieExterne,
    handleDeleteSortieExterne,
    handleMarkSortieReturned,
    handleMarkSortieMounted,
    handleClearSortiesForRealFactory,
    handleResetSortiesToBaseline,
  };
}
