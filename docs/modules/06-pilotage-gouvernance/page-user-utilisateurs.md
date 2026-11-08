---
id: page-user-utilisateurs
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: page
audience: user
tabId: utilisateurs
title: Gestion des Utilisateurs & Habilitations
subtitle: Administration des comptes, profils techniciens, attribution des rôles et rattachement aux ateliers
summary: Guide d'utilisation pour les administrateurs et responsables maintenance. Explique la création des comptes utilisateurs, l'affectation des rôles RBAC, la désactivation douce (Soft Archive) et la gestion des codes PIN.
relatedTabs:
  - settings
  - zones
  - validation_center
---

# 👥 Guide Utilisateur : Utilisateurs & Habilitations (`#utilisateurs`)

> **Module :** Pilotage & Gouvernance  
> **Identifiant d'accès :** `#utilisateurs`  
> **Public cible :** Administrateurs GMAO, Responsables Maintenance, Chefs de Service RH/Technique.

---

## 1. Rôle et Objectif de l'Écran

L'écran **Utilisateurs & Habilitations** centralise la gestion de l'ensemble du personnel intervenant dans l'application GMAO :
- **Techniciens et Mécaniciens d'Atelier :** Répertoire des agents habilités à réaliser des interventions de dépannage ou d'entretien préventif.
- **Opérateurs de Ligne :** Personnels autorisés à émettre des Demandes d'Intervention (DI).
- **Superviseurs et Responsables :** Cadres disposant du pouvoir de signature et de validation des heures et pièces.
- **Magasiniers :** Gestionnaires du stock physique et des réceptions de commandes.

---

## 2. Décryptage des Rôles et Profils d'Accès

Lors de la création ou modification d'un compte, vous devez lui attribuer un **Rôle Fonctionnel** définissant strictement ce qu'il a le droit de voir et de faire :

1. 👑 **Administrateur (`ADMIN`) :** Accès intégral à tous les modules, paramétrage de l'usine, sauvegardes et gestion des comptes.
2. 🛠️ **Responsable Maintenance (`RESPONSABLE_MAINTENANCE`) :** Gestion du planning préventif, validation des rapports d'intervention (`Maker-Checker`), pilotage des coûts et budgets.
3. 📦 **Responsable Magasin (`RESPONSABLE_MAGASIN`) :** Gestion des articles PDR, inventaires tournants, création de commandes d'approvisionnement (PO).
4. 🔧 **Technicien (`TECHNICIEN`) :** Consultation des machines, exécution des interventions avec chronomètre Live, déclaration des travaux et proposition de pièces.
5. 🏭 **Opérateur (`OPERATEUR`) :** Signalement rapide des pannes via les Demandes d'Intervention (DI) sur sa zone.
6. 👁️ **Observateur (`VIEWER`) :** Consultation en lecture seule des indicateurs et graphiques, sans possibilité d'enregistrement.

---

## 3. Procédure Pas-à-Pas : Créer un Nouveau Compte

1. Cliquez sur le bouton principal **« + Nouvel Utilisateur / Technicien »** en haut à droite.
2. Renseignez les informations de base :
   - **Nom et Prénom :** Identité complète de l'agent.
   - **Matricule / Identifiant :** Code unique d'identification interne (ex. `TECH-014`).
   - **Spécialité Principale :** Électromécanicien, Mécanicien, Frigoriste, Tuyauteur, Automaticien...
   - **Zone d'Implantation Par Défaut :** Atelier de rattachement principal (ex. `Z-PROD-01 Laminoir`).
   - **Rôle Système :** Sélectionnez le rôle approprié parmi la liste déroulante.
3. **Sécurité d'Accès :**
   - Définissez le mot de passe initial ou le code PIN individuel.
   - L'utilisateur sera invité à le personnaliser dès sa première connexion.
4. Cliquez sur **« Enregistrer »**.

---

## 4. Règle Essentielle : Désactivation Douce (Soft Archive) vs Suppression

Dans une GMAO industrielle, **on ne supprime jamais définitivement un technicien ayant un historique d'interventions** :
- Si un technicien quitte l'entreprise, basculez son statut sur **« Inactif »** (Désactivé) au lieu de cliquer sur la corbeille.
- **Pourquoi ?** Si vous supprimiez son compte, tous les anciens bons de travail qu'il a réalisés au cours des années passées deviendraient orphelins, faussant les audits de sécurité et l'historique de maintenance des machines.
- Un utilisateur désactivé ne peut plus se connecter au système et n'apparaît plus dans les listes d'assignation des nouveaux BT, mais tout son travail antérieur reste parfaitement conservé.
