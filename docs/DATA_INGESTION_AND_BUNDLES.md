# 📦 DATA_INGESTION_AND_BUNDLES.md — Layered Data Ingestion & Bundle Contract (`DOC-IMPORT-P0` / `CLOSE-INGEST-P1.1` / `INGEST-P2` / `INGEST-P3`)

> **Status:** Authoritative Engineering Contract (v5.0.2)
> **Scope:** Modes `A EMPTY` / `B IMPORT` / `C DEMO`, Export Taxonomy (`Type A Round-Trip` vs `Type B External`), Official Bundle Templates, Closed Seed Backdoors, and `UnifiedImportPipeline` (`REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES` & `REF_PDR`).

---

## 1. Three Operating Modes — Zero Mixing (`A / B / C`)

| Mode | Identifier | Purpose | Persistence & Seed Behavior |
| :--- | :--- | :--- | :--- |
| **Mode A — Empty Factory** | `START_MODE = 'empty'` | Real factory initialization from zero records | `0` records across all tables. Zero silent fallback to `src/data/*.json` on bootstrap or `F5` reload. |
| **Mode B — Structured Import** | `UnifiedImportPipeline` | Real factory onboarding & catalog updates (`JSON_BUNDLE` / `EXCEL`) | Validated dependency order (`ZONES -> FAMILIES -> TEMPLATES -> GENERAL_SYSTEM_TYPES -> PERSONNEL -> MACHINES` & `PDR_GROUPS -> PDR_TYPES -> PDR_ITEMS`), atomic commit via `DataGateway`, and audit trail. |
| **Mode C — Demo Mode** | `START_MODE = 'demo'` | Interactive product demonstration | Triggered **exclusively** by explicit user action via `DataGateway.loadDemoData` / `DataGateway.loadDemoSection`. Fully purgeable via `DataGateway.clearAllForRealFactory`. |

---

## 2. Two Export Contracts — Never Conflate (`Type A` vs `Type B`)

| Export Class | Name | Re-importable via `UnifiedImportPipeline`? | Purpose & Schema |
| :--- | :--- | :--- | :--- |
| **Type A — Bundle Round-Trip** | Official Bundle / Template (`exportRefParcBundle`, `exportRefPersonnelBundle`, `exportAssetsMachinesBundle`, `exportRefPdrBundle`, `templates/import/*.template.json`) | **YES** (`dryRun` / `MERGE` / `REPLACE_CATALOG`) | Strict layered ingestion contract using canonical `code_*` / `ref` keys (`code_zone`, `code_family`, `code_template`, `code_system_type`, `code_technician`, `code_operation`, `code_machine`, `code_group`, `code_type`, `ref`). |
| **Type B — External Export** | Screen / Reporting Export (`Export externe`) | **NO** — Never feed into `UnifiedImportPipeline` | Human-readable reports, print views, accounting extracts, or third-party CSV/XLSX tables. May contain display columns or omit canonical `code_*` keys. |

### Official Templates = Structural Source of Truth
- Official templates live in:
  - `templates/import/REF_PARC.template.json`
  - `templates/import/REF_PERSONNEL.template.json`
  - `templates/import/ASSETS_MACHINES.template.json`
  - `templates/import/REF_PDR.template.json`
- **Field Workflow:** Download official template (`Télécharger le modèle`) ➔ Fill rows ➔ Validate (`Vérifier dryRun`) ➔ Commit (`Importer MERGE`).
- **Validation Philosophy:** Because the official template locks the exact structure and column names, `UnifiedImportPipeline` never guesses what kind of file was uploaded — it validates **values, required fields, key uniqueness, and foreign-key referential integrity**.

---

## 3. Three-Level Data Topology (References vs Live Assets vs Cognitive Blueprint)

1. **Level 2 — Reference Catalogs (Must Exist First):**
   - Geographical `ZONES` (`code_zone`), Equipment `FAMILIES` (`code_family`), Manufacturer `TEMPLATES` (`code_template` linked to `code_family`), and Utility `GENERAL_SYSTEM_TYPES` (`code_system_type`) packaged in the **`REF_PARC`** bundle.
   - Field `TECHNICIANS` (`code_technician` linked to `code_zone`) and `OPERATIONS` (`code_operation` linked to `code_zone`) packaged in the **`REF_PERSONNEL`** bundle (`02_PERSONNEL`).
   - Spare Parts Catalog `PDR_GROUPS` (`code_group`), `PDR_TYPES` (`code_type` linked to `code_group`), and `PDR_ITEMS` (`ref` linked to `code_type` and `code_group`) packaged in the **`REF_PDR`** bundle (`04_PDR`).
2. **Level 1 — Registered Physical Assets (`Machine Registered`):**
   - Real shopfloor assets (`code_machine`) packaged in the **`ASSETS_MACHINES`** bundle.
   - Each registered machine **exclusively owns** its physical `code_zone`, `asset_class` (`PRODUCTION` vs `SYSTEM_GENERAL`), `code_family` + `code_template` (or `code_system_type`), optional `code_technician`, and optional operational line pointer (`parent_code_machine`, `asset_level: 'MACHINE' | 'LINE'`).
   - Operational records (`preventiveTasks`, `correctiveInterventions`, `mouvements`, `warehouseItems`) attach to registered machines only after Level 1 exists.
3. **Tier 3 — Cognitive Engineering Fingerprint (`Blueprint`):**
   - Virtual knowledge twin (`gmao_blueprints_v2`) built and enriched inside the application from real maintenance history (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`, `preventivePlanItems`, `commonFailures`).
   - **Never** embedded inside `REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, or `REF_PDR` import rows (`FORBIDDEN_BUNDLE_FIELD`), and **never** owns a physical `Zone` or `Technician`.

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

## 6. Closed Seed Backdoors (Single Seed Gateway)

`src/application/DataGateway.ts` is the **sole** production module permitted to import `src/data/*.json` (enforced by automated unit test).

---

## 7. Code Pointers, Official Templates & Test Suite

| Component | Path | Key Exports / Role |
| :--- | :--- | :--- |
| **Official `REF_PARC` Template** | `templates/import/REF_PARC.template.json` | Canonical Type A template for `ZONES`, `FAMILIES`, `TEMPLATES`, `GENERAL_SYSTEM_TYPES` |
| **Official `REF_PERSONNEL` Template** | `templates/import/REF_PERSONNEL.template.json` | Canonical Type A template for `TECHNICIANS` (`code_technician`) and `OPERATIONS` (`code_operation`) |
| **Official `ASSETS_MACHINES` Template** | `templates/import/ASSETS_MACHINES.template.json` | Canonical Type A template for `PRODUCTION` & `SYSTEM_GENERAL` machines |
| **Official `REF_PDR` Template** | `templates/import/REF_PDR.template.json` | Canonical Type A template for `PDR_GROUPS` (`code_group`), `PDR_TYPES` (`code_type`), `PDR_ITEMS` (`ref`) |
| **Pipeline Types & Contracts** | `src/services/import/types/unifiedImportTypes.ts` | `ImportReport`, `ImportIssue`, `RefParcBundleInput`, `RefPersonnelBundleInput`, `AssetsMachinesBundleInput`, `RefPdrBundleInput` |
| **Core Pipeline Engine** | `src/services/import/unifiedImportPipeline.ts` | `validateAndCommitRefParcBundle`, `validateAndCommitRefPersonnelBundle`, `validateAndCommitAssetsMachinesBundle`, `validateAndCommitRefPdrBundle`, `runUnifiedImportPipeline`, `exportRefParcBundle`, `exportRefPersonnelBundle`, `exportAssetsMachinesBundle`, `exportRefPdrBundle`, `getRefParcOfficialTemplate`, `getRefPersonnelOfficialTemplate`, `getAssetsMachinesOfficialTemplate`, `getRefPdrOfficialTemplate` |
| **PDR Catalog Validator** | `src/services/pdr/pdrExcelValidator.ts` | `validateAndReconcilePdrCatalogImport`, `applyPdrCatalogImportToStore` |
| **Settings UI Integration (`P1.1`..`P3`)** | `src/presentation/pages/settings/components/SettingsInjectionTab.tsx` | Official template download (`Télécharger le modèle`), Dry-Run (`dryRun: true`), `MERGE` import, and Type A Round-Trip export |
| **Unit Test Suite** | `src/tests/unit/UnifiedImportPipeline.test.ts` | Unit tests covering SSOT backdoor isolation, official templates validation, `REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, `REF_PDR`, and round-trip export |

---

## 8. Roadmap — Explicitly Deferred to Subsequent Phases (`P4`)

The following bundles are **not** part of the current `REF_PARC` + `REF_PERSONNEL` + `ASSETS_MACHINES` + `REF_PDR` engine scope and are scheduled next:
1. **`P4` — Operational Bundles (`OPS_PM`, `OPS_CM`, `OPS_MOVEMENTS`) & Unified `DemoBundle`:**
   - Dedicated validation pipelines for Preventive plans, Corrective history, Stock movements, and DemoBundle after Level 1/Level 2 catalogs are locked.
