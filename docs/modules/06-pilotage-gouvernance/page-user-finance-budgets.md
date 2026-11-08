---
id: page-user-finance-budgets
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: page
audience: user
tabId: finance
title: Coûts, Budgets & TCO Machine
subtitle: Suivi budgétaire 12 mois, contrôle des dépenses de maintenance et coût total de possession des actifs
summary: Guide d'utilisation pour les gestionnaires et responsables d'usine. Couvre le paramétrage du budget annuel, la surveillance de la consommation mensuelle (Main-d'œuvre, PDR, Sous-traitance) et l'analyse du TCO machine.
relatedTabs:
  - dashboard
  - validation_center
  - settings
---

# 💰 Guide Utilisateur : Coûts, Budgets & TCO (`#finance`)

> **Module :** Pilotage & Gouvernance  
> **Identifiant d'accès :** `#finance`  
> **Public cible :** Responsables Maintenance, Contrôleurs de Gestion Industriels, Directeurs Financiers.

---

## 1. Rôle et Objectif du Module Financier

La maintenance industrielle représente un centre de coûts majeur pour l'usine. L'écran **Coûts & Budgets** permet de :
1. **Piloter le budget annuel alloué :** Répartition de la dotation globale sur les 12 mois de l'exercice et suivi du rythme de consommation (burn rate).
2. **Identifier la provenance exacte des dépenses :** Découpage transparent entre heures de main-d'œuvre, pièces de rechange consommées et prestations extérieures.
3. **Mesurer le Coût Total de Possession (TCO) par machine :** Connaître le coût réel d'exploitation de chaque actif pour justifier les arbitrages de remplacement ou d'investissement neuf.

---

## 2. Tableau de Bord Budgétaire & Alertes de Dépassement

L'écran s'ouvre sur les indicateurs de synthèse :

- 💵 **Budget Annuel Alloué :** Montant total voté pour l'année en cours (ex. `12 000 000 DA`).
- 📉 **Dépenses Réelles Engagées :** Cumul des interventions validées à ce jour.
- 📊 **Reste à Engager / Solde :** Crédit budgétaire disponible jusqu'à la fin de l'exercice.
- ⚠️ **Jauge d'Alerte de Dépassement :**
  - 🟢 *Zone Verte (Sous contrôle) :* Dépenses inférieures au seuil d'alerte configuré.
  - 🟡 *Zone Orange (Seuil d'alerte atteint) :* La consommation dépasse le pourcentage critique (ex. 80% du budget alloué pour la période).
  - 🔴 *Zone Rouge (Déficit / Dépassement) :* Les coûts réels excèdent la dotation prévue ; un rapport d'arbitrage exceptionnel est requis.

---

## 3. Ventilation Tripartite des Dépenses

Pour chaque période (mois en cours, trimestre ou année complète), les coûts sont ventilés en 3 catégories claires :

1. **Coût de la Main-d'Œuvre Interne (MO) :**
   - Calculé automatiquement : $\text{Nombre d'heures validées sur les BT} \times \text{Taux horaire standard}$.
2. **Coût des Pièces de Rechange (PDR) :**
   - Valeur des articles sortis du magasin et montés sur les machines, valorisés au Prix Moyen Unitaire Pondéré (PUMP).
3. **Coût des Travaux Externes & Sous-Traitance :**
   - Factures de rebobinage moteur, usinage lourd ou étalonnage réalisés chez des prestataires spécialisés.

---

## 4. Analyse du TCO et Seuil de Rentabilité (Indicateur BER)

Dans le tableau détaillé par équipement :
- Chaque machine affiche son **Coût Cumulé d'Entretien**.
- L'indicateur **BER (Beyond Economical Repair)** compare les dépenses de réparation accumulées par rapport à la valeur d'achat à neuf de la machine :
  - Si les réparations dépassent **60% du prix d'une machine neuve**, le système recommande formellement une étude d'investissement de remplacement plutôt qu'un nouvel arrêt coûteux.

---

## 5. Procédure : Ajuster le Budget Annuel

Pour modifier la dotation budgétaire ou le taux horaire de main-d'œuvre :

1. Cliquez sur le bouton **« Configurer le Budget »** en haut à droite.
2. Modifiez le montant global ou ajustez la dotation mois par mois pour tenir compte des arrêts techniques programmés (ex. augmentation de la dotation en août pour le grand arrêt d'été).
3. Renseignez obligatoirement le **motif de l'ajustement** (ex. *« Dotation exceptionnelle suite à l'installation de la nouvelle Ligne 3 »*).
4. Cliquez sur **« Enregistrer »** : la modification est immédiatement consignée dans l'historique d'audit `budgetChangeLog`.
