---
id: group-04-corrective-di-bt-architecture
groupId: 04-corrective-di-bt
groupTitle: Maintenance Corrective (DI / BT & Clôture)
docType: architecture
audience: developer
title: Architecture & Spécifications Techniques — Groupe 04 : Maintenance Corrective
summary: Spécification complète du cycle curatif, machine à états finis WorkOrderStateMachine, protocole Maker-Checker VAL-1..VAL-5, horloge industrielle avec shifts 08h-17h et déduction pause déjeuner, calculs MTTR/MTBF et catalogue de pannes.
relatedTabs:
  - corrective_di
  - corrective_bt
  - corrective_cloture
  - corrective_referentiel
---

# 🏛️ Group 04 : Maintenance Corrective (DI / BT / Clôture & Catalogue) — Architecture & Spécifications Techniques

> **Destination :** Développeurs, Architectes Logiciels, Auditeurs Système & Modèles IA.  
> **Périmètre applicatif :** Cycle de vie complet des interventions curatives, machine à états finis (`WorkOrderStateMachine`), horloge industrielle avec gestion d'équipes (Shifts 08:00–17:00), réconciliation Maker-Checker (`VAL-1..VAL-5`), calculs d'indicateurs MTTR / MTBF / TBF, et catalogue référentiel de pannes.

---

## 1. Vue d'Ensemble & Philosophie Industrielle

La maintenance corrective dans **CIOB GMAO v4** n'est pas un simple registre de tickets « Helpdesk », mais un **moteur transactionnel déterministe** modélisé pour l'atelier industriel :

1. **Cycle de Vie Verrouillé (Strict FSM) :** Aucune intervention ne peut passer d'un statut arbitraire à un autre sans validation de préconditions explicites (`WorkOrderStateMachine.ts`).
2. **Dualité Opérateur / Superviseur (Maker-Checker) :** Les déclarations terrain des techniciens (heures réelles, pièces PDR consommées) ne modifient jamais les stocks critiques sans validation hiérarchique par un chef d'équipe ou responsable maintenance (`VAL-1..VAL-5` via `validationReconciliation.ts`).
3. **Réalisme Temporel des Équipes d'Atelier (Shift-Aware Chronometer) :** La durée d'une intervention en cours (`Live Intervention`) tient compte du temps de travail effectif de l'usine :
   - Équipe Matin : `08:00 – 13:15`
   - Pause Déjeuner obligatoire : `13:15 – 14:00` (45 min déduites automatiquement sans dérive)
   - Équipe Après-Midi : `14:00 – 17:00`
   - Hors-Shift (après 17:00, nuit, et dimanches chômés) : le chronomètre d'immobilisation est gelé pour ne pas fausser le MTTR machine.
4. **Intégrité Totale des Sorties PDR :** La déduction physique en stock s'exécute exclusivement via `IncrementalStockIndex` et `StockCalculationService` lors de l'approbation du bon de travail, garantissant zéro mouvement orphelin et zéro double décompte.

---

## 2. Machine à États Finis : `WorkOrderStateMachine`

Le fichier `src/domain/maintenance/WorkOrderStateMachine.ts` gouverne toutes les transitions valides.

### 2.1 Diagramme d'États

```text
[ DEMANDE ] (Demande d'Intervention - DI)
     │
     ├─────────────► [ ANNULE ] (Rejet ou doublon)
     │
     ▼
[ BT_PLANIFIE ] (Bon de Travail émis, machine et technicien assignés)
     │
     ├─────────────► [ ANNULE ]
     │
     ▼
[ EN_COURS ] (Intervention déclenchée sur le terrain ou via Live Timer)
     │   ▲
     │   │ (PDR reçue en stock)
     ▼   │
[ EN_ATTENTE_PDR ] (Blocage logistique documenté)
     │
     ▼
[ CLOTURE ] (Rapport technique validé, pièces déduites, MTTR calculé)
```

### 2.2 Table de Décision et Gardes Métier

| État Initial | Transition Cible | Gardes Obligatoires (`WorkOrderGuard`) | Effet de Bord / Audit |
| :--- | :--- | :--- | :--- |
| `DEMANDE` | `BT_PLANIFIE` | • Code machine valide (`id_machine`) existant dans le parc actif.<br>• Description préliminaire du symptôme. | Attribution automatique du numéro de BT (`BT-YYYY-XXXX`). |
| `DEMANDE` | `ANNULE` | • Motif d'annulation obligatoire (`motif_annulation`). | Journalisation dans `AUDIT_EVENTS`. |
| `BT_PLANIFIE` | `EN_COURS` | • Intervenant assigné (`intervenant`).<br>• Code machine vérifié. | Enregistrement de `date_debut` ou démarrage du chrono Live. |
| `EN_COURS` | `EN_ATTENTE_PDR` | • Référence ou libellé de la pièce manquante renseigné. | Notification visuelle orange sur le tableau de bord atelier. |
| `EN_ATTENTE_PDR` | `EN_COURS` | • Réception en magasin ou confirmation superviseur. | Reprise du compteur de travail effectif. |
| `EN_COURS` | `CLOTURE` | • Description des travaux réalisés (`action_realisee` ou `travail_a_faire`).<br>• Durée effective d'intervention (`duree_minutes > 0`).<br>• Si des pièces sont consommées : soumission à la réconciliation Maker-Checker. | Déduction finale du stock si validé, calcul du coût main-d'œuvre + PDR, et passage en état immuable. |
| `CLOTURE` | *Aucun* | **État Terminal Absolu.** Aucune transition sortante autorisée (`allowedTransitions = []`). | Immutabilité garantie. |

---

## 3. Protocole Maker-Checker & Réconciliation des Pièces (`VAL-1..VAL-5`)

Afin d'éviter les erreurs d'inventaire ou les déclarations erronées sur le terrain :

1. **Déclaration Terrain (`Technicien / Opérateur`) :**
   - Lorsqu'un technicien termine son intervention sur tablette ou PC atelier, il indique les pièces utilisées (`pieces_proposees`) et la durée constatée.
   - Le statut de validation passe à `validation_status: 'PENDING_VALIDATION'`.
   - **Important :** Le stock physique (`rawStock`) **n'est pas encore débité**.
2. **Revue Hiérarchique (`Superviseur / Responsable Maintenance / Admin`) :**
   - L'écran des Bons de Travail (`BonsTravailTab.tsx`) met en évidence les BT en attente d'approbation.
   - Le superviseur ouvre la modale de réconciliation (`MakerCheckerReviewModal`).
   - Il peut ajuster les quantités réelles constatées, remplacer un article par un équivalent, ou refuser la saisie.
3. **Approbation & Mouvement Débiteur :**
   - Lors de la validation (`handleReviewDecision`), `reconcileFieldClaim` transforme les propositions en mouvements de sortie définitifs (`type_mouvement: 'Sortie'`).
   - `IncrementalStockIndex` est notifié immédiatement.
   - Un événement auditable `VALIDATION_APPROVED` est consigné dans `STORAGE_KEYS.AUDIT_EVENTS`.

---

## 4. Calculs Mathématiques & Métriques de Fiabilité

Le service `src/application/services/CorrectiveCalculationService.ts` et `AvailabilityCalculationService.ts` pilotent les indicateurs de performance :

### 4.1 Formules Métriques Normalisées

1. **MTTR (Mean Time To Recovery / Temps Moyen de Réparation) :**
   $$\text{MTTR} = \frac{\sum \text{Durée effective d'arrêt (heures)}}{\text{Nombre total d'interventions curatives}}$$
2. **MTBF (Mean Time Between Failures / Temps Moyen Entre Pannes) :**
   $$\text{MTBF} = \frac{\text{Temps de fonctionnement machine (heures)} - \sum \text{Temps d'arrêt curatif}}{\text{Nombre total de pannes}}$$
3. **Disponibilité Opérationnelle ($D_o$) :**
   $$D_o = \frac{\text{MTBF}}{\text{MTBF} + \text{MTTR}} \times 100\%$$
4. **Coût Global Curatif ($C_{\text{curatif}}$) :**
   $$C_{\text{curatif}} = (\text{Heures MO} \times \text{Taux Horaire Moyen}) + \sum (\text{Quantité PDR} \times \text{Prix Unitaire PUMP})$$

### 4.2 Analyse Pareto 80/20

Le module `AnalyseCorrectiveTab.tsx` calcule la distribution de Pareto :
- **Par Machine :** Classement des équipements cumulant 80% des heures d'arrêt ou des coûts de réparation.
- **Par Symptôme / Famille de Panne :** Identification des modes de défaillance prédominants (électrique, mécanique, hydraulique, pneumatique) pour alimenter le plan de maintenance préventive.

---

## 5. Matrice des Droits d'Accès (RBAC)

| Rôle Utilisateur | Créer une DI (`#corrective_di`) | Créer/Planifier un BT (`#corrective_bt`) | Lancer le Live Timer (`#corrective_live`) | Valider Maker-Checker | Clôturer & Analyser (`#corrective_cloture`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **OPERATEUR** | ✅ | ❌ | ❌ | ❌ | ❌ (Lecture seule DI) |
| **TECHNICIEN** | ✅ | ✅ (Auto-assignation) | ✅ | ❌ (Soumission uniquement) | ✅ (Saisie rapport) |
| **SUPERVISEUR** | ✅ | ✅ | ✅ | ✅ (Approbation finale) | ✅ (Export & Clôture) |
| **RESPONSABLE_MAINT**| ✅ | ✅ | ✅ | ✅ | ✅ (Totalité des droits) |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ (Configuration & Override) |
| **MAGASINIER** | ❌ | ❌ (Consultation PDR) | ❌ | ❌ | ❌ (Consultation sorties) |
