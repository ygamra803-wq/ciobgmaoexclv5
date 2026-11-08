---
id: page-dev-validation-center
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: architecture
audience: developer
tabId: validation_center
title: Spécification Technique — Centre de Validation Maker-Checker (VAL-1..VAL-5)
summary: Architecture de la gouvernance Maker-Checker. Réconciliation des déclarations terrain, protocole VAL-1 à VAL-5, étanchéité du stock brut avant visa hiérarchique, fonction transactionnelle reconcileFieldClaim et journalisation immuable.
relatedTabs:
  - validation_center
  - corrective_bt
  - stock
  - settings
---

# 💻 Spécification Développeur : Centre de Validation Maker-Checker (`#validation_center`)

> **Public :** Développeurs Core, Architectes Sécurité & Auditeurs.  
> **Composant source :** `src/presentation/pages/validation/ValidationCenterView.tsx`  
> **Moteur métier :** `src/core/security/validationReconciliation.ts`  
> **Contrat de conformité :** Règles Maker-Checker `VAL-1` à `VAL-5`.

---

## 1. Philosophie & Isolation Transactionnelle

Le principe fondamental de la gouvernance industrielle dans **CIOB GMAO v4** est la **séparation stricte entre la déclaration opérationnelle terrain (Maker) et la validation d'inventaire (Checker)** :

```text
[ TECHNICIEN / MAKER ]
        │  Saisit rapport BT, Heures réelles, et Pièces consommées
        ▼
[ ÉTAT PROVISOIRE ] ➔ validation_status: 'PENDING_VALIDATION'
        │
        │ ⚠️ RÈGLE FONDAMENTALE :
        │ Le stock magasin (rawStock) N'EST PAS DÉBITÉ.
        │ Aucune écriture comptable n'est générée.
        ▼
[ SUPERVISEUR / CHECKER ] (ValidationCenterView)
        │
        ├── Rejet / Demande d'ajustement ➔ Retour statut TECHNICIEN
        │
        └── Approbation ➔ Appel reconcileFieldClaim()
                 │
                 ├── 1. Génération des mouvements réels : type_mouvement: 'Sortie'
                 ├── 2. Notification IncrementalStockIndex (Mise à jour O(1))
                 ├── 3. Enregistrement AUDIT_EVENTS (Action: 'VALIDATION_APPROVED')
                 └── 4. Clôture définitive du BT (Transition FSM CLOTURE)
```

---

## 2. Les 5 Règles Canoniques de Validation (`VAL-1..VAL-5`)

| Règle | Nom de la Règle | Description de l'Invariant Technique |
| :--- | :--- | :--- |
| **`VAL-1`** | **Anti-Auto-Validation (Dual Control)** | Un utilisateur ne peut pas approuver un enregistrement dont il est lui-même l'auteur (`maker_id !== checker_id`). Les techniciens sont exclus de la fonction d'approbation (`isTechnicianRole`). |
| **`VAL-2`** | **Équanchéité du Stock Brut** | Les articles saisis dans `pieces_proposees` n'apparaissent pas dans les sorties réelles tant que `validation_status !== 'APPROVED'`. Le calcul $S_{\text{actuel}} = S_{\text{initial}} + \text{Entrées} - \text{Sorties}$ reste strictement inviolable. |
| **`VAL-3`** | **Pouvoir de Rectification du Superviseur** | Lors de la revue, le superviseur peut ajuster les quantités ou substituer une référence sans supprimer l'historique de la proposition initiale du technicien. |
| **`VAL-4`** | **Atomicité de la Réconciliation** | Lors du clic sur *Valider*, la création des mouvements de sortie, le passage au statut clôturé et la journalisation d'audit s'exécutent au sein d'une même transaction logique synchrone. |
| **`VAL-5`** | **Traçabilité Immuable Append-Only** | Tout visa (approbation ou refus motivé) enregistre un événement dans `STORAGE_KEYS.AUDIT_EVENTS` avec l'horodatage précis, l'identifiant du superviseur et l'état avant/après. |

---

## 3. Structure des Files d'Attente (`selectValidationCenterQueues`)

Le sélecteur `selectValidationCenterQueues` répartit les éléments en attente dans 3 files distinctes :

```typescript
export interface ValidationQueues {
  correctiveQueue: CorrectiveIntervention[]; // BT avec validation_status: 'PENDING_VALIDATION'
  preventiveQueue: PreventiveExecution[];    // Exécutions préventives avec PDR déclarée
  sortieDemandsQueue: SortieDemand[];        // Demandes de prélèvement magasin en attente
}
```

### 3.1 Déduction Automatique Optionnelle (`skipStockDeduction`)
Si le superviseur constate que la pièce a déjà fait l'objet d'un bon de sortie rapide manuel au guichet du magasinier, il peut cocher `skipStockDeduction: true`. Dans ce cas :
- Le coût est rattaché au BT.
- Aucun mouvement de sortie doublon n'est émis, protégeant l'inventaire physique contre une double déduction.

---

## 4. Matrice de Sécurité des Rôles (RBAC)

| Rôle Utilisateur | Soumettre une Déclaration (Maker) | Consulter la File | Approuver / Réconcilier (Checker) |
| :--- | :---: | :---: | :---: |
| **OPERATEUR** | ❌ (DI uniquement) | ❌ | ❌ |
| **TECHNICIEN** | ✅ (`PENDING_VALIDATION`) | ❌ (Vue restreinte) | ❌ (Interdit par `VAL-1`) |
| **SUPERVISEUR** | ✅ | ✅ | ✅ |
| **RESPONSABLE_MAINT** | ✅ | ✅ | ✅ |
| **ADMIN** | ✅ | ✅ | ✅ (Avec droit d'override) |
| **MAGASINIER** | ❌ | ✅ (Sorties PDR uniquement) | ✅ (Uniquement demandes de sortie) |
