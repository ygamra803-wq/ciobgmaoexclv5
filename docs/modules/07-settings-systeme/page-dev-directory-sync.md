---
id: page-dev-directory-sync
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_directory
title: Spécification Technique — Synchronisation Réseau Local LAN (server.ts)
summary: Architecture de la synchronisation multi-clients en réseau local d'atelier. Spécification des routes API Express, de l'authentification X-GMAO-API-TOKEN, des files d'écriture sérialisées et de la détection de conflits HTTP 409.
relatedTabs:
  - settings_directory
  - settings
  - settings_backup_audit
---

# 💻 Spécification Développeur : Synchronisation Réseau Local LAN (`#settings_directory`)

> **Public :** Développeurs Backend, Administrateurs Réseau Industriel & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsDirectoryTab.tsx`  
> **Serveur hôte :** `server.ts` (Node.js / Express sur port 3000).  
> **Politique de sécurité :** `src/core/security/serverRbacPolicy.ts`.

---

## 1. Topologie de Synchronisation Réseau Local

En atelier de fabrication, les techniciens équipés de tablettes WiFi et les chefs de poste sur PC communiquent avec une instance centrale de **CIOB GMAO v4** hébergée sur un PC serveur de l'usine :

```text
[ Client Web Tablette ] ──┐
                          │ HTTP REST + Headers
[ Client Web Bureau ]   ──┼──► [ server.ts (Port 3000) ]
                          │      ├── Auth Guard (X-GMAO-API-TOKEN)
[ Client Web Magasin ]  ──┘      ├── RBAC Filter (x-gmao-role)
                                 ├── Concurrency Lock (Version check)
                                 └── File sérialisée writeQueue
                                          │
                                          ▼
                                   database.json (SSOT)
```

---

## 2. Spécification des En-Têtes & Sécurité API

Toutes les requêtes vers le serveur hôte doivent inclure les en-têtes obligatoires :

```http
POST /api/sync/push HTTP/1.1
Host: 192.168.1.50:3000
Content-Type: application/json
X-GMAO-API-TOKEN: secret_lan_token_ciob_2026
x-gmao-role: SUPERVISEUR
x-gmao-user-id: USR-004
```

### Règles de Contrôle d'Accès Serveur (`serverRbacPolicy.ts`) :
1. **Validation du Jeton :** Si `X-GMAO-API-TOKEN` est absent ou invalide ➔ Rejet immédiat avec statut `401 Unauthorized`.
2. **Filtrage des Entités Autorisées (`ALLOWED_ENTITIES`) :** Seules les entités déclarées dans l'allowlist peuvent être écrites.
3. **Contrôle de Rôle :** Les opérations administratives de bas niveau (purge usine, écriture brute) nécessitent impérativement `x-gmao-role: ADMIN`.

---

## 3. Mécanisme Anti-Collision & Détection de Conflits (`409 Conflict`)

Pour empêcher qu'un technicien n'écrase par inadvertance les modifications apportées simultanément par un autre collègue :
- Chaque écriture transporte un numéro de version incrémental (`version`).
- Si la version soumise est inférieure à la version stockée sur le serveur hôte ➔ Le serveur répond par un code d'erreur `HTTP 409 Conflict`.
- Le client déclenche alors un mécanisme de réconciliation automatique ou invite l'utilisateur à actualiser son état local avant de renvoyer sa transaction.

---

## 4. Écritures Atomiques Sérialisées (`writeQueue`)

Afin d'éliminer toute condition de course (race condition) et tout risque de corruption de fichier lors d'écritures concurrentes :
```typescript
// server.ts : Sérialisation synchrone des écritures
const writeQueue = new SerialTaskQueue();

function saveDatabaseAtomically(data: AppState): Promise<void> {
  return writeQueue.enqueue(async () => {
    const tmpPath = `${DB_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, DB_PATH); // Opération atomique synchrone garantie par l'OS
  });
}
```
