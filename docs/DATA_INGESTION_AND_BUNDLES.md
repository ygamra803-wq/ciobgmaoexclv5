# 📦 DATA_INGESTION_AND_BUNDLES.md — Layered Data Ingestion & Bundle Contract (`DOC-IMPORT-P0` .. `INGEST-P8`)

> **Status:** Authoritative Engineering Contract (v5.0.2)
> **Scope:** Modes `A EMPTY` / `B IMPORT` / `C DEMO`, Export Taxonomy (`Type A Round-Trip` vs `Type B External`), Official JSON & `.XLSX` Bundle Templates (`README_TYPE_A`), Closed Import/Seed Backdoors (`INGEST-P6`), and `UnifiedImportPipeline` (`REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, `REF_PDR`, `PM_CATALOG`, `ENTREPOT_BOM`, `CM_CATALOG` & `DEMO_BUNDLE`).

---

## 1. Three Operating Modes — Zero Mixing (`A / B / C`)

| Mode | Identifier | Purpose | Persistence & Seed Behavior |
| :--- | :--- | :--- | :--- |
| **Mode A — Empty Factory** | `START_MODE = 'empty'` | Real factory initialization from zero records | `0` records across all tables. Zero silent fallback to `src/data/*.json` on bootstrap or `F5` reload. |
| **Mode B — Structured Import** | `UnifiedImportPipeline` | Real factory onboarding & catalog updates (`JSON_BUNDLE` / `EXCEL`) | Validated dependency order (`ZONES -> FAMILIES -> TEMPLATES -> GENERAL_SYSTEM_TYPES -> PERSONNEL -> MACHINES`, `PDR_GROUPS -> PDR_TYPES -> PDR_ITEMS`, `PM_ACTIONS -> PM_GUIDES`, `COMP_* -> PART_*`, & `CM_CATEGORIES -> CM_FAULTS`), atomic commit via `DataGateway`, and audit trail. |
| **Mode C — Demo Mode** | `START_MODE = 'demo'` | Interactive product demonstration | Triggered **exclusively** by explicit user action via `DataGateway.loadDemoData` / `DataGateway.loadDemoSection`. Fully purgeable via `DataGateway.clearAllForRealFactory`. |

---

## 2. Two Export Contracts — Never Conflate (`Type A` vs `Type B`)

| Export Class | Name | Re-importable via `UnifiedImportPipeline`? | Purpose & Schema |
| :--- | :--- | :--- | :--- |
| **Type A — Bundle Round-Trip** | Official Bundle / Template (`exportRefParcBundle`, `exportRefPersonnelBundle`, `exportAssetsMachinesBundle`, `exportRefPdrBundle`, `exportPmCatalogBundle`, `exportEntrepotBomBundle`, `exportCmCatalogBundle`, `templates/import/*.template.json`) | **YES** (`dryRun` / `MERGE` / `REPLACE_CATALOG`) | Strict layered ingestion contract using canonical `code_*` / `ref` keys (`code_zone`, `code_family`, `code_template`, `code_system_type`, `code_technician`, `code_operation`, `code_machine`, `code_group`, `code_type`, `ref`, `code_action`, `code_guide`, `code_comp_*`, `code_part_*`, `code_category`, `code_fault`). |
| **Type B — External Export** | Screen / Reporting Export (`Export externe`) | **NO** — Never feed into `UnifiedImportPipeline` | Human-readable reports, print views, **stock movement ledgers (`Sortie / Entrée rapide`)**, accounting extracts, or third-party CSV/XLSX tables. May contain display columns or omit canonical `code_*` keys. |

### Official Templates = Structural Source of Truth
- Official templates live in:
  - `templates/import/REF_PARC.template.json`
  - `templates/import/REF_PERSONNEL.template.json`
  - `templates/import/ASSETS_MACHINES.template.json`
  - `templates/import/REF_PDR.template.json`
  - `templates/import/PM_CATALOG.template.json`
  - `templates/import/ENTREPOT_BOM.template.json`
  - `templates/import/CM_CATALOG.template.json`
- **Field Workflow:** Download official template (`Télécharger le modèle`) ➔ Fill rows ➔ Validate (`Vérifier dryRun`) ➔ Commit (`Importer MERGE`).
- **Validation Philosophy:** Because the official template locks the exact structure and column names, `UnifiedImportPipeline` never guesses what kind of file was uploaded — it validates **values, required fields, key uniqueness, and foreign-key referential integrity**.

### Guarded Live Transactions (NOT Level 2 Bundles)
- Stock movements (`Sortie`, `Entrée`, `Ajustement`) and `Sortie / Entrée rapide` transactions are **not** Level 2 `REF` bundles and are **never** bulk-imported via `UnifiedImportPipeline`.
- Pre-feeding comes from `REF_PDR` (+ `ASSETS_MACHINES` & `REF_PERSONNEL`). Movement creation goes exclusively through guarded application workflows (Maker-Checker `sortieDemands`, `StockCalculationService`, `IncrementalStockIndex`). Exporting movement history is strictly **Type B**.

---

## 3. Three-Level Data Topology (References vs Live Assets vs Cognitive Blueprint)

1. **Level 2 — Reference Catalogs (Must Exist First):**
   - Geographical `ZONES` (`code_zone`), Equipment `FAMILIES` (`code_family`), Manufacturer `TEMPLATES` (`code_template` linked to `code_family`), and Utility `GENERAL_SYSTEM_TYPES` (`code_system_type`) packaged in the **`REF_PARC`** bundle.
   - Field `TECHNICIANS` (`code_technician` linked to `code_zone`) and `OPERATIONS` (`code_operation` linked to `code_zone`) packaged in the **`REF_PERSONNEL`** bundle (`02_PERSONNEL`).
   - Spare Parts Catalog `PDR_GROUPS` (`code_group`), `PDR_TYPES` (`code_type` linked to `code_group`), and `PDR_ITEMS` (`ref` linked to `code_type` and `code_group`) packaged in the **`REF_PDR`** bundle (`04_PDR`).
   - Preventive Maintenance Catalog `PM_ACTIONS` (`code_action`) and `PM_GUIDES` (`code_guide` linked to `actions_liees` and optional `pieces_rechange[].ref`) packaged in the **`PM_CATALOG`** bundle (`05_PM_CATALOG`).
2. **Level 1 — Registered Physical Assets (`Machine Registered`):**
   - Real shopfloor assets (`code_machine`) packaged in the **`ASSETS_MACHINES`** bundle.
   - Each registered machine **exclusively owns** its physical `code_zone`, `asset_class` (`PRODUCTION` vs `SYSTEM_GENERAL`), `code_family` + `code_template` (or `code_system_type`), optional `code_technician`, and optional operational line pointer (`parent_code_machine`, `asset_level: 'MACHINE' | 'LINE'`).
   - Operational records (`preventiveTasks`, `correctiveInterventions`, `mouvements`, `warehouseItems`) attach to registered machines only after Level 1 exists.
3. **Tier 3 — Cognitive Engineering Fingerprint (`Blueprint`):**
   - Virtual knowledge twin (`gmao_blueprints_v2`) built and enriched inside the application from real maintenance history (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`, `preventivePlanItems`, `commonFailures`).
   - **Never** embedded inside `REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, `REF_PDR`, or `PM_CATALOG` import rows (`FORBIDDEN_BUNDLE_FIELD`), and **never** owns a physical `Zone` or `Technician`.

---

## 4. Implemented Bundles (`REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES` & `REF_PDR`)

### 4.1 `REF_PARC` Bundle (Level 2 Reference Layer — `01_ZONES` ➔ `03_FAMILIES` ➔ `03_TEMPLATES` ➔ `03_GENERAL_SYSTEM_TYPES`)
- **Canonical Stable Keys:**
  - `zones[]`: `{ code_zone, libelle, description?, is_active? }`
  - `families[]`: `{ code_family, libelle, description? }`
  - `templates[]`: `{ code_template, code_family, libelle, constructeur?, puissance?, vitesse?, description? }`
  - `generalSystemTypes[]`: `{ code_system_type, libelle, is_active? }`

### 4.2 `REF_PERSONNEL` Bundle (Level 2 Personnel & Intervenants Layer — `02_PERSONNEL`)
- **Stage:** `02_PERSONNEL` (requires `ZONES` from `REF_PARC` to be present in live store whenever `code_zone` is specified).
- **Canonical Stable Keys:**
  - `technicians[]`: `{ code_technician, nom, code_zone?, type_profil?, specialite?, is_active? }`
  - `operations[]`: `{ code_operation, nom, code_zone, is_active? }`
- **Strict Isolation from Authentication / Login Accounts (`AuthService`):**
  - Any authentication or secret field (`password`, `passwordHash`, `pin`, `token`, `secret`, `apiKey`, `permissions`) is strictly rejected with `FORBIDDEN_BUNDLE_FIELD`.

### 4.3 `ASSETS_MACHINES` Bundle (Level 1 Physical Assets Layer — `03_MACHINES`)
- **Stage:** `03_MACHINES` (requires `REF_PARC` references to be present in live store).
- **Canonical Stable Keys:**
  - `machines[]`: `{ code_machine, designation, code_zone, asset_class, code_family?, code_template?, code_system_type?, code_technician?, parent_code_machine?, asset_level?, status?, is_active?, serial_number?, commissioning_date? }`

### 4.4 `REF_PDR` Bundle (Level 2 Spare Parts Catalog Layer — `04_PDR_GROUPS` ➔ `04_PDR_TYPES` ➔ `04_PDR_ITEMS`)
- **Strict Stage Order (Reusing `validateAndReconcilePdrCatalogImport` & `applyPdrCatalogImportToStore` from `pdrExcelValidator.ts`):**
  `04_PDR_GROUPS` ➔ `04_PDR_TYPES` ➔ `04_PDR_ITEMS`
- **Canonical Stable Keys & Storage Mapping:**
  - `groups[]`: `{ code_group, libelle, description?, domaine_technique?, default_policy_tags?, sort_order?, is_active? }` ➔ persisted via `DataGateway.savePdrGroups` (`STORAGE_KEYS.PDR_GROUPS`, `id: GRP-{CODE}`).
  - `types[]`: `{ code_type, code_group, libelle, domaine_technique?, is_active? }` ➔ persisted via `DataGateway.saveStockTypes` (`STORAGE_KEYS.STOCK_TYPES`, `id_type`, `id_group`).
  - `items[]`: `{ ref, designation, code_type, code_group, seuil?, emplacement?, stockInitial?, prix_unitaire?, unite_mesure?, criticite?, ref_constructeur?, policy_tags? }` ➔ persisted via `DataGateway.saveStock` & `DataGateway.saveDesignations` (`STORAGE_KEYS.STOCK_ITEMS`, `STORAGE_KEYS.PART_DESIGNATIONS`).
- **Validation & Stock Invariant Rules:**
  - Rejects broken `code_group` or `code_type` links and group/type hierarchy mismatches (`BROKEN_FK`).
  - Rejects duplicate `code_group`, `code_type`, or `ref` (`DUPLICATE_KEY`).
  - Rejects any embedded movements or operational/auth fields (`mouvements`, `machines`, `preventiveTasks`, `interventions`, `password*`, `blueprints`) with `FORBIDDEN_BUNDLE_FIELD`.
  - **Zero Movement Creation & Zero `IncrementalStockIndex` Modification:** `REF_PDR` never writes stock movements (`Sortie`/`Entrée`). When `stockInitial` is omitted on a new item, it defaults strictly to `0` (never falls back to `seedStockItems.json`).
  - **`REPLACE_CATALOG` Guard:** Blocks replacement with `REFERENCED_BY_ACTIVE_RECORDS` if any removed `ref` has historical movements in `mouvements`.

### 4.5 `PM_CATALOG` Bundle (Level 2 Preventive Catalog Layer — `05_PM_ACTIONS` ➔ `05_PM_GUIDES`)
- **Strict Stage Order (Level 2 Machine-Agnostic Only):**
  `05_PM_ACTIONS` ➔ `05_PM_GUIDES`
- **Canonical Stable Keys & Storage Mapping:**
  - `actions[]`: `{ code_action, libelle, ref?, description?, type_maintenance?, frequence_defaut?, duree_standard?, outils?, couleur?, icone?, is_active? }` ➔ persisted via `DataGateway.savePreventiveActions` (`STORAGE_KEYS.PREVENTIVE_ACTIONS`).
  - `guides[]`: `{ code_guide, composant_nom, famille?, ref?, actions_liees[], pieces_rechange[]?, fiches_actions?, consignes_securite?, criticite?, is_active? }` ➔ persisted via `DataGateway.savePreventiveGuides` (`STORAGE_KEYS.PREVENTIVE_GUIDES`).
- **Validation & Boundary Rules:**
  - Every action code in `guides[].actions_liees` and `guides[].fiches_actions` must resolve in `05_PM_ACTIONS` (`BROKEN_FK` otherwise).
  - When `rawStock` (`REF_PDR`) is populated (or `strictPdrCheck: true`), `guides[].pieces_rechange[].ref` must exist in `rawStock` (`BROKEN_FK`).
  - Strictly forbids machine-level or operational fields (`preventiveTasks`, `preventivePlans`, `preventiveExecutions`, `id_machine`, `code_machine`, `id_zone`, `mouvements`, `password*`) with `FORBIDDEN_BUNDLE_FIELD`.
  - **`REPLACE_CATALOG` Guard:** Blocks replacement with `REFERENCED_BY_ACTIVE_RECORDS` if any removed `code_action` is referenced by existing `preventiveTasks` or `preventiveExecutions`.

### 4.6 `ENTREPOT_BOM` Bundle (Level 2 Components & Parts BOM Reference Layer — `06_*`)
- **Strict 6-Stage Hierarchy (Level 2 Classifications Only):**
  - Components: `06_COMP_GROUPS` ➔ `06_COMP_FAMILIES` ➔ `06_COMP_TEMPLATES` (`compGroups`, `compFamilies`, `compTemplates`).
  - Parts: `06_PART_GROUPS` ➔ `06_PART_TYPES` ➔ `06_PART_DESIGNATIONS` (`partGroups`, `partTypes`, `partDesignations`).
- **Boundary & Referential Rules:**
  - Enforces group ➔ family ➔ template and group ➔ type ➔ designation FKs (`BROKEN_FK` & `TEMPLATE_FAMILY_MISMATCH`), duplicate detection, and non-negative thresholds (`seuil >= 0`).
  - Strictly rejects physical warehouse instances (`warehouseItems`, `entrepotComponents`), live machine mounts (`machineElementsLedger`), `machines`, `mouvements`, and auth secrets (`FORBIDDEN_BUNDLE_FIELD`).
  - **`REPLACE_CATALOG` Guard:** Blocks removal of any `compGroup`/`compFamily`/`compTemplate`/`partGroup`/`partType`/`partDesignation` still referenced in `warehouseItems`, `entrepotComponents`, or `machineElementsLedger` (`REFERENCED_BY_ACTIVE_RECORDS`).

### 4.7 `CM_CATALOG` Bundle (Level 2 Fault Categories & Actions Catalog — `07_*`)
- **Strict 2-Stage Hierarchy:** `07_PANNE_CATEGORIES` (`categories[]`) ➔ `07_PANNE_ACTIONS` (`faults[]` with standardized `actions[]`).
- **Boundary & Referential Rules:**
  - Persists to `STORAGE_KEYS.CORRECTIVE_PANNE_CATEGORIES` and `STORAGE_KEYS.CORRECTIVE_ACTIONS_BY_PANNE`.
  - Rejects unknown categories (`BROKEN_FK`), duplicate `code_fault` or duplicate `(code_category, panne)` pairs (`DUPLICATE_KEY`), and any operational work-order/BT fields (`correctiveInterventions`, `bonsTravail`, `demandes`, `num_bt`, `machines`, `password*`) with `FORBIDDEN_BUNDLE_FIELD`.
  - **`REPLACE_CATALOG` Guard:** Blocks removal of categories or fault labels actively used by `correctiveInterventions` (`REFERENCED_BY_ACTIVE_RECORDS`).

### 4.8 `DEMO_BUNDLE` (Unified Multi-Stage Mode C Hydration — `validateAndCommitDemoBundle`)
- **Strict Causal Pipeline Sequence:**
  `REF_PARC` (`01_ZONES` ➔ `03_FAMILIES` ➔ `03_TEMPLATES` ➔ `03_GENERAL_SYSTEM_TYPES`) ➔ `REF_PERSONNEL` (`02_PERSONNEL`) ➔ `ASSETS_MACHINES` (`03_MACHINES`) ➔ `REF_PDR` (`04_PDR_GROUPS` ➔ `04_PDR_TYPES` ➔ `04_PDR_ITEMS`) ➔ `PM_CATALOG` (`05_PM_ACTIONS` ➔ `05_PM_GUIDES`) ➔ optional `ENTREPOT_BOM` (`06_*`) ➔ optional `CM_CATALOG` (`07_*`)
- **Architectural Guarantee:**
  - `DataGateway.loadDemoData()` constructs the canonical `DEMO_BUNDLE` via `DataGateway.getOfficialDemoBundle()` and validates all 7 structured catalog/asset layers through `validateAndCommitDemoBundle` (`origin: 'DEMO_BUNDLE'`).
  - Any broken foreign key (`BROKEN_FK`) across demo seeds aborts hydration immediately instead of silently writing orphan records.
  - Legacy zone labels on demo machines and technicians (e.g. `"Préparation Corniche et Emballage"` ➔ `"PCE"`, `"Polissage"` ➔ `"POLISSAG"`) are automatically normalized to canonical `code_zone`.

---

## 5. Mandatory Edge Cases Enforced in the Engine

1. **Zone Normalization & Legacy Compatibility (`LEGACY_ZONE_NORMALIZED`):**
   - On `ZONES` import, `code_zone` is normalized to canonical `trim + uppercase` (e.g. `' detourag ' ➔ 'DETOURAG'`).
   - When resolving `code_zone` in `REF_PERSONNEL` or `ASSETS_MACHINES`, matches canonical `code_zone` first, then legacy `id_zone` or `libelle` with a `LEGACY_ZONE_NORMALIZED` warning.
2. **Two-Pass `parent_code_machine` Resolution & `sanitizeMachinesHierarchy`:**
   - Resolves `parent_code_machine` in a second pass and rejects missing parents (`BROKEN_FK`) and cycles (`CIRCULAR_HIERARCHY`).
3. **`REPLACE_CATALOG` Guard (`REFERENCED_BY_ACTIVE_RECORDS`):**
   - Restricted to `ADMIN` role (`RBAC_DENIED` otherwise).
   - Blocks replacement of any catalog record still referenced by active operational records (`REFERENCED_BY_ACTIVE_RECORDS`).

---

## 6. Closed Seed & Legacy Import Backdoors (`INGEST-P6`)

1. **Single Seed Gateway:** `src/application/DataGateway.ts` is the **sole** production module permitted to import `src/data/*.json` (enforced by automated unit test).
2. **Zero Silent Bootstrap Injection:** `App.tsx` never auto-injects `initRealStock` or any demo catalog on empty collections. `DataGateway.initRealStock` and `DataGateway.loadDemoSection` (`stock`, `zones`, `parc`, `preventive`) validate and normalize exclusively through `UnifiedImportPipeline`.
3. **Guarded Global File Import (`useAppExcelOperations`):** `executeGuardedGlobalFileImport` / `handleImportFile` accepts **only** recognized Type A JSON bundles (`runUnifiedImportPipeline` `MERGE`) and blocks raw `.xlsx` Type B workbooks (`TYPE_B_EXCEL_BLOCKED`) or non-Type-A JSON overwrites (`UNRECOGNIZED_JSON_BLOCKED`). `handleDirectFileLink` operates strictly in **outbound Type B mirror mode** (never overwrites `rawStock`, `machines`, or `mouvements`).
4. **Task Import Guard (`PreventiveService.bulkImportTasks`):** Machine-level task imports via `TaskImportModal` require valid active registered machines (`ASSETS_MACHINES`), block `replace = true` when historical `PreventiveExecution` records exist (`REFERENCED_BY_ACTIVE_RECORDS`), and append an audit event (`PM_TASKS_BULK_IMPORT`).
5. **Explicit Type B Screen Labeling:** Header 3-Workbook exports, `IndustrialFilterCard`, `MobileSidebarDrawer`, and operational table exports explicitly state `Type B` (external consultation, non-reimportable).

---

## 7. Official Type A `.XLSX` Excel Bridge & UI Governance (`INGEST-P7`)

1. **Authenticated Type A Workbooks (`src/services/import/typeAExcelBridge.ts`):**
   - `buildTypeAExcelWorkbookBuffer` generates `.xlsx` templates and Type A round-trip exports for `REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, `REF_PDR`, and `PM_CATALOG` with a locked `README_TYPE_A` sheet (`contract = TYPE_A_BUNDLE_ROUND_TRIP`, `bundleType`).
   - `parseTypeAExcelWorkbook` parses **only** workbooks carrying a valid `README_TYPE_A` signature and routes the normalized payload strictly through `UnifiedImportPipeline` (`origin: 'EXCEL'`). Arbitrary/Type B `.xlsx` workbooks (`Stock_Actuel`, `Mouvements`, `Machines_Registered`) are deterministically rejected as `TYPE_B_OR_UNRECOGNIZED_EXCEL` / `TYPE_B_EXCEL_BLOCKED`.
2. **ADMIN-Only `REPLACE_CATALOG` Mode Selector (`SettingsInjectionTab.tsx`):**
   - Non-ADMIN roles are restricted to `MERGE`. `ADMIN` users can switch to `REPLACE_CATALOG` with explicit destructive confirmation (`confirmAction`) while preserving active-reference guards (`REFERENCED_BY_ACTIVE_RECORDS`).
3. **Post-Import `REF_PERSONNEL` Auth UX Hint:**
   - Committing `REF_PERSONNEL` surfaces a clear reminder banner noting that imported staff carry zero authentication secrets and directs Admins to **Utilisateurs & Accès** to activate login PINs/passwords if needed.
4. **LAN Host Commit Sync Hook:**
   - Every non-dryRun commit in `UnifiedImportPipeline` updates `gmao_local_modified_at` and triggers `serverSyncService.scheduleAutoPush(...)` in browser/LAN mode.

---

## 8. Code Pointers, Official Templates & Test Suite

| Component | Path | Key Exports / Role |
| :--- | :--- | :--- |
| **Official `REF_PARC` Template** | `templates/import/REF_PARC.template.json` | Canonical Type A template for `ZONES`, `FAMILIES`, `TEMPLATES`, `GENERAL_SYSTEM_TYPES` |
| **Official `REF_PERSONNEL` Template** | `templates/import/REF_PERSONNEL.template.json` | Canonical Type A template for `TECHNICIANS` (`code_technician`) and `OPERATIONS` (`code_operation`) |
| **Official `ASSETS_MACHINES` Template** | `templates/import/ASSETS_MACHINES.template.json` | Canonical Type A template for `PRODUCTION` & `SYSTEM_GENERAL` machines |
| **Official `REF_PDR` Template** | `templates/import/REF_PDR.template.json` | Canonical Type A template for `PDR_GROUPS` (`code_group`), `PDR_TYPES` (`code_type`), `PDR_ITEMS` (`ref`) |
| **Official `PM_CATALOG` Template** | `templates/import/PM_CATALOG.template.json` | Canonical Type A template for `PM_ACTIONS` (`code_action`) and `PM_GUIDES` (`code_guide`) |
| **Official `ENTREPOT_BOM` Template** | `templates/import/ENTREPOT_BOM.template.json` | Canonical Type A template for `COMP_*` and `PART_*` Level 2 BOM classifications |
| **Official `CM_CATALOG` Template** | `templates/import/CM_CATALOG.template.json` | Canonical Type A template for `CM_CATEGORIES` and `CM_FAULTS` corrective fault catalog |
| **Type A Excel Bridge (`.xlsx`)** | `src/services/import/typeAExcelBridge.ts` | `buildTypeAExcelWorkbookBuffer`, `downloadTypeAExcelWorkbook`, `parseTypeAExcelWorkbook`, `TYPE_A_WORKBOOK_SPECS` (all 7 Type A bundles) |
| **Pipeline Types & Contracts** | `src/services/import/types/unifiedImportTypes.ts` | `ImportReport`, `ImportIssue`, `RefParcBundleInput`, `RefPersonnelBundleInput`, `AssetsMachinesBundleInput`, `RefPdrBundleInput`, `PmCatalogBundleInput`, `EntrepotBomBundleInput`, `CmCatalogBundleInput`, `DemoBundleInput` |
| **Core Pipeline Engine** | `src/services/import/unifiedImportPipeline.ts` | `validateAndCommit*Bundle`, `validateAndCommitDemoBundle`, `runUnifiedImportPipeline`, `registerPipelineCommitListener`, `export*Bundle`, `get*OfficialTemplate` |
| **PDR Catalog Validator** | `src/services/pdr/pdrExcelValidator.ts` | `validateAndReconcilePdrCatalogImport`, `applyPdrCatalogImportToStore` |
| **Settings UI Integration (`P1.1`..`P8`)** | `src/presentation/pages/settings/components/SettingsInjectionTab.tsx` | Official `.json`/`.xlsx` templates (7 cards), Dry-Run (`dryRun: true`), `MERGE` / ADMIN `REPLACE_CATALOG`, Type A Round-Trip exports, and `REF_PERSONNEL` auth hint |
| **Unit Test Suite** | `src/tests/unit/UnifiedImportPipeline.test.ts` | Unit tests covering SSOT backdoor isolation, official JSON & `.xlsx` Type A round-trips, Type B rejection, `REPLACE_CATALOG` RBAC, commit sync hooks, and all 7 bundles |

