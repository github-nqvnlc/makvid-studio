// Next.js config: workspace packages export TypeScript source (transpiled here); native / heavy server
// libraries stay external (loaded by Node at runtime, not bundled).
import type { NextConfig } from "next";
import { resolve } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

// Monorepo root for packages that read their own files at runtime (style packs, vendored scripts).
process.env.MAKVID_ROOT ??= resolve(import.meta.dirname, "../..");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  poweredByHeader: false,
  transpilePackages: [
    "@makvid/ai",
    "@makvid/compiler",
    "@makvid/db",
    "@makvid/media",
    "@makvid/pipeline",
    "@makvid/queue",
    "@makvid/renderer",
    "@makvid/spec",
    "@makvid/storage",
    "@makvid/style-kit",
    "@makvid/tts",
    "@makvid/ui",
  ],
  serverExternalPackages: [
    "esbuild",
    "linkedom",
    "@resvg/resvg-js",
    "sharp",
    "puppeteer-core",
    "puppeteer",
    "@hyperframes/producer",
    "@hyperframes/engine",
    "bullmq",
    "ioredis",
    "postgres",
    "fontkit",
    "pino",
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
  ],
};

export default withNextIntl(config);
