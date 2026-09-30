/**
 * Browser-side image pipeline. Photos are downscaled and re-encoded *before*
 * they are uploaded, so what lands in the Git repository is already small and
 * Astro only has to generate the responsive variants.
 */

export interface ShrunkImage {
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  type: string;
}

export interface ShrinkOptions {
  maxDimension?: number;
  quality?: number;
}

const DEFAULTS: Required<ShrinkOptions> = { maxDimension: 2000, quality: 0.82 };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file could not be read as an image."));
    };
    image.src = url;
  });
}

export async function shrinkImage(file: File, options: ShrinkOptions = {}): Promise<ShrunkImage> {
  const { maxDimension, quality } = { ...DEFAULTS, ...options };
  const image = await loadImage(file);

  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser blocked image processing.");
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  // Prefer WebP (roughly 30% smaller); fall back to JPEG where unsupported.
  let type = "image/webp";
  let dataUrl = canvas.toDataURL(type, quality);
  if (!dataUrl.startsWith("data:image/webp")) {
    type = "image/jpeg";
    dataUrl = canvas.toDataURL(type, quality);
  }

  const bytes = Math.round(((dataUrl.length - dataUrl.indexOf(",") - 1) * 3) / 4);
  return { dataUrl, width, height, bytes, type };
}

export function formatBytes(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
