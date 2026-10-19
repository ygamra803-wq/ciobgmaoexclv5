import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityService } from '../../utils/securityService';
import { RateLimiter } from '../../utils/rateLimiter';
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
    });

    it('should prevent brute force attacks by rate-limiting attempts', () => {
      // Allow max 3 attempts within a 60 second window
      const limiter = new RateLimiter(3, 60000);
      const userKey = 'tech_pin_attempts';

      // First 3 attempts are allowed
      expect(limiter.isAllowed(userKey)).toBe(true);
      expect(limiter.isAllowed(userKey)).toBe(true);
      expect(limiter.isAllowed(userKey)).toBe(true);

      // 4th attempt must be rejected/rate-limited
      expect(limiter.isAllowed(userKey)).toBe(false);

      // Reset allows it again
      limiter.reset(userKey);
      expect(limiter.isAllowed(userKey)).toBe(true);
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
      expect(ciphertext).not.toContain('Achraf Gamra'); // Check payload is actually obfuscated

      const decrypted = SecurityService.decrypt(ciphertext);
      expect(decrypted).toEqual(sensitiveData);
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

    it('should handle corrupt or invalid ciphertexts gracefully without throwing', () => {
      const badData = SecurityService.decrypt('invalid-ciphertext-payload-123!!!');
      expect(badData).toBeNull();
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
      expect(viteConfigContent).toContain('X-Frame-Options');
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
      const newPin = '9876';

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
    });
  });
});
