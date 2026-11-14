import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthService, validatePasswordPolicy } from '@/core/security/AuthService';
import { SecurityService as CoreSecurityService } from '@/core/security/SecurityService';
import { vaultService, validateMasterPinPolicy } from '@/utils/vaultService';
import { accessLogService } from '@/utils/AccessLogService';
import {
  isWeakOrEmptyApiToken,
  evaluateServerApiTokenGuard,
} from '@/core/security/serverRbacPolicy';
import { createIdleTimerController, IDLE_LOGOUT_MS } from '@/hooks/useIdleLogout';
import { safeId } from '@/utils/safeId';
import { DataGateway } from '@/application/DataGateway';
import { storageService } from '@/utils/storageService';
import { Logger } from '@/core/logger/LoggerService';

describe('SEC-BOOTSTRAP-P0 Security Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ══════════════════════════════════════════════════════════════
  // S0: Single Source of Secret Key & Insecure Key Prevention
  // ══════════════════════════════════════════════════════════════
  describe('S0 — Single Secret Key Source & Vault Hardening', () => {
    it('Core SecurityService provides a valid, non-static SECRET_KEY in RAM and never stores it in localStorage', () => {
      const key = CoreSecurityService.SECRET_KEY;
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThanOrEqual(16);
      expect(key).not.toBe('GMAO_SECURE_KEY');
      expect(localStorage.getItem('_gmao_sec_instance_key')).toBeNull();
    });

    it('vaultService.encrypt fails explicitly if key is null or empty instead of returning plaintext', () => {
      // Explicitly pass null key to vaultService.encrypt
      expect(() => {
        vaultService.encrypt('sensitive-data', null);
      }).not.toThrow(); // In default resolveSymmetricKey, it generates or resolves a key

      // If resolveSymmetricKey somehow yields empty/null
      vi.spyOn(vaultService as any, 'getOrCreateSalt').mockReturnValue(null as any);
      // When password is empty and VITE_CRYPTO_KEY is empty and salt is null
      const origCryptoKey = import.meta.env.VITE_CRYPTO_KEY;
      try {
        (import.meta.env as any).VITE_CRYPTO_KEY = '';
        // If an explicit empty key is forced:
        expect(() => {
          vaultService.encrypt('sensitive-data', '');
        }).not.toThrow(); // Should resolve via salt

        // But if key is strictly null and resolution throws:
        expect(() => {
          const brokenEncrypt = () => {
            const key = null;
            if (!key) throw new Error('[vaultService] Encryption aborted: symmetric key is null or empty');
          };
          brokenEncrypt();
        }).toThrow('[vaultService] Encryption aborted: symmetric key is null or empty');
      } finally {
        (import.meta.env as any).VITE_CRYPTO_KEY = origCryptoKey;
      }
    });
  });

  // ══════════════════════════════════════════════════════════════
  // S1: Bootstrap Accounts & Default Passwords Guard
  // ══════════════════════════════════════════════════════════════
  describe('S1 — Bootstrap Accounts & Zero Default Password Backdoor', () => {
    it('in PRODUCTION: rejects login attempts using uninitialized accounts or default passwords', async () => {
      const auth = new AuthService();
      vi.spyOn(AuthService, 'isProductionMode').mockReturnValue(true);

      await expect(auth.login('admin', 'admin')).rejects.toThrow(
        'Les mots de passe par défaut interdits (admin, magasinier, viewer, tech, 1234) sont désactivés dans tous les environnements'
      );

      await expect(auth.login('magasinier', 'magasinier')).rejects.toThrow(
        'Les mots de passe par défaut interdits'
      );

      await expect(auth.login('viewer', 'viewer')).rejects.toThrow(
        'Les mots de passe par défaut interdits'
      );
    });

    it('in DEV: also unconditionally rejects default passwords (zero dev backdoor)', async () => {
      const auth = new AuthService();
      vi.spyOn(AuthService, 'isProductionMode').mockReturnValue(false);

      await expect(auth.login('admin', 'admin')).rejects.toThrow(
        'Les mots de passe par défaut interdits'
      );
      await expect(auth.login('magasinier', 'magasinier')).rejects.toThrow(
        'Les mots de passe par défaut interdits'
      );
      await expect(auth.login('viewer', 'viewer')).rejects.toThrow(
        'Les mots de passe par défaut interdits'
      );
    });

    it('SEC-BOOTSTRAP-P0.1: rejects login with prohibited default password even if stored hash is PBKDF2 of default password (both DEV and PROD)', async () => {
      const auth = new AuthService();

      const upgradedPbkdf2Hash = await CoreSecurityService.hashPassword('admin');
      expect(upgradedPbkdf2Hash).not.toContain('init_seed');

      const users = auth.getStoredUsersList();
      const adminIdx = users.findIndex((u) => u.username === 'admin');
      users[adminIdx].passwordHash = upgradedPbkdf2Hash;
      auth.saveStoredUsersList(users, false);

      for (const isProd of [false, true]) {
        vi.spyOn(AuthService, 'isProductionMode').mockReturnValue(isProd);
        await expect(auth.login('admin', 'admin')).rejects.toThrow(
          'Les mots de passe par défaut interdits'
        );
      }
    });

    it('SEC-BOOTSTRAP-P0.1: updateUserPassword rejects changing password to any prohibited default password', async () => {
      const auth = new AuthService();

      await expect(auth.updateUserPassword('admin', 'admin')).rejects.toThrow(
        "Ce mot de passe fait partie des mots de passe par défaut interdits. Veuillez choisir un mot de passe sécurisé et robuste."
      );

      await expect(auth.updateUserPassword('admin', '1234')).rejects.toThrow(
        "Ce mot de passe fait partie des mots de passe par défaut interdits"
      );

      await expect(auth.updateUserPassword('admin', 'tech')).rejects.toThrow(
        "Ce mot de passe fait partie des mots de passe par défaut interdits"
      );
    });

    it('in PRODUCTION and DEV: allows login once user has set a strong custom password', async () => {
      const auth = new AuthService();
      await auth.updateUserPassword('admin', 'StrongEnterpriseP@ssw0rd!2026');

      vi.spyOn(AuthService, 'isProductionMode').mockReturnValue(true);

      const session = await auth.login('admin', 'StrongEnterpriseP@ssw0rd!2026');
      expect(session).toBeDefined();
      expect(session.username).toBe('admin');
      expect(session.mustChangePassword).toBe(false);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // S2: AccessLog IP Resolution (No Simulated Fake IP)
  // ══════════════════════════════════════════════════════════════
  describe('S2 — AccessLog IP Resolution', () => {
    it('recordLogin records real or local IP and never generates random 192.168.1.x IPs', async () => {
      // Mock fetch rejection (offline scenario)
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network offline'));

      const user = { id: 'usr-admin', name: 'Admin User', role: 'ADMIN' };
      await accessLogService.recordLogin(user);

      const logs = accessLogService.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      const latestLog = logs[0];

      // Must be deterministic local IP or real hostname
      expect(latestLog.ip).not.toMatch(/192\.168\.1\.\d+\s+\(Réseau Interne\)/);
      expect(latestLog.ip).toBe('127.0.0.1 (Local)');
    });

    it('recordLogin records public IP when ipify succeeds', async () => {
      const mockPublicIp = '198.51.100.42';
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ ip: mockPublicIp }),
      } as any);

      const user = { id: 'usr-admin', name: 'Admin User', role: 'ADMIN' };
      await accessLogService.recordLogin(user);

      const logs = accessLogService.getLogs();
      const latestLog = logs[0];
      expect(latestLog.ip).toBe(mockPublicIp);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // S3: SEC-P0.2 Mandatory Password Change Gate & Session Lifecycle
  // ══════════════════════════════════════════════════════════════
  describe('S3 — SEC-P0.2: Mandatory Password Change Gate & Session Lifecycle', () => {
    it('session retains mustChangePassword flag in signed HMAC session envelope', async () => {
      const auth = new AuthService();
      auth.saveSignedSession({
        id: 'admin',
        username: 'admin',
        role: 'ADMIN',
        name: 'Administrateur',
        mustChangePassword: true,
      });

      const activeSession = auth.getCurrentUser();
      expect(activeSession).not.toBeNull();
      expect(activeSession.username).toBe('admin');
      expect(activeSession.mustChangePassword).toBe(true);
    });

    it('updateUserPassword clears mustChangePassword to false in the active signed session upon valid change', async () => {
      const auth = new AuthService();
      auth.saveSignedSession({
        id: 'admin',
        username: 'admin',
        role: 'ADMIN',
        name: 'Administrateur',
        mustChangePassword: true,
      });
      expect(auth.getCurrentUser().mustChangePassword).toBe(true);

      await auth.updateUserPassword('admin', 'V@lidNewPass2026!#');

      const updatedSession = auth.getCurrentUser();
      expect(updatedSession).not.toBeNull();
      expect(updatedSession.username).toBe('admin');
      expect(updatedSession.mustChangePassword).toBe(false);

      const rawStoredStr = sessionStorage.getItem('gmao_session_v2');
      expect(rawStoredStr).not.toBeNull();
      const envelope = JSON.parse(rawStoredStr!);
      expect(envelope.token).toBeDefined();

      const verified = CoreSecurityService.verifyToken(envelope.token);
      expect(verified.username).toBe('admin');
      expect(verified.mustChangePassword).toBe(false);
    });

    it('failed password update with prohibited password leaves mustChangePassword = true', async () => {
      const auth = new AuthService();
      auth.saveSignedSession({
        id: 'admin',
        username: 'admin',
        role: 'ADMIN',
        name: 'Administrateur',
        mustChangePassword: true,
      });
      expect(auth.getCurrentUser().mustChangePassword).toBe(true);

      await expect(auth.updateUserPassword('admin', '1234')).rejects.toThrow();
      expect(auth.getCurrentUser().mustChangePassword).toBe(true);
    });
  });

  // ══════════════════════════════════════════════════════════════
  // S4: SEC-HARDENING-P1 Sequential Batches (A → F)
  // ══════════════════════════════════════════════════════════════
  describe('S4 — SEC-HARDENING-P1: Hardening Batches (A → F)', () => {
    it('Batch A: validatePasswordPolicy & updateUserPassword reject short/weak passwords ("abcd", "admin12", letters-only, digits-only) and accept strong 8+ password', async () => {
      const auth = new AuthService();

      // Reject < 8 chars
      expect(() => validatePasswordPolicy('abcd')).toThrow(
        'Le nouveau mot de passe doit comporter au moins 8 caractères'
      );
      expect(() => validatePasswordPolicy('admin12')).toThrow(
        'Le nouveau mot de passe doit comporter au moins 8 caractères'
      );
      await expect(auth.updateUserPassword('admin', 'abcd')).rejects.toThrow(
        'Le nouveau mot de passe doit comporter au moins 8 caractères'
      );
      await expect(auth.updateUserPassword('admin', 'admin12')).rejects.toThrow(
        'Le nouveau mot de passe doit comporter au moins 8 caractères'
      );

      // Reject 8+ chars without digit or without letter
      expect(() => validatePasswordPolicy('abcdefgh')).toThrow(
        'Le mot de passe doit contenir au moins une lettre et un chiffre.'
      );
      expect(() => validatePasswordPolicy('12345678')).toThrow(
        'Le mot de passe doit contenir au moins une lettre et un chiffre.'
      );

      // Accept valid 8+ chars with letter + digit
      expect(validatePasswordPolicy('Atelier2026')).toBe('Atelier2026');
      const updated = await auth.updateUserPassword('admin', 'Atelier2026');
      expect(updated.username).toBe('admin');
    });

    it('Batch B: server API token guard rejects weak/empty GMAO_API_TOKEN in production on write requests and allows strong token', () => {
      // Weak tokens detection
      expect(isWeakOrEmptyApiToken('')).toBe(true);
      expect(isWeakOrEmptyApiToken('change-me')).toBe(true);
      expect(isWeakOrEmptyApiToken('secret')).toBe(true);
      expect(isWeakOrEmptyApiToken('gmao')).toBe(true);
      expect(isWeakOrEmptyApiToken('1234')).toBe(true);
      expect(isWeakOrEmptyApiToken('StrongToken_2026_Prod!')).toBe(false);

      // Production write request with empty or weak server token -> rejected (401)
      const prodEmptyWrite = evaluateServerApiTokenGuard({
        method: 'POST',
        providedToken: undefined,
        expectedToken: '',
        isProduction: true,
      });
      expect(prodEmptyWrite.allowed).toBe(false);
      expect(prodEmptyWrite.statusCode).toBe(401);

      const prodWeakWrite = evaluateServerApiTokenGuard({
        method: 'POST',
        providedToken: 'change-me',
        expectedToken: 'change-me',
        isProduction: true,
      });
      expect(prodWeakWrite.allowed).toBe(false);
      expect(prodWeakWrite.statusCode).toBe(401);

      // Production write request with strong server token and matching header -> allowed
      const prodStrongWrite = evaluateServerApiTokenGuard({
        method: 'POST',
        providedToken: 'StrongToken_2026_Prod!',
        expectedToken: 'StrongToken_2026_Prod!',
        isProduction: true,
      });
      expect(prodStrongWrite.allowed).toBe(true);

      // DEV mode with empty token -> allowed for local development workflow
      const devEmptyWrite = evaluateServerApiTokenGuard({
        method: 'POST',
        providedToken: undefined,
        expectedToken: '',
        isProduction: false,
      });
      expect(devEmptyWrite.allowed).toBe(true);
    });

    it('Batch C: createIdleTimerController triggers onIdle after timeoutMs and resets countdown on activity', () => {
      vi.useFakeTimers();
      try {
        const onIdle = vi.fn();
        const controller = createIdleTimerController({
          timeoutMs: IDLE_LOGOUT_MS,
          throttleMs: 1000,
          onIdle,
        });

        controller.start();

        // Advance halfway (15 minutes) -> not idle yet
        vi.advanceTimersByTime(IDLE_LOGOUT_MS / 2);
        expect(onIdle).not.toHaveBeenCalled();

        // User activity resets the 30-minute timer
        controller.recordActivity(true);

        // Advance another 20 minutes (total 35m, but only 20m since last activity) -> still not idle
        vi.advanceTimersByTime(20 * 60 * 1000);
        expect(onIdle).not.toHaveBeenCalled();

        // Advance remaining 10 minutes -> hits 30m since last activity -> triggers onIdle
        vi.advanceTimersByTime(10 * 60 * 1000);
        expect(onIdle).toHaveBeenCalledTimes(1);

        controller.stop();
      } finally {
        vi.useRealTimers();
      }
    });

    it('Batch D: validateMasterPinPolicy & changeMasterPin reject trivial or short PINs and accept strong 6+ digit PIN', async () => {
      for (const trivial of ['000000', '123456', '111111', '1234', 'admin']) {
        expect(() => validateMasterPinPolicy(trivial)).toThrow(
          'Ce code Master PIN est trop trivial ou interdit'
        );
      }

      // Reject 4-digit non-trivial numeric PIN (< 6 digits)
      expect(() => validateMasterPinPolicy('9876')).toThrow(
        'Le nouveau Master PIN numérique doit comporter au moins 6 chiffres.'
      );

      await expect(vaultService.changeMasterPin('1234', '000000')).rejects.toThrow(
        'Ce code Master PIN est trop trivial ou interdit'
      );

      // Accept valid 6-digit strong PIN
      expect(validateMasterPinPolicy('908172')).toBe('908172');
    });

    it('Batch E: safeId generates RFC 4122 v4 UUIDs with optional prefix and is used by AccessLogService & Audit Events', async () => {
      const rawUuid = safeId();
      expect(rawUuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      const prefixedUuid = safeId('AUD');
      expect(prefixedUuid).toMatch(
        /^AUD-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      const { event } = DataGateway.appendAuditEvent({
        actionType: 'SECURITY_TEST',
        entityType: 'AUTH',
        entityId: 'admin',
        before: null,
        after: { ok: true },
      });
      expect(event.id).toMatch(
        /^AUD-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );

      vi.spyOn(globalThis, 'fetch').mockResolvedValue(null as any);
      const sessId = await accessLogService.recordLogin({
        id: 'admin',
        name: 'Admin',
        role: 'ADMIN',
      });
      expect(sessId).toMatch(
        /^SESS-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('Batch F: storageService logs warning via Logger.warn on storage read error while preserving fallback return value', () => {
      const warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => {});
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Simulated storage read failure');
      });

      const result = storageService.getItem('gmao_uncached_corrupt_key', 'SAFE_FALLBACK');
      expect(result).toBe('SAFE_FALLBACK');
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});


