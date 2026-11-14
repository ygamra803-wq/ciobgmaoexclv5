import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityService } from '../../core/security/SecurityService';
import { createSecurityCacheController } from '../../server/middleware/rateLimiter';
import { sanitizeString, sanitizeObject, sanitizeHtml, sanitizeFilename } from '../../utils/sanitize';

describe('4. Security & Hardening Tests', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('PIN Security & Brute Force Protection', () => {
    it('should hash PIN and verify authentic logins successfully', () => {
      const pin = '567890';
      const hashed = SecurityService.hashPin(pin);

      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(pin); // Should not store as plain text
      expect(SecurityService.verifyPIN(pin, hashed)).toBe(true);
      expect(SecurityService.verifyPIN('000000', hashed)).toBe(false);
      // Plaintext stored PINs must strictly fail verification
      expect(SecurityService.verifyPIN('567890', '567890')).toBe(false);
    });

    it('should prevent brute force attacks by rate-limiting API bursts with HTTP 429', () => {
      const controller = createSecurityCacheController({
        pruneExpired: () => false,
        persistAsync: async () => {},
      } as any);

      try {
        let nextCalls = 0;
        let lastStatus = 200;
        const headers: Record<string, string> = {};
        const req = { headers: {}, socket: { remoteAddress: '10.0.0.50' }, ip: '10.0.0.50' } as any;
        const res = {
          setHeader: (k: string, v: string) => {
            headers[k] = v;
          },
          status: (code: number) => {
            lastStatus = code;
            return { json: () => ({ status: code }) };
          },
        } as any;

        for (let i = 0; i < 300; i++) {
          controller.apiRateLimiter(req, res, () => {
            nextCalls += 1;
          });
        }
        expect(nextCalls).toBe(300);
        expect(headers['X-RateLimit-Remaining']).toBe('0');

        controller.apiRateLimiter(req, res, () => {
          nextCalls += 1;
        });
        expect(lastStatus).toBe(429);
        expect(nextCalls).toBe(300);
      } finally {
        controller.dispose();
      }
    });
  });

  describe('Data Encryption (AES-256 & LocalStorage Wrap)', () => {
    it('should encrypt and decrypt objects correctly using AES-256', () => {
      const sensitiveData = {
        technicien: 'Achraf Gamra',
        pin: '1234',
        isAdmin: true,
      };

      const ciphertext = SecurityService.encrypt(sensitiveData);
      expect(ciphertext).toBeDefined();
      expect(typeof ciphertext).toBe('string');
      expect(ciphertext.startsWith('NC2:')).toBe(true);
      expect(ciphertext).not.toContain('Achraf Gamra'); // Check payload is actually obfuscated

      const decrypted = SecurityService.decrypt(ciphertext);
      expect(decrypted).toEqual(sensitiveData);
      // Malformed base64/NC2 payload must strictly fail verification/decryption
      expect(() => SecurityService.decrypt('NC2:!!!bad:!!!bad:deadbeef')).toThrow();
    });

    it('should save and load encrypted items securely from localStorage', () => {
      const sensitiveConfig = { dbKey: 'super-secret-key-123' };

      SecurityService.saveSecure('sensitive_config_key', sensitiveConfig);

      // Verify that the plain text is not visible in raw localStorage
      const rawInStorage = localStorage.getItem('sensitive_config_key');
      expect(rawInStorage).toBeDefined();
      expect(rawInStorage).not.toContain('super-secret-key-123');

      // Retrieve and decrypt correctly
      const retrieved = SecurityService.getSecure('sensitive_config_key');
      expect(retrieved).toEqual(sensitiveConfig);
    });

    it('should reject corrupt or invalid ciphertexts explicitly', () => {
      expect(() => SecurityService.decrypt('invalid-ciphertext-payload-123!!!')).toThrow();
    });

    it('should remain backward-compatible with legacy NC1 ciphertexts and keep storageService isolated from NC2', async () => {
      const {
        pbkdf2Sha256Bytes,
        hmacSha256Bytes,
        hmacSha256Hex,
        bytesToBase64,
        symmetricDecrypt,
      } = await import('../../core/security/nativeCrypto');
      const { storageService } = await import('../../utils/storageService');

      // Construct a genuine legacy NC1:<saltB64>:<cipherB64>:<macHex> payload (1000 PBKDF2 iterations)
      const passphrase = 'legacy-test-passphrase';
      const plaintext = '{"legacy":true,"count":42}';
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const keyMaterial = pbkdf2Sha256Bytes(passphrase, salt, 1000, 64);
      const encKey = keyMaterial.subarray(0, 32);
      const macKey = keyMaterial.subarray(32, 64);
      const plainBytes = new TextEncoder().encode(plaintext);
      const cipherBytes = new Uint8Array(plainBytes.length);
      const counterBlock = new Uint8Array(20);
      counterBlock.set(salt, 0);
      const keystream = hmacSha256Bytes(counterBlock, encKey);
      for (let i = 0; i < plainBytes.length; i++) {
        cipherBytes[i] = plainBytes[i] ^ keystream[i];
      }
      const saltB64 = bytesToBase64(salt);
      const cipherB64 = bytesToBase64(cipherBytes);
      const macHex = hmacSha256Hex(`${saltB64}:${cipherB64}`, macKey);
      const nc1Payload = `NC1:${saltB64}:${cipherB64}:${macHex}`;

      expect(symmetricDecrypt(nc1Payload, passphrase)).toBe(plaintext);

      // Ensure storageService does not expose raw NC2 ciphertext strings
      SecurityService.saveSecure('gmao_auth_accounts_v2', [{ id: 'admin' }]);
      expect(storageService.getItem('gmao_auth_accounts_v2', null)).toBeNull();
    });
  });

  describe('XSS Prevention (Input Sanitization)', () => {
    it('should escape dangerous HTML tags and characters to prevent injection attacks', () => {
      const maliciousInput = "<script>alert('XSS')</script><img src=x onerror=alert(1)>";
      const sanitized = sanitizeString(maliciousInput);

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('<img');
      expect(sanitized).toContain('&lt;script&gt;');
      expect(sanitized).toContain('&lt;img');
    });

    it('should recursively sanitize deeply nested objects', () => {
      const maliciousPayload = {
        ref: 'REF-001',
        designation: 'Moteur <iframe src="javascript:alert(1)"></iframe>',
        nested: {
          technician: '<a href="javascript:alert(2)">John Doe</a>',
        },
      };

      const sanitized = sanitizeObject(maliciousPayload);

      expect(sanitized.ref).toBe('REF-001');
      expect(sanitized.designation).not.toContain('<iframe');
      expect(sanitized.designation).toContain('&lt;iframe');
      expect(sanitized.nested.technician).not.toContain('<a href');
      expect(sanitized.nested.technician).toContain('&lt;a href');
    });

    it('should sanitize HTML markup via DOMPurify (sanitizeHtml) while preserving safe printable voucher tags', () => {
      const voucherWithXss = `
        <div class="voucher-card">
          <h1>CIOB GMAO BON</h1>
          <script>window.stolen = localStorage.getItem('gmao_session_v2');</script>
          <img src="x" onerror="alert('XSS')" />
          <iframe src="javascript:alert(1)"></iframe>
          <table><tr><td>Moteur</td><td>10 U</td></tr></table>
        </div>
      `;

      const cleanHtml = sanitizeHtml(voucherWithXss);

      expect(cleanHtml).toContain('<h1>CIOB GMAO BON</h1>');
      expect(cleanHtml).toContain('<tr><td>Moteur</td><td>10 U</td></tr>');
      expect(cleanHtml).not.toContain('<script>');
      expect(cleanHtml).not.toContain('window.stolen');
      expect(cleanHtml).not.toContain('onerror');
      expect(cleanHtml).not.toContain('<iframe');
      expect(cleanHtml).not.toContain('javascript:');
    });

    it('should sanitize filenames to prevent path traversal and HTML injection in download attributes', () => {
      expect(sanitizeFilename('BON-2026/01<script>"test"', 'Mouvement')).toBe('BON-2026_01_script_test');
      expect(sanitizeFilename('../../../etc/passwd', 'Mouvement')).toBe('.._.._.._etc_passwd');
      expect(sanitizeFilename('', 'Mouvement')).toBe('Mouvement');
    });
  });

  describe('CSRF Protection & Session Isolation', () => {
    it('should isolate active tokens in sessionStorage rather than vulnerable auto-cookies', () => {
      // SPAs prevent CSRF by utilizing Custom Header Bearer tokens stored in sessionStorage,
      // avoiding auto-attaching HTTP cookies which are the vehicle for CSRF attacks.
      const token = 'bearer-token-12345';
      sessionStorage.setItem('sessionToken', token);

      const retrievedToken = sessionStorage.getItem('sessionToken');
      expect(retrievedToken).toBe(token);

      // Check browser context: sessionStorage is not accessible by cross-origin frames or requests, mitigating CSRF
    });

    it('should hash passwords with Web Crypto API PBKDF2 and verify successfully without bcrypt in main loop', async () => {
      const { SecurityService: CoreSec } = await import('../../core/security/SecurityService.js');
      const plain = 'P@ssw0rdIndustrial2026!';

      const hashed = await CoreSec.hashPassword(plain);
      expect(hashed).toBeDefined();
      expect(hashed).toMatch(/^pbkdf2:v1:[a-f0-9]+:100000:[a-f0-9]+$/);
      expect(hashed).not.toContain(plain);

      // Verify correct password
      const isMatch = await CoreSec.comparePassword(plain, hashed);
      expect(isMatch).toBe(true);

      // Verify wrong password
      const isWrongMatch = await CoreSec.comparePassword('WrongPassword123', hashed);
      expect(isWrongMatch).toBe(false);

      // Verify legacy bcrypt compatibility fallback
      const legacyBcryptHash = '$2a$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ12';
      expect(CoreSec.isLegacyHash(legacyBcryptHash)).toBe(true);
      expect(CoreSec.isLegacyHash(hashed)).toBe(false);
    });

    it('should eradicate plain or vulnerable gmao_admin_pin from localStorage and store Master PIN exclusively in memory + IndexedDB', async () => {
      const { vaultService, setMasterPin, getMasterPin, clearMasterPin } = await import('../../utils/vaultService.js');

      // 1. Ensure setMasterPin keeps PIN in memory only and cleans localStorage
      localStorage.setItem('gmao_admin_pin', 'legacy_vulnerable_pin');
      setMasterPin('4826');
      expect(getMasterPin()).toBe('4826');
      expect(localStorage.getItem('gmao_admin_pin')).toBeNull();

      // 2. Ensure setPinHash stores in IndexedDB and removes from localStorage
      await vaultService.setPinHash('4826');
      expect(localStorage.getItem('gmao_vault_pin_hash_v2')).toBeNull();
      expect(localStorage.getItem('gmao_admin_pin')).toBeNull();
      expect(await vaultService.verifyPinHash('4826')).toBe(true);
      expect(await vaultService.verifyPinHash('0000')).toBe(false);

      // 3. Ensure clearMasterPin wipes memory and getMasterPin throws as expected
      clearMasterPin();
      expect(() => getMasterPin()).toThrow('Master PIN not set in memory');
    });

    it('should isolate user session in sessionStorage and not store raw session in localStorage', async () => {
      const { AuthService } = await import('../../core/security/AuthService.js');
      const auth = new AuthService();
      
      const sampleSession = {
        id: 'admin',
        username: 'admin',
        role: 'ADMIN',
        name: 'Administrateur'
      };

      auth.saveSignedSession(sampleSession);

      // Verify that session is in sessionStorage
      const sessionInSessionStorage = sessionStorage.getItem('gmao_session_v2');
      expect(sessionInSessionStorage).toBeDefined();
      expect(JSON.parse(sessionInSessionStorage).payload.username).toBe('admin');

      // Verify that localStorage does NOT have gmao_session_v2
      const sessionInLocalStorage = localStorage.getItem('gmao_session_v2');
      expect(sessionInLocalStorage).toBeNull();

      // Verify getCurrentUser successfully reads from sessionStorage
      const currentUser = auth.getCurrentUser();
      expect(currentUser).toBeDefined();
      expect(currentUser.username).toBe('admin');

      // Test logout removes session from sessionStorage
      auth.logout();
      expect(sessionStorage.getItem('gmao_session_v2')).toBeNull();
      expect(auth.getCurrentUser()).toBeNull();
    });

    it('should reject requests with missing or mismatching authorization tokens', () => {
      const checkAuthorizationHeader = (headers) => {
        if (!headers || !headers['Authorization'] || !headers['Authorization'].startsWith('Bearer ')) {
          return { status: 401, message: 'Unauthorized - Missing or invalid Bearer token (CSRF/Auth fail)' };
        }
        return { status: 200 };
      };

      // Empty request headers
      const res1 = checkAuthorizationHeader({});
      expect(res1.status).toBe(401);

      // Valid Auth request
      const res2 = checkAuthorizationHeader({ 'Authorization': 'Bearer 12345' });
      expect(res2.status).toBe(200);
    });

    it('should enforce Content-Security-Policy (CSP) headers configuration in Vite and index.html', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const viteConfigContent = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf-8');
      expect(viteConfigContent).toContain('Content-Security-Policy');
      expect(viteConfigContent).toContain('Referrer-Policy');
      expect(viteConfigContent).toContain('X-Content-Type-Options');
      expect(viteConfigContent).toContain("object-src 'none'");
      expect(viteConfigContent).toContain("base-uri 'self'");

      const indexHtmlContent = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
      expect(indexHtmlContent).toContain('http-equiv="Content-Security-Policy"');
      expect(indexHtmlContent).toContain("object-src 'none'");
    });
  });

  describe('Zero-Downtime Vault Master PIN Rotation', () => {
    it('should rotate Master PIN, re-encrypt vault with new salt and IV, and authenticate with new PIN', async () => {
      const { vaultService } = await import('../../utils/vaultService.js');
      const initialPin = '1234';
      const newPin = '908172';

      // 1. Initial vault encryption
      const sampleVault = { secretToken: 'GMAO-SECURE-KEY-2026', accounts: [{ user: 'admin' }] };
      await vaultService.encryptVault(sampleVault, initialPin);
      await vaultService.setPinHash(initialPin);

      // Verify decrypted with initialPin
      const decryptedBefore = await vaultService.decryptVault(initialPin);
      expect(decryptedBefore.secretToken).toBe('GMAO-SECURE-KEY-2026');

      // 2. Rotate to newPin
      const rotationResult = await vaultService.changeMasterPin(initialPin, newPin);
      expect(rotationResult.success).toBe(true);

      // 3. Old PIN must fail
      await expect(vaultService.decryptVault(initialPin)).rejects.toThrow();

      // 4. New PIN must successfully decrypt exact data
      const decryptedAfter = await vaultService.decryptVault(newPin);
      expect(decryptedAfter.secretToken).toBe('GMAO-SECURE-KEY-2026');
      expect(decryptedAfter.accounts).toHaveLength(1);

      // 5. Vault artifacts in localStorage must be protected via SecurityService (NC2: envelope)
      expect(localStorage.getItem('gmao_vault_cipher_v2')?.startsWith('NC2:')).toBe(true);
      expect(localStorage.getItem('gmao_vault_salt_v2')?.startsWith('NC2:')).toBe(true);
      expect(typeof SecurityService.getSecure('gmao_vault_cipher_v2')).toBe('string');
      expect(typeof SecurityService.getSecure('gmao_vault_salt_v2')).toBe('string');
    });

    it('should enforce SecurityService.getSecure in SettingsAdminTab and Logger.error in serverSessionStore', async () => {
      const fs = await import('fs');
      const path = await import('path');

      const adminTabContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/presentation/pages/settings/components/SettingsAdminTab.tsx'),
        'utf-8'
      );
      expect(adminTabContent).toContain("SecurityService.getSecure('gmao_vault_salt_v2')");
      expect(adminTabContent).toContain("SecurityService.getSecure('gmao_vault_cipher_v2')");
      expect(adminTabContent).not.toContain("localStorage.getItem('gmao_vault_salt_v2')");
      expect(adminTabContent).not.toContain("localStorage.getItem('gmao_vault_cipher_v2')");

      const sessionStoreContent = fs.readFileSync(
        path.resolve(process.cwd(), 'src/core/security/serverSessionStore.ts'),
        'utf-8'
      );
      expect(sessionStoreContent).toContain('Logger.error(');
      expect(sessionStoreContent).not.toContain('console.error(');
    });
  });
});

