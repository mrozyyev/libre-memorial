import { contentId } from "./crypto";
import { sanitizeFileName } from "./validate";
import { parseVideoUrl } from "./video";
import type { DonationLink, ExternalLink, Memorial, PhotoMeta, Story } from "./types";
import type { MediaItem } from "./video";
import type { CreateMemorialInput } from "./validate";

/** Paths are relative to the repository root — the API commits straight to git. */
export const CONTENT_ROOT = "src/content/memorials";
export const MEMORIAL_FILE = "memorial.json";
export const PHOTOS_DIR = "photos";
export const STORIES_DIR = "stories";

export const memorialDir = (slug: string) => `${CONTENT_ROOT}/${slug}`;
export const memorialPath = (slug: string) => `${memorialDir(slug)}/${MEMORIAL_FILE}`;
export const photosPath = (slug: string) => `${memorialDir(slug)}/${PHOTOS_DIR}`;
export const storiesPath = (slug: string) => `${memorialDir(slug)}/${STORIES_DIR}`;
export const photoPath = (slug: string, file: string) =>
  `${photosPath(slug)}/${sanitizeFileName(file)}`;
export const storyPath = (slug: string, id: string) =>
  `${storiesPath(slug)}/${sanitizeFileName(id)}.json`;

function str(value: unknown, max = 20_000): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function photoList(raw: unknown): PhotoMeta[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({
      file: sanitizeFileName(str(item.file, 120)),
      caption: str(item.caption, 300),
      createdAt: str(item.createdAt, 40) || undefined,
    }))
    .filter((photo) => photo.file && photo.file !== "file");
}

function linkList(raw: unknown, max: number) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => ({ label: str(item.label, 60), url: str(item.url, 500) }))
    .filter((item) => item.url)
    .slice(0, max);
}

/** Media entries are re-parsed on read, so a hand-edited file cannot inject an iframe. */
function mediaList(raw: unknown): MediaItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MediaItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const parsed = parseVideoUrl(str(record.url, 500));
    if (!parsed) continue;
    const title = str(record.title, 60);
    out.push(title ? { ...parsed, title } : parsed);
    if (out.length >= 12) break;
  }
  return out;
}

/**
 * Coerces a parsed `memorial.json` into a well-formed Memorial. Hand-edited or
 * slightly older files must never crash the build, so everything is defaulted.
 */
export function normalizeMemorial(raw: unknown): Memorial {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const auth = (source.auth && typeof source.auth === "object" ? source.auth : {}) as Record<string, unknown>;
  return {
    slug: str(source.slug, 60),
    name: str(source.name, 80) || "Unnamed memorial",
    born: str(source.born, 120) || undefined,
    died: str(source.died, 120) || undefined,
    epitaph: str(source.epitaph, 200) || undefined,
    biography: str(source.biography, 20_000) || undefined,
    location: str(source.location, 120) || undefined,
    quote: str(source.quote, 400) || undefined,
    quoteAuthor: str(source.quoteAuthor, 80) || undefined,
    cover: source.cover ? sanitizeFileName(str(source.cover, 120)) : undefined,
    photos: photoList(source.photos),
    donations: linkList(source.donations, 12),
    links: linkList(source.links, 12),
    media: mediaList(source.media),
    visibility: source.visibility === "unlisted" ? "unlisted" : "public",
    createdAt: str(source.createdAt, 40),
    updatedAt: str(source.updatedAt, 40),
    auth: { salt: str(auth.salt, 64), keyHash: str(auth.keyHash, 128) },
  };
}

export function createMemorialRecord(
  input: CreateMemorialInput,
  auth: { salt: string; keyHash: string },
  now = new Date().toISOString(),
): Memorial {
  return {
    slug: input.slug,
    name: input.name,
    born: input.born || undefined,
    died: input.died || undefined,
    epitaph: input.epitaph || undefined,
    biography: input.biography || undefined,
    location: input.location || undefined,
    quote: input.quote || undefined,
    quoteAuthor: input.quoteAuthor || undefined,
    cover: undefined,
    photos: [],
    donations: input.donations,
    links: input.links,
    media: input.media,
    visibility: input.visibility,
    createdAt: now,
    updatedAt: now,
    auth,
  };
}

export function applyMemorialPatch(
  memorial: Memorial,
  patch: Partial<CreateMemorialInput>,
  now = new Date().toISOString(),
): Memorial {
  const next: Memorial = { ...memorial, updatedAt: now };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === "slug") continue; // slugs are permanent — they are printed on cards
    if (key === "links") {
      next.links = value as ExternalLink[];
      continue;
    }
    if (key === "donations") {
      next.donations = value as DonationLink[];
      continue;
    }
    if (key === "media") {
      next.media = value as MediaItem[];
      continue;
    }
    (next as unknown as Record<string, unknown>)[key] = value === "" ? undefined : value;
  }
  return next;
}

export function createStoryRecord(
  input: { title: string; author: string; relation: string; date: string; body: string },
  id = contentId(),
  now = new Date().toISOString(),
): Story {
  return {
    id,
    title: input.title || undefined,
    author: input.author,
    relation: input.relation || undefined,
    date: input.date || undefined,
    body: input.body,
    createdAt: now,
  };
}

export function normalizeStory(raw: unknown): Story {
  const source = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    id: str(source.id, 60),
    title: str(source.title, 120) || undefined,
    author: str(source.author, 80) || "Anonymous",
    relation: str(source.relation, 80) || undefined,
    date: str(source.date, 60) || undefined,
    body: str(source.body, 10_000),
    createdAt: str(source.createdAt, 40),
  };
}
