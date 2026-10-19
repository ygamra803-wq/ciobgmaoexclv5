// ✅ ملف: src/tests/security/VaultService.test.ts

import { describe, it, expect } from 'vitest';
import VaultService from '@/infrastructure/security/VaultService';

describe('VaultService', () => {
  describe('Encryption/Decryption', () => {
    it('should encrypt and decrypt data', () => {
      const data = {
        articles: [
          { ref: 'ROUL-6204', stockActuel: 100 }
        ],
        movements: []
      };

      const password = 'MySecurePassword123!@#';

      const encrypted = VaultService.encrypt(data, password);
      const decrypted = VaultService.decrypt(encrypted, password);

      expect(decrypted).toEqual(data);
    });

    it('should fail with wrong password', () => {
      const data = { secret: 'value' };
      const password1 = 'MySecurePassword123!@#';
      const password2 = 'WrongPassword123!@#';

      const encrypted = VaultService.encrypt(data, password1);

      expect(() => {
        VaultService.decrypt(encrypted, password2);
      }).toThrow();
    });

    it('should produce different ciphertexts for same plaintext', () => {
      const data = { secret: 'value' };
      const password = 'MySecurePassword123!@#';

      const encrypted1 = VaultService.encrypt(data, password);
      const encrypted2 = VaultService.encrypt(data, password);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('PIN Hashing', () => {
    it('should hash and verify PIN', async () => {
      const pin = '1234';

      const hash = await VaultService.hashPIN(pin);
      const isValid = await VaultService.verifyPIN(pin, hash);

      expect(isValid).toBe(true);
    });

    it('should fail with wrong PIN', async () => {
      const pin = '1234';
      const wrongPin = '5678';

      const hash = await VaultService.hashPIN(pin);
      const isValid = await VaultService.verifyPIN(wrongPin, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('Password Strength', () => {
    it('should validate strong password', () => {
      const password = 'MySecurePassword123!@#';
      const result = VaultService.validatePasswordStrength(password);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject weak password', () => {
      const password = 'weak';
      const result = VaultService.validatePasswordStrength(password);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
