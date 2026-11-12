// Easing functions with the same formulas as GSAP's named eases, so the MIT fallback runtime
// renders the same curves as the GSAP adapter (ADR 0001 exit path).
export type EaseName =
  | "none"
  | "power1.in"
  | "power1.out"
  | "power1.inOut"
  | "power2.in"
  | "power2.out"
  | "power2.inOut"
  | "power3.in"
  | "power3.out"
  | "power3.inOut"
  | "power4.out"
  | "sine.in"
  | "sine.out"
  | "sine.inOut"
  | "expo.out"
  | "back.out"
  | "back.inOut";

export const EASE_NAMES: readonly EaseName[] = [
  "none",
  "power1.in",
  "power1.out",
  "power1.inOut",
  "power2.in",
  "power2.out",
  "power2.inOut",
  "power3.in",
  "power3.out",
  "power3.inOut",
  "power4.out",
  "sine.in",
  "sine.out",
  "sine.inOut",
  "expo.out",
  "back.out",
  "back.inOut",
];

type Fn = (p: number) => number;
const pow = (n: number): [Fn, Fn, Fn] => [
  (p) => p ** n,
  (p) => 1 - (1 - p) ** n,
  (p) => (p < 0.5 ? (2 * p) ** n / 2 : 1 - (2 * (1 - p)) ** n / 2),
];
const BACK = 1.70158;
const backIn: Fn = (p) => p * p * ((BACK + 1) * p - BACK);
const [p1i, p1o, p1io] = pow(2);
const [p2i, p2o, p2io] = pow(3);
const [p3i, p3o, p3io] = pow(4);
const [, p4o] = pow(5);

const EASES: Record<EaseName, Fn> = {
  none: (p) => p,
  "power1.in": p1i,
  "power1.out": p1o,
  "power1.inOut": p1io,
  "power2.in": p2i,
  "power2.out": p2o,
  "power2.inOut": p2io,
  "power3.in": p3i,
  "power3.out": p3o,
  "power3.inOut": p3io,
  "power4.out": p4o,
  "sine.in": (p) => -Math.cos(p * (Math.PI / 2)) + 1,
  "sine.out": (p) => Math.sin(p * (Math.PI / 2)),
  "sine.inOut": (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  "expo.out": (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  "back.out": (p) => 1 - backIn(1 - p),
  "back.inOut": (p) => (p < 0.5 ? backIn(p * 2) / 2 : 1 - backIn((1 - p) * 2) / 2),
};

export function ease(name: EaseName = "none"): Fn {
  const fn = EASES[name];
  if (!fn) throw new Error(`unknown ease "${name}"`);
  return fn;
}
