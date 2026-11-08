---
id: page-user-zones
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: page
audience: user
tabId: zones
title: Zones Géographiques & Ateliers d'Usine
subtitle: Cadastre physique de l'usine, découpage par atelier, affectation des équipes et cartographie des machines
summary: Guide d'utilisation pour la gestion des Zones et Ateliers. Explique le découpage spatial de l'usine, le rattachement des machines et techniciens de quart, la navigation croisée et les règles de suppression sécurisée.
relatedTabs:
  - machines
  - utilisateurs
  - entrepot
---

# 🗺️ Guide Utilisateur : Zones & Ateliers d'Usine (`#zones`)

> **Module :** Pilotage & Gouvernance  
> **Identifiant d'accès :** `#zones`  
> **Public cible :** Chefs d'Atelier, Responsables de Production, Ingénieurs Sécurité et Maintenance.

---

## 1. Rôle et Objectif du Référentiel Spatial

L'écran **Zones & Ateliers** structure l'organisation géographique de l'usine.

Chaque machine de production, chaque organe en stock et chaque technicien de quart est rattaché à une zone physique précise. Ce découpage permet :
- D'affecter automatiquement les techniciens aux pannes survenant dans leur secteur.
- De filtrer les listes de machines lors de la déclaration d'une urgence sans devoir faire défiler des centaines d'équipements.
- D'analyser les coûts de maintenance et les temps d'arrêt par atelier (ex. *combien a coûté l'atelier Finition ce mois-ci par rapport au Laminoir ?*).

---

## 2. Typologie des Zones d'Usine

Le système classe les zones selon 4 catégories d'exploitation :

1. 🏭 **PRODUCTION :** Halles principales abritant les lignes de fabrication continues (ex. *Halle de Laminage*, *Ligne d'Extrusion*, *Atelier de Découpe*).
2. ⚡ **UTILITÉS GÉNÉRALES :** Locaux techniques alimentant l'usine (ex. *Centrale d'Air Comprimé*, *Poste Haute Tension*, *Chaufferie*, *Traitement des Eaux*).
3. 📦 **FINITION & CONDITIONNEMENT :** Zones d'emballage, palettisation, contrôle qualité final et expédition.
4. 🏪 **MAGASIN & STOCKAGE :** Rayonnages de pièces de rechange (PDR), parc à ferraille, et entrepôt des moteurs de secours.

---

## 3. Navigation Croisée Intelligente

Sur chaque ligne de zone dans le tableau :
- Un badge cliquable affiche le **nombre de machines implantées** (ex. `12 Machines`). En cliquant dessus, vous accédez directement au parc machines pré-filtré sur cet atelier.
- Un badge affiche le **nombre de techniciens affectés** à la zone, facilitant l'équilibrage des effectifs de maintenance entre les secteurs.

---

## 4. Procédure : Créer une Nouvelle Zone

1. Cliquez sur le bouton principal **« + Nouvelle Zone »** en haut à droite.
2. Renseignez les informations :
   - **Code Zone :** Mnémonique court en majuscules (ex. `Z-PROD-03`).
   - **Libellé de l'Atelier :** Désignation officielle (ex. *« Atelier de Traitement Thermique »*).
   - **Type d'Activité :** Sélectionnez Production, Utilités, Finition ou Magasin.
   - **Consignes et Description :** Indiquez les consignes de sécurité spécifiques (EPI obligatoires, risques particuliers, accès réservé).
3. Cliquez sur **« Enregistrer »**.

---

## 5. Règle de Sécurité : Interdiction de Supprimer une Zone Occupée

Pour éviter de créer des « machines fantômes » sans localisation dans l'usine :
- Il est **impossible de supprimer une zone tant qu'elle contient au moins une machine active, un technicien ou un organe en stock**.
- Si vous tentez de la supprimer, un message d'avertissement jaune apparaît :  
  *« Suppression refusée : la zone contient des machines ou techniciens actifs. Réaffectez-les d'abord. »*
- Vous devez préalablement réaffecter les machines et personnels vers une autre zone avant de pouvoir supprimer l'ancien emplacement.
