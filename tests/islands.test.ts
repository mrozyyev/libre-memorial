import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".astro") ? [full] : [];
  });
}

/**
 * A React component rendered in an .astro file without a `client:` directive
 * is server-rendered once and never hydrated — buttons do nothing and effects
 * never run. That is an easy mistake to make and a silent one to ship, so it is
 * checked here.
 */
describe("astro islands", () => {
  const files = walk(SRC);

  it("finds the pages to check", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("hydrates every React import it renders", () => {
    const failures: string[] = [];
    let inspected = 0;

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const imported = new Set<string>();

      for (const match of source.matchAll(/import\s+(\w+)\s+from\s+["'][^"']+\.tsx["']/g)) {
        imported.add(match[1]);
      }
      for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'][^"']+\.tsx["']/g)) {
        for (const name of match[1].split(",")) {
          const clean = name.trim().split(/\s+as\s+/).pop();
          if (clean) imported.add(clean);
        }
      }

      for (const name of imported) {
        const usage = new RegExp(`<${name}\\b[^>]*>`, "s");
        const tag = source.match(usage);
        if (!tag) continue;
        inspected += 1;
        if (!/client:(load|idle|visible|only|media)/.test(tag[0])) {
          failures.push(`${path.relative(ROOT, file)} renders <${name}> without a client directive`);
        }
      }
    }

    // Guards against the check silently matching nothing.
    expect(inspected).toBeGreaterThanOrEqual(4);
    expect(failures).toEqual([]);
  });
});
