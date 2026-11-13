# Web app (Next.js) image. The whole workspace is installed because the server imports the pipeline
# packages (TypeScript source) and reads style packs / voice previews from the repo at runtime.
# Build: docker build -f docker/web.Dockerfile -t makvid-web .
FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
COPY fixtures ./fixtures
COPY scripts ./scripts
COPY tests ./tests
# Public API contract: served as /api/v1/openapi.yaml and rendered at /docs/api
COPY specs/001-ai-video-saas/contracts ./specs/001-ai-video-saas/contracts
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @makvid/web exec next build

ENV NODE_ENV=production \
    MAKVID_ROOT=/app \
    PORT=3000
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "--silent", "exec", "next", "start", "--port", "3000"]
