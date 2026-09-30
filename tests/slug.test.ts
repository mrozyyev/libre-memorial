import { describe, expect, it } from "vitest";
import { isValidSlug, resolveUniqueSlug, slugify } from "../shared/slug";

describe("slugify", () => {
  it("folds diacritics and punctuation", () => {
    expect(slugify("María  Popescu!")).toBe("maria-popescu");
    expect(slugify("Ionescu-Andrei")).toBe("ionescu-andrei");
    expect(slugify("Ștefan Țuțuianu")).toBe("stefan-tutuianu");
    expect(slugify("Straße")).toBe("strasse");
  });

  it("never leaves leading or trailing dashes", () => {
    expect(slugify("  ...Hello...  ")).toBe("hello");
    expect(slugify("---")).toBe("");
  });

  it("caps length", () => {
    expect(slugify("a".repeat(120)).length).toBeLessThanOrEqual(60);
  });
});

describe("isValidSlug", () => {
  it("accepts sensible slugs", () => {
    expect(isValidSlug("maria-popescu")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("a1b")).toBe(true);
  });

  it("rejects malformed or reserved slugs", () => {
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-leading")).toBe(false);
    expect(isValidSlug("trailing-")).toBe(false);
    expect(isValidSlug("has space")).toBe(false);
    expect(isValidSlug("UPPER")).toBe(false);
    expect(isValidSlug("manage")).toBe(false);
    expect(isValidSlug("api")).toBe(false);
  });
});

describe("resolveUniqueSlug", () => {
  it("returns the base slug when it is free", async () => {
    await expect(resolveUniqueSlug("maria-popescu", async () => false)).resolves.toBe(
      "maria-popescu",
    );
  });

  it("appends a counter until free", async () => {
    const taken = new Set(["maria", "maria-2", "maria-3"]);
    await expect(resolveUniqueSlug("maria", async (slug) => taken.has(slug))).resolves.toBe(
      "maria-4",
    );
  });

  it("repairs empty or too-short bases", async () => {
    const slug = await resolveUniqueSlug("", async () => false);
    expect(isValidSlug(slug)).toBe(true);
    const short = await resolveUniqueSlug("ab", async () => false);
    expect(isValidSlug(short)).toBe(true);
  });
});
