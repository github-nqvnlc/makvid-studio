# Render worker / reference render environment (ADR 0003: 8 vCPU, 16 GB, no GPU).
# Golden frames and reference renders are produced only in this image.
# Build: docker build -f docker/worker-render.Dockerfile -t makvid-render .
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates unzip \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libx11-xcb1 libxshmfence1 \
 && rm -rf /var/lib/apt/lists/*

# Pinned chrome-headless-shell (same build as M0 and the HyperFrames producer expects).
RUN npx --yes @puppeteer/browsers@3.2.2 install chrome-headless-shell@153.0.8010.36 --path /root/.cache/puppeteer

RUN corepack enable && corepack prepare pnpm@12.18.0 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
COPY fixtures ./fixtures
COPY scripts ./scripts
COPY tests ./tests
RUN pnpm install --frozen-lockfile

ENV MAKVID_RENDER_CONTAINER=1 \
    RENDER_WORKERS=4 \
    NODE_ENV=production
# Production renders run with --network none: compiled scenes never reference external URLs.
ENTRYPOINT ["pnpm", "--silent", "--filter", "@makvid/cli", "exec", "tsx", "src/main.ts"]
