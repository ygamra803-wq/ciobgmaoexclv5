---
id: page-demandes-intervention
groupId: 04-corrective-di-bt
groupTitle: Maintenance Corrective (DI / BT & Clôture)
docType: page
audience: user
tabId: corrective_di
title: Demandes d'Intervention (DI)
subtitle: Signalement d'anomalies, pannes de production, niveaux d'urgence P1-P4 et conversion en Bon de Travail
summary: Guide d'utilisation pour la saisie rapide des pannes par les opérateurs de fabrication, la qualification des urgences, la numérotation séquentielle automatique et la conversion en BT.
relatedTabs:
  - corrective_bt
  - corrective_referentiel
  - machines
---

# 📋 Guide Utilisateur : Demandes d'Intervention (DI)

> **Module :** Maintenance Corrective  
> **Identifiant d'accès :** `#corrective_di`  
> **Onglet :** *Demandes d'Intervention* dans la vue Maintenance Corrective  
> **Public cible :** Opérateurs de production, Chefs d'équipe d'atelier, Techniciens et Superviseurs de maintenance.

---

## 1. Rôle et Objectif de la Page

La **Demande d'Intervention (DI)** est le point de départ de toute maintenance non planifiée suite à une anomalie, un dysfonctionnement, un bruit anormal ou un arrêt franc sur une machine de production.

Elle permet à l'équipe de fabrication ou aux rondiers de signaler immédiatement un problème au service maintenance, avec un niveau d'urgence gradué, sans nécessiter de connaissances techniques avancées en réparation.

---

## 2. Éléments Visuels & Tableau de Bord DI

L'écran des Demandes d'Intervention présente une interface claire et réactive :

1. **Bandeau des Compteurs Synthétiques :**
   - **Total DI :** Nombre global de demandes enregistrées dans le système.
   - **En Attente :** Demandes non encore traitées par la maintenance.
   - **Urgences Critiques (P1 / Immédiate) :** Nombre de blocages nécessitant une intervention d'urgence.
   - **Converties en BT :** Demandes ayant donné lieu à un Bon de Travail actif.
2. **Barre de Recherche et Filtres Rapides :**
   - Recherche textuelle par code DI, nom de machine, zone ou description de la panne.
   - Filtre par niveau d'urgence : `Basse`, `Moyenne`, `Haute`, `Urgente / Arrêt Machine`.
   - Filtre par statut : `Toutes`, `En Attente`, `En Cours de Traitement`, `Rejetée / Annulée`.
3. **Tableau des Demandes :**
   - Colonnes : Numéro DI (`DI-YYYY-XXXX`), Date & Heure, Machine cible, Zone géographique, Degré d'urgence, Symptôme constaté, Demandeur, Actions disponibles.

---

## 3. Procédure Pas-à-Pas : Déclarer une Nouvelle DI

Pour enregistrer une nouvelle panne :

1. Cliquez sur le bouton principal **« + Nouvelle Demande d'Intervention »** en haut à droite.
2. Renseignez les champs du formulaire :
   - **Machine concernée :** Sélectionnez l'équipement dans la liste déroulante (seules les machines actives du parc apparaissent).
   - **Zone :** Pré-remplie automatiquement en fonction de l'implantation de la machine choisie.
   - **Degré d'Urgence :**
     - 🟢 *Basse (P4) :* Dégradation légère sans impact direct sur la cadence de production.
     - 🟡 *Moyenne (P3) :* Fonctionnement dégradé, cadence ralentie, ou fuite mineure.
     - 🟠 *Haute (P2) :* Risque imminent d'arrêt de ligne ou dérive qualité produit.
     - 🔴 *Urgente / Arrêt de Ligne (P1) :* Blocage total de la production, intervention requise sans délai.
   - **Symptôme / Description de l'Anomalie :** Décrivez précisément ce qui a été observé (ex. *« Surchauffe anormale du réducteur principal, odeur de brûlé et vibration à 1400 tr/min »*).
   - **Demandeur :** Nom de l'opérateur ou du chef de poste émetteur.
3. Cliquez sur **« Enregistrer la Demande »**.
   - Le système génère automatiquement un identifiant unique séquentiel (ex. `DI-2026-0042`).
   - La demande s'affiche immédiatement dans la liste avec son badge de priorité coloré.

---

## 4. Prise en Charge & Conversion en Bon de Travail (BT)

Lorsqu'un responsable ou un technicien prend en charge la demande :

1. Dans le tableau des DI, repérez la demande et cliquez sur **« Convertir en Bon de Travail »** (icône d'outils 🔧).
2. La fenêtre de création de BT s'ouvre avec les informations de la machine et de la panne pré-remplies.
3. Le superviseur assigne le technicien habilité et définit le travail à réaliser.
4. Une fois validée :
   - Le statut de la DI passe automatiquement à **« Convertie en BT »** avec un lien direct vers le numéro de BT créé.
   - Aucune intervention ne peut être convertie deux fois, garantissant l'intégrité de la traçabilité.

---

## 5. Rejet ou Annulation d'une Demande Injustifiée

Si une DI s'avère être une fausse alerte ou un doublon :
1. Cliquez sur **« Annuler / Rejeter »** dans la colonne d'actions.
2. Indiquez obligatoirement le motif du rejet (ex. *« Doublon avec DI-2026-0038 »* ou *« Réglage opérateur standard suffisant »*).
3. Le motif est consigné dans le journal d'audit et la demande est clôturée sans impact sur le calcul du taux de panne (MTBF).
