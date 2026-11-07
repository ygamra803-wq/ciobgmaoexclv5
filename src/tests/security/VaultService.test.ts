import { describe, it, expect } from 'vitest';
import { vaultService } from '@/utils/vaultService';
import { SecurityService } from '@/core/security/SecurityService';

describe('VaultService & SecurityService (Live Production Services)', () => {
  describe('Encryption/Decryption (vaultService)', () => {
    it('should encrypt and decrypt serialized data with password', () => {
      const data = {
        articles: [{ ref: 'ROUL-6204', stockActuel: 100 }],
        movements: [],
      };
      const password = 'MySecurePassword123!@#';
      const payload = JSON.stringify(data);

      const encrypted = vaultService.encrypt(payload, password);
      expect(encrypted).not.toBe(payload);

      const decrypted = vaultService.decrypt(encrypted, password);
      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it('should produce different ciphertexts for same plaintext (random salt)', () => {
      const payload = JSON.stringify({ secret: 'value' });
      const password = 'MySecurePassword123!@#';

      const encrypted1 = vaultService.encrypt(payload, password);
      const encrypted2 = vaultService.encrypt(payload, password);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('PIN & Password Hashing (vaultService & SecurityService)', () => {
    it('should hash and verify PIN via SHA-256 and PBKDF2', async () => {
      const pin = '1234';
      const shaHash = await vaultService.hashPinSHA256(pin);
      const wrongShaHash = await vaultService.hashPinSHA256('5678');
      expect(shaHash).toBeDefined();
      expect(shaHash).not.toBe(wrongShaHash);

      const pbkdf2Hash = await SecurityService.hashPassword(pin);
      expect(await SecurityService.comparePassword(pin, pbkdf2Hash)).toBe(true);
      expect(await SecurityService.comparePassword('5678', pbkdf2Hash)).toBe(false);
    });
  });
});
