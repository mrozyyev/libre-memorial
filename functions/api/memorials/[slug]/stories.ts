import type { PagesHandler } from "../../../lib/types";
import { readConfig } from "../../../lib/env";
import { GithubClient } from "../../../lib/github";
import {
  HttpError,
  clientIp,
  handleError,
  json,
  rateLimit,
  readJsonBody,
} from "../../../lib/http";
import { requireEditKey } from "../../../lib/auth";
import { findStoryEntry, loadStories } from "../../../lib/content";
import { triggerPublish } from "../../../lib/publish";
import { LIMITS } from "../../../../shared/limits";
import { createStoryRecord, normalizeStory, storyPath } from "../../../../shared/memorial";
import { validateStoryInput } from "../../../../shared/validate";

/** POST /api/memorials/:slug/stories — add a memory. */
export const onRequestPost: PagesHandler = async (context) => {
  const { request, env, params } = context;
  try {
    const config = readConfig(env);
    const slug = String(params.slug ?? "");
    rateLimit(`story:${clientIp(request)}`, 40, 10 * 60 * 1000);

    const github = new GithubClient(config);
    const memorial = await requireEditKey(request, github, slug);
    const input = validateStoryInput(await readJsonBody(request));

    const existing = await loadStories(github, slug);
    if (existing.length >= LIMITS.maxStories) {
      throw new HttpError(400, `A memorial can hold up to ${LIMITS.maxStories} stories.`);
    }

    const story = createStoryRecord(input);
    await github.putFile(
      storyPath(slug, story.id),
      `${JSON.stringify(story, null, 2)}\n`,
      `Add a memory to ${memorial.name}`,
    );
    triggerPublish(config, context);

    return json({ ok: true, story }, 201);
  } catch (error) {
    return handleError(error);
  }
};

/** PUT /api/memorials/:slug/stories — edit an existing memory. */
export const onRequestPut: PagesHandler = async (context) => {
  const { request, env, params } = context;
  try {
    const config = readConfig(env);
    const slug = String(params.slug ?? "");
    rateLimit(`story-edit:${clientIp(request)}`, 40, 10 * 60 * 1000);

    const github = new GithubClient(config);
    const memorial = await requireEditKey(request, github, slug);

    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new HttpError(400, "Which story should be updated?");
    const input = validateStoryInput(body);

    const entry = await findStoryEntry(github, slug, id);
    const file = await github.getFile(entry.path);
    const previous = file ? normalizeStory(JSON.parse(file.content)) : null;
    const story = {
      ...createStoryRecord(input, id, previous?.createdAt ?? new Date().toISOString()),
    };

    await github.putFile(
      entry.path,
      `${JSON.stringify(story, null, 2)}\n`,
      `Edit a memory on ${memorial.name}`,
      entry.sha,
    );
    triggerPublish(config, context);

    return json({ ok: true, story });
  } catch (error) {
    return handleError(error);
  }
};

/** DELETE /api/memorials/:slug/stories  Body: { id } */
export const onRequestDelete: PagesHandler = async (context) => {
  const { request, env, params } = context;
  try {
    const config = readConfig(env);
    const slug = String(params.slug ?? "");
    rateLimit(`story-del:${clientIp(request)}`, 40, 10 * 60 * 1000);

    const github = new GithubClient(config);
    const memorial = await requireEditKey(request, github, slug);

    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const id = typeof body.id === "string" ? body.id : "";
    if (!id) throw new HttpError(400, "Which story should be removed?");

    const entry = await findStoryEntry(github, slug, id);
    await github.deleteFile(entry.path, entry.sha, `Remove a memory from ${memorial.name}`);
    triggerPublish(config, context);

    return json({ ok: true, removed: id });
  } catch (error) {
    return handleError(error);
  }
};
