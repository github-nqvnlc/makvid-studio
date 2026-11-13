// Browser shell bundled into every compiled scene: builds the template timeline, the scene
// transition, the caption track, and registers window.__timelines["main"] for the renderer.
import { rng } from "./rng";
import { createRuntime, type RuntimeId } from "./runtime";
import type { EaseName } from "./runtime/ease";
import type { Targets } from "./runtime/types";
import type { Aspect } from "./safe-area";
import type { EnterPreset, SlotData, Template, TemplateContext, Tokens } from "./template";

export interface CaptionChunk {
  start: number; // seconds, scene-local
  end: number;
  words: Array<{ start: number }>;
}

export interface SceneData {
  sceneId: string;
  templateId: string;
  aspect: Aspect;
  width: number;
  height: number;
  duration: number;
  seed: number;
  runtime: RuntimeId;
  slots: Record<string, SlotData>;
  tokens: Tokens;
  speed: number;
  accentColor?: string;
  emphasisWords: string[];
  /** fromColor: background of the previous scene when the style changes (style bridge, ADR 0012). */
  transitionIn?: { presetId: string; duration: number; fromColor?: string };
  exit: number; // seconds of fade-out at the end (0 = none)
  captions: CaptionChunk[];
  /** Spoken words of this scene with scene-local start times (seconds); empty before narration exists. */
  narration?: Array<{ text: string; start: number }>;
}

export function formatNumberVi(value: number, decimals?: number): string {
  const d = decimals ?? (Number.isInteger(value) ? 0 : 1);
  const [int, frac] = Math.abs(value).toFixed(d).split(".");
  const grouped = (int ?? "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (value < 0 ? "-" : "") + grouped + (frac ? "," + frac : "");
}

export function mountScene(
  templates: Record<string, Template>,
  data: SceneData,
  doc: Document = document,
): void {
  const root = doc.getElementById("stage");
  if (!root) throw new Error("#stage missing");
  const tpl = templates[data.templateId];
  if (!tpl) throw new Error(`template "${data.templateId}" not in pack bundle`);
  const runtime = createRuntime(data.runtime);
  const tl = runtime.timeline(doc);
  const speed = data.speed > 0 ? data.speed : 1;
  const baseEase: EaseName = data.tokens.motion?.ease ?? "power3.out";
  const baseDur = data.tokens.motion?.enter ?? 0.6;

  const enter: TemplateContext["enter"] = (preset: EnterPreset, targets: Targets, at, opts = {}) => {
    const duration = (opts.duration ?? baseDur) / speed;
    const stagger = (opts.stagger ?? 0) / speed;
    const ease = opts.ease ?? baseEase;
    const d = opts.distance ?? Math.round(Math.min(data.width, data.height) * 0.05);
    const o = { duration, stagger, ease };
    const from: Record<EnterPreset, object> = {
      fadeUp: { opacity: 0, y: d },
      fadeDown: { opacity: 0, y: -d },
      fadeIn: { opacity: 0 },
      slideLeft: { opacity: 0, x: d * 1.5 },
      slideRight: { opacity: 0, x: -d * 1.5 },
      pop: { opacity: 0, scale: 0.6 },
      zoomOut: { opacity: 0, scale: 1.15 },
      rise: { opacity: 0, y: d * 2 },
    };
    const to: Record<EnterPreset, object> = {
      fadeUp: { opacity: 1, y: 0 },
      fadeDown: { opacity: 1, y: 0 },
      fadeIn: { opacity: 1 },
      slideLeft: { opacity: 1, x: 0 },
      slideRight: { opacity: 1, x: 0 },
      pop: { opacity: 1, scale: 1 },
      zoomOut: { opacity: 1, scale: 1 },
      rise: { opacity: 1, y: 0 },
    };
    tl.fromTo(targets, from[preset], to[preset], o, at / speed);
  };

  const ctx: TemplateContext = {
    root,
    tl,
    slots: data.slots,
    aspect: data.aspect,
    width: data.width,
    height: data.height,
    duration: data.duration,
    speed,
    rng: rng(data.seed).fork(data.sceneId),
    tokens: data.tokens,
    emphasisWords: data.emphasisWords,
    narration: data.narration ?? [],
    q: <T extends Element>(s: string) => root.querySelector<T>(s) as T | null,
    qa: <T extends Element>(s: string) => Array.from(root.querySelectorAll<T>(s)),
    enter,
    formatNumber: formatNumberVi,
  };
  if (data.accentColor) {
    ctx.accentColor = data.accentColor;
    root.style.setProperty("--accent", data.accentColor);
  }
  tpl.build(ctx);

  // Scene transition in (0.3–0.6 s, SC-013) and a short dip at the end so cuts between scenes are soft.
  const content = doc.getElementById("content") ?? root;
  if (data.transitionIn && data.transitionIn.duration > 0) {
    const t = data.transitionIn;
    const d = Math.round(data.width * 0.04);
    const from =
      t.presetId === "slide"
        ? { opacity: 0, x: d }
        : t.presetId === "zoom"
          ? { opacity: 0, scale: 1.04 }
          : { opacity: 0 };
    const to =
      t.presetId === "slide"
        ? { opacity: 1, x: 0 }
        : t.presetId === "zoom"
          ? { opacity: 1, scale: 1 }
          : { opacity: 1 };
    tl.fromTo(content, from, to, { duration: t.duration, ease: "power2.out" }, 0);
    if (t.fromColor) {
      // Style bridge: the previous style's background covers the stage and fades out, so two different
      // backgrounds never meet in a hard cut. Painted above the stage, below captions and logo.
      const bridge = doc.createElement("div");
      bridge.className = "mkv-bridge";
      bridge.setAttribute("aria-hidden", "true");
      bridge.style.cssText = `position:absolute;inset:0;pointer-events:none;background:${t.fromColor}`;
      root.after(bridge);
      tl.fromTo(bridge, { opacity: 1 }, { opacity: 0 }, { duration: t.duration * 1.2, ease: "power1.inOut" }, 0);
    }
  }
  if (data.exit > 0) {
    tl.fromTo(
      content,
      { opacity: 1 },
      { opacity: 0 },
      { ease: "power1.in", duration: data.exit },
      data.duration - data.exit,
    );
  }

  // Captions: one chunk visible at a time; the spoken word is highlighted.
  const chunks = Array.from(doc.querySelectorAll<HTMLElement>("#captions .cap-chunk"));
  data.captions.forEach((c, i) => {
    const el = chunks[i];
    if (!el) return;
    tl.set(el, { opacity: 0 }, 0);
    tl.set(el, { opacity: 1 }, c.start);
    if (c.end < data.duration) tl.set(el, { opacity: 0 }, c.end);
    const words = Array.from(el.querySelectorAll<HTMLElement>(".cap-w"));
    // The current word is highlighted from its onset until the next word (or the chunk end).
    c.words.forEach((w, j) => {
      const wEl = words[j];
      if (!wEl) return;
      const until = c.words[j + 1]?.start ?? c.end;
      const at = w.start - 1e-4;
      tl.progress(at, { duration: Math.max(until - at, 1e-3) }, (p) =>
        wEl.classList.toggle("on", p > 0 && p < 1),
      );
    });
  });

  tl.extend(data.duration);
  const native = tl.native as { seek?: (t: number) => unknown };
  if (runtime.id === "mkv") native.seek?.(0);
  const w = window as unknown as { __timelines?: Record<string, unknown> };
  w.__timelines = w.__timelines ?? {};
  w.__timelines["main"] = tl.native;
}
