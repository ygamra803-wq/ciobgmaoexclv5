/**
 * @file nativeCrypto.ts
 * @module core/security/nativeCrypto
 * @description
 * Zero-dependency cryptographic primitives (FIPS 180-4 SHA-256, RFC 2104 HMAC-SHA256,
 * RFC 2898 PBKDF2-HMAC-SHA256, CSPRNG via Web Crypto API, and Authenticated Symmetric Cipher).
 * Replaces deprecated `crypto-js` across browser and Node/Vitest environments.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const enc = new TextEncoder();
const dec = new TextDecoder();

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
  const len = Math.floor(clean.length / 2);
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Constant-time string comparison over UTF-8 bytes.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bytesA = enc.encode(String(a ?? ''));
  const bytesB = enc.encode(String(b ?? ''));
  const maxLen = Math.max(bytesA.length, bytesB.length);
  let diff = bytesA.length ^ bytesB.length;
  for (let i = 0; i < maxLen; i++) {
    const ba = i < bytesA.length ? bytesA[i] : 0;
    const bb = i < bytesB.length ? bytesB[i] : 0;
    diff |= ba ^ bb;
  }
  return diff === 0;
}

export function randomBytes(byteLength = 16): Uint8Array {
  const buf = new Uint8Array(byteLength);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    return crypto.getRandomValues(buf);
  }
  throw new Error('CSPRNG unavailable: crypto.getRandomValues is required.');
}

export function randomBytesHex(byteLength = 16): string {
  return bytesToHex(randomBytes(byteLength));
}

const SHARED_W = new Uint32Array(64);

/**
 * FIPS 180-4 SHA-256 implementation returning 32-byte Uint8Array
 */
export function sha256Bytes(input: Uint8Array | string): Uint8Array {
  const msg = typeof input === 'string' ? enc.encode(input) : input;
  const bitLen = msg.length * 8;

  const padLen = ((msg.length + 8) >>> 6) + 1;
  const totalWords = padLen * 16;
  const M = new Uint32Array(totalWords);

  for (let i = 0; i < msg.length; i++) {
    M[i >>> 2] |= msg[i] << (24 - (i & 3) * 8);
  }
  M[msg.length >>> 2] |= 0x80 << (24 - (msg.length & 3) * 8);
  M[totalWords - 2] = Math.floor(bitLen / 0x100000000);
  M[totalWords - 1] = bitLen >>> 0;

  let H0 = 0x6a09e667;
  let H1 = 0xbb67ae85;
  let H2 = 0x3c6ef372;
  let H3 = 0xa54ff53a;
  let H4 = 0x510e527f;
  let H5 = 0x9b05688c;
  let H6 = 0x1f83d9ab;
  let H7 = 0x5be0cd19;

  const W = SHARED_W;

  for (let offset = 0; offset < totalWords; offset += 16) {
    for (let t = 0; t < 16; t++) {
      W[t] = M[offset + t];
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
      const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;
    let f = H5;
    let g = H6;
    let h = H7;

    for (let t = 0; t < 64; t++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H0 = (H0 + a) >>> 0;
    H1 = (H1 + b) >>> 0;
    H2 = (H2 + c) >>> 0;
    H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0;
    H5 = (H5 + f) >>> 0;
    H6 = (H6 + g) >>> 0;
    H7 = (H7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  out[0] = (H0 >>> 24) & 0xff; out[1] = (H0 >>> 16) & 0xff; out[2] = (H0 >>> 8) & 0xff; out[3] = H0 & 0xff;
  out[4] = (H1 >>> 24) & 0xff; out[5] = (H1 >>> 16) & 0xff; out[6] = (H1 >>> 8) & 0xff; out[7] = H1 & 0xff;
  out[8] = (H2 >>> 24) & 0xff; out[9] = (H2 >>> 16) & 0xff; out[10] = (H2 >>> 8) & 0xff; out[11] = H2 & 0xff;
  out[12] = (H3 >>> 24) & 0xff; out[13] = (H3 >>> 16) & 0xff; out[14] = (H3 >>> 8) & 0xff; out[15] = H3 & 0xff;
  out[16] = (H4 >>> 24) & 0xff; out[17] = (H4 >>> 16) & 0xff; out[18] = (H4 >>> 8) & 0xff; out[19] = H4 & 0xff;
  out[20] = (H5 >>> 24) & 0xff; out[21] = (H5 >>> 16) & 0xff; out[22] = (H5 >>> 8) & 0xff; out[23] = H5 & 0xff;
  out[24] = (H6 >>> 24) & 0xff; out[25] = (H6 >>> 16) & 0xff; out[26] = (H6 >>> 8) & 0xff; out[27] = H6 & 0xff;
  out[28] = (H7 >>> 24) & 0xff; out[29] = (H7 >>> 16) & 0xff; out[30] = (H7 >>> 8) & 0xff; out[31] = H7 & 0xff;
  return out;
}

export function sha256Hex(input: Uint8Array | string): string {
  return bytesToHex(sha256Bytes(input));
}

/**
 * RFC 2104 HMAC-SHA256 implementation
 */
export function hmacSha256Bytes(message: Uint8Array | string, key: Uint8Array | string): Uint8Array {
  const msgBytes = typeof message === 'string' ? enc.encode(message) : message;
  let keyBytes = typeof key === 'string' ? enc.encode(key) : key;

  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }

  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const k = i < keyBytes.length ? keyBytes[i] : 0;
    ipad[i] = k ^ 0x36;
    opad[i] = k ^ 0x5c;
  }

  const innerInput = new Uint8Array(64 + msgBytes.length);
  innerInput.set(ipad, 0);
  innerInput.set(msgBytes, 64);
  const innerHash = sha256Bytes(innerInput);

  const outerInput = new Uint8Array(64 + 32);
  outerInput.set(opad, 0);
  outerInput.set(innerHash, 64);
  return sha256Bytes(outerInput);
}

export function hmacSha256Hex(message: Uint8Array | string, key: Uint8Array | string): string {
  return bytesToHex(hmacSha256Bytes(message, key));
}

/**
 * RFC 2898 PBKDF2-HMAC-SHA256 implementation
 */
export function pbkdf2Sha256Bytes(
  password: string | Uint8Array,
  salt: string | Uint8Array,
  iterations = 10000,
  dkLen = 32
): Uint8Array {
  const pwdBytes = typeof password === 'string' ? enc.encode(password) : password;
  const saltBytes = typeof salt === 'string' ? enc.encode(salt) : salt;

  let keyBytes = pwdBytes;
  if (keyBytes.length > 64) {
    keyBytes = sha256Bytes(keyBytes);
  }
  const ipad = new Uint8Array(64);
  const opad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const k = i < keyBytes.length ? keyBytes[i] : 0;
    ipad[i] = k ^ 0x36;
    opad[i] = k ^ 0x5c;
  }

  const inner32 = new Uint8Array(96);
  inner32.set(ipad, 0);
  const outer32 = new Uint8Array(96);
  outer32.set(opad, 0);

  const prfVar = (data: Uint8Array): Uint8Array => {
    const inner = new Uint8Array(64 + data.length);
    inner.set(ipad, 0);
    inner.set(data, 64);
    const innerDigest = sha256Bytes(inner);
    outer32.set(innerDigest, 64);
    return sha256Bytes(outer32);
  };

  const prf32 = (data32: Uint8Array): Uint8Array => {
    inner32.set(data32, 64);
    const innerDigest = sha256Bytes(inner32);
    outer32.set(innerDigest, 64);
    return sha256Bytes(outer32);
  };

  const blocks = Math.ceil(dkLen / 32);
  const dk = new Uint8Array(blocks * 32);
  const saltAndBlock = new Uint8Array(saltBytes.length + 4);
  saltAndBlock.set(saltBytes, 0);

  for (let b = 1; b <= blocks; b++) {
    saltAndBlock[saltBytes.length] = (b >>> 24) & 0xff;
    saltAndBlock[saltBytes.length + 1] = (b >>> 16) & 0xff;
    saltAndBlock[saltBytes.length + 2] = (b >>> 8) & 0xff;
    saltAndBlock[saltBytes.length + 3] = b & 0xff;

    let U = prfVar(saltAndBlock);
    const T = new Uint8Array(U);

    for (let i = 1; i < iterations; i++) {
      U = prf32(U);
      for (let j = 0; j < 32; j++) {
        T[j] ^= U[j];
      }
    }
    dk.set(T, (b - 1) * 32);
  }

  return dk.subarray(0, dkLen);
}

export function pbkdf2Sha256Hex(
  password: string | Uint8Array,
  saltHex: string,
  iterations = 10000,
  dkLen = 32
): string {
  return bytesToHex(pbkdf2Sha256Bytes(password, hexToBytes(saltHex), iterations, dkLen));
}

const NC2_PBKDF2_ITERATIONS = 10000;
const NC2_KEY_CACHE_MAX = 64;
const nc2KeyCache = new Map<string, { encKey: Uint8Array; macKey: Uint8Array }>();

function deriveNc2Keys(passphrase: string, salt: Uint8Array): { encKey: Uint8Array; macKey: Uint8Array } {
  const cacheKey = `${passphrase}:${bytesToHex(salt)}`;
  const cached = nc2KeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  const masterPrk = pbkdf2Sha256Bytes(passphrase, salt, NC2_PBKDF2_ITERATIONS, 32);
  const encKey = hmacSha256Bytes('gmao-nc2-enc-key', masterPrk);
  const macKey = hmacSha256Bytes('gmao-nc2-mac-key', masterPrk);
  const entry = { encKey, macKey };
  if (nc2KeyCache.size >= NC2_KEY_CACHE_MAX) {
    const oldestKey = nc2KeyCache.keys().next().value;
    if (oldestKey !== undefined) {
      nc2KeyCache.delete(oldestKey);
    }
  }
  nc2KeyCache.set(cacheKey, entry);
  return entry;
}

/**
 * Authenticated symmetric encryption (CTR-HMAC-SHA256 with random 128-bit salt,
 * 10,000 PBKDF2-HMAC-SHA256 iterations, and domain-separated subkeys).
 * Format: `NC2:<saltB64>:<cipherB64>:<macHex>`
 */
export function symmetricEncrypt(plaintext: string, passphrase: string): string {
  if (!passphrase) {
    throw new Error('Symmetric key is required for encryption.');
  }
  const salt = randomBytes(16);
  const { encKey, macKey } = deriveNc2Keys(passphrase, salt);

  const plainBytes = enc.encode(plaintext);
  const cipherBytes = new Uint8Array(plainBytes.length);

  const counterBlock = new Uint8Array(20);
  counterBlock.set(salt, 0);

  for (let offset = 0, blockIdx = 0; offset < plainBytes.length; offset += 32, blockIdx++) {
    counterBlock[16] = (blockIdx >>> 24) & 0xff;
    counterBlock[17] = (blockIdx >>> 16) & 0xff;
    counterBlock[18] = (blockIdx >>> 8) & 0xff;
    counterBlock[19] = blockIdx & 0xff;

    const keystream = hmacSha256Bytes(counterBlock, encKey);
    const chunkLen = Math.min(32, plainBytes.length - offset);
    for (let i = 0; i < chunkLen; i++) {
      cipherBytes[offset + i] = plainBytes[offset + i] ^ keystream[i];
    }
  }

  const saltB64 = bytesToBase64(salt);
  const cipherB64 = bytesToBase64(cipherBytes);
  const macHex = hmacSha256Hex(`NC2:${saltB64}:${cipherB64}`, macKey);
  return `NC2:${saltB64}:${cipherB64}:${macHex}`;
}

/**
 * Authenticated symmetric decryption supporting `NC2:` and legacy `NC1:` payloads.
 * Returns empty string if authentication or decryption fails.
 */
export function symmetricDecrypt(ciphertext: string, passphrase: string): string {
  if (!ciphertext || typeof ciphertext !== 'string' || !passphrase) {
    return '';
  }

  const isNc2 = ciphertext.startsWith('NC2:');
  const isNc1 = ciphertext.startsWith('NC1:');
  if (!isNc2 && !isNc1) {
    return '';
  }

  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) {
      return '';
    }
    const [, saltB64, cipherB64, macHex] = parts;
    if (!saltB64 || !cipherB64 || !macHex) {
      return '';
    }
    const salt = base64ToBytes(saltB64);
    let encKey: Uint8Array;
    let macKey: Uint8Array;
    let macInput: string;

    if (isNc2) {
      const derived = deriveNc2Keys(passphrase, salt);
      encKey = derived.encKey;
      macKey = derived.macKey;
      macInput = `NC2:${saltB64}:${cipherB64}`;
    } else {
      const keyMaterial = pbkdf2Sha256Bytes(passphrase, salt, 1000, 64);
      encKey = keyMaterial.subarray(0, 32);
      macKey = keyMaterial.subarray(32, 64);
      macInput = `${saltB64}:${cipherB64}`;
    }

    const expectedMac = hmacSha256Hex(macInput, macKey);
    if (!constantTimeEqual(expectedMac.toLowerCase(), String(macHex || '').toLowerCase())) {
      return '';
    }

    const cipherBytes = base64ToBytes(cipherB64);
    const plainBytes = new Uint8Array(cipherBytes.length);
    const counterBlock = new Uint8Array(20);
    counterBlock.set(salt, 0);

    for (let offset = 0, blockIdx = 0; offset < cipherBytes.length; offset += 32, blockIdx++) {
      counterBlock[16] = (blockIdx >>> 24) & 0xff;
      counterBlock[17] = (blockIdx >>> 16) & 0xff;
      counterBlock[18] = (blockIdx >>> 8) & 0xff;
      counterBlock[19] = blockIdx & 0xff;

      const keystream = hmacSha256Bytes(counterBlock, encKey);
      const chunkLen = Math.min(32, cipherBytes.length - offset);
      for (let i = 0; i < chunkLen; i++) {
        plainBytes[offset + i] = cipherBytes[offset + i] ^ keystream[i];
      }
    }

    return dec.decode(plainBytes);
  } catch {
    return '';
  }
}
