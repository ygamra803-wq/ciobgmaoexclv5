---
id: page-dev-settings-backup-audit
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_backup_audit
title: Spécification Technique — Sauvegardes & Registre d'Audit Append-Only
summary: Architecture du moteur de sauvegarde et de traçabilité immuable. Invariant append-only de STORAGE_KEYS.AUDIT_EVENTS, points de déclenchement obligatoires, sérialisation des états avant/après et protocole de restauration.
relatedTabs:
  - settings_backup_audit
  - settings
  - validation_center
---

# 💻 Spécification Développeur : Sauvegardes & Audit Ledger (`#settings_backup_audit`)

> **Public :** Développeurs Core, Architectes Sécurité, Auditeurs Conformité & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsBackupAuditTab.tsx`  
> **Services sous-jacents :** `src/utils/AuditService.ts`, `src/utils/BackupService.ts`.  
> **Clés SSOT :** `STORAGE_KEYS.AUDIT_EVENTS`, `STORAGE_KEYS.BACKUPS`.

---

## 1. Registre d'Audit Append-Only (`AUDIT_EVENTS`)

Le registre d'audit institutionnel de **CIOB GMAO Nexus v5.0.2** garantit la traçabilité absolue de toute mutation sensible de l'appareil de production :

```typescript
export interface AuditEvent {
  id: string;               // Identifiant unique (ex. 'EVT-1715091234-ABCD')
  ts: string;               // Horodatage ISO 8601 UTC
  actorId: string;          // Identifiant de l'utilisateur ayant exécuté l'action
  actorName: string;        // Nom complet affiché
  actorRole: UserRole;      // Rôle système (ADMIN, SUPERVISEUR, etc.)
  actionType: AuditAction;  // 'STOCK_ADJUST' | 'MACHINE_ARCHIVE' | 'VALIDATION_APPROVED' | ...
  entityType: string;       // 'MACHINE' | 'ARTICLE' | 'INTERVENTION' | 'BUDGET' | 'USER'
  entityId: string;         // Identifiant de l'entité ciblée
  before: any;              // État sérialisé avant l'opération
  after: any;               // État sérialisé après l'opération
  meta?: Record<string, any>; // Contexte optionnel (adresse IP, motif de modification)
}
```

### Invariants Techniques Non-Négociables :
1. **Append-Only Stricte :** Aucune méthode ne permet d'éditer ou d'altérer un événement enregistré (`updateAuditEvent` n'existe pas).
2. **Génération d'Identifiant Déterministe :** Format `EVT-<timestamp>-<randomHex>`.
3. **Capture Avant/Après :** Permet une vérification différentielle immédiate et un éventuel retour arrière documenté.

---

## 2. Points de Déclenchement Obligatoires

Toute opération appartenant à la liste suivante doit impérativement appeler `AuditService.recordEvent()` :

| Opération Métier | `actionType` | `entityType` | Contenu Capturé |
| :--- | :--- | :--- | :--- |
| **Ajustement de Stock Initial** | `STOCK_ADJUST` | `ARTICLE` | Ancien stock/prix vs nouveau stock/prix |
| **Archivage / Restauration Machine** | `MACHINE_ARCHIVE` | `MACHINE` | État machine et statut d'activation |
| **Visa Maker-Checker (BT / PM)** | `VALIDATION_APPROVED` | `INTERVENTION` | Pièces déclarées vs pièces réconciliées |
| **Ajustement Budgétaire** | `BUDGET_UPDATE` | `BUDGET` | Ancienne dotation vs nouvelle dotation et motif |
| **Création / Désactivation Utilisateur** | `USER_LIFECYCLE` | `USER` | Rôle et statut d'activité |

---

## 3. Moteur de Sauvegarde & Restauration (`BackupService.ts`)

### 3.1 Génération d'Instantané Complet (Full Snapshot)
- Agrège l'ensemble des 36+ collections `STORAGE_KEYS` en un document unifié.
- Calcule une empreinte de contrôle (checksum SHA-256) pour détecter toute altération du fichier téléchargé.

### 3.2 Protocole de Restauration
1. Décompression et validation du checksum.
2. Vérification de la compatibilité de version du schéma (`schemaVersion`).
3. Écriture atomique dans le store via `DataGateway.restoreFullState()`.
4. Enregistrement d'un événement critique `RESTORE_FULL_STATE` dans le journal d'audit.
