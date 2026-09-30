import type { Config } from "./env";
import { HttpError } from "./http";
import { base64ToUtf8, bytesToBase64, utf8ToBase64 } from "../../shared/base64";

export interface GithubDirEntry {
  name: string;
  path: string;
  sha: string;
  type: "file" | "dir";
  size: number;
}

export interface GithubFile {
  /** Decoded UTF-8 content. */
  content: string;
  sha: string;
}

/**
 * Thin GitHub REST client. The repository *is* the database: every memorial is
 * a directory of files, and every edit is a commit — which also means every
 * edit is versioned, auditable and restorable for free.
 */
export class GithubClient {
  constructor(
    private readonly config: Config,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private api(path: string, ref?: string): string {
    const suffix = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return `https://api.github.com/repos/${this.config.repo}/contents/${encodePath(path)}${suffix}`;
  }

  private headers(): Record<string, string> {
    return {
      authorization: `Bearer ${this.config.token}`,
      accept: "application/vnd.github+json",
      "user-agent": "libre-memorial",
      "x-github-api-version": "2022-11-28",
    };
  }

  /** Public raw URL for a committed file (used for editor previews). */
  rawUrl(path: string): string {
    return `https://raw.githubusercontent.com/${this.config.repo}/${this.config.branch}/${encodePath(path)}`;
  }

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetcher(url, {
      ...init,
      headers: { ...this.headers(), ...(init.headers as Record<string, string> | undefined) },
    });
    if (response.status === 401) {
      throw new HttpError(503, "The GitHub token is invalid or expired.");
    }
    if (response.status === 403) {
      throw new HttpError(503, "GitHub refused the request (rate limit or missing permissions).");
    }
    if (response.status >= 500) {
      throw new HttpError(502, "GitHub is unavailable right now. Please try again.");
    }
    if (response.status === 409) {
      throw new GithubConflict();
    }
    return response;
  }

  async getFile(path: string): Promise<GithubFile | null> {
    const response = await this.request(this.api(path, this.config.branch));
    if (response.status === 404) return null;
    if (!response.ok) throw new HttpError(502, `Could not read ${path} from GitHub.`);
    const data = (await response.json()) as { content?: string; sha?: string };
    if (!data.content) return null;
    return { content: base64ToUtf8(data.content.replace(/\s+/g, "")), sha: data.sha ?? "" };
  }

  async listDir(path: string): Promise<GithubDirEntry[]> {
    const response = await this.request(this.api(path, this.config.branch));
    if (response.status === 404) return [];
    if (!response.ok) throw new HttpError(502, `Could not list ${path} from GitHub.`);
    const data = (await response.json()) as GithubDirEntry[] | GithubDirEntry;
    if (!Array.isArray(data)) return [];
    return data.map((entry) => ({
      name: entry.name,
      path: entry.path,
      sha: entry.sha,
      type: entry.type,
      size: entry.size ?? 0,
    }));
  }

  async exists(path: string): Promise<boolean> {
    const response = await this.request(this.api(path, this.config.branch));
    if (response.status === 404) return false;
    if (!response.ok) throw new HttpError(502, `Could not check ${path} on GitHub.`);
    return true;
  }

  /** Creates or updates a text file. Pass `sha` when overwriting. */
  async putFile(path: string, content: string, message: string, sha?: string): Promise<string> {
    return this.putBinary(path, utf8ToBase64(content), message, sha);
  }

  async putBinary(path: string, base64: string, message: string, sha?: string): Promise<string> {
    const response = await this.request(this.api(path), {
      method: "PUT",
      body: JSON.stringify({
        message,
        content: base64,
        branch: this.config.branch,
        ...(sha ? { sha } : {}),
      }),
    });
    if (!response.ok) {
      const detail = await safeText(response);
      throw new HttpError(502, `Could not commit ${path} to GitHub. ${detail}`.trim());
    }
    const data = (await response.json()) as { content?: { sha?: string } };
    return data.content?.sha ?? "";
  }

  async deleteFile(path: string, sha: string, message: string): Promise<void> {
    const response = await this.request(this.api(path), {
      method: "DELETE",
      body: JSON.stringify({ message, sha, branch: this.config.branch }),
    });
    if (!response.ok && response.status !== 404) {
      throw new HttpError(502, `Could not delete ${path} from GitHub.`);
    }
  }

  /** Uploads raw bytes (photos) as a new file. */
  async putBytes(path: string, bytes: Uint8Array, message: string): Promise<string> {
    return this.putBinary(path, bytesToBase64(bytes), message);
  }

  /**
   * Read-modify-write a JSON file, retrying on concurrent-edit conflicts so two
   * people adding photos at the same time do not lose each other's work.
   */
  async updateJson<T>(
    path: string,
    mutate: (current: unknown) => T,
    message: string,
    attempts = 4,
  ): Promise<T> {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const file = await this.getFile(path);
      const current = file ? safeParse(file.content) : null;
      const next = mutate(current);
      try {
        await this.putFile(path, `${JSON.stringify(next, null, 2)}\n`, message, file?.sha);
        return next;
      } catch (error) {
        if (error instanceof GithubConflict && attempt < attempts) continue;
        throw error;
      }
    }
    throw new HttpError(409, "Someone else edited this memorial at the same time. Please retry.");
  }
}

class GithubConflict extends Error {}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "";
  }
}
