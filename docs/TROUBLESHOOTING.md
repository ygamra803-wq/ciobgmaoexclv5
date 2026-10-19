# Troubleshooting Guide

## Common Issues & Solutions

1. **Blank White Screen:**
   - Usually caused by circular imports or React render ref access errors. Ensure HMR is disabled in `vite.config.ts` if experiencing WebSocket reload loops.

2. **LocalStorage Quota Exceeded:**
   - Use `MemoryManager.getLocalStorageUsage()` to check usage. Clear old audit logs or export backups as Excel/JSON.

3. **PIN Verification Failure:**
   - Verify that bcrypt hashing is properly initialized and credentials match storage records.
