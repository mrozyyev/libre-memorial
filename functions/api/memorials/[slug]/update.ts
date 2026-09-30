import type { PagesHandler } from "../../../lib/types";
import { readConfig } from "../../../lib/env";
import { GithubClient } from "../../../lib/github";
import { clientIp, handleError, json, rateLimit, readJsonBody } from "../../../lib/http";
import { requireEditKey } from "../../../lib/auth";
import { triggerPublish } from "../../../lib/publish";
import { validateMemorialPatch } from "../../../../shared/validate";
import { applyMemorialPatch, memorialPath } from "../../../../shared/memorial";
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
    const next = applyMemorialPatch(memorial, patch);

    await github.putFile(
      memorialPath(slug),
      `${JSON.stringify(next, null, 2)}\n`,
      `Update memorial details for ${next.name}`,
    );
    triggerPublish(config, context);

    return json({ ok: true, memorial: toPublicMemorial(next) });
  } catch (error) {
    return handleError(error);
  }
};
