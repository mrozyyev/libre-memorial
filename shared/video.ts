/**
 * Video and music support is embed-only. Hosting media files would bloat the
 * repository — the opposite of what this project is for — so a memorial stores
 * a provider and an id, and the page renders a click-to-load player.
 *
 * Nothing is requested from YouTube or Vimeo until a visitor presses play, and
 * YouTube uses the privacy-enhanced (nocookie) domain.
 */

export type MediaProvider = "youtube" | "vimeo";

export interface MediaItem {
  provider: MediaProvider;
  id: string;
  title?: string;
  /** The link as the family entered it, kept for display. */
  url: string;
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,24}$/;
const VIMEO_ID = /^\d{6,12}$/;

/** Understands the shapes people actually paste, or returns null. */
export function parseVideoUrl(raw: string): MediaItem | null {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const path = url.pathname.replace(/\/+$/, "");

  if (host === "youtu.be") {
    const id = path.slice(1);
    return YOUTUBE_ID.test(id) ? { provider: "youtube", id, url: value } : null;
  }

  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const fromQuery = url.searchParams.get("v");
    if (fromQuery && YOUTUBE_ID.test(fromQuery)) {
      return { provider: "youtube", id: fromQuery, url: value };
    }
    const match = /^\/(?:embed|shorts|v|live)\/([^/]+)/.exec(path);
    if (match && YOUTUBE_ID.test(match[1])) {
      return { provider: "youtube", id: match[1], url: value };
    }
    return null;
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const match = /^\/(?:video\/)?(\d+)/.exec(path);
    if (match && VIMEO_ID.test(match[1])) {
      return { provider: "vimeo", id: match[1], url: value };
    }
    return null;
  }

  return null;
}

/** Only ever built from a validated id, and only used after a click. */
export function embedUrl(item: MediaItem): string {
  if (item.provider === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${item.id}?autoplay=1&rel=0`;
  }
  return `https://player.vimeo.com/video/${item.id}?autoplay=1`;
}

export function providerLabel(provider: MediaProvider): string {
  return provider === "youtube" ? "YouTube" : "Vimeo";
}
