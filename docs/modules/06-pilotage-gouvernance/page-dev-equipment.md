---
id: page-dev-equipment
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance & Gouvernance
docType: architecture
audience: developer
tabId: equipment
title: Spécification Technique — Équipements & Système Général (Utilités & Infrastructure)
summary: Architecture du référentiel dédié aux équipements du Système Général (SYSTEM_GENERAL). Partage du SSOT STORAGE_KEYS.MACHINES, gouvernance exclusive de création/édition hors Parc Production, codification séquentielle par type d'utilité et Safe Archive.
relatedTabs:
  - equipment
  - machines
  - zones
  - utilisateurs
  - preventive
---

# 💻 Spécification Développeur : Équipements & Système Général (`#equipment`)

> **Public :** Développeurs Backend/Frontend, Architectes Logiciels & Modèles IA.  
> **Composant source :** `src/presentation/pages/equipment/EquipmentView.tsx`  
> **Utilitaires domaine :** `src/utils/activeMachines.ts` (`getMachineAssetClass`, `transitionMachineLifecycle`), `src/presentation/pages/machines/AddMachineModal.tsx` (`generateSystemGeneralCode`)  
> **Clés SSOT :** `STORAGE_KEYS.MACHINES` (`gmao_machines_v2`), `STORAGE_KEYS.GENERAL_SYSTEM_TYPES` (`gmao_general_system_types_v1`).

---

## 1. Philosophie Architecturale : SSOT Unique & Séparation Stricte d'Interface

Dans **CIOB GMAO Nexus v5.0.2**, les utilités industrielles et équipements d'infrastructure (compresseurs d'air, groupes électrogènes, centrales incendie, refroidisseurs, postes HT/BT) appartiennent à la classe **`asset_class: 'SYSTEM_GENERAL'`**.

### Pourquoi partager `STORAGE_KEYS.MACHINES` tout en isolant l'écran `#equipment` ?
1. **Unicité du Référentiel Actifs (Zéro Table Dupliquée) :**
   - Tous les moteurs transverses de la GMAO (`PreventiveService`, `MeterService`, `WorkOrderStateMachine`, `IncrementalStockIndex` / imputations magasin, `MachineHealthPassportService`) résolvent les équipements via `filterActiveMachines(machines)`.
   - En stockant les équipements `SYSTEM_GENERAL` dans `STORAGE_KEYS.MACHINES` avec `asset_class: 'SYSTEM_GENERAL'`, ils bénéficient nativement des gammes préventives, des relevés d'horomètres, des Bons de Travail (`DI/BT`) et du calcul de `TCO` sans aucune duplication de clé étrangère.
2. **Séparation Stricte du Cycle de Création/Édition (`EQUIPMENT-PAGE-P0`) :**
   - Une machine de **`PRODUCTION`** exige la pyramide **Tier 1 (`Family` $\rightarrow$ `Template`) $\rightarrow$ Tier 3 (`Blueprint`)** et figure dans l'arborescence **`Nexus`**.
   - Un équipement **`SYSTEM_GENERAL`** est classé par **Type d'Utilité (`id_general_system_type`)** sans `Family` ni `Template` de production (`id_family: ''`, `id_templates: ''`, `asset_level: 'MACHINE'`, `parent_id: null`).
   - **Règle d'Or UI :** L'écran `EquipmentView.tsx` (`#equipment`) est le **seul point d'entrée autorisé** pour créer, modifier, archiver/restaurer les équipements `SYSTEM_GENERAL` et gérer le catalogue `GENERAL_SYSTEM_TYPES`. L'écran `MachinesRegisteredView.tsx` (`#machines`) peut les afficher en consultation mais redirige toute demande de création ou d'édition `SYSTEM_GENERAL` vers `#equipment`.

---

## 2. Modèle de Données & Passerelle de Focus Inter-Écrans

### 2.1 Structure d'un Équipement `SYSTEM_GENERAL` dans `machines`

```typescript
export interface SystemGeneralEquipmentRecord {
  id_machine_registered: string;   // Code séquentiel généré par type (ex. 'AIR-01', 'SEC-02')
  designation: string;             // Libellé complet (ex. 'Compresseur Vis Atlas Copco GA55')
  asset_class: 'SYSTEM_GENERAL';   // Discriminant canonique lu par getMachineAssetClass()
  id_general_system_type: string;  // FK vers STORAGE_KEYS.GENERAL_SYSTEM_TYPES (ex. 'AIR')
  id_family: '';                   // Toujours vide (pas de famille de production)
  id_templates: '';                // Toujours vide (pas de template constructeur de ligne)
  asset_level: 'MACHINE';          // Toujours un actif unitaire
  parent_id: null;                 // Hors regroupement de ligne de production
  id_zone_default: string;         // FK vers STORAGE_KEYS.ZONES (localisation physique)
  technician: string;              // FK vers STORAGE_KEYS.TECHNICIENS (responsable titulaire)
  serial_number: string;           // Numéro de série constructeur
  date_mise_en_service: string;    // Date ISO YYYY-MM-DD
  compteur_heures: number;         // Valeur actuelle du compteur
  compteur_unite_defaut: 'HEURES' | 'CYCLES' | 'TONNES' | 'KM';
  status: 'En Service' | 'En Maintenance' | 'En Panne' | 'Arrêt' | 'ARCHIVEE';
  is_active: boolean;
}
```

### 2.2 Redirection Contextuelle depuis `MachinesRegisteredView` (`gmao_equipment_focus_id`)
Lorsqu'un utilisateur clique sur **« Gérer dans Système Général »** sur une ligne `SYSTEM_GENERAL` dans `MachinesRegisteredView.tsx` :
1. `onNavigateToEquipment(machineId)` inscrit temporairement l'identifiant dans `localStorage.setItem('gmao_equipment_focus_id', machineId)` et bascule le routeur sur l'onglet `'equipment'`.
2. Au montage de `EquipmentView.tsx`, un `useEffect` consomme et supprime `gmao_equipment_focus_id`, pré-filtre la grille sur cet équipement, adapte automatiquement le filtre de statut (`ARCHIVEE` si l'équipement est archivé) et met la ligne en surbrillance visuelle.

---

## 3. Contrôle d'Accès (`RBAC`) & Intégrité Référentielle (`Safe Archive`)

1. **Permissions dédiées dans `AuthorizationService.tsx` :**
   - `equipment.view` : Consultation du parc `SYSTEM_GENERAL` (accordé à tous les rôles authentifiés).
   - `equipment.create`, `equipment.edit`, `equipment.delete` : Création, modification et archivage des utilités et types de système.
2. **Protection `Safe Archive` :**
   - Avant toute suppression (`handleDeleteMachine`), `EquipmentView.tsx` interroge `dataIntegrityService.getMachineDependencies(id, state)`.
   - Si l'équipement possède des bons de travail, des exécutions préventives ou des mouvements de stock liés, la suppression destructive est bloquée au profit d'une transition `transitionMachineLifecycle(equip, 'ARCHIVED')` enregistrée dans `AUDIT_EVENTS`.
