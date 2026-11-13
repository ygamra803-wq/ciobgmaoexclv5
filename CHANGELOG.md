# Changelog

All notable changes to **CIOB GMAO Nexus** are documented in this file.

The format is based on [Keep a Changelog v1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).

Official Git release tag convention: `ciobGMAO-nexusV{MAJOR}.{MINOR}.{PATCH}` (with standard SemVer alias `v{MAJOR}.{MINOR}.{PATCH}`).

---

## [Unreleased]

---

## [5.0.2] — `ciobGMAO-nexusV5.0.2` (2026-11-12)

### Security
- **SEC-LAN-P0 (Fail-Closed RBAC & Trust Boundary):** Removed untrusted claimed-role elevation on `server.ts`; unknown or unauthenticated identities default to fail-closed read-only posture, enforced CORS origin allowlist, and gated `/api/network/info` & `/api/docs` behind `authenticateApi`.
- **SEC-LAN-P1 (Server-Issued Actor Proof):** Enforced signed session verification (`src/core/security/serverSession.ts`) to prevent registered `actorId` spoofing on the LAN and aligned built-in client login identities with `dbState.users`.
- **SEC-LAN-P2 (Session Lifecycle Hardening):** Added durable restart-safe session revocation (`gmao_revoked_sessions.json` with expired entry pruning), token rotation via `POST /api/gmao/auth/refresh`, and explicit production session secrets.
- **Read Sanitization Layer:** Added `src/core/security/serverReadPolicy.ts` to strip `passwordHash`, `defaultPass`, `pin`, `resetToken`, and `securityAnswer` from `users` / `technicians` responses and full state snapshots, and restricted `auditEvents` reads to verified `ADMIN` roles.

### Architecture & Refactoring
- **Modular Zustand Store Slices:** Decomposed monolithic `useGmaoStore.ts` into clean domain slices under `src/store/slices/`:
  - `stockSlice.ts` (Inventory, PDR movements, Sortie Demands Maker-Checker, Replenishment PO lifecycle)
  - `assetNexusSlice.ts` (3-Tier Asset topology, `SYSTEM_GENERAL` assets, BOM Nexus ledger, Entrepôt, Personnel)
  - `preventiveSlice.ts` (Calendar + Meter PM tasks/executions, Maker-Checker validation, External Sorties)
  - `correctiveSlice.ts` (DI/BT WorkOrder FSM, Workshop Orders `BR/RECT`, NeedRequests, MTTR/MTBF/Pareto selectors)
- **Unified Versioning (`5.0.2` / `ciobGMAO-nexusV5.0.2`):** Created `src/config/appVersion.ts` as version SSOT and synchronized `package.json` (`ciobgmao-nexus`), `package-lock.json`, OpenAPI spec (`swaggerConfig.ts`), Service Worker cache keys (`public/service-worker.js`), `AutoBackupService`, Excel report titles, modals, and documentation.

### Governance & Legal
- Added international-standard repository files: `LICENSE` (MIT), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), `CHANGELOG.md`, and automated tag-release workflow `.github/workflows/release.yml`.

---

## [4.2.0] — `v4.2.0`

### Added
- 3-Tier Asset & Cognitive Blueprint architecture (`Family/Template` ➔ `Machine Registered` ➔ `Blueprint`) with optional `MACHINE | LINE` KPI rollup.
- Corrective Atelier Fabrication (`IWorkshopOrder`: `BR / RECT`) and Need Request (`NeedRequest`) handoff with WorkOrder closure guards.
- Maker-Checker Validation Center (`VAL-1..VAL-5`), Smart Replenishment PO Engine, Meter-based Preventive Maintenance (`MeterService`), and Append-Only Audit Ledger (`AUDIT_EVENTS`).
- Machine Passport 360° with Health Score, TCO, BER alerts, and offline QR field labels.

---

## [4.0.0] — `v4.0.0`

### Added
- Initial CIOB GMAO Enterprise platform release: Offline-First PWA, Excel Twin Engine (`SUMIFS`, `COUNTIF`, HyperFormula), Single Source of Truth (`DataGateway`), Incremental O(1) Stock Index, OpenAPI 3.0 specification, and LAN Multi-Postes atomic sync server (`server.ts`).
