import { describe, it, expect } from 'vitest';
import { SecurityService } from '../../utils/securityService';

describe('SecurityService', () => {
  it('should hash and verify PIN successfully', () => {
    const pin = '1234';
    const hashed = SecurityService.hashPin(pin);
    expect(hashed).toBeDefined();
    expect(SecurityService.verifyPin(pin, hashed)).toBe(true);
    expect(SecurityService.verifyPin('9999', hashed)).toBe(false);
  });

  it('should encrypt and decrypt data correctly', () => {
    const data = { role: 'ADMIN', name: 'Test User' };
    const encrypted = SecurityService.encryptData(data);
    expect(encrypted).toBeDefined();

    const decrypted = SecurityService.decryptData(encrypted);
    expect(decrypted).toEqual(data);
  });
});
