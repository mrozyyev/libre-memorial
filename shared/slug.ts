import { RESERVED_SLUGS, SLUG_PATTERN } from "./limits";

/**
 * Turns a name into a URL-safe slug: "María  Popescu!" -> "maria-popescu".
 * Diacritics are folded so Romanian/Hungarian names keep working.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ß]/g, "ss")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  if (!slug || RESERVED_SLUGS.has(slug)) return false;
  return SLUG_PATTERN.test(slug);
}

/**
 * Returns the first free slug given a base and a predicate that reports
 * whether a slug already exists (`maria-popescu`, `maria-popescu-2`, ...).
 */
export async function resolveUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = isValidSlug(base) ? base : slugify(base) || "memorial";
  let candidate = root.slice(0, 56).replace(/-+$/g, "");
  if (candidate.length < 3) candidate = `${candidate}-page`.replace(/^-/, "");
  let attempt = 1;
  while (await exists(candidate)) {
    attempt += 1;
    const suffix = `-${attempt}`;
    candidate = `${root.slice(0, 60 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (attempt > 100) {
      candidate = `${root.slice(0, 50)}-${Math.random().toString(36).slice(2, 8)}`;
      break;
    }
  }
  return candidate;
}
