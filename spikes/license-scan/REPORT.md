# Spike T011 — License scanning

**Date**: 2026-11-12 · **Tool tested**: `license-checker-rseidelsohn@4` (BSD-3-Clause) + `summarize.mjs` deny/review rules.

## Result on real dependency trees

| Tree | Packages | DENY | REVIEW |
| --- | --- | --- | --- |
| `spikes/hyperframes` (`@hyperframes/producer@0.9.34`, gsap, fonts) | 95 | 0 | 3 |
| `spikes/player-next` (Next.js 16.4.6, React 19, `@hyperframes/player`) | 69 | 0 | 1 |
| `spikes/queue` (BullMQ 5.81.5) | 23 | 0 | 0 |

REVIEW items and verdict:

- `gsap@3.15.1` — custom Webflow license → covered by ADR 0001 (allowlisted by name + version).
- `@fontsource/be-vietnam-pro` — OFL-1.1 → OK for fonts embedded in videos and web; keep LICENSE file.
- `@img/sharp-*` — Apache-2.0 AND LGPL-3.0-or-later (prebuilt libvips, dynamically linked) → acceptable
  for server-side SaaS (no distribution of modified libvips). Record in `THIRD_PARTY_LICENSES.md`.

## Decision

- CI uses `license-checker-rseidelsohn` (works on any `node_modules`, JSON output) with a committed
  allowlist file. `pnpm licenses list --json` (built into pnpm) is a fallback cross-check.
- **Deny** (fail CI): AGPL-*, SSPL-*, RSAL-*, BUSL-*, CC-BY-NC-*, Commons Clause, GPL-2.0/3.0 (non-L).
- **Review** (fail CI unless the package@version is in `license-allowlist.json` with a reason):
  UNKNOWN, Custom, UNLICENSED, LGPL-*, MPL-*, EPL-*, CC-BY-SA-*, OFL-* (fonts).
- Non-npm components (FFmpeg, Chromium, Valkey, SeaweedFS, PostgreSQL, fonts, music, SFX, icons)
  are tracked manually in `THIRD_PARTY_LICENSES.md`; a CI check verifies each Docker image's
  component list matches that file.

Files: [summarize.mjs](summarize.mjs), raw outputs `*-tree.json`.
