# 🗄️ أرشيف خطة المشاكل والإصلاحات السابقة (Archived Issues & Fixes Plan v4)

> **ملاحظة أرشيفية:** هذا الملف يمثل النسخة المؤرشفة السابقة من خطة تتبع المشاكل والإصلاحات قبل إعادة الهيكلة والتقييم الهندسي الواقعي المعتمد في `/ISSUES_AND_FIXES_PLAN.md`.

---

## السجل المؤرشف (v4 Snapshot)

| Issue | Description | Status | Fix Implemented |
| :--- | :--- | :--- | :--- |
| **Data Persistence** | `localStorage` and `IndexedDB` sync issues causing data loss. | Resolved | Implemented `DataGateway` with `updatedAt` for conflict resolution in `DATA_SSOT.md`. |
| **API Authentication** | `/api/gmao/*` lacked authentication. | Resolved | Added `GMAO_API_TOKEN` environment variable and enforced header check in `server.ts`. |
| **Stock Hydration** | Stock table appearing empty despite seed data. | Resolved | Updated `App.tsx` to use `DataGateway.initRealStock()` for robust hydration and confirmed seed data integrity. |
| **Sync Transparency** | Missing user feedback for server sync operations. | Planned | Add explicit buttons for "Save to Server" / "Restore from Server" with user feedback. |
| **Clear/Reset Conflicts** | Multiple paths to write to entities causing inconsistency. | Planned | Standardize all entity writes through `DataGateway`. |
| **Documentation Integrity** | Misleading completion claims in legacy docs. | Resolved | Removed exaggerated claims and updated to realistic assessment. |
