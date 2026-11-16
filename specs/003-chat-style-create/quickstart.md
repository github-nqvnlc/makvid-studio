# Quickstart: validating Chat-style Create + Live Progress

## Prerequisites

```bash
pnpm install
docker compose -f docker/compose.dev.yml up -d
pnpm db:migrate        # applies 0008_project_events once implemented
```

## 1. Run the mock stack (no paid calls)

```bash
pnpm dev:mock          # web on http://localhost:3000 + workers with mock providers
```

## 2. Manual walkthrough

1. Sign in, open **Create video**. Expect one composer, no multi-card form.
2. Open the content-type popover: exactly 6 items. Switch to each type; the input becomes text / link / file chip. Switch back: earlier text is still there.
3. Open the aspect popover: 4 ratios, 9:16 preselected.
4. Length: type `29`, `181`, `abc` → inline range message and Start disabled; `30` and `180` accepted.
5. Voice button → dialog → play two voices (first stops) → pick one → button shows its name.
6. Toggle step-by-step; the summary shows the mode.
7. Press **Bắt đầu tạo video** (double-click it): one project is created, you land on the progress page.
8. Watch stages move and log lines stream within ~2 s. Scroll up: auto-follow pauses and "jump to latest" appears. Reload mid-run: earlier lines return and streaming continues.
9. In step-by-step mode, a stage shows "waiting for you"; approve and see the run continue.

## 3. Automated checks

```bash
pnpm typecheck && pnpm lint && pnpm test
MAKVID_INFRA_TESTS=1 pnpm --filter @makvid/pipeline test     # event idempotency, RLS, cursor
pnpm --filter @makvid/web test:e2e                           # composer, progress, no-tech-leak, a11y, 360 px
pnpm license:check
```

## Expected outcomes

- All of SC-001…SC-010 in [spec.md](spec.md) observable; no technical names in any log line (`no-tech-leak.spec.ts`); log persists across reload; e2e passes on desktop and 360 px viewports.
- Contracts: [project-events](contracts/project-events.md), [create-request](contracts/create-request.md). Data: [data-model](data-model.md).
