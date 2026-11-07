---
id: page-blueprints-machines
groupId: 02-parc-machines
groupTitle: Parc Machines, Blueprints & Architecture 3-Tiers
docType: page
audience: user
tabId: blueprints
title: Blueprints Machines — Jumeau Cognitif (Tier 3)
subtitle: Plans techniques, nomenclature théorique (Organes/Pièces/PDR), gammes préventives types et pannes connues
summary: Guide opérationnel des Blueprints (Tier 3) : comment concevoir l'empreinte technique théorique d'un modèle de machine et déployer ses gammes préventives en 1 clic sur tout le parc actif.
relatedTabs:
  - templates
  - machines
  - nexus
  - preventive
---

# Blueprints Machines — Le Jumeau Cognitif d'Ingénierie (`Tier 3`)

## 1. Qu'est-ce qu'un `Blueprint` dans CIOB GMAO v4 ?

Le **Blueprint (`BPT-XX`)** est la **fiche d'ingénierie théorique et évolutive** associée à un modèle de machine (**Template**).

**Distinction fondamentale à retenir :**
- Un **Blueprint est virtuel** : il ne dépend ni d'un atelier géographique (**Zone**), ni d'un technicien particulier.
- Il rassemble en un seul dossier structuré en **6 onglets** tout le savoir technique applicable aux machines de ce modèle :
  1. **Spécifications Techniques (`Specs`)** : Référence du plan (`ref_plan`), révision (`Rev-A`), type de schéma (`Mécanique`, `Électrique`, `Hydraulique`), puissance, course, moteur et dimensions.
  2. **Organes Théoriques (`Components`)** : Liste des sous-ensembles complets prévus par le constructeur (ex. *Moteur Broche 15 kW*, *Pompe Hydraulique Principale*).
  3. **Pièces Détachées Théoriques (`Parts`)** : Pièces mécaniques d'usure montées dans ces organes (ex. *Arbre d'entraînement*, *Pignon conique*).
  4. **Articles PDR Recommandés (`PDR`)** : Pièces de rechange du magasin (`Stock PDR`) nécessaires à la maintenance de ce modèle, avec leur **Criticité** et l'organe parent associé.
  5. **Plan Préventif Type (`Gammes PM`)** : Opérations préventives standards (Nettoyage `N`, Graissage `G`, Contrôle `C`, Remplacement `R`, Étalonnage `E`) avec leur fréquence (`Hebdomadaire`, `Mensuel`, `Trimestriel`, `Semestriel`, `Annuel`) et durée estimée.
  6. **Pannes Courantes & Remèdes (`Retex`)** : Base de connaissances des défaillances typiques de ce modèle avec l'action corrective recommandée.

---

## 2. Fonctionnalités Majeures & Automatismes

### A. Inspecter un Blueprint en Vue 360° (`Loupe / Dossier`)
En cliquant sur une ligne de Blueprint ou sur l'action **« Inspecter »**, vous ouvrez le lecteur technique complet qui croise :
- La nomenclature théorique du Blueprint.
- La disponibilité réelle en magasin (`Stock PDR` et `Entrepôt`) des pièces requises par ce Blueprint.
- La liste de toutes les **Machines Physiques** de l'usine qui utilisent actuellement ce Blueprint.

### B. Déployer le Plan Préventif vers Toutes les Machines Actives en 1 Clic
C'est l'un des automatismes les plus puissants de l'application :
1. Dans l'onglet **Plan Préventif Type** d'un Blueprint, définissez vos opérations récurrentes (ex. *Contrôle tension courroie — Mensuel — 15 min*).
2. Cliquez sur le bouton **« Appliquer le Plan aux Machines Actives »** :
   - Le système identifie toutes les machines **actives** rattachées à ce Blueprint (ou à son Template).
   - Il génère automatiquement les tâches correspondantes dans le **Planning Préventif Annuel** de chaque machine, **sans jamais créer de doublon** si une tâche existe déjà.

---

## 3. Lien Direct avec l'Arborescence `Nexus`

Dès qu'un Blueprint est associé à une machine enregistrée :
- Vous pouvez ouvrir l'écran **Arborescence Nexus** (`#nexus`) et lancer l'**Analyse d'Écart (`Gap Analysis`)** pour comparer ce qui est prévu dans le **Blueprint théorique** avec ce qui est **réellement monté** sur la machine dans l'atelier, puis synchroniser la nomenclature en un clic.
