---
id: page-templates-machines
groupId: 02-parc-machines
groupTitle: Parc Machines, Blueprints & Architecture 3-Tiers
docType: page
audience: user
tabId: templates
title: Modèles / Templates de Machines (Tier 1 — Niveau B)
subtitle: Catalogue des modèles constructeurs rattachés aux Familles de Machines
summary: Guide opérationnel du référentiel des Templates de machines permettant d'unifier les modèles identiques (machines jumelles) et de générer automatiquement leurs codes et Blueprints.
relatedTabs:
  - families
  - blueprints
  - machines
---

# Référentiel des Modèles / Templates de Machines (`Tier 1 — Niveau B`)

## 1. Rôle de cet Écran

Au sein d'une même **Famille de Machines** (ex. `FAM-01 — Rectifieuses`), votre usine peut posséder plusieurs modèles constructeurs différents. L'écran **Modèles (Templates)** définit chaque modèle standard afin de regrouper les **machines jumelles** qui partagent la même conception technique.

**Pourquoi est-ce essentiel ?**
- Si vous possédez 4 rectifieuses identiques du modèle **`TPL-RCF100`**, vous ne créez le **Template `TPL-RCF100`** et son **Blueprint technique** qu'une seule fois.
- Ensuite, chaque machine physique créée sous ce modèle recevra automatiquement un code séquentiel propre : **`RCF100-01`**, **`RCF100-02`**, **`RCF100-03`**, **`RCF100-04`**, et héritera instantanément des plans et gammes du modèle.

---

## 2. Fonctionnalités Clés de l'Écran

### A. Créer un Modèle / Template Constructeur
1. Cliquez sur le bouton ambre **« + Nouveau Template »** en haut à droite (ou utilisez le raccourci `+` depuis une ligne de **Famille**).
2. Choisissez la **Famille Parente** (ou créez-la à la volée via le lien `+ Nouvelle Famille`).
3. Saisissez le **Code Template** (ex. `TPL-HYD200` ou `RCF100`) : ce code servira de préfixe automatique pour numéroter les futures machines de ce modèle.
4. Indiquez le **Libellé complet du modèle** (ex. `Presse Hydraulique 200 Tonnes Double Effet`).

### B. Passerelle Directe vers les `Blueprints` et les `Machines`
Sur chaque ligne de Template :
- **Badge Famille Parente (Col. D)** : Permet de remonter en 1 clic vers la famille d'origine.
- **Badge Nb Machines (Col. E)** : Affiche le nombre d'équipements physiques de ce modèle installés dans l'usine ; cliquez dessus pour les afficher dans **Machines Enregistrées**.
- **Action Rapide `+ Blueprint`** : Le bouton d'action rapide à droite de la ligne ouvre directement la création d'un **Blueprint (Jumeau Cognitif)** pré-configuré pour ce modèle et sa famille.

---

## 3. Règles de Gouvernance

- **Protection Référentielle** : Un Template lié à des machines (actives ou archivées) ou à des Blueprints ne peut pas être supprimé par erreur.
- **Export Excel Miroir** : Le bouton **« Export Excel »** génère la table exacte des Templates avec leurs compteurs de Blueprints et de Machines associés.
