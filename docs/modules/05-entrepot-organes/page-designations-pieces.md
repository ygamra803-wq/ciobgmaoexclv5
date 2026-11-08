---
id: page-designations-pieces
groupId: 05-entrepot-organes
groupTitle: Entrepôt Organes & Pièces Détachées
docType: page
audience: user
tabId: part_designations
title: Désignations de Pièces Détachées
subtitle: Répertoire normatif des références élémentaires, dimensions précises et spécifications matière
summary: Guide d'utilisation pour la gestion des Désignations de Pièces Détachées. Présente le catalogue détaillé des références de pièces d'usure, le rattachement aux Types de Pièces et l'approvisionnement en stock.
relatedTabs:
  - part_types
  - entrepot
  - comp_templates
---

# 📝 Guide Utilisateur : Désignations de Pièces Détachées

> **Module :** Référentiel Technique & Entrepôt  
> **Identifiant d'accès :** `#part_designations`  
> **Public cible :** Magasiniers industriels, Responsables des achats techniques, Mécaniciens de maintenance.

---

## 1. Rôle et Objectif

L'écran **Désignations de Pièces Détachées** constitue le répertoire précis et normalisé des pièces mécaniques et électriques élémentaires.

Alors que le *Type de Pièce* définit la catégorie générale (ex. `ARBRE`), la *Désignation de Pièce* précise les dimensions, le matériau et la référence exacte :
- `ARBRE-CAN-D35-L250` : Arbre cannelé diamètre 35 mm, longueur 250 mm, acier traité 42CrMo4.
- `FLASQUE-B5-M200` : Flasque de fixation B5 diamètre extérieur 200 mm pour carcasse moteur 90L.
- `ENGRENAGE-M2-Z32` : Pignon droit module 2, 32 dents, alésage 25 mm avec rainure de clavette.

Ce catalogue normalisé évite les saisies anarchiques ou les doublons lors des réapprovisionnements en usinage ou commandes externes.

---

## 2. Structure d'une Fiche de Désignation

Chaque enregistrement comprend :
1. **Identifiant Unique Système (`id_designation`) :** Clé primaire immuable (ex. `DES-ARB-0042`).
2. **Type de Pièce Associé (`id_type`) :** Lien obligatoire vers un type de pièce existant (`ARBRE`, `FLASQUE`, etc.).
3. **Libellé Technique Complet :** Description exhaustive comprenant les cotes dimensionnelles critiques.
4. **Matière / Traitement Thermique (Optionnel) :** Acier trempé, fonte grise, bronze, inox 316L, polyamide PA6.
5. **Constructeur ou Référence Fournisseur :** Référence standardisée de pièce.

---

## 3. Recherche, Filtrage et Liens Entrepôt

- **Filtrage par Type :** Le sélecteur supérieur permet d'isoler en un clic toutes les désignations d'un même type (ex. tous les carters ou toutes les poulies).
- **Compteur de Pièces Physiques en Stock :** Chaque ligne affiche la quantité physique disponible dans l'entrepôt (`Entrepôt - Onglet Pièces`).
- En cliquant sur l'icône de navigation entrepôt, vous basculez directement vers la localisation physique dans les rayons du magasin.

---

## 4. Ajout d'une Nouvelle Désignation

1. Cliquez sur le bouton principal **« + Nouvelle Désignation »**.
2. Sélectionnez le **Type de Pièce** parent.
3. Renseignez l'identifiant court et le libellé technique complet.
4. Précisez les dimensions et matières si applicables.
5. Cliquez sur **« Enregistrer »**.

---

## 5. Règle d'Intégrité Référentielle

- Une désignation ne peut pas être supprimée tant que des articles physiques existent sous cette référence dans l'entrepôt.
- Cette contrainte garantit que la valorisation financière du stock et les nomenclatures machines restent 100% cohérentes.
