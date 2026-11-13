// M4 acceptance (T118): one real video per source kind (FPT voice + LLM, MFA, HyperFrames), each must pass QA.
//   script -> slides · article -> news · GitHub -> terminal · table -> infographic · media (own voice) -> flat
// Usage: pnpm --filter @makvid/cli exec node --env-file=../../.env --import tsx scripts/m4-acceptance.ts <outDir>
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { configFromEnv, createLlm } from "@makvid/ai";
import {
  ingestArticle,
  ingestGithub,
  ingestMedia,
  ingestScript,
  ingestTable,
  musicProviderFromEnv,
  type SourceMaterial,
} from "@makvid/media";
import { produceVideo, type ProduceInput } from "@makvid/pipeline";
import { createRenderer } from "@makvid/renderer";
import { FptTtsProvider, MfaAligner } from "@makvid/tts";
import { stylesRoot } from "../src/io";

const out = resolve(process.argv[2] ?? "m4");
const fixtures = resolve(import.meta.dirname, "../../../fixtures/sources");
const fx = (f: string) => readFileSync(join(fixtures, f), "utf8");
const key = process.env.FPT_AI_API_KEY;
if (!key) throw new Error("FPT_AI_API_KEY is not set");
const aligner = new MfaAligner();
const renderer = createRenderer("hyperframes", { workers: Number(process.env.RENDER_WORKERS ?? 4) });

const cases: Array<{
  kind: string;
  style: string;
  label: string;
  source: () => Promise<SourceMaterial>;
  own?: boolean;
}> = [
  {
    kind: "script",
    style: "slides",
    label: "Kịch bản có sẵn",
    source: async () => ingestScript(fx("script-vi.txt")),
  },
  {
    kind: "url",
    style: "news",
    label: "Bài báo",
    // The article fixture is served by an in-process fetcher (no third-party page is republished).
    source: () =>
      ingestArticle("https://bao.example/kinh-te/gia-vang", async (url) =>
        url.endsWith("/robots.txt")
          ? { url, status: 404, contentType: "text/plain", text: "" }
          : { url, status: 200, contentType: "text/html", text: fx("article-vi.html") },
      ),
  },
  {
    kind: "github",
    style: "terminal",
    label: "Kho GitHub",
    source: () => ingestGithub("https://github.com/ggml-org/whisper.cpp"),
  },
  {
    kind: "table",
    style: "infographic",
    label: "Dữ liệu",
    source: async () => ingestTable(fx("gia-vang.csv"), { title: "Giá vàng trong nước nửa đầu 2026" }),
  },
  {
    kind: "media",
    style: "flat-illustration",
    label: "Ghi âm",
    own: true,
    source: () =>
      ingestMedia(resolve(out, "../m4-media/talk.mp4"), {
        speech: aligner,
        workDir: join(out, "media", "source"),
      }),
  },
];

const only = process.env.ONLY?.split(",");
const results: Record<string, unknown>[] = [];
try {
  for (const c of cases) {
    if (only && !only.includes(c.kind)) continue;
    const workDir = join(out, c.kind);
    const t0 = performance.now();
    const source = await c.source();
    const input: ProduceInput = {
      prompt: source.title ?? c.label,
      aspects: ["9:16"],
      durationSec: 45,
      styleId: c.style,
      source,
      ...(c.own ? { useSourceAudio: true } : {}),
    };
    const r = await produceVideo(
      {
        llm: createLlm(configFromEnv()),
        tts: new FptTtsProvider(key),
        aligner,
        music: musicProviderFromEnv(),
        renderer,
        stylesRoot: stylesRoot(),
        workDir,
        voiceId: "vits:banmai",
        onUsage: () => undefined,
        onProgress: () => undefined,
      },
      input,
    );
    const stats = r.spec.scenes.filter((s) => s.templateId === "stat");
    const row = {
      kind: c.kind,
      style: c.style,
      status: r.status,
      title: r.title,
      qa: r.qa,
      durationSec: Math.round(r.spec.scenes.reduce((a, s) => a + (s.timing?.durationMs ?? 0), 0) / 100) / 10,
      costUsd: r.costUsd,
      seconds: Math.round((performance.now() - t0) / 100) / 10,
      video: r.outputs[0]?.video,
      ...(source.kind === "script" || c.own
        ? { verbatim: JSON.stringify(r.spec.script.map((x) => x.text)) === JSON.stringify(source.sentences) }
        : {}),
      ...(source.series
        ? {
            chartsMatchFile:
              stats.length > 0 &&
              stats.every(
                (s) => JSON.stringify(s.slots.series) === JSON.stringify({ series: source.series }),
              ),
          }
        : {}),
    };
    results.push(row);
    console.log(JSON.stringify(row));
  }
} finally {
  await renderer.close?.();
}
writeFileSync(join(out, "acceptance.json"), JSON.stringify(results, null, 2));
