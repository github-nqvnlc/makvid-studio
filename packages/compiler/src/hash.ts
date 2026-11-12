// Deterministic scene hashing: cacheKey = sha256(sceneHTML + assetHashes + exportConfig + engineVersion).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");

/** Hash of every file under `dir` (sorted relative paths + content hashes). */
export function hashDir(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out[relative(dir, p).replace(/\\/g, "/")] = sha256(readFileSync(p));
    }
  };
  walk(dir);
  return out;
}

export interface ExportConfig {
  width: number;
  height: number;
  fps: number;
  renderer: string;
}

export function sceneCacheKey(
  sceneHtml: string,
  assetHashes: Record<string, string>,
  exportConfig: ExportConfig,
  engineVersion: string,
): string {
  const assets = Object.keys(assetHashes)
    .sort()
    .map((k) => `${k}:${assetHashes[k]}`)
    .join("\n");
  const cfg = JSON.stringify(exportConfig, Object.keys(exportConfig).sort());
  return sha256([sceneHtml, assets, cfg, engineVersion].join("\n--\n"));
}
