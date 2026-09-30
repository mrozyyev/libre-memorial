import type { PagesHandler } from "../../../lib/types";
import { readConfig } from "../../../lib/env";
import { GithubClient } from "../../../lib/github";
import { clientIp, handleError, json, rateLimit, readJsonBody } from "../../../lib/http";
import { requireEditKey } from "../../../lib/auth";
import { triggerPublish } from "../../../lib/publish";
import { validateMemorialPatch } from "../../../../shared/validate";
import { applyMemorialPatch, memorialPath, normalizeMemorial } from "../../../../shared/memorial";
import { toPublicMemorial } from "../../../../shared/types";

/**
 * POST /api/memorials/:slug/update
 * Body: any subset of the editable fields. Requires the `x-edit-key` header.
 */
export const onRequestPost: PagesHandler = async (context) => {
  const { request, env, params } = context;
  try {
    const config = readConfig(env);
    const slug = String(params.slug ?? "");
    rateLimit(`update:${clientIp(request)}`, 40, 10 * 60 * 1000);

    const github = new GithubClient(config);
    const memorial = await requireEditKey(request, github, slug);
    const patch = validateMemorialPatch(await readJsonBody(request));

    // Read-modify-write rather than a blind PUT: GitHub refuses an overwrite
    // that does not carry the current file sha, and this also retries when
    // somebody else committed between our read and our write.
    const next = await github.updateJson(
      memorialPath(slug),
      (current) => applyMemorialPatch(normalizeMemorial(current), patch),
      `Update memorial details for ${patch.name ?? memorial.name}`,
    );
    triggerPublish(config, context);

    return json({ ok: true, memorial: toPublicMemorial(next) });
  } catch (error) {
    return handleError(error);
  }
};
