/** Portable base64 / base64url / hex helpers (Workers + Node 22 + browser). */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function utf8ToBase64(value: string): string {
  return bytesToBase64(new TextEncoder().encode(value));
}

export function base64ToUtf8(value: string): string {
  return new TextDecoder().decode(base64ToBytes(value));
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += byte.toString(16).padStart(2, "0");
  return out;
}

/** `crypto.getRandomValues` caps out at 64 KiB per call, so fill in chunks. */
const RANDOM_CHUNK = 0x10000;

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let offset = 0; offset < length; offset += RANDOM_CHUNK) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + RANDOM_CHUNK, length)));
  }
  return bytes;
}
