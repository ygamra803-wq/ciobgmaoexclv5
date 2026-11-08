---
id: page-user-settings-overview
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings
title: Supervision du Stockage & Initialisation Usine
subtitle: Vue d'ensemble des bases de données, jauges d'espace mémoire et basculement entre Mode Réel et Données Démo
summary: Guide d'utilisation pour les administrateurs et responsables GMAO. Explique la surveillance du volume des données en mémoire, l'initialisation d'un démarrage vierge d'usine et le chargement d'un jeu d'essai pour la formation.
relatedTabs:
  - settings_backup_audit
  - dashboard
---

# 💽 Guide Utilisateur : Supervision & Initialisation Usine (`#settings`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Supervision & Stockage* dans Paramètres  
> **Public cible :** Administrateurs Système, Responsables Informatiques, Directeurs Techniques.

---

## 1. Rôle et Objectif de l'Écran

L'onglet **Supervision & Stockage** permet de surveiller la santé des données locales hébergées dans votre navigateur et sur le serveur hôte :
- Connaître le nombre exact d'enregistrements par table (machines, pièces de rechange, interventions, bons de travail).
- Vérifier la saturation de la mémoire locale afin d'anticiper les besoins d'archivage.
- Initialiser le système en mode vierge pour la mise en service d'un nouveau site industriel.

---

## 2. Indicateurs d'État et Jauges de Mémoire

En haut de l'écran, trois jauges synthétiques renseignent sur la santé du système :

1. **Jauge d'Occupation Mémoire (Ko / Mo) :** Volume réel des données stockées. Une usine moyenne de 100 machines et 2 000 articles consomme environ 3 à 5 Mo, ce qui laisse une marge confortable sur tous les navigateurs modernes.
2. **Statut d'Intégrité de la Base :** Badge vert signalant l'absence d'incohérence dans les liens entre tables (aucune machine sans zone, aucun mouvement sans pièce).
3. **Mode de Fonctionnement Actif :**
   - 🏭 **Mode Usine Réelle :** Aucune donnée fictive ; chaque ligne correspond à un équipement physique de votre usine.
   - 🎓 **Mode Démonstration :** Données simulées d'exemple pour l'entraînement des équipes.

---

## 3. Les Commandes de Démarrage et Initialisation

### 3.1 Initialisation d'une Nouvelle Usine Vierge (`Réinitialiser Usine`)
Pour démarrer sur une base 100% propre lors de l'achat ou du déploiement de la GMAO :
1. Cliquez sur **« Réinitialiser l'Usine (Démarrage Vierge) »**.
2. Confirmez la double invite de sécurité.
3. Le système remet tous les compteurs à zéro (`0 machine, 0 article, 0 intervention`).
4. **Garantie d'intégrité :** Le système ne réinjectera jamais de fausses données lors des prochaines ouvertures.

### 3.2 Charger un Jeu d'Exemple pour la Formation (`Données Démo`)
Pour former de nouveaux techniciens ou tester les fonctionnalités sans impacter vos données réelles :
1. Cliquez sur **« Charger le Jeu de Données Démo »**.
2. Le système peuple automatiquement l'application avec un parc complet (lignes d'extrusion, laminoir), un magasin PDR complet et des historiques d'interventions réalistes.
3. Vous pouvez également charger ou vider les données démo **section par section** (ex. vider uniquement le préventif sans toucher au stock).
