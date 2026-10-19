# CIOB GMAO Light API Documentation

This document describes the client-side services, local storage engines, and security modules available in the application.

## Core Modules

1. **SecurityService** (`src/utils/securityService.js`)
   - `hashPin(pin)`: Hashes user PIN using bcrypt.
   - `verifyPin(pin, hashed)`: Compares PIN against hash.
   - `encryptData(data)` / `decryptData(ciphertext)`: AES encryption for sensitive client data.

2. **FormulaEngine** (`src/utils/formulaEngine.js`)
   - Computes real-time stock balances (`stockActuel = stockInitial + entrees - sorties`).
   - Validates threshold alerts (`OK`, `ALERTE`, `RUPTURE`).

3. **Validators** (`src/utils/validators.js`)
   - Zod schemas for strict data validation on articles and movements.
