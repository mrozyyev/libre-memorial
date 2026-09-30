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
import { findPhotoEntry } from "../../../lib/content";
import { triggerPublish } from "../../../lib/publish";
import { MAX_PHOTO_BYTES, LIMITS } from "../../../../shared/limits";
import { extensionForMime, parseImageDataUrl } from "../../../../shared/images";
import { contentId } from "../../../../shared/crypto";
import { memorialPath, normalizeMemorial, photoPath } from "../../../../shared/memorial";
import type { PhotoMeta } from "../../../../shared/types";
import { normalizeText } from "../../../../shared/validate";

/**
 * POST /api/memorials/:slug/photos
 *
 * Photos arrive already downscaled by the browser (see PhotoDropzone), so what
 * we commit to git stays small and Astro can re-encode it at build time.
 */
export const onRequestPost: PagesHandler = async (context) => {
  const { request, env, params } = context;
  try {
    const config = readConfig(env);
    const slug = String(params.slug ?? "");
    rateLimit(`photo:${clientIp(request)}`, 60, 10 * 60 * 1000);

    const github = new GithubClient(config);
    const memorial = await requireEditKey(request, github, slug);

    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const caption = normalizeText(body.caption, LIMITS.caption, "Caption");

    const image = parseImageDataUrl(body.dataUrl);
    if (image.bytes.byteLength > MAX_PHOTO_BYTES) {
      throw new HttpError(413, "That photo is too large. Please choose a smaller one.");
    }

    const file = `${contentId()}.${extensionForMime(image.mime)}`;
    await github.putBytes(
      photoPath(slug, file),
      image.bytes,
      `Add a photo to ${memorial.name}`,
    );

    const meta: PhotoMeta = { file, caption, createdAt: new Date().toISOString() };
    await github.updateJson(
      memorialPath(slug),
      (current) => {
        const fresh = normalizeMemorial(current);
        if (fresh.photos.length >= LIMITS.maxPhotos) {
          throw new HttpError(400, `A memorial can hold up to ${LIMITS.maxPhotos} photos.`);
        }
        fresh.photos.push(meta);
        if (body.makeCover === true || !fresh.cover) fresh.cover = file;
        fresh.updatedAt = new Date().toISOString();
        return fresh;
      },
      `Record the new photo on ${memorial.name}`,
    );

    triggerPublish(config, context);

    return json(
      { ok: true, photo: { ...meta, url: github.rawUrl(photoPath(slug, file)) } },
      201,
    );
  } catch (error) {
    return handleError(error);
  }
};

/** DELETE /api/memorials/:slug/photos  Body: { file } */
export const onRequestDelete: PagesHandler = async (context) => {
  const { request, env, params } = context;
  try {
    const config = readConfig(env);
    const slug = String(params.slug ?? "");
    rateLimit(`photo-del:${clientIp(request)}`, 60, 10 * 60 * 1000);

    const github = new GithubClient(config);
    const memorial = await requireEditKey(request, github, slug);

    const body = (await readJsonBody(request)) as Record<string, unknown>;
    const file = typeof body.file === "string" ? body.file : "";
    if (!file) throw new HttpError(400, "Which photo should be removed?");

    const entry = await findPhotoEntry(github, slug, file);
    await github.deleteFile(entry.path, entry.sha, `Remove a photo from ${memorial.name}`);
    await github.updateJson(
      memorialPath(slug),
      (current) => {
        const fresh = normalizeMemorial(current);
        fresh.photos = fresh.photos.filter((photo) => photo.file !== entry.name);
        if (fresh.cover === entry.name) fresh.cover = fresh.photos[0]?.file;
        fresh.updatedAt = new Date().toISOString();
        return fresh;
      },
      `Forget the removed photo on ${memorial.name}`,
    );
    triggerPublish(config, context);

    return json({ ok: true, removed: entry.name });
  } catch (error) {
    return handleError(error);
  }
};

/**
 * PUT /api/memorials/:slug/photos
 * Body: { file, caption?, makeCover? }  — update one photo
 *   or: { order: string[] }             — reorder the gallery
 */
export const onRequestPut: PagesHandler = async (context) => {
  const { request, env, params } = context;
  try {
    const config = readConfig(env);
    const slug = String(params.slug ?? "");
    rateLimit(`photo-edit:${clientIp(request)}`, 60, 10 * 60 * 1000);

    const github = new GithubClient(config);
    const memorial = await requireEditKey(request, github, slug);

    const body = (await readJsonBody(request)) as Record<string, unknown>;

    if (Array.isArray(body.order)) {
      const requested = body.order.filter((entry): entry is string => typeof entry === "string");
      await github.updateJson(
        memorialPath(slug),
        (current) => {
          const fresh = normalizeMemorial(current);
          const byFile = new Map(fresh.photos.map((photo) => [photo.file, photo]));
          const reordered = requested
            .map((file) => byFile.get(file))
            .filter((photo): photo is PhotoMeta => Boolean(photo));
          for (const photo of fresh.photos) {
            if (!requested.includes(photo.file)) reordered.push(photo);
          }
          fresh.photos = reordered;
          fresh.updatedAt = new Date().toISOString();
          return fresh;
        },
        `Reorder photos on ${memorial.name}`,
      );
      triggerPublish(config, context);
      return json({ ok: true, order: requested });
    }

    const file = normalizeText(body.file, 120, "Photo");
    if (!file) throw new HttpError(400, "Which photo should be updated?");
    const caption = normalizeText(body.caption, LIMITS.caption, "Caption");
    const makeCover = body.makeCover === true;

    await github.updateJson(
      memorialPath(slug),
      (current) => {
        const fresh = normalizeMemorial(current);
        const target = fresh.photos.find((photo) => photo.file === file);
        if (target) target.caption = caption;
        else fresh.photos.push({ file, caption });
        if (makeCover) fresh.cover = file;
        fresh.updatedAt = new Date().toISOString();
        return fresh;
      },
      `Update photo on ${memorial.name}`,
    );
    triggerPublish(config, context);

    return json({ ok: true, file, caption, cover: makeCover ? file : memorial.cover });
  } catch (error) {
    return handleError(error);
  }
};
