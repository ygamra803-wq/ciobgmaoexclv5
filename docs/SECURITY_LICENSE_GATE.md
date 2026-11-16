# 🔐 SECURITY_LICENSE_GATE.md — Portail à Double Clé (`AND`) & Licence Commerciale (`LOGIN-LICENSE-P0`)

## 1. Philosophie Architecturale : `AND` (Jamais `OR`)

Le portail d'authentification de **CIOB GMAO Nexus** applique une séparation stricte entre deux secrets de nature différente :

1. **Secret 1 — Clé de Licence Commerciale (`Clé de licence / PIN licence`) :**
   - Secret livré/activé au niveau de l'installation ou du poste d'atelier (`STORAGE_KEYS.LICENSE_RECORD`).
   - Dérivé via **PBKDF2-HMAC-SHA256 (600 000 itérations)** avec un sel aléatoire propre à l'installation (`installSalt`, 16 octets).
   - Identifié publiquement uniquement par une empreinte irréversible (`licenseKeyId`, ex. `LIC-FPR-8F3A-19C0-4B12`).
   - Sert également de clé maîtresse de chiffrement du coffre-fort local (`vaultService` AES-256-GCM).

2. **Secret 2 — Mot de Passe Opérationnel du Compte (`Mot de passe du compte`) :**
   - Secret individuel propre à chaque compte actif (`@admin`, `@magasinier`, `@viewer`, ou technicien rattaché via `personnelId`).
   - Dérivé indépendamment via **PBKDF2-HMAC-SHA256 (600 000 itérations)** avec son propre sel par compte dans `STORAGE_KEYS.AUTH_ACCOUNTS` (`gmao_auth_accounts_v2`).

### Invariant de Connexion (`AuthService.login`)
```text
Session Autorisée  <==>  verifyLicenseKey(licenseKey, ILicenseRecord)
                         AND
                         comparePassword(accountPassword, user.passwordHash)
```
- **Zéro raccourci `PIN-only` :** `AuthService.loginWithPin()` est désactivé et rejette systématiquement toute tentative.
- **Zéro connexion `Password-only` :** Toute tentative d'ouverture de session sans `licenseKey` valide ou sans `ILicenseRecord` à l'état `ACTIVE` est rejetée.
- **Séparation stricte des secrets :** Lors de l'activation initiale (`activateLicenseAndAdmin`), de la rotation de licence (`rotateLicenseKeyWithAdminAuth`) ou du changement de mot de passe (`updateUserPassword`), le système interdit formellement que `licenseKey === accountPassword`.

---

## 2. Schéma de l'Enregistrement de Licence (`ILicenseRecord`)

Stocké chiffré via `SecurityService.saveSecure(STORAGE_KEYS.LICENSE_RECORD, record)` et répliqué dans IndexedDB :

| Champ | Type | Description |
| :--- | :--- | :--- |
| `version` | `1` | Version du schéma de licence locale |
| `licenseKeyId` | `string` | Empreinte publique non réversible (`LIC-FPR-XXXX-XXXX-XXXX`) |
| `licenseStatus` | `'ACTIVE' \| 'INACTIVE' \| 'REVOKED'` | État d'activation du poste |
| `activatedAt` | `string` (ISO-8601) | Horodatage de l'activation initiale |
| `rotatedAt` | `string?` (ISO-8601) | Horodatage de la dernière rotation de clé |
| `installSalt` | `string` (Hex 32 chars) | Sel cryptographique aléatoire propre à l'installation |
| `licenseVerifier` | `string` (`pbkdf2:v1:600000:...`) | Vérificateur PBKDF2-HMAC-SHA256 (jamais la clé en clair) |
| `organizationLabel` | `string?` | Nom de l'atelier ou de l'organisation |
| `seatsHint` | `string?` | Périmètre du poste / LAN |
| `lastAuthAt` | `string?` (ISO-8601) | Dernière validation réussie au portail |

---

## 3. Protection Contre le Copier-Coller d'Empreintes (`Pass-the-Hash` Mitigation)

- Si un attaquant extrait le contenu brut de `localStorage` ou `IndexedDB` (`passwordHash` ou `licenseVerifier` au format `pbkdf2:v1:600000:...` ou enveloppe `AG1:...`) et tente de le coller dans le champ **Mot de passe** ou **Clé de licence**, `looksLikeStoredVerifierOrHash()` rejette immédiatement l'entrée avant même la dérivation PBKDF2.
- Même en connaissant la structure du stockage local, l'ouverture d'une session exige la connaissance conjointe des deux secrets en clair (`licenseKey` + `password`).

---

## 4. Limites Honnêtes du Modèle de Menace Local & Évolution Serveur

1. **Application Locale / Navigateur Offline-First :**
   - Tant que l'exécution s'effectue à 100 % sur une machine locale dont l'opérateur possède les droits d'administration système (accès complet au code JS en mémoire ou aux outils de débogage), un contrôle purement local ne remplace pas un serveur de licence distant.
   - En revanche, le modèle **Double Clé (`AND`) + PBKDF2-SHA256 (600k)** élimine tout contournement accidentel, empêche la réutilisation d'une sauvegarde locale sans la clé de licence commerciale, et sépare proprement la gouvernance commerciale de la gestion quotidienne des mots de passe RH/Atelier.
2. **Option de Confort Atelier (`Mémoriser la clé de licence sur ce poste`) :**
   - Désactivée par défaut. Lorsqu'un atelier choisit de l'activer sur un terminal fixe, l'interface avertit explicitement que cela réduit la sécurité physique du poste tout en maintenant l'obligation de saisir le mot de passe individuel du compte.
3. **Indépendance vis-à-vis des Imports/Exports (`REF_PERSONNEL`) :**
   - Les bundles d'import/export (`REF_PERSONNEL`, `DEMO_BUNDLE`, exports Excel Type A/B) ne contiennent **jamais** `ILicenseRecord`, ni `licenseVerifier`, ni `passwordHash`.
