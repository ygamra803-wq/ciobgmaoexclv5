# CIOB GMAO Nexus — Single-File SQLite Storage & Windows Local/LAN Deployment Guide

## 1. Architecture Summary (Designed for 1–4 PCs + 4–5 Phones on Local Wi-Fi)

CIOB GMAO Nexus operates **100% locally without any external cloud server**:

- **Storage Engine:** Single-file ACID **SQLite** database (`ciob_gmao.db`) powered by Node.js 22 built-in `node:sqlite` (`DatabaseSync` — zero native C++ `node-gyp` build dependencies).
- **Schema:**
  - `gmao_meta`: schema version (`schema_version`), optimistic concurrency revision (`state_version`), `updated_at`, migration timestamp.
  - `gmao_entities`: all 44 allowlisted GMAO collections/dictionaries stored as transactional rows with dirty-slice diffing (modifying 1 machine or 1 stock movement updates only 1 row inside a single `BEGIN IMMEDIATE ... COMMIT` transaction).
  - `gmao_audit_log`: indexed append-only audit trail (`idx_gmao_audit_version_seq`) replacing linear JSONL file scans.
- **Automatic Legacy Migration:** On first startup against an existing `data/` folder containing `gmao_state.json` (and optional `gmao_audit.jsonl`), the server automatically migrates all data and audit history into `ciob_gmao.db` in one ACID transaction while leaving `gmao_state.json` intact as a read-only fallback.

---

## 2. Deployment Topologies on Windows

### Mode A — Single Windows PC (Multi-Role)
1. Double-click `scripts\windows\CIOB-GMAO-Start.bat` (or run `node scripts/windows/start-gmao-host.mjs`).
2. The launcher creates `%LOCALAPPDATA%\CIOB-GMAO\ciob_gmao.db` (or uses `--db-file "D:\UsineData\ciob_gmao.db"`), auto-provisions strong local host secrets in `%LOCALAPPDATA%\CIOB-GMAO\host-secrets.json`, starts the production server on port `3000`, and opens the app in a dedicated desktop window (`msedge --app=http://localhost:3000`).
3. Multiple roles (`ADMIN`, `RESPONSABLE`, `MAGASINIER`, `TECHNICIEN`, `VIEWER`) sign in/out cleanly on the same PC with full server-side RBAC and audit trail.

### Mode B — 2 to 4 PCs + 4 to 5 Mobile Phones on Company Wi-Fi LAN
1. Designate **1 PC as the Host PC** running `CIOB-GMAO-Start.bat` with `ciob_gmao.db` on its local SSD/NTFS drive (fastest and safest `WAL` mode).
2. Allow inbound TCP port `3000` on the Host PC's Windows Firewall (Private/Company Wi-Fi profile only).
3. On the other 1–3 PCs, open `http://<HOST_LAN_IP>:3000` (displayed in the Host console on startup).
4. On the 4–5 mobile phones (consultation / field viewing), open `http://<HOST_LAN_IP>:3000/#mobile`.
5. All connected devices receive live SSE state synchronization, version conflict detection (`409 Conflict`), and server-side stock protection (`STOCK_NEGATIVE_PREVENTED`).

### Important Engineering Rule About Windows Shared Folders (`\\SERVER\Share\ciob_gmao.db`)
- **Recommended:** Store `ciob_gmao.db` on the Host PC's **local NTFS drive** and let other PCs connect over HTTP Wi-Fi LAN (`http://192.168.x.x:3000`).
- **If pointing `--db-file` directly to a UNC network share (`\\NAS\GMAO\ciob_gmao.db`):** The server automatically detects UNC paths (`\\...`) and switches SQLite from `WAL` to `journal_mode=DELETE` + `synchronous=FULL` to avoid SMB shared-memory corruption. Even then, **never run two independent server processes simultaneously against the same SMB `.db` file**; keep one active host and copy hot backups to the NAS/USB share.

---

## 3. Consistent Online Hot Backups & Restore

- **Diagnostics Endpoint (Admin / Responsable Maintenance only):** `GET /api/gmao/db/info` returns the active `.db` path, journal mode, database size, WAL size, entity count, audit count, and retained backups count.
- **Online Hot Backup Endpoint (Admin / Responsable Maintenance only):** `POST /api/gmao/db/backup` executes SQLite `VACUUM INTO` inside the serialized write queue to generate a clean, atomic, standalone snapshot in `<dataDir>/backups/ciob_gmao_<timestamp>_v<version>.db` (automatic retention keeps the latest `GMAO_BACKUP_RETENTION=10` snapshots).
- **Restore Procedure:**
  1. Stop the CIOB GMAO Host process (`Ctrl+C` or close the Host window so WAL checkpoints cleanly).
  2. Copy the chosen snapshot from `backups\ciob_gmao_*.db` over `ciob_gmao.db` (and delete any stale `ciob_gmao.db-wal` / `ciob_gmao.db-shm` files).
  3. Restart `CIOB-GMAO-Start.bat`.

---

## 4. Packaging as a Standalone Native Windows Executable (Next Step)

Because the entire backend + SQLite engine now uses zero native C++ addons (`node:sqlite`), packaging into a signed `.exe` installer requires only a thin desktop shell:
- **Electron wrapper (~50 lines `main.js`):** imports `startServer()` from `server.ts` (compiled via `esbuild`/`tsx`), passes `dataDir: app.getPath('userData')`, and loads `http://127.0.0.1:3000` inside a `BrowserWindow` with a system-tray icon (`Minimise to Tray` so LAN PCs/phones remain connected).
