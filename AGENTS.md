# 🏛️ AGENTS.md — CIOB GMAO v4 Engineering Constitution & Agent Gateway

> **STOP — READ THIS FIRST (Token & Context Discipline):**
> Do **NOT** crawl `/docs` or read legacy manuals automatically. This file is the authoritative gateway. Open secondary files **only** when your specific task requires them.

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
4. **Temporal Memory & Explicit Lifecycles:**
   - **Preventive Maintenance:** Completing a task records an immutable dated `PreventiveExecution` (`src/application/services/preventive/ExecutionService.ts` → `STORAGE_KEYS.PREVENTIVE_EXECUTIONS`) with `periodMonth (YYYY-MM)`, rather than merely flipping a status flag.
   - **Corrective Maintenance:** Work orders enforce guarded transitions via `src/domain/maintenance/WorkOrderStateMachine.ts` (`DEMANDE ➔ EN_COURS / EN_ATTENTE_PDR ➔ CLOTURE`).
5. **Referential Discipline & Safe Archive:**
   - Dropdowns for new PM tasks, WOs, and movements must use `filterActiveMachines(machines)` (`src/utils/activeMachines.ts`) from registered `machines` — never hardcoded fallback machine lists.
   - Machines or personnel with historical movements/interventions must be soft-archived (`status: 'ARCHIVEE'` / `is_active: false`), never hard-deleted into orphans.
6. **LAN Host & Security Boundaries (`server.ts`):**
   - Respect `X-GMAO-API-TOKEN` authentication, `ALLOWED_ENTITIES` allowlist, RBAC role guards (`AuthorizationService.tsx` / `x-gmao-role`), serialized atomic disk writes (`writeQueue`: `.tmp` → `rename`), and `version` / `409 Conflict` checks.
7. **Minimal Diffs:**
   - Change only what the task requires. No drive-by refactors, no unrequested UI redesigns, no hardcoded secrets.

---

## 2. Targeted Documentation Routing (Read Only When Needed)

| Need | Authoritative File | Rule |
| :--- | :--- | :--- |
| **Implemented Capabilities & Code Pointers** | [`CAPABILITIES_AND_STRENGTHS.md`](./CAPABILITIES_AND_STRENGTHS.md) | Read when verifying existing features, services, or test coverage. |
| **Architecture & ADR Decisions** | [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Read when reviewing system boundaries, ADRs (`ADR-01` to `ADR-08`), or executive overview. |
| **Canonical Storage Keys & FK Schema** | [`docs/DATA_SSOT.md`](./docs/DATA_SSOT.md) | Read when touching persistence, `STORAGE_KEYS`, migrations, or entity relationships. |
| **Specific UI Screen Specs** | `docs/*_VIEW.md` | Open **only** the single `*_VIEW.md` matching the screen you are actively editing. |
| **Historical Issues & Roadmap** | `docs/history/*`, `ROADMAP_AND_PHASES_PLAN.md` | **Do NOT open automatically.** Consult only if explicitly asked about project history or roadmap phases. |
