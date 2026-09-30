/**
 * Edit keys are kept in localStorage so a family member does not have to paste
 * the key on every visit. They are also carried in the URL *fragment*
 * (`/manage#slug.key`) which is never sent to the server, so keys stay out of
 * logs and referrer headers.
 */
const PREFIX = "librememorial:key:";

export function saveKey(slug: string, key: string): void {
  try {
    localStorage.setItem(`${PREFIX}${slug}`, key);
  } catch {
    /* private mode — the fragment in the URL still works */
  }
}

export function loadKey(slug: string): string | null {
  try {
    return localStorage.getItem(`${PREFIX}${slug}`);
  } catch {
    return null;
  }
}

export function forgetKey(slug: string): void {
  try {
    localStorage.removeItem(`${PREFIX}${slug}`);
  } catch {
    /* ignore */
  }
}

export interface ManageTarget {
  slug: string;
  key: string;
}

/**
 * Parses `#slug.key`, `#slug`, `?slug=x&key=y` or `?edit=x.key`.
 * A slug without a key is allowed: the editor will ask for the key, or pick up
 * one already saved in this browser.
 */
export function parseManageTarget(hash: string, search: string): ManageTarget | null {
  const raw = hash.replace(/^#/, "").trim();
  if (raw && !raw.includes("?") && !raw.includes("=")) {
    const pair = parsePair(raw, ".");
    if (pair) return pair;
    return { slug: raw, key: "" };
  }

  const params = new URLSearchParams(search);
  const slug = params.get("slug");
  const key = params.get("key");
  if (slug) return { slug, key: key ?? "" };
  if (key && raw) return { slug: raw, key };
  if (key) return { slug: "", key };

  const edit = params.get("edit");
  if (edit) {
    const parsed = parsePair(edit, ".");
    if (parsed) return parsed;
  }
  return null;
}

function parsePair(value: string, separator: string): ManageTarget | null {
  if (!value) return null;
  const index = value.indexOf(separator);
  if (index < 1) return null;
  const slug = value.slice(0, index).trim();
  const key = value.slice(index + separator.length).trim();
  if (!slug || !key) return null;
  return { slug, key };
}

export function manageLink(slug: string, key: string): string {
  return `/manage#${slug}.${key}`;
}
