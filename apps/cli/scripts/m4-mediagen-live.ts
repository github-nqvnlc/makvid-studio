// One live image call (T124 check). Loads .env, never prints keys.
// Run: pnpm --filter @makvid/cli exec tsx scripts/m4-mediagen-live.ts <shopaikey|google> <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createMediaGen } from "@makvid/media";

process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
const which = process.argv[2] ?? "shopaikey";
const out = resolve(process.argv[3] ?? "mediagen-out");
const cost = Number(process.env.SHOPAIKEY_IMAGE_COST_USD);
const p = createMediaGen({
  mode: which,
  geminiApiKey: process.env.GEMINI_API_KEY,
  googleModel: process.env.MAKVID_MEDIAGEN_MODEL || undefined,
  shopAiKey: process.env.SHOPAIKEY_API_KEY,
  shopAiKeyModel: process.env.SHOPAIKEY_IMAGE_MODEL || undefined,
  ...(Number.isFinite(cost) && process.env.SHOPAIKEY_IMAGE_COST_USD ? { shopAiKeyCostUsd: cost } : {}),
});
if (!p) throw new Error(`no key configured for "${which}"`);
mkdirSync(out, { recursive: true });

const t0 = Date.now();
const img = await p.generateImage({
  prompt:
    "Flat illustration of a Vietnamese street coffee stall at sunrise, a glass of iced milk coffee on a small " +
    "wooden stool, warm colours, clean shapes, no text",
  width: 1024,
  height: 1024,
  seed: 42,
});
const ext = img.mime === "image/jpeg" ? "jpg" : (img.mime.split("/")[1] ?? "bin");
const file = join(out, `live-${p.id}.${ext}`);
writeFileSync(file, img.image);
console.warn(
  JSON.stringify({
    provider: p.id,
    model: p.model,
    ms: Date.now() - t0,
    bytes: img.image.length,
    mime: img.mime,
    costUsd: img.costUsd,
    file,
  }),
);
