---
id: group-05-entrepot-organes-architecture
groupId: 05-entrepot-organes
groupTitle: Entrepôt Organes & Pièces Détachées
docType: architecture
audience: developer
title: Architecture & Spécifications Techniques — Groupe 05 : Entrepôt Organes & Pièces
summary: Spécification technique de l'entrepôt des organes et pièces, arborescence à 4 niveaux (Groupes ➔ Familles ➔ Modèles ➔ Entrepôt), taxonomie des pièces détachées, cycle de vie physique des organes (DISPONIBLE, INSTALLE, EN_REPARATION, REFORME), montage sur machines Nexus et intégrité référentielle.
relatedTabs:
  - entrepot
  - comp_groups
  - comp_families
  - comp_templates
  - part_types
  - part_designations
  - nexus
---

# 🏛️ Group 05 : Entrepôt Organes & Pièces Détachées — Architecture & Spécifications Techniques

> **Destination :** Développeurs, Architectes Logiciels, Auditeurs Système & Modèles IA.  
> **Périmètre applicatif :** Entrepôt physique des organes complets (`warehouseItems`), taxonomie 4 niveaux des sous-ensembles électromécaniques (`CompGroup`, `CompFamily`, `CompTemplate`), taxonomie des pièces de structure (`PartType`, `PartDesignation`), cycle de vie physique des organes, et montage sur le parc machines (`machineElementsLedger` / `Nexus BOM`).

---

## 1. Vue d'Ensemble & Distinction Fondamentale

Dans **CIOB GMAO v4**, il existe une distinction architecturale capitale entre le **Magasin PDR classique** et l'**Entrepôt d'Organes** :

1. **Magasin PDR classique (`articles` / `Stock PDR`) :**
   - Articles fongibles et consommables : roulements, filtres, fusibles, joints toriques, courroies, huiles.
   - Gérés par quantité brute (`stockActuel`) et valorisés au Coût Moyen Unitaire Pondéré (PUMP).
2. **Entrepôt d'Organes & Pièces (`warehouseItems` / `Entrepôt`) :**
   - Sous-ensembles complexes, machines tournantes et blocs complets : moteurs électriques (triphasés, servo), réducteurs à engrenages, pompes hydrauliques/centrifuges, variateurs de vitesse, vérins pneumatiques lourds.
   - Ces équipements possèdent une identité physique, un numéro de série individuel, un historique d'installations successives sur les machines, et traversent un cycle d'entretien (révision, rebobinage, réforme).

---

## 2. Taxonomie en 4 Niveaux des Organes (`Architecture 4 Niveaux`)

Afin d'éviter les catalogues plats impossibles à maintenir, la structure des organes adopte une hiérarchie stricte en 4 niveaux (`docs/COMPOSANTS_HIERARCHIE_ET_IDENTIFIANTS.md`) :

```text
[ Niveau 1 : GROUPE COMPOSANT (CompGroup) ]
  │   Ex: MOTEUR, REDUCTEUR, POMPE, VARIATEUR
  │
  └───► [ Niveau 2 : FAMILLE COMPOSANT (CompFamily) ]
          │   Ex: MOT-3PH (Moteur Asynchrone Triphasé)
          │
          └───► [ Niveau 3 : MODÈLE / TEMPLATE (CompTemplate) ]
                  │   Ex: MOT-3PH-40KW-1430 (4.0 kW, 1430 tr/min, 380V, B3)
                  │
                  └───► [ Niveau 4 : ÉLÉMENT PHYSIQUE EN ENTREPÔT (WarehouseItem) ]
                          Ex: Moteur N° Série SEW-88421, Rayon B-02, Statut: DISPONIBLE
```

### Triplet Identifiant Canonique : `ID` vs `CODE` vs `REF`
- **`ID` (Identifiant Système Immuable) :** Clé primaire interne (ex. `GRP-MOTEUR-001`, `FAM-MOT-3PH-001`, `TPL-MOT-3PH-40KW-1430-001`). Jamais modifiée par les utilisateurs.
- **`CODE` (Mnémonique Usine Atelier) :** Code lisible par les techniciens sur les plaques d'identification (ex. `MOT-3PH-40KW-1430`).
- **`REF` (Référence Constructeur P/N) :** Numéro de catalogue officiel du fabricant (ex. `Siemens 1LA7083-4AA`, `SEW DRS71S4`) utilisé pour les commandes fournisseurs.

---

## 3. Taxonomie Parallèle des Pièces Détachées (`Parts Structure`)

Pour les éléments mécaniques et de tôlerie ne constituant pas un organe autonome :

```text
[ TYPE DE PIÈCE (PartType) ] (id_type: 'CARTER', 'ARBRE', 'FLASQUE', 'ENGRENAGE')
     │
     └───► [ DÉSIGNATION DE PIÈCE (PartDesignation) ] (id_designation, dimensions, matière)
             │
             └───► [ STOCK PHYSIQUE PIÈCES ] (warehouseItems avec nature: 'PART')
```

- La fonction `isWarehouseComponent(item)` et `isWarehousePart(item)` dans `src/core/domain/EntrepotItem.ts` sépare automatiquement les deux natures sans ambiguïté.

---

## 4. Cycle de Vie Physique de l'Organe (`Physical Organ Lifecycle`)

Chaque organe enregistré dans `warehouseItems` se trouve dans un état opérationnel déterministe :

| Statut | Signification Industrielle | Emplacement / Rattachement |
| :--- | :--- | :--- |
| `DISPONIBLE` / `EN_STOCK` | Organe prêt à l'emploi, révisé ou neuf. | Stocké sur une étagère de l'entrepôt (`emplacement`: ex. `Rayon A-02`). `id_machine` est nul. |
| `INSTALLE` / `EN_SERVICE` | Organe monté physiquement sur une machine active de l'usine. | Rattaché à une machine (`id_machine` renseigné). Fait partie du `Nexus BOM` de l'équipement. |
| `EN_REPARATION` / `BOBINAGE` | Organe démonté envoyé à l'atelier central ou chez un sous-traitant pour révision/rebobinage. | Lié à une sortie externe (`SortieExterneBobinageView`). Sortie temporaire tracée. |
| `REFORME` / `ARCHIVE` | Organe détruit, obsolète ou irréparable. | Retiré du parc actif. Conservé dans l'historique pour traçabilité comptable et technique. |

---

## 5. Mécanique de Montage et Démontage sur Machine (`Nexus Ledger`)

1. **Montage d'un Organe sur une Machine :**
   - Le technicien sélectionne un composant au statut `DISPONIBLE`.
   - Il sélectionne la machine cible parmi le parc actif (`filterActiveMachines`).
   - Le statut passe à `INSTALLE`, son champ `id_machine` est mis à jour, et une ligne d'historique est ajoutée dans le registre de la machine.
2. **Démontage / Remplacement :**
   - Lorsqu'un moteur brûle sur une ligne, il est démonté : son statut passe à `EN_REPARATION` avec saisie du diagnostic de défaillance.
   - Un moteur de remplacement identique (`même CompTemplate`) est prélevé de l'entrepôt et passe à `INSTALLE`.
   - **Bénéfice :** L'historique d'exploitation et d'usure du moteur suit l'organe, tandis que l'historique de la machine trace le remplacement.

---

## 6. Évaluation de l'Usure & Santé Composant (`evaluateComponentWearAndLifecycle`)

Le service `src/utils/componentHealthScore.ts` évalue l'indice de santé d'un composant monté :
- Durée cumulée d'installation (en jours ou heures réelles machine).
- Nombre de réparations ou rebobinages antérieurs.
- Fréquence des défaillances associées dans les Bons de Travail (`BT`).
- Alerte visuelle : 🟢 *Excellent* (0–25%), 🟡 *Surveillance* (26–60%), 🟠 *À réviser* (61–85%), 🔴 *Remplacement préconisé* (> 85%).

---

## 7. Protection de l'Intégrité Référentielle (Cascading & Safe Guards)

Le système interdit toute rupture de lien orphelin :
1. **Suppression d'un Groupe (`CompGroup`) :** Bloquée si au moins une Famille (`CompFamily`) y est rattachée.
2. **Suppression d'une Famille (`CompFamily`) :** Bloquée si des Modèles (`CompTemplate`) ou des organes y font référence.
3. **Suppression d'un Modèle (`CompTemplate`) :** Bloquée si des organes physiques sont présents en entrepôt ou montés sur des machines.
4. **Suppression d'un Organe (`WarehouseItem`) :** Bloquée s'il est au statut `INSTALLE` sur une machine active. Il doit d'abord être formellement démonté.
