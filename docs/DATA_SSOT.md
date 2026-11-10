# 🏛️ Single Source of Truth (SSOT) — Architecture & Persistence Registry

Ce document définit la table canonique de persistance (`src/infrastructure/persistence/storageKeys.ts`) et les règles relationnelles strictes de **CIOB GMAO v4**.
Toute clé absente de ce registre est considérée comme **legacy** (`LEGACY_KEY_MAP`), migrée une seule fois au démarrage via `migrateStorage.ts` (uniquement hors mode `START_MODE === 'empty'`), puis supprimée.

---

## 1. Principes Non-Négociables (Constitution GMAO)

1. **Une entité = Une clé de stockage canonique (`STORAGE_KEYS`) = Un chemin d'écriture unique (`DataGateway.ts` + `useGmaoStore.ts`).**
2. **Parc Machines (`machines`)** est le référentiel maître (Master) pour tous les équipements physiques enregistrés (`id_machine_registered` / `id_machine` / `code_machine`).
3. **Zéro injection automatique de seed au démarrage** : Le stockage local ne reçoit jamais de données seed de manière implicite au chargement si la collection est vide. Le chargement des données de démonstration se fait exclusivement via une action utilisateur explicite (`DataGateway.loadDemoData` / `DataGateway.loadDemoSection`).
4. **Interdiction des seuils de longueur arbitraires** : Une collection contenant `0`, `2` ou `5` enregistrements est une donnée utilisateur valide et ne doit jamais être écrasée par un seed.
5. **Vérité des chiffres** : Les compteurs, badges de barre latérale et indicateurs KPI reflètent strictement le nombre réel d'enregistrements stockés (`list.length`), sans valeurs codées en dur.
6. **Hiérarchie de Stockage et Résolution de Conflits** :
   - **Ordre de priorité** : Mémoire Zustand (`useGmaoStore`) → `localStorage` / `IndexedDB` (`DataGateway`) → Serveur Hôte LAN (`server.ts`).
   - **Synchronisation Serveur (`server.ts`)** : Protégée par `X-GMAO-API-TOKEN`, liste blanche `ALLOWED_ENTITIES`, contrôle de rôle Fail-Closed (`serverRbacPolicy.ts` / `x-gmao-role`), file d'écriture atomique (`writeQueue`), et détection de conflit `version` (`409 Conflict`).

---

## 2. Registre Canonique des Entités (`STORAGE_KEYS`)

| Entity | Primary Key | Foreign Keys (FK →) | Storage Key (Canonical) | Seed File (Explicit Demo Only) | Writer (Gateway / Store) |
|--------|-------------|---------------------|-------------------------|--------------------------------|--------------------------|
| **machines** | `id_machine_registered` | → `zones.id_zone`, `families.id_family`, `templates.id_templates`, `machines.id_machine_registered` (`parent_id` optionnel) | `gmao_machines_v2` | `src/data/machines/seedMachines.json` | `DataGateway.saveMachines` / `useGmaoStore` |
| **generalSystemTypes** | `id` (`code`) | — | `gmao_general_system_types_v1` | `[]` | `DataGateway.saveGeneralSystemTypes` / `useGmaoStore` |
| **families** | `id_family` | — | `gmao_families_v2` | `src/data/machines/seedFamilies.json` | `DataGateway.saveFamilies` / `useGmaoStore` |
| **templates** | `id_templates` | → `families.id_family` | `gmao_templates_v2` | `src/data/machines/seedTemplates.json` | `DataGateway.saveTemplates` / `useGmaoStore` |
| **blueprints** | `id_blueprint` | → `templates.id_templates` | `gmao_blueprints_v2` | `src/data/machines/seedBlueprints.json` | `DataGateway.saveBlueprints` / `useGmaoStore` |
| **zones** | `id_zone` (`code_zone`) | — | `gmao_zones_v2` | `src/data/machines/seedZones.json` | `DataGateway.saveZones` / `useGmaoStore` |
| **machineElementsLedger** | `id` | → `machines.id_machine_registered` | `gmao_machine_bom_ledger_v1` | `src/data/machines/seedMachineBomLedger.json` | `DataGateway.saveMachineBom` / `useGmaoStore` |
| **rawStock** | `ref` (`id`) | → `stockTypes.id_type` | `gmao_raw_stock_v8` | `src/data/stock/seedStockItems.json` | `DataGateway.saveStock` / `useGmaoStore` |
| **stockTypes** | `id_type` | — | `gmao_types_v5` | `src/data/stock/seedStockTypes.json` | `DataGateway.saveStockTypes` / `useGmaoStore` |
| **designations** | `ref` (`id`) | → `stockTypes.id_type` | `gmao_designations_v3` | Dérivé de `seedStockItems.json` | `DataGateway.saveDesignations` / `useGmaoStore` |
| **mouvements** | `id` (`code_bon`) | → `rawStock.ref`, `machines.id_machine_registered`, `zones.id_zone` | `gmao_mouvements_v2` | `src/data/movements/seedMouvements.json` | `DataGateway.saveMouvements` / `useGmaoStore` |
| **sortieDemands** | `id` (`code_demande`) | → `rawStock.ref`, `machines.id_machine_registered` | `gmao_sortie_demands_v1` | `[]` | `DataGateway.saveSortieDemands` / `useGmaoStore` |
| **replenishmentOrders** | `id` (`code_commande`) | → `rawStock.ref` (`items[].ref`) | `gmao_replenishment_orders_v1` | `[]` | `DataGateway.saveReplenishmentOrders` / `useGmaoStore` |
| **preventiveTasks** | `id` (`code`) | → `machines.id_machine_registered`, `zones.id_zone`, `warehouseItems.id` (`id_composant` / `id_part`) | `gmao_preventive_tasks_v9` | `src/data/preventive/seedPreventiveTasks.json` | `DataGateway.savePreventiveTasks` / `useGmaoStore` |
| **preventiveExecutions** | `id` | → `preventiveTasks.id`, `machines.id_machine_registered`, `warehouseItems.id` (`id_composant` / `id_part`) | `gmao_preventive_executions_v1` | `[]` | `ExecutionService.recordExecution` / `DataGateway.savePreventiveExecutions` |
| **meterReadings** | `id` | → `machines.id_machine_registered` (`machineId`) | `gmao_meter_readings_v1` | `[]` | `MeterService` / `DataGateway.saveMeterReadings` |
| **preventiveActions** | `id` (`code`) | — | `gmao_preventive_actions_v3` | `src/data/preventive/seedPreventiveActions.json` | `DataGateway.savePreventiveActions` / `useGmaoStore` |
| **preventiveGuides** | `id` (`code`) | → `preventiveActions.code` | `gmao_preventive_guides_v3` | `src/data/preventive/seedPreventiveGuides.json` | `DataGateway.savePreventiveGuides` / `useGmaoStore` |
| **preventivePlans** | `id` (`code`) | → `machines.id_machine_registered` | `gmao_preventive_plans_v3` | `[]` | `DataGateway.savePreventivePlans` / `useGmaoStore` |
| **correctiveInterventions** | `id` (`num_bt`) | → `machines.id_machine_registered` (`code_machine`), `warehouseItems.id` (`id_composant`, `id_part`), `rawStock.ref` (`pdr_ref`) | `gmao_corrective_interventions_v4` | `src/data/corrective/seedCorrectiveInterventions.json` | `DataGateway.saveCorrectiveInterventions` / `useGmaoStore` |
| **correctiveActionsByPanne** | `panneKey` (Map) | → `correctivePanneCategories` | `gmao_corrective_actions_by_panne_v4` | `src/data/corrective/seedActionsByPanne.json` | `DataGateway.saveCorrectiveDictionaries` / `useGmaoStore` |
| **correctivePanneCategories**| `categoryKey` (Map)| — | `gmao_corrective_panne_categories_v4` | `src/data/corrective/seedPanneByCategory.json` | `DataGateway.saveCorrectiveDictionaries` / `useGmaoStore` |
| **correctiveTravauxAFaire** | `index` (String) | — | `gmao_corrective_travaux_v4` | `src/data/corrective/seedTravailAFaire.json` | `DataGateway.saveCorrectiveDictionaries` / `useGmaoStore` |
| **correctiveIntervenants** | `id` (`nom`) | — | `gmao_corrective_intervenants_v4` | `src/data/corrective/seedIntervenants.json` | `DataGateway.saveCorrectiveDictionaries` / `useGmaoStore` |
| **workshopOrders** | `id` (`code_bon`) | → `machines.id_machine_registered` (`id_machine`), `correctiveInterventions.id` (`id_bt`, `id_di` optionnels) | `gmao_workshop_orders_v1` | `[]` | `DataGateway.saveWorkshopOrders` / `useGmaoStore` |
| **correctiveActiveLive** | `id` | → `correctiveInterventions.id` | `gmao_corrective_active_live` | `null` | `DataGateway.saveCollection` / `useGmaoStore` |
| **users (Personnel Master)** | `id` | → `zones.id_zone` | `gmao_personnel_users_v2` | `src/data/users/seedUsers.json` | `DataGateway.savePersonnel` / `useGmaoStore` |
| **technicians (Vue dérivée)**| `id_technician` | → `users.id`, `zones.id_zone` | `gmao_technicians_v2` | `src/data/users/seedTechnicians.json` | Dérivé de `users` (`useGmaoStore`) |
| **operations (Vue dérivée)** | `id_operation` | → `users.id`, `zones.id_zone` | `gmao_operations_v2` | `src/data/users/seedOperations.json` | Dérivé de `users` (`useGmaoStore`) |
| **warehouseItems** | `id` (`ref`) | → `compTemplates.id_templates`, `machines.id_machine_registered` (`machineId`) | `gmao_warehouse_items_v3` | `src/data/warehouse/seedWarehouseItems.json` | `DataGateway.saveWarehouseItems` / `useGmaoStore` |
| **entrepotComponents** | `id` (`ref`) | → `compFamilies.id_family` | `gmao_entrepot_components_v3` | `src/data/warehouse/seedEntrepotComponents.json` | `DataGateway.saveEntrepotComponents` / `useGmaoStore` |
| **compGroups** | `id_group` | — | `gmao_comp_groups_v2` | `src/data/warehouse/seedCompGroups.json` | `DataGateway.saveCompGroups` / `useGmaoStore` |
| **compFamilies** | `id_family` | → `compGroups.id_group` | `gmao_comp_families_v3` | `src/data/warehouse/seedCompFamilies.json` | `DataGateway.saveCompFamilies` / `useGmaoStore` |
| **compTemplates** | `id_templates` | → `compFamilies.id_family` | `gmao_comp_templates_v3` | `src/data/warehouse/seedCompTemplates.json` | `DataGateway.saveCompTemplates` / `useGmaoStore` |
| **partTypes** | `id_type` | — | `gmao_part_types_v2` | `src/data/warehouse/seedPartTypes.json` | `DataGateway.savePartTypes` / `useGmaoStore` |
| **partDesignations** | `id` (`ref`) | → `partTypes.id_type` | `gmao_part_designations_v2` | `src/data/warehouse/seedPartDesignations.json` | `DataGateway.savePartDesignations` / `useGmaoStore` |
| **sortiesExterne** | `id` (`code`) | → `machines.id_machine_registered`, `warehouseItems.id` (`id_composant`) | `gmao_sortie_externe_bobinage_v1` | `src/data/movements/seedSortiesExternes.json` | `DataGateway.saveSortiesExterne` / `useGmaoStore` |
| **financialBudgets** | `fiscalYear` | — | `gmao_financial_budgets_v1` | `[]` | `DataGateway.saveFinancialBudgets` / `useGmaoStore` |
| **auditEvents** | `id` (`AUD-*`) | — (Append-Only Ledger) | `gmao_audit_events_v1` | `[]` | `AuditService.recordEvent` / `DataGateway.saveAuditEvents` |

---

## 3. Clés de Contrôle Système

| Clé (`STORAGE_KEYS`) | Nom dans `localStorage` | Rôle | Valeurs |
|----------------------|-------------------------|------|---------|
| `DEMO_MODE` | `gmao_demo_data_loaded_v1` | Indique si l'utilisateur a explicitement chargé les données de démonstration | `true` \| `false` |
| `START_MODE` | `gmao_start_mode` | Mode de démarrage actif (bloque toute réinjection après `clearAllForRealFactory`) | `'empty'` \| `'demo'` \| `'custom'` |
| `STORAGE_MIGRATED` | `gmao_storage_migrated_v1` | Indique que la migration unique des anciennes clés vers les clés canoniques a été exécutée | `'true'` |
| `FULL_STATE_SNAPSHOT`| `gmao_full_state_v1` | Snapshot complet utilisé pour l'export/restauration et la synchronisation (`IndexedDB` / `BroadcastChannel`), purgé lors d'un `clearAllForRealFactory` | Objet JSON |

---

## 4. Politique d'Intégrité Référentielle

- **Suppression d'une machine (`machines`) ou d'un technicien (`users`)** : Vérification obligatoire des dépendances historiques. Si l'entité possède un historique (Préventif, Correctif, Mouvements, BOM), elle est archivée (`status: 'ARCHIVEE'` ou `is_active: false`) au lieu d'une suppression physique. L'archivage d'une ligne mère détache proprement ses machines filles (`detachChildrenOnParentArchive`).
- **Création d'interventions / tâches** : Les listes déroulantes de sélection d'équipements utilisent exclusivement `filterActiveMachines(machines)` (`src/utils/activeMachines.ts`), excluant les machines archivées et sans jamais injecter de machines fictives codées en dur.
- **Détection et purge des orphelins** : Gérées via `src/services/dataIntegrityService.ts` dans `Paramètres > Intégrité` et persistées via `DataGateway` sur les clés canoniques.

---

## 5. Philosophie Industrielle à 3 Niveaux (`Family/Template ➔ Machine Registered ➔ Blueprint`) & `BOM Nexus`

1. **Niveau 1 — `Family` & `Template` (`gmao_families_v2`, `gmao_templates_v2`)** : Classification industrielle et fiche de spécifications standard constructeur (puissance, vitesse, modèle).
2. **Niveau 2 — `Machine Registered` (`gmao_machines_v2`)** : L'équipement physique réel installé dans l'atelier (ou `System General`). **Elle seule possède** sa zone géographique (`id_zone_default`), son technicien référent (`technician`), son compteur d'exploitation (`compteur_actuel` / `meterReadings`), et ses organes montés (`machineElementsLedger`). Elle peut optionnellement déclarer un `asset_level: 'MACHINE' | 'LINE'` et un `parent_id` pour l'agrégation opérationnelle de ligne (`src/utils/assetHierarchy.ts`), sans jamais hériter de la `Zone`, de la `Family` ou du `Blueprint` de la ligne mère.
3. **Niveau 3 — `Blueprint` (`gmao_blueprints_v2`)** : Empreinte cognitive virtuelle rattachée au `Template` et à la `Machine`. Elle capitalise la connaissance technique au fil des interventions (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`, `preventivePlanItems`, `commonFailures`). **Un `Blueprint` est virtuel : il ne possède jamais de `Zone` ni de `Technicien`.**
4. **Nomenclature `BOM Nexus` (`Component` vs `Part` vs `PDR`)** :
   - **`Components` (`warehouseItems`, `nature === 'COMPONENT'`)** : Sous-ensembles rotatifs suivis par cycle de vie d'état (`Actif`, `En réserve`, `En bobinage`, `HS`).
   - **`Parts` (`warehouseItems`, `nature === 'PART'`)** : Éléments mécaniques ou fonctionnels localisés sur la machine (`id_part`, `Pareto Organes`).
   - **`PDR` (`rawStock` — `gmao_raw_stock_v8`)** : Pièces de rechange consommables gérées exclusivement par quantité mathématique (`stockActuel = stockInitial + entrées − sorties` via `IncrementalStockIndex`).
