---
id: page-catalogue-correctif
groupId: 04-corrective-di-bt
groupTitle: Maintenance Corrective (DI / BT & Clôture)
docType: page
audience: user
tabId: corrective_referentiel
title: Catalogue des Données & Référentiel Correctif
subtitle: Normalisation des pannes, bibliothèque des travaux types, matrice symptôme-action et habilitations techniciens
summary: Guide d'administration du référentiel technique de maintenance corrective. Standardisation du vocabulaire d'atelier, classification par domaine technique et gestion des intervenants habilités.
relatedTabs:
  - corrective_di
  - corrective_bt
  - utilisateurs
---

# 📖 Guide Utilisateur : Catalogue des Données & Référentiel Correctif

> **Module :** Maintenance Corrective  
> **Identifiant d'accès :** `#corrective_referentiel` ou bouton *Catalogue Données*  
> **Onglet :** *Catalogue des Données / Référentiel de Panne*  
> **Public cible :** Responsables Méthodes, Superviseurs de Maintenance, Administrateurs Système.

---

## 1. Rôle et Objectif

Le **Catalogue des Données Correctives** constitue le référentiel normatif de l'usine pour standardiser le vocabulaire technique et accélérer la saisie des pannes, des diagnostics et des solutions.

Sans référentiel partagé, chaque technicien décrit les dysfonctionnements avec ses propres termes (ex. *« bruit bizarre »*, *« moteur couine »*, *« vibration roulement »*), ce qui rend impossible toute analyse statistique ou Pareto fiable.

Le catalogue structure les données d'atelier en quatre piliers cohérents :
1. **Symptômes & Pannes Types :** Catégorisation standardisée des dysfonctionnements observables.
2. **Travaux Standards Recommandés :** Bibliothèques d'actions types validées par les méthodes.
3. **Matrice Symptôme ➔ Action :** Recommandation guidée de l'action corrective appropriée face à un symptôme donné.
4. **Intervenants Habilités :** Liste officielle des techniciens, électriciens, mécaniciens et automaticiens autorisés à intervenir sur le parc.

---

## 2. Structure des 4 Onglets du Référentiel

### 2.1 Onglet 1 : Symptômes & Catégories de Pannes
- Liste ordonnée des modes de défaillance classés par domaine technique :
  - **Mécanique :** Vibrations anormales, échauffement palier, grippage, déraillement, jeu excessif.
  - **Électrique :** Disjonction, coupure phase, surtension, claquage fusible, défaut d'isolement.
  - **Hydraulique & Pneumatique :** Fuite d'huile, chute de pression, clapet bloqué, rupture flexible.
  - **Automatisme & Détection :** Cellule photoélectrique encrassée, perte de communication bus, décalage codeur.
- **Ajout d'un Symptôme :**
  - Cliquez sur **« + Ajouter un Symptôme »**.
  - Saisissez le libellé clair, le domaine technique et une description sommaire.

### 2.2 Onglet 2 : Travaux Standards (Actions Types)
- Répertoire des modes opératoires de dépannage standardisés :
  - *« Remplacement standard roulement 6205-2RS »*
  - *« Réalignement laser accouplement moteur/pompe »*
  - *« Remplacement joint torique et purge circuit hydraulique »*
  - *« Reprogrammation variateur et contrôle consigne vitesse »*
- Permet aux techniciens de sélectionner une action prête à l'emploi lors de la création d'un Bon de Travail sans avoir à tout ressaisir manuellement.

### 2.3 Onglet 3 : Matrice Symptôme ➔ Action
- Établit la correspondance intelligente entre un symptôme constaté et la solution préconisée par le service méthodes :
  - *Symptôme :* « Surchauffe moteur > 85°C » ➔ *Action :* « Contrôle ventilation, nettoyage ailettes, mesure d'intensité par phase ».
  - *Symptôme :* « Fuite d'air continue sur distributeur » ➔ *Action :* « Remplacement tiroir d'étanchéité ou changement direct du distributeur 5/2 ».
- Guide les nouveaux techniciens ou les intérimaires pour un diagnostic plus rapide et plus sûr.

### 2.4 Onglet 4 : Intervenants & Habilitations
- Référentiel du personnel de maintenance disponible à l'usine :
  - Nom, prénom, matricule.
  - Spécialité principale : Mécanicien, Électromécanicien, Frigoriste, Tuyauteur, Automaticien.
  - Statut d'activité : Actif / Inactif.
- Seuls les intervenants marqués comme **Actifs** apparaissent dans les listes d'assignation des Bons de Travail et des chronomètres Live.

---

## 3. Bonnes Pratiques pour l'Administrateur

1. **Ne pas surmultiplier les catégories :** Privilégier 20 à 30 symptômes bien définis plutôt que 200 intitulés confus et redondants.
2. **Revue Annuelle des Travaux Standards :** Mettre à jour les modes opératoires en intégrant les retours d'expérience (REX) des clôtures d'intervention.
3. **Désactivation Propre des Intervenants :** En cas de départ d'un technicien, le basculer sur `Inactif` (soft archive) au lieu de supprimer sa fiche, préservant ainsi l'historique complet de tous ses anciens BT.
