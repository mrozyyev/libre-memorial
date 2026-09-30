/**
 * Builds the social preview images that ship with the site:
 *   - public/og-default.png            generic card
 *   - public/og/<slug>.png             one per memorial (name, dates, portrait)
 *
 * Runs automatically before `dev` and `build` (see package.json). Output lives
 * in public/og/, which is generated — never edit those files by hand.
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT = path.join(ROOT, "src/content/memorials");
const OUT = path.join(ROOT, "public/og");

const WIDTH = 1200;
const HEIGHT = 630;
const BRAND = "#3a6b5d";
const INK = "#1b1b19";
const MUTED = "#6f6f69";
const SAND = "#ece7dd";

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(value, max) {
  const text = (value ?? "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function prettyDate(value) {
  const text = (value ?? "").trim();
  if (!text) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) {
    const month = MONTHS[Number(iso[2]) - 1];
    if (month) return `${Number(iso[3])} ${month} ${iso[1]}`;
  }
  return text;
}

function lifespan(born, died) {
  const from = prettyDate(born);
  const to = prettyDate(died);
  if (from && to) return `${from} — ${to}`;
  if (from) return `Born ${from}`;
  if (to) return `Passed ${to}`;
  return "";
}

function leaf(x, y, scale, color) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="${color}">
    <path d="M16 25.5c0-4.6.4-8 2.6-10.6 1.5-1.8 3.6-2.9 6-3.2-.3 6.6-2.2 11.3-7 13.4"/>
    <path d="M16 25.5c0-3.8-.3-6.6-2.2-8.8-1.2-1.5-2.9-2.4-4.9-2.7.3 5.5 1.9 9.4 5.8 11.1" opacity="0.6"/>
    <path d="M16 25.5V14" stroke="${color}" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  </g>`;
}

function baseSvg(inner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#f5f2ec"/>
      </linearGradient>
      <pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse">
        <circle cx="1.5" cy="1.5" r="1.3" fill="${INK}" opacity="0.05"/>
      </pattern>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#dots)"/>
    ${inner}
  </svg>`;
}

async function roundedImage(sourcePath, size, radius) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#fff"/>
    </svg>`,
  );
  const image = await sharp(sourcePath)
    .resize(size, size, { fit: "cover", position: "attention" })
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();
  return image;
}

async function buildDefault() {
  const inner = `
    ${leaf(80, 84, 2.6, BRAND)}
    <text x="80" y="270" font-family="Georgia, 'Times New Roman', serif" font-size="76" font-weight="600" fill="${INK}">LibreMemorial</text>
    <text x="82" y="336" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="${MUTED}">A free memorial page with photos, stories and a QR code.</text>
    <g font-family="Helvetica, Arial, sans-serif" font-size="22" fill="${BRAND}">
      <text x="82" y="430">No accounts</text>
      <text x="260" y="430">No ads</text>
      <text x="372" y="430">No tracking</text>
      <text x="530" y="430">Always free</text>
    </g>
    <rect x="80" y="500" width="1040" height="1" fill="${SAND}"/>
    <text x="80" y="556" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="${MUTED}">Every memory kept as plain files in a public Git repository.</text>
    <text x="1120" y="556" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="${BRAND}">librememorial.org</text>
  `;
  const png = await sharp(Buffer.from(baseSvg(inner))).png().toBuffer();
  await writeFile(path.join(ROOT, "public/og-default.png"), png);
  return "public/og-default.png";
}

async function readMemorials() {
  if (!existsSync(CONTENT)) return [];
  const slugs = (await readdir(CONTENT, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const memorials = [];
  for (const slug of slugs) {
    const file = path.join(CONTENT, slug, "memorial.json");
    if (!existsSync(file)) continue;
    try {
      const memorial = JSON.parse(await readFile(file, "utf8"));
      memorials.push({ ...memorial, slug });
    } catch (error) {
      console.warn(`og: could not read ${slug}: ${error.message}`);
    }
  }
  return memorials;
}

async function buildMemorial(memorial) {
  const dates = lifespan(memorial.born, memorial.died);
  const nameSize = memorial.name.length > 20 ? 56 : memorial.name.length > 14 ? 68 : 80;
  const quote =
    memorial.epitaph || truncate((memorial.biography ?? "").split("\n")[0], 74) || "";

  let portrait = null;
  if (memorial.cover) {
    const coverPath = path.join(CONTENT, memorial.slug, "photos", memorial.cover);
    if (existsSync(coverPath)) {
      portrait = await roundedImage(coverPath, 360, 28);
    }
  }

  const textWidth = portrait ? 660 : 1040;
  const inner = `
    ${leaf(80, 76, 1.9, BRAND)}
    <text x="188" y="122" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="${MUTED}">In loving memory</text>
    <text x="80" y="300" font-family="Georgia, 'Times New Roman', serif" font-size="${nameSize}" font-weight="600" fill="${INK}">${escapeXml(
      truncate(memorial.name, 30),
    )}</text>
    ${dates ? `<text x="82" y="358" font-family="Helvetica, Arial, sans-serif" font-size="30" fill="${BRAND}">${escapeXml(dates)}</text>` : ""}
    ${
      quote
        ? `<text x="82" y="424" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-style="italic" fill="${MUTED}">${escapeXml(
            truncate(`“${quote}”`, 60),
          )}</text>`
        : ""
    }
    <rect x="80" y="500" width="${textWidth}" height="1" fill="${SAND}"/>
    <text x="80" y="556" font-family="Helvetica, Arial, sans-serif" font-size="24" fill="${MUTED}">librememorial.org/m/${escapeXml(memorial.slug)}</text>
  `;

  let image = sharp(Buffer.from(baseSvg(inner))).png();
  if (portrait) {
    image = image.composite([{ input: portrait, left: WIDTH - 80 - 360, top: 135 }]);
  }
  await writeFile(path.join(OUT, `${memorial.slug}.png`), await image.png().toBuffer());
  return memorial.slug;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [await buildDefault()];
  const memorials = await readMemorials();
  for (const memorial of memorials) {
    written.push(`public/og/${await buildMemorial(memorial)}.png`);
  }
  console.log(`og: wrote ${written.length} image(s)`);
}

main().catch((error) => {
  console.error("og generation failed:", error);
  process.exitCode = 1;
});
