# 🏛️ GMAO Nexus — Architecture Status & Engineering Roadmap

> **Document Version:** 2.0.0  
> **Last Audit:** September 2026  
> **Target Environment:** React 19 + Vite 6 + Web Crypto API + PWA (Offline-First)

---

## 1. Security & Cryptography (Zero-Knowledge Vault)

- ✅ **Implemented & Verified:**
  - **Native Web Crypto Engine:** `AES-256-GCM` encryption with PBKDF2 key derivation using dynamic cryptographically secure salt (`vaultService.js`).
  - **No Plaintext Passwords/Backdoors:** Default backdoors (`admin123`/`1234`) removed; default admin accounts stripped from production runtime.
  - **Non-Reversible Master PIN:** PIN verifier hashed via bcrypt/SHA-256; zero plain PIN prefilling in `SettingsView.jsx`.
  - **Fail-Closed RBAC:** Default guest role `VIEWER` when no valid session is present (`PermissionService.js`).
- 🟡 **In Progress:**
  - Session HMAC signing with secret held in memory vault.
  - Absolute session expiration (8h max lifetime, 30m idle lock).
- 🔵 **Planned (P1):**
  - Upgrading PBKDF2 to 600,000 iterations / Argon2id WASM.
  - Strict Content Security Policy (CSP) with nonce-based script loading.

---

## 2. Calculation Engine & Indexing

- ✅ **Implemented & Verified:**
  - **$O(1)$ Incremental Movement Index:** `IncrementalStockIndex.js` with `applyDelta`, `rollbackDelta`, and `updateDelta` for real-time shopfloor operations.
  - **$O(A + M)$ Batch Stock Report Generator:** Single-pass movement aggregation index with direct article stock resolution.
  - **Nullish Coalescing (`??`) Stock Resolution:** Prevents zero balances from falling back onto neighboring padded/unpadded reference variants.
  - **French Number & Locale Normalization:** Safe handling of non-breaking spaces (NBSP) and comma decimal separators in `formulaEngine.js`.
  - **Finite Numeric Guards:** Strict `Number.isFinite(qty) && qty > 0` validation.
- 🟡 **In Progress:**
  - Dependency Graph-based selective cache invalidation across sub-states.
- 🔵 **Planned (P1):**
  - Property-based testing with `fast-check` for comprehensive inventory invariants.

---

## 3. Data Integrity, Storage & PWA

- ✅ **Implemented & Verified:**
  - **Zod v4 Compatibility:** Transitioned to `error.issues` for structured schema error reporting across Stock, Movements, and Machines.
  - **Sanitized Direct File Linking:** File System Access API path passes through schema validation, data sanitization, and date parsing.
  - **Service Worker GET Filtering:** Cache API operations guarded to intercept `GET` requests exclusively.
- 🟡 **In Progress:**
  - Moving hot data writes from `localStorage` to IndexedDB with explicit quota error surfaces.
- 🔵 **Planned (P2):**
  - Cross-tab state synchronization via dedicated `BroadcastChannel API`.
  - Encrypted backup exports (`.gmao` container encrypted with AES-256-GCM).

---

## 4. TypeScript Migration Strategy

- **Boundary-First Rule:** Every new public API or domain service must export TypeScript type definitions (`.d.ts` / `.ts`).
- **Phase 1 (Domain & Schemas):** Type definitions for Stock, Movements, Machines, Interventions, and Auth.
- **Phase 2 (Application & Core):** Conversion of services (`IncrementalStockIndex.ts`, `StockCalculationService.ts`, `vaultService.ts`).
- **Phase 3 (Hooks & Presentation):** Custom hooks converted to TypeScript; UI components maintained in `.jsx` with strict JSDoc/Zod contracts.
