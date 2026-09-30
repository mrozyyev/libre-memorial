import { ALLOWED_IMAGE_TYPES } from "./limits";
import { ValidationError } from "./validate";

/**
 * Sniffs the image type from magic bytes. We never trust the browser-supplied
 * content type, and only allow the handful of formats Astro can optimise.
 */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  const brand = String.fromCharCode(...b.subarray(4, 12));
  if (brand.startsWith("ftyp") && (brand.includes("avif") || brand.includes("avis"))) {
    return "image/avif";
  }
  return null;
}

export interface ParsedImage {
  mime: string;
  bytes: Uint8Array;
}

/** Parses a `data:image/...;base64,...` URL, validating type and size. */
export function parseImageDataUrl(dataUrl: unknown): ParsedImage {
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    throw new ValidationError("Photo must be a data URL.");
  }
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new ValidationError("Photo data is malformed.");
  const header = dataUrl.slice(5, comma);
  if (!header.includes("base64")) throw new ValidationError("Photo must be base64 encoded.");
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const mime = sniffImageMime(bytes);
  if (!mime || !ALLOWED_IMAGE_TYPES[mime]) {
    throw new ValidationError("Only JPEG, PNG, WebP, AVIF and GIF images are supported.");
  }
  return { mime, bytes };
}

export function extensionForMime(mime: string): string {
  return ALLOWED_IMAGE_TYPES[mime] ?? "jpg";
}
