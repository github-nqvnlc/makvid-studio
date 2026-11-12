// GSAP adapter (ADR 0001). GSAP is loaded as a locally bundled, pinned script (gsap@3.15.1) and is
// reached only through this file, so it can be swapped for the MIT fallback runtime.
import type { EaseName } from "./ease";
import { resolveTargets, type AnimationRuntime, type Props, type Timeline } from "./types";

interface GsapTimeline {
  fromTo(t: object, from: object, to: object, at: number): GsapTimeline;
  set(t: object, vars: object, at: number): GsapTimeline;
  duration(): number;
}
interface GsapGlobal {
  timeline(vars: { paused: boolean }): GsapTimeline;
}

function gsapGlobal(): GsapGlobal {
  const g = (globalThis as { gsap?: GsapGlobal }).gsap;
  if (!g) throw new Error("GSAP is not loaded (expected the bundled vendor/gsap.min.js script)");
  return g;
}

export function gsapRuntime(): AnimationRuntime {
  return {
    id: "gsap",
    timeline(root: ParentNode): Timeline {
      const tl = gsapGlobal().timeline({ paused: true });
      let minDuration = 0;
      const self: Timeline = {
        native: tl,
        fromTo(targets, from: Props, to: Props, opts, at) {
          resolveTargets(root, targets).forEach((el, i) => {
            tl.fromTo(
              el,
              { ...from },
              {
                ...to,
                duration: opts.duration,
                ease: (opts.ease ?? "none") satisfies EaseName,
                force3D: false,
                immediateRender: true,
              },
              at + i * (opts.stagger ?? 0),
            );
          });
          return self;
        },
        set(targets, props: Props, at) {
          for (const el of resolveTargets(root, targets)) tl.set(el, { ...props, force3D: false }, at);
          return self;
        },
        progress(at, opts, onProgress) {
          const proxy = { p: 0 };
          onProgress(0);
          tl.fromTo(
            proxy,
            { p: 0 },
            {
              p: 1,
              duration: Math.max(opts.duration, 1e-4),
              ease: opts.ease ?? "none",
              immediateRender: true,
              onUpdate: () => onProgress(proxy.p),
            },
            at,
          );
          return self;
        },
        extend(seconds) {
          minDuration = Math.max(minDuration, seconds);
          if (tl.duration() < seconds) tl.set({}, {}, seconds);
          return self;
        },
        duration: () => Math.max(tl.duration(), minDuration),
      };
      return self;
    },
  };
}
