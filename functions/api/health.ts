import type { PagesHandler } from "../lib/types";
import { json } from "../lib/http";
import { missingSettings } from "../lib/env";

/**
 * Readiness probe. Reports whether writes are configured and, if not, exactly
 * which variables are absent — the usual cause being that Cloudflare Pages only
 * applies environment changes to new deployments.
 */
export const onRequestGet: PagesHandler = async ({ env }) => {
  const missing = missingSettings(env);
  return json({
    ok: true,
    service: "libre-memorial",
    configured: missing.length === 0,
    ...(missing.length > 0 && { missing }),
    turnstile: Boolean(env.TURNSTILE_SECRET),
  });
};
