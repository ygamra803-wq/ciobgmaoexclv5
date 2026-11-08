---
id: page-dev-settings-overview
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings
title: Spécification Technique — Supervision du Stockage & Démarrage Usine
summary: Architecture de la supervision du stockage local et des modes de démarrage. Gestion multi-niveaux LocalStorage/IndexedDB, contrat clearAllForRealFactory vs loadDemoData, et politique stricte Zero Silent Seed.
relatedTabs:
  - settings
  - settings_backup_audit
  - dashboard
---

# 💻 Spécification Développeur : Supervision & Démarrage Usine (`#settings`)

> **Public :** Développeurs Core, Ingénieurs DevSecOps & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsOverviewTab.tsx`  
> **Services associés :** `src/application/DataGateway.ts`, `src/infrastructure/database/IndexedDBService.ts`, `src/utils/storageService.ts`.  
> **Constante clé :** `STORAGE_KEYS.START_MODE` (`'empty' | 'demo'`).

---

## 1. Architecture du Stockage Hybride Multi-Niveaux

Le stockage applicatif utilise une architecture résiliente à double niveau :

```text
┌────────────────────────────────────────────────────────┐
│                   DataGateway.ts (SSOT)                │
└───────────┬────────────────────────────────┬───────────┘
            │                                │
            ▼ (Synchrone)                    ▼ (Asynchrone)
┌──────────────────────────┐     ┌───────────────────────────┐
│       LocalStorage       │     │         IndexedDB         │
│  - Clés d'état actif     │     │  - Documents volumineux   │
│  - Limite: ~5 à 10 Mo    │     │  - Quotas: > 500 Mo       │
│  - Lecture immédiate     │     │  - Base offline tolérante │
└──────────────────────────┘     └───────────────────────────┘
```

- En cas de dépassement de quota (`QuotaExceededError`), le service `storageService` active automatiquement une purge des caches de calculs secondaires non critiques sans altérer les tables d'inventaire ou d'audit.

---

## 2. Contrat de Démarrage Usine : Vierge vs Démo

### 2.1 Mode Usine Réelle Vierge (`onClearAllForRealFactory`)
Lors de la mise en production sur un site industriel :
1. Toutes les tables du store `useGmaoStore` sont réinitialisées à des tableaux vides `[]`.
2. Le compteur de toutes les collections affiche strictement `0`.
3. Le drapeau persistant `STORAGE_KEYS.START_MODE` est positionné à `'empty'`.
4. **Invariant Non-Négociable :** Même après rechargement violent du navigateur (`F5` ou redémarrage complet de l'hôte), aucun jeu d'essai n'est injecté automatiquement.

### 2.2 Mode Démonstration & Formation (`onLoadDemoData`)
- Utilisé exclusivement sur demande explicite de l'administrateur.
- Injecte un jeu complet cohérent : machines réelles d'extrusion et laminoir, stock PDR valorisé, arborescence Nexus, et historique d'interventions curatives et préventives.
- Possibilité de charger/purger section par section (`onLoadDemoSection` / `onClearDemoSection`).

---

## 3. Métriques de Santé & Détection d'Anomalies

L'onglet calcule en temps réel :
- **Taux d'occupation du stockage client (Ko et % du quota navigateur).**
- **Nombre total d'enregistrements par collection** (machines, articles, mouvements, BT, DI, techniciens, zones).
- **Compteur d'anomalies de cohérence :** Articles avec stock négatif, mouvements sans article cible, ou machines orphelines de zone.
