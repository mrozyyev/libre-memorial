import { describe, expect, it } from "vitest";
import { base64ToBytes, base64ToUtf8, bytesToBase64, bytesToBase64Url, bytesToHex, utf8ToBase64, randomBytes } from "../shared/base64";
import { extensionForMime, parseImageDataUrl, sniffImageMime } from "../shared/images";
import { pngBytes, pngDataUrl } from "./helpers/fake-github";

function withSignature(bytes: number[]): Uint8Array {
  const out = new Uint8Array(16);
  out.set(bytes);
  return out;
}

describe("base64 helpers", () => {
  it("round-trips utf8 text", () => {
    const text = "María Popescu — Ștefan, țuțuianu ✓";
    expect(base64ToUtf8(utf8ToBase64(text))).toBe(text);
  });

  it("produces url-safe base64 without padding", () => {
    const encoded = bytesToBase64Url(withSignature([0xff, 0xfe, 0xfd]));
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encoded).not.toContain("=");
  });

  it("handles payloads larger than a single chunk", () => {
    const bytes = randomBytes(100_000);
    const roundTrip = base64ToBytes(bytesToBase64(bytes));
    expect(roundTrip.byteLength).toBe(bytes.byteLength);
    expect(bytesToHex(roundTrip.slice(0, 8))).toBe(bytesToHex(bytes.slice(0, 8)));
    expect(bytesToHex(roundTrip.slice(-8))).toBe(bytesToHex(bytes.slice(-8)));
  });
});

describe("sniffImageMime", () => {
  it("recognises the supported formats", () => {
    expect(sniffImageMime(withSignature([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(sniffImageMime(withSignature([0x89, 0x50, 0x4e, 0x47]))).toBe("image/png");
    expect(sniffImageMime(withSignature([0x47, 0x49, 0x46, 0x38]))).toBe("image/gif");
    expect(
      sniffImageMime(
        withSignature([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]),
      ),
    ).toBe("image/webp");
  });

  it("rejects everything else", () => {
    expect(sniffImageMime(withSignature([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(sniffImageMime(new Uint8Array(4))).toBeNull();
    expect(sniffImageMime(new Uint8Array(0))).toBeNull();
  });
});

describe("parseImageDataUrl", () => {
  it("accepts a real png", () => {
    const parsed = parseImageDataUrl(pngDataUrl());
    expect(parsed.mime).toBe("image/png");
    expect(parsed.bytes.byteLength).toBe(pngBytes().byteLength);
  });

  it("rejects non data urls, non-images and non-base64 payloads", () => {
    expect(() => parseImageDataUrl("https://example.com/a.png")).toThrow(/data URL/);
    expect(() => parseImageDataUrl(42)).toThrow(/data URL/);
    expect(() => parseImageDataUrl("data:image/png,notbase64")).toThrow(/base64/);
    expect(() =>
      parseImageDataUrl(`data:image/png;base64,${utf8ToBase64("definitely not an image")}`),
    ).toThrow(/JPEG, PNG/);
  });

  it("refuses to be fooled by the declared mime type", () => {
    expect(() =>
      parseImageDataUrl(`data:image/jpeg;base64,${utf8ToBase64("%PDF-1.4 not an image")}`),
    ).toThrow(/JPEG, PNG/);
  });
});

describe("extensionForMime", () => {
  it("maps known types and falls back to jpg", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("image/nonsense")).toBe("jpg");
  });
});
