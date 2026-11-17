/**
 * @file nativeCrypto.ts
 * @module core/security/nativeCrypto
 * @description
 * Zero-dependency cryptographic primitives:
 *  - FIPS 180-4 SHA-256
 *  - RFC 2104 HMAC-SHA256
 *  - RFC 2898 PBKDF2-HMAC-SHA256 (precomputed midstates + zero-allocation hot loop for 600,000+ iterations)
 *  - NIST FIPS 197 AES-256 + NIST SP 800-38D GCM (AEAD, 96-bit IV, 128-bit authentication tag)
 *  - Web Crypto `crypto.subtle` async AES-256-GCM + PBKDF2 (600,000 iterations), wire-compatible `AG1:`
 *  - Legacy `NC2:` / `NC1:` read-only decryption for one-time transparent migration
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

// FIPS 197 AES S-Box & Round Constants
const AES_SBOX = new Uint8Array([
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
]);

const AES_RCON = [0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

export const PBKDF2_STANDARD_ITERATIONS = 600000;

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

/**
 * Constant-time byte array comparison.
 */
export function constantTimeBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  const maxLen = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < maxLen; i++) {
    const ba = i < a.length ? a[i] : 0;
    const bb = i < b.length ? b[i] : 0;
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
const SHA256_IV = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

/**
 * Single 512-bit SHA-256 block compression in-place on `state` (`Uint32Array(8)`).
 * Reads 16 words from `W[0..15]`, expands into `W[16..63]`, mutates `state`.
 */
function sha256CompressW(state: Uint32Array, W: Uint32Array): void {
  for (let t = 16; t < 64; t++) {
    const w15 = W[t - 15];
    const w2 = W[t - 2];
    const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
    const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
    W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
  }

  let a = state[0];
  let b = state[1];
  let c = state[2];
  let d = state[3];
  let e = state[4];
  let f = state[5];
  let g = state[6];
  let h = state[7];

  for (let t = 0; t < 64; t++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const ch = (e & f) ^ (~e & g);
    const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
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

  state[0] = (state[0] + a) >>> 0;
  state[1] = (state[1] + b) >>> 0;
  state[2] = (state[2] + c) >>> 0;
  state[3] = (state[3] + d) >>> 0;
  state[4] = (state[4] + e) >>> 0;
  state[5] = (state[5] + f) >>> 0;
  state[6] = (state[6] + g) >>> 0;
  state[7] = (state[7] + h) >>> 0;
}

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

  const state = new Uint32Array(SHA256_IV);
  const W = SHARED_W;

  for (let offset = 0; offset < totalWords; offset += 16) {
    for (let t = 0; t < 16; t++) {
      W[t] = M[offset + t];
    }
    sha256CompressW(state, W);
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    const H = state[i];
    out[i * 4] = (H >>> 24) & 0xff;
    out[i * 4 + 1] = (H >>> 16) & 0xff;
    out[i * 4 + 2] = (H >>> 8) & 0xff;
    out[i * 4 + 3] = H & 0xff;
  }
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
 * RFC 2898 PBKDF2-HMAC-SHA256 implementation with precomputed HMAC midstates
 * and zero-allocation inner compression loop (fast even at 600,000 iterations).
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

  // Precompute SHA-256 midstates for 64-byte ipad and opad blocks
  const W = SHARED_W;
  const ipadMid = new Uint32Array(SHA256_IV);
  for (let t = 0; t < 16; t++) {
    W[t] = (ipad[t * 4] << 24) | (ipad[t * 4 + 1] << 16) | (ipad[t * 4 + 2] << 8) | ipad[t * 4 + 3];
  }
  sha256CompressW(ipadMid, W);

  const opadMid = new Uint32Array(SHA256_IV);
  for (let t = 0; t < 16; t++) {
    W[t] = (opad[t * 4] << 24) | (opad[t * 4 + 1] << 16) | (opad[t * 4 + 2] << 8) | opad[t * 4 + 3];
  }
  sha256CompressW(opadMid, W);

  const innerState = new Uint32Array(8);
  const outerState = new Uint32Array(8);
  const UWords = new Uint32Array(8);
  const TWords = new Uint32Array(8);

  const prfVarToWords = (data: Uint8Array, outWords: Uint32Array): void => {
    const inner = new Uint8Array(64 + data.length);
    inner.set(ipad, 0);
    inner.set(data, 64);
    const innerDigest = sha256Bytes(inner);
    for (let i = 0; i < 8; i++) {
      outerState[i] = opadMid[i];
      W[i] =
        (innerDigest[i * 4] << 24) |
        (innerDigest[i * 4 + 1] << 16) |
        (innerDigest[i * 4 + 2] << 8) |
        innerDigest[i * 4 + 3];
    }
    W[8] = 0x80000000;
    W[9] = 0;
    W[10] = 0;
    W[11] = 0;
    W[12] = 0;
    W[13] = 0;
    W[14] = 0;
    W[15] = 768; // (64 + 32) * 8 bits
    sha256CompressW(outerState, W);
    for (let i = 0; i < 8; i++) outWords[i] = outerState[i];
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

    prfVarToWords(saltAndBlock, UWords);
    for (let j = 0; j < 8; j++) TWords[j] = UWords[j];

    for (let i = 1; i < iterations; i++) {
      // Inner: ipadMid + 32-byte UWords + SHA-256 padding (total 96 bytes = 768 bits)
      innerState[0] = ipadMid[0]; innerState[1] = ipadMid[1];
      innerState[2] = ipadMid[2]; innerState[3] = ipadMid[3];
      innerState[4] = ipadMid[4]; innerState[5] = ipadMid[5];
      innerState[6] = ipadMid[6]; innerState[7] = ipadMid[7];
      W[0] = UWords[0]; W[1] = UWords[1]; W[2] = UWords[2]; W[3] = UWords[3];
      W[4] = UWords[4]; W[5] = UWords[5]; W[6] = UWords[6]; W[7] = UWords[7];
      W[8] = 0x80000000; W[9] = 0; W[10] = 0; W[11] = 0;
      W[12] = 0; W[13] = 0; W[14] = 0; W[15] = 768;
      sha256CompressW(innerState, W);

      // Outer: opadMid + 32-byte innerState + SHA-256 padding (total 96 bytes = 768 bits)
      outerState[0] = opadMid[0]; outerState[1] = opadMid[1];
      outerState[2] = opadMid[2]; outerState[3] = opadMid[3];
      outerState[4] = opadMid[4]; outerState[5] = opadMid[5];
      outerState[6] = opadMid[6]; outerState[7] = opadMid[7];
      W[0] = innerState[0]; W[1] = innerState[1]; W[2] = innerState[2]; W[3] = innerState[3];
      W[4] = innerState[4]; W[5] = innerState[5]; W[6] = innerState[6]; W[7] = innerState[7];
      W[8] = 0x80000000; W[9] = 0; W[10] = 0; W[11] = 0;
      W[12] = 0; W[13] = 0; W[14] = 0; W[15] = 768;
      sha256CompressW(outerState, W);

      UWords[0] = outerState[0]; UWords[1] = outerState[1];
      UWords[2] = outerState[2]; UWords[3] = outerState[3];
      UWords[4] = outerState[4]; UWords[5] = outerState[5];
      UWords[6] = outerState[6]; UWords[7] = outerState[7];

      TWords[0] ^= UWords[0]; TWords[1] ^= UWords[1];
      TWords[2] ^= UWords[2]; TWords[3] ^= UWords[3];
      TWords[4] ^= UWords[4]; TWords[5] ^= UWords[5];
      TWords[6] ^= UWords[6]; TWords[7] ^= UWords[7];
    }

    const baseOut = (b - 1) * 32;
    for (let j = 0; j < 8; j++) {
      const tw = TWords[j];
      dk[baseOut + j * 4] = (tw >>> 24) & 0xff;
      dk[baseOut + j * 4 + 1] = (tw >>> 16) & 0xff;
      dk[baseOut + j * 4 + 2] = (tw >>> 8) & 0xff;
      dk[baseOut + j * 4 + 3] = tw & 0xff;
    }
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

// ============================================================================
// NIST FIPS 197 AES-256 + NIST SP 800-38D GCM (Standard Authenticated Encryption)
// ============================================================================

function aes256ExpandKey(key32: Uint8Array): Uint32Array {
  if (key32.length !== 32) {
    throw new Error('AES-256 requires a 32-byte key.');
  }
  const w = new Uint32Array(60);
  for (let i = 0; i < 8; i++) {
    w[i] =
      (key32[4 * i] << 24) |
      (key32[4 * i + 1] << 16) |
      (key32[4 * i + 2] << 8) |
      key32[4 * i + 3];
  }
  for (let i = 8; i < 60; i++) {
    let temp = w[i - 1];
    if (i % 8 === 0) {
      temp = ((temp << 8) | (temp >>> 24)) >>> 0;
      temp =
        (AES_SBOX[(temp >>> 24) & 0xff] << 24) |
        (AES_SBOX[(temp >>> 16) & 0xff] << 16) |
        (AES_SBOX[(temp >>> 8) & 0xff] << 8) |
        AES_SBOX[temp & 0xff];
      temp ^= AES_RCON[i / 8 - 1] << 24;
    } else if (i % 8 === 4) {
      temp =
        (AES_SBOX[(temp >>> 24) & 0xff] << 24) |
        (AES_SBOX[(temp >>> 16) & 0xff] << 16) |
        (AES_SBOX[(temp >>> 8) & 0xff] << 8) |
        AES_SBOX[temp & 0xff];
    }
    w[i] = (w[i - 8] ^ temp) >>> 0;
  }
  return w;
}

function xtime(b: number): number {
  return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
}

function aes256EncryptBlock(
  input16: Uint8Array,
  output16: Uint8Array,
  rk: Uint32Array
): void {
  const s = new Uint8Array(16);
  for (let i = 0; i < 4; i++) {
    const k = rk[i];
    s[i * 4] = input16[i * 4] ^ ((k >>> 24) & 0xff);
    s[i * 4 + 1] = input16[i * 4 + 1] ^ ((k >>> 16) & 0xff);
    s[i * 4 + 2] = input16[i * 4 + 2] ^ ((k >>> 8) & 0xff);
    s[i * 4 + 3] = input16[i * 4 + 3] ^ (k & 0xff);
  }

  for (let round = 1; round <= 14; round++) {
    // SubBytes + ShiftRows
    const b0 = AES_SBOX[s[0]];
    const b1 = AES_SBOX[s[5]];
    const b2 = AES_SBOX[s[10]];
    const b3 = AES_SBOX[s[15]];

    const b4 = AES_SBOX[s[4]];
    const b5 = AES_SBOX[s[9]];
    const b6 = AES_SBOX[s[14]];
    const b7 = AES_SBOX[s[3]];

    const b8 = AES_SBOX[s[8]];
    const b9 = AES_SBOX[s[13]];
    const b10 = AES_SBOX[s[2]];
    const b11 = AES_SBOX[s[7]];

    const b12 = AES_SBOX[s[12]];
    const b13 = AES_SBOX[s[1]];
    const b14 = AES_SBOX[s[6]];
    const b15 = AES_SBOX[s[11]];

    const rBase = round * 4;
    if (round < 14) {
      // MixColumns + AddRoundKey
      const k0 = rk[rBase];
      const t0 = b0 ^ b1 ^ b2 ^ b3;
      s[0] = b0 ^ t0 ^ xtime(b0 ^ b1) ^ ((k0 >>> 24) & 0xff);
      s[1] = b1 ^ t0 ^ xtime(b1 ^ b2) ^ ((k0 >>> 16) & 0xff);
      s[2] = b2 ^ t0 ^ xtime(b2 ^ b3) ^ ((k0 >>> 8) & 0xff);
      s[3] = b3 ^ t0 ^ xtime(b3 ^ b0) ^ (k0 & 0xff);

      const k1 = rk[rBase + 1];
      const t1 = b4 ^ b5 ^ b6 ^ b7;
      s[4] = b4 ^ t1 ^ xtime(b4 ^ b5) ^ ((k1 >>> 24) & 0xff);
      s[5] = b5 ^ t1 ^ xtime(b5 ^ b6) ^ ((k1 >>> 16) & 0xff);
      s[6] = b6 ^ t1 ^ xtime(b6 ^ b7) ^ ((k1 >>> 8) & 0xff);
      s[7] = b7 ^ t1 ^ xtime(b7 ^ b4) ^ (k1 & 0xff);

      const k2 = rk[rBase + 2];
      const t2 = b8 ^ b9 ^ b10 ^ b11;
      s[8] = b8 ^ t2 ^ xtime(b8 ^ b9) ^ ((k2 >>> 24) & 0xff);
      s[9] = b9 ^ t2 ^ xtime(b9 ^ b10) ^ ((k2 >>> 16) & 0xff);
      s[10] = b10 ^ t2 ^ xtime(b10 ^ b11) ^ ((k2 >>> 8) & 0xff);
      s[11] = b11 ^ t2 ^ xtime(b11 ^ b8) ^ (k2 & 0xff);

      const k3 = rk[rBase + 3];
      const t3 = b12 ^ b13 ^ b14 ^ b15;
      s[12] = b12 ^ t3 ^ xtime(b12 ^ b13) ^ ((k3 >>> 24) & 0xff);
      s[13] = b13 ^ t3 ^ xtime(b13 ^ b14) ^ ((k3 >>> 16) & 0xff);
      s[14] = b14 ^ t3 ^ xtime(b14 ^ b15) ^ ((k3 >>> 8) & 0xff);
      s[15] = b15 ^ t3 ^ xtime(b15 ^ b12) ^ (k3 & 0xff);
    } else {
      const k0 = rk[rBase];
      output16[0] = b0 ^ ((k0 >>> 24) & 0xff);
      output16[1] = b1 ^ ((k0 >>> 16) & 0xff);
      output16[2] = b2 ^ ((k0 >>> 8) & 0xff);
      output16[3] = b3 ^ (k0 & 0xff);

      const k1 = rk[rBase + 1];
      output16[4] = b4 ^ ((k1 >>> 24) & 0xff);
      output16[5] = b5 ^ ((k1 >>> 16) & 0xff);
      output16[6] = b6 ^ ((k1 >>> 8) & 0xff);
      output16[7] = b7 ^ (k1 & 0xff);

      const k2 = rk[rBase + 2];
      output16[8] = b8 ^ ((k2 >>> 24) & 0xff);
      output16[9] = b9 ^ ((k2 >>> 16) & 0xff);
      output16[10] = b10 ^ ((k2 >>> 8) & 0xff);
      output16[11] = b11 ^ (k2 & 0xff);

      const k3 = rk[rBase + 3];
      output16[12] = b12 ^ ((k3 >>> 24) & 0xff);
      output16[13] = b13 ^ ((k3 >>> 16) & 0xff);
      output16[14] = b14 ^ ((k3 >>> 8) & 0xff);
      output16[15] = b15 ^ (k3 & 0xff);
    }
  }
}

/**
 * GF(2^128) multiplication per NIST SP 800-38D Algorithm 1 (`Z = X * Y`).
 */
function gf128Mul(X: Uint8Array, Y: Uint8Array, out: Uint8Array): void {
  const Z = new Uint8Array(16);
  const V = new Uint8Array(Y);

  for (let i = 0; i < 16; i++) {
    const xByte = X[i];
    for (let bit = 7; bit >= 0; bit--) {
      if ((xByte >>> bit) & 1) {
        for (let k = 0; k < 16; k++) {
          Z[k] ^= V[k];
        }
      }
      const lsb = V[15] & 1;
      for (let k = 15; k > 0; k--) {
        V[k] = (V[k] >>> 1) | ((V[k - 1] & 1) << 7);
      }
      V[0] >>>= 1;
      if (lsb) {
        V[0] ^= 0xe1;
      }
    }
  }
  out.set(Z, 0);
}

function ghashBlock(H: Uint8Array, tagAcc: Uint8Array, block16: Uint8Array): void {
  for (let i = 0; i < 16; i++) {
    tagAcc[i] ^= block16[i];
  }
  gf128Mul(tagAcc, H, tagAcc);
}

function ghashCompute(H: Uint8Array, aad: Uint8Array, cipher: Uint8Array): Uint8Array {
  const acc = new Uint8Array(16);
  const block = new Uint8Array(16);

  for (let offset = 0; offset < aad.length; offset += 16) {
    const len = Math.min(16, aad.length - offset);
    block.fill(0);
    block.set(aad.subarray(offset, offset + len), 0);
    ghashBlock(H, acc, block);
  }

  for (let offset = 0; offset < cipher.length; offset += 16) {
    const len = Math.min(16, cipher.length - offset);
    block.fill(0);
    block.set(cipher.subarray(offset, offset + len), 0);
    ghashBlock(H, acc, block);
  }

  // 64-bit big-endian bit lengths for AAD and ciphertext
  const aadBits = aad.length * 8;
  const cipherBits = cipher.length * 8;
  block.fill(0);
  const aadHigh = Math.floor(aadBits / 0x100000000);
  const aadLow = aadBits >>> 0;
  block[0] = (aadHigh >>> 24) & 0xff;
  block[1] = (aadHigh >>> 16) & 0xff;
  block[2] = (aadHigh >>> 8) & 0xff;
  block[3] = aadHigh & 0xff;
  block[4] = (aadLow >>> 24) & 0xff;
  block[5] = (aadLow >>> 16) & 0xff;
  block[6] = (aadLow >>> 8) & 0xff;
  block[7] = aadLow & 0xff;

  const cHigh = Math.floor(cipherBits / 0x100000000);
  const cLow = cipherBits >>> 0;
  block[8] = (cHigh >>> 24) & 0xff;
  block[9] = (cHigh >>> 16) & 0xff;
  block[10] = (cHigh >>> 8) & 0xff;
  block[11] = cHigh & 0xff;
  block[12] = (cLow >>> 24) & 0xff;
  block[13] = (cLow >>> 16) & 0xff;
  block[14] = (cLow >>> 8) & 0xff;
  block[15] = cLow & 0xff;

  ghashBlock(H, acc, block);
  return acc;
}

function inc32(counterBlock: Uint8Array): void {
  const c =
    ((counterBlock[12] << 24) |
      (counterBlock[13] << 16) |
      (counterBlock[14] << 8) |
      counterBlock[15]) >>> 0;
  const next = (c + 1) >>> 0;
  counterBlock[12] = (next >>> 24) & 0xff;
  counterBlock[13] = (next >>> 16) & 0xff;
  counterBlock[14] = (next >>> 8) & 0xff;
  counterBlock[15] = next & 0xff;
}

/**
 * Standard AES-256-GCM raw byte encryption (12-byte IV, returns `ciphertext || 16-byte tag`).
 * Byte-for-byte compatible with Web Crypto `AES-GCM` and Node `aes-256-gcm`.
 */
export function aes256GcmEncryptRaw(
  key32: Uint8Array,
  iv12: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = new Uint8Array(0)
): Uint8Array {
  if (iv12.length !== 12) {
    throw new Error('AES-256-GCM requires a 12-byte (96-bit) IV.');
  }
  const rk = aes256ExpandKey(key32);
  const H = new Uint8Array(16);
  aes256EncryptBlock(new Uint8Array(16), H, rk);

  const j0 = new Uint8Array(16);
  j0.set(iv12, 0);
  j0[15] = 1;

  const ctr = new Uint8Array(j0);
  const cipher = new Uint8Array(plaintext.length);
  const keystream = new Uint8Array(16);

  for (let offset = 0; offset < plaintext.length; offset += 16) {
    inc32(ctr);
    aes256EncryptBlock(ctr, keystream, rk);
    const chunkLen = Math.min(16, plaintext.length - offset);
    for (let i = 0; i < chunkLen; i++) {
      cipher[offset + i] = plaintext[offset + i] ^ keystream[i];
    }
  }

  const sTag = ghashCompute(H, aad, cipher);
  const encJ0 = new Uint8Array(16);
  aes256EncryptBlock(j0, encJ0, rk);

  const out = new Uint8Array(cipher.length + 16);
  out.set(cipher, 0);
  for (let i = 0; i < 16; i++) {
    out[cipher.length + i] = sTag[i] ^ encJ0[i];
  }
  return out;
}

/**
 * Standard AES-256-GCM raw byte decryption (12-byte IV, input `ciphertext || 16-byte tag`).
 * Throws on authentication tag mismatch before returning any plaintext.
 */
export function aes256GcmDecryptRaw(
  key32: Uint8Array,
  iv12: Uint8Array,
  cipherAndTag: Uint8Array,
  aad: Uint8Array = new Uint8Array(0)
): Uint8Array {
  if (iv12.length !== 12) {
    throw new Error('AES-256-GCM requires a 12-byte (96-bit) IV.');
  }
  if (cipherAndTag.length < 16) {
    throw new Error('AES-256-GCM ciphertext too short (missing 128-bit auth tag).');
  }

  const cipherLen = cipherAndTag.length - 16;
  const cipher = cipherAndTag.subarray(0, cipherLen);
  const providedTag = cipherAndTag.subarray(cipherLen);

  const rk = aes256ExpandKey(key32);
  const H = new Uint8Array(16);
  aes256EncryptBlock(new Uint8Array(16), H, rk);

  const j0 = new Uint8Array(16);
  j0.set(iv12, 0);
  j0[15] = 1;

  const sTag = ghashCompute(H, aad, cipher);
  const encJ0 = new Uint8Array(16);
  aes256EncryptBlock(j0, encJ0, rk);

  const expectedTag = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    expectedTag[i] = sTag[i] ^ encJ0[i];
  }

  if (!constantTimeBytesEqual(expectedTag, providedTag)) {
    throw new Error('AES-256-GCM authentication failed (tag mismatch or wrong key).');
  }

  const ctr = new Uint8Array(j0);
  const plaintext = new Uint8Array(cipherLen);
  const keystream = new Uint8Array(16);

  for (let offset = 0; offset < cipherLen; offset += 16) {
    inc32(ctr);
    aes256EncryptBlock(ctr, keystream, rk);
    const chunkLen = Math.min(16, cipherLen - offset);
    for (let i = 0; i < chunkLen; i++) {
      plaintext[offset + i] = cipher[offset + i] ^ keystream[i];
    }
  }
  return plaintext;
}

const AG1_KEY_CACHE_MAX = 64;
const ag1KeyCache = new Map<string, Uint8Array>();

function deriveAg1Key(passphrase: string, salt: Uint8Array): Uint8Array {
  const cacheKey = `${passphrase}:${bytesToHex(salt)}`;
  const cached = ag1KeyCache.get(cacheKey);
  if (cached) return cached;

  const key = pbkdf2Sha256Bytes(passphrase, salt, PBKDF2_STANDARD_ITERATIONS, 32);
  if (ag1KeyCache.size >= AG1_KEY_CACHE_MAX) {
    const oldestKey = ag1KeyCache.keys().next().value;
    if (oldestKey !== undefined) {
      ag1KeyCache.delete(oldestKey);
    }
  }
  ag1KeyCache.set(cacheKey, key);
  return key;
}

/**
 * Standard AES-256-GCM string encryption using PBKDF2-HMAC-SHA256 (600,000 iterations),
 * random 128-bit salt, and random 96-bit IV.
 * Wire format: `AG1:<saltB64>:<ivB64>:<cipherAndTagB64>`
 */
export function aes256GcmEncrypt(plaintext: string, passphrase: string): string {
  if (!passphrase) {
    throw new Error('Symmetric passphrase/key is required for AES-256-GCM encryption.');
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveAg1Key(passphrase, salt);
  const cipherAndTag = aes256GcmEncryptRaw(key, iv, enc.encode(plaintext));
  return `AG1:${bytesToBase64(salt)}:${bytesToBase64(iv)}:${bytesToBase64(cipherAndTag)}`;
}

/**
 * Standard AES-256-GCM string decryption for `AG1:` payloads.
 * Returns empty string on authentication failure or malformed envelope.
 */
export function aes256GcmDecrypt(ciphertext: string, passphrase: string): string {
  if (!ciphertext || typeof ciphertext !== 'string' || !passphrase) {
    return '';
  }
  if (!ciphertext.startsWith('AG1:')) {
    return '';
  }
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return '';
    const [, saltB64, ivB64, payloadB64] = parts;
    if (!saltB64 || !ivB64 || !payloadB64) return '';
    const salt = base64ToBytes(saltB64);
    const iv = base64ToBytes(ivB64);
    const cipherAndTag = base64ToBytes(payloadB64);
    const key = deriveAg1Key(passphrase, salt);
    const plainBytes = aes256GcmDecryptRaw(key, iv, cipherAndTag);
    return dec.decode(plainBytes);
  } catch {
    return '';
  }
}

/**
 * Hardware-accelerated Web Crypto AES-256-GCM + PBKDF2 (600,000 iterations),
 * producing the exact same `AG1:` wire format.
 */
export async function aes256GcmEncryptAsync(plaintext: string, passphrase: string): Promise<string> {
  if (!passphrase) {
    throw new Error('Symmetric passphrase/key is required for AES-256-GCM encryption.');
  }
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return aes256GcmEncrypt(plaintext, passphrase);
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as Uint8Array<ArrayBuffer>,
      iterations: PBKDF2_STANDARD_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
    aesKey,
    enc.encode(plaintext) as Uint8Array<ArrayBuffer>
  );
  return `AG1:${bytesToBase64(salt)}:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

/**
 * Hardware-accelerated Web Crypto AES-256-GCM decryption for `AG1:` payloads.
 */
export async function aes256GcmDecryptAsync(ciphertext: string, passphrase: string): Promise<string> {
  if (!ciphertext || typeof ciphertext !== 'string' || !passphrase) {
    return '';
  }
  if (!ciphertext.startsWith('AG1:')) {
    return symmetricDecrypt(ciphertext, passphrase);
  }
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return aes256GcmDecrypt(ciphertext, passphrase);
  }
  try {
    const parts = ciphertext.split(':');
    if (parts.length !== 4) return '';
    const [, saltB64, ivB64, payloadB64] = parts;
    if (!saltB64 || !ivB64 || !payloadB64) return '';
    const salt = base64ToBytes(saltB64);
    const iv = base64ToBytes(ivB64);
    const cipherAndTag = base64ToBytes(payloadB64);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt as Uint8Array<ArrayBuffer>,
        iterations: PBKDF2_STANDARD_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as Uint8Array<ArrayBuffer> },
      aesKey,
      cipherAndTag as Uint8Array<ArrayBuffer>
    );
    return dec.decode(plainBuf);
  } catch {
    return '';
  }
}

// ============================================================================
// Legacy Read-Only Compatibility (`NC2:` / `NC1:`) + Unified Entrypoints
// ============================================================================

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
 * Primary symmetric encryption entrypoint — uses standard AES-256-GCM + 600,000-iteration PBKDF2 (`AG1:`).
 */
export function symmetricEncrypt(plaintext: string, passphrase: string): string {
  return aes256GcmEncrypt(plaintext, passphrase);
}

/**
 * Authenticated symmetric decryption supporting standard `AG1:` (AES-256-GCM / 600k PBKDF2)
 * as well as legacy `NC2:` / `NC1:` payloads for migration compatibility.
 */
export function symmetricDecrypt(ciphertext: string, passphrase: string): string {
  if (!ciphertext || typeof ciphertext !== 'string' || !passphrase) {
    return '';
  }

  if (ciphertext.startsWith('AG1:')) {
    return aes256GcmDecrypt(ciphertext, passphrase);
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
