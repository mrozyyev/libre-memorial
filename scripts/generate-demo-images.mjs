/**
 * Generates the abstract placeholder photographs used by the example
 * memorials that ship with the repository. No third-party imagery, no real
 * people — just calm, muted fields of colour so the demo pages look finished.
 *
 * Run with:  node scripts/generate-demo-images.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");

const PALETTES = {
  sage: { top: "#eef4f0", bottom: "#a9c4b5", accent: "#6fa392" },
  sand: { top: "#f7f1e6", bottom: "#dbc7a8", accent: "#bb9d70" },
  dusk: { top: "#e7eaf2", bottom: "#9dabc5", accent: "#6d7ea1" },
  clay: { top: "#f4e9e3", bottom: "#cba598", accent: "#a87c6b" },
  forest: { top: "#e2ece4", bottom: "#8fb098", accent: "#5d8a6b" },
  mist: { top: "#eceef0", bottom: "#b7bec4", accent: "#8b949c" },
};

function scene({ top, bottom, accent }, width, height, seed) {
  const rand = mulberry32(seed);
  const blobs = Array.from({ length: 4 }, (_, index) => {
    const r = Math.round(width * (0.22 + rand() * 0.3));
    const cx = Math.round(rand() * width);
    const cy = Math.round(height * (0.15 + rand() * 0.7));
    const opacity = (0.14 + rand() * 0.16).toFixed(2);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${accent}" opacity="${opacity}"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="${top}"/>
        <stop offset="1" stop-color="${bottom}"/>
      </linearGradient>
      <filter id="soft"><feGaussianBlur stdDeviation="${Math.round(width * 0.06)}"/></filter>
      <pattern id="grain" width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r="0.7" fill="#1b1b19" opacity="0.035"/>
        <circle cx="4" cy="4" r="0.6" fill="#ffffff" opacity="0.05"/>
      </pattern>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#bg)"/>
    <g filter="url(#soft)">${blobs}</g>
    <rect width="${width}" height="${height}" fill="url(#grain)"/>
    <rect width="${width}" height="${height}" fill="#1b1b19" opacity="0.03"/>
  </svg>`;
}

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PLAN = [
  { slug: "maria-popescu", portrait: "sand", photos: ["sage", "dusk", "clay", "forest"] },
  { slug: "andrei-ionescu", portrait: "forest", photos: ["mist", "dusk"] },
];

async function main() {
  let count = 0;
  for (const item of PLAN) {
    const dir = path.join(ROOT, "src/content/memorials", item.slug, "photos");
    await mkdir(dir, { recursive: true });

    const portraitSvg = scene(PALETTES[item.portrait], 1000, 1250, 7 + item.slug.length);
    await writeFile(
      path.join(dir, "portrait.jpg"),
      await sharp(Buffer.from(portraitSvg)).jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    );
    count += 1;

    for (const [index, name] of item.photos.entries()) {
      const svg = scene(PALETTES[name], 1600, 1200, 31 + index * 17 + item.slug.length);
      await writeFile(
        path.join(dir, `${index + 1}.jpg`),
        await sharp(Buffer.from(svg)).jpeg({ quality: 80, mozjpeg: true }).toBuffer(),
      );
      count += 1;
    }
  }
  console.log(`demo: wrote ${count} placeholder image(s)`);
}

main().catch((error) => {
  console.error("demo image generation failed:", error);
  process.exitCode = 1;
});
