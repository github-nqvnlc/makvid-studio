// Shared context for pipeline steps: providers, step cache (idempotency), usage + progress sinks.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { LlmProvider } from "@makvid/ai";
import type { Renderer } from "@makvid/renderer";
import type { BrandKit } from "@makvid/compiler";
import type { MusicProvider } from "@makvid/media";
import type { MfaAligner, TtsProvider } from "@makvid/tts";
import type { ScenePool } from "./distributed";
import type { TextFixer } from "./qa-fix";

export type Step =
  | "ingest"
  | "script"
  | "style_suggest"
  | "chat_edit"
  | "storyboard"
  | "tts"
  | "align"
  | "compile"
  | "qa"
  | "render_scene"
  | "mux"
  | "media_gen";

export interface UsageEntry {
  step: Step;
  provider: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  ttsChars?: number;
  renderSeconds?: number;
  images?: number;
  costUsd: number | null;
}

export interface Progress {
  step: Step;
  /** i18n key + params; user-facing text comes from messages (no tech names). */
  key: string;
  params?: Record<string, string | number>;
  /** 0..1 overall progress. */
  fraction: number;
}

export interface PipelineContext {
  llm: LlmProvider;
  tts: TtsProvider;
  aligner: MfaAligner;
  renderer: Renderer;
  stylesRoot: string;
  workDir: string;
  voiceId: string;
  /** Licensed music catalog (ADR 0007); procedural beds when absent. */
  music?: MusicProvider;
  /** Workspace brand kit with local file paths (US8); applied to every compile. */
  brand?: BrandKit;
  /** Where uncached scenes render (T132): this process by default, or every render worker (distributed). */
  scenePool?: ScenePool;
  /** Shortens overflowing text during QA; defaults to the context LLM in-process (qa-fix.ts). */
  textFixer?: TextFixer;
  onUsage(u: UsageEntry): void;
  onProgress(p: Progress): void;
}

export const hashOf = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);

/** Disk cache keyed by (step, inputHash): re-running with the same inputs skips the step (idempotent). */
export class StepCache {
  constructor(private readonly dir: string) {
    mkdirSync(dir, { recursive: true });
  }
  private file(step: Step, hash: string) {
    return join(this.dir, `${step}-${hash}.json`);
  }
  get<T>(step: Step, hash: string): T | undefined {
    const f = this.file(step, hash);
    return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as T) : undefined;
  }
  set<T>(step: Step, hash: string, value: T): T {
    writeFileSync(this.file(step, hash), JSON.stringify(value, null, 2));
    return value;
  }
  async run<T>(step: Step, input: unknown, fn: () => Promise<T>, onHit?: () => void): Promise<T> {
    const h = hashOf({ step, input });
    const hit = this.get<T>(step, h);
    if (hit !== undefined) {
      onHit?.();
      return hit;
    }
    return this.set(step, h, await fn());
  }
}
