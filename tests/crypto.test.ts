import { describe, expect, it } from "vitest";
import {
  contentId,
  generateEditKey,
  generateSalt,
  hashEditKey,
  timingSafeEqual,
  verifyEditKey,
} from "../shared/crypto";

describe("edit keys", () => {
  it("generates url-safe keys of the expected size", () => {
    const key = generateEditKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(new Set(Array.from({ length: 200 }, generateEditKey)).size).toBe(200);
  });

  it("generates distinct hex salts", () => {
    const salt = generateSalt();
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(generateSalt()).not.toBe(salt);
  });

  it("hashes deterministically and never stores the key", async () => {
    const salt = generateSalt();
    const key = generateEditKey();
    const first = await hashEditKey(salt, key);
    const second = await hashEditKey(salt, key);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).not.toContain(key);
    expect(await hashEditKey(generateSalt(), key)).not.toBe(first);
  });

  it("verifies only the right key", async () => {
    const salt = generateSalt();
    const key = generateEditKey();
    const keyHash = await hashEditKey(salt, key);
    await expect(verifyEditKey(salt, keyHash, key)).resolves.toBe(true);
    await expect(verifyEditKey(salt, keyHash, generateEditKey())).resolves.toBe(false);
    await expect(verifyEditKey(salt, keyHash, "")).resolves.toBe(false);
    await expect(verifyEditKey("", keyHash, key)).resolves.toBe(false);
    await expect(verifyEditKey(salt, "", key)).resolves.toBe(false);
  });

  it("compares in constant time semantics", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("creates unique, filename-safe content ids", () => {
    const ids = Array.from({ length: 100 }, contentId);
    expect(new Set(ids).size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });
});
