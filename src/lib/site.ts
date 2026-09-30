/**
 * Single source of truth for site-wide configuration.
 * Fork the project, edit this file, deploy — that is the whole setup.
 */
export const SITE = {
  name: "LibreMemorial",
  url: "https://librememorial.org",
  tagline: "A free, lasting memorial page for someone you love.",
  description:
    "Create a beautiful memorial page with photos, stories and a printable QR code. Free, open source, no accounts, no ads, no tracking — and the content belongs to your family, stored as plain files in a Git repository.",
  repo: "https://github.com/mrozyyev/libre-memorial",
  license: "MIT",
  email: "hello@librememorial.org",
  /**
   * Optional ways for visitors to support the project itself. Every memorial
   * stays free; these are the only "ask" anywhere on the site.
   */
  support: [
    { label: "Sponsor on GitHub", url: "https://github.com/sponsors/mrozyyev" },
    { label: "Star the repository", url: "https://github.com/mrozyyev/libre-memorial" },
  ],
  donateUrl: "https://github.com/sponsors/mrozyyev",
} as const;

export const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/explore", label: "Memorials" },
  { href: "/privacy", label: "Privacy" },
] as const;
