import type { EaseName } from "./ease";

/** Animatable properties. Kept small on purpose so every runtime renders them identically. */
export interface Props {
  opacity?: number;
  x?: number; // px
  y?: number; // px
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number; // deg
}

export const PROP_KEYS = ["opacity", "x", "y", "scale", "scaleX", "scaleY", "rotation"] as const;
export type PropKey = (typeof PROP_KEYS)[number];

export type Targets = Element | readonly Element[] | string;

export interface TweenOptions {
  duration: number; // seconds
  ease?: EaseName;
  /** Seconds between consecutive targets. */
  stagger?: number;
}

/**
 * Runtime-agnostic timeline used by every template (ADR 0001). Times are seconds from scene start.
 * Implementations: GSAP adapter (primary) and the MIT fallback runtime.
 */
export interface Timeline {
  fromTo(targets: Targets, from: Props, to: Props, opts: TweenOptions, at: number): Timeline;
  set(targets: Targets, props: Props, at: number): Timeline;
  /** Drive arbitrary DOM updates (counters, class toggles) from eased progress 0..1. */
  progress(at: number, opts: Omit<TweenOptions, "stagger">, onProgress: (p: number) => void): Timeline;
  /** Make the timeline at least `seconds` long. */
  extend(seconds: number): Timeline;
  duration(): number;
  /** The object registered as window.__timelines[id] (must support seek/pause/duration). */
  readonly native: unknown;
}

export interface AnimationRuntime {
  readonly id: "gsap" | "mkv";
  timeline(root: ParentNode): Timeline;
}

export function resolveTargets(root: ParentNode, targets: Targets): Element[] {
  if (typeof targets === "string") return Array.from(root.querySelectorAll(targets));
  if (Array.isArray(targets)) return [...(targets as readonly Element[])];
  return [targets as Element];
}
