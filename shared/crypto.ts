import { bytesToBase64Url, bytesToHex, randomBytes } from "./base64";

/**
 * Edit-key auth.
 *
 * When a memorial is created we mint a random key and hand it to the creator
 * exactly once. Only `sha256(salt + key)` is committed to git, so the repo
 * itself never contains a usable credential. Every write request sends the key
 * back in an `x-edit-key` header and it is verified against the committed hash.
 */

export const EDIT_KEY_BYTES = 24; // 192 bits -> 32 base64url chars

export function generateEditKey(): string {
  return bytesToBase64Url(randomBytes(EDIT_KEY_BYTES));
}

export function generateSalt(): string {
  return bytesToHex(randomBytes(16));
}

export async function hashEditKey(salt: string, key: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${key}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

/** Length-independent, constant-time string comparison. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function verifyEditKey(
  salt: string,
  keyHash: string,
  candidate: string,
): Promise<boolean> {
  if (!salt || !keyHash || !candidate) return false;
  const computed = await hashEditKey(salt, candidate);
  return timingSafeEqual(computed, keyHash);
}

/** Stable, non-reversible id used for photo/story file names. */
export function contentId(): string {
  return `${Date.now().toString(36)}-${bytesToHex(randomBytes(6))}`;
}
