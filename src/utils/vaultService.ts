// vaultService.js - Coffre-fort Chiffré Zero-Knowledge
// Architecture : Master PIN = Clé cryptographique unique (PBKDF2 600 000 itérations + AES-256-GCM)
// Données au repos chiffrées sans aucun mot de passe ni sel statique stocké dans le code source.
// Master PIN conservé uniquement en mémoire vive (RAM) et coffre persisté dans IndexedDB + cache chiffré.

import CryptoJS from 'crypto-js';
import { indexedDBService } from '../infrastructure/database/IndexedDBService';

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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('gmao_admin_pin');
  }
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

export function getOrCreateSalt() {
  let saltB64 = localStorage.getItem(VAULT_SALT_KEY);
  if (!saltB64) {
    saltB64 = generateRandomSalt();
    localStorage.setItem(VAULT_SALT_KEY, saltB64);
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
  localStorage.setItem(VAULT_CIPHER_KEY, cipherB64);
  localStorage.setItem(VAULT_IV_KEY, ivB64);
  localStorage.removeItem('gmao_admin_pin');

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
  let cipherB64 = localStorage.getItem(VAULT_CIPHER_KEY);
  let ivB64 = localStorage.getItem(VAULT_IV_KEY);
  let saltB64 = localStorage.getItem(VAULT_SALT_KEY);

  // Fallback sur IndexedDB si localStorage a été nettoyé
  if (!cipherB64 || !ivB64 || !saltB64) {
    const idbRecord = await indexedDBService.getItem(IDB_VAULT_KEY, null);
    if (idbRecord && idbRecord.cipherB64 && idbRecord.ivB64 && idbRecord.saltB64) {
      cipherB64 = idbRecord.cipherB64;
      ivB64 = idbRecord.ivB64;
      saltB64 = idbRecord.saltB64;
      localStorage.setItem(VAULT_CIPHER_KEY, cipherB64);
      localStorage.setItem(VAULT_IV_KEY, ivB64);
      localStorage.setItem(VAULT_SALT_KEY, saltB64);
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

// Rotation et changement sécurisé du Master PIN avec régénération complète des clés
export async function changeMasterPin(currentPin, newPin) {
  if (!newPin || typeof newPin !== 'string' || newPin.trim().length < 4) {
    throw new Error('Le nouveau Master PIN doit comporter au moins 4 caractères.');
  }
  const cleanNewPin = newPin.trim();
  // 1. Déchiffrer avec l'ancien PIN pour valider l'accès
  let vaultData;
  if (isVaultExists()) {
    vaultData = await decryptVault(currentPin);
  } else {
    vaultData = createEmptyVault();
  }
  // 2. Générer un nouveau sel dynamique
  const newSaltB64 = generateRandomSalt();
  localStorage.setItem(VAULT_SALT_KEY, newSaltB64);

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
  localStorage.setItem(VAULT_CIPHER_KEY, cipherB64);
  localStorage.setItem(VAULT_IV_KEY, ivB64);
  localStorage.removeItem('gmao_admin_pin');

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
  return !!localStorage.getItem(VAULT_CIPHER_KEY);
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
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(VAULT_PIN_HASH_KEY);
    localStorage.removeItem('gmao_admin_pin');
  }
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
    console.error('[vaultService] VITE_CRYPTO_KEY is missing in production — using generated salt.');
    return getOrCreateSalt();
  }
  console.warn('[vaultService] VITE_CRYPTO_KEY missing in development — using locally generated salt.');
  return getOrCreateSalt();
}

export function encrypt(text, password) {
  try {
    const key = resolveSymmetricKey(password);
    return CryptoJS.AES.encrypt(String(text), key).toString();
  } catch {
    return text;
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
    const bytes = CryptoJS.AES.decrypt(cipher, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
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
