---
id: page-user-directory-sync
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_directory
title: Dossier Partagé & Synchronisation Réseau Local (LAN)
subtitle: Connexion multi-postes, travail en temps réel sur tablettes d'atelier et statut du serveur d'usine
summary: Guide pratique pour connecter les tablettes des techniciens et les PC des bureaux au serveur central de l'usine. Explique l'indicateur de liaison réseau, la sauvegarde automatique sur disque et la résolution des pertes de signal WiFi.
relatedTabs:
  - settings
  - settings_backup_audit
---

# 🌐 Guide Utilisateur : Dossier Partagé & Synchronisation LAN (`#settings_directory`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Dossier Partagé & Sync* dans Paramètres  
> **Public cible :** Techniciens d'Atelier, Chefs de Poste, Administrateurs Réseau d'Usine.

---

## 1. Comment Fonctionne le Travail Multi-Utilisateurs ?

Dans votre usine, plusieurs personnes utilisent la GMAO en même temps :
- Les techniciens déclarent les pannes et démarrent les chronomètres depuis leurs tablettes connectées en WiFi dans les halles de production.
- Les magasiniers valident les entrées et sorties de pièces au guichet du magasin.
- Les chefs d'équipe examinent les rapports et valident les bons de travail depuis leurs bureaux.

Pour que tout le monde voie les mêmes informations en temps réel, l'application se synchronise automatiquement avec le **PC serveur central de l'usine** via le réseau local (LAN).

---

## 2. Indicateurs de Connexion et Statut de Synchronisation

En haut de l'écran :
- 🟢 **Badge Vert « Connecté au Serveur Local » :** Toutes vos actions (déclarations de pièces, clôtures de BT) sont immédiatement transmises et sécurisées sur le disque du serveur d'usine.
- 🟡 **Badge Jaune « En Attente de Synchronisation » :** Quelques opérations sont temporairement stockées sur votre tablette en attendant la reconnexion au réseau.
- 🔴 **Badge Rouge « Hors Ligne (Mode Déconnecté) » :** La tablette a perdu la liaison WiFi de l'atelier. Vous pouvez continuer à consulter vos machines et saisir vos interventions ; elles seront automatiquement envoyées dès le retour à portée du réseau.

---

## 3. Configuration de la Liaison Réseau

Pour relier un nouveau poste ou une nouvelle tablette au serveur :
1. Dans le champ **« Adresse IP du Serveur GMAO »**, saisissez l'adresse locale du poste central (ex. `http://192.168.1.50:3000`).
2. Saisissez le **Jeton de Sécurité Réseau (Token)** fourni par votre administrateur informatique.
3. Cliquez sur **« Tester la Connexion »**.
4. Dès que le message vert de confirmation apparaît, cliquez sur **« Enregistrer la Liaison »**.

---

## 4. Que Faire en Cas de Coupure de Réseau ?

- **Ne fermez pas brutalement votre navigateur :** Toutes les données saisies restent protégées dans la mémoire locale de votre appareil.
- Rapprochez-vous d'une borne WiFi d'atelier ou du bureau des contremaîtres.
- Dès que le réseau est rétabli, le système synchronise automatiquement toutes les opérations en attente sans aucune perte de données !
