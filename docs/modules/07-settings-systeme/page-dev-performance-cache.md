---
id: page-dev-settings-performance-cache
groupId: 07-settings-systeme
groupTitle: Paramètres Système, Sauvegardes & Registre d’Audit
docType: architecture
audience: developer
tabId: settings_performance
title: Spécification Technique — Performance & Gestionnaire de Cache Multi-Niveaux
summary: Architecture de l'optimisation des performances et de la hiérarchie de cache. Implémentation de MultiLevelCacheManager (L1 Mémoire, L2 Applicatif, L3 IndexedDB), invalidation granulaire par tags et métriques de latence.
relatedTabs:
  - settings_performance
  - settings
  - dashboard
---

# 💻 Spécification Développeur : Performance & Caching Multi-Niveaux (`#settings_performance`)

> **Public :** Ingénieurs Performance, Développeurs Frontend & Modèles IA.  
> **Composant source :** `src/presentation/components/settings/PerformanceDashboardPanel.tsx`  
> **Gestionnaire de cache :** `src/application/services/MultiLevelCacheManager.ts`, `src/services/performanceService.ts`.  
> **Objectif SLA :** Rendu fluide à 60 FPS et requêtes d'agrégation d'inventaire < 15 ms.

---

## 1. Architecture du Cache à 3 Paliers (L1 / L2 / L3)

Pour garantir une réactivité immédiate même lors de l'interrogation de catalogues industriels dépassant 10 000 pièces :

```text
┌────────────────────────────────────────────────────────┐
│             REQUÊTE DE CALCUL OU D'INVENTAIRE          │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
[ PALIER L1 : Mémoire Vive Immédiate (RAM LRU) ]
  • Temps d'accès : < 0.5 ms
  • Capacité : 100 objets les plus récemment consultés
  • HIT ➔ Renvoi immédiat
                           │ MISS
                           ▼
[ PALIER L2 : Cache Applicatif Taggué (CacheService) ]
  • Temps d'accès : < 2 ms
  • Stockage : Résultats d'agrégations lourdes (Pareto, Dashboard 12 mois)
  • Clés étiquetées : [stock], [machines], [formula], [dashboard]
  • HIT ➔ Promotion en L1 & Renvoi
                           │ MISS
                           ▼
[ PALIER L3 : Persistance Locale Optimisée (IndexedDB) ]
  • Temps d'accès : 5 à 15 ms
  • Quota volumétrique étendu sans blocage du thread UI
  • HIT ➔ Promotion en L2/L1 & Renvoi
                           │ MISS
                           ▼
[ Calcul Réel / Lecture Disque Physique ] ➔ Peuplement L3, L2, L1
```

---

## 2. Invalidation Déterministe par Tags (Granular Tag Invalidation)

Lorsqu'un mouvement de stock ou une intervention est validé, il est inefficace de purger l'intégralité du cache. Le système applique une invalidation ciblée par étiquettes :

```typescript
// Exemple lors d'un nouveau mouvement de sortie PDR :
MultiLevelCache.invalidateTag('stock');     // Purge le cache du catalogue pièces
MultiLevelCache.invalidateTag('formula');   // Purge les totaux de stockActuel
// Note : Le cache des machines et des utilisateurs reste intact en RAM !
```

---

## 3. Métriques de Performance & Monitoring en Direct

Le panneau de diagnostic mesure et affiche :
- **Temps de Réponse Moyen (Latency en ms) :** Mesuré sur les 50 dernières opérations de lecture/écriture.
- **Ratio de Cache Hit (%) :** Pourcentage des requêtes servies directement par les paliers L1/L2 sans recalcul.
- **FPS (Frames Per Second) :** Fréquence de rafraîchissement des animations de l'interface atelier (seuil optimal $\ge 55\text{ FPS}$).
- **Bouton de Purge Manuelle :** Permet à l'administrateur de forcer le recalcul complet à chaud sans perte de données persistantes.
