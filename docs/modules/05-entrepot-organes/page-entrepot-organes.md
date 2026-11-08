---
id: page-entrepot-organes
groupId: 05-entrepot-organes
groupTitle: Entrepôt Organes & Pièces Détachées
docType: page
audience: user
tabId: entrepot
title: Entrepôt Organes & Pièces Détachées
subtitle: Gestion du parc d'organes rotatifs et blocs complets, statut opérationnel, montage sur machines et suivi d'usure
summary: Guide opérationnel complet pour l'écran Entrepôt. Couvre la double vue Composants / Pièces, l'attribution sur machine, les mouvements rapides, le suivi des états (Disponible, Installé, En Réparation) et l'indice de santé.
relatedTabs:
  - comp_groups
  - comp_families
  - comp_templates
  - part_types
  - part_designations
  - machines
  - nexus
---

# 📦 Guide Utilisateur : Entrepôt Organes & Pièces Détachées

> **Module :** Entrepôt Organes & Pièces  
> **Identifiant d'accès :** `#entrepot`  
> **Public cible :** Magasiniers industriels, Techniciens de maintenance, Chefs d'atelier et Responsables Méthodes.

---

## 1. Rôle et Objectif de l'Écran

L'écran **Entrepôt Organes & Pièces** est dédié à la gestion des ensembles électromécaniques stratégiques de l'usine (moteurs, réducteurs, motopompes, variateurs, vérins) ainsi que des pièces de rechange mécaniques lourdes.

Contrairement aux petites pièces fongibles du magasin général (vis, joints, roulements), les organes stockés ici :
- Sont interchangeables et réutilisables après réparation.
- Possèdent un cycle de vie individuel : neuf ➔ monté sur machine ➔ démonté pour panne ➔ rebobiné / révisé ➔ remis en stock disponible.
- Participent à la nomenclature réelle des machines (`Nexus BOM`).

---

## 2. Double Vue : Organes Complets vs Pièces Détachées

L'écran propose deux onglets principaux en haut de page :

1. **Onglet « Organes / Sous-Ensembles » (Composants complets) :**
   - Présente tous les équipements rotatifs et actionneurs.
   - Colonnes : Code Organe, Numéro de Série, Modèle / Template, Spécifications techniques (puissance kW, vitesse tr/min, tension), Emplacement en rayon, Statut d'activité, Machine rattachée (le cas échéant), Indice d'usure.
2. **Onglet « Pièces de Structure / Détachées » :**
   - Présente les pièces mécaniques élémentaires (carters, flasques, arbres, engrenages, clavettes spécifiques).
   - Liées aux types et désignations de pièces.

---

## 3. Comprendre les Statuts Opérationnels d'un Organe

Chaque organe porte un badge de statut visuel explicite :

- 🟢 **DISPONIBLE (En Stock) :** L'organe est révisé, testé et prêt à être installé immédiatement en cas d'urgence de production.
- 🔵 **INSTALLÉ (En Service) :** L'organe est monté sur une machine active. Son code machine est affiché sous forme de lien cliquable vers le passeport santé de l'équipement.
- 🟠 **EN RÉPARATION / BOBINAGE :** L'organe est actuellement démonté et subit une intervention corrective ou a été confié à un atelier spécialisé externe.
- ⚫ **RÉFORMÉ :** L'organe a atteint sa fin de vie technique (dépassement du seuil de rentabilité de réparation) et est archivé.

---

## 4. Procédure Pas-à-Pas : Enregistrer un Nouvel Organe

1. Cliquez sur le bouton principal **« + Nouvel Organe »** en haut à droite.
2. Renseignez les informations de la fiche :
   - **Famille & Modèle (Template) :** Sélectionnez le modèle dans la liste. Les spécifications techniques (puissance, tr/min, ampérage, constructeur) sont immédiatement importées automatiquement.
   - **Numéro de Série Constructeur (N° Série) :** Indispensable pour la traçabilité unitaire de la machine tournante.
   - **Emplacement en Entrepôt :** Indiquez le rayon, l'allée ou l'étagère (ex. `Magasin Élec - Rayon B-03`).
   - **Quantité / Stock Initial :** Généralement 1 pour un organe unitaire sérialisé.
   - **Seuil d'Alerte :** Quantité minimale de sécurité avant déclenchement d'un réapprovisionnement.
   - **Machine de Rattachement (Optionnel) :** Si l'organe est déjà physiquement en place sur une machine lors de la saisie initiale, sélectionnez la machine cible.
3. Validez en cliquant sur **« Enregistrer »**.

---

## 5. Montage et Démontage Rapide sur Machine

Lors d'un dépannage ou d'un échange standard :

1. Repérez l'organe disponible dans la liste.
2. Cliquez sur l'icône d'action **« Installer sur Machine »** (icône ⚙️).
3. Choisissez la machine de destination dans la liste déroulante des machines actives de l'atelier.
4. Confirmez :
   - Le statut passe instantanément à `INSTALLÉ`.
   - L'organe est rattaché à l'arborescence Nexus de la machine.
   - Le stock disponible en entrepôt est actualisé en temps réel.
5. Pour démonter un organe usé :
   - Cliquez sur **« Démonter »** : choisissez si l'organe retourne en stock disponible ou part en réparation/rebobinage.

---

## 6. Score d'Usure & Santé Composant

La colonne **Santé / Usure** applique un code couleur prédictif :
- **0 à 25% (Vert) :** Organe neuf ou récemment révisé à haut niveau de fiabilité.
- **26 à 60% (Bleu/Jaune) :** Usure normale d'exploitation.
- **61 à 85% (Orange) :** Équipement à surveiller lors des prochaines rondes préventives.
- **> 85% (Rouge) :** Risque élevé de défaillance imminente ou historique de rebobinages excessifs ; prévoir un organe de secours prêt en rayon.
