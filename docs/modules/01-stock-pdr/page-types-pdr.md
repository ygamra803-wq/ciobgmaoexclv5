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

## 1. Rôle de cet Écran

L'écran **Types PDR** représente le **premier niveau de classement** de votre magasin de pièces de rechange. Il regroupe vos articles par grandes familles technologiques homogènes, par exemple :
- **`TYP-01` — Roulements & Paliers**
- **`TYP-02` — Courroies & Transmission Mécanique**
- **`TYP-03` — Composants Électriques & Capteurs**
- **`TYP-04` — Hydraulique, Pneumatique & Joints**
- **`TYP-05` — Lubrifiants, Huiles & Consommables**

Une bonne structuration des **Types PDR** permet de filtrer le magasin en un clic et d'analyser les coûts de consommation par grande spécialité technique.

---

## 2. Fonctionnalités Clés de l'Écran

### A. Numérotation Automatique Intelligente (`TYP-XX`)
- Lorsque vous cliquez sur **« + Nouveau Type »**, l'identifiant **`TYP-XX`** est attribué automatiquement à la suite du dernier numéro existant.
- Il vous suffit de saisir le **Nom du Type** (ex. `Électromécanique`) et une courte description si nécessaire.

### B. Compteurs Croisés & Navigation Directe (`Liens Intelligents`)
Sur chaque carte ou ligne de **Type PDR**, le système affiche en temps réel :
1. **Le nombre de Désignations PDR rattachées** : Cliquez dessus pour basculer directement vers l'écran **Désignations PDR** filtré sur ce type.
2. **Le nombre d'Articles de Stock rattachés** : Cliquez dessus pour ouvrir l'écran **Stock Articles** filtré uniquement sur les pièces de cette famille.
3. **L'indicateur de Santé du Stock** : Visualisez d'un coup d'œil si ce type comporte des articles en rupture ou sous seuil critique.

### C. Ajout Rapide d'une Désignation (`Bouton +`)
Depuis la ligne d'un Type PDR, vous pouvez créer directement une nouvelle **Désignation PDR** déjà pré-rattachée à ce type sans avoir à changer d'écran.

---

## 3. Règles de Gouvernance & Sécurité des Données

- **Contrôle anti-doublon** : Le système vérifie que deux types ne portent pas le même intitulé afin d'éviter la dispersion des articles dans des catégories redondantes.
- **Intégrité référentielle avant suppression** : Si un **Type PDR** contient déjà des **Désignations** ou des **Articles en stock**, le système vous avertit avant toute suppression pour éviter de créer des articles orphelins de classification.
