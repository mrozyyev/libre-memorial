import { LIMITS } from "./limits";
import type { DonationLink, ExternalLink } from "./types";
import type { MediaItem } from "./video";
import { parseVideoUrl } from "./video";
import { isValidSlug, slugify } from "./slug";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Trims, normalises newlines, strips control chars and enforces a max length. */
export function normalizeText(
  raw: unknown,
  max: number,
  field: string,
  { required = false }: { required?: boolean } = {},
): string {
  if (raw === undefined || raw === null) {
    if (required) throw new ValidationError(`${field} is required.`);
    return "";
  }
  if (typeof raw !== "string") throw new ValidationError(`${field} must be text.`);
  const value = raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!value && required) throw new ValidationError(`${field} is required.`);
  if (value.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer.`);
  return value;
}

export function validateName(raw: unknown): string {
  const value = normalizeText(raw, LIMITS.name, "Name", { required: true });
  if (value.length < 2) throw new ValidationError("Name must be at least 2 characters.");
  return value;
}

/** Accepts absolute http(s) URLs only — blocks javascript:, data:, etc. */
export function validateUrl(raw: unknown, field: string, { required = true } = {}): string {
  const value = normalizeText(raw, LIMITS.url, field, { required });
  if (!value) return "";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ValidationError(`${field} must be a valid URL (including https://).`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError(`${field} must start with http:// or https://.`);
  }
  return parsed.toString();
}

function labelFor(rawLabel: unknown, url: string, field: string): string {
  const label = normalizeText(rawLabel, LIMITS.linkLabel, field);
  if (label) return label;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

export function validateLinkList(
  raw: unknown,
  kind: "links" | "donations",
): ExternalLink[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError(`${kind} must be a list.`);
  const max = kind === "links" ? LIMITS.maxLinks : LIMITS.maxDonations;
  if (raw.length > max) throw new ValidationError(`You can add up to ${max} ${kind}.`);
  const out: ExternalLink[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") throw new ValidationError(`Invalid ${kind} entry.`);
    const record = item as Record<string, unknown>;
    const url = validateUrl(record.url, `${kind} URL`, { required: false });
    if (!url) continue; // skip empty rows silently
    out.push({ label: labelFor(record.label, url, `${kind} label`), url });
  }
  return out;
}

/**
 * Videos and music are stored as provider + id, never as uploaded files.
 * Unrecognised links are dropped rather than failing the whole save; the editor
 * warns about them before submitting.
 */
export function validateMediaList(raw: unknown): MediaItem[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ValidationError("media must be a list.");
  if (raw.length > LIMITS.maxMedia) {
    throw new ValidationError(`You can add up to ${LIMITS.maxMedia} videos.`);
  }
  const out: MediaItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const rawUrl = typeof record.url === "string" ? record.url : "";
    const parsed = parseVideoUrl(rawUrl);
    if (!parsed) continue;
    const title = normalizeText(record.title ?? record.label, LIMITS.linkLabel, "Video title");
    out.push(title ? { ...parsed, title } : parsed);
  }
  return out;
}

export function validateVisibility(raw: unknown): "public" | "unlisted" {
  if (raw === undefined || raw === null || raw === "") return "public";
  if (raw === "public" || raw === "unlisted") return raw;
  throw new ValidationError("Visibility must be public or unlisted.");
}

export interface CreateMemorialInput {
  name: string;
  born: string;
  died: string;
  epitaph: string;
  biography: string;
  location: string;
  quote: string;
  quoteAuthor: string;
  visibility: "public" | "unlisted";
  links: ExternalLink[];
  donations: DonationLink[];
  media: MediaItem[];
  slug: string;
}

export function validateCreateInput(raw: unknown): CreateMemorialInput {
  if (!raw || typeof raw !== "object") throw new ValidationError("Missing request body.");
  const body = raw as Record<string, unknown>;
  const name = validateName(body.name);
  const requestedSlug = normalizeText(body.slug, 60, "Slug");
  const slugBase = requestedSlug ? requestedSlug : slugify(name);
  const slug = slugify(slugBase);
  if (!slug || !isValidSlug(slug)) {
    throw new ValidationError("Choose a web address using letters, numbers and dashes (3–60 characters).");
  }
  return {
    name,
    born: normalizeText(body.born, LIMITS.location, "Born"),
    died: normalizeText(body.died, LIMITS.location, "Died"),
    epitaph: normalizeText(body.epitaph, LIMITS.epitaph, "Epitaph"),
    biography: normalizeText(body.biography, LIMITS.biography, "Biography"),
    location: normalizeText(body.location, LIMITS.location, "Location"),
    quote: normalizeText(body.quote, LIMITS.quote, "Quote"),
    quoteAuthor: normalizeText(body.quoteAuthor, LIMITS.quoteAuthor, "Quote author"),
    visibility: validateVisibility(body.visibility),
    links: validateLinkList(body.links, "links"),
    donations: validateLinkList(body.donations, "donations"),
    media: validateMediaList(body.media),
    slug,
  };
}

/** Validates a partial update of the editable memorial fields. */
export function validateMemorialPatch(raw: unknown): Partial<CreateMemorialInput> {
  if (!raw || typeof raw !== "object") throw new ValidationError("Missing request body.");
  const body = raw as Record<string, unknown>;
  const patch: Partial<CreateMemorialInput> = {};
  if ("name" in body) patch.name = validateName(body.name);
  if ("born" in body) patch.born = normalizeText(body.born, LIMITS.location, "Born");
  if ("died" in body) patch.died = normalizeText(body.died, LIMITS.location, "Died");
  if ("epitaph" in body) patch.epitaph = normalizeText(body.epitaph, LIMITS.epitaph, "Epitaph");
  if ("biography" in body) patch.biography = normalizeText(body.biography, LIMITS.biography, "Biography");
  if ("location" in body) patch.location = normalizeText(body.location, LIMITS.location, "Location");
  if ("quote" in body) patch.quote = normalizeText(body.quote, LIMITS.quote, "Quote");
  if ("quoteAuthor" in body) patch.quoteAuthor = normalizeText(body.quoteAuthor, LIMITS.quoteAuthor, "Quote author");
  if ("visibility" in body) patch.visibility = validateVisibility(body.visibility);
  if ("links" in body) patch.links = validateLinkList(body.links, "links");
  if ("donations" in body) patch.donations = validateLinkList(body.donations, "donations");
  if ("media" in body) patch.media = validateMediaList(body.media);
  if (Object.keys(patch).length === 0) throw new ValidationError("Nothing to update.");
  return patch;
}

export interface StoryInput {
  title: string;
  author: string;
  relation: string;
  date: string;
  body: string;
}

export function validateStoryInput(raw: unknown): StoryInput {
  if (!raw || typeof raw !== "object") throw new ValidationError("Missing request body.");
  const body = raw as Record<string, unknown>;
  return {
    title: normalizeText(body.title, LIMITS.storyTitle, "Title"),
    author: normalizeText(body.author, LIMITS.storyAuthor, "Your name", { required: true }),
    relation: normalizeText(body.relation, LIMITS.storyRelation, "Relationship"),
    date: normalizeText(body.date, LIMITS.storyDate, "Date"),
    body: normalizeText(body.body, LIMITS.storyBody, "Story", { required: true }),
  };
}

/** Photo file names are generated server-side; this guards against traversal. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  return base.replace(/[^A-Za-z0-9._-]/g, "").replace(/^\.+/, "").slice(0, 80) || "file";
}
