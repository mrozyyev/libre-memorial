import type { PagesHandler } from "../../../lib/types";
import { readConfig } from "../../../lib/env";
import { GithubClient } from "../../../lib/github";
import { handleError, json } from "../../../lib/http";
import { requireMemorial } from "../../../lib/auth";
import { loadPhotos, loadStories } from "../../../lib/content";
import { verifyEditKey } from "../../../../shared/crypto";
import { toPublicMemorial } from "../../../../shared/types";

/**
 * GET /api/memorials/:slug
 *
 * Public memorial data, read straight from git. The static page is baked at
 * build time; this endpoint is what the editor and the "publishing" poll use.
 * Pass `x-edit-key` to have the response report whether editing is allowed.
 */
export const onRequestGet: PagesHandler = async (context) => {
  try {
    const config = readConfig(context.env);
    const github = new GithubClient(config);
    const slug = String(context.params.slug ?? "");

    const memorial = await requireMemorial(github, slug);
    const key = context.request.headers.get("x-edit-key")?.trim() ?? "";
    const canEdit = key
      ? await verifyEditKey(memorial.auth.salt, memorial.auth.keyHash, key)
      : false;

    const [photos, stories] = await Promise.all([
      loadPhotos(github, memorial),
      loadStories(github, slug),
    ]);

    return json({
      ok: true,
      canEdit,
      memorial: toPublicMemorial(memorial),
      photos,
      stories,
      counts: { photos: photos.length, stories: stories.length },
    });
  } catch (error) {
    return handleError(error);
  }
};
