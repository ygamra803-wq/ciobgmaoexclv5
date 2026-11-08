---
id: page-dev-matching-audit
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_matching
title: Spécification Technique — Moteur d'Appairage & Audit d'Intégrité Référentielle
summary: Architecture du moteur de détection et de réconciliation des enregistrements orphelins. Algorithmes de contrôle des clés étrangères (machines ➔ zones, mouvements ➔ articles) et modale de réassignation AuditRelinkModal.
relatedTabs:
  - settings_matching
  - settings
  - machines
  - stock
---

# 💻 Spécification Développeur : Appairage & Intégrité Référentielle (`#settings_matching`)

> **Public :** Développeurs Données, Auditeurs d'Architecture & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsMatchingTab.tsx`  
> **Modales associées :** `src/presentation/pages/settings/components/AuditModals.tsx` (`AuditRelinkModal`, `AuditZoneModal`).  
> **Service de diagnostic :** `src/services/dataIntegrityService.ts`.

---

## 1. Rôle du Scanner d'Intégrité Référentielle

Au fil des années d'exploitation d'une usine (renommages d'ateliers, suppression d'anciens articles de stock, réorganisation de lignes), des incohérences de clés étrangères (`FK`) peuvent apparaître dans les bases de données non surveillées.

Le moteur d'**Appairage & Audit** exécute un scan relationnel complet pour identifier 4 types d'enregistrements orphelins :

```text
┌────────────────────────────────────────────────────────┐
│             SCANNER D'INTÉGRITÉ RÉFÉRENTIELLE          │
└──────────────────────────┬─────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
[ 1. Machines ]     [ 2. Mouvements ]   [ 3. Techniciens ]
id_zone invalide    id_article orphelin id_zone inexistante
ou code renommé     ou supprimé         ou mal orthographiée
       │                   │                   │
       └───────────────────┼───────────────────┘
                           ▼
            [ RAPPORT D'APPAIRAGE DYNAMIQUE ]
        - Liste des enregistrements en anomalie
        - Suggestions intelligentes de réassignation
        - Modale de réconciliation (AuditRelinkModal)
```

---

## 2. Algorithmes de Détection des Clés Étrangères Invalides

```typescript
// Exemple de diagnostic sur les machines :
const zoneIdsSet = new Set(zones.map((z) => String(z.id_zone).toUpperCase()));
const orphanedMachines = machines.filter((m) => {
  const machineZone = String(m.id_zone_default || m.id_zone || '').trim().toUpperCase();
  return Boolean(machineZone && !zoneIdsSet.has(machineZone));
});

// Exemple de diagnostic sur les mouvements :
const articleCodesSet = new Set(rawStock.map((a) => String(a.code_article).toUpperCase()));
const orphanedMovements = mouvements.filter((m) => {
  const mvtArticle = String(m.code_article || m.reference || '').trim().toUpperCase();
  return Boolean(mvtArticle && !articleCodesSet.has(mvtArticle));
});
```

---

## 3. Mécanisme de Réconciliation Sécurisée (`AuditRelinkModal`)

Lorsqu'une anomalie est confirmée par l'administrateur :
1. La modale présente l'enregistrement orphelin et propose une **liste déroulante d'entités cibles actives valides**.
2. Un algorithme de similarité de Levenshtein suggère en priorité l'entité la plus proche phonétiquement (ex. `LAMINOIR_01` ➔ suggère `Z-PROD-01 Laminoir`).
3. La validation réécrit la clé étrangère de manière transactionnelle via `DataGateway` et consigne un événement `ENTITY_RELINK` dans `AUDIT_EVENTS`.
