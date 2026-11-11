---
id: page-types-pdr
groupId: 01-stock-pdr
groupTitle: Stock PDR, Mouvements & Commandes (PO)
docType: page
audience: user
tabId: types
title: Référentiel des Types PDR
subtitle: Classification principale des familles d'articles du magasin (Niveau 1)
summary: Guide d'utilisation du référentiel des Types PDR (TYP-XX) permettant de structurer le magasin par grandes spécialités techniques.
relatedTabs:
  - designations
  - stock
---

# Référentiel des Types PDR (`Classification Niveau 1`)

## 1. Rôle de cet Écran (`Hiérarchie Groupe ➔ Type ➔ Désignation/SKU`)

L'écran **Types PDR** représente le **deuxième niveau de classement** de votre magasin de pièces de rechange, directement rattaché à un **Groupe PDR parent (`id_group`)** (`GRP-PDR-01` à `GRP-PDR-07`). Il structure chaque grand domaine technologique en familles techniques précises, par exemple :
- Sous **`GRP-PDR-01` (Roulements & Paliers)** : `TYP-01` Roulements rigides à billes, `TYP-02` Roulements à rouleaux coniques, `TYP-03` Paliers auto-aligneurs.
- Sous **`GRP-PDR-02` (Transmission & Courroies)** : `TYP-04` Courroies trapézoïdales, `TYP-05` Chaînes à rouleaux, `TYP-06` Accouplements élastiques.
- Sous **`GRP-PDR-04` (Électrotechnique & Automatisme)** : `TYP-10` Contacteurs & Relais, `TYP-11` Disjoncteurs & Fusibles, `TYP-12` Capteurs inductifs & cellules.

Une bonne structuration **Groupe PDR ➔ Type PDR** permet de filtrer le magasin en cascade et d'hériter automatiquement des politiques matérielles (`MaterialPolicyTag`).

---

## 2. Fonctionnalités Clés de l'Écran

### A. Rattachement au Groupe Parent (`id_group`) & Numérotation (`TYP-XX`)
- Lorsque vous cliquez sur **« + Nouveau Type »**, l'identifiant **`TYP-XX`** est attribué automatiquement et vous sélectionnez son **Groupe PDR parent** (`id_group`).
- Un filtre par **Groupe PDR** (incluant l'option **`Non classé`**) permet d'isoler immédiatement les types d'un domaine technologique ou de gérer les groupes via le bouton **« Groupes PDR »**.

### B. Compteurs Croisés & Navigation Directe (`Liens Intelligents`)
Sur chaque carte ou ligne de **Type PDR**, le système affiche en temps réel :
1. **Le badge du Groupe PDR parent** : Indique le domaine technologique auquel appartient le type.
2. **Le nombre de Désignations / Articles de Stock rattachés** : Cliquez dessus pour basculer directement vers l'écran **Désignations PDR** ou **Stock Articles** filtré sur ce type.
3. **L'indicateur de Santé du Stock** : Visualisez d'un coup d'œil si ce type comporte des articles en rupture ou sous seuil critique.

### C. Ajout Rapide d'une Désignation (`Bouton +`)
Depuis la ligne d'un Type PDR, vous pouvez créer directement une nouvelle **Désignation PDR** déjà pré-rattachée à ce type et à son groupe parent sans avoir à changer d'écran.

---

## 3. Règles de Gouvernance & Sécurité des Données

- **Cohérence Groupe ➔ Type** : Toute modification du `id_group` d'un Type PDR propage proprement le nouveau groupe aux articles rattachés afin de maintenir l'invariant `item.id_group === type.id_group`.
- **Désactivation sécurisée avant suppression** : Si un **Type PDR** contient déjà des **Articles en stock**, `canDeactivateOrDeletePdrType` empêche la suppression destructive pour éviter de créer des articles orphelins.
