---
id: page-dev-utilisateurs
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: architecture
audience: developer
tabId: utilisateurs
title: Spécification Technique — Gestion des Utilisateurs & Sécurité RBAC
summary: Architecture de sécurité et de contrôle d'accès basée sur les rôles (RBAC). Matrice des permissions fail-closed dans AuthorizationService, hachage PBKDF2/SHA-256, coffre-fort chiffré AES-GCM et politique anti-bruteforce.
relatedTabs:
  - utilisateurs
  - settings
  - validation_center
---

# 💻 Spécification Développeur : Utilisateurs, Rôles & Sécurité RBAC (`#utilisateurs`)

> **Public :** Ingénieurs Sécurité, Développeurs Core & Auditeurs.  
> **Composants sources :** `src/presentation/pages/utilisateurs/UtilisateursView.tsx`, `src/core/security/AuthorizationService.tsx`, `src/context/AuthContext.tsx`.  
> **Services de cryptographie :** `src/core/security/SecurityService.ts`, `src/utils/vaultService.ts`.  
> **Clés SSOT :** `STORAGE_KEYS.TECHNICIENS`, `STORAGE_KEYS.USERS`, `STORAGE_KEYS.AUDIT_EVENTS`.

---

## 1. Modèle d'Autorisation Fail-Closed (RBAC Architecture)

Le contrôle d'accès dans **CIOB GMAO Nexus v5.0.2** applique le principe de moindre privilège absolu (**Least Privilege & Fail-Closed**) :

```text
               ┌──────────────────────────────┐
               │    Requête Utilisateur /     │
               │   PermissionGate(permission) │
               └──────────────┬───────────────┘
                              │
                              ▼
               ┌──────────────────────────────┐
               │   Utilisateur Authentifié ?  │
               └──────────────┬───────────────┘
                        NON  / \  OUI
                            /   \
          ┌────────────────┘     └────────────────┐
          ▼                                       ▼
  [ REFUS IMMÉDIAT ]                    [ Normalisation du Rôle ]
  (Retourne false)                       (normalizeRole(user.role))
                                                  │
                                                  ▼
                                        ┌──────────────────────────────┐
                                        │  Permission existe dans      │
                                        │  PERMISSIONS[permission] ?   │
                                        └─────────────┬────────────────┘
                                                 OUI / \ NON (Fail-Closed)
                                                    /   \
                                  ┌────────────────┘     └────────────────┐
                                  ▼                                       ▼
                       [ Rôle présent dans liste ? ]             [ REFUS IMMÉDIAT ]
                                  │                               (Retourne false)
                           OUI /     \ NON
                              /       \
                             ▼         ▼
                        [ AUTORISÉ ] [ REFUSÉ ]
```

---

## 2. Rôles Définis & Périmètre Fonctionnel

| Rôle | Mnémonique | Périmètre & Droits Autorisés |
| :--- | :--- | :--- |
| **`ADMIN`** | Administrateur Système | Droits absolus : configuration, suppression de zones/articles, exports, réinitialisation usine, et gestion des comptes utilisateurs. |
| **`RESPONSABLE_MAINTENANCE`** | Responsable Maintenance | Supervision globale : approbation des BT (`Maker-Checker`), gestion du budget annuel, création/modification des plans préventifs et du parc machines. |
| **`RESPONSABLE_MAGASIN`** | Responsable Magasin PDR | Gestion de l'inventaire : création d'articles, approvisionnement, réception de commandes PO, et arbitrage des sorties magasin. |
| **`TECHNICIEN`** | Technicien d'Atelier | Exécution terrain : consultation du parc, chronomètre d'intervention Live, saisie des rapports curatifs/préventifs, déclaration des pièces (Maker). |
| **`OPERATEUR`** | Opérateur de Production | Émission de Demandes d'Intervention (DI) suite à une panne sur sa ligne, consultation du statut de traitement de ses demandes. |
| **`VIEWER`** | Observateur / Auditeur | Lecture seule stricte : consultation des tableaux de bord, rapports clôturés et indicateurs sans droit d'écriture. |

---

## 3. Cryptographie & Coffre-Fort Chiffré (Vault Architecture)

### 3.1 Hachage Sécurisé des Mots de Passe & PIN
- Les mots de passe et codes PIN ne sont **jamais stockés en clair**.
- Implémenté via l'API standard `crypto.subtle` (WebCrypto API) :
  - Sel cryptographique unitaire généré par `getRandomValues`.
  - Hachage sécurisé SHA-256 avec itérations PBKDF2.

### 3.2 Coffre-Fort Numérique AES-GCM (`vaultService.ts`)
- Les clés de configuration sensibles et les sauvegardes confidentielles sont scellées dans un coffre-fort local chiffré en **AES-GCM 256 bits**.
- Le coffre ne peut être déverrouillé qu'en mémoire vive lors de la saisie du Master PIN valide par l'administrateur.

---

## 4. Politique Anti-Bruteforce & Verrouillage Temporaire

Le module `AuthContext.tsx` protège le système contre les attaques par force brute :
- Un compteur d'échecs de connexion (`loginAttemptsMap`) suit les tentatives par nom d'utilisateur.
- **Seuil critique :** 5 tentatives infructueuses consécutives (`MAX_LOGIN_ATTEMPTS = 5`).
- **Verrouillage automatique :** Le compte est verrouillé pour une durée de 15 minutes (`LOCKOUT_DURATION_MS = 15 * 60 * 1000`). Toute nouvelle tentative pendant cette fenêtre est rejetée instantanément sans solliciter le moteur de chiffrement.
- En cas de succès, le compteur d'échecs est réinitialisé à zéro.
