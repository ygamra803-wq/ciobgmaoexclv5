---
id: page-user-matching-audit
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: page
audience: user
tabId: settings_matching
title: Appairage & Nettoyage des Données Orphelines
subtitle: Audit de cohérence des liens, détection des machines sans atelier et rattachement guidé en un clic
summary: Guide d'utilisation pour assainir et fiabiliser la base de données de l'usine. Décrit la détection des équipements orphelins, la réaffectation assistée des pièces et la validation des liaisons.
relatedTabs:
  - settings
  - machines
  - zones
---

# 🔗 Guide Utilisateur : Appairage & Données Orphelines (`#settings_matching`)

> **Module :** Paramètres Système & Audit  
> **Onglet :** *Appairage & Réconciliation* dans Paramètres  
> **Public cible :** Responsables Méthodes, Administrateurs GMAO, Contrôleurs Qualité Données.

---

## 1. À Quoi Sert l'Appairage des Données ?

Dans la vie d'une usine, il arrive qu'un atelier soit renommé (ex. *« Ligne 1 »* devient *« Atelier Nord »*) ou qu'une ancienne référence de pièce soit remplacée par un nouveau modèle.

Si ces changements ne sont pas répercutés partout, certaines machines ou certains mouvements se retrouvent « orphelins » (c'est-à-dire rattachés à un nom qui n'existe plus).

L'outil d'**Appairage & Réconciliation** inspecte automatiquement toute votre base de données pour détecter ces incohérences et vous propose de les réparer en un clic.

---

## 2. Le Tableau des Anomalies Détectées

Lorsque vous ouvrez cet onglet, un scan s'exécute immédiatement. Si des anomalies existent, elles sont classées par nature :

- 🏭 **Machines Orphelines :** Machines dont la zone géographique d'implantation a été modifiée ou supprimée.
- 📦 **Mouvements sans Article :** Sorties de stock anciennes faisant référence à un article qui n'existe plus dans le catalogue.
- 👷 **Techniciens sans Atelier :** Personnels dont l'affectation d'équipe ne correspond à aucune zone active.

---

## 3. Procédure Pas-à-Pas pour Rapprocher une Donnée

1. Repérez la ligne signalée en orange dans le tableau.
2. Cliquez sur le bouton **« Réconcilier / Réassigner »** (icône 🔗).
3. Une fenêtre d'assistance s'ouvre :
   - Le système analyse le texte et vous **suggère automatiquement la cible la plus probable** (ex. si la machine cherchait `ATELIER_LAM`, le système propose `Z-PROD-01 Atelier de Laminage`).
4. Si la suggestion vous convient, cliquez sur **« Valider le Rattachement »**.
5. La liaison est instantanément corrigée et la machine réapparaît proprement dans tous les filtres et tableaux de bord de l'usine !
