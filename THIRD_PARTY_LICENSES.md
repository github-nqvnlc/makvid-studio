# Third-party licenses

npm dependencies are checked automatically by `pnpm license:check` (deny/review rules in
`scripts/license-check.mjs`, accepted exceptions in `license-allowlist.json`). This file tracks components that
the npm scan does not see (system binaries, container images, fonts, media) and every accepted exception.

## Accepted npm exceptions

| Package                      | License                         | Why accepted                                                                             |
| ---------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| gsap 3.15.1                  | Webflow "Standard no charge"    | ADR 0001; behind `AnimationRuntime`, MIT fallback exists; written confirmation before M5 |
| @fontsource/be-vietnam-pro   | OFL-1.1                         | Font embedding allowed; LICENSE shipped with font files                                  |
| sharp / @img/sharp-libvips-* | Apache-2.0 + LGPL-3.0 (libvips) | Dynamically linked, server-side only, unmodified                                         |

## Non-npm components

| Component                                                                                | Version       | License                      | Where used                   | Notes                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------- | ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HyperFrames (`@hyperframes/*`)                                                           | 0.9.34        | Apache-2.0                   | render                       | npm, listed here for visibility                                                                                                                                                                                    |
| Chromium headless shell                                                                  | 153.0.8010.36 | BSD-3-Clause + bundled       | render container             | via `@puppeteer/browsers`                                                                                                                                                                                          |
| FFmpeg (Debian package)                                                                  | bookworm      | LGPL-2.1+/GPL (Debian build) | render, audio containers     | Used as a separate process (CLI), not linked; switch to an LGPL-only build before distributing images to third parties                                                                                             |
| Montreal Forced Aligner                                                                  | 3.4.3         | MIT                          | align container              | ADR 0006                                                                                                                                                                                                           |
| MFA Vietnamese acoustic model + dictionary (`vietnamese_mfa`)                            | 3.0.0         | **CC BY 4.0**                | align container              | Attribution required: McAuliffe & Sonderegger, Montreal Forced Aligner Vietnamese models (2024)                                                                                                                    |
| MFA g2p `vietnamese_hanoi_mfa`                                                           | 3.0.0         | **CC BY 4.0**                | align container              | Same attribution                                                                                                                                                                                                   |
| whisper.cpp + ggml models                                                                | 1.9.5         | MIT                          | spike only                   | Not used in production (ADR 0006)                                                                                                                                                                                  |
| PostgreSQL                                                                               | 17.11         | PostgreSQL License           | infra                        |                                                                                                                                                                                                                    |
| Valkey                                                                                   | 8.1.11        | BSD-3-Clause                 | infra                        | Not Redis 8 (AGPL option)                                                                                                                                                                                          |
| SeaweedFS                                                                                | 4.48          | Apache-2.0                   | dev/self-host object storage | Not MinIO (AGPL)                                                                                                                                                                                                   |
| Be Vietnam Pro                                                                           | 5.x           | OFL-1.1                      | style packs                  |                                                                                                                                                                                                                    |
| Fonts: Inter, Montserrat, Lexend, Merriweather, JetBrains Mono, Nunito (`@fontsource/*`) | 5.3.0         | OFL-1.1                      | style packs                  | Self-hosted woff2 subsets; each pack ships `fonts/LICENSE`                                                                                                                                                         |
| Lucide icons (`lucide-static`)                                                           | 1.63.0        | ISC                          | `flat-illustration` pack     | 8 icons inlined as SVG in the layouts (sparkles, book-open, lightbulb, list-checks, scale, trending-up, message-circle, rocket); copyright Lucide Contributors / Cole Bemis (Feather, MIT); commercial use allowed |

## Notable npm dependencies (M1, all permissive)

fontkit 2.0.4 (MIT), esbuild 0.28.2 (MIT), puppeteer-core 25.11.0 (Apache-2.0), zod 4.6.7 (MIT),
@aws-sdk/client-s3 3.1159.0 (Apache-2.0), drizzle-orm 0.45.4 (Apache-2.0), postgres 3.4.9 (Unlicense),
bullmq 5.81.5 (MIT), pino 10.4.0 (MIT), typescript 6.0.3 (Apache-2.0).

## Media library

Music and SFX: procedural, project-owned (M2, T072); licensed catalog via Soundstripe (ADR 0007). Icons: Lucide (ISC, above).

Built-in music beds and SFX (`packages/media/library/`) are generated procedurally by
`packages/media/scripts/gen-beds.mjs` and `gen-sfx.mjs`: project-owned, no third-party rights (T072).
A curated royalty-free library can be added later; every track must carry license, source URL and access date.

## Web UI revamp (spec 002)

Fonts, self-hosted by `next/font/google` at build time (SIL OFL 1.1; embedding in web and video allowed, license
kept in the font packages): Plus Jakarta Sans, Be Vietnam Pro, Space Mono (Vietnamese subset used for all three).

| Dependency                                                     | Version                  | License    | Note                                                                                              |
| -------------------------------------------------------------- | ------------------------ | ---------- | ------------------------------------------------------------------------------------------------- |
| tailwindcss, @tailwindcss/postcss                              | 4.x                      | MIT        | build-time CSS                                                                                    |
| lightningcss (+ platform binaries)                             | 1.33.0                   | MPL-2.0    | Tailwind v4 transform; used unmodified at build time only; allowlisted, owner-approved 2026-11-14 |
| shadcn/ui components (copied into `src/components/ui`), Radix | 4.23.0 CLI / Radix 1.x   | MIT        | source copied into the repo                                                                       |
| tw-animate-css, class-variance-authority, clsx, tailwind-merge | latest pinned            | MIT        |                                                                                                   |
| next-themes 0.4.6, sonner 2.0.8, cmdk 1.1.1                    | as listed                | MIT        |                                                                                                   |
| react-resizable-panels, react-hook-form, @hookform/resolvers   | 4.22.1 / 7.92.0 / 7.0.6  | MIT        |                                                                                                   |
| react-day-picker 10.0.2, date-fns 4.4.0                        | as listed                | MIT        |                                                                                                   |
| @axe-core/playwright 4.14.0 (dev)                              | 4.14.0                   | MPL-2.0    | dev/test only, unmodified                                                                         |
| lucide-react                                                   | existing                 | ISC        |                                                                                                   |

`sharp` was rejected for avatar resizing (libvips is LGPL): avatars are cropped to 256 px in the browser.
