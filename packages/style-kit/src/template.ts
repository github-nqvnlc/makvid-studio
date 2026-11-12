// Template authoring API. A style pack's template.ts default-exports defineTemplate({...}); the compiler
// bundles all templates of a pack with the browser shell (mount.ts) into one local script.
import type { Rng } from "./rng";
import type { Aspect } from "./safe-area";
import type { EaseName } from "./runtime/ease";
import type { Targets, Timeline } from "./runtime/types";

export type TemplateId = "hook" | "title" | "highlight" | "list" | "compare" | "stat" | "quote" | "cta";
export const TEMPLATE_IDS: readonly TemplateId[] = [
  "hook",
  "title",
  "highlight",
  "list",
  "compare",
  "stat",
  "quote",
  "cta",
];
export const ASPECTS: readonly Aspect[] = ["16:9", "9:16", "1:1", "4:5"];

export type SlotData =
  string | number | string[] | { series: Array<{ label: string; value: number }> } | undefined;

export interface Tokens {
  colors: Record<string, string>;
  fonts: Record<string, { family: string; weight: number }>;
  radius?: Record<string, number>;
  motion?: { ease?: EaseName; enter?: number; stagger?: number };
  [k: string]: unknown;
}

export type EnterPreset =
  "fadeUp" | "fadeIn" | "fadeDown" | "slideLeft" | "slideRight" | "pop" | "zoomOut" | "rise";

export interface TemplateContext {
  root: HTMLElement;
  tl: Timeline;
  slots: Record<string, SlotData>;
  aspect: Aspect;
  width: number;
  height: number;
  /** Scene length in seconds (timeline is extended to this). */
  duration: number;
  /** Speed multiplier from scene tuning (1 = normal); presets already apply it. */
  speed: number;
  rng: Rng;
  tokens: Tokens;
  accentColor?: string;
  emphasisWords: string[];
  q<T extends Element = HTMLElement>(selector: string): T | null;
  qa<T extends Element = HTMLElement>(selector: string): T[];
  /** Enter animation preset; durations are divided by `speed`. */
  enter(
    preset: EnterPreset,
    targets: Targets,
    at: number,
    opts?: { duration?: number; stagger?: number; ease?: EaseName; distance?: number },
  ): void;
  /** Format a number the Vietnamese way (decimal comma, dot thousands). */
  formatNumber(value: number, decimals?: number): string;
}

export interface Template {
  id: TemplateId;
  build(ctx: TemplateContext): void;
}

export function defineTemplate(t: Template): Template {
  return t;
}
