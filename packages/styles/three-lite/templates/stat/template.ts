import { defineTemplate } from "@makvid/style-kit";
import { scene3d } from "../../lib/scene3d";

export default defineTemplate({
  id: "stat",
  build({ root, tl, enter, q, qa, rng, slots, formatNumber, duration, width, height }) {
    scene3d(root, tl, rng, duration, width, height, { count: 3 });
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    enter("zoomOut", ".stat-value", 0.1);
    if (num)
      tl.progress(
        0.15,
        { duration: 1.5, ease: "expo.out" },
        (p) => (num.textContent = formatNumber(value * p, decimals)),
      );
    enter("fadeUp", ".stat-label", 0.6);
    const bars = qa<HTMLElement>(".bar");
    const max = Math.max(...bars.map((b) => Number(b.dataset.v ?? 0)), 1);
    for (const b of bars) b.style.height = `${Math.round((Number(b.dataset.v ?? 0) / max) * 100)}%`;
    if (bars.length)
      tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1 }, { duration: 0.7, ease: "expo.out", stagger: 0.1 }, 0.5);
  },
});
