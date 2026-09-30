import { describe, expect, it } from "vitest";
import {
  applyMemorialPatch,
  createMemorialRecord,
  createStoryRecord,
  memorialPath,
  normalizeMemorial,
  normalizeStory,
  photoPath,
  photosPath,
  storyPath,
  storiesPath,
} from "../shared/memorial";
import type { CreateMemorialInput } from "../shared/validate";

const input: CreateMemorialInput = {
  name: "Maria Popescu",
  born: "1943-05-02",
  died: "2025-01-17",
  epitaph: "She planted trees.",
  biography: "A life.",
  location: "Cluj",
  quote: "",
  quoteAuthor: "",
  visibility: "public",
  links: [],
  donations: [],
  media: [],
  slug: "maria-popescu",
};

describe("paths", () => {
  it("builds repository paths safely", () => {
    expect(memorialPath("maria-popescu")).toBe("src/content/memorials/maria-popescu/memorial.json");
    expect(photosPath("x")).toBe("src/content/memorials/x/photos");
    expect(storiesPath("x")).toBe("src/content/memorials/x/stories");
    expect(photoPath("x", "../../evil.jpg")).toBe("src/content/memorials/x/photos/evil.jpg");
    expect(storyPath("x", "../evil")).toBe("src/content/memorials/x/stories/evil.json");
  });
});

describe("normalizeMemorial", () => {
  it("survives garbage input", () => {
    const memorial = normalizeMemorial(null);
    expect(memorial.name).toBe("Unnamed memorial");
    expect(memorial.photos).toEqual([]);
    expect(memorial.donations).toEqual([]);
    expect(memorial.visibility).toBe("public");
    expect(memorial.auth).toEqual({ salt: "", keyHash: "" });
  });

  it("drops malformed photos and links", () => {
    const memorial = normalizeMemorial({
      name: "X",
      photos: [
        { file: "ok.jpg", caption: "fine" },
        { file: "" },
        null,
        "nope",
      ],
      links: [{ url: "" }, { label: "Site", url: "https://a.com" }],
    });
    expect(memorial.photos).toEqual([{ file: "ok.jpg", caption: "fine", createdAt: undefined }]);
    expect(memorial.links).toEqual([{ label: "Site", url: "https://a.com" }]);
  });

  it("re-parses media on read so a hand-edited file cannot inject an iframe", () => {
    expect(normalizeMemorial(null).media).toEqual([]);
    expect(
      normalizeMemorial({
        name: "X",
        media: [
          { url: "https://www.youtube.com/embed/dQw4w9WgXcQ", title: "A song" },
          { url: "https://evil.example/embed/x" },
          { url: "javascript:alert(1)" },
        ],
      }).media,
    ).toEqual([
      {
        provider: "youtube",
        id: "dQw4w9WgXcQ",
        title: "A song",
        url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      },
    ]);
  });

  it("coerces unknown visibility to public", () => {
    expect(normalizeMemorial({ visibility: "private" }).visibility).toBe("public");
    expect(normalizeMemorial({ visibility: "unlisted" }).visibility).toBe("unlisted");
  });
});

describe("createMemorialRecord", () => {
  it("applies defaults and the supplied auth block", () => {
    const memorial = createMemorialRecord(input, { salt: "s", keyHash: "h" }, "2026-01-01T00:00:00.000Z");
    expect(memorial.slug).toBe("maria-popescu");
    expect(memorial.quote).toBeUndefined();
    expect(memorial.photos).toEqual([]);
    expect(memorial.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(memorial.updatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(memorial.auth).toEqual({ salt: "s", keyHash: "h" });
  });
});

describe("applyMemorialPatch", () => {
  const base = createMemorialRecord(input, { salt: "s", keyHash: "h" }, "2026-01-01T00:00:00.000Z");

  it("merges changes and bumps updatedAt", () => {
    const next = applyMemorialPatch(base, { epitaph: "New line" }, "2026-02-02T00:00:00.000Z");
    expect(next.epitaph).toBe("New line");
    expect(next.updatedAt).toBe("2026-02-02T00:00:00.000Z");
    expect(next.createdAt).toBe(base.createdAt);
  });

  it("clears fields that were emptied", () => {
    expect(applyMemorialPatch(base, { born: "" }).born).toBeUndefined();
  });

  it("never changes the slug", () => {
    expect(applyMemorialPatch(base, { slug: "something-else" } as never).slug).toBe("maria-popescu");
  });

  it("replaces link lists wholesale", () => {
    const next = applyMemorialPatch(base, {
      donations: [{ label: "Hospice", url: "https://hospice.ro/" }],
    });
    expect(next.donations).toHaveLength(1);
  });

  it("stores embedded media without touching the other lists", () => {
    const next = applyMemorialPatch(base, {
      media: [{ provider: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" }],
    });
    expect(next.media).toHaveLength(1);
    expect(next.media[0].provider).toBe("youtube");
    expect(base.media).toEqual([]);
  });

  it("does not mutate the original", () => {
    const next = applyMemorialPatch(base, { name: "Someone else" });
    expect(next).not.toBe(base);
    expect(base.name).toBe("Maria Popescu");
  });
});

describe("stories", () => {
  it("creates a story with a generated id", () => {
    const story = createStoryRecord(
      { title: "", author: "Ana", relation: "", date: "", body: "Text" },
      undefined,
      "2026-01-01T00:00:00.000Z",
    );
    expect(story.id).toMatch(/^[a-z0-9-]+$/);
    expect(story.title).toBeUndefined();
    expect(story.author).toBe("Ana");
    expect(story.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("normalises unknown story payloads", () => {
    expect(normalizeStory(undefined)).toMatchObject({ author: "Anonymous", body: "" });
    expect(normalizeStory({ author: "Bob", body: "Hi", extra: true }).author).toBe("Bob");
  });
});
