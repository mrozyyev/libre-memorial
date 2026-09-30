import { describe, expect, it } from "vitest";
import {
  ValidationError,
  normalizeText,
  sanitizeFileName,
  validateCreateInput,
  validateLinkList,
  validateMemorialPatch,
  validateName,
  validateStoryInput,
  validateUrl,
  validateVisibility,
} from "../shared/validate";

describe("normalizeText", () => {
  it("trims and normalises newlines", () => {
    expect(normalizeText("  hi\r\nthere  ", 100, "Field")).toBe("hi\nthere");
  });

  it("strips control characters but keeps tabs and newlines", () => {
    expect(normalizeText("a\u0000b\u001fc\td\ne", 100, "Field")).toBe("abc\td\ne");
  });

  it("enforces required and length limits", () => {
    expect(() => normalizeText("", 10, "Field", { required: true })).toThrow(ValidationError);
    expect(() => normalizeText("x".repeat(11), 10, "Field")).toThrow(/10 characters/);
    expect(normalizeText(undefined, 10, "Field")).toBe("");
  });

  it("rejects non-strings", () => {
    expect(() => normalizeText(42, 10, "Field")).toThrow(/must be text/);
  });
});

describe("validateName", () => {
  it("accepts a real name", () => {
    expect(validateName("  Maria Popescu ")).toBe("Maria Popescu");
  });
  it("rejects blanks and one-character names", () => {
    expect(() => validateName("")).toThrow();
    expect(() => validateName("M")).toThrow(/at least 2/);
  });
});

describe("validateUrl", () => {
  it("accepts http and https only", () => {
    expect(validateUrl("https://hospice.ro/donate", "URL")).toBe("https://hospice.ro/donate");
    expect(validateUrl("http://example.com", "URL")).toBe("http://example.com/");
    expect(() => validateUrl("javascript:alert(1)", "URL")).toThrow(/http/);
    expect(() => validateUrl("data:text/html,x", "URL")).toThrow(/http/);
    expect(() => validateUrl("not a url", "URL")).toThrow(/valid URL/);
    expect(() => validateUrl("ftp://example.com", "URL")).toThrow(/http/);
  });

  it("returns empty for optional blanks but throws when required", () => {
    expect(validateUrl("", "URL", { required: false })).toBe("");
    expect(() => validateUrl("", "URL")).toThrow();
  });
});

describe("validateLinkList", () => {
  it("drops empty rows and derives a label from the hostname", () => {
    const links = validateLinkList(
      [
        { label: "", url: "https://www.gofundme.com/f/abc" },
        { label: "   ", url: "" },
      ],
      "donations",
    );
    expect(links).toEqual([{ label: "gofundme.com", url: "https://www.gofundme.com/f/abc" }]);
  });

  it("rejects non-arrays, too many rows and bad urls", () => {
    expect(() => validateLinkList("nope", "links")).toThrow(/must be a list/);
    expect(() =>
      validateLinkList(
        Array.from({ length: 13 }, () => ({ label: "x", url: "https://a.com" })),
        "links",
      ),
    ).toThrow(/up to 12/);
    expect(() => validateLinkList([{ url: "javascript:alert(1)" }], "links")).toThrow(/http/);
  });
});

describe("validateVisibility", () => {
  it("defaults to public", () => {
    expect(validateVisibility(undefined)).toBe("public");
    expect(validateVisibility("")).toBe("public");
    expect(validateVisibility("unlisted")).toBe("unlisted");
    expect(() => validateVisibility("secret")).toThrow();
  });
});

describe("validateCreateInput", () => {
  it("derives a slug from the name and defaults the rest", () => {
    const input = validateCreateInput({ name: "María Popescu" });
    expect(input).toMatchObject({
      name: "María Popescu",
      slug: "maria-popescu",
      visibility: "public",
      links: [],
      donations: [],
      born: "",
      died: "",
    });
  });

  it("honours an explicit slug", () => {
    expect(validateCreateInput({ name: "Maria", slug: "my-mum" }).slug).toBe("my-mum");
  });

  it("rejects unusable slugs", () => {
    expect(() => validateCreateInput({ name: "Maria", slug: "??" })).toThrow(/web address/);
    expect(() => validateCreateInput({ name: "Maria", slug: "api" })).toThrow(/web address/);
  });

  it("rejects a missing body", () => {
    expect(() => validateCreateInput(null)).toThrow(/Missing request body/);
  });
});

describe("validateMemorialPatch", () => {
  it("only includes supplied fields", () => {
    expect(validateMemorialPatch({ epitaph: "Hello" })).toEqual({ epitaph: "Hello" });
  });
  it("requires at least one field", () => {
    expect(() => validateMemorialPatch({})).toThrow(/Nothing to update/);
  });
});

describe("validateStoryInput", () => {
  it("requires an author and a body", () => {
    const story = validateStoryInput({ author: "Ana", body: "She sang." });
    expect(story).toMatchObject({ author: "Ana", body: "She sang.", title: "", date: "" });
    expect(() => validateStoryInput({ body: "No author" })).toThrow(/required/);
    expect(() => validateStoryInput({ author: "Ana" })).toThrow(/required/);
  });
});

describe("sanitizeFileName", () => {
  it("strips paths and dangerous characters", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("ph oto<>.jpg")).toBe("photo.jpg");
    expect(sanitizeFileName("...hidden")).toBe("hidden");
    expect(sanitizeFileName("")).toBe("file");
  });
});
