// MIT fallback animation runtime ("mkv", ADR 0001 exit path): a tiny seek-only tween engine.
// Every frame is computed from scratch from the timeline time, so rendering is order-independent
// (seek(5) then seek(1) gives the same frame as seek(1) directly). Same easing formulas as GSAP.
import { ease as easeFn, type EaseName } from "./ease";
import {
  PROP_KEYS,
  resolveTargets,
  type AnimationRuntime,
  type PropKey,
  type Props,
  type Timeline,
} from "./types";

interface Segment {
  at: number;
  dur: number;
  from: number | undefined; // undefined: continue from the previous value (or default)
  to: number;
  ease: (p: number) => number;
}

interface Track {
  el: HTMLElement | SVGElement;
  props: Map<PropKey, Segment[]>;
  baseOpacity: string;
  baseTransform: string;
}

interface Driver {
  at: number;
  dur: number;
  ease: (p: number) => number;
  fn: (p: number) => void;
}

const DEFAULTS: Record<PropKey, number> = {
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function valueAt(segs: Segment[], t: number): number | undefined {
  let current: Segment | undefined;
  let prevEnd: number | undefined;
  for (const s of segs) {
    if (s.at > t) break;
    if (current) prevEnd = current.to;
    current = s;
  }
  if (!current) {
    const first = segs[0];
    return first && first.from !== undefined ? first.from : undefined; // fromTo renders immediately
  }
  const from = current.from ?? prevEnd;
  const p = current.dur > 0 ? clamp01((t - current.at) / current.dur) : 1;
  if (from === undefined) return p >= 1 ? current.to : undefined;
  return from + (current.to - from) * current.ease(p);
}

const fmt = (n: number) => String(Math.round(n * 10000) / 10000);

export function fallbackRuntime(): AnimationRuntime {
  return {
    id: "mkv",
    timeline(root: ParentNode): Timeline {
      const tracks = new Map<Element, Track>();
      const drivers: Driver[] = [];
      let total = 0;
      let time = 0;
      let paused = true;

      const track = (el: Element): Track => {
        let tr = tracks.get(el);
        if (!tr) {
          const h = el as HTMLElement;
          tr = { el: h, props: new Map(), baseOpacity: h.style.opacity, baseTransform: h.style.transform };
          tracks.set(el, tr);
        }
        return tr;
      };
      const addSeg = (el: Element, key: PropKey, seg: Segment) => {
        const props = track(el).props;
        const list = props.get(key) ?? [];
        list.push(seg);
        list.sort((a, b) => a.at - b.at); // stable: equal starts keep insertion order
        props.set(key, list);
        total = Math.max(total, seg.at + seg.dur);
      };

      const render = (t: number) => {
        for (const tr of tracks.values()) {
          const v: Partial<Record<PropKey, number>> = {};
          for (const [k, segs] of tr.props) {
            const val = valueAt(segs, t);
            if (val !== undefined) v[k] = val;
          }
          tr.el.style.opacity = v.opacity !== undefined ? fmt(v.opacity) : tr.baseOpacity;
          const hasTransform = PROP_KEYS.some((k) => k !== "opacity" && v[k] !== undefined);
          if (hasTransform) {
            const x = v.x ?? 0;
            const y = v.y ?? 0;
            const r = v.rotation ?? 0;
            const sx = v.scaleX ?? v.scale ?? 1;
            const sy = v.scaleY ?? v.scale ?? 1;
            tr.el.style.transform = `translate(${fmt(x)}px, ${fmt(y)}px) rotate(${fmt(r)}deg) scale(${fmt(sx)}, ${fmt(sy)})`;
          } else tr.el.style.transform = tr.baseTransform;
        }
        for (const d of drivers) {
          const p = d.dur > 0 ? clamp01((t - d.at) / d.dur) : t >= d.at ? 1 : 0;
          d.fn(d.ease(p));
        }
      };

      const native = {
        seek(t: number) {
          time = Math.max(0, t);
          render(time);
          return native;
        },
        time(t?: number) {
          if (t === undefined) return time;
          return native.seek(t);
        },
        totalTime(t?: number) {
          return native.time(t);
        },
        progress(p?: number) {
          if (p === undefined) return total ? time / total : 0;
          return native.seek(p * total);
        },
        duration: () => total,
        totalDuration: () => total,
        play() {
          paused = false;
          return native;
        },
        pause() {
          paused = true;
          return native;
        },
        paused(v?: boolean) {
          if (v === undefined) return paused;
          paused = v;
          return native;
        },
        isActive: () => false,
        timeScale: () => 1,
        kill: () => undefined,
        eventCallback: () => native,
      };

      const self: Timeline = {
        native,
        fromTo(targets, from: Props, to: Props, opts, at) {
          const e = easeFn(opts.ease as EaseName | undefined);
          resolveTargets(root, targets).forEach((el, i) => {
            const start = at + i * (opts.stagger ?? 0);
            for (const k of PROP_KEYS) {
              if (to[k] === undefined && from[k] === undefined) continue;
              const toV = to[k] ?? DEFAULTS[k];
              addSeg(el, k, { at: start, dur: opts.duration, from: from[k], to: toV, ease: e });
            }
          });
          return self;
        },
        set(targets, props: Props, at) {
          for (const el of resolveTargets(root, targets))
            for (const k of PROP_KEYS) {
              const v = props[k];
              if (v !== undefined) addSeg(el, k, { at, dur: 0, from: undefined, to: v, ease: (p) => p });
            }
          return self;
        },
        progress(at, opts, onProgress) {
          drivers.push({
            at,
            dur: opts.duration,
            ease: easeFn(opts.ease as EaseName | undefined),
            fn: onProgress,
          });
          total = Math.max(total, at + opts.duration);
          return self;
        },
        extend(seconds) {
          total = Math.max(total, seconds);
          return self;
        },
        duration: () => total,
      };
      return self;
    },
  };
}
