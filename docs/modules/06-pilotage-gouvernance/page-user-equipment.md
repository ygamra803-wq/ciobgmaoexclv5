---
id: page-user-equipment
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance & Gouvernance
docType: page
audience: user
tabId: equipment
title: Équipements & Système Général (Utilités d'Usine)
subtitle: Pilotage centralisé des utilités industrielles (Air comprimé, Électricité, Sécurité incendie, Froid, Eau)
summary: Guide utilisateur de l'écran Équipements / Système Général. Explique comment créer et gérer les équipements d'infrastructure de l'usine ainsi que leurs catégories dédiées, indépendamment des lignes de production.
relatedTabs:
  - zones
  - utilisateurs
  - machines
  - preventive
  - sortie
---

# ⚡ Guide Utilisateur : Équipements & Système Général (`#equipment`)

> **Module :** Pilotage & Gouvernance (Référentiels d'Usine)  
> **Identifiant d'accès :** `#equipment`  
> **Public cible :** Responsables Maintenance, Ingénieurs Utilités & HSE, Chefs d'Atelier, Administrateurs.

---

## 1. Rôle et Objectif de cet Écran

Dans une usine, tous les équipements ne sont pas des machines de fabrication. Les compresseurs, groupes électrogènes, pompes incendie, refroidisseurs (`Chillers`), chaudières et postes électriques constituent le **Système Général (Utilités & Infrastructure)**.

L'écran **Équipements / Système Général** (situé dans le groupe de gouvernance aux côtés de **Zones** et **Utilisateurs**) est le **centre de contrôle exclusif** pour :
- Créer, modifier et suivre l'état de tous les équipements du **Système Général**.
- Gérer le catalogue des **Types de Système Général** (`AIR`, `ELEC`, `SEC`, `CHILL`, `EAU`...).
- Piloter leur localisation par **Zone**, leur **Technicien référent**, leur **Compteur (Horomètre)** et leurs interventions.

> **Bon à savoir :** L'écran **Machines Enregistrées** (`#machines`) reste dédié à la création des machines de **Production**. Si vous consultez un équipement du Système Général depuis le parc global et souhaitez le modifier, un bouton **« Gérer dans Système Général »** vous amène directement ici sur la bonne fiche.

---

## 2. Les Deux Volets de la Page

Un sélecteur en haut de la page vous permet de basculer entre deux vues complémentaires :

### Volet 1 : `Équipements Installés` (Gestion du Parc Utilités)
Affiche le tableau complet de vos utilités avec :
- **4 Cartes KPI en temps réel** : Total des équipements actifs, équipements *En Service*, équipements *En Maintenance / Panne*, et nombre de *Catégories Système* actives.
- **Barre de Filtres Multicritères** : Recherche par code/désignation/numéro de série, filtre par **Type de Système**, par **Zone**, et par **Statut** (y compris la consultation des équipements archivés).
- **Actions Rapides sur chaque ligne** :
  - **Sortie PDR Rapide (Icône Clé)** : Ouvre directement un bon de sortie magasin pré-rempli pour cet équipement.
  - **Planning Préventif (Icône Calendrier)** : Ouvre le planning préventif filtré sur cet équipement.
  - **Modifier / Archiver / Restaurer** : Met à jour la fiche ou archive proprement un équipement réformé sans perdre son historique.

### Volet 2 : `Types de Système Général` (Catalogue des Catégories)
Permet de structurer vos familles d'utilités :
- Chaque type possède un **Préfixe Court** (ex. `AIR`, `ELEC`, `SEC`, `CVAC`) et un **Nom Complet** (ex. *Air Comprimé & Pneumatique*, *Sécurité Incendie*).
- Vous pouvez créer de nouveaux types à tout moment ou activer/désactiver un type existant en un clic.

---

## 3. Procédure : Ajouter un Nouvel Équipement du Système Général

1. Cliquez sur le bouton principal **« + Nouvel Équipement »** en haut à droite.
2. Sélectionnez le **Type de Système Général** (ex. `AIR — Air Comprimé`).
   - **Codification Automatique :** Le système génère aussitôt le prochain code libre (ex. `AIR-01`, `AIR-02`) via le sélecteur séquentiel.
3. Renseignez la **Désignation complète** (ex. *Compresseur à vis Atlas Copco 55 kW*).
4. Sélectionnez sa **Zone d'implantation** (ex. *Salle des Compresseurs / Utilités*) et le **Technicien Responsable**.
5. Renseignez (optionnellement) son **Numéro de série**, sa **Date de mise en service**, ainsi que la valeur initiale et l'unité de son **Compteur** (`HEURES`, `CYCLES`, `TONNES`, `KM`).
6. Cliquez sur **« Enregistrer »**. L'équipement est immédiatement disponible dans toute la GMAO (Bons de Travail, Préventif, Compteurs et Magasin).
