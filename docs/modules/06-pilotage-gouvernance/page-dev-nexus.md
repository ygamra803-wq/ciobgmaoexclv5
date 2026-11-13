---
id: page-dev-nexus
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance & Gouvernance
docType: architecture
audience: developer
tabId: nexus
title: Spécification Technique — Nexus BOM & Jumeaux Numériques (As-Built SSOT)
summary: Architecture de la nomenclature réelle As-Built et des jumeaux numériques. Fonction d'unification buildUnifiedMachineNexusElements, analyse d'écarts théorique/réel avec le Blueprint, algorithme de duplication aux jumeaux et passerelles 1-clic vers les BT curatifs et préventifs.
relatedTabs:
  - nexus
  - dashboard
  - machines
  - validation_center
---

# 💻 Spécification Développeur : Nexus BOM & Jumeaux Numériques (`#nexus`)

> **Public :** Architectes Systèmes, Développeurs Core & Modèles IA.  
> **Composant source :** `src/presentation/pages/system/NexusView.tsx`  
> **Moteurs métier :** `src/core/domain/machineNexusDomain.ts`, `src/utils/activeMachines.ts`.  
> **Clés SSOT :** `STORAGE_KEYS.MACHINE_ELEMENTS_LEDGER`, `STORAGE_KEYS.WAREHOUSE_ITEMS`, `STORAGE_KEYS.BLUEPRINTS_V2`.

---

## 1. Philosophie & Rôle Stratégique au Sein du Pilotage

Dans **CIOB GMAO Nexus v5.0.2**, `NexusView` est la **tour de contrôle de l'anatomie physique As-Built** des machines de production.

Il matérialise le pont temps réel entre la théorie d'ingénierie (`Blueprint`), le stock magasin (`warehouseItems`), et l'exploitation atelier (`machineElementsLedger`) :

```text
┌────────────────────────────────────────────────────────┐
│              BLUEPRINT (Théorie Cognitive)             │
│        Composants, Pièces et PDR théoriques prévus      │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   NEXUS VIEW (As-Built)                │
│    Nomenclature réelle unifiée de la machine en service│
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│ WAREHOUSE_ITEMS (Entrepôt)│ │ MACHINE_ELEMENTS_LEDGER  │
│ Organes montés (INSTALLE) │ │ Organes, pièces et PDR   │
│ N° de Série, santé, usure │ │ montés physiquement      │
└───────────────────────────┘ └──────────────────────────┘
```

---

## 2. Algorithme d'Unification As-Built (`buildUnifiedMachineNexusElements`)

Pour éviter d'avoir deux listes séparées et incohérentes de ce qui est monté sur une machine, le sélecteur `buildUnifiedMachineNexusElements` fusionne dynamiquement deux sources de données :

1. **Le registre d'atelier (`machineElementsLedger`) :** Pièces et composants montés directement sur l'équipement.
2. **Les éléments physiques d'entrepôt (`warehouseItems`) :** Organes complets dont le statut est `INSTALLE` et rattachés à cette machine (`id_machine === selectedMachineId`).
3. **Résultat :** Une nomenclature exhaustive dédupliquée avec statut opérationnel, criticité, durée de vie résiduelle et historique d'installation.

---

## 3. Analyse d'Écarts : Théorique vs Réel (Gap Analysis)

Nexus compare en temps réel la configuration physique de la machine avec le `Blueprint` modèle :

$$\Delta_{\text{BOM}} = \text{Éléments Présents sur Machine} \setminus \text{Éléments Théoriques du Blueprint}$$

- 🟢 **Composants Conformes :** Éléments physiques montés correspondant exactement aux préconisations d'ingénierie.
- 🟡 **Composants Manquants :** Éléments requis par le Blueprint mais non encore déclarés montés sur la machine.
- 🟠 **Substitutions Détectées :** Pièces montées avec une référence alternative (ex. moteur ABB installé à la place d'un Siemens d'origine).
- **Modale d'Écarts (`isGapModalOpen`) :** Permet à l'ingénieur méthodes d'aligner en 1 clic le réel avec la théorie ou d'enrichir le Blueprint avec le retour d'expérience terrain.

---

## 4. Algorithme de Duplication vers les Machines Jumelles (`onDuplicateBOMToTwins`)

Dans une usine disposant de plusieurs lignes de production identiques (ex. Ligne Extrusion 1, Ligne Extrusion 2, Ligne Extrusion 3) :
1. L'ingénieur méthodes modélise complètement la nomenclature As-Built sur la première machine maîtresse.
2. Il clique sur **« Dupliquer vers les Machines Jumelles »**.
3. La fonction identifie toutes les machines actives partageant le même `id_family` ou le même `id_templates`.
4. Elle instancie les lignes de registre `machineElementsLedger` correspondantes pour chaque machine jumelle tout en isolant les numéros de série unitaires.

---

## 5. Passerelles d'Action Directe (Action Hooks)

Nexus n'est pas un visualiseur passif ; il déclenche directement les processus de maintenance :
- **Remplacement 1-Clic via Sortie Magasin (`onNavigateToQuickSortie`) :** Prélèvement direct en magasin avec pré-remplissage automatique de la machine et du composant.
- **Déclenchement d'un BT Curatif (`onCreateCorrectiveFromNexus`) :** Création immédiate d'un ordre de travail ciblant précisément le composant défaillant.
- **Déclenchement d'un Plan Préventif (`onCreatePreventiveFromNexus`) :** Rattachement direct d'une tâche d'entretien systématique sur l'élément.
