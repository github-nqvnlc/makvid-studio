import { defineTemplate } from "@makvid/style-kit";
import { flickerOn, glitch } from "../../lib/neon";

export default defineTemplate({
  id: "stat",
  build({ tl, enter, q, qa, rng, slots, formatNumber, duration }) {
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    flickerOn(tl, rng, qa(".stat-value"), 0.05);
    if (num)
      tl.progress(
        0.3,
        { duration: 1.4, ease: "power3.out" },
        (p) => (num.textContent = formatNumber(value * p, decimals)),
      );
    enter("fadeUp", ".stat-label", 0.7);
    const bars = qa<HTMLElement>(".bar");
    const max = Math.max(...bars.map((b) => Number(b.dataset.v ?? 0)), 1);
    for (const b of bars) b.style.height = `${Math.round((Number(b.dataset.v ?? 0) / max) * 100)}%`;
    if (bars.length)
      tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1 }, { duration: 0.6, ease: "power3.out", stagger: 0.1 }, 0.6);
    glitch(tl, rng, qa, ".stat-value", duration);
  },
});
