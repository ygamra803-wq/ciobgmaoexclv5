---
id: group-04-corrective-di-bt-architecture
groupId: 04-corrective-di-bt
groupTitle: Maintenance Corrective (DI / BT & Clôture)
docType: architecture
audience: developer
title: Architecture & Spécifications Techniques — Groupe 04 : Maintenance Corrective
summary: Spécification complète du cycle curatif, machine à états finis WorkOrderStateMachine, passerelle Bon d'Atelier / Rectification & Sous-Traitance (CORRECTIVE-ATELIER-P0), protocole Maker-Checker VAL-1..VAL-5, horloge industrielle avec shifts 08h-17h et calculs MTTR/MTBF.
relatedTabs:
  - corrective_di
  - corrective_bt
  - corrective_cloture
  - corrective_referentiel
---

# 🏛️ Group 04 : Maintenance Corrective (DI / BT / Clôture & Catalogue) — Architecture & Spécifications Techniques

> **Destination :** Développeurs, Architectes Logiciels, Auditeurs Système & Modèles IA.  
> **Périmètre applicatif :** Cycle de vie complet des interventions curatives, machine à états finis (`src/domain/corrective/services/WorkOrderStateMachine.ts`), passerelle **Bon d'Atelier / Rectification & Sous-Traitance (`CORRECTIVE-ATELIER-P0`)**, horloge industrielle avec gestion d'équipes (Shifts 08:00–17:00), réconciliation Maker-Checker (`VAL-1..VAL-5`), calculs d'indicateurs MTTR / MTBF / TBF, et catalogue référentiel de pannes.

---

## 1. Vue d'Ensemble & Philosophie Industrielle

La maintenance corrective dans **CIOB GMAO v4** n'est pas un simple registre de tickets « Helpdesk », mais un **moteur transactionnel déterministe** modélisé pour l'atelier industriel :

1. **Cycle de Vie Verrouillé (Strict FSM) :** Aucune intervention ne peut passer d'un statut arbitraire à un autre sans validation de préconditions explicites (`src/domain/corrective/services/WorkOrderStateMachine.ts`).
2. **Vérité Industrielle des Délais d'Atelier (`CORRECTIVE-ATELIER-P0`) :**
   - Lorsqu'un dépannage nécessite l'usinage, la rectification ou le rechargement d'un arbre à l'atelier mécanique interne (`BON-ATEL-xxx`) ou l'envoi d'un organe en sous-traitance externe (`SORT-EXT-xxx`) **sans remplacement immédiat par un organe de rechange**, le Bon de Travail (`BT`) **ne peut pas être clôturé prématurément**.
   - Le `BT` est suspendu en `EN_ATTENTE_PDR` (alias `EN_ATTENTE_ATELIER`) tant que le bon d'atelier est ouvert (`En cours atelier` / `En réparation externe`), et sa clôture définitive (`CLOTURE`) est verrouillée par la FSM jusqu'à la réception (`Retourné OK`) ou au remontage (`Monté`), avec consolidation automatique des coûts (`cout_total = cout_pdr + cout_atelier`).
3. **Dualité Opérateur / Superviseur (Maker-Checker) :** Les déclarations terrain des techniciens (heures réelles, pièces PDR consommées) ne modifient jamais les stocks critiques sans validation hiérarchique par un chef d'équipe ou responsable maintenance (`VAL-1..VAL-5` via `validationReconciliation.ts`).
4. **Réalisme Temporel des Équipes d'Atelier (Shift-Aware Chronometer) :** La durée d'une intervention en cours (`Live Intervention`) tient compte du temps de travail effectif de l'usine :
   - Équipe Matin : `08:00 – 13:15`
   - Pause Déjeuner obligatoire : `13:15 – 14:00` (45 min déduites automatiquement sans dérive)
   - Équipe Après-Midi : `14:00 – 17:00`
   - Hors-Shift (après 17:00, nuit, et dimanches chômés) : le chronomètre d'immobilisation est gelé pour ne pas fausser le MTTR machine.
5. **Intégrité Totale des Sorties PDR :** La déduction physique en stock s'exécute exclusivement via `IncrementalStockIndex` et `StockCalculationService` lors de l'approbation du bon de travail, garantissant zéro mouvement orphelin et zéro double décompte.

---

## 2. Machine à États Finis : `WorkOrderStateMachine`

Le fichier `src/domain/corrective/services/WorkOrderStateMachine.ts` gouverne toutes les transitions valides.

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
     │   │ (PDR reçue en stock OU Bon d'Atelier réceptionné OK / Monté)
     ▼   │
[ EN_ATTENTE_PDR / EN_ATTENTE_ATELIER ] (Attente pièce magasin ou fin d'usinage/bobinage)
     │
     ▼ (Garde stricte : hasOpenWorkshopOrder === false)
[ CLOTURE ] (Rapport technique validé, pièces déduites, coût PDR + Atelier consolidé)
```

### 2.2 Table de Décision et Gardes Métier

| État Initial | Transition Cible | Gardes Obligatoires (`WorkOrderGuard`) | Effet de Bord / Audit |
| :--- | :--- | :--- | :--- |
| `DEMANDE` | `BT_PLANIFIE` | • Code machine valide (`code_machine`) existant dans le parc actif.<br>• Description préliminaire du symptôme. | Attribution automatique du numéro de BT (`BT-XXXX`). |
| `DEMANDE` | `ANNULE` | • Motif d'annulation obligatoire (`motif_annulation`). | Journalisation dans `AUDIT_EVENTS`. |
| `BT_PLANIFIE` | `EN_COURS` | • Intervenant assigné (`intervenant`).<br>• Code machine vérifié. | Enregistrement de `date_debut` ou démarrage du chrono Live. |
| `EN_COURS` | `EN_ATTENTE_PDR` | • Attente de pièce de rechange ou émission d'un Bon d'Atelier / Externe (`BON-ATEL` / `SORT-EXT`). | Suspension du BT et suivi temps réel de l'ordre d'atelier lié. |
| `EN_ATTENTE_PDR` | `EN_COURS` | • Réception en magasin ou retour d'atelier (`Retourné OK`). | Reprise du compteur de travail effectif. |
| `EN_COURS` / `EN_ATTENTE_PDR` | `CLOTURE` | • Rôle autorisé (`!isTechnician`).<br>• Description des travaux réalisés (`action_realisee` ou `travail_a_faire`).<br>• **Garde Atelier (`!hasOpenWorkshopOrder`) :** Aucun Bon d'Atelier ou de Sous-Traitance lié à ce BT ne doit être encore en cours (`En cours atelier` / `En réparation externe`). | Déduction finale du stock si validé, consolidation `cout_total = cout_pdr + cout_atelier`, et passage en état immuable. |
| `CLOTURE` | *Aucun* | **État Terminal Absolu.** Aucune transition sortante autorisée (`allowedTransitions = []`). | Immutabilité garantie. |

---

## 3. Passerelle Atelier Mécanique & Sous-Traitance (`CORRECTIVE-ATELIER-P0`)

Pour refléter fidèlement la réalité terrain d'une usine, le service `src/application/services/SortieExterneService.ts` et le store `useGmaoStore.ts` orchestrent deux flux complémentaires liés aux Bons de Travail (`id_corrective`) :

1. **`ATELIER_MECANIQUE` (`BON-ATEL-xxx` / Bon `BA-YYYY-xxx`) :**
   - Usinage, rectification, tournage d'arbre/axe, soudure/rechargement, confection de pièce sur mesure ou alésage réalisé à l'atelier mécanique.
   - Statut initial : `'En cours atelier'`.
2. **`SOUS_TRAITANCE_EXTERNE` (`SORT-EXT-xxx` / Bon `BS-YYYY-xxx`) :**
   - Bobinage moteur électrique, réparation de variateur/carte électronique ou révision chez un prestataire externe.
   - Statut initial : `'En réparation externe'`.
3. **Synchronisation Bidirectionnelle & Verrouillage de Clôture :**
   - Dès qu'un bon est créé ou mis à jour avec `id_corrective = bt.num_bt`, `syncCorrectiveInterventionsWithSortieRecord` met à jour sur le `BT` parent : `id_sortie_atelier`, `code_sortie_atelier`, `cout_atelier`, `nature_travail_atelier`, `prestataire_atelier` et `cout_total`.
   - Tant que `SortieExterneService.isWorkshopOrderOpen(etat)` est vrai, toute tentative de clôture directe (`handleClotureIntervention`) ou d'approbation Maker-Checker (`handleReviewDecision('APPROVED')`) est bloquée jusqu'à ce que le bon passe à `'Retourné OK'` ou `'Monté'`.

---

## 4. Protocole Maker-Checker & Réconciliation des Pièces (`VAL-1..VAL-5`)

Afin d'éviter les erreurs d'inventaire ou les déclarations erronées sur le terrain :

1. **Déclaration Terrain (`Technicien / Opérateur`) :**
   - Lorsqu'un technicien termine son intervention sur tablette ou PC atelier, il choisit la nature d'intervention (`REPLACE`, `REPAIR`, `ADJUST`, `CLEAN`, `INSPECT`, `ATELIER`), indique les pièces utilisées (`pieces_proposees`) et la durée constatée.
   - Le statut de validation passe à `validation_status: 'PENDING_VALIDATION'`.
   - **Important :** Le stock physique (`rawStock`) **n'est pas encore débité**.
2. **Revue Hiérarchique (`Superviseur / Responsable Maintenance / Admin`) :**
   - L'écran des Bons de Travail (`BonsTravailTab.tsx`) met en évidence les BT en attente d'approbation et affiche les éventuels Bons d'Atelier liés (`BON-ATEL` / `SORT-EXT`).
   - Le superviseur ouvre la modale de réconciliation (`MakerCheckerReviewModal`), peut réceptionner en 1 clic un Bon d'Atelier terminé (**« Réceptionner OK »**), ajuster les quantités réelles de PDR, ou demander une clarification.
3. **Approbation & Mouvement Débiteur :**
   - Lors de la validation (`handleReviewDecision`), `reconcileFieldClaim` transforme les propositions en mouvements de sortie définitifs (`type_mouvement: 'Sortie'`).
   - `IncrementalStockIndex` est notifié immédiatement.
   - Un événement auditable `VALIDATION_APPROVED` est consigné dans `STORAGE_KEYS.AUDIT_EVENTS`.

---

## 5. Calculs Mathématiques & Métriques de Fiabilité

Le service `src/domain/corrective/services/CorrectiveCalculationService.ts` et `AvailabilityCalculationService.ts` pilotent les indicateurs de performance :

### 5.1 Formules Métriques Normalisées

1. **MTTR (Mean Time To Recovery / Temps Moyen de Réparation) :**
   $$\text{MTTR} = \frac{\sum \text{Durée effective d'arrêt (heures)}}{\text{Nombre total d'interventions curatives}}$$
2. **MTBF (Mean Time Between Failures / Temps Moyen Entre Pannes) :**
   $$\text{MTBF} = \frac{\text{Temps de fonctionnement machine (heures)} - \sum \text{Temps d'arrêt curatif}}{\text{Nombre total de pannes}}$$
3. **Disponibilité Opérationnelle ($D_o$) :**
   $$D_o = \frac{\text{MTBF}}{\text{MTBF} + \text{MTTR}} \times 100\%$$
4. **Coût Global Curatif d'un BT ($C_{\text{BT}}$) :**
   $$C_{\text{BT}} = \text{cout\_pdr} + \text{cout\_atelier} = \sum (\text{Quantité PDR} \times \text{Prix Unitaire PUMP}) + \sum \text{Coût Bons d'Atelier / Externe liés}$$

### 5.2 Analyse Pareto 80/20

Le module `AnalyseCorrectiveTab.tsx` calcule la distribution de Pareto :
- **Par Machine :** Classement des équipements cumulant 80% des heures d'arrêt ou des coûts de réparation.
- **Par Symptôme / Famille de Panne :** Identification des modes de défaillance prédominants (électrique, mécanique, hydraulique, pneumatique) pour alimenter le plan de maintenance préventive.

---

## 6. Matrice des Droits d'Accès (RBAC)

| Rôle Utilisateur | Créer une DI (`#corrective_di`) | Créer/Planifier un BT (`#corrective_bt`) | Lancer le Live Timer (`#corrective_live`) | Valider Maker-Checker | Clôturer & Analyser (`#corrective_cloture`) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **OPERATEUR** | ✅ | ❌ | ❌ | ❌ | ❌ (Lecture seule DI) |
| **TECHNICIEN** | ✅ | ✅ (Auto-assignation) | ✅ | ❌ (Soumission uniquement) | ✅ (Saisie rapport) |
| **SUPERVISEUR** | ✅ | ✅ | ✅ | ✅ (Approbation finale) | ✅ (Export & Clôture) |
| **RESPONSABLE_MAINT**| ✅ | ✅ | ✅ | ✅ | ✅ (Totalité des droits) |
| **ADMIN** | ✅ | ✅ | ✅ | ✅ | ✅ (Configuration & Override) |
| **MAGASINIER** | ❌ | ❌ (Consultation PDR) | ❌ | ❌ | ❌ (Consultation sorties) |
