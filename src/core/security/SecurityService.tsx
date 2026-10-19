import CryptoJS from 'crypto-js';
import { Logger } from '../logger/LoggerService';

/**
 * @file SecurityService.js
 * @module core/security/SecurityService
 * @description
 * خدمة التشفير وتمرير الرموز والحفاظ على الأمان والتوقيع الرقمي (AES-256 / Web Crypto PBKDF2-SHA256 / HMAC-SHA256 / Fingerprinting).
 * 
 * الوظائف الأمنية المقدمة:
 * - 🔑 تجشيم كلمة السر باستخدام PBKDF2-SHA256 مع 100,000 تكرار و Salt عشوائي 128-bit.
 * - 🔒 تشفير وفك تشفير البيانات الحساسة عبر AES-256.
 * - 🎟️ توليد والتحقق من رموز التوثيق الموقعة بـ HMAC-SHA256.
 * - 🆔 استخراج بصمة رقمية فريدة للجهاز (Device Fingerprint).
 */
export class SecurityService {
  static _volatileInstanceKey = null;
  static _warnedMissingKey = false;

  /**
   * المفتاح السري الديناميكي للتشفير والتوقيع الرقمي
   * @returns {string}
   */
  static get SECRET_KEY() {
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
        console.error(
          '[SecurityService] VITE_SECRET_KEY is missing in production environment (.env.local). Falling back to generated instance key.'
        );
      } else {
        console.warn(
          '[SecurityService] VITE_SECRET_KEY missing in development — using locally generated random key.'
        );
      }
    }

    try {
      let instanceKey = localStorage.getItem('_gmao_sec_instance_key');
      if (!instanceKey) {
        instanceKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
        localStorage.setItem('_gmao_sec_instance_key', instanceKey);
      }
      return instanceKey;
    } catch {
      if (!this._volatileInstanceKey) {
        this._volatileInstanceKey = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
      }
      return this._volatileInstanceKey;
    }
  }

  /**
   * تجشيم (Hash) كلمة السر باستخدام خوارزمية Web Crypto API (PBKDF2-SHA256 مع Salt عشوائي 128-bit و 100,000 تكرار)
   * يضمن الأمان التام دون استخدام مكتبات خارجية غير متزامنة ودون إبطاء خيط المتصفح.
   * 
   * @param {string} password - كلمة السر المراد تجشيمها
   * @param {string} [saltHex] - ملح اختياري (يتم توليده عشوائياً إذا لم يمرر)
   * @param {number} [iterations=100000] - عدد تكرارات PBKDF2
   * @returns {Promise<string>} نص التجشيم بصيغة `pbkdf2:v1:${saltHex}:${iterations}:${hashHex}`
   */
  static async hashPassword(password, saltHex = null, iterations = 100000) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Mot de passe invalide pour le hachage.');
      }

      const enc = new TextEncoder();
      const saltBytes = saltHex
        ? new Uint8Array(saltHex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
        : (typeof crypto !== 'undefined' && crypto.getRandomValues
            ? crypto.getRandomValues(new Uint8Array(16))
            : new Uint8Array(CryptoJS.lib.WordArray.random(16).words.flatMap((w) => [(w >> 24) & 0xff, (w >> 16) & 0xff, (w >> 8) & 0xff, w & 0xff])));

      const activeSaltHex = Array.from(saltBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      // 1. Web Crypto Native SubtleCrypto (Fast, hardware-accelerated, zero-thread blocking)
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
            salt: saltBytes,
            iterations: iterations,
            hash: 'SHA-256'
          },
          keyMaterial,
          256
        );
        const hashHex = Array.from(new Uint8Array(derivedBits))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        return `pbkdf2:v1:${activeSaltHex}:${iterations}:${hashHex}`;
      }

      // 2. CryptoJS fallback if WebCrypto is unavailable in testing/legacy env
      const derived = CryptoJS.PBKDF2(password, CryptoJS.enc.Hex.parse(activeSaltHex), {
        keySize: 256 / 32,
        iterations: iterations,
        hasher: CryptoJS.algo.SHA256
      });
      return `pbkdf2:v1:${activeSaltHex}:${iterations}:${derived.toString(CryptoJS.enc.Hex)}`;
    } catch (error) {
      Logger.error('Password hashing failed', error);
      throw error;
    }
  }

  /**
   * المقارنة الآمنة بين كلمة السر النصية والرمز المجشم المخزن (Web Crypto PBKDF2 أو Legacy Bcrypt/SHA-256)
   * 
   * @param {string} password - كلمة السر النصية المدخلة
   * @param {string} storedHash - الرمز المجشم المخزن
   * @returns {Promise<boolean>} true إذا كانت كلمة السر مطابقة
   */
  static async comparePassword(password, storedHash) {
    try {
      if (!password || !storedHash || typeof storedHash !== 'string') return false;

      // 1. Modern Web Crypto PBKDF2 format: `pbkdf2:v1:salt:iterations:hash`
      if (storedHash.startsWith('pbkdf2:v1:')) {
        const parts = storedHash.split(':');
        if (parts.length === 5) {
          const [, , saltHex, iterStr, expectedHashHex] = parts;
          const iterations = parseInt(iterStr, 10) || 100000;
          const calculated = await this.hashPassword(password, saltHex, iterations);
          const calculatedHashHex = calculated.split(':')[4];
          return calculatedHashHex === expectedHashHex;
        }
      }

      // 2. Fallback for legacy bcrypt format indicator (returns false as bcrypt is removed from client-side for zero-trust security)
      if (storedHash.startsWith('$2')) {
        return false;
      }

      // 3. Fallback for plain SHA-256 or unhashed legacy development passwords
      if (storedHash.length === 64 && /^[0-9a-f]+$/i.test(storedHash)) {
        return CryptoJS.SHA256(password).toString() === storedHash;
      }

      return password === storedHash;
    } catch (error) {
      Logger.error('Password comparison failed', error);
      return false;
    }
  }

  /**
   * فحص ما إذا كان التشفير المخزن قديماً ويحتاج للترقية التلقائية إلى Web Crypto PBKDF2
   * @param {string} hash
   * @returns {boolean}
   */
  static isLegacyHash(hash) {
    if (!hash || typeof hash !== 'string') return false;
    return !hash.startsWith('pbkdf2:v1:');
  }

  /**
   * تشفير البيانات باستخدام خوارزمية AES-256
   * 
   * @param {any} data - البيانات المراد تشفيرها (سيتم تحويلها لـ JSON)
   * @returns {string} النص المشفر في صيغة String Base64
   * @throws {Error} عند فشل التشفير
   */
  static encrypt(data) {
    try {
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(data),
        this.SECRET_KEY
      ).toString();
      Logger.debug('Data encrypted successfully');
      return encrypted;
    } catch (error) {
      Logger.error('Encryption failed', error);
      throw error;
    }
  }

  /**
   * فك تشفير النص المشفر باستخدام AES-256 لاسترجاع البيانات الأصلية
   * 
   * @param {string} encrypted - النص المشفر
   * @returns {any} البيانات الأصلية المفكوكة
   * @throws {Error} عند فشل فك التشفير أو التوقيع غير الصحيح
   */
  static decrypt(encrypted) {
    if (!encrypted || typeof encrypted !== 'string') {
      return null;
    }

    const trimmed = encrypted.trim();
    // 1. If the stored payload is already plain JSON (legacy or unencrypted write), parse directly without AES decryption
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Not valid plain JSON; proceed to AES decryption attempt
      }
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encrypted, this.SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        throw new Error('Empty decrypted payload or key mismatch');
      }
      Logger.debug('Data decrypted successfully');
      return JSON.parse(decrypted);
    } catch (error) {
      Logger.warn('[SecurityService] Decryption or UTF-8 decode failed (stale key or legacy format)', error?.message || error);
      throw error;
    }
  }

  /**
   * توليد توكن توثيق آمن موثق بتوقيع HMAC-SHA256 (مشابه لـ JWT)
   * 
   * @param {Object} payload - البيانات المراد تضمينها بالرمز
   * @param {number} [expiresInSeconds=2592000] - مدة صلاحية الرمز بالثواني (الافتراضي: 30 يوماً لدعم بيئات الصيانة بدون انقطاع)
   * @returns {string} الرمز المولد بالصيغة `encodedHeaderPayload.signature`
   * @throws {Error} عند فشل عملية الإنشاء
   */
  static generateToken(payload, expiresInSeconds = 30 * 24 * 60 * 60) {
    try {
      const header = {
        alg: 'HS256',
        typ: 'JWT'
      };

      const now = Math.floor(Date.now() / 1000);
      const token = {
        header,
        payload: {
          ...payload,
          iat: now,
          exp: now + expiresInSeconds
        }
      };

      const encoded = btoa(JSON.stringify(token));
      const signature = CryptoJS.HmacSHA256(encoded, this.SECRET_KEY).toString();
      
      Logger.debug('Token generated successfully');
      return `${encoded}.${signature}`;
    } catch (error) {
      Logger.warn('[SecurityService] Token generation failed:', error?.message || error);
      throw error;
    }
  }

  /**
   * فحص وتأكيد توقيع رمز التوثيق وصلاحية تاريخ الانتهاء
   * 
   * @param {string} token - الرمز المراد فصحه
   * @param {Object} [options] - خيارات التحقق
   * @param {boolean} [options.ignoreExpiration=false] - تجاهل انتهاء الصلاحية لفحص المحتوى فقط
   * @returns {Object} الحمولة الأصلية المفككة
   * @throws {Error} إذا كان التوقيع ملغياً أو صلاحية الرمز منتهية
   */
  static verifyToken(token, { ignoreExpiration = false } = {}) {
    if (!token || typeof token !== 'string') {
      throw new Error('Invalid token: token must be a non-empty string');
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new Error('Invalid token structure: missing signature part');
    }

    const [encoded, signature] = parts;
    const expectedSignature = CryptoJS.HmacSHA256(encoded, this.SECRET_KEY).toString();
    
    if (signature !== expectedSignature) {
      Logger.warn('[SecurityService] Invalid token signature detected');
      throw new Error('Invalid token signature');
    }

    let decoded;
    try {
      decoded = JSON.parse(atob(encoded));
    } catch {
      throw new Error('Invalid token payload: base64 decode or JSON parse failed');
    }

    if (!decoded || typeof decoded !== 'object' || !decoded.payload) {
      throw new Error('Invalid token payload structure');
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (!ignoreExpiration && decoded.payload.exp && decoded.payload.exp < nowSec) {
      Logger.info('[SecurityService] Session token expired naturally');
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';
      error.isExpired = true;
      throw error;
    }

    Logger.debug('Token verified successfully');
    return decoded.payload;
  }

  /**
   * توليد معرف عشوائي فريد بالقطع والنص الألفابيتي
   * 
   * @returns {string} المعرف العشوائي المولد
   */
  static generateId() {
    return Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Save encrypted payload to localStorage
   */
  static saveSecure(key, data) {
    try {
      const encrypted = this.encrypt(data);
      localStorage.setItem(key, encrypted);
    } catch (error) {
      Logger.error(`Failed to save secure item: ${key}`, error);
    }
  }

  /**
   * Retrieve and decrypt payload from localStorage
   */
  static getSecure(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;

      const trimmed = raw.trim();
      // Auto-migrate legacy plain JSON to encrypted storage
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          this.saveSecure(key, parsed);
          return parsed;
        } catch {
          // Proceed to normal decrypt
        }
      }

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

  /**
   * Fast PBKDF2 PIN hashing
   */
  static hashPin(pin) {
    if (!pin) return '';
    const salt = CryptoJS.lib.WordArray.random(128 / 8).toString(CryptoJS.enc.Hex);
    const key = CryptoJS.PBKDF2(pin, CryptoJS.enc.Hex.parse(salt), {
      keySize: 256 / 32,
      iterations: 10000,
      hasher: CryptoJS.algo.SHA256,
    });
    return `pbkdf2:v1:${salt}:10000:${key.toString(CryptoJS.enc.Hex)}`;
  }

  /**
   * Verify PIN against PBKDF2 hash
   */
  static verifyPIN(enteredPIN, storedPIN) {
    if (!enteredPIN || !storedPIN) return false;
    if (enteredPIN === storedPIN) return true;
    if (typeof storedPIN === 'string' && storedPIN.startsWith('pbkdf2:v1:')) {
      const parts = storedPIN.split(':');
      if (parts.length === 5) {
        const [, , saltHex, iterStr, expectedHashHex] = parts;
        const iterations = parseInt(iterStr, 10) || 10000;
        const key = CryptoJS.PBKDF2(enteredPIN, CryptoJS.enc.Hex.parse(saltHex), {
          keySize: 256 / 32,
          iterations,
          hasher: CryptoJS.algo.SHA256,
        });
        return key.toString(CryptoJS.enc.Hex) === expectedHashHex;
      }
    }
    return false;
  }

  /**
   * استخراج البصمة الرقمية للجهاز (Device Fingerprint) باستخدام الخصائص التقنية للمتصفح والتوقيع بـ SHA-256
   * 
   * @returns {string} البصمة المشفرة للجهاز
   */
  static getDeviceFingerprint() {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'node';
    const language = typeof navigator !== 'undefined' ? navigator.language : 'en';
    const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
    
    const fingerprint = `${userAgent}|${language}|${timezone}`;
    return CryptoJS.SHA256(fingerprint).toString();
  }
}
