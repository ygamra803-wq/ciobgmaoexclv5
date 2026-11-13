---
id: page-groupes-pdr
groupId: 01-stock-pdr
groupTitle: Stock PDR, Mouvements & Commandes (PO)
docType: page
audience: user
tabId: pdr_groups
title: Référentiel des Groupes PDR (Niveau 1)
subtitle: Classification technologique supérieure du magasin de pièces de rechange consommables
summary: Guide d'utilisation de l'écran Groupes PDR (PdrGroupView.tsx — #pdr_groups), Niveau 1 de la hiérarchie Group ➔ Type ➔ Désignation/SKU avec domaine technique, politique REPLACING et désactivation sécurisée.
relatedTabs:
  - types
  - designations
  - stock
---

# Référentiel des Groupes PDR (`Niveau 1 — #pdr_groups`)

## 1. Rôle & Philosophie Industrielle (`Groupes PDR` vs `Groupes Composants` vs `Groupes Parts`)

L'écran **Groupes PDR** (`PdrGroupView.tsx`) constitue le **premier niveau de classement** du magasin des **Pièces de Rechange consommables (`PDR`)** (`STORAGE_KEYS.PDR_GROUPS = 'gmao_pdr_groups_v1'`).

Dans la philosophie de **CIOB GMAO Nexus v5.0.2**, les trois familles de groupes sont **strictement indépendantes** (trois bases de données distinctes) car elles gouvernent trois réalités physiques différentes sur le terrain :

| Référentiel de Groupe | Clé SSOT | Ce qu'il classe | Politique & Flux Naturels |
| :--- | :--- | :--- | :--- |
| **1. `Groupes PDR`** (`#pdr_groups`) | `gmao_pdr_groups_v1` | **Consommables & Pièces fongibles de magasin** (roulements standard, courroies, joints, filtres, contacteurs, huiles). | **`REPLACING`** uniquement — Gérés par quantité mathématique (`stockActuel = stockInitial + entrées − sorties`), commandés via **Achats (`PO`)** et consommés par **Sortie Magasin**. |
| **2. `Groupes Composants`** (`#comp_groups`) | `gmao_comp_groups_v2` | **Organes complets rotatifs & sous-ensembles réparables** (moteurs électriques, réducteurs, pompes, variateurs). | **`REPAIRABLE` / `REPLACING`** — Suivis individuellement par **état de cycle de vie** (`En service`, `En stock`, `En révision / Rebobinage`, `Réformé`) et indice d'usure `BER`. |
| **3. `Groupes Parts`** (`#part_groups`) | `gmao_part_groups_v1` | **Pièces mécaniques d'atelier & organes structurels** (arbres usinés, flasques, engrenages, vérins, brides). | **`REPAIRABLE` / `MODIFYING` / `REPLACING`** — Peuvent être **usinés ou rectifiés à l'Atelier Mécanique (`BR / RECT`)** avec plan (`ref_plan`), nuance matière (`matiere_nuance`), brut (`dimensions_brut`) et traitement thermique (`traitement_thermique`). |

---

## 2. Structure d'un Groupe PDR

Chaque groupe PDR structure un domaine technologique du magasin :
1. **Identifiant Canonique (`id` / `id_group`)** : Clé technique normalisée (ex. `GRP-ROUL`, `GRP-ETAN`, `GRP-TRAN`, `GRP-HYDR`, `GRP-ELEC`, `GRP-FIXA`, `GRP-DIV`).
2. **Code Mnémonique (`code`)** : Code court affiché dans les badges de `StockView` et `TypeView` (ex. `ROUL`, `ETAN`, `HYDR`, `ELEC`).
3. **Domaine Technique (`domaine_technique` — P3)** : Spécialité métier (`MECANIQUE`, `ELECTRIQUE`, `HYDRAULIQUE`, `PNEUMATIQUE`, `AUTOMATISME`, `LUBRIFIANTS`, `CONSOMMABLES`). Ce domaine est automatiquement hérité par les **Types PDR** et les **Articles en Stock** rattachés lorsqu'ils ne définissent pas de domaine spécifique.
4. **Politique par Défaut (`default_policy_tags`)** : Verrouillée sur **`REPLACING`** pour garantir qu'aucun consommable PDR ne soit routé par erreur vers l'atelier d'usinage.
5. **Ordre de Tri (`sort_order`) & Statut (`is_active`)** : Contrôle l'ordre d'affichage dans les listes déroulantes et permet d'archiver proprement un groupe sans perdre l'historique.

---

## 3. Navigation Croisée & Compteurs Temps Réel

Dans la grille **Groupes PDR** :
- **Compteur « X Types »** : Affiche le nombre de `Types PDR` rattachés (`type.id_group === group.id`). Un clic ouvre directement l'écran **Types PDR (`#types`)** pré-filtré sur ce groupe.
- **Compteur « Y Articles »** : Affiche le nombre total de références SKU en stock appartenant à ce groupe. Un clic ouvre directement **Stock Articles (`#stock`)** filtré sur ce groupe.
- **Indicateur de Santé** : Signale immédiatement le nombre d'articles en `RUPTURE` ou `ALERTE` au sein du groupe.

---

## 4. Règle de Désactivation Sécurisée (`Safe Archive vs Hard Delete`)

La suppression d'un groupe PDR est protégée par `safeDeleteOrDeactivatePdrGroup` (`src/domain/stock/pdrHierarchyService.ts`) :
- **Groupe vide (`0` type et `0` article rattaché)** : Suppression définitive autorisée (`DELETED`).
- **Groupe contenant des types ou des articles** : La suppression physique est bloquée pour interdire tout orphelin ; le système bascule automatiquement le groupe en **Désactivation sécurisée (`is_active: false` — `DEACTIVATED`)**. Les articles existants conservent leur classification historique tandis que le groupe désactivé n'est plus proposé lors des nouvelles créations.
