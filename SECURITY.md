# Security Policy (`CIOB GMAO Nexus`)

## Supported Versions

Only the current minor release line receives active security patches and LAN hardening updates.

| Version / Release Line | Status | Security Support |
| :--- | :--- | :--- |
| **5.0.x (`ciobGMAO-nexusV5.0.2`)** | **Active** | Supported with security fixes |
| **4.2.x** | End of Life | Upgrade to `5.0.2` (`ciobGMAO-nexusV5.0.2`) |
| **4.0.x** | End of Life | Upgrade to `5.0.2` (`ciobGMAO-nexusV5.0.2`) |

---

## Security Architecture Highlights

CIOB GMAO Nexus implements defense-in-depth for Offline-First PWA and LAN Multi-Postes deployments (`server.ts`):

1. **Fail-Closed Authentication & Actor Proof (`SEC-LAN-P0` / `P1` / `P2`):**
   - API access requires a valid `X-GMAO-API-TOKEN` and server-issued signed bearer session (`src/core/security/serverSession.ts`).
   - Unknown or unverified identities automatically downgrade to fail-closed read-only posture; generic/untrusted actor claims are rejected.
   - Durable session revocation across server restarts (`gmao_revoked_sessions.json`) and `/api/gmao/auth/refresh` token rotation.
2. **Read Sanitization Layer (`src/core/security/serverReadPolicy.ts`):**
   - Sensitive fields (`passwordHash`, `defaultPass`, `pin`, `resetToken`, `securityAnswer`) are stripped before returning `users` / `technicians` payloads.
   - `auditEvents` read access is restricted to verified `ADMIN` roles.
3. **RBAC & Entity Allowlist (`serverRbacPolicy.ts`):**
   - Endpoints validate entities against `ALLOWED_ENTITIES` and enforce role-based mutation policies per entity.
4. **Atomic Persistence & Concurrency Control:**
   - Serialized `writeQueue` writes via temporary file `.tmp` + atomic `rename`, protected by optimistic concurrency (`version` / `If-Match` / `HTTP 409 Conflict`).
5. **Production Deployment Requirements:**
   - Always configure explicit `GMAO_API_TOKEN`, `GMAO_SESSION_SECRET`, and restricted CORS origins in production environments. Never deploy with default/empty secrets on untrusted networks.

---

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue:

1. **Do NOT disclose the issue publicly** (no public GitHub Issues, PRs, or forum posts).
2. Report privately via **GitHub Security Advisories** ("Report a vulnerability" in the repository Security tab) or email the maintainers directly at **`security@ciob-gmao.com`**.
3. Include:
   - Affected version / tag (e.g., `ciobGMAO-nexusV5.0.2`)
   - Component / endpoint / file path involved
   - Clear reproduction steps or proof-of-concept payload
   - Potential impact assessment

### Response SLA

- **Acknowledgment:** Within **48 hours**
- **Triage & Severity Assessment:** Within **5 business days**
- **Remediation & Coordinated Advisory:** Target **14–30 days** depending on severity (`Critical` / `High` prioritized immediately)
