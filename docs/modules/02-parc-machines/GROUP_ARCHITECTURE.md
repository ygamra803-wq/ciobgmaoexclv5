---
id: group-02-parc-machines-architecture
groupId: 02-parc-machines
groupTitle: Parc Machines, Blueprints & Architecture 3-Tiers
docType: architecture
audience: developer
title: Architecture & Logique Métier — Groupe Parc Machines, Blueprints & Nexus 3-Tiers
summary: Spécification d'ingénierie de la philosophie 3-Tiers (Famille/Template ➔ Machine Physique ➔ Blueprint Cognitif), hiérarchie opérationnelle MACHINE | LINE, BOM As-Built Nexus, Passeport Santé 360° (BER/TCO) et Safe Archive.
relatedTabs:
  - machines
  - families
  - templates
  - blueprints
  - nexus
---

# Architecture & Logique Métier — Groupe 02 : Parc Machines, Blueprints & Architecture 3-Tiers

## 1. Philosophie Fondamentale des 3 Tiers (Séparation Stricte des Préoccupations)

Dans **CIOB GMAO v4**, un équipement industriel n'est jamais réduit à une simple ligne plate. L'architecture sépare rigoureusement **ce qu'est l'équipement par catalogue** (Tier 1), **où et comment il opère physiquement dans l'usine** (Tier 2), et **son patrimoine de connaissances d'ingénierie** (Tier 3) :

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ TIER 1 : CLASSIFICATION & CATALOGUE CONSTRUCTEUR                          │
│ • Famille (FAM-XX)  ➔  Modèle / Template Constructeur (TPL-XXX)           │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        ▼                                                       ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────┐
│ TIER 2 : MACHINE PHYSIQUE ENREGISTRÉE │   │ TIER 3 : BLUEPRINT COGNITIF   │
│ (STORAGE_KEYS.MACHINES)               │◄─►│ (STORAGE_KEYS.BLUEPRINTS)     │
│ • Possède : Zone (id_zone_default),   │   │ • Jumeau cognitif virtuel     │
│   Technicien, Compteur (Horomètre),   │   │ • BOM théorique (Organes,     │
│   Statut, Rôle (MACHINE | LINE),      │   │   Pièces, PDR), Gammes PM     │
│   Parent (parent_id), et BOM Réel     │   │   types & Pannes récurrentes  │
│   (Nexus + Entrepôt MONTE).           │   │ • Ne possède NI Zone NI Tech  │
└───────────────────────────────────────┘   └───────────────────────────────┘
```

### Règles Architecturales Non-Négociables (`ADR-02` & `AGENTS.md`)
1. **Un `Blueprint` est virtuel** : Il ne possède **jamais** de `Zone` géographique ni de `Technicien` titulaire. Plusieurs machines jumelles installées dans des zones différentes peuvent partager le même `Blueprint`.
2. **La `Machine Enregistrée` est l'actif physique** : Elle seule porte son emplacement (`id_zone_default`), son technicien responsable (`technician`), son horomètre (`compteur_heures` / `meterReadings`), ses coûts réels (`TCO`) et ses organes physiquement montés (`machineElementsLedger` + `warehouseItems` au statut `MONTE`).

---

## 2. Classes d'Actifs (`PRODUCTION` vs `SYSTEM_GENERAL`) & Frontière de Gouvernance

Le service `src/utils/activeMachines.ts` distingue deux classes d'équipements au sein du SSOT unique `STORAGE_KEYS.MACHINES` :
- **`PRODUCTION` (Géré dans `MachinesRegisteredView.tsx` — `#machines`)** : Machines de transformation et lignes de production industrielle. Elles sont obligatoirement rattachées à une **Famille (`id_family`)** et un **Template (`id_templates`)**, disposent d'un **Blueprint (`id_blueprint`)**, et apparaissent dans l'**Arborescence Nexus** (`filterProductionMachines(machines)`). Leur création et leur édition s'effectuent dans `MachinesRegisteredView.tsx` / `AddMachineModal.tsx`.
- **`SYSTEM_GENERAL` (Géré exclusivement dans `EquipmentView.tsx` — `#equipment`)** : Infrastructures, utilités et équipements de sécurité d'usine (compresseurs d'air `AIR`, groupes électrogènes `ELEC`, pompes incendie `SEC`, refroidisseurs `CHILL`). Ils sont typés via `STORAGE_KEYS.GENERAL_SYSTEM_TYPES` (`id_general_system_type`) avec génération automatique de code (`AIR-01`, `SEC-01`), sans imposer de Famille/Template de production.
  - **Règle d'Isolation (`EQUIPMENT-PAGE-P0`)** : `MachinesRegisteredView.tsx` affiche les équipements `SYSTEM_GENERAL` en **consultation** (pour la visibilité globale du parc, le Passeport 360° et l'étiquette QR), mais ne permet **ni de les créer ni de les modifier sur place** : toute action de création ou d'édition d'un équipement `SYSTEM_GENERAL` redirige vers la page dédiée **Équipements / Système Général (`#equipment`)** du groupe Pilotage & Référentiels.

---

## 3. Regroupement Opérationnel Ligne / Machine (`MACHINE | LINE`)

Conformément à la décision architecturale **`ASSET-HIERARCHY-P0`** (`src/utils/assetHierarchy.ts`), le regroupement opérationnel sur `machines` est volontairement léger à **2 niveaux** :
- **`asset_level: 'LINE'`** : Ligne de production ou machine mère regroupant plusieurs équipements.
- **`asset_level: 'MACHINE'`** : Machine autonome (`parent_id: null`) ou machine rattachée à une ligne mère (`parent_id: 'LIGNE-01'`).

### Invariants Algébriques de la Hiérarchie (`src/utils/assetHierarchy.ts`)
1. **Détection & Interdiction des Cycles (`wouldCreateHierarchyCycle`)** : Avant toute affectation de `parent_id`, l'algorithme parcourt la chaîne des ancêtres avec un ensemble `visited` borné à `MAX_HIERARCHY_DEPTH = 16`. Toute auto-référence ($A \rightarrow A$) ou boucle ($A \rightarrow B \rightarrow A$) est bloquée dans l'UI et le Store.
2. **Aucun Héritage Implicite** : Une machine fille conserve sa propre `id_zone_default`, sa `id_family` et son `id_blueprint`.
3. **Agrégation KPI Parent (`computeParentCorrectiveRollup`)** : Permet de consolider sur une ligne mère (`LINE`) le nombre de pannes, les heures d'arrêt (`Downtime`) et les coûts PDR de la ligne + toutes ses machines filles (`includeSelf + children`).
4. **Détachement Propre à l'Archivage (`detachChildrenOnParentArchive`)** : Si une ligne mère est archivée (`status: 'ARCHIVEE'`), toutes ses machines filles actives voient automatiquement leur `parent_id` remis à `null` pour ne jamais dépendre d'un parent archivé.

---

## 4. Nomenclature Réelle « As-Built » (`Nexus`) vs Théorique (`Blueprint`)

Le cœur du module `NexusView.tsx` et de `src/core/domain/nexusEngine.ts` repose sur la fusion en temps réel :

$$\text{BOM As-Built Machine} = \text{machineElementsLedger} \cup \{ w \in \text{warehouseItems} \mid w.\text{statut} = \text{'MONTE'} \land w.\text{id\_machine} = M \}$$

- **Fonction SSOT** : `buildUnifiedMachineNexusElements(machineId, machineElementsLedger, warehouseItems)`.
- **Analyse d'Écart (`Gap Analysis`)** : Compare les éléments théoriques définis dans le `Blueprint` (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`) avec les éléments réellement montés sur la machine (`currentMachineElements`), et permet d'injecter en 1 clic les éléments manquants via `buildLedgerEntriesFromBlueprint`.
- **Déploiement Préventif (`applyBlueprintPlanToActiveMachines`)** : Déploie les gammes préventives théoriques d'un `Blueprint` (`preventivePlanItems`) vers toutes les machines actives liées sans créer de doublons.

---

## 5. Passeport Santé 360° & Indice de Fiabilité (`MachineHealthPassportService.ts`)

Le service `computeMachineHealthPassport` (`src/application/services/MachineHealthPassportService.ts`) calcule sur une fenêtre glissante de **12 mois** :
1. **Coût Total de Possession (`TCO 12M`)** :
   $$\text{TCO}_{12m} = \text{Coût Correctif PDR} + \text{Coût Préventif} + \text{Coût Sous-Traitance Externe}$$
2. **Score de Santé (`healthScore` sur 100)** :
   $$\text{Score} = \max\left(0,\ \min\left(100,\ 100 - (\text{Nb Pannes}_{12m} \times 12) - \lfloor \text{Heures Arrêt}_{12m} \times 1.5 \rfloor - (\text{Alertes BER} \times 15)\right)\right)$$
3. **Détection `BER` (*Beyond Economical Repair*)** : Tout organe subissant $\ge 3$ pannes correctives sur 12 mois déclenche une alerte `recurrentOrganAlerts` recommandant le remplacement complet ou le rétrofit de l'organe.

---

## 6. Gouvernance `Safe Archive` & Intégrité Référentielle (`dataIntegrityService.ts`)

1. **Suppression Protégée des Familles, Templates & Blueprints** :
   - `handleDeleteFamily`, `handleDeleteTemplate` et `handleDeleteBlueprint` vérifient l'ensemble des machines (actives **et** archivées) avant d'autoriser une suppression. Tant qu'au moins une machine ou un sous-élément y fait référence, la suppression est refusée avec un message explicite.
2. **Politique `Safe Archive` sur les Machines (`handleDeleteMachine`)** :
   - `dataIntegrityService.getMachineDependencies` inspecte 8 collections (`preventiveTasks`, `preventiveExecutions`, `correctiveInterventions`, `mouvements`, `machineElementsLedger`, `sortiesExterne`, `sortieDemands`, `warehouseItems`).
   - Si `deps.total > 0` ou si la machine possède des machines filles actives (`parentPolicy.hasActiveChildren`), la suppression physique est convertie en **Archivage Doux** (`status: 'ARCHIVEE'`, `is_active: false`), les tâches préventives futures sont suspendues, les enfants éventuels sont détachés, et un événement immuable **`MACHINE_ARCHIVED`** est inscrit dans `STORAGE_KEYS.AUDIT_EVENTS`.
