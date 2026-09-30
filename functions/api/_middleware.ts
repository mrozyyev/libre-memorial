import type { Env } from "../lib/env";
import type { PagesHandler } from "../lib/types";

/**
 * Security headers for every API response plus CORS preflight handling.
 * The API is same-origin by default; extra origins can be allowed through the
 * ALLOWED_ORIGINS variable.
 */
export const onRequest: PagesHandler = async (context) => {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: preflightHeaders(request, env) });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("referrer-policy", "no-referrer");
  for (const [key, value] of Object.entries(preflightHeaders(request, env))) {
    headers.set(key, value);
  }
  return new Response(response.body, { status: response.status, headers });
};

function preflightHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = new Set<string>([new URL(request.url).origin]);
  for (const extra of (env.ALLOWED_ORIGINS ?? "").split(",")) {
    if (extra.trim()) allowed.add(extra.trim());
  }
  if (!allowed.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-edit-key",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}
