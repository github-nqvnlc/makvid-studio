// makvid produce --prompt "<text>" [--aspect 9:16] [--duration 45] [--style id] [--mix-styles a,b] [--out dir] [--renderer ...] [--voice id]
// Headless US1 run (T085): prompt -> MP4 with voice, captions, music, QA, cost report.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configFromEnv, createLlm } from "@makvid/ai";
import { produceVideo, progressText, type ProduceResult } from "@makvid/pipeline";
import { createRenderer } from "@makvid/renderer";
import type { AspectRatio } from "@makvid/spec";
import { FptTtsProvider, MfaAligner } from "@makvid/tts";
import { musicProviderFromEnv } from "@makvid/media";
import { CliError, EXIT, emit, stylesRoot } from "../io";

export interface ProduceOptions {
  prompt: string;
  aspects: AspectRatio[];
  durationSec?: number;
  styleId?: string;
  /** Other styles scenes may use (style mixing). */
  mixStyles?: string[];
  out: string;
  renderer: "hyperframes" | "fallback";
  voiceId?: string;
  cacheDir?: string;
}

export async function produce(o: ProduceOptions): Promise<ProduceResult> {
  const key = process.env.FPT_AI_API_KEY;
  if (!key) throw new CliError("FPT_AI_API_KEY is not set (voice + default LLM)", EXIT.input);
  const workDir = resolve(o.out);
  mkdirSync(workDir, { recursive: true });
  const renderer = createRenderer(o.renderer, { workers: Number(process.env.RENDER_WORKERS ?? 4) });
  try {
    const result = await produceVideo(
      {
        llm: createLlm(configFromEnv()),
        tts: new FptTtsProvider(key),
        aligner: new MfaAligner(),
        music: musicProviderFromEnv(),
        renderer,
        stylesRoot: stylesRoot(),
        workDir,
        voiceId: o.voiceId ?? process.env.FPT_TTS_VOICE_ID ?? "vits:banmai",
        onUsage: (u) => emit("usage", { ...u }),
        onProgress: (p) =>
          emit("progress", { ...p }, `[${Math.round(p.fraction * 100)}%] ${progressText(p.key, p.params)}`),
      },
      {
        prompt: o.prompt,
        aspects: o.aspects,
        ...(o.durationSec ? { durationSec: o.durationSec } : {}),
        ...(o.styleId ? { styleId: o.styleId } : {}),
        ...(o.mixStyles?.length ? { mixStyles: o.mixStyles } : {}),
      },
      o.cacheDir ? { cacheDir: o.cacheDir } : {},
    );
    const { spec: _spec, ...report } = result;
    writeFileSync(join(workDir, "report.json"), JSON.stringify(report, null, 2));
    emit(
      "produced",
      {
        status: result.status,
        outputs: result.outputs.map((x) => x.video),
        costUsd: result.costUsd,
        seconds: result.seconds,
      },
      `${result.status === "ready" ? "✓" : "⚠"} ${result.title} — ${result.outputs.map((x) => x.video).join(", ")} · $${result.costUsd.toFixed(4)} · ${result.seconds}s`,
    );
    return result;
  } finally {
    await renderer.close?.();
  }
}
