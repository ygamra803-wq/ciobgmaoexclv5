---
id: page-types-pieces
groupId: 05-entrepot-organes
groupTitle: Entrepôt Organes & Pièces Détachées
docType: page
audience: user
tabId: part_types
title: Types de Pièces Détachées
subtitle: Catégorisation technique des composants élémentaires et pièces d'usure (Carters, Arbres, Flasques, Engrenages)
summary: Guide d'utilisation pour la gestion des Types de Pièces Détachées. Présente la classification structurelle des pièces mécaniques et électriques ne constituant pas un organe autonome, et leur liaison avec l'Entrepôt.
relatedTabs:
  - part_designations
  - entrepot
  - comp_groups
---

# 🏷️ Guide Utilisateur : Types de Pièces Détachées

> **Module :** Référentiel Technique & Entrepôt  
> **Identifiant d'accès :** `#part_types`  
> **Public cible :** Magasiniers industriels, Techniciens d'usinage, Mécaniciens de maintenance.

---

## 1. Rôle et Objectif

L'écran **Types de Pièces Détachées** assure la classification des pièces mécaniques, électriques et structurelles élémentaires qui composent les organes ou les machines, mais qui ne sont pas des ensembles rotatifs complets :

- `CARTER` : Corps de réducteurs, carters de pompes, boîtiers d'engrenages.
- `ARBRE` : Arbres de transmission, arbres cannelés, axes d'entraînement.
- `FLASQUE` : Flasques avant/arrière de fixation (B5, B14), flasques paliers.
- `ENGRENAGE` : Pignons droits, roues dentées hélicoïdales, couronnes.
- `VENTILATEUR` : Hélices de refroidissement moteur et capots d'aération.
- `TAMPON` : Raccords élastiques et flectors d'accouplement.

---

## 2. Structure d'un Type de Pièce

Chaque enregistrement comprend :
1. **Identifiant Unique Système (`id_type`) :** Code court standardisé (ex. `CARTER`, `ARBRE`, `ENGRENAGE`).
2. **Libellé Complet (`libelle`) :** Intitulé en français (ex. *« Arbres de Transmission et Pignons Intégrés »*).
3. **Domaine Mécanique :** Catégorisation interne permettant de regrouper les familles d'usinage.

---

## 3. Interaction avec les Désignations et le Stock

Dans le tableau des types de pièces :
- Chaque type affiche le **nombre de désignations associées** (`X Désignations`).
- En cliquant sur l'action de navigation rapide, vous basculez instantanément vers l'écran **Désignations de Pièces (`#part_designations`)** pré-filtré sur ce type précis.
- Un lien direct vers l'**Entrepôt (Onglet Pièces)** permet de visualiser en un coup d'œil l'ensemble des articles physiques stockés sous ce type de pièce.

---

## 4. Ajout d'un Nouveau Type de Pièce

1. Cliquez sur le bouton principal **« + Nouveau Type de Pièce »**.
2. Saisissez l'identifiant court (en lettres majuscules sans espaces, ex. `POULIE_CRANTEE`).
3. Saisissez la désignation explicite.
4. Cliquez sur **« Enregistrer »**.

---

## 5. Règle d'Intégrité Référentielle

- Un type de pièce ne peut pas être supprimé s'il possède encore des désignations de pièces ou des articles physiques enregistrés dans l'entrepôt.
- Cette protection prévient toute rupture de cohérence dans les inventaires de pièces d'usure.
