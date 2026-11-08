---
id: group-06-pilotage-gouvernance-architecture
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance & Gouvernance
docType: architecture
audience: developer
title: Architecture & Spécifications Techniques — Groupe 06 : Pilotage, Finance & Gouvernance
summary: Spécification technique d'architecture pour le groupe 06. Couvre les 6 piliers de pilotage stratégique et de gouvernance opérationnelle (Tableau de bord exécutif, Centre de validation Maker-Checker, Contrôle budgétaire & TCO, Gestion des utilisateurs RBAC, Cadastre spatial des Zones et Nomenclature réelle Nexus As-Built & Jumeaux Numériques).
relatedTabs:
  - dashboard
  - validation_center
  - finance
  - utilisateurs
  - zones
  - nexus
---

# 🏛️ Group 06 : Pilotage, Finance & Gouvernance — Spécifications Architecturales

> **Destination :** Développeurs, Architectes Logiciels, Auditeurs de Sécurité & Modèles IA.  
> **Périmètre applicatif :** Les 6 piliers de pilotage stratégique et de gouvernance de l'usine :
> 1. **Tableau de Bord Exécutif (`DashboardView`) :** Agrégation réactive, KPIs MTTR/MTBF et alertes temps réel.
> 2. **Centre de Validation Maker-Checker (`ValidationCenterView`) :** Protocole d'approbation hiérarchique `VAL-1..VAL-5`.
> 3. **Pilotage des Coûts & Budgets (`FinanceView`) :** Règle `Field Claim ≠ Coût Validé ≠ Écriture ERP`, TCO et suivi budgétaire 12 mois.
> 4. **Utilisateurs & Sécurité RBAC (`UtilisateursView`) :** Coffre-fort chiffré AES-GCM, verrouillage anti-bruteforce, et matrice des rôles fail-closed.
> 5. **Zones & Ateliers (`ZonesView`) :** Cadastre géographique de l'usine et intégrité référentielle stricte.
> 6. **Nexus BOM & Jumeaux Numériques (`NexusView`) :** Nomenclature réelle As-Built, analyse d'écarts avec le Blueprint et clonage vers machines jumelles.  
> *(Note : Les Paramètres Système, Sauvegardes et Registre d'Audit forment le Groupe dédié 07).*

---

## 1. Philosophie Générale de Gouvernance

Le Groupe 06 constitue **l'épine dorsale de contrôle, de sécurité, d'arbitrage financier et de pilotage anatomique** de l'ensemble de la GMAO :

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PILOTAGE EXÉCUTIF (DASHBOARD)                   │
│         KPIs Disponibilité Do • MTBF • MTTR • Valeur de Stock         │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
┌─────────────────────────┐ ┌────────────────────┐ ┌────────────────────┐
│ CENTRE DE VALIDATION    │ │ FINANCES & BUDGETS │ │ NEXUS BOM AS-BUILT │
│ Maker-Checker (VAL-1..5)│ │ Coûts MO, PDR, TCO │ │ Nomenclature réelle│
│ Séparation Rédacteur/   │ │ Suivi Mensuel/     │ │ Analyse écarts     │
│ Approbateur             │ │ Trimestriel        │ │ Jumeaux Numériques │
└──────────┬──────────────┘ └─────────┬──────────┘ └─────────┬──────────┘
           │                          │                      │
           └──────────────────────────┼──────────────────────┘
                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  SÉCURITÉ & TERRITOIRE OPÉRATIONNEL                    │
│           Utilisateurs & RBAC  •  Zones Géographiques d'Atelier        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Les 6 Piliers et leurs Invariants Non-Négociables

### Pilier 1 : Tableau de Bord (`#dashboard`)
- **Invariant :** Zéro calcul destructif ; les KPIs sont des vues dérivées pures ($O(N)$ optimisées par cache multi-niveaux L1/L2/L3).
- **Zéro Alerte Fantôme :** En mode usine vide (`START_MODE === 'empty'`), tous les compteurs affichent strictement 0 sans déclencher de fausses alertes d'anomalies.

### Pilier 2 : Centre de Validation Maker-Checker (`#validation_center`)
- **Principe :** Un technicien ou opérateur ne peut jamais valider lui-même sa propre déclaration d'intervention ou de sortie PDR.
- **Invariant Stock :** Les propositions de pièces (`pieces_proposees`) n'affectent le stock brut (`rawStock`) qu'au moment précis de l'approbation du superviseur via `reconcileFieldClaim`.

### Pilier 3 : Finances, Coûts & Budgets (`#finance`)
- **Axiome :** `Déclaration Terrain (Claim)` $\neq$ `Coût Validé (GMAO)` $\neq$ `Écriture Comptable (ERP)`.
- **Ventilation Tripartite :** Tout coût machine se décompose rigoureusement en :
  $$\text{Coût Total} = \text{Coût Main-d'Œuvre} + \text{Coût PDR Consommée (PUMP)} + \text{Coût Sous-Traitance Externe}$$
- **Traçabilité Budgétaire :** Tout réajustement de dotation annuelle ou mensuelle consigne un enregistrement immuable dans `budgetChangeLog` et dans `AUDIT_EVENTS`.

### Pilier 4 : Sécurité des Utilisateurs & RBAC (`#utilisateurs`)
- **Modèle Fail-Closed :** Tout accès non explicitement autorisé par la matrice `PERMISSIONS` dans `AuthorizationService.tsx` est rejeté par défaut.
- **Hachage & Chiffrement :** Aucun mot de passe en clair dans le stockage. Mots de passe et Master PIN sécurisés via PBKDF2/SHA-256 et coffre-fort WebCrypto AES-GCM 256 bits.
- **Anti-Bruteforce :** Verrouillage temporaire du compte après 5 échecs consécutifs (`LOCKOUT_DURATION_MS = 15 min`).

### Pilier 5 : Zones & Ateliers (`#zones`)
- **Vérité Géographique :** Une Zone est une localisation physique d'atelier (ex. `Laminoir`, `Finition`, `Centrale Électrique`), jamais un parent fonctionnel de ligne ou un composant machine.
- **Verrouillage de Suppression :** Suppression bloquée avec statut HTTP 400 / Toast Warning si des machines, techniciens, opérations ou articles d'entrepôt y sont encore rattachés (`handleDeleteZone`).

### Pilier 6 : Nexus BOM & Jumeaux Numériques (`#nexus`)
- **Vérité As-Built Unifiée :** Fusion dynamique du registre d'atelier (`machineElementsLedger`) et des organes montés d'entrepôt (`warehouseItems`).
- **Analyse d'Écarts :** Confrontation temps réel avec le `Blueprint` modèle pour détecter les substitutions de terrain et les pièces manquantes.
- **Duplication aux Machines Jumelles :** Réplication instantanée de la nomenclature As-Built validée sur une machine vers l'ensemble de ses lignes sœurs du parc.
