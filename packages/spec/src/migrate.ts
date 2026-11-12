// Sequential VideoSpec migrations: each step upgrades exactly one version.
import { SPEC_VERSION } from "./schema";

export interface Migration {
  from: string;
  to: string;
  up: (spec: Record<string, unknown>) => Record<string, unknown>;
}

/** Registered migrations, oldest first. 0.1.0 is the first version, so the list starts empty. */
export const MIGRATIONS: Migration[] = [];

export class MigrationError extends Error {
  override name = "MigrationError";
}

/**
 * Upgrade a raw spec object to `target` (default: current SPEC_VERSION) by chaining migrations.
 * Returns the upgraded copy and the steps applied (empty when already current). Input is not mutated.
 */
export function migrate(
  raw: unknown,
  target: string = SPEC_VERSION,
  migrations: Migration[] = MIGRATIONS,
): { spec: Record<string, unknown>; applied: string[] } {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw))
    throw new MigrationError("spec must be an object");
  let spec = structuredClone(raw) as Record<string, unknown>;
  const applied: string[] = [];
  let version = spec.specVersion;
  if (typeof version !== "string") throw new MigrationError("specVersion missing");
  for (let i = 0; version !== target; i++) {
    if (i > migrations.length) throw new MigrationError(`migration loop at ${version}`);
    const step = migrations.find((m) => m.from === version);
    if (!step) throw new MigrationError(`no migration from ${version} to ${target}`);
    spec = step.up(structuredClone(spec));
    spec.specVersion = step.to;
    applied.push(`${step.from}->${step.to}`);
    version = step.to;
  }
  return { spec, applied };
}
