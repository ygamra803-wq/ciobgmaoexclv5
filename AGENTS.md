# 🏛️ AGENTS.md — CIOB GMAO Nexus (v5.0.2) Engineering Constitution & Agent Gateway

> **STOP — READ THIS FIRST (Token & Context Discipline):**
> Do **NOT** crawl `/docs` or read all markdown files automatically. This file is the authoritative gateway. Open secondary files **only** when your specific task requires them.

---

## 1. Core Architectural Truths (Non-Negotiable)

1. **Single Source of Truth (SSOT):**
   - Application state lives in `src/store/useGmaoStore.ts`, persisted exclusively via `src/application/DataGateway.ts` and canonical `STORAGE_KEYS` (`src/infrastructure/persistence/storageKeys.ts`).
   - **Excel is NOT the internal SSOT:** Excel (`excelEngineService.ts` / `excelMirrorService.ts`) is strictly for import, export, and host-side mirror backup.
2. **Zero Silent Seed Reinjection:**
   - Empty collections (`0` records) are valid factory states. Never auto-inject demo seeds when storage is empty or short.
   - Demo data loads **exclusively** via explicit user action (`DataGateway.loadDemoData` / `loadDemoSection`). When `START_MODE === 'empty'`, all counters and tables remain `0` across reloads (`F5`).
3. **Stock Math Invariant:**
   - `stockActuel = stockInitial + entrées − sorties` computed exclusively via `src/application/IncrementalStockIndex.ts` and `src/application/services/StockCalculationService.ts`.
   - Do **not** modify `IncrementalStockIndex` or `StockCalculationService` unless a numeric bug is proven with a failing test case. Never combine direct stock mutation with a `Sortie` movement (prevents double deduction).
4. **3-Tier Asset, Blueprint & BOM Nexus Philosophy (Strict Separation of Concerns):**
   - **Tier 1 (`Family` & `Template`):** Standard industrial classification and technical catalog specifications (`puissance`, `vitesse`, manufacturer model).
   - **Tier 2 (`Machine Registered` — Physical Shopfloor Asset):** The real machine on the shopfloor (`gmao_machines_v2`). It **exclusively owns** its physical location (`id_zone_default` / `Zone`), assigned `technician`, live operating counter (`compteur_actuel` / `meterReadings`), and physically mounted `Components`, `Parts`, and `PDR` (`machineElementsLedger` / `warehouseItems`).
   - **Tier 3 (`Blueprint` — Virtual Cognitive Fingerprint):** A dynamic engineering knowledge twin (`gmao_blueprints_v2`) linked to `Template` / `Machine`. It accumulates learned maintenance knowledge (`components_theoriques`, `parts_theoriques`, `pdr_theoriques`, `preventivePlanItems`, `commonFailures`) across corrective and preventive interventions. **A `Blueprint` is virtual: it NEVER owns a physical `Zone` or `Technician`.**
   - **Operational Line Grouping (`MACHINE | LINE` only):** Optional `parent_id` and `asset_level` (`'MACHINE' | 'LINE'`) on `machines` are strictly for operational line/parent-machine KPI rollup (`src/utils/assetHierarchy.ts`). Never conflate `Zone` (geography) or internal `Components/Parts` (`Entrepôt/Nexus`) with `parent_id`, and never inherit `Zone`, `Family`, or `Blueprint` from a parent line.
5. **Temporal Memory, Explicit Lifecycles & Maker-Checker Governance:**
   - **Preventive Maintenance (Calendar + Meter):** Completing a task records an immutable dated `PreventiveExecution` (`src/application/services/preventive/ExecutionService.ts` → `STORAGE_KEYS.PREVENTIVE_EXECUTIONS`) with `periodMonth (YYYY-MM)` and advances meter thresholds (`MeterService.ts`) when applicable.
   - **Corrective Maintenance:** Work orders enforce guarded transitions via `src/domain/maintenance/WorkOrderStateMachine.ts` (`DEMANDE ➔ EN_COURS / EN_ATTENTE_PDR ➔ CLOTURE`).
   - **Maker-Checker Validation (`VAL-1..VAL-5`):** Field technician executions (`BT`, preventive executions, `sortieDemands`) enter `PENDING_VALIDATION` without deducting `rawStock` until approved by a supervisor/manager (`validationReconciliation.ts`).
6. **Institutional Append-Only Audit Ledger (`AUDIT_EVENTS`):**
   - Critical state mutations (initial stock/price adjustments, machine archive/restore, maker-checker approvals/rejections, replenishment `PO` lifecycle, and financial budget updates) record immutable before/after events via `AuditService.recordEvent` (`STORAGE_KEYS.AUDIT_EVENTS`).
7. **Referential Discipline & Safe Archive:**
   - Dropdowns for new PM tasks, WOs, and movements must use `filterActiveMachines(machines)` (`src/utils/activeMachines.ts`) from registered `machines` — never hardcoded fallback machine lists.
   - Machines or personnel with historical movements/interventions must be soft-archived (`status: 'ARCHIVEE'` / `is_active: false`), never hard-deleted into orphans. Archiving a parent line detaches its children cleanly (`detachChildrenOnParentArchive`).
8. **LAN Host & Security Boundaries (`server.ts`):**
   - Respect `X-GMAO-API-TOKEN` authentication, `ALLOWED_ENTITIES` allowlist, fail-closed RBAC role guards (`AuthorizationService.tsx` / `serverRbacPolicy.ts` / `x-gmao-role`), serialized atomic disk writes (`writeQueue`: `.tmp` → `rename`), and `version` / `409 Conflict` checks.
9. **Minimal Diffs:**
   - Change only what the task requires. No drive-by refactors, no unrequested UI redesigns, no hardcoded secrets.

---

## 2. Targeted Documentation Routing (Read Only When Needed)

| Need | Authoritative File | Rule |
| :--- | :--- | :--- |
| **Implemented Capabilities & Code Pointers** | [`CAPABILITIES_AND_STRENGTHS.md`](./CAPABILITIES_AND_STRENGTHS.md) | Read when verifying existing features, services, or automated test coverage. |
| **Architecture & ADR Decisions** | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Read when reviewing system boundaries, 3-Tier Asset/Blueprint architecture, or ADRs (`ADR-01` to `ADR-10`). |
| **Canonical Storage Keys & FK Schema** | [`docs/DATA_SSOT.md`](./docs/DATA_SSOT.md) | Read when touching persistence, `STORAGE_KEYS`, migrations, or entity relationships. |
| **Documentation Map** | [`DOCS_INDEX.md`](./DOCS_INDEX.md) | Read when looking up the exact documentation file for a specific module or screen. |
| **Specific UI Screen Specs** | `docs/*_VIEW.md` | Open **only** the single `*_VIEW.md` matching the screen you are actively editing. |
