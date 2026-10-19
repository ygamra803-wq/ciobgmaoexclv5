# 🏛️ Single Source of Truth (SSOT) — Architecture & Persistence Registry

Ce document définit la table canonique de persistance et les règles relationnelles strictes de `ciobGMAO-v4`.
Toute clé absente de ce registre est considérée comme **legacy**, migrée une seule fois au démarrage via `migrateStorage.js`, puis ignorée dans le flux opérationnel quotidien.

---

## 1. Principes Non-Négociables (Constitution GMAO)

1. **Une entité = Une clé de stockage canonique = Un fichier seed = Un chemin d'écriture unique (`DataGateway`).**
2. **Parc Machines (`machines`)** est le référentiel maître (Master) pour tous les identifiants `id_machine_registered` / `id_machine` / `code_machine`.
3. **Zéro injection automatique de seed au démarrage** : Le stockage local (`localStorage`) ne reçoit jamais de données seed de manière implicite au chargement si la collection est vide ou courte. Le chargement des données de démonstration se fait exclusivement via une action utilisateur explicite (« Charger données démo / usine ») ou lorsque `DEMO_MODE` (`gmao_demo_data_loaded_v1`) a été explicitement activé.
4. **Interdiction des seuils de longueur arbitraires** : Une collection contenant `0`, `2` ou `5` enregistrements est une donnée utilisateur valide et ne doit jamais être écrasée par un seed sous prétexte que `length < 10` ou `length < 800`.
5. **Vérité des chiffres** : Les compteurs, notifications (toasts) et indicateurs KPI reflètent strictement le nombre réel d'enregistrements stockés (`list.length`), sans valeurs marketing codées en dur.
6. **Hiérarchie de Stockage et Résolution de Conflits** : 
   - **Ordre de priorité** : Mémoire (L1) → IndexedDB (L2) → Serveur (L3).
   - **Résolution** : Toute synchronisation entre couches utilise `updatedAt`. L'entité avec l'horodatage le plus récent (`updatedAt`) est considérée comme la plus valide et écrase les versions antérieures. Les écritures serveur (API) doivent valider le jeton `GMAO_API_TOKEN`.

---

## 2. Registre Canonique des Entités (SSOT Table)

| Entity | Primary Key | Foreign Keys (FK →) | Storage Key (Canonical) | Seed File (Demo Only) | Writer (Module / Gateway) |
|--------|-------------|---------------------|-------------------------|-----------------------|---------------------------|
| **machines** | `id_machine_registered` | → `zones.id_zone`, `families.id_family`, `templates.id_templates` | `gmao_machines_v2` | `src/data/machines/seedMachines.json` | `DataGateway.saveMachines` / `useMachineSubState` |
| **families** | `id_family` | — | `gmao_families_v2` | `src/data/machines/seedFamilies.json` | `DataGateway.saveFamilies` / `useMachineSubState` |
| **templates** | `id_templates` | → `families.id_family` | `gmao_templates_v2` | `src/data/machines/seedTemplates.json` | `DataGateway.saveTemplates` / `useMachineSubState` |
| **blueprints** | `id_blueprint` | → `templates.id_templates` | `gmao_blueprints_v2` | `src/data/machines/seedBlueprints.json` | `DataGateway.saveBlueprints` / `useMachineSubState` |
| **zones** | `id_zone` (`code_zone`) | — | `gmao_zones_v2` | `src/data/machines/seedZones.json` | `DataGateway.saveZones` / `useMachineSubState` |
| **machineElementsLedger** | `id` | → `machines.id_machine_registered` | `gmao_machine_bom_ledger_v1` | `src/data/machines/seedMachineBomLedger.json` | `DataGateway.saveMachineBom` / `useMachineSubState` |
| **stockItems (rawStock)** | `ref` (`id`) | → `stockTypes.id_type` | `gmao_raw_stock_v7` | `src/data/stock/seedStockItems.json` | `DataGateway.saveStock` / `useStockSubState` |
| **stockTypes (types)** | `id_type` | — | `gmao_types_v5` | `src/data/stock/seedStockTypes.json` | `DataGateway.saveStockTypes` / `useStockSubState` |
| **designations** | `ref` (`id`) | → `stockTypes.id_type` | `gmao_designations_v3` | Dérivé de `seedStockItems.json` | `DataGateway.saveDesignations` / `useStockSubState` |
| **mouvements** | `id` (`code_bon`) | → `stockItems.ref`, `machines.id_machine_registered`, `zones.id_zone` | `gmao_mouvements_v2` | `[]` (Prod) / `src/data/movements/seedMouvements.json` (Demo) | `DataGateway.saveMouvements` / `useMovementSubState` |
| **preventiveTasks** | `id` (`code`) | → `machines.id_machine_registered`, `zones.id_zone` | `gmao_preventive_tasks_v9` | `src/data/preventive/seedPreventiveTasks.json` | `DataGateway.savePreventiveTasks` / `usePreventiveSubState` |
| **preventiveActions** | `id` (`code`) | — | `gmao_preventive_actions_v3` | `src/data/preventive/seedPreventiveActions.json` | `DataGateway.savePreventiveActions` / `usePreventiveSubState` |
| **preventiveGuides** | `id` (`code`) | → `preventiveActions.code` | `gmao_preventive_guides_v3` | `src/data/preventive/seedPreventiveGuides.json` | `DataGateway.savePreventiveGuides` / `usePreventiveSubState` |
| **preventivePlans** | `id` (`code`) | → `machines.id_machine_registered` | `gmao_preventive_plans_v3` | `[]` | `DataGateway.savePreventivePlans` / `usePreventiveSubState` |
| **correctiveInterventions** | `id` (`num_bt`) | → `machines.id_machine_registered` (`code_machine`), `stockItems.ref` (`pdr_ref`) | `gmao_corrective_interventions_v4` | `[]` (Prod) / `src/data/corrective/seedCorrectiveInterventions.json` (Demo) | `DataGateway.saveCorrectiveInterventions` / `useCorrectiveSubState` |
| **correctiveActionsByPanne** | `panneKey` (Map) | → `correctivePanneCategories` | `gmao_corrective_actions_by_panne_v4` | `src/data/corrective/seedActionsByPanne.json` | `DataGateway.saveCorrectiveDictionaries` / `useCorrectiveSubState` |
| **correctivePanneCategories**| `categoryKey` (Map)| — | `gmao_corrective_panne_categories_v4` | `src/data/corrective/seedPanneByCategory.json` | `DataGateway.saveCorrectiveDictionaries` / `useCorrectiveSubState` |
| **correctiveTravauxAFaire** | `index` (String) | — | `gmao_corrective_travaux_v4` | `src/data/corrective/seedTravailAFaire.json` | `DataGateway.saveCorrectiveDictionaries` / `useCorrectiveSubState` |
| **correctiveIntervenants** | `id` (`nom`) | — | `gmao_corrective_intervenants_v4` | `src/data/corrective/seedIntervenants.json` | `DataGateway.saveCorrectiveDictionaries` / `useCorrectiveSubState` |
| **users (Personnel Master)** | `id` | → `zones.id_zone` | `gmao_personnel_users_v2` | `src/data/users/seedUsers.json` | `DataGateway.savePersonnel` / `useUserSubState` |
| **technicians (Vue dérivée)**| `id_technician` | → `users.id`, `zones.id_zone` | `gmao_technicians_v2` | `src/data/users/seedTechnicians.json` | Dérivé de `users` (`useUserSubState`) |
| **operations (Vue dérivée)** | `id_operation` | → `users.id`, `zones.id_zone` | `gmao_operations_v2` | `src/data/users/seedOperations.json` | Dérivé de `users` (`useUserSubState`) |
| **warehouseItems** | `id` (`ref`) | → `compTemplates.id_templates` | `gmao_warehouse_items_v3` | `src/data/warehouse/seedWarehouseItems.json` | `DataGateway.saveWarehouseItems` / `useWarehouseSubState` |
| **entrepotComponents** | `id` (`ref`) | → `compFamilies.id_family` | `gmao_entrepot_components_v3` | `src/data/warehouse/seedEntrepotComponents.json` | `DataGateway.saveEntrepotComponents` / `useWarehouseSubState` |
| **compGroups** | `id_group` | — | `gmao_comp_groups_v2` | `src/data/warehouse/seedCompGroups.json` | `DataGateway.saveCompGroups` / `useWarehouseSubState` |
| **compFamilies** | `id_family` | → `compGroups.id_group` | `gmao_comp_families_v3` | `src/data/warehouse/seedCompFamilies.json` | `DataGateway.saveCompFamilies` / `useWarehouseSubState` |
| **compTemplates** | `id_templates` | → `compFamilies.id_family` | `gmao_comp_templates_v3` | `src/data/warehouse/seedCompTemplates.json` | `DataGateway.saveCompTemplates` / `useWarehouseSubState` |
| **partTypes** | `id_type` | — | `gmao_part_types_v2` | `src/data/warehouse/seedPartTypes.json` | `DataGateway.savePartTypes` / `useWarehouseSubState` |
| **partDesignations** | `id` (`ref`) | → `partTypes.id_type` | `gmao_part_designations_v2` | `src/data/warehouse/seedPartDesignations.json` | `DataGateway.savePartDesignations` / `useWarehouseSubState` |
| **sortiesExterne** | `id` (`code`) | → `machines.id_machine_registered` | `gmao_sortie_externe_bobinage_v1` | `src/data/movements/seedSortiesExternes.json` | `DataGateway.saveSortiesExterne` / `useSortieExterneSubState` |

---

## 3. Clés de Contrôle Système

| Clé | Rôle | Valeurs |
|-----|------|---------|
| `gmao_demo_data_loaded_v1` | Indique si l'utilisateur a explicitement chargé les données de démonstration | `'true'` \| `'false'` |
| `gmao_storage_migrated_v1` | Indique que la migration unique des anciennes clés vers les clés canoniques a été exécutée | `'true'` |
| `gmao_full_state_v1` | Snapshot complet utilisé uniquement pour l'export/restauration et la synchronisation multi-onglets (`BroadcastChannel`), jamais pour écraser silencieusement une clé canonique au démarrage | Objet JSON |

---

## 4. Politique d'Intégrité Référentielle

- **Suppression d'une machine (`machines`)** : Vérification obligatoire via `dataIntegrityService.getMachineDependencies`. Si la machine possède un historique (Préventif, Correctif, Mouvements, BOM), elle passe en statut `ARCHIVEE` (Soft-Archive) au lieu d'une suppression physique.
- **Création d'interventions / tâches** : Les listes déroulantes de sélection d'équipements utilisent exclusivement `filterActiveMachines(machines)` (excluant `ARCHIVEE`).
- **Détection et purge des orphelins** : Gérées via `dataIntegrityService` dans `Paramètres > Intégrité` et persistées via `DataGateway` sur les clés canoniques.
