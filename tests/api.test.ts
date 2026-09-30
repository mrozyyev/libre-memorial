import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequestPost as createMemorial } from "../functions/api/create";
import { onRequestGet as health } from "../functions/api/health";
import { onRequestGet as getMemorial } from "../functions/api/memorials/[slug]/index";
import { onRequestPost as updateMemorial } from "../functions/api/memorials/[slug]/update";
import {
  onRequestDelete as deletePhoto,
  onRequestPost as addPhoto,
  onRequestPut as editPhoto,
} from "../functions/api/memorials/[slug]/photos";
import {
  onRequestDelete as deleteStory,
  onRequestPost as addStory,
  onRequestPut as editStory,
} from "../functions/api/memorials/[slug]/stories";
import { FakeGithub, pngDataUrl, utf8ToBase64 } from "./helpers/fake-github";
import { call } from "./helpers/api";
import { verifyEditKey } from "../shared/crypto";
import { memorialPath, photoPath, storyPath } from "../shared/memorial";
import type { Memorial } from "../shared/types";

const github = new FakeGithub();

/** Every request gets its own IP so the in-memory rate limiter stays out of the way. */
let ipCounter = 0;
function ip(): Record<string, string> {
  ipCounter += 1;
  return { "cf-connecting-ip": `10.0.0.${ipCounter}` };
}

function storedMemorial(slug: string): Memorial {
  return JSON.parse(github.read(memorialPath(slug))!) as Memorial;
}

interface Created {
  slug: string;
  editKey: string;
}

let created: Created;

beforeEach(async () => {
  github.reset();
  vi.stubGlobal("fetch", github.fetch);
  const response = await call(createMemorial, {
    method: "POST",
    path: "https://example.com/api/create",
    headers: ip(),
    body: { name: "Maria Popescu", born: "1943-05-02", epitaph: "She planted trees." },
  });
  created = { slug: response.body.slug, editKey: response.body.editKey };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/health", () => {
  const path = "https://example.com/api/health";

  it("reports configured when every variable is present", async () => {
    const response = await call(health, { path });
    expect(response.body).toEqual({
      ok: true,
      service: "libre-memorial",
      configured: true,
      turnstile: false,
    });
  });

  it("names each missing variable so a self-hoster does not have to guess", async () => {
    const response = await call(health, { path, env: {} });
    expect(response.body.configured).toBe(false);
    expect(response.body.missing).toEqual(["GITHUB_TOKEN", "GITHUB_REPO"]);
  });

  it("flags a malformed GITHUB_REPO and a blank GITHUB_TOKEN", async () => {
    const malformed = await call(health, {
      path,
      env: { GITHUB_TOKEN: "t", GITHUB_REPO: "not-a-repo" },
    });
    expect(malformed.body.missing).toEqual(["GITHUB_REPO"]);

    const blank = await call(health, {
      path,
      env: { GITHUB_TOKEN: "   ", GITHUB_REPO: "owner/repo" },
    });
    expect(blank.body.missing).toEqual(["GITHUB_TOKEN"]);
  });
});

describe("POST /api/create", () => {
  it("creates a memorial and returns a working edit key", async () => {
    const stored = storedMemorial(created.slug);
    expect(stored.name).toBe("Maria Popescu");
    expect(stored.slug).toBe("maria-popescu");
    expect(stored.photos).toEqual([]);
    expect(await verifyEditKey(stored.auth.salt, stored.auth.keyHash, created.editKey)).toBe(true);
    expect(stored.createdAt).toMatch(/^\d{4}-/);
  });

  it("never stores the plaintext key", async () => {
    const raw = github.read(memorialPath(created.slug))!;
    expect(raw).not.toContain(created.editKey);
  });

  it("derives a unique slug when the name is already taken", async () => {
    const again = await call(createMemorial, {
      method: "POST",
      path: "https://example.com/api/create",
      headers: ip(),
      body: { name: "Maria Popescu" },
    });
    expect(again.status).toBe(201);
    expect(again.body.slug).toBe("maria-popescu-2");
  });

  it("rejects a malformed body", async () => {
    const response = await call(createMemorial, {
      method: "POST",
      path: "https://example.com/api/create",
      headers: ip(),
      body: { name: "M" },
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/at least 2/);
  });

  it("silently refuses honeypot submissions", async () => {
    const response = await call(createMemorial, {
      method: "POST",
      path: "https://example.com/api/create",
      headers: ip(),
      body: { name: "Spam Bot", website: "http://spam.example" },
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/spam/);
  });

  it("reports a clear error when the deployment is not configured", async () => {
    const response = await call(createMemorial, {
      method: "POST",
      path: "https://example.com/api/create",
      headers: ip(),
      env: { GITHUB_REPO: "owner/repo" },
      body: { name: "Ana Ionescu" },
    });
    expect(response.status).toBe(503);
    expect(response.body.error).toMatch(/GITHUB_TOKEN/);
  });

  it("rate limits repeated creations from one address", async () => {
    const headers = { "cf-connecting-ip": "203.0.113.9" };
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await call(createMemorial, {
        method: "POST",
        path: "https://example.com/api/create",
        headers,
        body: { name: `Person ${attempt}` },
      });
      statuses.push(response.status);
    }
    expect(statuses.filter((status) => status === 201)).toHaveLength(6);
    expect(statuses.at(-1)).toBe(429);
  });
});

describe("GET /api/memorials/:slug", () => {
  it("returns public data and never leaks the auth block", async () => {
    const response = await call(getMemorial, {
      path: "https://example.com/api/memorials/maria-popescu",
      params: { slug: created.slug },
    });
    expect(response.status).toBe(200);
    expect(response.body.memorial.name).toBe("Maria Popescu");
    expect(response.body.memorial.auth).toBeUndefined();
    expect(response.body.canEdit).toBe(false);
    expect(response.body.photos).toEqual([]);
    expect(response.body.counts).toEqual({ photos: 0, stories: 0 });
  });

  it("reports canEdit when the right key is presented", async () => {
    const response = await call(getMemorial, {
      path: "https://example.com/api/memorials/maria-popescu",
      params: { slug: created.slug },
      headers: { "x-edit-key": created.editKey },
    });
    expect(response.body.canEdit).toBe(true);
  });

  it("does not report canEdit for a wrong key", async () => {
    const response = await call(getMemorial, {
      path: "https://example.com/api/memorials/maria-popescu",
      params: { slug: created.slug },
      headers: { "x-edit-key": "not-the-key" },
    });
    expect(response.body.canEdit).toBe(false);
  });

  it("404s for unknown or invalid slugs", async () => {
    const unknown = await call(getMemorial, {
      path: "https://example.com/api/memorials/nobody",
      params: { slug: "nobody" },
    });
    expect(unknown.status).toBe(404);
    const invalid = await call(getMemorial, {
      path: "https://example.com/api/memorials/..%2F..",
      params: { slug: "../.." },
    });
    expect(invalid.status).toBe(404);
  });
});

describe("POST /api/memorials/:slug/update", () => {
  const base = {
    method: "POST" as const,
    path: "https://example.com/api/memorials/maria-popescu/update",
    params: { slug: "maria-popescu" },
  };

  it("requires a key", async () => {
    const response = await call(updateMemorial, { ...base, body: { epitaph: "Hi" } });
    expect(response.status).toBe(401);
  });

  it("rejects a wrong key", async () => {
    const response = await call(updateMemorial, {
      ...base,
      headers: { "x-edit-key": "wrong" },
      body: { epitaph: "Hi" },
    });
    expect(response.status).toBe(403);
  });

  it("applies a patch with the right key", async () => {
    const response = await call(updateMemorial, {
      ...base,
      headers: { "x-edit-key": created.editKey },
      body: { epitaph: "A new line", donations: [{ label: "Hospice", url: "https://hospice.ro/" }] },
    });
    expect(response.status).toBe(200);
    expect(response.body.memorial.epitaph).toBe("A new line");
    const stored = storedMemorial(created.slug);
    expect(stored.epitaph).toBe("A new line");
    expect(stored.donations).toHaveLength(1);
  });

  it("stores embedded videos and drops links that are not videos", async () => {
    const response = await call(updateMemorial, {
      ...base,
      headers: { "x-edit-key": created.editKey },
      body: {
        media: [
          { title: "Her song", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
          { url: "https://example.com/not-a-video" },
        ],
      },
    });
    expect(response.status).toBe(200);
    const stored = storedMemorial(created.slug);
    expect(stored.media).toEqual([
      {
        provider: "youtube",
        id: "dQw4w9WgXcQ",
        title: "Her song",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
    ]);
  });

  it("rejects an empty patch", async () => {
    const response = await call(updateMemorial, {
      ...base,
      headers: { "x-edit-key": created.editKey },
      body: {},
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Nothing to update/);
  });
});

describe("photos", () => {
  const params = { slug: "maria-popescu" };
  const base = "https://example.com/api/memorials/maria-popescu/photos";

  it("uploads a photo, records it and makes it the portrait", async () => {
    const response = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { dataUrl: pngDataUrl(), caption: "In the garden" },
    });
    expect(response.status).toBe(201);
    const file = response.body.photo.file as string;
    expect(file).toMatch(/\.png$/);
    expect(github.has(photoPath(created.slug, file))).toBe(true);

    const stored = storedMemorial(created.slug);
    expect(stored.photos).toEqual([
      { file, caption: "In the garden", createdAt: expect.any(String) },
    ]);
    expect(stored.cover).toBe(file);

    const listed = await call(getMemorial, {
      path: "https://example.com/api/memorials/maria-popescu",
      params,
    });
    expect(listed.body.photos).toHaveLength(1);
    expect(listed.body.photos[0].url).toMatch(/^https:\/\/raw\.githubusercontent\.com\//);
  });

  it("refuses anything that is not a real image", async () => {
    const response = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { dataUrl: `data:image/png;base64,${utf8ToBase64("not an image at all")}` },
    });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/JPEG, PNG/);
  });

  it("requires the key to upload", async () => {
    const response = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: ip(),
      body: { dataUrl: pngDataUrl() },
    });
    expect(response.status).toBe(401);
  });

  it("updates a caption and changes the portrait", async () => {
    const first = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { dataUrl: pngDataUrl() },
    });
    const second = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { dataUrl: pngDataUrl() },
    });
    const file = second.body.photo.file as string;

    const updated = await call(editPhoto, {
      method: "PUT",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { file, caption: "Later years", makeCover: true },
    });
    expect(updated.status).toBe(200);

    const stored = storedMemorial(created.slug);
    expect(stored.cover).toBe(file);
    expect(stored.photos.find((photo) => photo.file === file)?.caption).toBe("Later years");
    expect(stored.photos.find((photo) => photo.file === first.body.photo.file)?.caption).toBe("");
  });

  it("reorders the gallery", async () => {
    const first = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { dataUrl: pngDataUrl() },
    });
    const second = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { dataUrl: pngDataUrl() },
    });

    const order = [second.body.photo.file, first.body.photo.file];
    const response = await call(editPhoto, {
      method: "PUT",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { order },
    });
    expect(response.status).toBe(200);
    expect(storedMemorial(created.slug).photos.map((photo) => photo.file)).toEqual(order);
  });

  it("deletes a photo and its metadata", async () => {
    const added = await call(addPhoto, {
      method: "POST",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { dataUrl: pngDataUrl() },
    });
    const file = added.body.photo.file as string;

    const response = await call(deletePhoto, {
      method: "DELETE",
      path: base,
      params,
      headers: { "x-edit-key": created.editKey, ...ip() },
      body: { file },
    });
    expect(response.status).toBe(200);
    expect(github.has(photoPath(created.slug, file))).toBe(false);
    const stored = storedMemorial(created.slug);
    expect(stored.photos).toEqual([]);
    expect(stored.cover).toBeUndefined();
  });
});

describe("stories", () => {
  const params = { slug: "maria-popescu" };
  const base = "https://example.com/api/memorials/maria-popescu/stories";
  const auth = () => ({ "x-edit-key": created.editKey, ...ip() });

  it("adds, edits and removes a memory", async () => {
    const added = await call(addStory, {
      method: "POST",
      path: base,
      params,
      headers: auth(),
      body: { author: "Ana", relation: "Granddaughter", body: "She played the accordion." },
    });
    expect(added.status).toBe(201);
    const id = added.body.story.id as string;
    expect(github.has(storyPath(created.slug, id))).toBe(true);

    const listed = await call(getMemorial, {
      path: "https://example.com/api/memorials/maria-popescu",
      params,
    });
    expect(listed.body.stories).toHaveLength(1);
    expect(listed.body.stories[0].author).toBe("Ana");

    const edited = await call(editStory, {
      method: "PUT",
      path: base,
      params,
      headers: auth(),
      body: { id, author: "Ana", body: "She played the accordion on Thursdays." },
    });
    expect(edited.status).toBe(200);
    expect(edited.body.story.id).toBe(id);
    expect(edited.body.story.createdAt).toBe(added.body.story.createdAt);

    const removed = await call(deleteStory, {
      method: "DELETE",
      path: base,
      params,
      headers: auth(),
      body: { id },
    });
    expect(removed.status).toBe(200);
    expect(github.has(storyPath(created.slug, id))).toBe(false);
  });

  it("requires an author and a body", async () => {
    const response = await call(addStory, {
      method: "POST",
      path: base,
      params,
      headers: auth(),
      body: { author: "Ana" },
    });
    expect(response.status).toBe(400);
  });

  it("will not edit a story that does not exist", async () => {
    const response = await call(editStory, {
      method: "PUT",
      path: base,
      params,
      headers: auth(),
      body: { id: "nope", author: "Ana", body: "Text" },
    });
    expect(response.status).toBe(404);
  });
});
