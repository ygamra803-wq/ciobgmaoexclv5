---
id: group-03-preventive-meters-architecture
groupId: 03-preventive-meters
groupTitle: Maintenance Préventive & Compteurs (Meter PM)
docType: architecture
audience: developer
title: Architecture & Logique Métier — Groupe Maintenance Préventive & Compteurs (Meter PM)
summary: Spécification d'ingénierie du moteur préventif hybride (Calendrier 52 semaines + Compteurs Horomètres/Cycles), mémoire temporelle immuable (PreventiveExecution), contrôle Maker-Checker et tournées Système Général.
relatedTabs:
  - preventive
  - preventive_referentiel
---

# Architecture & Logique Métier — Groupe 03 : Maintenance Préventive & Compteurs (`Meter PM`)

## 1. Philosophie du Moteur Préventif Hybride (Temps + Usage)

Dans **CIOB GMAO v4**, la maintenance préventive dépasse la simple grille statique. Elle combine deux dimensions complémentaires au sein d'un moteur unifié :

1. **Maintenance Systématique Calendaire (`CALENDRIER`)** : Cadencée sur une matrice annuelle de **52 semaines (`S1` à `S52`)** et **12 mois**, avec fréquences normalisées (`Hebdomadaire`, `Mensuel`, `Trimestriel`, `Semestriel`, `Annuel`) et mode de récurrence `FIXE` ou `GLISSANT`.
2. **Maintenance Conditionnelle par Compteurs (`COMPTEUR` / `HYBRIDE`)** : Pilotée par l'usage réel de l'équipement (`Heures` d'horomètre, `Cycles` de presse/moule, ou `Km` d'engins) via `src/application/services/meter/MeterService.ts` et `STORAGE_KEYS.METER_READINGS`.

---

## 2. Mémoire Temporelle Immuable (`ExecutionService.ts` & `PREVENTIVE_EXECUTIONS`)

### 2.1 Pourquoi séparer `PreventiveTask` et `PreventiveExecution` ?
- **`STORAGE_KEYS.PREVENTIVE_TASKS` (`tasks`)** : Représente la *définition de la gamme* planifiée sur la machine (organe, code action AFNOR, fréquence, prochain seuil compteur, état courant).
- **`STORAGE_KEYS.PREVENTIVE_EXECUTIONS` (`executions`)** : Représente le **journal historique immuable** de chaque exécution datée (`executedAt`, `periodMonth: 'YYYY-MM'`, `periodWeek: 'SXX'`, `executorName`, `durationMinutes`, `laborRate`, `sparesUsed`, `sparesCost`, `totalCost`, `hasAnomaly`).

### 2.2 Formules de Coût d'Exécution Préventive (`ExecutionService.recordExecution`)
Lorsqu'une tâche préventive est exécutée et validée :

$$\text{Coût Main-d'Œuvre} = \left(\frac{\text{durationMinutes}}{60}\right) \times \text{laborRate}$$

$$\text{Coût PDR} = \sum_{i} \left(\text{qty}_i \times \text{unitPrice}_i\right)$$

$$\text{Coût Total Exécution} = \text{Coût Main-d'Œuvre} + \text{Coût PDR}$$

---

## 3. Mathématiques des Compteurs & Horomètres (`MeterService.ts`)

### 3.1 Évaluation de Déclenchement (`MeterService.evaluateTaskTrigger`)
Pour toute tâche ayant `type_declencheur === 'COMPTEUR' | 'HYBRIDE'` ou `compteur_seuil_intervalle > 0` :
- **Intervalle ($\Delta_{\text{seuil}}$)** : `interval = Number(task.compteur_seuil_intervalle || 500)`
- **Dernier déclenchement ($C_{\text{last}}$)** : `lastTrigger = Number(task.compteur_dernier_declenchement || 0)`
- **Prochain seuil cible ($C_{\text{target}}$)** :
  $$C_{\text{target}} = \text{task.compteur\_prochain\_declenchement} \ ?? \ (C_{\text{last}} + \Delta_{\text{seuil}})$$
- **Marge d'alerte anticipée ($M_{\text{warn}}$)** : `margin = Number(task.compteur_marge_alerte || Math.round(interval * 0.1))` (par défaut **10% de l'intervalle**).
- **Reliquat avant échéance ($R$)** :
  $$R = C_{\text{target}} - C_{\text{actuel}}$$
- **États déterministes** :
  - **`isOverdue = true` (Échue / En retard)** si $R \le 0$ ($C_{\text{actuel}} \ge C_{\text{target}}$).
  - **`isWarning = true` (Approche du seuil)** si $0 < R \le M_{\text{warn}}$.
  - **Progression (%)** :
    $$\text{percentProgress} = \min\left(100,\ \max\left(0,\ \text{round}\left(\frac{C_{\text{actuel}} - C_{\text{last}}}{\Delta_{\text{seuil}}} \times 100\right)\right)\right)$$

### 3.2 Avancement Automatique du Seuil après Exécution (`MeterService.advanceTaskCounterOnExecution`)
Lorsqu'une tâche compteur est exécutée au relevé $C_{\text{exec}}$ :
- $C_{\text{last}} \leftarrow C_{\text{exec}}$
- $C_{\text{target}} \leftarrow C_{\text{exec}} + \Delta_{\text{seuil}}$
- L'état de la tâche est réarmé pour le prochain cycle sans jamais perdre la trace de l'exécution précédente dans `PREVENTIVE_EXECUTIONS`.

---

## 4. Gouvernance Maker-Checker & Intégrité du Stock (`VAL-1..VAL-5`)

1. **Exécution par un Technicien (`isTechnicianRole(user) === true`)** :
   - L'exécution est enregistrée avec `validation_status: 'PENDING_VALIDATION'`, `sparesProposed: parsedSpares`, `sparesUsed: []`, et `stock_deducted: false`.
   - **Aucun mouvement de sortie magasin n'est émis immédiatement** : les quantités proposées sont réservées via `computeReservedStockMap` jusqu'à la revue du superviseur.
2. **Approbation par le Responsable (`handleReviewPreventiveExecution` dans `useGmaoStore.ts`)** :
   - Dès que le superviseur approuve (`APPROVED`), le système vérifie le stock disponible, émet les mouvements `Sortie` (`MVT-PRV`), passe `stock_deducted: true`, et inscrit un événement **`VALIDATION_APPROVED`** dans `STORAGE_KEYS.AUDIT_EVENTS`.
3. **Boucle Préventif $\rightarrow$ Correctif (`hasAnomaly` / `createFollowUpDi`)** :
   - Si le technicien coche **« Anomalie détectée lors de la visite »**, une **Demande d'Intervention Corrective (`DI`)** est générée et liée à la machine pour traitement curatif.

---

## 5. Sécurité RBAC & Cartographie des Fichiers

| Permission / Action | `OPERATOR` | `TECHNICIAN` | `MANAGER` | `ADMIN` |
| :--- | :---: | :---: | :---: | :---: |
| Exécuter une tâche / Saisir un relevé compteur (`preventive.execute`) | Non | **Oui** | **Oui** | **Oui** |
| Créer/Modifier des Plans, Guides & Actions (`preventive.manage`) | Non | Non | **Oui** | **Oui** |
| Approuver une exécution `PENDING_VALIDATION` (`validation.approve`) | Non | Non | **Oui** | **Oui** |

| Fichier Source | Rôle Architectural |
| :--- | :--- |
| `src/presentation/pages/preventive/PreventiveView.tsx` | Cockpit principal (6 vues : Matrice 52S, Par Machine, Calendrier, Liste, Analytique, Compteurs). |
| `src/presentation/pages/preventive/components/PreventiveMetersView.tsx` | Suivi temps réel des horomètres, barres de progression vers seuils et Tournée d'Atelier groupée. |
| `src/presentation/pages/preventive/PreventiveSecondaryView.tsx` | Ingénierie préventive : Concepteur de Plans (`TabPlanBuilder`), Guides Organes (`TabGuide`), Catalogue Actions AFNOR (`TabActions`). |
| `src/application/services/preventive/ExecutionService.ts` | Enregistrement immuable des exécutions (`PREVENTIVE_EXECUTIONS`) et calcul des coûts MO + PDR. |
| `src/application/services/meter/MeterService.ts` | Moteur mathématique des compteurs (`evaluateTaskTrigger`, `recordReading`, `advanceTaskCounterOnExecution`). |
