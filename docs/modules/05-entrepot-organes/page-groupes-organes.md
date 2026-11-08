---
id: page-groupes-organes
groupId: 05-entrepot-organes
groupTitle: Entrepôt Organes & Pièces Détachées
docType: page
audience: user
tabId: comp_groups
title: Groupes d'Organes (Niveau 1)
subtitle: Classification technologique supérieure des sous-ensembles (Moteurs, Réducteurs, Pompes, Variateurs)
summary: Guide d'utilisation pour la gestion des Groupes d'Organes. Présente le Niveau 1 de la taxonomie des composants, la navigation croisée vers les Familles et Modèles, et la protection contre les suppressions orphelines.
relatedTabs:
  - comp_families
  - comp_templates
  - entrepot
---

# ⚙️ Guide Utilisateur : Groupes d'Organes (Niveau 1)

> **Module :** Référentiel Technique & Entrepôt  
> **Identifiant d'accès :** `#comp_groups`  
> **Public cible :** Responsables Méthodes, Administrateurs GMAO, Ingénieurs Bureau d'Études.

---

## 1. Rôle et Objectif du Niveau 1

Le **Groupe d'Organes** est le niveau hiérarchique supérieur de la taxonomie des équipements électromécaniques. Il regroupe les organes selon leur grand principe technologique :
- `MOTEUR` : Moteurs électriques à courant alternatif, continu, pas-à-pas ou servomoteurs.
- `REDUCTEUR` : Boîtes de transmission, réducteurs coaxiaux, à couple conique, roue et vis sans fin.
- `POMPE` : Pompes centrifuges, volumétriques, à membrane, hydrauliques haute pression.
- `VARIATEUR` : Variateurs électroniques de fréquence, onduleurs, variateurs d'axe.
- `VERIN` : Vérins pneumatiques et vérins hydrauliques double effet.

**Objectif industriel :** Éviter un catalogue désordonné contenant des centaines d'organes mélangés. Il permet de filtrer l'ensemble de la GMAO par domaine technique en un seul clic.

---

## 2. Structure des Données d'un Groupe

Chaque enregistrement de groupe comprend :
1. **Identifiant Système (`id`) :** Clé primaire immuable générée par le système (ex. `GRP-MOTEUR-001`).
2. **Code Usine (`code`) :** Mnémonique court en majuscules (ex. `MOTEUR`, `REDUCTEUR`).
3. **Libellé Complet (`libelle`) :** Désignation claire (ex. *« Moteurs et Actionneurs Électriques »*).
4. **Description Fonctionnelle (`description`) :** Rôle général et limites d'application dans l'usine.

---

## 3. Navigation Croisée Intelligente (1-Click Cross Navigation)

Dans le tableau des groupes :
- Chaque ligne affiche le **nombre de familles rattachées** et le **nombre total de modèles (templates)** sous forme de badges interactifs.
- En cliquant sur le badge **« X Familles »**, le système ouvre immédiatement l'écran des **Familles d'Organes (`#comp_families`)** pré-filtré sur ce groupe.
- En cliquant sur le badge **« Y Modèles »**, l'écran des **Templates (`#comp_templates`)** s'ouvre avec filtrage en cascade activé.

---

## 4. Ajout et Modification d'un Groupe

1. Cliquez sur **« + Nouveau Groupe »**.
2. Indiquez le code mnémonique et le libellé en français.
3. Ajoutez une description synthétique pour orienter les techniciens.
4. Cliquez sur **« Enregistrer »**.

---

## 5. Règle de Sécurité : Protection Contre la Suppression Orpheline

La suppression d'un groupe est **strictement verrouillée** :
- Si au moins une famille (`CompFamily`) est rattachée au groupe, le bouton de suppression est désactivé et un message d'alerte explicite signale :  
  *« Suppression impossible : ce groupe contient des familles d'organes actives. Réaffectez ou supprimez les familles rattachées au préalable. »*
- Cette règle garantit qu'aucune famille ou modèle ne devienne orphelin dans la base de données.
