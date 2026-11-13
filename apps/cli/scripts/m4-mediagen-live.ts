// One live Google image call (T124 check). Loads .env, never prints the key.
// Run: pnpm --filter @makvid/cli exec tsx scripts/m4-mediagen-live.ts <out-dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { GoogleImageProvider } from "@makvid/media";

process.loadEnvFile(resolve(import.meta.dirname, "../../../.env"));
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("GEMINI_API_KEY is empty");
const out = resolve(process.argv[2] ?? "mediagen-out");
mkdirSync(out, { recursive: true });

const p = new GoogleImageProvider({ apiKey: key, model: process.env.MAKVID_MEDIAGEN_MODEL || undefined });
const t0 = Date.now();
const img = await p.generateImage({
  prompt:
    "Flat illustration of a Vietnamese street coffee stall at sunrise, a glass of iced milk coffee on a small " +
    "wooden stool, warm colours, clean shapes, no text",
  width: 1024,
  height: 1024,
  seed: 42,
});
const ext = img.mime.split("/")[1] === "jpeg" ? "jpg" : (img.mime.split("/")[1] ?? "bin");
const file = join(out, `live.${ext}`);
writeFileSync(file, img.image);
console.warn(
  JSON.stringify({
    model: p.model,
    ms: Date.now() - t0,
    bytes: img.image.length,
    mime: img.mime,
    costUsd: img.costUsd,
    file,
  }),
);
