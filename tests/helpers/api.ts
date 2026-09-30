import type { Env } from "../../functions/lib/env";
import type { PagesContext, PagesHandler } from "../../functions/lib/types";

export interface CallOptions {
  method?: string;
  path?: string;
  body?: unknown;
  headers?: Record<string, string>;
  env?: Env;
  params?: Record<string, string>;
}

export const TEST_ENV: Env = {
  GITHUB_TOKEN: "test-token",
  GITHUB_REPO: "owner/repo",
  GITHUB_BRANCH: "main",
};

/** Builds the `context` argument that a Pages Function receives. */
export function makeContext(options: CallOptions = {}): PagesContext {
  const { method = "GET", path = "https://example.com/api/health", body, headers = {} } = options;
  const init: RequestInit = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!headers["content-type"]) {
      (init.headers as Record<string, string>)["content-type"] = "application/json";
    }
  }
  return {
    request: new Request(path, init),
    env: options.env ?? TEST_ENV,
    params: options.params ?? {},
    data: {},
    functionPath: new URL(path).pathname,
    waitUntil: () => undefined,
    next: async () => new Response("next"),
  };
}

/** Calls a Pages Function handler and returns the parsed JSON body + status. */
export async function call(
  handler: PagesHandler,
  options: CallOptions = {},
): Promise<{ status: number; body: any }> {
  const response = await handler(makeContext(options));
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}
