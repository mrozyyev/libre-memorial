import type { Config, Env } from "./env";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extra } });
}

export function fail(status: number, message: string): Response {
  return json({ ok: false, error: message }, status);
}

/** Maps thrown errors (validation, config, http) onto tidy JSON responses. */
export function handleError(error: unknown): Response {
  if (error instanceof HttpError) return fail(error.status, error.message);
  const name = (error as { name?: string })?.name;
  if (name === "ValidationError") return fail(400, (error as Error).message);
  if (name === "ConfigError") return fail(503, (error as Error).message);
  console.error("unhandled api error", error);
  return fail(500, "Something went wrong on our side. Please try again.");
}

export const MAX_JSON_BYTES = 14 * 1024 * 1024;

export async function readJsonBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared && declared > MAX_JSON_BYTES) throw new HttpError(413, "Payload is too large.");
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) throw new HttpError(413, "Payload is too large.");
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

export function corsHeaders(request: Request, config?: Config): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const requestOrigin = new URL(request.url).origin;
  const allowed = new Set<string>([requestOrigin, ...(config?.allowedOrigins ?? [])]);
  if (!allowed.has(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-edit-key",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/**
 * Small in-memory sliding-window limiter. Per-isolate, which is enough to blunt
 * accidental double-submits and casual abuse; Turnstile is the real gate when
 * it is configured.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
  if (hits.length >= limit) throw new HttpError(429, "Too many requests. Please slow down and try again.");
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [bucketKey, times] of buckets) {
      if (!times.some((time) => now - time < windowMs)) buckets.delete(bucketKey);
    }
  }
}

export function requireEnv<T>(value: T | undefined, message: string): T {
  if (value === undefined || value === null || value === "") throw new HttpError(503, message);
  return value;
}

export type { Config, Env };
