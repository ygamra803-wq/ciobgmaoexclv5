import { useState, useEffect, useCallback, useMemo } from 'react';
import { storageService } from '../utils/storageService';
import { STORAGE_KEYS } from '../infrastructure/persistence/storageKeys';
import { loadCollection } from '../infrastructure/persistence/migrateStorage';
import { DataGateway } from '../application/DataGateway';
import { loadBaselineCorrectiveData } from '../utils/baselineCorrective';
import initialInterventions from '../data/corrective/seedCorrectiveInterventions.json';
import initialActionsByPanne from '../data/corrective/seedActionsByPanne.json';
import initialPanneCategories from '../data/corrective/seedPanneByCategory.json';
import initialTravauxAFaire from '../data/corrective/seedTravailAFaire.json';
import initialIntervenants from '../data/corrective/seedIntervenants.json';
import { CorrectiveIntervention } from '../domain/corrective/entities/CorrectiveIntervention';
import { CorrectiveCalculationService } from '../domain/corrective/services/CorrectiveCalculationService';
import { movementRepository } from '../application/MovementRepository';
import { dataIntegrityService } from '../services/dataIntegrityService';

const ACTIVE_LIVE_KEY = STORAGE_KEYS.CORRECTIVE_ACTIVE_LIVE;

export function useCorrectiveSubState(groupedState = {}) {
  // 1. Interventions State (Canonical key only, zero auto-seed overwrite, truthful count)
  const [interventions, setInterventions] = useState(() => {
    if (Array.isArray(groupedState.correctiveInterventions)) {
      return groupedState.correctiveInterventions;
    }
    return loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENTIONS, {
      allowDemoFallback: true,
      demoSeed: initialInterventions,
    });
  });

  // Auto-persist interventions whenever setInterventions is called (including Purge / Relink)
  useEffect(() => {
    try {
      DataGateway.saveCorrectiveInterventions(interventions);
    } catch {}
  }, [interventions]);

  // 2. Actions par Panne Dictionary
  const [actionsByPanne, setActionsByPanne] = useState(() => {
    if (
      groupedState.correctiveActionsByPanne &&
      typeof groupedState.correctiveActionsByPanne === 'object'
    ) {
      return groupedState.correctiveActionsByPanne;
    }
    return loadCollection(STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE, {
      allowDemoFallback: true,
      demoSeed: initialActionsByPanne,
      emptyDefault: {},
    });
  });

  // 3. Panne Categories Dictionary
  const [panneCategories, setPanneCategories] = useState(() => {
    if (
      groupedState.correctivePanneCategories &&
      typeof groupedState.correctivePanneCategories === 'object'
    ) {
      return groupedState.correctivePanneCategories;
    }
    return loadCollection(STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES, {
      allowDemoFallback: true,
      demoSeed: initialPanneCategories,
      emptyDefault: {},
    });
  });

  // 4. Travail à Faire Standard Descriptions
  const [travauxAFaire, setTravauxAFaire] = useState(() => {
    if (Array.isArray(groupedState.correctiveTravauxAFaire)) {
      return groupedState.correctiveTravauxAFaire;
    }
    return loadCollection(STORAGE_KEYS.CORRECTIVE_TRAVAUX, {
      allowDemoFallback: true,
      demoSeed: initialTravauxAFaire,
    });
  });

  // 5. Intervenants Correctifs
  const [intervenants, setIntervenants] = useState(() => {
    if (Array.isArray(groupedState.correctiveIntervenants)) {
      return groupedState.correctiveIntervenants;
    }
    return loadCollection(STORAGE_KEYS.CORRECTIVE_INTERVENANTS, {
      allowDemoFallback: true,
      demoSeed: initialIntervenants,
    });
  });

  const [activeLiveId, setActiveLiveId] = useState(() => {
    try {
      return localStorage.getItem(ACTIVE_LIVE_KEY) || null;
    } catch {
      return null;
    }
  });

  // Auto-persist dictionary state changes
  useEffect(() => {
    try {
      DataGateway.saveCorrectiveActionsByPanne(actionsByPanne);
    } catch (e) {
      console.error('Failed to save corrective actionsByPanne:', e);
    }
  }, [actionsByPanne]);

  useEffect(() => {
    try {
      DataGateway.saveCorrectivePanneCategories(panneCategories);
    } catch (e) {
      console.error('Failed to save corrective panneCategories:', e);
    }
  }, [panneCategories]);

  useEffect(() => {
    try {
      DataGateway.saveCorrectiveTravaux(travauxAFaire);
    } catch (e) {
      console.error('Failed to save corrective travauxAFaire:', e);
    }
  }, [travauxAFaire]);

  useEffect(() => {
    try {
      DataGateway.saveCorrectiveIntervenants(intervenants);
    } catch (e) {
      console.error('Failed to save corrective intervenants:', e);
    }
  }, [intervenants]);

  useEffect(() => {
    try {
      if (activeLiveId) {
        storageService.setItem(ACTIVE_LIVE_KEY, activeLiveId);
      } else {
        storageService.removeItem(ACTIVE_LIVE_KEY);
      }
    } catch {}
  }, [activeLiveId]);

  // Robust Search for Actions by Panne (normalized matching)
  const getActionsForPanne = useCallback((anomalie) => {
    if (!anomalie || !actionsByPanne) return [];
    const anom = String(anomalie).trim();
    if (!anom) return [];

    if (actionsByPanne[anom]) return actionsByPanne[anom];

    const withUnder = anom.replace(/\s+/g, '_');
    if (actionsByPanne[withUnder]) return actionsByPanne[withUnder];

    const withSpace = anom.replace(/_/g, ' ');
    if (actionsByPanne[withSpace]) return actionsByPanne[withSpace];

    const lower = anom.toLowerCase().replace(/_/g, ' ').trim();
    for (const [key, acts] of Object.entries(actionsByPanne)) {
      if (key.toLowerCase().replace(/_/g, ' ').trim() === lower) {
        return acts;
      }
    }

    for (const [key, acts] of Object.entries(actionsByPanne)) {
      const normKey = key.toLowerCase().replace(/_/g, ' ').trim();
      if (normKey.includes(lower) || lower.includes(normKey)) {
        return acts;
      }
    }

    return [];
  }, [actionsByPanne]);

  const addActionForPanne = useCallback((panneKey, actionText) => {
    if (!panneKey || !actionText) return;
    const cleanAction = String(actionText).trim();
    if (!cleanAction) return;

    setActionsByPanne((prev) => {
      const existing = prev[panneKey] || [];
      if (existing.includes(cleanAction)) return prev;
      const updated = {
        ...prev,
        [panneKey]: [...existing, cleanAction],
      };
      DataGateway.saveCorrectiveActionsByPanne(updated);
      return updated;
    });
  }, []);

  const updateActionForPanne = useCallback((panneKey, actionIndex, newText) => {
    if (!panneKey || actionIndex < 0 || !newText) return;
    const cleanText = String(newText).trim();
    if (!cleanText) return;

    setActionsByPanne((prev) => {
      const existing = prev[panneKey] || [];
      if (actionIndex >= existing.length) return prev;
      const updatedList = [...existing];
      updatedList[actionIndex] = cleanText;
      const updated = {
        ...prev,
        [panneKey]: updatedList,
      };
      DataGateway.saveCorrectiveActionsByPanne(updated);
      return updated;
    });
  }, []);

  const deleteActionForPanne = useCallback((panneKey, actionIndex) => {
    if (!panneKey || actionIndex < 0) return;

    setActionsByPanne((prev) => {
      const existing = prev[panneKey] || [];
      if (actionIndex >= existing.length) return prev;
      const updatedList = existing.filter((_, idx) => idx !== actionIndex);
      const updated = { ...prev };
      if (updatedList.length > 0) {
        updated[panneKey] = updatedList;
      } else {
        delete updated[panneKey];
      }
      DataGateway.saveCorrectiveActionsByPanne(updated);
      return updated;
    });
  }, []);

  const addPanne = useCallback((category, panneCode) => {
    if (!category || !panneCode) return;
    const cleanCat = String(category).trim().toUpperCase();
    const cleanCode = String(panneCode).trim();
    if (!cleanCode) return;

    setPanneCategories((prev) => {
      const existingList = prev[cleanCat] || [];
      if (existingList.includes(cleanCode)) return prev;
      const updated = {
        ...prev,
        [cleanCat]: [...existingList, cleanCode],
      };
      DataGateway.saveCorrectivePanneCategories(updated);
      return updated;
    });
  }, []);

  const updatePanne = useCallback((category, oldCode, newCode) => {
    if (!category || !oldCode || !newCode) return;
    const cleanCat = String(category).trim();
    const cleanOld = String(oldCode).trim();
    const cleanNew = String(newCode).trim();
    if (!cleanNew || cleanOld === cleanNew) return;

    setPanneCategories((prev) => {
      const list = prev[cleanCat] || [];
      const updatedList = list.map((item) => (item === cleanOld ? cleanNew : item));
      const updated = {
        ...prev,
        [cleanCat]: updatedList,
      };
      DataGateway.saveCorrectivePanneCategories(updated);
      return updated;
    });

    setActionsByPanne((prev) => {
      if (prev[cleanOld] && !prev[cleanNew]) {
        const updated = { ...prev, [cleanNew]: prev[cleanOld] };
        delete updated[cleanOld];
        DataGateway.saveCorrectiveActionsByPanne(updated);
        return updated;
      }
      return prev;
    });
  }, []);

  const deletePanne = useCallback((category, panneCode) => {
    if (!category || !panneCode) return;
    const cleanCat = String(category).trim();
    const cleanCode = String(panneCode).trim();

    setPanneCategories((prev) => {
      const list = prev[cleanCat] || [];
      const updatedList = list.filter((item) => item !== cleanCode);
      const updated = {
        ...prev,
        [cleanCat]: updatedList,
      };
      DataGateway.saveCorrectivePanneCategories(updated);
      return updated;
    });

    setActionsByPanne((prev) => {
      if (prev[cleanCode]) {
        const updated = { ...prev };
        delete updated[cleanCode];
        DataGateway.saveCorrectiveActionsByPanne(updated);
        return updated;
      }
      return prev;
    });
  }, []);

  const addTravail = useCallback((travailText) => {
    if (!travailText) return;
    const cleanText = String(travailText).trim();
    if (!cleanText) return;

    setTravauxAFaire((prev) => {
      if (prev.includes(cleanText)) return prev;
      const updated = [...prev, cleanText];
      DataGateway.saveCorrectiveTravaux(updated);
      return updated;
    });
  }, []);

  const updateTravail = useCallback((oldText, newText) => {
    if (!oldText || !newText) return;
    const cleanOld = String(oldText).trim();
    const cleanNew = String(newText).trim();
    if (!cleanNew || cleanOld === cleanNew) return;

    setTravauxAFaire((prev) => {
      const updated = prev.map((item) => (item === cleanOld ? cleanNew : item));
      DataGateway.saveCorrectiveTravaux(updated);
      return updated;
    });
  }, []);

  const deleteTravail = useCallback((travailText) => {
    if (!travailText) return;
    const cleanText = String(travailText).trim();

    setTravauxAFaire((prev) => {
      const updated = prev.filter((item) => item !== cleanText);
      DataGateway.saveCorrectiveTravaux(updated);
      return updated;
    });
  }, []);

  // Reset standard corrective action & panne dictionaries back to factory seeds
  const resetCorrectiveActionsToSeed = useCallback(async () => {
    const baseline = await loadBaselineCorrectiveData();
    if (!baseline) return;

    setActionsByPanne(baseline.actionsByPanne || {});
    setPanneCategories(baseline.panneCategories || {});
    setTravauxAFaire(baseline.travauxAFaire || []);
    setIntervenants(baseline.intervenants || []);

    DataGateway.saveCorrectiveActionsByPanne(baseline.actionsByPanne || {});
    DataGateway.saveCorrectivePanneCategories(baseline.panneCategories || {});
    DataGateway.saveCorrectiveTravaux(baseline.travauxAFaire || []);
    DataGateway.saveCorrectiveIntervenants(baseline.intervenants || []);
  }, []);

  // Force authoritative sync of all real factory data
  const forceSyncAllSeedData = useCallback(async () => {
    const baseline = await loadBaselineCorrectiveData();
    if (!baseline) return { interventionsCount: 0 };

    const items = baseline.interventions || [];
    setInterventions(items);
    DataGateway.saveCorrectiveInterventions(items);
    await resetCorrectiveActionsToSeed();

    return {
      interventionsCount: items.length,
      pannesCount: Object.values(baseline.panneCategories || {}).reduce((acc, curr) => acc + (curr?.length || 0), 0),
      categoriesCount: Object.keys(baseline.panneCategories || {}).length,
      travauxCount: (baseline.travauxAFaire || []).length,
      actionsCount: Object.keys(baseline.actionsByPanne || {}).length,
      intervenantsCount: (baseline.intervenants || []).length,
    };
  }, [resetCorrectiveActionsToSeed]);

  // Derived KPI metrics
  const kpis = useMemo(() => {
    return CorrectiveCalculationService.computeKpis(interventions);
  }, [interventions]);

  // Derived Pareto analyses
  const paretoAnomalies = useMemo(() => {
    return CorrectiveCalculationService.computePareto(interventions, 'anomalie');
  }, [interventions]);

  const paretoMachines = useMemo(() => {
    return CorrectiveCalculationService.computePareto(interventions, 'code_machine');
  }, [interventions]);

  const paretoTypes = useMemo(() => {
    return CorrectiveCalculationService.computePareto(interventions, 'type_panne');
  }, [interventions]);

  // Preventive recommendations
  const preventiveRecommendations = useMemo(() => {
    return CorrectiveCalculationService.detectPreventiveRecommendations(interventions);
  }, [interventions]);

  // 1. Create a Demande d'Intervention (DI)
  const addDemandeIntervention = useCallback((data) => {
    const now = new Date();
    const newDi = new CorrectiveIntervention({
      ...data,
      demande_date: data.demande_date || now.toISOString().split('T')[0],
      demande_heure: data.demande_heure || now.toTimeString().slice(0, 5),
      statut: 'DEMANDE',
      action_fermee: 'NON',
      rapport_redige: 'NON',
    }).toJSON();

    setInterventions((prev) => [newDi, ...prev]);
    return newDi;
  }, []);

  // 2. Convert DI to BT (Bon de Travail)
  const convertToBt = useCallback((id, btDetails = {}) => {
    let convertedItem = null;
    setInterventions((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const num_bt = btDetails.num_bt || `BT-${Math.floor(1000 + Math.random() * 9000)}`;
          convertedItem = new CorrectiveIntervention({
            ...item,
            ...btDetails,
            num_bt,
            statut: 'EN_COURS',
            date_debut: btDetails.date_debut || new Date().toISOString().split('T')[0],
            heure_debut: btDetails.heure_debut || new Date().toTimeString().slice(0, 5),
          }).toJSON();
          return convertedItem;
        }
        return item;
      })
    );
    return convertedItem;
  }, []);

  // 3. Start Live Intervention (Chronometer)
  const startLiveIntervention = useCallback((id) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timeNow = now.toTimeString().slice(0, 5);

    setActiveLiveId(id);
    setInterventions((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            statut: 'EN_COURS',
            date_debut: item.date_debut || today,
            heure_debut: item.heure_debut || timeNow,
          };
        }
        return item;
      })
    );
  }, []);

  // 4. Clôturer intervention & optional PDR sortie
  const clotureIntervention = useCallback((id, clotureData = {}, onAddMouvement = null) => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timeNow = now.toTimeString().slice(0, 5);

    let updated = null;

    setInterventions((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const dDebut = item.date_debut || clotureData.date_debut || today;
          const hDebut = item.heure_debut || clotureData.heure_debut || '08:00';
          const dFin = clotureData.date_fin || today;
          const hFin = clotureData.heure_fin || timeNow;

          const timeCalc = CorrectiveCalculationService.calculateWorkingTime(dDebut, hDebut, dFin, hFin);

          updated = new CorrectiveIntervention({
            ...item,
            ...clotureData,
            date_debut: dDebut,
            heure_debut: hDebut,
            date_fin: dFin,
            heure_fin: hFin,
            temps_intervention: timeCalc.formatted,
            temps_intervention_mins: timeCalc.minutes,
            action_fermee: 'OUI',
            statut: 'CLOTURE',
            rapport_redige: 'OUI',
          }).toJSON();

          // Auto-generate PDR Sortie if parts were used
          if (updated.pdr_ref && Number(updated.pdr_quantite) > 0) {
            const btIdentifier = updated.num_bt || updated.id;
            const mvt = {
              id: `MVT-BT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
              code_bon: `BS-BT-${btIdentifier}`,
              ref: updated.pdr_ref,
              code_article: updated.pdr_ref,
              designation: updated.pdr_designation || updated.pdr_ref,
              type: 'Sortie',
              quantite: Number(updated.pdr_quantite),
              date: dFin,
              machine: updated.code_machine,
              id_machine_registered: updated.code_machine,
              technicien: updated.intervenant || 'Technicien',
              demandeur: updated.intervenant || 'Technicien GMAO',
              prix_unitaire: Number(updated.pdr_prix) || 0,
              unite: updated.pdr_unite || 'Pièce',
              motif: `Consommation BT ${btIdentifier} · Machine: ${updated.code_machine}`,
              observation: `Sortie PDR automatique clôture BT ${btIdentifier} (${updated.anomalie || 'Correctif'})`,
            };

            try {
              movementRepository.add(mvt);
            } catch (err) {
              console.warn('[useCorrectiveSubState] Failed to add movement via repository:', err);
            }

            if (typeof onAddMouvement === 'function') {
              try {
                onAddMouvement(mvt);
              } catch (e) {
                console.warn('[useCorrectiveSubState] onAddMouvement error:', e);
              }
            }
          }

          return updated;
        }
        return item;
      })
    );

    if (activeLiveId === id) {
      setActiveLiveId(null);
    }

    return updated;
  }, [activeLiveId]);

  // 5. Update intervention partially
  const updateIntervention = useCallback((id, patch = {}) => {
    setInterventions((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return new CorrectiveIntervention({ ...item, ...patch }).toJSON();
        }
        return item;
      })
    );
  }, []);

  // 6. Delete intervention
  const deleteIntervention = useCallback((id) => {
    setInterventions((prev) => prev.filter((item) => item.id !== id));
    if (activeLiveId === id) setActiveLiveId(null);
  }, [activeLiveId]);

  // 7. Bulk import (e.g. from Excel)
  const bulkImportInterventions = useCallback((importedItems = []) => {
    if (!Array.isArray(importedItems) || importedItems.length === 0) return;
    const validated = importedItems.map((item) => new CorrectiveIntervention(item).toJSON());
    setInterventions((prev) => [...validated, ...prev]);
  }, []);

  // 8. Reset to baseline seed (truthful count, no hardcoded "800")
  const resetToSeedData = useCallback(async (ctx = {}) => {
    const { machines = [], skipConfirm = false } = ctx;

    const baseline = await loadBaselineCorrectiveData();
    const finalItems =
      baseline?.interventions && baseline.interventions.length > 0
        ? baseline.interventions
        : initialInterventions;

    const impact = dataIntegrityService.previewClearImpact({
      action: 'RESET_CORRECTIVE',
      machines,
      preventiveTasks: [],
      correctiveInterventions: interventions,
    });

    const msg =
      `Réinitialiser le correctif aux données de démonstration (${finalItems.length} intervention(s)) ?\n` +
      `• Interventions actuelles: ${impact.correctiveCount}\n` +
      `• Machines: ${impact.machineCount}\n` +
      `\nLes machines et le préventif ne seront PAS modifiés.`;

    if (!skipConfirm && typeof window !== 'undefined' && !window.confirm(msg)) {
      return { cancelled: true };
    }

    setInterventions(finalItems);
    setActiveLiveId(null);
    DataGateway.saveCorrectiveInterventions(finalItems, { machines });
    await resetCorrectiveActionsToSeed();

    const orphans = dataIntegrityService
      .annotateCorrectiveOrphans(finalItems, machines)
      .filter((i) => i._isOrphan);

    return {
      cancelled: false,
      restoredCount: finalItems.length,
      orphanCountAfter: orphans.length,
    };
  }, [resetCorrectiveActionsToSeed, interventions]);

  return {
    interventions,
    setInterventions,
    actionsByPanne,
    setActionsByPanne,
    panneCategories,
    setPanneCategories,
    travauxAFaire,
    setTravauxAFaire,
    intervenants,
    setIntervenants,
    getActionsForPanne,
    addActionForPanne,
    updateActionForPanne,
    deleteActionForPanne,
    addPanne,
    updatePanne,
    deletePanne,
    addTravail,
    updateTravail,
    deleteTravail,
    resetCorrectiveActionsToSeed,
    forceSyncAllSeedData,
    activeLiveId,
    setActiveLiveId,
    kpis,
    paretoAnomalies,
    paretoMachines,
    paretoTypes,
    preventiveRecommendations,
    addDemandeIntervention,
    convertToBt,
    startLiveIntervention,
    clotureIntervention,
    updateIntervention,
    deleteIntervention,
    bulkImportInterventions,
    resetToSeedData,
  };
}
