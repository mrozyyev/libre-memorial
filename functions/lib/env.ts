/** Environment bindings / variables available to the Pages Functions. */
export interface Env {
  /** Fine-grained GitHub token with `contents: write` on the content repo. */
  GITHUB_TOKEN?: string;
  /** "owner/repo" that stores the memorial content. */
  GITHUB_REPO?: string;
  /** Branch to commit to. Defaults to "main". */
  GITHUB_BRANCH?: string;
  /** Optional Cloudflare Pages deploy hook, pinged after every commit. */
  DEPLOY_HOOK_URL?: string;
  /** Optional Turnstile secret; when set, forms must include a valid token. */
  TURNSTILE_SECRET?: string;
  /** Comma separated extra origins allowed to call the API. */
  ALLOWED_ORIGINS?: string;
}

export interface Config {
  token: string;
  repo: string;
  branch: string;
  deployHook?: string;
  turnstileSecret?: string;
  allowedOrigins: string[];
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function readConfig(env: Env): Config {
  const token = env.GITHUB_TOKEN?.trim();
  const repo = env.GITHUB_REPO?.trim();
  if (!token) throw new ConfigError("GITHUB_TOKEN is not configured on this deployment.");
  if (!repo || !/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new ConfigError('GITHUB_REPO must look like "owner/repo".');
  }
  return {
    token,
    repo,
    branch: env.GITHUB_BRANCH?.trim() || "main",
    deployHook: env.DEPLOY_HOOK_URL?.trim() || undefined,
    turnstileSecret: env.TURNSTILE_SECRET?.trim() || undefined,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
}
