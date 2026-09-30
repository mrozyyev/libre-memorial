import type { PagesHandler } from "../lib/types";
import { readConfig } from "../lib/env";
import { GithubClient } from "../lib/github";
import { clientIp, handleError, json, rateLimit, readJsonBody } from "../lib/http";
import { checkHoneypot, verifyTurnstile } from "../lib/turnstile";
import { triggerPublish } from "../lib/publish";
import { validateCreateInput } from "../../shared/validate";
import { resolveUniqueSlug } from "../../shared/slug";
import { generateEditKey, generateSalt, hashEditKey } from "../../shared/crypto";
import { createMemorialRecord, memorialPath } from "../../shared/memorial";

/**
 * POST /api/create
 *
 * Creates a memorial: mints a one-time edit key, commits `memorial.json` to the
 * content repository and returns the slug + key. The plaintext key is never
 * stored anywhere.
 */
export const onRequestPost: PagesHandler = async (context) => {
  const { request, env } = context;
  try {
    const config = readConfig(env);
    rateLimit(`create:${clientIp(request)}`, 6, 10 * 60 * 1000);

    const body = (await readJsonBody(request)) as Record<string, unknown>;
    checkHoneypot(body);
    await verifyTurnstile(config, request, body.turnstileToken);

    const input = validateCreateInput(body);
    const github = new GithubClient(config);
    const slug = await resolveUniqueSlug(input.slug, (candidate) =>
      github.exists(memorialPath(candidate)),
    );

    const editKey = generateEditKey();
    const salt = generateSalt();
    const keyHash = await hashEditKey(salt, editKey);

    const memorial = createMemorialRecord({ ...input, slug }, { salt, keyHash });
    await github.putFile(
      memorialPath(slug),
      `${JSON.stringify(memorial, null, 2)}\n`,
      `Add memorial page for ${memorial.name}`,
    );

    triggerPublish(config, context);

    return json(
      {
        ok: true,
        slug,
        name: memorial.name,
        createdAt: memorial.createdAt,
        editKey,
        memorialPath: `/m/${slug}`,
        managePath: `/manage#${slug}.${editKey}`,
      },
      201,
    );
  } catch (error) {
    return handleError(error);
  }
};
