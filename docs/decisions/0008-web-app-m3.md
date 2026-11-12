# ADR 0008 — Web app (M3): Next.js 16 + next-intl + Better Auth; chat edits in the web process; MP4 preview

- **Status**: Accepted (2026-11-12)
- **Context**: M3 adds the web app (US2) and review mode (US3). Versions used are the newest releases at
  least two weeks old: Next.js 16.4.3 (App Router, Turbopack; `middleware` is now `proxy.ts`), React 19.2.9,
  next-intl 4.14.9, Better Auth 1.7.14 (Drizzle adapter), Playwright 1.64.1. All MIT/Apache-2.0.

## Decisions

1. **Auth**: Better Auth email + password (Google when `GOOGLE_CLIENT_ID/SECRET` are set). Its `user` model is
   our `users` table; sessions / accounts / verifications live in `auth_*` tables (migration 0003). A personal
   workspace + owner membership is created in the `user.create.after` hook. Before a workspace is known the app
   uses `withUser()` (RLS policies on `app.user_id`) to read only the user's own memberships.
2. **Project service** (`packages/pipeline/src/service.ts`) is shared by the web routes and tests: create,
   review resume, chat edit, undo / redo (move `head_version_id`), restore (new version on top), duplicate.
   Optimistic lock: a new version is committed only if the head did not move (`UPDATE … WHERE head = expected`).
3. **Chat edits run in the web request** (not on the `ai` queue as T099 first planned): the user waits for the
   reply anyway, and a queue round trip only adds latency. The LLM answers with constrained edit operations
   (by scene id) that are converted to an RFC 6902 patch and validated with zod, the style-pack limits and a
   compile in every aspect. The re-render (voice from cache, QA, scene render cache) runs on the workers.
4. **Workers persist through hooks** (`dbSink`): project status, job progress (shown via SSE as friendly
   sentences), usage, versions and outputs; files go to object storage and are downloaded through 1-hour
   signed URLs. `jobs.version_id` is the run id (FK dropped in migration 0004).
5. **Preview** plays the rendered MP4 (`<video>`, with seek per scene) instead of `<hyperframes-player>`:
   thanks to the scene cache a one-scene edit re-renders in seconds, and the preview is then exactly the file
   the user downloads. The interactive player can come back later if instant (pre-render) preview is needed.
6. **Mock mode** (`MAKVID_MOCK_PROVIDERS=1`) runs the whole stack without paid calls; E2E tests use it.

## Consequences

- `docker compose -f docker/compose.yml up -d --build` runs everything (web, 3 workers, migrate, infra).
- The compiler resolves vendored scripts at runtime from `MAKVID_ROOT` so it also works inside the Next.js
  server bundle.
