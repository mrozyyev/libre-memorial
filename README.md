# LibreMemorial

**Free, open-source memorial pages with a printable QR code.**

Create a page for someone you have lost: photographs, their life story, memories shared by
family and friends, and a QR code that anyone can scan at a service, a bench or a headstone.
No accounts, no subscriptions, no advertising, no tracking.

The whole thing is a static Astro site plus a handful of Cloudflare Pages Functions. Memorial
content is stored as plain files in a Git repository — which is what makes it cheap enough to
run forever, and why nothing is ever really lost.

```
┌─────────────┐   1. add a photo   ┌──────────────────┐   3. commit    ┌──────────────┐
│   family    │ ─────────────────▶ │  Cloudflare      │ ─────────────▶ │  Git repo    │
│  (browser)  │ ◀───────────────── │  Function /api   │ ◀───────────── │  (content)   │
└─────────────┘   2. edit key      └──────────────────┘   read/write   └──────┬───────┘
                                                                              │ 4. push
                                                                    ┌─────────▼─────────┐
                                                                    │  Astro build      │
                                                                    │  + image pipeline │
                                                                    └─────────┬─────────┘
                                                                              │ 5. static output
                                                                    ┌─────────▼─────────┐
                                                                    │  CDN (Pages)      │
                                                                    │  memorial page    │
                                                                    └───────────────────┘
```

---

## Contents

- [What you get](#what-you-get)
- [How it works](#how-it-works)
- [Where the content lives](#where-the-content-lives)
- [Getting started](#getting-started)
- [Deploying to Cloudflare](#deploying-to-cloudflare)
- [Environment variables](#environment-variables)
- [Editing content by hand (or with a CMS)](#editing-content-by-hand-or-with-a-cms)
- [Project structure](#project-structure)
- [Scripts](#scripts)
- [Testing](#testing)
- [Design decisions](#design-decisions)
- [License](#license)

---

## What you get

- **A memorial page** at `/m/<slug>` with a portrait, dates, a life story, a photo gallery with
  captions and a lightbox, memories contributed by other people, a favourite quote, embedded
  videos or music, and donation or charity links.
- **A QR code and a print-ready card.** The code is generated in the browser from the page URL —
  nothing is uploaded anywhere and nothing expires.
- **An edit link instead of an account.** Creating a memorial returns one secret link. Whoever
  holds it can add photos and stories; nobody else can. There is no signup, no password and no
  email address.
- **A public directory** at `/explore`, with pages set to *unlisted* kept out of it.
- **Honest defaults:** no cookies, no analytics, no third-party scripts, self-hosted fonts.
  See `/privacy` for the full statement.

## How it works

### 1. The repository is the database

There is no database and no CMS backend. A memorial is a folder:

```
src/content/memorials/maria-popescu/
├── memorial.json          # name, dates, biography, links, photo captions, key hash
├── photos/
│   ├── portrait.jpg
│   └── 1.jpg
└── stories/
    └── m1q2n7-the-accordion.json
```

Because that folder is in Git, every edit is a commit. You get version history, diffs, the
ability to restore a deleted photo, `git clone` as a backup, and the option to move the whole
memorial somewhere else. Nothing is locked inside somebody's platform.

### 2. Writes go through Cloudflare Pages Functions

`functions/api/*` is a small, stateless API. It authenticates the caller, validates the input and
commits files to the content repository through the GitHub REST API. Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Readiness probe; reports whether writes are configured |
| `POST` | `/api/create` | Create a memorial, return its slug and a new edit key |
| `GET` | `/api/memorials/:slug` | Read a memorial (add `x-edit-key` to learn whether you may edit) |
| `POST` | `/api/memorials/:slug/update` | Update the details, links and visibility |
| `POST` | `/api/memorials/:slug/photos` | Upload one photo |
| `PUT` | `/api/memorials/:slug/photos` | Edit a caption, change the portrait, reorder the gallery |
| `DELETE` | `/api/memorials/:slug/photos` | Remove a photo |
| `POST` `PUT` `DELETE` | `/api/memorials/:slug/stories` | Add, edit and remove a memory |

### 3. Editing does not need accounts — just one key

When a memorial is created the server mints a random edit key and returns it **once**. Only
`sha256(salt + key)` is committed, so the repository never contains a usable credential and there
is nothing to leak. The key lives in the editor's browser (and on a recovery sheet they can
download), travels in the URL *fragment* (`/manage#slug.key`, which browsers never send to a
server), and is presented back as an `x-edit-key` header on write requests.

Share that link with whoever should be able to contribute. It is a house key: give it only to
people you trust, and keep a second copy somewhere your family will look.

### 4. Images are optimised twice

1. **In the browser, before upload** — photos are resized to a sane maximum and re-encoded
   (`src/lib/image.ts`), so what reaches Git is a fraction of a phone snapshot.
2. **At build time** — every photo is imported through Astro's asset pipeline, which generates
   responsive sizes in modern formats with hashed, cacheable file names.

A memorial with dozens of photos still ships as a small static site.

### 5. Publishing

A commit triggers a rebuild (Cloudflare Pages is connected to the repository, so a push is enough;
you can also set `DEPLOY_HOOK_URL` for other setups). New and edited pages go live in a minute or
so. The editor reads directly from Git, so it works immediately — before the rebuild finishes.

## Where the content lives

Everything a family contributes is plain, documented and portable:

| File | Contents |
| --- | --- |
| `memorial.json` | Name, dates, epitaph, biography, quote, location, visibility, links, donation links, photo captions, embedded video ids, and the edit-key hash |
| `photos/<file>` | The photographs, exactly as uploaded (already downscaled) |
| `stories/<id>.json` | One memory: author, relationship, date, and the text |

There is no hidden state anywhere else. Deleting a memorial means deleting its folder.

### Videos and music are linked, not uploaded

Hosting media files would bloat the repository, so a memorial stores only a provider and a video
id, extracted from the link a family pastes. The page shows a poster with a play button and loads
the player — from `youtube-nocookie.com` or `player.vimeo.com` — **only when a visitor presses
play**. Reading a memorial page still contacts no third party. Links from anywhere else are
ignored rather than being turned into frames.

## Getting started

Requirements: **Node.js ≥ 22.12** (Astro 7).

```bash
npm install
npm run dev          # http://localhost:4321
```

The example memorials under `src/content/memorials/` are generated placeholder content so the site
is not empty — replace or delete them. Their edit keys are intentionally unusable.

To try the write API locally you also need a token (see below), then:

```bash
npm run build
npm run cf:dev       # runs the real Pages Functions via wrangler on :8788
```

Without `GITHUB_TOKEN`, `/api/health` reports `configured: false` and write endpoints answer with a
clear message instead of failing silently — the read-only site still works perfectly.

## Deploying to Cloudflare

1. **Fork** this repository (or push it to your own).
2. In the Cloudflare dashboard create a **Pages** project from that repository.
   - Framework preset: *Astro*
   - Build command: `npm run build`
   - Build output directory: `dist`
3. Create a **fine-grained GitHub token** with `Contents: Read and write` on the content
   repository, then add it to the Pages project as `GITHUB_TOKEN`.
4. Add `GITHUB_REPO` (`owner/repo`) — the repository that stores memorial content. This can be the
   same repository the site builds from.
5. Optionally set `TURNSTILE_SECRET` and `PUBLIC_TURNSTILE_SITE_KEY` to put a free Cloudflare
   Turnstile check on the creation form, and `ALLOWED_ORIGINS` if another site should be able to
   call the API.
6. Deploy. Point your domain at the project and set `site` in `astro.config.mjs` to that origin —
   it is used for canonical URLs, the sitemap and the QR codes, so it must be right.

`wrangler.jsonc` already configures `pages_build_output_dir`, and `public/_routes.json` keeps
Functions limited to `/api/*` so static assets are served straight from the CDN.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | for writes | Fine-grained token with contents write access |
| `GITHUB_REPO` | for writes | `owner/repo` holding the memorial content |
| `GITHUB_BRANCH` | no | Branch to commit to (default `main`) |
| `DEPLOY_HOOK_URL` | no | Pinged after a commit if Pages is not connected to Git |
| `TURNSTILE_SECRET` | no | Enables the bot check on `/api/create` |
| `PUBLIC_TURNSTILE_SITE_KEY` | no | Renders the Turnstile widget (build-time, public) |
| `ALLOWED_ORIGINS` | no | Extra origins allowed to call the API, comma separated |

Copy `.env.example` to `.dev.vars` for `npm run cf:dev`. Never commit real values.

## Editing content by hand (or with a CMS)

Because the content is just files, you can edit a memorial with any text editor, or with a
Git-based CMS such as [Pages CMS](https://pagescms.org/) or Decap — `memorial.json` and the
`stories/*.json` files are deliberately schema-friendly.

Be aware of the trade-off, which is exactly why this project ships its own editor:

- A Git-based CMS authenticates through GitHub. **Every** person who should be able to add a photo
  needs a GitHub account *and* write access to the repository — and write access to the repository
  is also permission to change the site's code.
- The edit-key flow here gives one family member permission to edit **one memorial**, with no
  account, no GitHub knowledge and no access to anything else.

If you run a site for a community and would rather administer everything centrally, use a CMS and
grant yourself (not the families) repository access. If you want families to maintain their own
pages, use the edit link.

## Project structure

```
├── astro.config.mjs          # Astro 7 + React 19 + Tailwind 4 + sitemap
├── wrangler.jsonc            # Cloudflare Pages project config
├── functions/                # Cloudflare Pages Functions (the write API)
│   ├── api/                  # file-based routes → /api/*
│   └── lib/                  # github client, auth, validation helpers, http
├── shared/                   # framework-free logic used by BOTH the site and the API
│   ├── types.ts              # the Memorial / Story data model
│   ├── memorial.ts           # repository paths, normalisation, patches
│   ├── validate.ts           # all input validation and limits
│   ├── crypto.ts             # edit-key generation, hashing, constant-time compare
│   ├── images.ts             # magic-byte sniffing, data-URL parsing
│   ├── video.ts              # YouTube/Vimeo link parsing and embed URLs
│   └── slug.ts, limits.ts, base64.ts
├── src/
│   ├── content/memorials/    # ← the data: one folder per memorial
│   ├── components/manage/    # the create form and the editor dashboard (React islands)
│   ├── components/islands/   # QR panel, lightbox, search
│   ├── components/sections/  # landing page sections
│   ├── layouts/Layout.astro  # <head>, SEO/OpenGraph, header and footer
│   ├── lib/                  # site config, formatting, API client, image resizing
│   └── pages/                # /, /explore, /create, /manage, /m/[slug], /privacy, 404, robots
├── scripts/                  # OG image generation, demo placeholder images
└── tests/                    # vitest: unit + API integration tests
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server (regenerates social images first) |
| `npm run build` | `astro check` + social images + static build into `dist/` |
| `npm run preview` | Preview the built site |
| `npm run cf:dev` | Build output + Functions through `wrangler pages dev` |
| `npm run cf:deploy` | Build and deploy with `wrangler pages deploy` |
| `npm test` | Vitest suite |
| `npm run typecheck` | `astro check` for the site, `tsc` for the Functions |
| `node scripts/generate-demo-images.mjs` | Regenerate the example placeholder photos |

## Testing

```bash
npm test        # 100 tests
npm run typecheck
npm run build
```

The suite covers the pure logic (slugs, validation, key hashing, image sniffing, base64, video
link parsing) and, crucially, exercises the **real API handlers** against an in-memory stand-in
for the GitHub Contents API (`tests/helpers/fake-github.ts`). That includes creating a memorial and verifying the
returned edit key against the committed hash, photo upload and deletion, gallery reordering, story
create/edit/delete, permission failures (401/403), validation errors, honeypot rejection and rate
limiting. A separate test fails the build if a React island is ever rendered without a `client:`
directive, which would silently stop it from hydrating.

## Design decisions

- **No dark mode, no themes.** One calm, paper-white design that puts the person first.
- **Plain text, never HTML.** Biographies and stories are rendered with escaping and
  `white-space: pre-line`. No markdown pipeline means no stored-XSS surface from contributed
  content. Video links are re-parsed on read, so a hand-edited file cannot inject an iframe either.
- **No third-party requests unless asked.** Fonts and icons are self-hosted, and a video player is
  only fetched after a deliberate click.
- **Unlisted, not private.** Everything is static HTML; "unlisted" hides a page from the directory
  and the sitemap, but a link is still a link. The UI says so plainly.
- **Keys in the fragment.** Edit links use `/manage#slug.key` so the credential never appears in
  server logs or referrer headers.
- **Rate limits and a honeypot** guard the one public write endpoint; Turnstile is available for
  deployments that want more.

## License

[MIT](LICENSE). Fork it, run your own, and keep it free.
