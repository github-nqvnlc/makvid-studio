// VHS layer: grain that jumps every frame-step, a tracking band rolling down, an on-screen display with a
// running timecode, and occasional horizontal "tape wobble" on text lines. All driven by the scene timeline
// with seeded values (no Math.random / timers), so every render of a frame is identical.
import type { Rng, Timeline } from "@makvid/style-kit";
import { hash32 } from "@makvid/style-kit";

type Q = <T extends Element = HTMLElement>(selector: string) => T[];

const STEP_FPS = 24;

function el(root: HTMLElement, cls: string, text?: string): HTMLElement {
  const d = root.ownerDocument.createElement("div");
  d.className = cls;
  d.setAttribute("aria-hidden", "true");
  if (text !== undefined) d.textContent = text;
  root.appendChild(d);
  return d;
}

const tc = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `SP ${m}:${String(s).padStart(2, "0")}`;
};

export function vhs(root: HTMLElement, tl: Timeline, rng: Rng, duration: number, height: number): void {
  const noise = el(root, "vhs-noise");
  const band = el(root, "vhs-band");
  const osd = el(root, "vhs-osd");
  const play = osd.ownerDocument.createElement("span");
  play.className = "vhs-play";
  play.textContent = "PLAY";
  const clock = osd.ownerDocument.createElement("span");
  clock.className = "vhs-tc";
  clock.textContent = tc(0);
  osd.append(play, clock);

  const seed = rng.int(0, 1_000_000);
  tl.progress(0, { duration, ease: "none" }, (p) => {
    const t = p * duration;
    const k = Math.floor(t * STEP_FPS);
    const h = hash32(`${seed}:${k}`);
    // Grain jumps to a new offset every step (within the 64 px overscan).
    noise.style.transform = `translate(${(h % 128) - 64}px, ${((h >>> 8) % 128) - 64}px)`;
    // Tracking band rolls down once every ~4 s.
    band.style.transform = `translateY(${((t / 4) % 1) * height * 1.1 - height * 0.07}px)`;
    clock.textContent = tc(t);
    // The PLAY label blinks for the first second, like a deck that just started.
    play.style.opacity = t < 1 && Math.floor(t * 3) % 2 === 1 ? "0" : "1";
  });
}

/** Tape wobble: 1–2 moments where text lines slip sideways for a few frames. */
export function wobble(tl: Timeline, rng: Rng, qa: Q, selector: string, duration: number): void {
  const lines = qa(selector);
  if (!lines.length || duration < 2.4) return;
  const count = duration > 5 ? 2 : 1;
  for (let g = 0; g < count; g++) {
    const at = rng.range(1.5 + g * (duration / 2.5), Math.min(duration - 0.4, 2 + g * (duration / 2.5)));
    lines.forEach((l, i) => {
      tl.set(l, { x: rng.range(-12, 12) * (i % 2 ? 1 : -1) }, at);
      tl.set(l, { x: 0 }, at + 0.12);
    });
  }
}
