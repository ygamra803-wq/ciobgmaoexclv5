---
id: page-dev-dashboard
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: architecture
audience: developer
tabId: dashboard
title: Spécification Technique — Tableau de Bord & Moteur d'Agrégation
summary: Architecture logicielle du tableau de bord exécutif. Mécanismes d'agrégation $O(N)$, gestion du cache multi-niveaux L1/L2/L3, souscription réactive au store Zustand useGmaoStore, formules de disponibilité et zéro injection fantôme en mode usine vide.
relatedTabs:
  - dashboard
  - finance
  - validation_center
---

# 💻 Spécification Développeur : Tableau de Bord & Moteur d'Agrégation (`#dashboard`)

> **Public :** Développeurs Full-Stack, Ingénieurs Performance & Modèles IA.  
> **Composant source :** `src/presentation/pages/dashboard/DashboardView.tsx`  
> **Services associés :** `FinancialCalculationService.ts`, `CorrectiveCalculationService.ts`, `StockCalculationService.ts`, `MultiLevelCacheManager.ts`.

---

## 1. Modèle d'Agrégation Réactive & Pipeline de Données

Le `DashboardView` ne stocke aucun état métier persistant propre. Il agit comme une **projection fonctionnelle pure** de l'état unifié `useGmaoStore` :

```text
useGmaoStore (Zustand SSOT)
  ├── machines
  ├── stockItems (rawStock)
  ├── mouvements
  ├── correctiveInterventions
  ├── preventiveExecutions
  └── fiscalBudgetConfig
         │
         ▼
[ Pipeline d'Agrégation Mémoïsé (useMemo) ]
  ├── 1. Filtrage Actifs : filterActiveMachines(machines)
  ├── 2. Calcul Stocks : IncrementalStockIndex.getStockActuel()
  ├── 3. Métriques Fiabilité : MTTR / MTBF / Disponibilité Do
  ├── 4. Synthèse Budgétaire : Total Consommé vs Budget Annuel
  └── 5. File d'Attente : selectValidationCenterQueues()
         │
         ▼
[ Rendu Graphique & Alerting ]
```

---

## 2. Formules Mathématiques Implémentées

### 2.1 Disponibilité Opérationnelle Globale ($D_o$)
$$\text{MTTR} = \frac{\sum \text{Durée Arrêts Curatifs (Heures)}}{\text{Nombre de Pannes}}$$
$$\text{MTBF} = \frac{\text{Temps d'Ouverture Total} - \sum \text{Durée Arrêts Curatifs}}{\text{Nombre de Pannes}}$$
$$D_o = \begin{cases} 
100\% & \text{si Nombre de Pannes} = 0 \\
\frac{\text{MTBF}}{\text{MTBF} + \text{MTTR}} \times 100\% & \text{sinon}
\end{cases}$$

### 2.2 Valorisation Totale du Stock Magasin ($V_{\text{stock}}$)
$$V_{\text{stock}} = \sum_{i \in \text{Articles}} \left( \text{stockActuel}_i \times \text{PUMP}_i \right)$$
- Calculé sans latence via `IncrementalStockIndex` en complexité $O(N)$ où $N$ est le nombre d'articles en stock.

### 2.3 Taux de Réalisation Préventif ($T_{\text{prev}}$)
$$T_{\text{prev}} = \frac{\text{Nombre de Visites Réalisées Horodatées}}{\text{Nombre Total de Visites Programmées (S1..S52)}} \times 100\%$$

---

## 3. Stratégie de Caching Multi-Niveaux (L1 / L2 / L3)

Pour garantir un rendu à 60 FPS même avec plus de 10 000 mouvements :
- **L1 (In-Memory React `useMemo`) :** Les calculs dérivés de la vue sont invalidés uniquement si les tableaux de références (`machines`, `mouvements`, `stockItems`) changent d'identité mémoire.
- **L2 (Cache Applicatif `CacheService`) :** Les agrégations lourdes (historique 12 mois) sont étiquetées avec le tag `[dashboard]`.
- **L3 (IndexedDB Tier) :** Sauvegarde locale asynchrone pour un démarrage instantané hors-ligne.
- **Invalidation :** Toute écriture via `DataGateway` ou `onAddMouvement` émet un événement d'invalidation sélective ciblant le tag `[dashboard]`.

---

## 4. Gestion des Cas Limites (Edge Cases)

| Cas Limite | Comportement Attendu | Implémentation |
| :--- | :--- | :--- |
| **Usine Vide (`START_MODE === 'empty'`)** | Tous les compteurs affichent `0` ou `0.00 DA`. Aucune division par zéro. | Garde `if (totalPannes === 0) return 100;` sur le calcul de disponibilité. |
| **Machine sans Compteur Horomètre** | N'apparaît pas dans la jauge d'alerte des compteurs. | Filtrage sur `m.type_compteur && m.type_compteur !== 'AUCUN'`. |
| **Mouvements Orphelins** | Ignorés du calcul de consommation par machine. | Jointure sécurisée avec vérification d'existence dans `filterActiveMachines`. |
