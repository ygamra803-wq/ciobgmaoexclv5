---
id: page-dev-injection-excel
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_injection
title: Spécification Technique — Moteur d'Injection & Validation Excel
summary: Architecture du pipeline d'ingestion de données Excel. Normalisation des en-têtes, validation de schéma Zod, dry-run preview sans altération d'état et injection par lot sécurisée.
relatedTabs:
  - settings_injection
  - settings
  - stock
---

# 💻 Spécification Développeur : Injection & Validation Excel (`#settings_injection`)

> **Public :** Développeurs Données, Architectes Intégration & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsInjectionTab.tsx`  
> **Services sous-jacents :** `src/application/services/excelEngineService.ts`, `src/services/dataIntegrityService.ts`.  
> **Bibliothèque de parsing :** `xlsx` (SheetJS).

---

## 1. Pipeline d'Ingestion en 4 Étapes

L'injection de classeurs Excel externes suit un pipeline de validation strict pour empêcher toute corruption de la base de données :

```text
[ Fichier .XLSX / .XLS Fourni par l'Utilisateur ]
                    │
                    ▼
[ 1. Parsing & Normalisation des En-têtes ]
  • Détection automatique des onglets standards :
    'STOCK_PDR', 'PARC_MACHINES', 'MOUVEMENTS', 'ZONES'
  • Normalisation en minuscules et suppression des accents/espaces.
                    │
                    ▼
[ 2. Contrôle de Schéma & Validation Zod ]
  • Vérification des types obligatoires (nombres > 0, dates ISO).
  • Détection des doublons sur les identifiants clés (code_article, id_machine).
                    │
                    ▼
[ 3. Prévisualisation Sécurisée (Dry-Run Preview) ]
  • Aucun enregistrement n'est écrit dans useGmaoStore.
  • Affichage d'un rapport de validation :
    - Lignes valides prêtes à injecter
    - Lignes avec avertissements mineurs
    - Lignes bloquantes avec motif d'erreur précis
                    │
                    ▼
[ 4. Insertion par Lot Transactionnelle ]
  • Appel DataGateway.bulkInsert() sous contrôle d'intégrité référentielle.
  • Journalisation d'un événement 'BULK_IMPORT' dans STORAGE_KEYS.AUDIT_EVENTS.
```

---

## 2. Règles de Normalisation des Colonnes

Le moteur de correspondance tolère les variations courantes des fichiers d'usines :

| Entité Cible | Champs Canoniques | Alias Reconnus Automatiquement |
| :--- | :--- | :--- |
| **Articles PDR** | `code_article`, `designation`, `stockInitial`, `prix_unitaire`, `seuil_alerte` | `code`, `ref`, `article`, `qte_initiale`, `pu`, `prix_achat`, `min` |
| **Machines** | `id_machine`, `nom`, `id_zone_default`, `puissance`, `annee` | `code_machine`, `equipement`, `zone`, `kw`, `annee_mise_service` |
| **Zones** | `id_zone`, `code_zone`, `libelle`, `type` | `code`, `atelier`, `nom_zone`, `secteur` |

---

## 3. Gestion des Conflits d'Importation

L'administrateur peut choisir entre deux politiques lors de l'injection :
1. **Mode Écrasement / Mise à Jour (`UPSERT`) :** Si un article existe déjà (`même code_article`), ses métadonnées (désignation, seuil, emplacement) sont mises à jour sans altérer l'historique de ses mouvements passés.
2. **Mode Ignorer les Doublons (`SKIP`) :** Les lignes déjà existantes sont sautées et répertoriées dans le rapport final.
