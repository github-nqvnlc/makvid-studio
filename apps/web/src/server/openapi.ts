// The public API contract (specs/.../contracts/public-api.openapi.yaml) is the single source for the docs page,
// the served /api/v1/openapi.yaml and the contract tests.
import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { REPO_ROOT } from "./deps";

export const OPENAPI_FILE = join(
  REPO_ROOT,
  "specs",
  "001-ai-video-saas",
  "contracts",
  "public-api.openapi.yaml",
);

export function openApiText(): string {
  return readFileSync(OPENAPI_FILE, "utf8");
}

export interface OpenApiDoc {
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, Operation>>;
  webhooks?: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown> };
}
export interface Operation {
  summary?: string;
  description?: string;
  parameters?: Array<{ name?: string; in?: string; required?: boolean; $ref?: string; description?: string }>;
  requestBody?: { content?: Record<string, { schema?: unknown }> };
  responses?: Record<string, { description?: string; $ref?: string }>;
}

export function openApiDoc(): OpenApiDoc {
  return parse(openApiText()) as OpenApiDoc;
}
