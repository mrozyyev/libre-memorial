import type { APIRoute } from "astro";
import { SITE } from "@/lib/site";

export const GET: APIRoute = () =>
  new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /manage",
      "Disallow: /api/",
      "",
      `Sitemap: ${SITE.url}/sitemap-index.xml`,
      "",
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
