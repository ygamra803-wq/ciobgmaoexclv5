---
id: page-user-validation-center
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: page
audience: user
tabId: validation_center
title: Centre de Validation Maker-Checker
subtitle: Sas de contrôle managérial, validation des heures et réconciliation des pièces de rechange
summary: Guide d'utilisation pour les superviseurs et chefs d'équipe. Présente la revue des déclarations de dépannage des techniciens, l'arbitrage des pièces PDR consommées et la validation sans double décompte.
relatedTabs:
  - corrective_bt
  - preventive
  - stock
  - settings
---

# 🛡️ Guide Utilisateur : Centre de Validation Maker-Checker (`#validation_center`)

> **Module :** Pilotage & Gouvernance  
> **Identifiant d'accès :** `#validation_center`  
> **Public cible :** Chefs d'Équipe Maintenance, Superviseurs d'Atelier, Responsables Méthodes & Magasin.

---

## 1. Pourquoi un Centre de Validation ?

Sur le terrain, un technicien en cours de dépannage doit pouvoir déclarer rapidement les travaux réalisés et les pièces utilisées sans être ralenti par des règles comptables complexes.

Toutefois, pour éviter les erreurs d'inventaire, les fautes de frappe de référence ou les doublons de sortie, **aucune pièce déclarée sur le terrain n'est déduite du stock magasin avant d'avoir été visée par un responsable**.

Le **Centre de Validation Maker-Checker** constitue le sas de contrôle qualité et logistique de l'usine.

---

## 2. Les 3 Files d'Attente de Contrôle

L'écran organise les dossiers en 3 onglets distincts :

1. **Bons de Travail Curatifs en Attente :** Interventions de dépannage terminées par les techniciens, en attente de validation des heures et des pièces de rechange.
2. **Exécutions Préventives avec Pièces :** Visites systématiques d'entretien au cours desquelles des consommables (filtres, courroies, huiles) ont été remplacés.
3. **Demandes de Prélèvement Magasin (Sortie Demands) :** Bons de réservation émis par les équipes d'atelier nécessitant le visa préalable du chef de poste avant remise physique des pièces par le magasinier.

---

## 3. Procédure Pas-à-Pas : Valider un Bon de Travail

Lorsqu'un dossier apparaît dans votre file :

1. Cliquez sur le bouton **« Examiner »** sur la ligne du BT.
2. La fenêtre d'examen s'ouvre et présente :
   - Le nom de la machine et la zone d'implantation.
   - Le technicien intervenant et la durée totale déclarée.
   - Le compte-rendu technique des travaux exécutés.
   - La liste des pièces de rechange proposées (`pieces_proposees`) avec quantité et coût unitaire PUMP.
3. **Vérification & Ajustement :**
   - Si les quantités correspondent à la réalité du terrain : laissez tel quel.
   - Si le technicien s'est trompé (ex. saisi 4 roulements au lieu de 2) : modifiez directement la quantité.
   - Si la pièce avait déjà été prélevée au magasin via un bon de sortie manuel : cochez l'option **« Ne pas déduire du stock (déjà sortie au guichet) »** afin d'éviter un double débit d'inventaire.
4. **Prise de Décision :**
   - **Approuver (Bouton Vert) :** Le rapport est clôturé définitivement, les pièces sont déduites du stock magasin, le coût global est ventilé dans les finances de la machine, et votre signature numérique est horodatée dans le registre d'audit.
   - **Demander Correction (Bouton Jaune) :** Renvoyez le dossier au technicien avec une note explicative (ex. *« Préciser la cause de l'échauffement moteur »*).
   - **Rejeter (Bouton Rouge) :** Annule l'intervention avec obligation de consigner le motif de refus.

---

## 4. Bonnes Pratiques d'Atelier

1. **Rythme de Validation :** Viser les dossiers deux fois par jour (en fin d'équipe matin à 13h00 et en fin de journée à 16h45) afin de maintenir l'exactitude permanente des stocks du magasin.
2. **Communication Bienveillante :** En cas de refus ou d'ajustement, utilisez le champ de commentaire pour expliquer la modification au technicien afin de perfectionner la qualité des saisies futures.
3. **Traçabilité Immuable :** Rappelez-vous que chaque validation porte le nom de votre compte utilisateur et est archivée de manière inaltérable dans le registre d'audit de l'usine.
