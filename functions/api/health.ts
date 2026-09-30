import type { PagesHandler } from "../lib/types";
import { json } from "../lib/http";

/** Lightweight readiness probe: also tells the client whether writes are set up. */
export const onRequestGet: PagesHandler = async ({ env }) =>
  json({
    ok: true,
    service: "libre-memorial",
    configured: Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO),
    turnstile: Boolean(env.TURNSTILE_SECRET),
  });
