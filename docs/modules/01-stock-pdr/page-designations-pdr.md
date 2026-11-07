---
id: page-designations-pdr
groupId: 01-stock-pdr
groupTitle: Stock PDR, Mouvements & Commandes (PO)
docType: page
audience: user
tabId: designations
title: Référentiel des Désignations PDR
subtitle: Sous-familles normalisées d'articles et préfixes intelligents (Niveau 2)
summary: Guide d'utilisation du référentiel des Désignations PDR permettant d'organiser les sous-catégories techniques sous chaque Type PDR et d'accéder directement aux stocks et mouvements.
relatedTabs:
  - types
  - stock
  - sortie
---

# Référentiel des Désignations PDR (`Classification Niveau 2`)

## 1. Rôle de cet Écran

Situé entre les **Types PDR** (Niveau 1) et les **Articles de Stock** (Niveau 3), l'écran **Désignations PDR** définit la nature fonctionnelle précise des pièces au sein d'une famille technique.

**Exemple concret de hiérarchie :**
- **Type PDR (Niveau 1)** : `TYP-01 — Roulements & Paliers`
  - **Désignation PDR (Niveau 2)** : `ROUL-01 — Roulement Rigide à Billes`
    - **Articles de Stock (Niveau 3)** : `SKF 6204-2RS`, `SKF 6205-2RS`, `FAG 6308-2Z`...
  - **Désignation PDR (Niveau 2)** : `ROUL-02 — Palier Auto-Aligneur Fonte (UCP)`
    - **Articles de Stock (Niveau 3)** : `UCP 205`, `UCP 208`...

---

## 2. Fonctionnalités Clés de l'Écran

### A. Préfixe Intelligent Automatique
Lorsque vous créez une nouvelle **Désignation PDR** et choisissez son **Type PDR parent** :
- Le système génère automatiquement un **Code Désignation parlant** basé sur les premières lettres du Type suivi d'un compteur séquentiel (ex. `ROUL-01`, `COUR-02`, `ELEC-04`).
- Cela garantit une codification propre, standardisée et immédiatement lisible par tous les magasiniers et techniciens.

### B. Supervision Instantanée de l'État du Stock par Désignation
Pour chaque Désignation PDR, le tableau récapitule :
- **Le Nombre de Références (Articles)** appartenant à cette désignation.
- **Le Cumul des Quantités en Stock** sur l'ensemble de ces références.
- **Les Alertes de Rupture ou Seuil Minimum** : Si une référence de cette désignation est en rupture, un badge d'alerte s'affiche immédiatement sur la ligne.

### C. Actions Rapides sans Quitter l'Écran
Depuis chaque ligne de Désignation PDR, vous pouvez :
1. **Voir les Articles (`Stock`)** : Ouvrir le catalogue **Stock Articles** pré-filtré sur cette désignation exacte.
2. **Créer un Article (`+ Article`)** : Ouvrir la fenêtre d'ajout d'article avec le **Type** et la **Désignation** déjà pré-sélectionnés.
3. **Déclencher un Mouvement (`Entrée` / `Sortie`)** : Lancer rapidement une opération magasin sur l'un des articles de cette sous-famille.

---

## 3. Bonnes Pratiques d'Organisation

- **Ne confondez pas Désignation et Référence Dimensionnelle** :
  - La **Désignation PDR** décrit la *fonction* ou le *type géométrique* (ex. `Courroie Trapézoïdale Crantée`).
  - L'**Article de Stock** porte la *dimension exacte ou référence constructeur* (ex. `Courroie XPA 1250`).
- Cette séparation évite de multiplier inutilement des centaines de désignations et rend la recherche au guichet magasin ultra-rapide.
