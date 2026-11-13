// vaultService.js - Coffre-fort Chiffré Zero-Knowledge
// Architecture : Master PIN = Clé cryptographique unique (PBKDF2 600 000 itérations + AES-256-GCM)
// Données au repos chiffrées sans aucun mot de passe ni sel statique stocké dans le code source.
// Master PIN conservé uniquement en mémoire vive (RAM) et coffre persisté dans IndexedDB + cache chiffré.

import { symmetricEncrypt, symmetricDecrypt } from '../core/security/nativeCrypto';
import { indexedDBService } from '../infrastructure/database/IndexedDBService';
import { SecurityService } from '../core/security/SecurityService';
import { Logger } from '../core/logger/LoggerService';

const VAULT_SALT_KEY = 'gmao_vault_salt_v2';
const VAULT_CIPHER_KEY = 'gmao_vault_cipher_v2';
const VAULT_IV_KEY = 'gmao_vault_iv_v2';
const VAULT_PIN_HASH_KEY = 'gmao_vault_pin_hash_v2';
const IDB_VAULT_KEY = 'gmao_encrypted_vault_record_v2';

const PBKDF2_STANDARD_ITERATIONS = 600000;
const PBKDF2_LEGACY_ITERATIONS = 100000;

const enc = new TextEncoder();
const dec = new TextDecoder();

// Stockage exclusif du Master PIN et de son empreinte en mémoire vive (RAM) — Jamais dans localStorage
let masterPinInMemory = null;
let masterPinHashInMemory = null;

export function setMasterPin(pin) {
  if (!pin || typeof pin !== 'string') {
    masterPinInMemory = null;
    return;
  }
  masterPinInMemory = pin.trim();
  // Nettoyage systématique de toute trace historique dans localStorage
  SecurityService.removeSecure('gmao_admin_pin');
}

export function getMasterPin() {
  if (!masterPinInMemory) {
    throw new Error('Master PIN not set in memory');
  }
  return masterPinInMemory;
}

export function clearMasterPin() {
  masterPinInMemory = null;
}

export function hasMasterPinInMemory() {
  return Boolean(masterPinInMemory);
}

export function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

// Génération aléatoire d'un sel cryptographique dynamique (non présent dans le code)
export function generateRandomSalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufToBase64(salt);
}

function readVaultStorageString(key: string): string | null {
  const decrypted = SecurityService.getSecure(key);
  if (typeof decrypted === 'string' && decrypted.trim().length > 0) {
    return decrypted;
  }
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key);
    if (raw && !raw.startsWith('NC2:') && !raw.startsWith('NC1:')) {
      SecurityService.saveSecure(key, raw);
      return raw;
    }
  }
  return null;
}

export function getOrCreateSalt() {
  let saltB64 = readVaultStorageString(VAULT_SALT_KEY);
  if (!saltB64) {
    saltB64 = generateRandomSalt();
    SecurityService.saveSecure(VAULT_SALT_KEY, saltB64);
  }
  return saltB64;
}

// Dérivation de clé AES-256-GCM depuis le PIN + Sel via PBKDF2 (600 000 itérations SHA-256)
export async function deriveKeyFromPin(pin, saltB64, iterations = PBKDF2_STANDARD_ITERATIONS) {
  const saltBuf = base64ToBuf(saltB64);
  const pinKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations,
      hash: 'SHA-256',
    },
    pinKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return aesKey;
}

// Chiffrement intégral du coffre en AES-256-GCM (Web Crypto API + persistance IndexedDB)
export async function encryptVault(vaultObject, pin) {
  const cleanPin = String(pin || '').trim();
  setMasterPin(cleanPin);
  const saltB64 = getOrCreateSalt();
  const key = await deriveKeyFromPin(cleanPin, saltB64, PBKDF2_STANDARD_ITERATIONS);
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12 octets standards pour AES-GCM
  const dataBuf = enc.encode(JSON.stringify(vaultObject));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuf
  );
  const cipherB64 = bufToBase64(cipherBuf);
  const ivB64 = bufToBase64(iv);
  SecurityService.saveSecure(VAULT_CIPHER_KEY, cipherB64);
  SecurityService.saveSecure(VAULT_IV_KEY, ivB64);
  SecurityService.removeSecure('gmao_admin_pin');

  // Persistance sécurisée de l'enveloppe chiffrée dans IndexedDB
  await indexedDBService.setItem(IDB_VAULT_KEY, {
    cipherB64,
    ivB64,
    saltB64,
    updatedAt: Date.now(),
  });

  return { cipherB64, ivB64, saltB64 };
}

// Déchiffrement du coffre-fort : échec si Master PIN invalide
export async function decryptVault(pin) {
  const cleanPin = String(pin || '').trim();
  let cipherB64 = readVaultStorageString(VAULT_CIPHER_KEY);
  let ivB64 = readVaultStorageString(VAULT_IV_KEY);
  let saltB64 = readVaultStorageString(VAULT_SALT_KEY);

  // Fallback sur IndexedDB si localStorage a été nettoyé
  if (!cipherB64 || !ivB64 || !saltB64) {
    const idbRecord = await indexedDBService.getItem(IDB_VAULT_KEY, null);
    if (idbRecord && idbRecord.cipherB64 && idbRecord.ivB64 && idbRecord.saltB64) {
      cipherB64 = idbRecord.cipherB64;
      ivB64 = idbRecord.ivB64;
      saltB64 = idbRecord.saltB64;
      SecurityService.saveSecure(VAULT_CIPHER_KEY, cipherB64);
      SecurityService.saveSecure(VAULT_IV_KEY, ivB64);
      SecurityService.saveSecure(VAULT_SALT_KEY, saltB64);
    }
  }

  if (!cipherB64 || !ivB64 || !saltB64) {
    throw new Error('Le coffre-fort est inexistant. Veuillez d\'abord définir un Master PIN.');
  }

  const cipherBuf = base64ToBuf(cipherB64);
  const ivBuf = new Uint8Array(base64ToBuf(ivB64));

  // 1. Try modern 600,000 iterations
  try {
    const key = await deriveKeyFromPin(cleanPin, saltB64, PBKDF2_STANDARD_ITERATIONS);
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuf },
      key,
      cipherBuf
    );
    const json = dec.decode(plainBuf);
    setMasterPin(cleanPin);
    return JSON.parse(json);
  } catch {
    // 2. Fallback to legacy 100,000 iterations if existing vault was created with earlier version
    try {
      const legacyKey = await deriveKeyFromPin(cleanPin, saltB64, PBKDF2_LEGACY_ITERATIONS);
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuf },
        legacyKey,
        cipherBuf
      );
      const json = dec.decode(plainBuf);
      const parsed = JSON.parse(json);
      // Seamlessly upgrade vault to 600,000 iterations in the background
      await encryptVault(parsed, cleanPin);
      setMasterPin(cleanPin);
      return parsed;
    } catch {
      throw new Error('Master PIN incorrect ou échec du déchiffrement du coffre-fort (AES-256-GCM).');
    }
  }
}

export const PROHIBITED_TRIVIAL_PINS = new Set([
  '000000',
  '111111',
  '222222',
  '333333',
  '444444',
  '555555',
  '666666',
  '777777',
  '888888',
  '999999',
  '123456',
  '654321',
  '12345678',
  '1234',
  '0000',
  'admin',
  'magasinier',
  'viewer',
  'tech',
  'password',
]);

/**
 * SEC-HARDENING-P1 (Batch D): Validates a newly set or rotated Master PIN.
 * - Rejects trivial / repetitive PINs (000000, 123456, 111111, 1234, admin...)
 * - Requires >= 6 digits for numeric PINs, or >= 8 chars for alphanumeric PINs.
 * - Existing vaults remain verifiable without breaking backward compatibility.
 */
export function validateMasterPinPolicy(pin: unknown): string {
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) {
    throw new Error('Veuillez saisir un Master PIN.');
  }
  if (PROHIBITED_TRIVIAL_PINS.has(cleanPin.toLowerCase()) || /^(\d)\1+$/.test(cleanPin)) {
    throw new Error(
      'Ce code Master PIN est trop trivial ou interdit (ex: 000000, 123456, 111111, 1234, admin). Veuillez choisir un PIN robuste.'
    );
  }
  const isDigitsOnly = /^\d+$/.test(cleanPin);
  if (isDigitsOnly && cleanPin.length < 6) {
    throw new Error('Le nouveau Master PIN numérique doit comporter au moins 6 chiffres.');
  }
  if (!isDigitsOnly && cleanPin.length < 8) {
    throw new Error('Le nouveau Master PIN alphanumérique doit comporter au moins 8 caractères.');
  }
  return cleanPin;
}

// Rotation et changement sécurisé du Master PIN avec régénération complète des clés
export async function changeMasterPin(currentPin, newPin) {
  const cleanNewPin = validateMasterPinPolicy(newPin);
  // 1. Déchiffrer avec l'ancien PIN pour valider l'accès
  let vaultData;
  if (isVaultExists()) {
    vaultData = await decryptVault(currentPin);
  } else {
    vaultData = createEmptyVault();
  }
  // 2. Générer un nouveau sel dynamique
  const newSaltB64 = generateRandomSalt();
  SecurityService.saveSecure(VAULT_SALT_KEY, newSaltB64);

  // 3. Dériver la nouvelle clé AES-256-GCM
  const newKey = await deriveKeyFromPin(cleanNewPin, newSaltB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dataBuf = enc.encode(JSON.stringify(vaultData));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    newKey,
    dataBuf
  );
  const cipherB64 = bufToBase64(cipherBuf);
  const ivB64 = bufToBase64(iv);
  SecurityService.saveSecure(VAULT_CIPHER_KEY, cipherB64);
  SecurityService.saveSecure(VAULT_IV_KEY, ivB64);
  SecurityService.removeSecure('gmao_admin_pin');

  await indexedDBService.setItem(IDB_VAULT_KEY, {
    cipherB64,
    ivB64,
    saltB64: newSaltB64,
    updatedAt: Date.now(),
  });

  // 4. Mettre à jour le PIN en mémoire et le hash dans IndexedDB
  setMasterPin(cleanNewPin);
  await setPinHash(cleanNewPin);

  return { success: true, message: 'Master PIN renouvelé et coffre rechiffré avec succès en AES-256-GCM.' };
}

export function isVaultExists() {
  return Boolean(readVaultStorageString(VAULT_CIPHER_KEY));
}

// Hachage SHA-256 du PIN pour validation rapide
export async function hashPinSHA256(pin) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(String(pin || '').trim()));
  return bufToBase64(buf);
}

export async function setPinHash(pin) {
  const cleanPin = String(pin || '').trim();
  setMasterPin(cleanPin);
  const hash = await hashPinSHA256(cleanPin);
  masterPinHashInMemory = hash;
  // Supprimer toute trace du hash de PIN dans localStorage (protection anti-XSS / anti-brute-force)
  SecurityService.removeSecure(VAULT_PIN_HASH_KEY);
  SecurityService.removeSecure('gmao_admin_pin');
  await indexedDBService.setItem(VAULT_PIN_HASH_KEY, hash);
  return hash;
}

export async function verifyPinHash(pin) {
  const cleanPin = String(pin || '').trim();
  if (masterPinInMemory && cleanPin === masterPinInMemory) {
    return true;
  }
  let stored = masterPinHashInMemory;
  if (!stored) {
    stored = await indexedDBService.getItem(VAULT_PIN_HASH_KEY, null);
  }
  if (!stored && typeof localStorage !== 'undefined') {
    stored = localStorage.getItem(VAULT_PIN_HASH_KEY);
    if (stored) {
      // Migration automatique vers IndexedDB et suppression de localStorage
      masterPinHashInMemory = stored;
      await indexedDBService.setItem(VAULT_PIN_HASH_KEY, stored);
      localStorage.removeItem(VAULT_PIN_HASH_KEY);
    }
  }
  if (!stored) {
    // Si aucun hash séparé n'existe mais que le coffre AES-GCM existe, tenter de déchiffrer le coffre
    if (isVaultExists()) {
      try {
        await decryptVault(cleanPin);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
  const hash = await hashPinSHA256(cleanPin);
  const isValid = hash === stored;
  if (isValid) {
    setMasterPin(cleanPin);
  }
  return isValid;
}

export function createEmptyVault() {
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    accounts: [],
  };
}

function resolveSymmetricKey(password) {
  if (password) return password;
  if (import.meta.env.VITE_CRYPTO_KEY) return import.meta.env.VITE_CRYPTO_KEY;
  if (import.meta.env.PROD || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production')) {
    Logger.error('VITE_CRYPTO_KEY is missing in production — using generated salt.', null, 'vaultService');
    return getOrCreateSalt();
  }
  Logger.warn('VITE_CRYPTO_KEY missing in development — using locally generated salt.', null, 'vaultService');
  return getOrCreateSalt();
}

export function encrypt(text, password) {
  const key = resolveSymmetricKey(password);
  if (!key) {
    throw new Error('[vaultService] Encryption aborted: symmetric key is null or empty');
  }
  try {
    return symmetricEncrypt(String(text), key);
  } catch (err) {
    Logger.error('encrypt failed:', err, 'vaultService');
    throw err;
  }
}

export function decrypt(cipher, password) {
  try {
    if (!cipher || typeof cipher !== 'string') return cipher;
    // Backward compatibility for legacy prefixed cipher strings
    if (cipher.startsWith('enc:')) {
      const parts = cipher.split(':');
      return decodeURIComponent(atob(parts[1]));
    }
    const key = resolveSymmetricKey(password);
    const decrypted = symmetricDecrypt(cipher, key);
    return decrypted || cipher;
  } catch {
    return cipher;
  }
}

export const vaultService = {
  encrypt,
  decrypt,
  generateRandomSalt,
  getOrCreateSalt,
  deriveKeyFromPin,
  encryptVault,
  decryptVault,
  isVaultExists,
  hashPinSHA256,
  setPinHash,
  verifyPinHash,
  changeMasterPin,
  validateMasterPinPolicy,
  createEmptyVault,
  setMasterPin,
  getMasterPin,
  clearMasterPin,
  hasMasterPinInMemory,
  bufToBase64,
  base64ToBuf,
  isWebCryptoSupported: () => typeof window !== 'undefined' && !!(window.crypto && window.crypto.subtle)
};

export default vaultService;
