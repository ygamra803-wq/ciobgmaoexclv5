---
id: page-cloture-analyse
groupId: 04-corrective-di-bt
groupTitle: Maintenance Corrective (DI / BT & Clôture)
docType: page
audience: user
tabId: corrective_cloture
title: Clôture des Rapports & Analyse Corrective
subtitle: Archive immuable des BT clôturés, valorisation financière, diagrammes de Pareto 80/20 et indicateurs MTTR/MTBF
summary: Guide complet pour la consultation des interventions passées, l'analyse Pareto des défaillances et machines critiques, le calcul de la disponibilité opérationnelle et l'exportation des PV sous Excel.
relatedTabs:
  - corrective_bt
  - corrective_atelier
  - dashboard
  - finance
  - machines
---

# 📊 Guide Utilisateur : Clôture des Rapports & Analyse Corrective

> **Module :** Maintenance Corrective  
> **Identifiants d'accès :** `#corrective_cloture` et `#corrective_analyse`  
> **Onglets :** *Rapports Clôturés* & *Analyse Corrective & Pareto*  
> **Public cible :** Responsables Maintenance, Ingénieurs Fiabilité, Contrôleurs de Gestion, Chefs d'Atelier.

---

## 1. Rôle et Objectif

La clôture d'une intervention ne marque pas la fin du travail de maintenance, mais le début de l'exploitation analytique des données :

- **Rapports Clôturés (`#corrective_cloture`) :** Archive immuable de l'ensemble des interventions passées avec coût complet (main-d'œuvre + pièces de rechange) et PV d'intervention téléchargeable / imprimable.
- **Analyse Corrective (`#corrective_analyse`) :** Tableau de bord décisionnel automatisant les calculs de fiabilité industrielle : MTTR (durée moyenne de réparation), MTBF (fréquence moyenne des pannes), Taux de disponibilité opérationnelle, et diagrammes de Pareto 80/20.

---

## 2. Consultation et Export des Rapports Clôturés

L'onglet `#corrective_cloture` regroupe l'historique exhaustif des BT finalisés :

1. **Recherche et Filtrage Avancé :**
   - Filtrage par période (mois, trimestre, année ou plage de dates personnalisée).
   - Filtrage par équipement ou par ligne de production.
   - Filtrage par technicien intervenant ou type de cause de défaillance.
2. **Détail Complet d'un Rapport :**
   - En cliquant sur un BT clôturé, l'opérateur consulte la fiche récapitulative :
     - Identité de la machine, date et heure d'arrêt, date et heure de redémarrage.
     - Symptôme d'origine et diagnostic constaté.
     - Actions techniques exécutées.
     - Liste détaillée des pièces de rechange avec référence, quantité et coût unitaire PUMP (`cout_pdr`).
     - Détail des **Bons d'Atelier Fabrication Mécanique internes (`BR` / `RECT`)** associés (`code_bon`, type Réalisation/Rectification, quantité, description des travaux et statut d'avancement), avec possibilité d'émettre un nouveau bon (`+ Demande Réalisation / Rectification`) si le BT est encore actif ou d'ouvrir directement l'onglet de suivi (`Ouvrir Suivi Atelier` → `#corrective_atelier`).
     - Détail du **Bon de Sortie Externe / Sous-Traitance** associé (`code_sortie_atelier`, nature d'usinage/bobinage externe, prestataire et `cout_atelier`).
     - Coût global consolidé de l'intervention : $\text{Coût Total} = \text{Coût PDR} + \text{Coût Atelier / Externe}$ (+ valorisation MO).
3. **Export Excel et Impression :**
   - Bouton **« Exporter vers Excel »** : Génération immédiate d'un classeur structuré pour audit et reporting hiérarchique.
   - Bouton **« Imprimer / PDF »** : Fiche d'intervention au format A4 normalisé avec zones d'émargement technicien et production.

---

## 3. Analyse de Fiabilité : MTTR, MTBF et Disponibilité

L'onglet `#corrective_analyse` calcule automatiquement les métriques de la norme EN 13306 :

### 3.1 Les Indicateurs Clés (KPIs)
- **MTTR (Temps Moyen de Réparation) :** Exprimé en heures ou minutes. Indique la rapidité et l'efficacité des équipes techniques à diagnostiquer et remettre en route un équipement défaillant.
- **MTBF (Temps Moyen Entre Pannes) :** Exprimé en heures de fonctionnement. Mesure la robustesse intrinsèque de l'équipement ou l'efficacité de la maintenance préventive appliquée.
- **Taux de Disponibilité ($D_o$) :** Pourcentage du temps durant lequel la machine était apte à produire.
- **Nombre Total d'Interventions & Heures d'Arrêt Cumulées :** Suivi de l'impact global sur la capacité de l'usine.

---

## 4. Diagrammes de Pareto 80/20 : Cibler les Priorités

Le principe de Pareto stipule que **80% des arrêts ou des coûts de maintenance proviennent généralement de 20% des causes ou des machines**.

La page propose deux vues de Pareto dynamiques :

### 4.1 Pareto par Équipement (Machines Gourmandes)
- Classe les machines par ordre décroissant d'heures d'arrêt ou de coût cumulé.
- Une courbe cumulative affiche le pourcentage atteint.
- **Action Managériale :** Les 2 ou 3 premières machines qui dépassent 50% de la courbe cumulative doivent faire l'objet d'un audit de conception, d'un rétrofit ou d'un renforcement immédiat du plan préventif (`Maintenance Préventive`).

### 4.2 Pareto par Famille de Défaillance (Symptômes & Causes)
- Répartition des pannes par nature :
  - *Mécanique :* Roulements, courroies, réducteurs, paliers.
  - *Électrique :* Disjoncteurs, variateurs, capteurs inductifs, relais.
  - *Hydraulique & Pneumatique :* Vérins, distributeurs, fuites de flexibles, baisse de pression.
  - *Automatisme & Programmation :* Défauts de bus, fins de course, blocs logiques.
- **Action Managériale :** Ajuster les formations des techniciens ou le stock de sécurité des pièces de rechange sur les familles les plus vulnérables.

---

## 5. Bonnes Pratiques d'Exploitation

1. **Régularité des Clôtures :** Un BT doit être clôturé dans les 24 heures suivant la fin de l'intervention pour garantir la fraîcheur des données de Pareto hebdomadaire.
2. **Précision des Diagnostics :** Éviter les termes génériques comme *« machine en panne »* ou *« réparation faite »*. Renseigner le composant exact et le symptôme pour fiabiliser le catalogue de pannes.
3. **Analyse Mensuelle :** Organiser chaque début de mois une revue de Pareto avec la production pour décider des actions correctives de fond (Plans d'Amélioration Continue).
