/**
 * SEC-HARDENING-P1 (Batch E): Cryptographically strong unique ID generator
 * Uses Web Crypto API `crypto.randomUUID()` with CSPRNG `crypto.getRandomValues` fallback.
 */
export function safeId(prefix?: string): string {
  let uuid: string;

  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    uuid = crypto.randomUUID();
  } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // RFC 4122 version 4 UUID bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } else {
    uuid = `${Date.now().toString(16)}-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`;
  }

  const cleanPrefix = typeof prefix === 'string' ? prefix.trim().replace(/-+$/, '') : '';
  return cleanPrefix ? `${cleanPrefix}-${uuid}` : uuid;
}
