import type { Config } from "./env";
import { HttpError, clientIp } from "./http";

/**
 * Optional Cloudflare Turnstile check. Free, privacy-friendly and only enabled
 * when TURNSTILE_SECRET is configured — so the default deployment works with
 * zero third parties involved.
 */
export async function verifyTurnstile(
  config: Config,
  request: Request,
  token: unknown,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!config.turnstileSecret) return;
  if (typeof token !== "string" || !token) {
    throw new HttpError(400, "Please complete the quick bot check and try again.");
  }
  const form = new FormData();
  form.append("secret", config.turnstileSecret);
  form.append("response", token);
  const ip = clientIp(request);
  if (ip !== "unknown") form.append("remoteip", ip);
  const response = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = (await response.json().catch(() => ({ success: false }))) as { success?: boolean };
  if (!data.success) throw new HttpError(400, "The bot check failed. Please refresh and try again.");
}

/** Honeypot fields must stay empty; bots happily fill them in. */
export function checkHoneypot(body: Record<string, unknown>): void {
  for (const field of ["website", "url", "company"]) {
    if (typeof body[field] === "string" && body[field].trim() !== "") {
      throw new HttpError(400, "This submission was flagged as spam.");
    }
  }
}
