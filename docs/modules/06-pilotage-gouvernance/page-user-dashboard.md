---
id: page-user-dashboard
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: page
audience: user
tabId: dashboard
title: Tableau de Bord & Pilotage Stratégique
subtitle: Vue d'ensemble opérationnelle, indicateurs clés de performance (KPIs), taux de disponibilité et alertes d'atelier
summary: Guide d'utilisation de la tour de contrôle GMAO. Décrit les indicateurs de performance industrielle, le suivi en direct des pannes critiques, la valeur du stock magasin et les alertes d'entretien.
relatedTabs:
  - finance
  - validation_center
  - corrective_bt
  - preventive
---

# 📊 Guide Utilisateur : Tableau de Bord Exécutif (`#dashboard`)

> **Module :** Pilotage & Gouvernance  
> **Identifiant d'accès :** `#dashboard`  
> **Public cible :** Directeurs d'Usine, Responsables Maintenance, Chefs de Production, Contrôleurs de Gestion.

---

## 1. Rôle et Objectif de la Tour de Contrôle

Le **Tableau de Bord Exécutif** est l'écran d'accueil stratégique de la GMAO. Il synthétise en temps réel la santé globale de l'appareil de production, l'efficacité des équipes de maintenance et les flux logistiques du magasin.

Il permet aux décideurs de répondre instantanément à trois questions vitales :
1. *Nos machines produisent-elles avec le niveau de fiabilité attendu (Disponibilité / MTBF) ?*
2. *Quel est l'encours des pannes non résolues et des validations en attente ?*
3. *Où en sommes-nous de la consommation du budget annuel de maintenance ?*

---

## 2. Décryptage des Cartes d'Indicateurs Clés (KPI Cards)

En haut de l'écran, les cartes synthétiques offrent une lecture rapide de la performance :

- 🟢 **Taux de Disponibilité ($D_o$) :** Pourcentage du temps durant lequel le parc machine était opérationnel. Une valeur supérieure à 95% indique un excellent niveau de fiabilité.
- ⏱️ **Temps Moyen Entre Pannes (MTBF) :** Nombre moyen d'heures de bon fonctionnement entre deux défaillances. Plus ce chiffre est élevé, plus les équipements sont fiables.
- 🔧 **Temps Moyen de Réparation (MTTR) :** Durée moyenne requise par les techniciens pour dépanner une machine arrêtée. Un chiffre bas traduit une réactivité élevée.
- 📦 **Valeur du Stock Magasin :** Montant financier global des pièces de rechange immobilisées en rayon (valorisé au Coût Moyen PUMP).
- 📋 **Taux de Réalisation Préventif :** Pourcentage des visites systématiques du calendrier 52 semaines validées dans les délais.
- ⚠️ **File de Validation Maker-Checker :** Nombre d'interventions terrain et de sorties de pièces en attente d'approbation par les superviseurs.

---

## 3. Sections Analytiques et Graphiques

### 3.1 Alertes Immédiates & Urgences de Production
- Bandeau dynamique signalant les pannes critiques (`P1 / Arrêt Ligne`) en cours.
- Clic direct sur l'alerte pour ouvrir immédiatement le bon de travail concerné dans l'atelier.

### 3.2 Jauge de Consommation Budgétaire
- Affiche la dotation financière annuelle allouée au service maintenance vs les dépenses réelles engagées à ce jour.
- Un code couleur préventif avertit des risques de dépassement :
  - 🟢 *Normal :* Consommation alignée sur le prorata temporis du mois.
  - 🟡 *Attention (Orange) :* Consommation atteignant le seuil d'alerte défini dans les paramètres.
  - 🔴 *Dépassement (Rouge) :* Dépenses réelles supérieures à la dotation prévue.

### 3.3 Top 5 des Machines les plus Sollicitées en Dépannage
- Graphique de Pareto simplifié pointant les 5 machines ayant cumulé le plus d'arrêts au cours du mois.
- Permet au chef d'atelier de focaliser les ressources d'amélioration continue sur les goulets d'étranglement réels de l'usine.

---

## 4. Bonnes Pratiques pour la Direction

1. **Revue Quotidienne du Matin :** Utiliser le tableau de bord lors du point d'équipe quotidien de 08h00 pour arbitrer les priorités de la journée.
2. **Contrôle du Sas de Validation :** S'assurer que le compteur *En Attente de Validation* ne dépasse jamais 5 dossiers pour éviter les retards dans la tenue de l'inventaire.
3. **Export des Indicateurs :** En fin de mois, utiliser le bouton d'export Excel pour communiquer les performances aux comités de direction.
