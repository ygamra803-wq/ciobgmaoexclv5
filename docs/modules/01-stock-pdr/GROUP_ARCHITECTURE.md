---
id: group-01-stock-pdr-architecture
groupId: 01-stock-pdr
groupTitle: Stock PDR, Mouvements & Commandes (PO)
docType: architecture
audience: developer
title: Architecture & Logique Métier — Groupe Stock PDR, Mouvements & Commandes (PO)
summary: Référence d'ingénierie (SSOT, moteur O(1) IncrementalStockIndex, réservations Maker-Checker, cycle d'achat PO, pistes d'audit et RBAC) pour le groupe Stock & Mouvements.
relatedTabs:
  - stock
  - sortie
  - pdr_groups
  - types
  - designations
---

# Architecture & Logique Métier — Groupe 01 : Stock PDR, Mouvements & Commandes (PO)

## 1. Périmètre & Philosophie du Groupe (`PDR-GROUP-PAGE-P0`, `CATALOG-GROUP-P1` & `POLICY-TAGS-P1`)

Ce groupe constitue le cœur transactionnel et financier des **Pièces de Rechange (PDR)** et consommables industriels de **CIOB GMAO v4**. Il fédère les écrans du magasin autour d'une **hiérarchie canonique à 3 niveaux (`Group ➔ Type ➔ Designation/SKU`)** :

1. **Niveau 1 — `Groupes PDR` (`pdrGroups` / `STORAGE_KEYS.PDR_GROUPS = 'gmao_pdr_groups_v1'`)** : Domaines technologiques supérieurs (`GRP-PDR-01` Roulements & Paliers, `GRP-PDR-02` Transmission & Courroies, `GRP-PDR-03` Étanchéité & Joints, `GRP-PDR-04` Électrotechnique, `GRP-PDR-05` Hydraulique & Pneumatique, `GRP-PDR-06` Lubrifiants & Fluides, `GRP-PDR-07` Visserie & Fixation) dotés d'un `domaine_technique` (`MECANIQUE`, `ELECTRIQUE`, `HYDRAULIQUE`, `PNEUMATIQUE`, `FLUIDES_LUBRIFIANTS`, `AUTOMATISME`, `GENERAL`) et de `default_policy_tags`. Ils sont gérés via la **page de référence dédiée `PdrGroupView.tsx` (`#pdr_groups`)** ainsi que via le raccourci modal `PdrGroupsModal.tsx` depuis `StockView`, avec désactivation sécurisée (`is_active: false` via `safeDeleteOrDeactivatePdrGroup`).
2. **Niveau 2 — `Types PDR` (`stockTypes` / `STORAGE_KEYS.STOCK_TYPES = 'gmao_types_v5'`)** : Familles techniques rattachées au groupe parent via le champ canonique `id_group` (`TYP-01`..`TYP-21`), lues de manière unifiée via `getGroupId(record)` (`src/domain/stock/pdrHierarchyService.ts`) avec prise en charge du filtre `Non classé` (`UNCATEGORIZED_GROUP_FILTER`).
3. **Niveau 3 — `Articles & Désignations SKU` (`rawStock` / `STORAGE_KEYS.RAW_STOCK = 'gmao_raw_stock_v8'` & `STORAGE_KEYS.DESIGNATIONS`)** : Articles physiques identifiés par `ref` (`id`), rattachés à `id_type` et `id_group`, enrichis des attributs terrain `P2/P3` :
   - **`unite_mesure`** (`PCS`, `M`, `L`, `KG`, `JEU`, `ROULEAU`, `BOITE`)
   - **`criticite`** (`A` Vital, `B` Important, `C` Standard)
   - **`ref_constructeur`** (Part Number OEM / SKF / FAG / Schneider) & **`code_equivalents`** (références croisées multi-fournisseurs)
   - **`delai_appro_jours`** (Lead-Time d'approvisionnement en jours) & **`domaine_technique`**
   - **`policy_tags`** (`MaterialPolicyTag` : `REPLACING`, `PDR_MAGASIN`, `FABRICABLE_ATELIER`, `REPARABLE_ATELIER`, `SOUS_TRAITABLE`, `CONSOMMABLE_CRITIQUE` via `pdrHierarchyService.ts` et `policyTagsService.ts`). **Les soldes et mouvements demeurent exclusivement au niveau du SKU (`ref`).**
4. **Flux Transactionnels — `Sortie & Entrée Rapide` (`sortie` / `STORAGE_KEYS.MOUVEMENTS`, `SORTIE_DEMANDS`, `REPLENISHMENT_ORDERS`, `SORTIE_EXTERNE`)** : Journal immuable des mouvements de magasin, demandes terrain soumises au contrôle Maker-Checker, bons de sortie externes et commandes d'approvisionnement fournisseurs (`PO`).

### 1.2 Philosophie Comparative : Pourquoi `PDR`, `Components` et `Parts` ont 3 Bases de Groupes Séparées

Dans une usine industrielle, fusionner les groupes de **PDR**, d'**Organes (`Components`)** et de **Pièces d'atelier (`Parts`)** dans une table unique détruirait la sémantique métier. Le système maintient volontairement **trois clés SSOT distinctes** :

| Dimension | 1. Magasin `PDR` (`Stock PDR`) | 2. Organes Rotatifs (`Components`) | 3. Pièces Structurelles (`Parts`) |
| :--- | :--- | :--- | :--- |
| **Clé SSOT du Groupe (Niv. 1)** | `STORAGE_KEYS.PDR_GROUPS` (`gmao_pdr_groups_v1`) | `STORAGE_KEYS.COMP_GROUPS` (`gmao_comp_groups_v2`) | `STORAGE_KEYS.PART_GROUPS` (`gmao_part_groups_v1`) |
| **Page Référentielle (Niv. 1)** | `PdrGroupView.tsx` (`#pdr_groups`) | `CompGroupView.tsx` (`#comp_groups`) | `PartGroupView.tsx` (`#part_groups`) |
| **Hiérarchie Complète** | **3 Niveaux :** `PdrGroup ➔ StockType ➔ StockItem (SKU)` | **4 Niveaux :** `CompGroup ➔ CompFamily ➔ CompTemplate ➔ Entrepôt` | **4 Niveaux :** `PartGroup ➔ PartType ➔ PartDesignation ➔ Entrepôt` |
| **Nature Physique** | Articles fongibles & consommables achetés sur catalogue (roulements, joints, courroies, filtres, huiles, contacteurs). | Sous-ensembles électromécaniques complets et rotatifs ayant une identité propre (moteurs, pompes, réducteurs, variateurs). | Pièces mécaniques, d'usure ou d'usinage localisées sur la machine (arbres, flasques, engrenages, carters, bagues). |
| **Mode de Gestion** | **Quantitatif pur ($O(1)$) :** `stockActuel = stockInitial + entrées − sorties` sur `ref`. | **Cycle de vie d'état :** `Actif (Monté)` ➔ `En réparation / Bobinage` ➔ `En réserve` ➔ `Réformé`. | **Localisation & Usinage Atelier :** Suivi par plan (`ref_plan`), nuance matière (`matiere_nuance`), brut et traitement thermique. |
| **Politique & Canal Maintenance** | `REPLACING` (Remplacement standard par sortie magasin `Sortie Interne` + réapprovisionnement `PO`). | `REPAIRABLE` / `REPLACING` (Échange standard, rebobinage externe `SORT-EXT`, révision). | `REPAIRABLE` / `MODIFYING` / `REPLACING` (Fabrication `BR` ou rectification `RECT` à l'Atelier Mécanique `#corrective_atelier`). |

---

## 2. Invariant Mathématique de Stock & Moteur $O(1)$ (`IncrementalStockIndex`)

### 2.1 Règle d'Or Non-Négociable
Le stock physique actuel (`stockActuel` / `quantite`) d'un article **n'est jamais muté arbitrairement** sans trace. Il découle de l'équation fondamentale :

$$\text{Stock Actuel} = \text{Stock Initial} + \sum \text{Entrées Validées} - \sum \text{Sorties Validées}$$

- **Calculateur SSOT** : `src/application/IncrementalStockIndex.ts` et `src/application/services/StockCalculationService.ts`.
- **Complexité $O(1)$ en lecture** : `IncrementalStockIndex` maintient en mémoire une table de hachage indexée par `id_article` (`stockActuel`, `totalEntrees`, `totalSorties`, `lastEntry`, `lastExit`, `status`). Lors de l'ajout d'un mouvement via `onAddMouvement`, seul le compteur de l'article impacté est mis à jour en temps constant $O(1)$.
- **Classification des natures de mouvements** :
  - **Flux Positifs (`+ Entrée`)** : `Entrée`, `Retour` (retour magasin d'une pièce neuve non utilisée sur chantier), `Démontage` (réintégration en magasin après dépose contrôlée).
  - **Flux Négatifs (`- Sortie`)** : `Sortie` (affectée à une machine/zone/technicien), `Consommation` (consommable d'atelier sans affectation machine obligatoire).

### 2.2 Stock Disponible vs Stock Réservé (Maker-Checker `VAL-1..VAL-5`)
Lorsqu'un intervenant terrain (`OPERATOR` ou `TECHNICIAN`) enregistre une consommation PDR dans un Bon de Travail (`BT`), une exécution préventive ou une **Demande de Sortie Terrain** (`SortieDemand` au statut `PENDING_VALIDATION`), le stock physique (`stockActuel`) **n'est pas immédiatement débité**.

Pour éviter les doubles réservations ou les ruptures silencieuses avant validation par le Responsable Maintenance, le service `src/utils/stockReplenishmentUtils.ts` calcule :

1. **`computeReservedStockMap(workOrders, preventiveExecutions, sortieDemands)`** : Agrège toutes les quantités engagées dans des dossiers `PENDING_VALIDATION` (hors demandes déjà réconciliées via `reconciledMovementIds`).
2. **`stockDisponible = Math.max(0, stockActuel - stockReserve)`** : C'est ce **Stock Disponible net** qui déclenche les alertes de réapprovisionnement dès que $\text{stockDisponible} \le \text{seuil\_minimum}$.

---

## 3. Cycle d'Achat & Réapprovisionnement (`ReplenishmentOrder` / `PO`)

### 3.1 Formule de Quantité Suggérée
Dans `computeStockReorderAlerts(stock, reservedMap)` (`src/utils/stockReplenishmentUtils.ts`), tout article vérifiant `stockDisponible <= seuilMin` génère une alerte classée en :
- **`RUPTURE`** si `stockDisponible <= 0`
- **`SEUIL_ATTEINT`** si `0 < stockDisponible <= seuilMin`

La quantité recommandée à commander est :

$$\text{suggestedOrderQty} = \max\left(1,\ (\text{seuilMin} \times 2) - \text{stockDisponible}\right)$$

### 3.2 Machine à États Finis (FSM) des Commandes `PO`
Les commandes d'achat (`STORAGE_KEYS.REPLENISHMENT_ORDERS`) suivent le cycle strict :

```text
DEMANDE ➔ COMMANDE ➔ RECU_PARTIEL ➔ RECU_CONFORME
   │          │
   └──────────┴────➔ ANNULE
```

### 3.3 Garde-Fous de Réception (`handleReceiveReplenishmentOrder` dans `useGmaoStore.ts`)
- **Idempotence & Blocage de Double Réception** : Toute tentative de réception sur une commande déjà au statut `RECU_CONFORME` ou `ANNULE` est rejetée immédiatement.
- **Plafonnement Strict (`Clamping`)** : Pour chaque ligne `line`, la quantité reçue à cet arrivage est bornée par le reliquat restant à livrer :
  $$\text{acceptedNow} = \min\left(\text{receivedNow},\ \max(0,\ \text{requestedQty} - \text{alreadyReceivedQty})\right)$$
- **Génération Automatique de Mouvements `Entrée`** : Chaque ligne où `acceptedNow > 0` génère automatiquement un mouvement magasin `type_mouvement: 'Entrée'` avec motif `[PO ${orderNumber}] Réception commande (${supplierName})`, incrémentant instantanément `IncrementalStockIndex`.

---

## 4. Réconciliation Maker-Checker des Demandes de Sortie Terrain (`SortieDemand`)

Dans `SortieRapideView.tsx`, l'atelier fonctionne selon deux profils opérationnels :
- **Mode Magasinier / Superviseur (`Intervenant`)** : Enregistre directement un mouvement `Sortie` / `Entrée` définitif ou traite une demande terrain existante.
- **Mode Terrain (`Demandeur`)** : Crée une `SortieDemand` (`DEM-XXXX`) qui attend validation.

Lorsque le magasinier clique sur **« Traiter / Servir »** sur une demande terrain ou lorsqu'un responsable valide la demande dans le **Centre de Validation** (`src/utils/validationReconciliation.ts`) :
1. Le système vérifie la suffisance du stock article par article avant d'écrire quoi que ce soit (**validation transactionnelle tout-ou-rien**).
2. Les mouvements `Sortie` correspondants sont créés avec la référence de traçabilité `reconciledMovementIds`.
3. La demande passe à `APPROVED` sans aucun risque de double déduction.

---

## 5. Sécurité RBAC & Journal d'Audit Immuable (`AUDIT_EVENTS`)

### 5.1 Matrice des Permissions (`AuthorizationService.tsx` & `serverRbacPolicy.ts`)

| Action / Ressource | `OPERATOR` | `TECHNICIAN` | `MANAGER` | `ADMIN` |
| :--- | :---: | :---: | :---: | :---: |
| Consultation du Stock (`stock.view`) | Non (sauf saisie terrain) | Oui | Oui | Oui |
| Création / Édition d'Article (`stock.edit`) | Non | Non | **Oui** | **Oui** |
| Suppression d'Article (`stock.delete`) | Non | Non | **Oui** | **Oui** |
| Saisie de Demande / Mouvement (`movement.create`) | **Oui** (Demande) | **Oui** | **Oui** | **Oui** |
| Approbation PO & Réception (`validation.approve`) | Non | Non | **Oui** | **Oui** |

### 5.2 Événements Tracés dans `STORAGE_KEYS.AUDIT_EVENTS` (`AuditService.recordEvent`)
Toutes les mutations critiques de ce groupe inscrivent un événement horodaté Append-Only avec l'état `before` et `after` :
- **`STOCK_INITIAL_CHANGED`** : Modification du stock initial (`stock_initial`) d'un article dans `EditArticleModal`.
- **`STOCK_PRICE_CHANGED`** : Modification du prix unitaire (`prix_unitaire` MAD) d'un article.
- **`PO_CREATED`** : Création d'une demande d'approvisionnement (`DA` / `PO`).
- **`PO_STATUS_CHANGED`** : Passage en commandé, réception partielle, réception conforme ou annulation.
- **`VALIDATION_APPROVED` / `VALIDATION_REJECTED`** : Décision Maker-Checker sur une `SortieDemand`.

---

## 6. Cartographie des Fichiers Sources du Groupe

| Fichier | Rôle Architectural |
| :--- | :--- |
| `src/presentation/pages/stock/StockView.tsx` | Vue principale du magasin PDR, filtres cascadés `Group ➔ Type ➔ SKU` (+ `Non classé`), colonnes terrain `P2/P3` (`unite_mesure`, `criticite`, `ref_constructeur`, `delai_appro_jours`, `code_equivalents`), import/export Excel 3 feuilles, KPIs de valorisation et modales associées. |
| `src/presentation/pages/referentiel/PdrGroupView.tsx` | **Page dédiée de Niveau 1 (`#pdr_groups`)** : gestion complète du référentiel `Groupes PDR` (`GRP-PDR-XX`), filtre `domaine_technique`, affectation des `default_policy_tags`, compteurs croisés (`Types`, `Articles`) et désactivation sécurisée via `safeDeleteOrDeactivatePdrGroup`. |
| `src/presentation/pages/stock/components/PdrGroupsModal.tsx` | Raccourci modal depuis `StockView` partageant la même logique métier (`safeDeleteOrDeactivatePdrGroup`) que `PdrGroupView.tsx`. |
| `src/domain/stock/pdrHierarchyService.ts` | Résolution hiérarchique (`resolvePdrHierarchy`), lecteurs unifiés `getGroupId` / `getGroupRecordId`, héritage des `policy_tags` (`getEffectivePdrPolicyTags`) et gardes de suppression/désactivation (`safeDeleteOrDeactivatePdrGroup`). |
| `src/services/pdrHierarchyExcelService.ts` & `src/services/pdr/types/pdrExcelTypes.ts` | Moteur d'import/export Excel 3 feuilles (`PDR_GROUPS`, `PDR_TYPES`, `PDR_ITEMS`) prenant en charge tous les champs `P2/P3` avec modes `MERGE` et `REPLACE_CATALOG` et validation stricte sans perte silencieuse. |
| `src/presentation/pages/stock/components/StockReplenishmentModal.tsx` | Centre de réapprovisionnement & commandes `PO` (sélection d'alertes, création de PO, réception partielle/totale, impression BC). |
| `src/presentation/pages/stock/AddArticleModal.tsx` & `EditArticleModal.tsx` | Création et édition d'article avec sélection cascadée `Group ➔ Type`, champs `P2/P3` (`unite_mesure`, `criticite`, `ref_constructeur`, `code_equivalents`, `delai_appro_jours`, `domaine_technique`), tags `MaterialPolicyTag`, contrôle de doublon `ref` et `prix_unitaire` (MAD). |
| `src/presentation/pages/movements/SortieRapideView.tsx` | Guichet opérationnel des 5 flux magasin, Demandes de Sortie Terrain, Bons de Sortie Externes, Vue Scindée et Assistant Wizard. |
| `src/presentation/pages/referentiel/TypeView.tsx` | Gestion du référentiel `Types PDR` (`TYP-XX`) rattachés à `id_group` (+ filtre `Non classé`) avec compteurs croisés Désignations/Articles. |
| `src/presentation/pages/referentiel/DesignationView.tsx` | Gestion du référentiel `Désignations PDR` avec filtre par Groupe/Type, préfixes intelligents et raccourcis vers Stock & Mouvements. |
| `src/application/IncrementalStockIndex.ts` | Moteur de calcul incrémental $O(1)$ des quantités en stock et derniers mouvements par `ref`. |
| `src/utils/stockReplenishmentUtils.ts` | Calcul pur des réservations Maker-Checker (`computeReservedStockMap`) et des alertes de réapprovisionnement (`computeStockReorderAlerts`). |
