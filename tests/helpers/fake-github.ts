import { bytesToBase64, base64ToBytes, base64ToUtf8, utf8ToBase64 } from "../../shared/base64";

interface Entry {
  bytes: Uint8Array;
  sha: string;
  message: string;
}

/**
 * A small in-memory stand-in for the GitHub Contents API, so the Cloudflare
 * Functions can be exercised end to end without a token or network access.
 */
export class FakeGithub {
  private files = new Map<string, Entry>();
  private commits: { path: string; message: string; deleted?: boolean }[] = [];
  private counter = 0;

  constructor(
    public repo = "owner/repo",
    public branch = "main",
  ) {}

  private nextSha(): string {
    this.counter += 1;
    return `sha-${this.counter}`;
  }

  /** Clears all content and history between tests. */
  reset(): void {
    this.files.clear();
    this.commits = [];
    this.counter = 0;
  }

  seed(path: string, content: string): void {
    this.files.set(path, {
      bytes: new TextEncoder().encode(content),
      sha: this.nextSha(),
      message: "seed",
    });
  }

  read(path: string): string | null {
    const entry = this.files.get(path);
    return entry ? new TextDecoder().decode(entry.bytes) : null;
  }

  has(path: string): boolean {
    return this.files.has(path);
  }

  paths(): string[] {
    return [...this.files.keys()].sort();
  }

  log(): { path: string; message: string; deleted?: boolean }[] {
    return this.commits;
  }

  private entryPayload(path: string, entry: Entry) {
    return {
      name: path.split("/").pop(),
      path,
      sha: entry.sha,
      type: "file",
      size: entry.bytes.byteLength,
      content: bytesToBase64(entry.bytes),
      encoding: "base64",
    };
  }

  fetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
    );
    const prefix = `/repos/${this.repo}/contents/`;
    if (!url.pathname.startsWith(prefix)) {
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    const method = (init.method ?? "GET").toUpperCase();

    if (method === "GET") {
      const entry = this.files.get(path);
      if (entry) {
        return new Response(JSON.stringify(this.entryPayload(path, entry)), { status: 200 });
      }
      const children = [...this.files.entries()].filter(([key]) =>
        key.startsWith(`${path}/`),
      );
      if (children.length > 0) {
        return new Response(
          JSON.stringify(children.map(([key, value]) => this.entryPayload(key, value))),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }

    if (method === "PUT") {
      const body = JSON.parse(String(init.body)) as {
        message: string;
        content: string;
        sha?: string;
      };
      const existing = this.files.get(path);
      if (body.sha && existing && body.sha !== existing.sha) {
        return new Response(JSON.stringify({ message: "Conflict" }), { status: 409 });
      }
      if (body.sha && !existing) {
        return new Response(JSON.stringify({ message: "Conflict" }), { status: 409 });
      }
      const entry: Entry = {
        bytes: base64ToBytes(body.content.replace(/\s+/g, "")),
        sha: this.nextSha(),
        message: body.message,
      };
      this.files.set(path, entry);
      this.commits.push({ path, message: body.message });
      return new Response(JSON.stringify({ content: { sha: entry.sha } }), { status: 200 });
    }

    if (method === "DELETE") {
      const body = JSON.parse(String(init.body)) as { message: string; sha: string };
      const existing = this.files.get(path);
      if (!existing) return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      if (body.sha !== existing.sha) {
        return new Response(JSON.stringify({ message: "Conflict" }), { status: 409 });
      }
      this.files.delete(path);
      this.commits.push({ path, message: body.message, deleted: true });
      return new Response(JSON.stringify({ commit: "ok" }), { status: 200 });
    }

    return new Response(JSON.stringify({ message: "Method Not Allowed" }), { status: 405 });
  };
}

/** A 1x1 PNG, base64 encoded, as the browser would send it. */
export function pngBytes(): Uint8Array {
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
  return base64ToBytes(base64);
}

export function pngDataUrl(): string {
  return `data:image/png;base64,${bytesToBase64(pngBytes())}`;
}

export { base64ToUtf8, utf8ToBase64 };
