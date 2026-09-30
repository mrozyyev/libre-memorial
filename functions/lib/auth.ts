import type { GithubClient } from "./github";
import { HttpError } from "./http";
import { isValidSlug } from "../../shared/slug";
import { memorialPath, normalizeMemorial } from "../../shared/memorial";
import { verifyEditKey } from "../../shared/crypto";
import type { Memorial } from "../../shared/types";

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function loadMemorial(github: GithubClient, slug: string): Promise<Memorial | null> {
  if (!isValidSlug(slug)) return null;
  const file = await github.getFile(memorialPath(slug));
  if (!file) return null;
  return normalizeMemorial(parseJson(file.content));
}

export async function requireMemorial(github: GithubClient, slug: string): Promise<Memorial> {
  const memorial = await loadMemorial(github, slug);
  if (!memorial) throw new HttpError(404, "That memorial could not be found.");
  return memorial;
}

/**
 * Authorises a write. The key lives only in the creator's browser (and on any
 * printed recovery sheet) and is checked against the hash committed to git.
 */
export async function requireEditKey(
  request: Request,
  github: GithubClient,
  slug: string,
): Promise<Memorial> {
  const memorial = await requireMemorial(github, slug);
  const key = request.headers.get("x-edit-key")?.trim() ?? "";
  if (!key) throw new HttpError(401, "Enter your edit key to make changes.");
  if (key.length > 128) throw new HttpError(403, "That edit key is not valid for this memorial.");
  const valid = await verifyEditKey(memorial.auth.salt, memorial.auth.keyHash, key);
  if (!valid) throw new HttpError(403, "That edit key is not valid for this memorial.");
  return memorial;
}
