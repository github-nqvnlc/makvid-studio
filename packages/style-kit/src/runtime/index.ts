import { fallbackRuntime } from "./fallback";
import { gsapRuntime } from "./gsap";
import type { AnimationRuntime } from "./types";

export * from "./types";
export * from "./ease";
export { gsapRuntime } from "./gsap";
export { fallbackRuntime } from "./fallback";

export type RuntimeId = AnimationRuntime["id"];

export function createRuntime(id: RuntimeId): AnimationRuntime {
  return id === "gsap" ? gsapRuntime() : fallbackRuntime();
}
