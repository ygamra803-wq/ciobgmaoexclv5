---
id: page-dev-zones
groupId: 06-pilotage-gouvernance
groupTitle: Pilotage, Finance, Validation Maker-Checker & Système
docType: architecture
audience: developer
tabId: zones
title: Spécification Technique — Cadastre Géographique des Zones & Ateliers
summary: Architecture du référentiel spatial. Règle fondamentale séparant la Zone (géographie) de l'arborescence technique (Ligne/Machine/BOM), intégrité référentielle et blocage de suppression handleDeleteZone.
relatedTabs:
  - zones
  - machines
  - utilisateurs
---

# 💻 Spécification Développeur : Cadastre Géographique des Zones (`#zones`)

> **Public :** Développeurs Backend/Frontend, Architectes de Données & Modèles IA.  
> **Composant source :** `src/presentation/pages/referentiel/ZonesView.tsx`  
> **Gestionnaire métier :** `src/hooks/useAppComplexHandlers.ts` (`handleDeleteZone`)  
> **Clés SSOT :** `STORAGE_KEYS.ZONES`, `STORAGE_KEYS.MACHINES`, `STORAGE_KEYS.TECHNICIENS`.

---

## 1. Séparation Stricte : Géographie vs Arborescence Technique

Une erreur classique en GMAO consiste à mélanger la localisation spatiale de l'atelier avec la hiérarchie technique de la ligne de production. **CIOB GMAO Nexus v5.0.2** applique une séparation d'intérêts absolue :

```text
1. VECTEUR GÉOGRAPHIQUE (Spatial Location)
   └── Zone (Z-PROD-01, Z-UTI-02...)
       Attribut physique de l'usine (bâtiment, halle, atelier).
       Chaque machine enregistrée possède un id_zone_default.
       Chaque technicien possède une id_zone d'affectation.

2. VECTEUR HIÉRARCHIQUE OPÉRATIONNEL (Asset Rollup)
   └── Machine / Ligne (asset_level: 'LINE' | 'MACHINE', parent_id)
       Gouverne les rollups de disponibilité et de MTBF.
       Indépendant de la Zone (une Ligne ne remplace pas une Zone).

3. VECTEUR TECHNOLOGIQUE INTERNE (BOM / Nexus)
   └── Blueprint & Warehouse Items (Organes & Pièces montées)
       Gouverne la nomenclature technique interne de l'équipement.
```

---

## 2. Modèle de Données & Schéma de Zone

```typescript
export interface ZoneEntity {
  id_zone: string;        // Identifiant permanent normalisé (ex. 'Z-PROD-01')
  code_zone: string;      // Code d'atelier usine (ex. 'LAMINOIR')
  libelle: string;        // Libellé complet (ex. 'Atelier de Laminage à Chaud')
  type: ZoneType;         // Catégorie fonctionnelle ('PRODUCTION' | 'UTILITES' | 'FINITION' | 'MAGASIN')
  description?: string;   // Informations d'accès, consignes de sécurité, EPI obligatoires
}
```

---

## 3. Garde de Suppression & Intégrité Référentielle (`handleDeleteZone`)

Une zone géographique ne peut jamais être supprimée si des entités actives y sont encore physiquement rattachées. La fonction `handleDeleteZone` dans `src/hooks/useAppComplexHandlers.ts` applique un contrôle exhaustif :

```typescript
// Critères de blocage :
const hasMachines = activeMachines.some(
  (m) => matchesZone(m.id_zone_default) || matchesZone(m.id_zone)
);
const hasTechs = (technicians || []).some((t) => matchesZone(t.id_zone));
const hasOps = (operations || []).some((o) => matchesZone(o.id_zone));
const hasWarehouse = (warehouseItems || []).some((w) => matchesZone(w.id_zone));

if (hasMachines || hasTechs || hasOps || hasWarehouse) {
  showToast(
    `Suppression refusée : la zone ${id} contient des machines ou techniciens actifs (ou membres/articles d'entrepôt). Réaffectez-les d'abord.`,
    'warning'
  );
  return; // Interrompt la suppression sans modifier l'état
}
```

---

## 4. Cascades & Mises à Jour Automatiques

Lors de la mise à jour du code d'une zone (`handleUpdateZone`) :
- Les machines associées voient leur champ `id_zone_default` automatiquement actualisé.
- Les historiques d'interventions et de mouvements passés conservent la référence d'origine pour garantir l'auditabilité historique sans corruption de clé étrangère.
