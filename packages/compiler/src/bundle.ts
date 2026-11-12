// Bundle a style pack's templates + the style-kit browser shell into one local IIFE (esbuild).
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import type { LoadedPack } from "@makvid/style-kit/node";
import { sha256 } from "./hash";

const here = dirname(fileURLToPath(import.meta.url));
const cache = new Map<string, string>();

/** Returns the pack bundle source. Global `MakvidPack.mount(data)` mounts one scene. */
export async function bundlePack(pack: LoadedPack): Promise<string> {
  const entries = Object.values(pack.templates);
  const key = sha256(entries.map((t) => t.entry).join("|") + pack.manifest.version);
  const hit = cache.get(key);
  if (hit) return hit;
  const imports = entries
    .map((t, i) => `import t${i} from ${JSON.stringify(resolve(t.entry).replace(/\\/g, "/"))};`)
    .join("\n");
  const contents = `${imports}
import { mountScene } from "@makvid/style-kit/mount";
const templates = {};
for (const t of [${entries.map((_, i) => `t${i}`).join(", ")}]) templates[t.id] = t;
globalThis.MakvidPack = { id: ${JSON.stringify(pack.id)}, version: ${JSON.stringify(pack.manifest.version)}, mount: (data) => mountScene(templates, data) };
`;
  const result = await build({
    stdin: { contents, resolveDir: here, loader: "ts", sourcefile: `${pack.id}-entry.ts` },
    bundle: true,
    format: "iife",
    platform: "browser",
    target: "chrome120",
    write: false,
    minify: false,
    legalComments: "none",
    charset: "utf8",
    logLevel: "silent",
  });
  const code = result.outputFiles[0]!.text;
  cache.set(key, code);
  return code;
}

const require = createRequire(import.meta.url);

/** Absolute paths of vendored browser files (pinned versions from package.json). */
export function vendorFiles(): { gsap: string; hyperframesRuntime: string } {
  return {
    gsap: join(dirname(require.resolve("gsap/package.json")), "dist", "gsap.min.js"),
    hyperframesRuntime: join(
      dirname(require.resolve("@hyperframes/core/package.json")),
      "dist",
      "hyperframe.runtime.iife.js",
    ),
  };
}
