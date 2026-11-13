# Contributing to CIOB GMAO Nexus (`ciobGMAO-nexusV5.0.2`)

First off, thank you for considering contributing to **CIOB GMAO Nexus**. This project adheres to strict industrial reliability, data-integrity, and LAN security standards so that factory maintenance teams can depend on every release.

By participating in this repository, you agree to abide by the [Code of Conduct](./CODE_OF_CONDUCT.md).

---

## 1. Engineering Constitution (Mandatory Reading)

Before writing code, read [`AGENTS.md`](./AGENTS.md). Every pull request must uphold the non-negotiable architectural invariants:

1. **Single Source of Truth (SSOT):** State flows through `src/store/useGmaoStore.ts` (split into modular slices under `src/store/slices/`) and persists exclusively via `src/application/DataGateway.ts` and `STORAGE_KEYS`.
2. **Zero Silent Seed Reinjection:** Empty collections (`0` records) are valid factory states. Never auto-seed demo data when `START_MODE === 'empty'`.
3. **Stock Math Invariant:** `stockActuel = stockInitial + entrées - sorties` is computed exclusively via `IncrementalStockIndex` and `StockCalculationService`. Never mutate stock directly alongside a movement.
4. **3-Tier Asset & Blueprint Separation:** Keep `Family/Template` (Tier 1), `Machine Registered` (Tier 2), and `Blueprint` (Tier 3) strictly decoupled.
5. **Maker-Checker & Audit Ledger:** Field technician actions enter `PENDING_VALIDATION`; critical state mutations must append immutable before/after entries via `AuditService.recordEvent`.
6. **Fail-Closed LAN Security (`server.ts`):** Respect signed server sessions, `X-GMAO-API-TOKEN`, `ALLOWED_ENTITIES`, read sanitization (`serverReadPolicy.ts`), RBAC enforcement (`serverRbacPolicy.ts`), and atomic writes (`writeQueue`).

---

## 2. Development Setup

```bash
# Prerequisites: Node.js >= 20, npm >= 10
npm ci --legacy-peer-deps

# Start local Vite + Express LAN Host (http://localhost:3000)
npm run dev
```

---

## 3. Quality Gates (Required Before Submitting a PR)

All four checks must pass locally and in CI (`.github/workflows/ci.yml` & `ci-cd.yml`):

```bash
npm run typecheck   # Strict TypeScript compilation check
npm run lint        # ESLint static analysis
npm test            # Full Vitest unit & integration test suite
npm run build       # Production Vite bundle verification
```

---

## 4. Branching & Commit Convention

We follow **[Conventional Commits 1.0.0](https://www.conventionalcommits.org/)**:

- `feat(scope): ...` — New industrial capability or UI module (MINOR bump)
- `fix(scope): ...` — Bug fix or edge-case correction (PATCH bump)
- `security(scope): ...` — Hardening, RBAC, session, or sanitization fix
- `refactor(scope): ...` — Internal code structure improvement without behavior change
- `docs(scope): ...` — Documentation updates
- `test(scope): ...` — Adding or updating Vitest / Playwright tests
- `chore(release): ...` — Version bumps, changelog, and release preparation

---

## 5. Versioning & Release Tagging Standard

- **Versioning Scheme:** [Semantic Versioning 2.0.0](https://semver.org/) (`MAJOR.MINOR.PATCH`).
- **Canonical Version SSOT:** `package.json` (`"version": "5.0.2"`) and `src/config/appVersion.ts` (`APP_VERSION` / `APP_RELEASE_TAG`) must always stay synchronized.
- **Official Tag Formats:**
  - Product release tag: `ciobGMAO-nexusV{MAJOR}.{MINOR}.{PATCH}` (e.g., `ciobGMAO-nexusV5.0.2`)
  - Standard SemVer alias tag: `v{MAJOR}.{MINOR}.{PATCH}` (e.g., `v5.0.2`)
- **Automated Releases:** Pushing a tag matching `ciobGMAO-nexusV*` or `v*.*.*` triggers [`.github/workflows/release.yml`](./.github/workflows/release.yml), which validates version consistency, runs the full test/build suite, and publishes a GitHub Release with build archives.
- **Changelog:** Document every user-visible change under `[Unreleased]` in [`CHANGELOG.md`](./CHANGELOG.md) following [Keep a Changelog v1.1.0](https://keepachangelog.com/).

---

## 6. Pull Request Process

1. Fork or branch from `main` using a descriptive branch name (`feat/pm-meter-alerts`, `fix/stock-po-clamping`).
2. Keep PRs focused with minimal diffs — avoid unrelated refactors.
3. Add or update unit/integration tests covering new behavior or bug fixes.
4. Update [`CHANGELOG.md`](./CHANGELOG.md) when introducing user-facing changes.
5. Ensure no secrets, `.env` files, API tokens, or `data/gmao_state.json` runtime artifacts are committed.

---

## 7. Security Vulnerabilities

**Do NOT open public GitHub Issues for security vulnerabilities.**
Follow the private reporting process in [`SECURITY.md`](./SECURITY.md).

---

## 8. Licensing

By contributing to CIOB GMAO Nexus, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
