/** Hard limits enforced on every write so a memorial (and the repo) stays lean. */

export const LIMITS = {
  name: 80,
  epitaph: 160,
  biography: 20_000,
  location: 120,
  quote: 400,
  quoteAuthor: 80,
  linkLabel: 60,
  url: 500,
  caption: 300,
  storyTitle: 120,
  storyAuthor: 80,
  storyRelation: 80,
  storyDate: 60,
  storyBody: 10_000,
  maxPhotos: 120,
  maxStories: 200,
  maxLinks: 12,
  maxDonations: 12,
  maxMedia: 12,
} as const;

/**
 * Maximum accepted upload size for a single photo after the browser has
 * downscaled it. Everything committed to git is permanent, so this stays
 * deliberately small.
 */
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/** Slug rules: lowercase, digits and dashes, 3–60 chars. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

/** Names that would collide with real routes or infrastructure paths. */
export const RESERVED_SLUGS = new Set([
  "api",
  "admin",
  "manage",
  "create",
  "explore",
  "how-it-works",
  "privacy",
  "about",
  "m",
  "assets",
  "images",
  "public",
  "static",
  "_astro",
  "favicon",
  "robots",
  "sitemap",
  "opengraph",
  "404",
  "500",
]);
