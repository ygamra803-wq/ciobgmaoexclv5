---
id: page-familles-organes
groupId: 05-entrepot-organes
groupTitle: Entrepôt Organes & Pièces Détachées
docType: page
audience: user
tabId: comp_families
title: Familles d'Organes (Niveau 2)
subtitle: Sous-catégorisation technologique rattachée au Groupe (Moteurs Triphasés, Pompes Centrifuges, Réducteurs Coaxiaux)
summary: Guide d'utilisation pour la gestion des Familles d'Organes. Présente le Niveau 2 de la taxonomie des sous-ensembles, le rattachement obligatoire au Groupe parent, le filtrage en cascade et la prévention des orphelins.
relatedTabs:
  - comp_groups
  - comp_templates
  - entrepot
---

# 📑 Guide Utilisateur : Familles d'Organes (Niveau 2)

> **Module :** Référentiel Technique & Entrepôt  
> **Identifiant d'accès :** `#comp_families`  
> **Public cible :** Responsables Méthodes, Ingénieurs Électromécaniques, Chefs d'Atelier.

---

## 1. Rôle et Objectif du Niveau 2

La **Famille d'Organes** affine la classification d'un groupe en distinguant la technologie interne, le mode d'alimentation ou le principe de fonctionnement de l'organe.

### Exemples Concrets d'Organisation :
- Au sein du Groupe `MOTEUR` :
  - `MOT-3PH` : Moteurs asynchrones triphasés (380V/400V)
  - `MOT-1PH` : Moteurs monophasés (230V)
  - `MOT-SERVO` : Servomoteurs brushless pour commandes numériques
  - `MOT-DC` : Moteurs à courant continu
- Au sein du Groupe `REDUCTEUR` :
  - `RED-COAX` : Réducteurs coaxiaux à engrenages hélicoïdaux
  - `RED-ROUE-VIS` : Réducteurs à roue et vis sans fin
  - `RED-ORTHO` : Réducteurs orthogonaux / couples coniques
- Au sein du Groupe `POMPE` :
  - `POMP-CENTRI` : Pompes centrifuges pour liquides clairs
  - `POMP-VOLUM` : Pompes volumétriques à vis ou engrenages
  - `POMP-HYDR` : Pompes à pistons haute pression pour centrales hydrauliques

---

## 2. Structure d'une Fiche Famille

1. **Identifiant Unique Système (`id_family`) :** Clé primaire immuable (ex. `FAM-MOT-3PH-001`).
2. **Groupe de Rattachement (`id_groupe`) :** Clé étrangère pointant obligatoirement vers un groupe de Niveau 1 actif.
3. **Code Famille (`code_famille` ou `code`) :** Mnémonique standard d'atelier (ex. `MOT-3PH`, `RED-COAX`).
4. **Libellé (`libelle`) :** Intitulé complet et compréhensible par tous les intervenants.
5. **Caractéristiques Techniques Spécifiques :** Liste des critères généraux applicables aux modèles de cette famille (ex. type de fixation, classe d'isolation, type de lubrification).

---

## 3. Filtrage en Cascade & Bandeau Intelligent

Lors de la consultation :
- Un sélecteur en haut de tableau permet de filtrer par **Groupe parent**.
- En sélectionnant le groupe `MOTEUR`, la liste n'affiche que les familles de moteurs, masquant immédiatement les pompes ou réducteurs.
- Un **Bandeau d'Information Violet** indique le filtre en cours avec un bouton d'effacement rapide.
- Chaque famille indique le nombre de **Modèles / Templates** enregistrés sous elle. En cliquant sur ce compteur, vous basculez automatiquement sur la liste des modèles filtrée.

---

## 4. Ajout d'une Nouvelle Famille

1. Cliquez sur **« + Nouvelle Famille »**.
2. Sélectionnez obligatoirement le **Groupe parent** dans le menu déroulant.
3. Renseignez le code court et le libellé officiel.
4. Cliquez sur **« Enregistrer »**.

---

## 5. Règle d'Intégrité Référentielle

- Une famille ne peut pas être supprimée si des modèles constructeurs (`CompTemplate`) lui sont rattachés.
- Cette protection prévient les anomalies dans le moteur d'inventaire et les plans de maintenance préventive.
