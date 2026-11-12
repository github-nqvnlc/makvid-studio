// CLI output + exit codes (contracts/cli.md): 0 ok, 1 input/validation, 2 QA fail, 3 render error.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate, normalizeDeep, parseVideoSpec, type VideoSpec } from "@makvid/spec";

export const EXIT = { ok: 0, input: 1, qa: 2, render: 3 } as const;

export class CliError extends Error {
  constructor(
    message: string,
    readonly code: (typeof EXIT)[keyof typeof EXIT],
  ) {
    super(message);
  }
}

let jsonMode = false;
export const setJson = (v: boolean) => (jsonMode = v);

/** Human progress line on stdout, or one NDJSON event with --json. */
export function emit(event: string, data: Record<string, unknown> = {}, human?: string): void {
  if (jsonMode) process.stdout.write(JSON.stringify({ event, ...data }) + "\n");
  else if (human !== undefined) process.stdout.write(human + "\n");
}

export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
export const stylesRoot = () => process.env.MAKVID_STYLES_ROOT ?? join(repoRoot, "packages", "styles");

/** Apply one style pack to every scene (style demos and goldens reuse the same script). */
export function restyle(spec: VideoSpec, styleId: string): VideoSpec {
  return {
    ...spec,
    meta: { ...spec.meta, primaryStyleId: styleId },
    scenes: spec.scenes.map((s) => ({ ...s, styleId })),
  };
}

export function loadSpec(path: string, styleId?: string): { spec: VideoSpec; migrated: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new CliError(`cannot read spec ${path}: ${(e as Error).message}`, EXIT.input);
  }
  let migrated: string[];
  try {
    const m = migrate(raw);
    raw = m.spec;
    migrated = m.applied;
  } catch (e) {
    throw new CliError(`migration failed: ${(e as Error).message}`, EXIT.input);
  }
  const r = parseVideoSpec(normalizeDeep(raw));
  if (!r.ok) throw new CliError(`invalid VideoSpec:\n  - ${r.issues.join("\n  - ")}`, EXIT.input);
  return { spec: styleId ? restyle(r.spec, styleId) : r.spec, migrated };
}
