---
id: page-groupes-pieces
groupId: 05-entrepot-organes
groupTitle: Entrepôt Organes & Pièces Détachées
docType: page
audience: user
tabId: part_groups
title: Groupes de Pièces d'Entrepôt (Niveau 1 — Parts)
subtitle: Classification supérieure des pièces mécaniques, d'assemblage et d'usinage atelier
summary: Guide d'utilisation de l'écran Groupes Parts (PartGroupView.tsx — #part_groups), Niveau 1 de la hiérarchie des pièces d'entrepôt (PartGroup ➔ PartType ➔ PartDesignation ➔ Entrepôt) avec domaine technique et politiques d'atelier.
relatedTabs:
  - part_types
  - part_designations
  - entrepot
  - corrective_atelier
---

# 🛠️ Guide Utilisateur : Groupes de Pièces (`#part_groups` — Niveau 1 Parts)

> **Module :** Entrepôt Organes & Pièces Détachées  
> **Identifiant d'accès :** `#part_groups` (`PartGroupView.tsx`)  
> **Clé de stockage SSOT :** `STORAGE_KEYS.PART_GROUPS = 'gmao_part_groups_v1'`  

---

## 1. Pourquoi un Référentiel `Groupes Parts` Indépendant ?

Dans l'**Entrepôt Technique** de **CIOB GMAO Nexus v5.0.2**, les équipements stockés se divisent en deux grandes familles physiques qui possèdent chacune leur propre hiérarchie à 4 niveaux :

1. **Branche A — `Components` (Organes complets rotatifs : `#comp_groups ➔ #comp_families ➔ #comp_templates ➔ #entrepot`)** :
   - Moteurs électriques, réducteurs, pompes, variateurs.
   - Caractérisés par une **plaque signalétique** (`tension_nominale`, `courant_nominal_a`, `indice_protection`, `type_fixation`) et un **mode de réparation par défaut** (`REBOBINAGE_EXTERNE`, `REVISION_ATELIER`, `ECHANGE_STANDARD`).
2. **Branche B — `Parts` (Pièces mécaniques, structurelles & usinables : `#part_groups ➔ #part_types ➔ #part_designations ➔ #entrepot`)** :
   - Organes mécaniques de transmission (`GRP-PRT-MEC`), éléments de fixation structurelle (`GRP-PRT-FIX`), composants hydrauliques/pneumatiques secondaires (`GRP-PRT-FLUID`), et sous-ensembles électromécaniques (`GRP-PRT-ELEC`).
   - Caractérisés par un **dossier d'atelier d'usinage** (`matiere_nuance`, `ref_plan`, `dimensions_brut`, `traitement_thermique`) et la capacité d'être fabriqués ou rectifiés en interne via un **Bon de Réalisation / Rectification (`BR / RECT`)** dans l'Atelier Mécanique (`#corrective_atelier`).

Conserver `STORAGE_KEYS.PART_GROUPS` séparé de `COMP_GROUPS` et `PDR_GROUPS` garantit que les filtres de l'atelier mécanique et des pièces d'entrepôt ne soient jamais pollués par les groupes de moteurs ou les consommables de magasin.

---

## 2. Structure des Données d'un Groupe de Pièces (`IPartGroup`)

Chaque enregistrement dans **Groupes Parts** comprend :
- **Identifiant Canonique (`id_group`)** : Clé primaire normalisée (ex. `GRP-PRT-MEC`, `GRP-PRT-FIX`, `GRP-PRT-FLUID`, `GRP-PRT-ELEC`), lue de manière unifiée via `getGroupId` / `getGroupRecordId`.
- **Code Mnémonique (`code`)** : Code court métier (ex. `MEC-TRANS`, `FIX-ASSEM`, `HYD-PNEUM`, `ELEC-AUTO`).
- **Libellé & Description (`libelle`, `description`)** : Intitulé complet et périmètre technique du groupe.
- **Domaine Technique (`domaine_technique` — P3)** : Spécialité industrielle (`MECANIQUE`, `HYDRAULIQUE`, `PNEUMATIQUE`, `ELECTRIQUE`, `AUTOMATISME`).
- **Politiques Matérielles par Défaut (`default_policy_tags`)** : Combinaison de `REPAIRABLE`, `REPLACING` et/ou `MODIFYING` héritée par les types et désignations de pièces rattachés.

---

## 3. Navigation en Cascade (`Groupes Parts ➔ Types Parts ➔ Désignations ➔ Entrepôt`)

Depuis le tableau **Groupes Parts** :
1. **Badge « X Types »** : Indique le nombre de `Types de Pièces` (`PartType`) rattachés à ce groupe via `id_group`. Cliquez dessus pour ouvrir **Types Parts (`#part_types`)** filtré sur ce groupe.
2. **Badge « Y Désignations »** : Indique le nombre de désignations techniques (`PartDesignation`) appartenant aux types de ce groupe.
3. **Badge « Z en Entrepôt »** : Indique le nombre d'éléments physiques (`nature: 'PART'`) présents dans l'entrepôt. Cliquez dessus pour ouvrir **Entrepôt (`#entrepot`)** directement sur l'onglet **Parts** filtré sur ce groupe.

---

## 4. Protection Contre les Orphelins (`Safe Archive`)

- **Groupe sans enfant (`0` Type rattaché)** : Peut être supprimé définitivement.
- **Groupe relié à des `PartTypes` ou à des pièces en entrepôt** : La suppression destructive est bloquée ; le groupe passe en **Désactivation sécurisée (`is_active: false`)**, préservant l'intégrité référentielle de tous les plans et pièces d'atelier existants.
