import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "stat",
  build({ tl, q, qa, rng, slots, formatNumber, duration }) {
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    const head = pieces(rng, qa(".stat-value"), 1.5);
    stepIn(tl, head, 0.1, 0);
    // The counter also moves in stop-motion steps.
    if (num)
      tl.progress(0.2, { duration: 1.5, ease: "power2.out" }, (p) => {
        const s = p >= 1 ? 1 : Math.floor(p * 12) / 12;
        num.textContent = formatNumber(value * s, decimals);
      });
    stepIn(tl, pieces(rng, qa(".stat-label"), 0, true), 0.6, 0, 30, 3);
    const bars = qa<HTMLElement>(".bar");
    const max = Math.max(...bars.map((b) => Number(b.dataset.v ?? 0)), 1);
    for (const b of bars) b.style.height = `${Math.round((Number(b.dataset.v ?? 0) / max) * 100)}%`;
    bars.forEach((b, i) => {
      for (let s = 0; s <= 4; s++) tl.set(b, { scaleY: s / 4 }, 0.5 + i * 0.15 + s / 8);
    });
    boil(tl, rng, head, 1.8, duration);
  },
});
