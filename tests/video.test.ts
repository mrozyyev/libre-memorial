import { describe, expect, it } from "vitest";
import { embedUrl, parseVideoUrl, providerLabel } from "../shared/video";
import { validateMediaList } from "../shared/validate";

describe("parseVideoUrl", () => {
  it("understands the YouTube shapes people paste", () => {
    const expected = { provider: "youtube", id: "dQw4w9WgXcQ" };
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://youtu.be/dQw4w9WgXcQ?si=abc",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      expect(parseVideoUrl(url), url).toMatchObject(expected);
    }
  });

  it("understands Vimeo", () => {
    for (const url of [
      "https://vimeo.com/123456789",
      "https://www.vimeo.com/123456789",
      "https://player.vimeo.com/video/123456789",
    ]) {
      expect(parseVideoUrl(url), url).toMatchObject({ provider: "vimeo", id: "123456789" });
    }
  });

  it("rejects everything it cannot embed", () => {
    for (const url of [
      "",
      "not a url",
      "javascript:alert(1)",
      "data:text/html,<script>",
      "https://example.com/video.mp4",
      "https://www.youtube.com/",
      "https://www.youtube.com/watch?v=short",
      "https://vimeo.com/album/12345",
      "https://vimeo.com/abc",
      "ftp://youtube.com/watch?v=dQw4w9WgXcQ",
    ]) {
      expect(parseVideoUrl(url), url).toBeNull();
    }
  });

  it("keeps the original link for display", () => {
    const parsed = parseVideoUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(parsed?.url).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("only ever builds embeds from a known provider id", () => {
    expect(embedUrl({ provider: "youtube", id: "dQw4w9WgXcQ", url: "" })).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0",
    );
    expect(embedUrl({ provider: "vimeo", id: "123456789", url: "" })).toBe(
      "https://player.vimeo.com/video/123456789?autoplay=1",
    );
    expect(providerLabel("youtube")).toBe("YouTube");
    expect(providerLabel("vimeo")).toBe("Vimeo");
  });
});

describe("validateMediaList", () => {
  it("keeps recognised videos and an optional title", () => {
    const media = validateMediaList([
      { title: "Her favourite song", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { url: "https://vimeo.com/123456789" },
    ]);
    expect(media).toEqual([
      {
        provider: "youtube",
        id: "dQw4w9WgXcQ",
        title: "Her favourite song",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      },
      { provider: "vimeo", id: "123456789", url: "https://vimeo.com/123456789" },
    ]);
  });

  it("drops unrecognised links instead of failing the save", () => {
    const media = validateMediaList([
      { url: "https://example.com/not-a-video" },
      { url: "https://youtu.be/dQw4w9WgXcQ" },
      null,
      "nonsense",
    ]);
    expect(media).toHaveLength(1);
  });

  it("defaults to an empty list and rejects non-arrays and oversized lists", () => {
    expect(validateMediaList(undefined)).toEqual([]);
    expect(validateMediaList(null)).toEqual([]);
    expect(() => validateMediaList("nope")).toThrow(/must be a list/);
    expect(() =>
      validateMediaList(
        Array.from({ length: 13 }, () => ({ url: "https://youtu.be/dQw4w9WgXcQ" })),
      ),
    ).toThrow(/up to 12/);
  });
});
