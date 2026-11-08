---
id: page-dev-settings-admin-vault
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_admin
title: Spécification Technique — Compte Administrateur & Coffre-Fort AES-GCM
summary: Architecture de sécurité du compte administrateur maître et du coffre-fort chiffré. Gestion du Master PIN, dérivation de clé PBKDF2, chiffrement symétrique AES-GCM 256 bits et politique anti-bruteforce.
relatedTabs:
  - settings_admin
  - settings
  - utilisateurs
---

# 💻 Spécification Développeur : Compte Admin & Coffre-Fort (`#settings_admin`)

> **Public :** Ingénieurs Sécurité, Développeurs Core & Modèles IA.  
> **Composant source :** `src/presentation/pages/settings/components/SettingsAdminTab.tsx`  
> **Service cryptographique :** `src/utils/vaultService.ts`, `src/core/security/SecurityService.ts`.  
> **Standard de chiffrement :** WebCrypto API (AES-GCM 256 bits + PBKDF2).

---

## 1. Architecture du Coffre-Fort Chiffré (`vaultService.ts`)

Pour protéger les données sensibles et les jetons d'accès API en environnement d'atelier non supervisé, **CIOB GMAO v4** intègre un coffre-fort numérique local :

```text
[ Saisie du Master PIN par l'Administrateur ]
                     │
                     ▼
[ Dérivation de Clé Cryptographique (PBKDF2) ]
  • Algorithme : PBKDF2 avec HMAC-SHA256
  • Sel unitaire aléatoire (Salt de 16 octets)
  • Itérations : 100 000 cycles
                     │
                     ▼
[ Clé de Déchiffrement AES-GCM 256 bits (CryptoKey) ]
                     │
                     ▼
[ Déchiffrement Synchrone du Coffre ]
  • Déchiffrement du payload stocké sous STORAGE_KEYS.VAULT
  • Vecteur d'Initialisation (IV de 12 octets)
  • Vérification du tag d'authentification GCM (128 bits)
                     │
         ┌───────────┴───────────┐
      SUCCÈS                  ÉCHEC
         ▼                       ▼
[ Coffre Déverrouillé ]   [ Incrémentation Compteur Bruteforce ]
Données sensibles en RAM  Si 5 échecs ➔ Verrouillage 15 min
```

---

## 2. Invariants de Sécurité

1. **Aucun Secret en Dur dans le Code Source :** Ni mot de passe par défaut, ni clé privée ne figurent dans le code client ou serveur.
2. **Éphémérité de la Clé en Mémoire :** La clé de session déchiffrée n'est conservée qu'en mémoire vive (`RAM`). Dès la fermeture de session ou le rafraîchissement de la page, le coffre se reverrouille automatiquement (`lockVault()`).
3. **Protection Contre la Force Brute :** Gérée via `checkRateLimit()` dans `AuthContext.tsx`. Après 5 tentatives infructueuses, tout appel à `vaultService.decryptVault` est bloqué pendant 15 minutes.

---

## 3. Gestion du Master PIN Initial

Lors de la première installation de l'usine :
- Si aucun coffre n'existe (`!vaultService.isVaultExists()`), l'administrateur est invité à définir le **Master PIN** (minimum 4 chiffres obligatoires).
- L'empreinte de contrôle du PIN est hachée et stockée de manière irréversible.
- Toute réinitialisation du PIN sans possession de l'ancien nécessite la réinitialisation complète de l'usine pour empêcher toute usurpation d'identité en cas de vol d'équipement.
