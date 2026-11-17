import {
  randomBytes,
  randomBytesHex,
  sha256Hex,
  hmacSha256Hex,
  pbkdf2Sha256Hex,
  aes256GcmEncrypt,
  aes256GcmDecrypt,
  aes256GcmEncryptAsync,
  aes256GcmDecryptAsync,
  symmetricDecrypt,
  constantTimeEqual,
  PBKDF2_STANDARD_ITERATIONS,
  bytesToBase64,
  base64ToBytes,
} from './nativeCrypto';
import { Logger } from '../logger/LoggerService';

const KEYSTORE_DB_NAME = 'gmao_security_keystore_v1';
const KEYSTORE_STORE_NAME = 'wrapping_keys';
const KEYSTORE_RECORD_ID = 'master_wrap_v1';
const LEGACY_LOCALSTORAGE_KEY_NAME = '_gmao_sec_instance_key';

interface KeystoreRecord {
  id: string;
  wrappingKey: CryptoKey;
  iv: Uint8Array;
  wrappedSecret: ArrayBuffer;
}

/**
 * @file SecurityService.tsx
 * @module core/security/SecurityService
 * @description
 * Security service providing standard NIST AES-256-GCM authenticated encryption,
 * PBKDF2-HMAC-SHA256 (600,000 iterations), HMAC-SHA256 signed session tokens,
 * and non-extractable Web Crypto IndexedDB key separation (zero key material in localStorage).
 */
export class SecurityService {
  static _volatileInstanceKey: string | null = null;
  static _warnedMissingKey = false;
  static _initPromise: Promise<void> | null = null;

  static generateRandomHex(byteLength = 16): string {
    return randomBytesHex(byteLength);
  }

  /**
   * Initializes key separation via IndexedDB non-extractable Web Crypto `CryptoKey`,
   * unwraps the runtime key into RAM only, and purges/migrates any legacy
   * `_gmao_sec_instance_key` from `localStorage`.
   */
  static async init(): Promise<void> {
    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = (async () => {
      const legacyKey = this.readAndRemoveLegacyLocalStorageKey();

      const envSecret = import.meta.env.VITE_SECRET_KEY;
      if (envSecret && String(envSecret).trim().length > 0) {
        if (legacyKey && legacyKey !== String(envSecret).trim()) {
          this.migrateLegacyLocalStorageEntries(legacyKey, String(envSecret).trim());
        }
        return;
      }

      if (
        typeof indexedDB !== 'undefined' &&
        typeof crypto !== 'undefined' &&
        crypto.subtle
      ) {
        try {
          const runtimeSecret = await this.loadOrCreateIdbWrappedSecret();
          if (runtimeSecret) {
            this._volatileInstanceKey = runtimeSecret;
            if (legacyKey && legacyKey !== runtimeSecret) {
              this.migrateLegacyLocalStorageEntries(legacyKey, runtimeSecret);
            }
            return;
          }
        } catch (err) {
          Logger.warn(
            '[SecurityService] IndexedDB keystore unavailable, using volatile RAM key:',
            err
          );
        }
      }

      if (!this._volatileInstanceKey) {
        this._volatileInstanceKey = this.generateRandomHex(32);
      }
      if (legacyKey && legacyKey !== this._volatileInstanceKey) {
        this.migrateLegacyLocalStorageEntries(legacyKey, this._volatileInstanceKey);
      }
    })();

    return this._initPromise;
  }

  private static readAndRemoveLegacyLocalStorageKey(): string | null {
    try {
      if (typeof localStorage === 'undefined') return null;
      const legacy = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY_NAME);
      if (legacy) {
        localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY_NAME);
        return legacy;
      }
    } catch {
      // ignore storage errors
    }
    return null;
  }

  private static migrateLegacyLocalStorageEntries(oldKey: string, newKey: string): void {
    try {
      if (typeof localStorage === 'undefined') return;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith('gmao_')) continue;
        const val = localStorage.getItem(k);
        if (!val) continue;
        if (val.startsWith('NC2:') || val.startsWith('NC1:') || val.startsWith('AG1:')) {
          const plain = symmetricDecrypt(val, oldKey);
          if (plain) {
            localStorage.setItem(k, aes256GcmEncrypt(plain, newKey));
          }
        }
      }
    } catch (err) {
      Logger.warn('[SecurityService] Legacy localStorage migration skipped:', err);
    }
  }

  private static openKeystoreDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(KEYSTORE_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(KEYSTORE_STORE_NAME)) {
          db.createObjectStore(KEYSTORE_STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Failed to open keystore IndexedDB'));
    });
  }

  private static async loadOrCreateIdbWrappedSecret(): Promise<string | null> {
    const db = await this.openKeystoreDb();
    try {
      const existing = await new Promise<KeystoreRecord | null>((resolve, reject) => {
        const tx = db.transaction(KEYSTORE_STORE_NAME, 'readonly');
        const store = tx.objectStore(KEYSTORE_STORE_NAME);
        const getReq = store.get(KEYSTORE_RECORD_ID);
        getReq.onsuccess = () => resolve((getReq.result as KeystoreRecord) || null);
        getReq.onerror = () => reject(getReq.error);
      });

      const dec = new TextDecoder();
      if (existing?.wrappingKey && existing.iv && existing.wrappedSecret) {
        const plainBuf = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: existing.iv as Uint8Array<ArrayBuffer> },
          existing.wrappingKey,
          existing.wrappedSecret
        );
        const unwrapped = dec.decode(plainBuf);
        if (unwrapped && unwrapped.length >= 32) {
          return unwrapped;
        }
      }

      // Generate a non-extractable AES-256-GCM wrapping key and wrap a fresh 256-bit runtime secret
      const wrappingKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // Non-extractable: XSS cannot call crypto.subtle.exportKey()
        ['encrypt', 'decrypt']
      );
      const runtimeSecret = bytesToBase64(randomBytes(32));
      const iv = randomBytes(12);
      const wrappedSecret = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
        wrappingKey,
        new TextEncoder().encode(runtimeSecret) as Uint8Array<ArrayBuffer>
      );

      const record: KeystoreRecord = {
        id: KEYSTORE_RECORD_ID,
        wrappingKey,
        iv,
        wrappedSecret,
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(KEYSTORE_STORE_NAME, 'readwrite');
        const store = tx.objectStore(KEYSTORE_STORE_NAME);
        const putReq = store.put(record);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      });

      return runtimeSecret;
    } finally {
      db.close();
    }
  }

  /**
   * Runtime encryption key held strictly in RAM (or resolved from env `VITE_SECRET_KEY`).
   * Never persisted alongside ciphertexts in `localStorage`.
   */
  static get SECRET_KEY(): string {
    // Ensure legacy plaintext key in localStorage is always cleaned up if encountered
    this.readAndRemoveLegacyLocalStorageKey();

    const envSecret = import.meta.env.VITE_SECRET_KEY;
    if (envSecret && String(envSecret).trim().length > 0) {
      return String(envSecret).trim();
    }

    const isProd =
      import.meta.env.PROD ||
      (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production');

    if (!this._warnedMissingKey) {
      this._warnedMissingKey = true;
      if (isProd) {
        Logger.error(
          '[SecurityService] VITE_SECRET_KEY is missing in production environment. Using non-extractable keystore / volatile RAM key.'
        );
      } else {
        Logger.warn(
          '[SecurityService] VITE_SECRET_KEY missing in development — using isolated RAM / IndexedDB keystore key.'
        );
      }
    }

    if (!this._volatileInstanceKey) {
      this._volatileInstanceKey = this.generateRandomHex(32);
    }
    return this._volatileInstanceKey;
  }

  /**
   * Hash password using Web Crypto PBKDF2-HMAC-SHA256 (default 600,000 iterations + 128-bit random salt).
   */
  static async hashPassword(
    password: string,
    saltHex: string | null = null,
    iterations = PBKDF2_STANDARD_ITERATIONS
  ): Promise<string> {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Mot de passe invalide pour le hachage.');
      }

      const enc = new TextEncoder();
      const saltBytes = saltHex
        ? new Uint8Array((saltHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16)))
        : randomBytes(16);

      const activeSaltHex = Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (typeof crypto !== 'undefined' && crypto.subtle) {
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          enc.encode(password),
          { name: 'PBKDF2' },
          false,
          ['deriveBits']
        );
        const derivedBits = await crypto.subtle.deriveBits(
          {
            name: 'PBKDF2',
            salt: saltBytes as Uint8Array<ArrayBuffer>,
            iterations,
            hash: 'SHA-256',
          },
          keyMaterial,
          256
        );
        const hashHex = Array.from(new Uint8Array(derivedBits))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        return `pbkdf2:v1:${activeSaltHex}:${iterations}:${hashHex}`;
      }

      const derivedHex = pbkdf2Sha256Hex(password, activeSaltHex, iterations, 32);
      return `pbkdf2:v1:${activeSaltHex}:${iterations}:${derivedHex}`;
    } catch (error) {
      Logger.error('Password hashing failed', error);
      throw error;
    }
  }

  /**
   * Constant-time password comparison supporting PBKDF2-SHA256 and legacy SHA-256 hashes.
   */
  static async comparePassword(password: string, storedHash: string): Promise<boolean> {
    try {
      if (!password || !storedHash || typeof storedHash !== 'string') return false;

      if (storedHash.startsWith('pbkdf2:v1:')) {
        const parts = storedHash.split(':');
        if (parts.length === 5) {
          const [, , saltHex, iterStr, expectedHashHex] = parts;
          const iterations = parseInt(iterStr, 10) || PBKDF2_STANDARD_ITERATIONS;
          const calculated = await this.hashPassword(password, saltHex, iterations);
          const calculatedHashHex = calculated.split(':')[4];
          return constantTimeEqual(
            String(calculatedHashHex || '').toLowerCase(),
            expectedHashHex.toLowerCase()
          );
        }
      }

      if (storedHash.startsWith('$2')) {
        return false;
      }

      if (storedHash.length === 64 && /^[0-9a-f]+$/i.test(storedHash)) {
        return constantTimeEqual(sha256Hex(password).toLowerCase(), storedHash.toLowerCase());
      }

      return false;
    } catch (error) {
      Logger.error('Password comparison failed', error);
      return false;
    }
  }

  static isLegacyHash(hash: string): boolean {
    if (!hash || typeof hash !== 'string') return false;
    return !hash.startsWith('pbkdf2:v1:');
  }

  /**
   * Standard AES-256-GCM encryption (`AG1:` envelope with PBKDF2 600,000 iterations).
   */
  static encrypt(data: unknown): string {
    try {
      const encrypted = aes256GcmEncrypt(JSON.stringify(data), this.SECRET_KEY);
      Logger.debug('Data encrypted successfully (AES-256-GCM)');
      return encrypted;
    } catch (error) {
      Logger.error('Encryption failed', error);
      throw error;
    }
  }

  /**
   * Async Web Crypto AES-256-GCM encryption (`AG1:` envelope with PBKDF2 600,000 iterations).
   */
  static async encryptAsync(data: unknown): Promise<string> {
    try {
      return await aes256GcmEncryptAsync(JSON.stringify(data), this.SECRET_KEY);
    } catch (error) {
      Logger.error('Async AES-GCM encryption failed', error);
      throw error;
    }
  }

  /**
   * Standard AES-256-GCM decryption (`AG1:`), with read-only fallback for legacy `NC2:`/`NC1:` payloads.
   */
  static decrypt(encrypted: string): any {
    if (!encrypted || typeof encrypted !== 'string') {
      return null;
    }

    const trimmed = encrypted.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      Logger.warn('[SecurityService] Rejected unencrypted plaintext JSON in decrypt()');
      throw new Error('Unencrypted plaintext JSON is not accepted by SecurityService.decrypt');
    }

    try {
      const decrypted = encrypted.startsWith('AG1:')
        ? aes256GcmDecrypt(encrypted, this.SECRET_KEY)
        : symmetricDecrypt(encrypted, this.SECRET_KEY);
      if (!decrypted) {
        throw new Error('Empty decrypted payload or key mismatch');
      }
      Logger.debug('Data decrypted successfully');
      return JSON.parse(decrypted);
    } catch (error: any) {
      Logger.warn(
        '[SecurityService] Decryption or UTF-8 decode failed (stale key or legacy format)',
        error?.message || error
      );
      throw error;
    }
  }

  /**
   * Async Web Crypto AES-256-GCM decryption (`AG1:`).
   */
  static async decryptAsync(encrypted: string): Promise<any> {
    if (!encrypted || typeof encrypted !== 'string') {
      return null;
    }
    const trimmed = encrypted.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      throw new Error('Unencrypted plaintext JSON is not accepted by SecurityService.decryptAsync');
    }
    const decrypted = await aes256GcmDecryptAsync(encrypted, this.SECRET_KEY);
    if (!decrypted) {
      throw new Error('Empty decrypted payload or key mismatch');
    }
    return JSON.parse(decrypted);
  }

  static generateToken(payload: Record<string, any>, expiresInSeconds = 30 * 24 * 60 * 60): string {
    try {
      const header = {
        alg: 'HS256',
        typ: 'JWT',
      };

      const now = Math.floor(Date.now() / 1000);
      const token = {
        header,
        payload: {
          ...payload,
          iat: now,
          exp: now + expiresInSeconds,
        },
      };

      const encoded = bytesToBase64(new TextEncoder().encode(JSON.stringify(token)));
      const signature = hmacSha256Hex(encoded, this.SECRET_KEY);

      Logger.debug('Token generated successfully');
      return `${encoded}.${signature}`;
    } catch (error: any) {
      Logger.warn('[SecurityService] Token generation failed:', error?.message || error);
      throw error;
    }
  }

  static verifyToken(token: string, { ignoreExpiration = false } = {}): any {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token: token must be a non-empty string');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid token structure: missing signature part');
    }

    const [encoded, signature] = parts;
    const expectedSignature = hmacSha256Hex(encoded, this.SECRET_KEY);

    if (!constantTimeEqual(String(signature || '').toLowerCase(), expectedSignature.toLowerCase())) {
      Logger.warn('[SecurityService] Invalid token signature detected');
      throw new Error('Invalid token signature');
    }

    let decoded: any;
    try {
      const jsonStr = new TextDecoder().decode(base64ToBytes(encoded));
      decoded = JSON.parse(jsonStr);
    } catch {
      throw new Error('Invalid token payload: base64 decode or JSON parse failed');
    }

    if (!decoded || typeof decoded !== 'object' || !decoded.payload) {
      throw new Error('Invalid token payload structure');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (!ignoreExpiration && decoded.payload.exp && decoded.payload.exp < nowSec) {
      Logger.info('[SecurityService] Session token expired naturally');
      const error = new Error('Token expired') as Error & { isExpired?: boolean };
      error.name = 'TokenExpiredError';
      error.isExpired = true;
      throw error;
    }

    Logger.debug('Token verified successfully');
    return decoded.payload;
  }

  static generateId(): string {
    return this.generateRandomHex(12);
  }

  static saveSecure(key: string, data: unknown): void {
    try {
      const encrypted = this.encrypt(data);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      Logger.error(`Failed to save secure item: ${key}`, error);
    }
  }

  static getSecure(key: string): any {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return this.decrypt(raw);
    } catch {
      Logger.warn(`[SecurityService] Resetting unreadable or legacy secure item for key: ${key}`);
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore storage errors
      }
      return null;
    }
  }

  static removeSecure(key: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      Logger.warn(`Failed to remove secure item: ${key}`, error);
    }
  }

  static saveSessionSecure(key: string, data: unknown): void {
    try {
      if (typeof sessionStorage === 'undefined') return;
      const encrypted = this.encrypt(data);
      sessionStorage.setItem(key, encrypted);
    } catch (error) {
      Logger.error(`Failed to save secure session item: ${key}`, error);
    }
  }

  static getSessionSecure(key: string): any {
    try {
      if (typeof sessionStorage === 'undefined') return null;
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const trimmed = raw.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object' && typeof parsed.token === 'string') {
          const verifiedPayload = this.verifyToken(parsed.token);
          return { ...parsed, payload: verifiedPayload };
        }
        return parsed;
      }
      return this.decrypt(raw);
    } catch {
      return null;
    }
  }

  /**
   * Standard PBKDF2-HMAC-SHA256 PIN hashing (600,000 iterations + 128-bit random salt).
   */
  static hashPin(pin: string): string {
    if (!pin) return '';
    const salt = this.generateRandomHex(16);
    const keyHex = pbkdf2Sha256Hex(pin, salt, PBKDF2_STANDARD_ITERATIONS, 32);
    return `pbkdf2:v1:${salt}:${PBKDF2_STANDARD_ITERATIONS}:${keyHex}`;
  }

  /**
   * Async Web Crypto PBKDF2-HMAC-SHA256 PIN hashing (600,000 iterations).
   */
  static async hashPinAsync(pin: string): Promise<string> {
    if (!pin) return '';
    return this.hashPassword(pin, null, PBKDF2_STANDARD_ITERATIONS);
  }

  /**
   * Constant-time verification of PIN against PBKDF2 hash (`pbkdf2:v1:<salt>:<iterations>:<hashHex>`).
   */
  static verifyPIN(enteredPIN: string, storedPIN: string): boolean {
    if (!enteredPIN || !storedPIN) return false;
    if (typeof storedPIN === 'string' && storedPIN.startsWith('pbkdf2:v1:')) {
      const parts = storedPIN.split(':');
      if (parts.length === 5) {
        const [, , saltHex, iterStr, expectedHashHex] = parts;
        const iterations = parseInt(iterStr, 10) || PBKDF2_STANDARD_ITERATIONS;
        const keyHex = pbkdf2Sha256Hex(enteredPIN, saltHex, iterations, 32);
        return constantTimeEqual(keyHex.toLowerCase(), expectedHashHex.toLowerCase());
      }
    }
    return false;
  }

  static async verifyPINAsync(enteredPIN: string, storedPIN: string): Promise<boolean> {
    if (!enteredPIN || !storedPIN || typeof storedPIN !== 'string') return false;
    if (!storedPIN.startsWith('pbkdf2:v1:')) return false;
    return this.comparePassword(enteredPIN, storedPIN);
  }

  static getDeviceFingerprint(): string {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'node';
    const language = typeof navigator !== 'undefined' ? navigator.language : 'en';
    const timezone =
      typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

    const fingerprint = `${userAgent}|${language}|${timezone}`;
    return sha256Hex(fingerprint);
  }
}
