import { describe, it, expect } from 'vitest';
import { vaultService } from '@/utils/vaultService.js';
import { SecurityService } from '@/core/security/SecurityService.js';

describe('Auth & Vault Infrastructure Unit Tests', () => {
  it('يجب تشفير وفك تشفير البيانات عبر VaultService بنجاح', () => {
    const rawData = { user: 'technicien_1', role: 'TECHNICIAN' };
    const password = 'SecretPassword123!';

    const encrypted = vaultService.encrypt(JSON.stringify(rawData), password);
    expect(encrypted).toBeDefined();
    expect(typeof encrypted).toBe('string');
    expect(encrypted).not.toEqual(JSON.stringify(rawData));

    const decrypted = vaultService.decrypt(encrypted, password);
    const parsed = JSON.parse(decrypted);
    expect(parsed.user).toBe('technicien_1');
    expect(parsed.role).toBe('TECHNICIAN');
  });

  it('يجب تجشيم والتحقق من كلمات المرور باستخدام Web Crypto PBKDF2-SHA256 بنجاح', async () => {
    const password = 'SecretPassword123!';
    const hash = await SecurityService.hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).toContain('pbkdf2:v1:');
    
    const isValid = await SecurityService.comparePassword(password, hash);
    const isInvalid = await SecurityService.comparePassword('WrongPassword!', hash);

    expect(isValid).toBe(true);
    expect(isInvalid).toBe(false);
  });

  it('يجب توليد والتحقق من توكن HMAC بنجاح', () => {
    const payload = { id: 'admin-1', username: 'admin', role: 'ADMIN' };
    const token = SecurityService.generateToken(payload);
    
    expect(token).toBeDefined();
    expect(token).toContain('.');

    const verified = SecurityService.verifyToken(token);
    expect(verified.username).toBe('admin');
    expect(verified.role).toBe('ADMIN');
  });

  it('يجب كشف انتهاء صلاحية التوكن بشكل آمن عند انتهاء المدة', () => {
    const payload = { id: 'tech-1', username: 'tech' };
    // Generate token that expired 10 seconds ago
    const expiredToken = SecurityService.generateToken(payload, -10);

    expect(() => {
      SecurityService.verifyToken(expiredToken);
    }).toThrow('Token expired');
  });

  it('يجب رفض التوكن إذا تم التلاعب بالتوقيع', () => {
    const payload = { id: 'user-1', role: 'VIEWER' };
    const token = SecurityService.generateToken(payload);
    const tamperedToken = token.slice(0, -4) + 'abcd';

    expect(() => {
      SecurityService.verifyToken(tamperedToken);
    }).toThrow('Invalid token signature');
  });
});

