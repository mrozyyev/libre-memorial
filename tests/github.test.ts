import { afterEach, describe, expect, it, vi } from "vitest";
import { GithubClient } from "../functions/lib/github";
import { HttpError } from "../functions/lib/http";
import { FakeGithub } from "./helpers/fake-github";
import type { Config } from "../functions/lib/env";

const github = new FakeGithub();
const config: Config = {
  token: "test-token",
  repo: "owner/repo",
  branch: "main",
  allowedOrigins: [],
};

function client(): GithubClient {
  return new GithubClient(config);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GithubClient", () => {
  it("commits and reads a text file", async () => {
    vi.stubGlobal("fetch", github.fetch);
    const sha = await client().putFile("src/x.json", '{"a":1}', "Add x");
    expect(sha).toBeTruthy();
    await expect(client().getFile("src/x.json")).resolves.toEqual({
      content: '{"a":1}',
      sha,
    });
    expect(github.log()).toEqual([{ path: "src/x.json", message: "Add x" }]);
  });

  it("returns null for a missing file", async () => {
    vi.stubGlobal("fetch", github.fetch);
    await expect(client().getFile("nope.json")).resolves.toBeNull();
    await expect(client().exists("nope.json")).resolves.toBe(false);
  });

  it("lists a directory and reports existence", async () => {
    github.seed("src/content/memorials/a/photos/1.jpg", "x");
    github.seed("src/content/memorials/a/photos/2.jpg", "y");
    vi.stubGlobal("fetch", github.fetch);
    const entries = await client().listDir("src/content/memorials/a/photos");
    expect(entries.map((entry) => entry.name)).toEqual(["1.jpg", "2.jpg"]);
    await expect(client().exists("src/content/memorials/a/photos/1.jpg")).resolves.toBe(true);
  });

  it("uploads binary content", async () => {
    vi.stubGlobal("fetch", github.fetch);
    await client().putBytes("photos/a.jpg", new Uint8Array([1, 2, 3]), "Add photo");
    expect(github.has("photos/a.jpg")).toBe(true);
  });

  it("deletes a file with the right sha", async () => {
    github.seed("gone.json", "{}");
    vi.stubGlobal("fetch", github.fetch);
    const file = await client().getFile("gone.json");
    await client().deleteFile("gone.json", file!.sha, "Remove gone");
    expect(github.has("gone.json")).toBe(false);
  });

  it("exposes a raw url for previews", () => {
    expect(client().rawUrl("src/a b/c.jpg")).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/src/a%20b/c.jpg",
    );
  });

  /**
   * The Workers runtime rejects a global `fetch` invoked with a non-global
   * receiver ("Illegal invocation"). Node does not, so this test mimics the
   * strictness: it fails if the client ever hands itself to fetch as `this`.
   */
  it("calls fetch with no receiver, as the Workers runtime requires", async () => {
    const receivers: unknown[] = [];
    const strictFetch = function (this: unknown) {
      receivers.push(this);
      return Promise.resolve(new Response(JSON.stringify({ content: "", sha: "s" }), { status: 200 }));
    };
    vi.stubGlobal("fetch", strictFetch);

    // No injected fetcher: this is the path production takes.
    await client().getFile("anything.json");

    expect(receivers).toHaveLength(1);
    expect(receivers[0]).toBeUndefined();
  });

  it("maps upstream auth failures to a clear 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 401 })),
    );
    await expect(client().getFile("x")).rejects.toBeInstanceOf(HttpError);
    await expect(client().getFile("x")).rejects.toMatchObject({ status: 503 });
  });

  it("surfaces a friendly error when GitHub fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    await expect(client().getFile("x")).rejects.toMatchObject({ status: 502 });
  });

  it("retries a read-modify-write when someone else commits first", async () => {
    github.seed("counters.json", '{"n":1}');
    vi.stubGlobal("fetch", github.fetch);

    let interfered = false;
    const value = await client().updateJson(
      "counters.json",
      (current) => {
        const parsed = current as { n: number };
        // Simulate a concurrent edit landing between read and write.
        if (!interfered) {
          interfered = true;
          const committed = github.read("counters.json")!;
          const next = JSON.stringify({ n: JSON.parse(committed).n + 1 });
          github.seed("counters.json", next);
        }
        return { n: parsed.n + 1 };
      },
      "Bump counter",
    );

    expect(interfered).toBe(true);
    expect(value).toEqual({ n: 3 });
    expect(JSON.parse(github.read("counters.json")!)).toEqual({ n: 3 });
  });
});
