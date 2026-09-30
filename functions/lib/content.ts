import type { GithubClient } from "./github";
import { photoPath, photosPath, normalizeStory, storyPath, storiesPath } from "../../shared/memorial";
import type { Memorial, PhotoMeta, Story } from "../../shared/types";
import { HttpError } from "./http";
import { LIMITS } from "../../shared/limits";
import { sanitizeFileName } from "../../shared/validate";

export interface PhotoResource extends PhotoMeta {
  url: string;
  bytes?: number;
}

/** Merges the caption order stored in memorial.json with the files on disk. */
export async function loadPhotos(github: GithubClient, memorial: Memorial): Promise<PhotoResource[]> {
  const entries = await github.listDir(photosPath(memorial.slug));
  const onDisk = new Map(
    entries
      .filter((entry) => entry.type === "file" && !entry.name.startsWith("."))
      .map((entry) => [entry.name, entry]),
  );
  const seen = new Set<string>();
  const photos: PhotoResource[] = [];
  for (const meta of memorial.photos) {
    const entry = onDisk.get(meta.file);
    if (!entry) continue;
    seen.add(meta.file);
    photos.push({
      ...meta,
      url: github.rawUrl(photoPath(memorial.slug, meta.file)),
      bytes: entry.size,
    });
  }
  for (const [name, entry] of onDisk) {
    if (seen.has(name)) continue;
    photos.push({
      file: name,
      caption: "",
      url: github.rawUrl(photoPath(memorial.slug, name)),
      bytes: entry.size,
    });
  }
  return photos;
}

export async function loadStories(github: GithubClient, slug: string): Promise<Story[]> {
  const entries = await github.listDir(storiesPath(slug));
  const files = entries
    .filter((entry) => entry.type === "file" && entry.name.endsWith(".json"))
    .slice(0, LIMITS.maxStories);
  const stories = await Promise.all(
    files.map(async (entry) => {
      const file = await github.getFile(entry.path);
      if (!file) return null;
      try {
        return normalizeStory(JSON.parse(file.content));
      } catch {
        return null;
      }
    }),
  );
  return stories
    .filter((story): story is Story => story !== null && story.body.length > 0)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function findPhotoEntry(github: GithubClient, slug: string, file: string) {
  const safe = sanitizeFileName(file);
  const entries = await github.listDir(photosPath(slug));
  const entry = entries.find((item) => item.name === safe && item.type === "file");
  if (!entry) throw new HttpError(404, "That photo is no longer on the memorial.");
  return entry;
}

export async function findStoryEntry(github: GithubClient, slug: string, id: string) {
  const safe = sanitizeFileName(id);
  const entries = await github.listDir(storiesPath(slug));
  const entry = entries.find((item) => item.name === `${safe}.json` && item.type === "file");
  if (!entry) throw new HttpError(404, "That story is no longer on the memorial.");
  return entry;
}

export { storyPath, photoPath };
