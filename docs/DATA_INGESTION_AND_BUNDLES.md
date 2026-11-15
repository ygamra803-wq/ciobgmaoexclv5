# 📦 DATA_INGESTION_AND_BUNDLES.md — Layered Data Ingestion & Bundle Contract (`DOC-IMPORT-P0` / `CLOSE-INGEST-P1.1` / `INGEST-P2`)

> **Status:** Authoritative Engineering Contract (v5.0.2)
> **Scope:** Modes `A EMPTY` / `B IMPORT` / `C DEMO`, Export Taxonomy (`Type A Round-Trip` vs `Type B External`), Official Bundle Templates, Closed Seed Backdoors, and `UnifiedImportPipeline` (`REF_PARC`, `REF_PERSONNEL` & `ASSETS_MACHINES`).

---

## 1. Three Operating Modes — Zero Mixing (`A / B / C`)

| Mode | Identifier | Purpose | Persistence & Seed Behavior |
| :--- | :--- | :--- | :--- |
| **Mode A — Empty Factory** | `START_MODE = 'empty'` | Real factory initialization from zero records | `0` records across all tables. Zero silent fallback to `src/data/*.json` on bootstrap or `F5` reload. |
| **Mode B — Structured Import** | `UnifiedImportPipeline` | Real factory onboarding & catalog updates (`JSON_BUNDLE` / `EXCEL`) | Validated dependency order (`ZONES -> FAMILIES -> TEMPLATES -> GENERAL_SYSTEM_TYPES -> PERSONNEL -> MACHINES`), atomic commit via `DataGateway`, and audit trail. |
| **Mode C — Demo Mode** | `START_MODE = 'demo'` | Interactive product demonstration | Triggered **exclusively** by explicit user action via `DataGateway.loadDemoData` / `DataGateway.loadDemoSection`. Fully purgeable via `DataGateway.clearAllForRealFactory`. |

---

## 2. Two Export Contracts — Never Conflate (`Type A` vs `Type B`)

| Export Class | Name | Re-importable via `UnifiedImportPipeline`? | Purpose & Schema |
| :--- | :--- | :--- | :--- |
| **Type A — Bundle Round-Trip** | Official Bundle / Template (`exportRefParcBundle`, `exportRefPersonnelBundle`, `exportAssetsMachinesBundle`, `templates/import/*.template.json`) | **YES** (`dryRun` / `MERGE` / `REPLACE_CATALOG`) | Strict layered ingestion contract using canonical `code_*` keys (`code_zone`, `code_family`, `code_template`, `code_system_type`, `code_technician`, `code_operation`, `code_machine`). |
| **Type B — External Export** | Screen / Reporting Export (`Export externe`) | **NO** — Never feed into `UnifiedImportPipeline` | Human-readable reports, print views, accounting extracts, or third-party CSV/XLSX tables. May contain display columns or omit canonical `code_*` keys. |

### Official Templates = Structural Source of Truth
- Official templates live in:
  - `templates/import/REF_PARC.template.json`
  - `templates/import/REF_PERSONNEL.template.json`
  - `templates/import/ASSETS_MACHINES.template.json`
- **Field Workflow:** Download official template (`Télécharger le modèle`) ➔ Fill rows ➔ Validate (`Vérifier dryRun`) ➔ Commit (`Importer MERGE`).
- **Validation Philosophy:** Because the official template locks the exact structure and column names, `UnifiedImportPipeline` never guesses what kind of file was uploaded — it validates **values, required fields, key uniqueness, and foreign-key referential integrity**.

---

## 3. Three-Level Data Topology (References vs Live Assets vs Cognitive Blueprint)

1. **Level 2 — Reference Catalogs (Must Exist First):**
   - Geographical `ZONES` (`code_zone`), Equipment `FAMILIES` (`code_family`), Manufacturer `TEMPLATES` (`code_template` linked to `code_family`), and Utility `GENERAL_SYSTEM_TYPES` (`code_system_type`) packaged in the **`REF_PARC`** bundle.
   - Field `TECHNICIANS` (`code_technician` linked to `code_zone`) and `OPERATIONS` (`code_operation` linked to `code_zone`) packaged in the **`REF_PERSONNEL`** bundle (`02_PERSONNEL`).
2. **Level 1 — Registered Physical Assets (`Machine Registered`):**
   - Real shopfloor assets (`code_machine`) packaged in the **`ASSETS_MACHINES`** bundle.
   - Each registered machine **exclusively owns** its physical `code_zone`, `asset_class` (`PRODUCTION` vs `SYSTEM_GENERAL`), `code_family` + `code_template` (or `code_system_type`), optional `code_technician`, and optional operational line pointer (`parent_code_machine`, `asset_level: 'MACHINE' | 'LINE'`).
   - Operational records (`preventiveTasks`, `correctiveInterventions`, `mouvements`, `warehouseItems`) attach to registered machines only after Level 1 exists.
3. **Tier 3 — Cognitive Engineering Fingerprint (`Blueprint`):**
   - Virtual knowledge twin (`gmao_blueprints_v2`) built and enriched inside the application from real maintenance history (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`, `preventivePlanItems`, `commonFailures`).
   - **Never** embedded inside `REF_PARC`, `REF_PERSONNEL`, or `ASSETS_MACHINES` import rows (`FORBIDDEN_BUNDLE_FIELD`), and **never** owns a physical `Zone` or `Technician`.

---

## 4. Implemented Bundles (`REF_PARC`, `REF_PERSONNEL` & `ASSETS_MACHINES`)

### 4.1 `REF_PARC` Bundle (Level 2 Reference Layer — `01_ZONES` ➔ `03_FAMILIES` ➔ `03_TEMPLATES` ➔ `03_GENERAL_SYSTEM_TYPES`)
- **Canonical Stable Keys:**
  - `zones[]`: `{ code_zone, libelle, description?, is_active? }`
  - `families[]`: `{ code_family, libelle, description? }`
  - `templates[]`: `{ code_template, code_family, libelle, constructeur?, puissance?, vitesse?, description? }`
  - `generalSystemTypes[]`: `{ code_system_type, libelle, is_active? }`
- **Validation Rules:**
  - Rejects missing required fields (`MISSING_REQUIRED`) and intra-bundle duplicate keys (`DUPLICATE_KEY`).
  - Rejects any template whose `code_family` does not resolve in the bundle or existing store (`BROKEN_FK`).
  - Rejects pseudo-zones (`DIVERS`, `SYSTEM_GENERAL`, `SYSTEME_GENERAL`, `TOUTES`) as physical zones (`SCHEMA_MISMATCH`).
  - Rejects root operational arrays (`machines`, `preventiveTasks`, `mouvements`, `blueprints`, `correctiveInterventions`, `warehouseItems`) with `FORBIDDEN_BUNDLE_FIELD`.

### 4.2 `REF_PERSONNEL` Bundle (Level 2 Personnel & Intervenants Layer — `02_PERSONNEL`)
- **Stage:** `02_PERSONNEL` (requires `ZONES` from `REF_PARC` to be present in live store whenever `code_zone` is specified).
- **Canonical Stable Keys:**
  - `technicians[]`: `{ code_technician, nom, code_zone?, type_profil?, specialite?, is_active? }`
    - `type_profil`: `'TECHNICIEN' | 'RESPONSABLE'` (defaults to `'TECHNICIEN'`)
    - `specialite`: `'ELECTRIQUE' | 'MECANIQUE' | 'HYDRAULIQUE' | 'PNEUMATIQUE' | 'AUTOMATISME' | 'CHAUDRONNERIE_SOUDURE' | 'POLYVALENT' | 'AUTRE'` (defaults to `'POLYVALENT'`)
    - `is_active`: `boolean` (defaults to `true`)
  - `operations[]`: `{ code_operation, nom, code_zone, is_active? }`
- **Strict Isolation from Authentication / Login Accounts (`AuthService`):**
  - `REF_PERSONNEL` exclusively populates operational field personnel (`STORAGE_KEYS.PERSONNEL`, `STORAGE_KEYS.TECHNICIANS`, `STORAGE_KEYS.OPERATIONS` via `DataGateway.savePersonnel`).
  - Any authentication or secret field (`password`, `passwordHash`, `pin`, `token`, `secret`, `apiKey`, `permissions`) is strictly rejected with `FORBIDDEN_BUNDLE_FIELD`. Login accounts (`ADMIN`, `MAGASINIER`, `VIEWER` in `AuthService`) are never modified.

### 4.3 `ASSETS_MACHINES` Bundle (Level 1 Physical Assets Layer — `03_MACHINES`)
- **Stage:** `03_MACHINES` (requires `REF_PARC` references to be present in live store).
- **Canonical Stable Keys:**
  - `machines[]`: `{ code_machine, designation, code_zone, asset_class, code_family?, code_template?, code_system_type?, code_technician?, parent_code_machine?, asset_level?, status?, is_active?, serial_number?, commissioning_date? }`
- **Branch Validation (`asset_class`):**
  - `PRODUCTION`: requires valid `code_family` and valid `code_template` (`MISSING_REQUIRED` / `BROKEN_FK`), and verifies that `code_template` belongs to `code_family` (`TEMPLATE_FAMILY_MISMATCH`).
  - `SYSTEM_GENERAL`: requires valid `code_system_type` in `GENERAL_SYSTEM_TYPES` (`MISSING_REQUIRED` / `BROKEN_FK`) and a real physical `code_zone`.
- **Boundary Protection:**
  - Forbids embedded Blueprint or operational arrays (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`, `preventivePlanItems`, `preventiveTasks`, `mouvements`) inside machine records (`FORBIDDEN_BUNDLE_FIELD`).

---

## 5. Mandatory Edge Cases Enforced in the Engine

1. **Zone Normalization & Legacy Compatibility (`LEGACY_ZONE_NORMALIZED`):**
   - On `ZONES` import, `code_zone` is normalized to canonical `trim + uppercase` (e.g. `' detourag ' ➔ 'DETOURAG'`).
   - When resolving `code_zone` in `REF_PERSONNEL` or `ASSETS_MACHINES`:
     1. Matches canonical `code_zone` first.
     2. Fallback only: matches legacy `id_zone` or `libelle` (including NFD accent folding, e.g. `"Détourage"` ➔ `"DETOURAG"`), writes canonical `code_zone` (`"DETOURAG"`), and records a non-blocking `LEGACY_ZONE_NORMALIZED` warning in `report.warnings`.
2. **Two-Pass `parent_code_machine` Resolution & `sanitizeMachinesHierarchy`:**
   - Resolves `parent_code_machine` in a second pass after indexing all bundle rows + live store machines (allowing child rows to appear before parent rows in the same file).
   - Rejects missing parent machines (`BROKEN_FK`) and self/multi-hop cycles (`CIRCULAR_HIERARCHY`), then passes the final collection through `sanitizeMachinesHierarchy`.
   - **Zero Property Inheritance:** Child machines never inherit `code_zone`, `code_family`, `code_template`, or `id_blueprint` from their parent line.
3. **`REPLACE_CATALOG` Guard (`REFERENCED_BY_ACTIVE_RECORDS`):**
   - Restricted to `ADMIN` role (`RBAC_DENIED` otherwise).
   - Before replacing `ZONES`, `FAMILIES`, `TEMPLATES`, `GENERAL_SYSTEM_TYPES`, `PERSONNEL`, or `MACHINES`, checks all active references (`preventiveTasks`, `correctiveInterventions`, `mouvements`, `warehouseItems`, `machines`, `technicians`).
   - If any removed key is still referenced, blocks commit and returns `REFERENCED_BY_ACTIVE_RECORDS` with `referencedCount` and `referenceBreakdown`.

---

## 6. Closed Seed Backdoors (Single Seed Gateway)

`src/application/DataGateway.ts` is the **sole** production module permitted to import `src/data/*.json` (enforced by automated unit test):

- `src/store/slices/storeBootstrapSlice.ts`: Removed 25 direct `src/data/*.json` imports; all operational and catalog slices use `allowDemoFallback: false` with empty defaults (`[]` / `{}`).
- `src/utils/baselineStock.ts` & `src/services/reactiveCalculationEngine.ts`: Removed `seedStockItems.json` import and eliminated silent `INITIAL_STOCK_LOOKUP` fallback so imported items without `stockInitial` default strictly to `0`.
- `src/presentation/pages/settings/SettingsView.tsx`, `TaskService.ts`, `SortieExterneService.ts`, `baselineCorrective.ts`: Removed all direct seed imports; demo/reset actions route exclusively through `DataGateway`.
- Deleted duplicate `src/data/machines/seedZones.json` in favor of canonical `src/data/zones/seedZones.json`.
- Relocated `responsableTemplates.ts` from `src/data/` to `src/domain/users/responsableTemplates.ts`.

---

## 7. Code Pointers, Official Templates & Test Suite

| Component | Path | Key Exports / Role |
| :--- | :--- | :--- |
| **Official `REF_PARC` Template** | `templates/import/REF_PARC.template.json` | Canonical Type A template for `ZONES`, `FAMILIES`, `TEMPLATES`, `GENERAL_SYSTEM_TYPES` |
| **Official `REF_PERSONNEL` Template** | `templates/import/REF_PERSONNEL.template.json` | Canonical Type A template for `TECHNICIANS` (`code_technician`) and `OPERATIONS` (`code_operation`) |
| **Official `ASSETS_MACHINES` Template** | `templates/import/ASSETS_MACHINES.template.json` | Canonical Type A template for `PRODUCTION` & `SYSTEM_GENERAL` machines |
| **Pipeline Types & Contracts** | `src/services/import/types/unifiedImportTypes.ts` | `ImportReport`, `ImportIssue`, `RefParcBundleInput`, `RefPersonnelBundleInput`, `AssetsMachinesBundleInput` |
| **Core Pipeline Engine** | `src/services/import/unifiedImportPipeline.ts` | `validateAndCommitRefParcBundle`, `validateAndCommitRefPersonnelBundle`, `validateAndCommitAssetsMachinesBundle`, `runUnifiedImportPipeline`, `exportRefParcBundle`, `exportRefPersonnelBundle`, `exportAssetsMachinesBundle`, `getRefParcOfficialTemplate`, `getRefPersonnelOfficialTemplate`, `getAssetsMachinesOfficialTemplate` |
| **Settings UI Integration (`P1.1` / `P2`)** | `src/presentation/pages/settings/components/SettingsInjectionTab.tsx` | Official template download (`Télécharger le modèle`), Dry-Run (`dryRun: true`), `MERGE` import, and Type A Round-Trip export |
| **Hierarchy Sanitizer** | `src/utils/assetHierarchy.ts` | `sanitizeMachinesHierarchy`, `wouldCreateHierarchyCycle` |
| **Unit Test Suite** | `src/tests/unit/UnifiedImportPipeline.test.ts` | Unit tests covering SSOT backdoor isolation, official templates validation, `REF_PARC`, `REF_PERSONNEL`, `ASSETS_MACHINES`, `LEGACY_ZONE_NORMALIZED`, `CIRCULAR_HIERARCHY`, `REPLACE_CATALOG`, and round-trip export |

---

## 8. Roadmap — Explicitly Deferred to Subsequent Phases (`P3..P4`)

The following bundles are **not** part of the current `REF_PARC` + `REF_PERSONNEL` + `ASSETS_MACHINES` engine scope and are scheduled next:
1. **`P3` — `REF_PDR` Wrapper (`04_PDR`):**
   - Wrapping `pdrExcelValidator` inside `UnifiedImportPipeline` with an official `REF_PDR.template.json` contract.
2. **`P4` — Operational Bundles (`OPS_PM`, `OPS_CM`, `OPS_MOVEMENTS`) & Unified `DemoBundle`:**
   - Dedicated validation pipelines for Preventive plans, Corrective history, Stock movements, and DemoBundle after Level 1/Level 2 catalogs are locked.
