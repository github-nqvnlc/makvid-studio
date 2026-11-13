// Next.js config: workspace packages export TypeScript source (transpiled here); native / heavy server
// libraries stay external (loaded by Node at runtime, not bundled).
import type { NextConfig } from "next";
import { resolve } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

// Monorepo root for packages that read their own files at runtime (style packs, vendored scripts).
process.env.MAKVID_ROOT ??= resolve(import.meta.dirname, "../..");

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Security headers on every response (T163). No CSP yet: Next's inline runtime would need nonces.
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  transpilePackages: [
    "@makvid/ai",
    "@makvid/billing",
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
    "@node-rs/argon2",
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
