---
id: group-07-settings-systeme-architecture
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
title: Architecture & Spécifications Techniques — Groupe 07 : Paramètres Système & Audit Ledger
summary: Spécification technique d'architecture pour le groupe 07. Couvre la persistance SSOT, la politique Zero Silent Seed, la synchronisation réseau local LAN (server.ts), la sérialisation atomique writeQueue, la sécurité token, le registre d'audit append-only AUDIT_EVENTS et la gestion de cache L1/L2/L3.
relatedTabs:
  - settings
  - settings_mvt_logic
  - settings_injection
  - settings_directory
  - settings_matching
  - settings_json_editor
  - settings_backup_audit
  - settings_admin
  - settings_performance
  - settings_currency
---

# 🏛️ Group 07 : Paramètres Système, Sauvegardes & Registre d'Audit — Spécifications Architecturales

> **Destination :** Développeurs, Architectes Logiciels, Auditeurs Système & Modèles IA.  
> **Périmètre applicatif :** Moteur de persistance, synchronisation LAN multi-postes, intégrité du stockage local (LocalStorage / IndexedDB / SQLite / JSON), registre d'audit append-only immuable (`AUDIT_EVENTS`), coffre-fort maître AES-GCM, et supervision des performances.

---

## 1. Vue d'Ensemble & Rôle Architectural Fondamental

L'écran des **Paramètres Système (`SettingsView`)** n'est pas une simple page de préférences graphiques ; c'est le **centre névralgique de commande et d'intégrité de CIOB GMAO v4** :

1. **Garant du Single Source of Truth (SSOT) :**
   - Toutes les entités de l'usine transitent exclusivement par `src/application/DataGateway.ts`, `src/store/useGmaoStore.ts`, et les 36+ clés canoniques `STORAGE_KEYS`.
   - **Excel n'est PAS la base de données interne :** Il sert strictement de format d'import initial, d'export de reporting, et de miroir de sauvegarde hôte (`excelMirrorService.ts`).
2. **Politique Absolue « Zéro Injection Silencieuse » (Zero Silent Seed) :**
   - Un état vide (`0` machine, `0` article, `0` intervention) est un état de production nominalement valide.
   - En mode usine réelle (`START_MODE === 'empty'`), le système ne réinjecte **jamais** de données démo de manière subreptice lors des rechargements (`F5`). Les données démo ne se chargent que sur action manuelle explicite de l'administrateur.
3. **Tolérance aux Pannes & Écritures Atomiques (`server.ts`) :**
   - Toutes les mutations vers le disque physique de l'hôte passent par une file sérialisée (`writeQueue`) écrivant dans un fichier temporaire `.tmp` avant renommage atomique (`fs.renameSync`), neutralisant tout risque de corruption lors d'une coupure électrique d'atelier.
4. **Registre d'Audit Append-Only (`AUDIT_EVENTS`) :**
   - Journalisation institutionnelle obligatoire (avant/après, auteur, horodatage UTC ISO 8601) pour toutes les opérations critiques (stocks, prix, archivages, approbations, budgets).

---

## 2. Topologie Réseau Local (LAN Topology)

```text
┌──────────────────────────┐          ┌──────────────────────────┐
│ Tablette Atelier Tech 1  │          │  Poste Bureau Méthodes   │
│ Client Web React (SPA)   │          │  Client Web React (SPA)  │
└────────────┬─────────────┘          └────────────┬─────────────┘
             │                                     │
             │ HTTP / REST                         │ HTTP / REST
             │ X-GMAO-API-TOKEN                    │ X-GMAO-API-TOKEN
             │ x-gmao-role: TECHNICIEN             │ x-gmao-role: ADMIN
             ▼                                     ▼
┌────────────────────────────────────────────────────────────────┐
│             SERVEUR HÔTE LAN INDUSTRIEL (server.ts)            │
│  - Port 3000 (Express API + Vite Dev Middleware)               │
│  - Contrôle d'Accès Fail-Closed (serverRbacPolicy.ts)          │
│  - Allowlist d'Entités Strictes (ALLOWED_ENTITIES)             │
│  - Détection de Conflit de Concurrence (409 Conflict)          │
│  - File d'Écriture Sérialisée Atomique (writeQueue)            │
└──────────────────────────────┬─────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────┐
│               STOCKAGE PHYSIQUE DU SERVEUR HÔTE                │
│  database.json (SSOT) • database.json.tmp • database.json.bak  │
└────────────────────────────────────────────────────────────────┘
```

---

## 3. Découpage Modulaire des 10 Sections de Paramètres

Chaque onglet des paramètres traite d'une responsabilité technique isolée :

1. **Supervision & Stockage (`#settings`) :** Santé du stockage, ratio d'occupation, et commutateur Usine Vierge vs Démo.
2. **Logique des Mouvements (`#settings_mvt_logic`) :** Invariant stock mathématique et 5 flux transactionnels.
3. **Injection Données Excel (`#settings_injection`) :** Validation de schéma et import sécurisé par lot.
4. **Dossier Partagé & Sync LAN (`#settings_directory`) :** Statut de communication avec le serveur hôte et miroir disque.
5. **Appairage & Audit (`#settings_matching`) :** Détection et rattachement des clés étrangères orphelines.
6. **Base JSON (`#settings_json_editor`) :** Consultation brute et correction d'urgence du store.
7. **Sauvegardes & Audit Ledger (`#settings_backup_audit`) :** Journal append-only immuable et instantanés JSON.
8. **Compte Admin & Coffre-Fort (`#settings_admin`) :** Master PIN, chiffrement AES-GCM 256 bits et protection bruteforce.
9. **Performance & Cache (`#settings_performance`) :** Gestionnaire de cache L1/L2/L3 et monitoring temps de réponse.
10. **Devise & Finance (`#settings_currency`) :** Multi-devises ISO 4217 et taux de change historiques.
