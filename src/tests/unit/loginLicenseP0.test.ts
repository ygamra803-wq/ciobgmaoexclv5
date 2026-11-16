import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '@/core/security/AuthService';
import {
  LicenseGateService,
  looksLikeStoredVerifierOrHash,
  validateLicenseKeyPolicy,
} from '@/core/security/LicenseGateService';
import { SecurityService } from '@/core/security/SecurityService';
import { STORAGE_KEYS } from '@/infrastructure/persistence/storageKeys';

describe('LOGIN-LICENSE-P0 — Dual-Key AND Gate + Commercial License Key Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    LicenseGateService.clearLicenseRecord();
  });

  it('1) Without an ACTIVE license record -> normal login is rejected and activation is required', async () => {
    const auth = new AuthService();
    // Even if an account has a valid passwordHash, login without an active license record must fail
    await auth.updateUserPassword('admin', 'AdminStrongPass2026!');
    expect(LicenseGateService.isLicenseActive()).toBe(false);
    expect(auth.isLicenseActivated()).toBe(false);

    await expect(
      auth.login('admin', 'AdminStrongPass2026!', 'CIOB-LIC-2026-0001')
    ).rejects.toThrow(/Licence système non activée/i);
  });

  it('2) Valid license key + wrong account password -> rejected', async () => {
    const auth = new AuthService();
    await auth.activateLicenseAndAdmin({
      licenseKey: 'CIOB-LIC-2026-ATELIER-01',
      adminPassword: 'AdminStrongPass2026!',
      organizationLabel: 'Atelier Test CIOB',
    });

    await expect(
      auth.login('admin', 'WrongAdminPassword999!', 'CIOB-LIC-2026-ATELIER-01')
    ).rejects.toThrow(/Échec d'authentification/i);
  }, 15000);

  it('3) Wrong license key + valid account password -> rejected', async () => {
    const auth = new AuthService();
    await auth.activateLicenseAndAdmin({
      licenseKey: 'CIOB-LIC-2026-ATELIER-01',
      adminPassword: 'AdminStrongPass2026!',
    });

    await expect(
      auth.login('admin', 'AdminStrongPass2026!', 'WRONG-LICENSE-KEY-9999')
    ).rejects.toThrow(/Échec d'authentification/i);
  }, 15000);

  it('4) Both valid (License Key AND Account Password) -> opens signed HMAC session with expected RBAC role', async () => {
    const auth = new AuthService();
    const { licenseRecord } = await auth.activateLicenseAndAdmin({
      licenseKey: 'CIOB-LIC-2026-ATELIER-01',
      adminPassword: 'AdminStrongPass2026!',
      organizationLabel: 'Atelier Test CIOB',
    });

    expect(licenseRecord.licenseStatus).toBe('ACTIVE');
    expect(licenseRecord.licenseKeyId).toMatch(/^LIC-FPR-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(licenseRecord.licenseVerifier).toMatch(
      /^pbkdf2:v1:[0-9a-f]{32}:600000:[0-9a-f]{64}$/
    );
    // Raw license key must never appear in the stored record
    expect(JSON.stringify(licenseRecord)).not.toContain('CIOB-LIC-2026-ATELIER-01');

    const session = await auth.login(
      'admin',
      'AdminStrongPass2026!',
      'CIOB-LIC-2026-ATELIER-01'
    );

    expect(session).toBeDefined();
    expect(session.username).toBe('admin');
    expect(session.role).toBe('ADMIN');
    expect(session.authMethod).toBe('DUAL_KEY_AND');
    expect(session.licenseKeyId).toBe(licenseRecord.licenseKeyId);

    // Verify signed HMAC token in sessionStorage
    const current = auth.getCurrentUser();
    expect(current).not.toBeNull();
    expect(current.username).toBe('admin');
    expect(current.role).toBe('ADMIN');
  }, 15000);

  it('5) Zero PIN-only or Password-only bypass: loginWithPin and single-key login always fail, and licenseKey !== adminPassword is enforced', async () => {
    const auth = new AuthService();

    // Rejects activation if licenseKey === adminPassword
    await expect(
      auth.activateLicenseAndAdmin({
        licenseKey: 'SameSecret2026!',
        adminPassword: 'SameSecret2026!',
      })
    ).rejects.toThrow(/Séparation des secrets obligatoire/i);

    await auth.activateLicenseAndAdmin({
      licenseKey: '84920173',
      adminPassword: 'IndependentAdminPass2026!',
    });

    // 5a. loginWithPin must unconditionally fail
    await expect(auth.loginWithPin('84920173')).rejects.toThrow(
      /Authentification à clé unique désactivée/i
    );

    // 5b. Calling login with password only (no licenseKey) must fail
    await expect(auth.login('admin', 'IndependentAdminPass2026!')).rejects.toThrow(
      /Authentification à double clé requise/i
    );

    // 5c. Calling login with licenseKey in the password field must fail (admin.passwordHash !== hash(licenseKey))
    await expect(auth.login('admin', '84920173', '84920173')).rejects.toThrow(
      /Échec d'authentification/i
    );

    // 5d. Updating any user's password to equal the active license key must be rejected
    await expect(auth.updateUserPassword('magasinier', 'CIOB84920173')).resolves.toBeDefined();
    await auth.activateLicenseAndAdmin({
      licenseKey: 'LicKey2026Secure',
      adminPassword: 'AdminDistinctPass2026!',
    });
    await expect(
      auth.updateUserPassword('magasinier', 'LicKey2026Secure')
    ).rejects.toThrow(/Séparation des secrets obligatoire/i);
  }, 15000);

  it('6) Pasting the stored PBKDF2 hash/verifier or AES-GCM ciphertext into the password or license key field is immediately rejected', async () => {
    const auth = new AuthService();
    const { licenseRecord } = await auth.activateLicenseAndAdmin({
      licenseKey: 'CIOB-LIC-2026-ATELIER-01',
      adminPassword: 'AdminStrongPass2026!',
    });

    const users = auth.getStoredUsersList();
    const adminAcc = users.find((u: any) => u.username === 'admin');
    const storedPasswordHash = String(adminAcc.passwordHash);
    const storedLicenseVerifier = String(licenseRecord.licenseVerifier);

    expect(looksLikeStoredVerifierOrHash(storedPasswordHash)).toBe(true);
    expect(looksLikeStoredVerifierOrHash(storedLicenseVerifier)).toBe(true);

    // Pasting stored passwordHash into password field -> rejected
    await expect(
      auth.login('admin', storedPasswordHash, 'CIOB-LIC-2026-ATELIER-01')
    ).rejects.toThrow(/empreintes cryptographiques stockées/i);

    // Pasting stored licenseVerifier into licenseKey field -> rejected
    await expect(
      auth.login('admin', 'AdminStrongPass2026!', storedLicenseVerifier)
    ).rejects.toThrow(/empreintes cryptographiques stockées/i);

    // Pasting stored hash when setting password or license key -> rejected
    expect(() => validateLicenseKeyPolicy(storedLicenseVerifier)).toThrow(
      /empreintes cryptographiques stockées/i
    );
  }, 15000);

  it('7) Commercial License Key rotation updates ILicenseRecord without altering operational account passwords, and .lic/.json file parser works cleanly', async () => {
    const auth = new AuthService();
    const initial = await auth.activateLicenseAndAdmin({
      licenseKey: 'CIOB-LIC-V1-2026',
      adminPassword: 'AdminStrongPass2026!',
      organizationLabel: 'Atelier V1',
    });

    // Also set a custom password for magasinier
    await auth.updateUserPassword('magasinier', 'MagasinPass2026!');

    // Parse a .lic JSON payload
    const parsedFile = LicenseGateService.parseLicenseFilePayload(
      JSON.stringify({
        licenseKey: 'CIOB-LIC-V2-2027-PRO',
        organizationLabel: 'Atelier CIOB Expansion',
      })
    );
    expect(parsedFile.licenseKey).toBe('CIOB-LIC-V2-2027-PRO');
    expect(parsedFile.organizationLabel).toBe('Atelier CIOB Expansion');

    // Rotate license key (requires current license key + current Admin password)
    const rotated = await auth.rotateLicenseKeyWithAdminAuth({
      currentLicenseKey: 'CIOB-LIC-V1-2026',
      adminPassword: 'AdminStrongPass2026!',
      newLicenseKey: parsedFile.licenseKey,
      organizationLabel: parsedFile.organizationLabel,
    });

    expect(rotated.licenseKeyId).not.toBe(initial.licenseRecord.licenseKeyId);
    expect(rotated.organizationLabel).toBe('Atelier CIOB Expansion');
    expect(localStorage.getItem(STORAGE_KEYS.LICENSE_RECORD)).toBeTruthy();

    // Old license key must no longer work
    await expect(
      auth.login('admin', 'AdminStrongPass2026!', 'CIOB-LIC-V1-2026')
    ).rejects.toThrow(/Échec d'authentification/i);

    // New license key + unchanged Admin password works
    const adminSession = await auth.login(
      'admin',
      'AdminStrongPass2026!',
      'CIOB-LIC-V2-2027-PRO'
    );
    expect(adminSession.username).toBe('admin');

    // New license key + unchanged Magasinier password works
    const magSession = await auth.login(
      'magasinier',
      'MagasinPass2026!',
      'CIOB-LIC-V2-2027-PRO'
    );
    expect(magSession.username).toBe('magasinier');
    expect(magSession.role).toBe('RESPONSABLE_MAGASIN');
  }, 15000);
});
