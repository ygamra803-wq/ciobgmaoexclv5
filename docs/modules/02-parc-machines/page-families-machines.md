---
id: page-families-machines
groupId: 02-parc-machines
groupTitle: Parc Machines, Blueprints & Architecture 3-Tiers
docType: page
audience: user
tabId: families
title: Familles de Machines (Tier 1 — Niveau A)
subtitle: Classification macroscopique du parc d'équipements de production (FAM-XX)
summary: Guide opérationnel pour structurer les grandes familles technologiques de machines (FAM-01, FAM-02...) et naviguer vers leurs modèles (Templates) et équipements actifs.
relatedTabs:
  - templates
  - machines
  - blueprints
---

# Référentiel des Familles de Machines (`Classification Tier 1 — Niveau A`)

## 1. Rôle de cet Écran

L'écran **Familles de Machines** constitue le sommet de la pyramide de classification de vos équipements de production (**Tier 1**). Il regroupe vos machines par métier ou procédé industriel homogène, par exemple :
- **`FAM-01` — Rectifieuses & Usinage de Précision**
- **`FAM-02` — Presses Hydrauliques & Formage**
- **`FAM-03` — Fours de Traitement Thermique**
- **`FAM-04` — Lignes de Conditionnement & Emballage**

---

## 2. Fonctionnalités Clés de l'Écran

### A. Codification Séquentielle Automatique (`FAM-XX`)
1. Cliquez sur le bouton rond **« + Nouvelle Famille »** en haut à droite.
2. Le sélecteur intelligent **`SequentialCodePicker`** vous propose automatiquement le prochain code libre (ex. `FAM-05`) tout en vous montrant les numéros déjà réservés.
3. Saisissez le **Libellé de la Famille** et validez.

### B. Compteurs Dynamiques & Navigation Croisée (Colonnes `D` et `E`)
Chaque ligne du tableau calcule en temps réel deux compteurs interactifs :
- **Colonne D (`Nb Templates`)** : Nombre de modèles constructeurs rattachés à cette famille. Cliquez sur le badge bleu pour ouvrir directement l'écran **Modèles (Templates)** pré-filtré sur cette famille.
- **Colonne E (`Nb Machines`)** : Nombre de machines physiques enregistrées dans l'atelier sous cette famille. Cliquez sur le badge vert pour ouvrir le **Parc Machines** filtré sur cette famille.

### C. Création Rapide d'un Modèle Constructeur (`Bouton + Template`)
Dans la colonne d'actions (`•••`) de chaque famille :
- Le premier bouton d'action rapide ouvre directement la fenêtre de création d'un **Nouveau Template** déjà rattaché à cette famille `FAM-XX`, vous faisant gagner plusieurs clics lors de l'initialisation d'un nouvel atelier.

---

## 3. Protection Intégrale Contre les Orphelins

- **Suppression contrôlée** : Tant qu'une famille est utilisée par au moins un **Template**, un **Blueprint** ou une **Machine** (même archivée), le système refuse sa suppression et vous indique le nombre exact d'éléments liés.
- **Mise à jour en cascade** : Toute modification du libellé d'une famille se répercute instantanément sur les écrans **Machines Enregistrées**, **Templates** et **Blueprints**.
