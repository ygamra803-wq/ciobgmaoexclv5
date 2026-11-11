import { pbkdf2Sha256Hex, symmetricEncrypt, symmetricDecrypt } from '../core/security/nativeCrypto';
import { Logger } from '../core/logger/LoggerService';
import { SecurityService as CoreSecurityService } from '../core/security/SecurityService';

export const DEFAULT_SECRET_KEY = 'GMAO_SECURE_KEY';

function resolveSecretKey(providedKey?: string): string {
  const isProd = Boolean(
    import.meta.env.PROD ||
    (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
  );

  // If a custom key (not the insecure static default) was explicitly passed, use it
  if (providedKey && providedKey !== DEFAULT_SECRET_KEY) {
    return providedKey;
  }

  // S0: In production, reject silent static default key and enforce canonical CoreSecurityService.SECRET_KEY
  if (isProd) {
    if (providedKey === DEFAULT_SECRET_KEY) {
      Logger.warn(
        '[SecurityService] Insecure static DEFAULT_SECRET_KEY rejected in production. Using canonical CoreSecurityService.SECRET_KEY.'
      );
    }
    return CoreSecurityService.SECRET_KEY;
  }

  // In development/test, fallback to provided key or DEFAULT_SECRET_KEY
  return providedKey || DEFAULT_SECRET_KEY;
}

/**
 * Security Service for Hashing, Encryption and Local Storage protection
 */
export class SecurityService {
  /**
   * Encrypt object/string data to secure string format
   * @param {any} data - Raw data to encrypt
   * @param {string} [secretKey] - Optional encryption key
   * @returns {string} Encrypted string payload
   */
  static encrypt(data: any, secretKey?: string) {
    try {
      if (data === undefined || data === null) return '';
      const key = resolveSecretKey(secretKey);
      if (!key) {
        throw new Error('[SecurityService] Encryption aborted: key is null or empty');
      }
      return symmetricEncrypt(JSON.stringify(data), key);
    } catch (e) {
      const isProd = Boolean(
        import.meta.env.PROD ||
        (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
      );
      if (isProd) {
        Logger.error('Encryption failed in production:', e, 'SecurityService');
        throw e;
      }
      // Dev-only fallback to safe base64 encoding if symmetric encryption fails
      try {
        return btoa(JSON.stringify(data));
      } catch {
        Logger.error('Encryption error:', e, 'SecurityService');
        return '';
      }
    }
  }

  /**
   * Decrypt encrypted string payload back to original object/value
   * @param {string} encrypted - Encrypted string payload
   * @param {string} [secretKey] - Optional encryption key
   * @returns {any} Decrypted data object or null if invalid
   */
  static decrypt(encrypted: string, secretKey?: string) {
    if (!encrypted) return null;
    const key = resolveSecretKey(secretKey);
    try {
      if (key) {
        const decryptedData = symmetricDecrypt(encrypted, key);
        if (decryptedData) {
          return JSON.parse(decryptedData);
        }
      }
    } catch {
      // Fall through to dev-only fallback
    }
    const isProd = Boolean(
      import.meta.env.PROD ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')
    );
    if (!isProd) {
      try {
        return JSON.parse(atob(encrypted));
      } catch (err) {
        Logger.error('Failed to decrypt data:', err, 'SecurityService');
        return null;
      }
    }
    return null;
  }

  /**
   * Save encrypted item safely to localStorage (delegates to canonical CoreSecurityService)
   * @param {string} key - Storage key name
   * @param {any} data - Value object/data to store securely
   */
  static saveSecure(key, data) {
    return CoreSecurityService.saveSecure(key, data);
  }

  /**
   * Retrieve and decrypt item safely from localStorage (delegates to canonical CoreSecurityService)
   * @param {string} key - Storage key name
   * @returns {any} Decrypted payload or null
   */
  static getSecure(key) {
    return CoreSecurityService.getSecure(key);
  }

  static removeSecure(key: string) {
    return CoreSecurityService.removeSecure(key);
  }

  static saveSessionSecure(key: string, data: any) {
    return CoreSecurityService.saveSessionSecure(key, data);
  }

  static getSessionSecure(key: string) {
    return CoreSecurityService.getSessionSecure(key);
  }

  /**
   * Hash PIN code securely using PBKDF2-SHA256
   * @param {string} pin
   * @returns {string} Hashed PIN string
   */
  static hashPin(pin) {
    if (!pin) return '';
    const salt = CoreSecurityService.generateRandomHex(16);
    const keyHex = pbkdf2Sha256Hex(pin, salt, 10000, 32);
    return `pbkdf2:v1:${salt}:10000:${keyHex}`;
  }

  /**
   * Verify plain text PIN against stored hash or plain PIN
   * @param {string} enteredPIN
   * @param {string} storedPIN
   * @returns {boolean}
   */
  static verifyPIN(enteredPIN, storedPIN) {
    if (!enteredPIN || !storedPIN) return false;
    if (enteredPIN === storedPIN) return true;
    if (typeof storedPIN === 'string' && storedPIN.startsWith('pbkdf2:v1:')) {
      const parts = storedPIN.split(':');
      if (parts.length === 5) {
        const [, , saltHex, iterStr, expectedHashHex] = parts;
        const iterations = parseInt(iterStr, 10) || 10000;
        const keyHex = pbkdf2Sha256Hex(enteredPIN, saltHex, iterations, 32);
        return keyHex === expectedHashHex;
      }
    }
    return false;
  }

  // Alias helpers for backwards compatibility
  static verifyPin(pin, hashedPin) {
    return this.verifyPIN(pin, hashedPin);
  }

  static encryptData(data, secretKey = DEFAULT_SECRET_KEY) {
    return this.encrypt(data, secretKey);
  }

  static decryptData(ciphertext, secretKey = DEFAULT_SECRET_KEY) {
    return this.decrypt(ciphertext, secretKey);
  }
}

export default SecurityService;
