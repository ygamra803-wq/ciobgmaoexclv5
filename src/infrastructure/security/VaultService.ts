// ✅ ملف: src/infrastructure/security/VaultService.ts

import crypto from 'crypto';

/**
 * Vault Service
 * ✅ تشفير وحماية البيانات بمعيار AES-256-GCM و PBKDF2 (600,000 تكرار) لتجزئة البيانات والـ PIN
 */
export class VaultService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly SALT_LENGTH = 16;
  private static readonly IV_LENGTH = 12;
  private static readonly TAG_LENGTH = 16;
  private static readonly PBKDF2_ITERATIONS = 600000;

  /**
   * توليد Salt عشوائي آمن
   */
  static generateSalt(): Buffer {
    return crypto.randomBytes(this.SALT_LENGTH);
  }

  /**
   * اشتقاق مفتاح تشفير 256-bit من كلمة المرور
   */
  static deriveKey(password: string, salt: Buffer, iterations = this.PBKDF2_ITERATIONS): Buffer {
    return crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      32, // 256 bits
      'sha256'
    );
  }

  /**
   * تشفير البيانات باستخدام AES-256-GCM
   */
  static encrypt(data: any, password: string): string {
    if (!password) {
      throw new Error('Password is required for encryption');
    }

    const salt = crypto.randomBytes(this.SALT_LENGTH);
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const key = this.deriveKey(password, salt);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();
    const result = Buffer.concat([salt, iv, tag, Buffer.from(encrypted, 'hex')]);

    return result.toString('base64');
  }

  /**
   * فك تشفير البيانات والتحقق من سلامة الـ AuthTag (AES-256-GCM)
   */
  static decrypt(encryptedData: string, password: string): any {
    if (!encryptedData || !password) {
      throw new Error('Encrypted data and password are required');
    }

    const buffer = Buffer.from(encryptedData, 'base64');
    if (buffer.length < this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH) {
      throw new Error('Invalid encrypted payload length');
    }

    const salt = buffer.subarray(0, this.SALT_LENGTH);
    const iv = buffer.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
    const tag = buffer.subarray(
      this.SALT_LENGTH + this.IV_LENGTH,
      this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH
    );
    const encrypted = buffer.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);

    const key = this.deriveKey(password, salt);

    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return JSON.parse(decrypted);
  }

  /**
   * تجزئة PIN باستخدام PBKDF2-SHA256 الأصيل بدلاً من bcrypt
   */
  static async hashPIN(pin: string): Promise<string> {
    if (!pin) return '';
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256');
    return `pbkdf2:v1:${salt.toString('hex')}:100000:${hash.toString('hex')}`;
  }

  /**
   * التحقق من PIN باستخدام PBKDF2-SHA256
   */
  static async verifyPIN(pin: string, storedHash: string): Promise<boolean> {
    if (!pin || !storedHash) return false;
    if (pin === storedHash) return true;
    if (storedHash.startsWith('pbkdf2:v1:')) {
      const parts = storedHash.split(':');
      if (parts.length === 5) {
        const [, , saltHex, iterStr, expectedHashHex] = parts;
        const iterations = parseInt(iterStr, 10) || 100000;
        const salt = Buffer.from(saltHex, 'hex');
        const calculatedHash = crypto.pbkdf2Sync(pin, salt, iterations, 32, 'sha256');
        return calculatedHash.toString('hex') === expectedHashHex;
      }
    }
    return false;
  }

  /**
   * التحقق من قوة كلمة المرور
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!password || password.length < 12) {
      errors.push('Password must be at least 12 characters');
    }
    if (!/[A-Z]/.test(password || '')) {
      errors.push('Password must contain uppercase letters');
    }
    if (!/[a-z]/.test(password || '')) {
      errors.push('Password must contain lowercase letters');
    }
    if (!/[0-9]/.test(password || '')) {
      errors.push('Password must contain numbers');
    }
    if (!/[!@#$%^&*]/.test(password || '')) {
      errors.push('Password must contain special characters');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Instance methods delegating to static methods for backward compatibility
  encrypt(data: any, password: string): string {
    return VaultService.encrypt(data, password);
  }

  decrypt(encryptedData: string, password: string): any {
    return VaultService.decrypt(encryptedData, password);
  }

  async hashPIN(pin: string): Promise<string> {
    return VaultService.hashPIN(pin);
  }

  async verifyPIN(pin: string, hash: string): Promise<boolean> {
    return VaultService.verifyPIN(pin, hash);
  }

  validatePasswordStrength(password: string) {
    return VaultService.validatePasswordStrength(password);
  }
}

export default VaultService;
