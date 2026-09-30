import type { Memorial, PhotoMeta, Story } from "@shared/types";

export interface PhotoResource extends PhotoMeta {
  url: string;
  bytes?: number;
}

export interface MemorialPayload {
  memorial: Omit<Memorial, "auth">;
  photos: PhotoResource[];
  stories: Story[];
  counts: { photos: number; stories: number };
  canEdit: boolean;
}

export interface CreateResult {
  ok: true;
  slug: string;
  name: string;
  createdAt: string;
  editKey: string;
  memorialPath: string;
  managePath: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0);
  }
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      (response.status === 404
        ? "That memorial could not be found."
        : "Something went wrong. Please try again.");
    throw new ApiError(message, response.status);
  }
  return data as T;
}

function jsonInit(method: string, body: unknown, key?: string): RequestInit {
  return {
    method,
    headers: {
      "content-type": "application/json",
      ...(key ? { "x-edit-key": key } : {}),
    },
    body: JSON.stringify(body),
  };
}

export const api = {
  health: () => request<{ ok: boolean; configured: boolean; turnstile: boolean }>("/api/health"),

  create: (body: Record<string, unknown>) =>
    request<CreateResult>("/api/create", jsonInit("POST", body)),

  get: (slug: string, key?: string) =>
    request<MemorialPayload>(`/api/memorials/${encodeURIComponent(slug)}`, {
      headers: key ? { "x-edit-key": key } : undefined,
    }),

  update: (slug: string, key: string, patch: Record<string, unknown>) =>
    request<{ ok: true; memorial: Omit<Memorial, "auth"> }>(
      `/api/memorials/${encodeURIComponent(slug)}/update`,
      jsonInit("POST", patch, key),
    ),

  addPhoto: (
    slug: string,
    key: string,
    body: { dataUrl: string; caption?: string; makeCover?: boolean },
  ) =>
    request<{ ok: true; photo: PhotoResource }>(
      `/api/memorials/${encodeURIComponent(slug)}/photos`,
      jsonInit("POST", body, key),
    ),

  updatePhoto: (slug: string, key: string, body: { file: string; caption?: string; makeCover?: boolean }) =>
    request<{ ok: true }>(
      `/api/memorials/${encodeURIComponent(slug)}/photos`,
      jsonInit("PUT", body, key),
    ),

  reorderPhotos: (slug: string, key: string, order: string[]) =>
    request<{ ok: true }>(
      `/api/memorials/${encodeURIComponent(slug)}/photos`,
      jsonInit("PUT", { order }, key),
    ),

  deletePhoto: (slug: string, key: string, file: string) =>
    request<{ ok: true }>(
      `/api/memorials/${encodeURIComponent(slug)}/photos`,
      jsonInit("DELETE", { file }, key),
    ),

  addStory: (
    slug: string,
    key: string,
    body: { title?: string; author: string; relation?: string; date?: string; body: string },
  ) =>
    request<{ ok: true; story: Story }>(
      `/api/memorials/${encodeURIComponent(slug)}/stories`,
      jsonInit("POST", body, key),
    ),

  updateStory: (
    slug: string,
    key: string,
    body: { id: string; title?: string; author: string; relation?: string; date?: string; body: string },
  ) =>
    request<{ ok: true; story: Story }>(
      `/api/memorials/${encodeURIComponent(slug)}/stories`,
      jsonInit("PUT", body, key),
    ),

  deleteStory: (slug: string, key: string, id: string) =>
    request<{ ok: true }>(
      `/api/memorials/${encodeURIComponent(slug)}/stories`,
      jsonInit("DELETE", { id }, key),
    ),
};
