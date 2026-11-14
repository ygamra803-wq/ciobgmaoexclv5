import { describe, it, expect } from 'vitest';
import { SecurityService } from '../../core/security/SecurityService';

describe('SecurityService', () => {
  it('should hash and verify PIN successfully', () => {
    const pin = '1234';
    const hashed = SecurityService.hashPin(pin);
    expect(hashed).toBeDefined();
    expect(SecurityService.verifyPIN(pin, hashed)).toBe(true);
    expect(SecurityService.verifyPIN('9999', hashed)).toBe(false);
  });

  it('should encrypt and decrypt data correctly', () => {
    const data = { role: 'ADMIN', name: 'Test User' };
    const encrypted = SecurityService.encrypt(data);
    expect(encrypted).toBeDefined();

    const decrypted = SecurityService.decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });
});
