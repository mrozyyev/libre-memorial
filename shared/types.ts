/**
 * Data model shared by the Astro site (read side) and the Cloudflare Pages
 * Functions (write side). Kept framework-free and dependency-free so it can be
 * bundled into a Worker as well as imported by Vite at build time.
 */

import type { MediaItem } from "./video";

export interface DonationLink {
  label: string;
  url: string;
}

export interface ExternalLink {
  label: string;
  url: string;
}

export interface PhotoMeta {
  /** File name relative to the memorial's `photos/` directory. */
  file: string;
  caption?: string;
  createdAt?: string;
}

export interface Story {
  id: string;
  title?: string;
  author: string;
  relation?: string;
  /** Free-form date or period the memory refers to. */
  date?: string;
  body: string;
  createdAt: string;
}

export interface MemorialAuth {
  /** Random per-memorial salt. */
  salt: string;
  /** SHA-256 of `salt + editKey`, hex encoded. The key itself is never stored. */
  keyHash: string;
}

export interface Memorial {
  slug: string;
  name: string;
  /** Free-form, e.g. "1943" or "1943-05-02". */
  born?: string;
  died?: string;
  /** Short line shown under the name. */
  epitaph?: string;
  /** Plain text. Blank lines separate paragraphs. */
  biography?: string;
  location?: string;
  quote?: string;
  quoteAuthor?: string;
  /** File name (relative to `photos/`) used as the portrait / cover image. */
  cover?: string;
  photos: PhotoMeta[];
  donations: DonationLink[];
  links: ExternalLink[];
  /** Embedded YouTube/Vimeo items; never hosted media files. */
  media: MediaItem[];
  visibility: "public" | "unlisted";
  createdAt: string;
  updatedAt: string;
  auth: MemorialAuth;
}

/** Memorial without the private auth block — safe to send to browsers. */
export type PublicMemorial = Omit<Memorial, "auth">;

export function toPublicMemorial(memorial: Memorial): PublicMemorial {
  const { auth: _auth, ...rest } = memorial;
  return rest;
}
