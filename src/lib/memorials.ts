import type { ImageMetadata } from "astro";
import { normalizeMemorial, normalizeStory } from "@shared/memorial";
import type { Memorial, Story } from "@shared/types";

/**
 * Build-time content access.
 *
 * Memorials live in the repository as plain files:
 *   src/content/memorials/<slug>/memorial.json
 *   src/content/memorials/<slug>/photos/*.jpg
 *   src/content/memorials/<slug>/stories/*.json
 *
 * Globbing them here means every photo is imported through Astro's asset
 * pipeline, so images are resized, converted to modern formats and hashed at
 * build time — the repository (and the deployed output) stays small.
 */
const memorialModules = import.meta.glob<unknown>("/src/content/memorials/*/memorial.json", {
  eager: true,
  import: "default",
});

const photoModules = import.meta.glob<ImageMetadata>(
  "/src/content/memorials/*/photos/*.{jpg,jpeg,png,webp,avif,gif}",
  { eager: true, import: "default" },
);

const storyModules = import.meta.glob<unknown>("/src/content/memorials/*/stories/*.json", {
  eager: true,
  import: "default",
});

export interface PhotoEntry {
  file: string;
  caption: string;
  image: ImageMetadata | null;
  createdAt?: string;
}

export interface MemorialEntry {
  memorial: Memorial;
  photos: PhotoEntry[];
  stories: Story[];
  cover: ImageMetadata | null;
}

const MEMORIAL_MARKER = "/src/content/memorials/";

function slugFromKey(key: string): string {
  const rest = key.slice(key.indexOf(MEMORIAL_MARKER) + MEMORIAL_MARKER.length);
  return rest.split("/")[0] ?? "";
}

function baseName(path: string): string {
  return path.split("/").pop() ?? path;
}

function buildEntries(): Map<string, MemorialEntry> {
  const entries = new Map<string, MemorialEntry>();

  for (const [key, raw] of Object.entries(memorialModules)) {
    const slug = slugFromKey(key);
    if (!slug) continue;
    const memorial = normalizeMemorial(raw);
    entries.set(slug, {
      memorial: { ...memorial, slug },
      photos: [],
      stories: [],
      cover: null,
    });
  }

  for (const [key, image] of Object.entries(photoModules)) {
    const slug = slugFromKey(key);
    const entry = entries.get(slug);
    if (!entry) continue;
    const file = baseName(key);
    const meta = entry.memorial.photos.find((photo) => photo.file === file);
    entry.photos.push({ file, caption: meta?.caption ?? "", image, createdAt: meta?.createdAt });
    if (entry.memorial.cover === file) entry.cover = image;
  }

  for (const entry of entries.values()) {
    entry.photos.sort((a, b) => {
      const order = entry.memorial.photos.map((photo) => photo.file);
      const indexA = order.indexOf(a.file);
      const indexB = order.indexOf(b.file);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.file.localeCompare(b.file);
    });
    if (!entry.cover && entry.photos[0]) entry.cover = entry.photos[0].image;
  }

  for (const [key, raw] of Object.entries(storyModules)) {
    const slug = slugFromKey(key);
    const entry = entries.get(slug);
    if (!entry) continue;
    const story = normalizeStory(raw);
    if (!story.body) continue;
    entry.stories.push({ ...story, id: story.id || baseName(key).replace(/\.json$/, "") });
  }

  for (const entry of entries.values()) {
    entry.stories.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  return entries;
}

let cache: Map<string, MemorialEntry> | null = null;

function all(): Map<string, MemorialEntry> {
  if (!cache) cache = buildEntries();
  return cache;
}

export function getMemorial(slug: string): MemorialEntry | undefined {
  return all().get(slug);
}

export function getMemorials({ includeUnlisted = false } = {}): MemorialEntry[] {
  return [...all().values()]
    .filter((entry) => includeUnlisted || entry.memorial.visibility === "public")
    .sort((a, b) => a.memorial.name.localeCompare(b.memorial.name));
}

export function getMemorialSlugs(): string[] {
  return [...all().keys()];
}

export function memorialUrl(slug: string): string {
  return `/m/${slug}`;
}
