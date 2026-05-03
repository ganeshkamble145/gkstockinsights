/**
 * security-utils.ts
 * Shared utilities for key obfuscation and runtime decryption.
 */

const SECRET = "GK_STOCKS_2026";

/**
 * Universal base64 decode + XOR decryption.
 * Works in both Browser (atob) and Node.js (Buffer) environments.
 */
export function decryptKey(enc: string): string {
  if (!enc) return "";
  try {
    const decoded = typeof Buffer !== 'undefined' 
      ? Buffer.from(enc, 'base64').toString('utf8')
      : atob(enc);
      
    return decoded.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ SECRET.charCodeAt(i % SECRET.length))
    ).join('');
  } catch (e) {
    console.error("Decryption failed:", e);
    return "";
  }
}
