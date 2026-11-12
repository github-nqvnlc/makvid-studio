# M0 spike: Linux render environment for HyperFrames (BeginFrame capture path).
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates unzip \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    libx11-xcb1 libxshmfence1 fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /spike
COPY package.json package-lock.json ./
RUN npm ci
# Pinned chrome-headless-shell matching puppeteer's expected revision (BeginFrame path on Linux).
RUN rm -rf /root/.cache/puppeteer/chrome-headless-shell && npx @puppeteer/browsers install chrome-headless-shell@153.0.8010.36 --path /root/.cache/puppeteer
COPY *.ts ./
# Network is disabled at run time (--network none) to prove no CDN/font fetches are needed.
ENTRYPOINT ["npx", "tsx"]
