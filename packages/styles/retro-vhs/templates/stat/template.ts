import { defineTemplate } from "@makvid/style-kit";
import { vhs, wobble } from "../../lib/vhs";

export default defineTemplate({
  id: "stat",
  build({ root, tl, enter, q, qa, rng, slots, formatNumber, duration, height }) {
    vhs(root, tl, rng, duration, height);
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    enter("fadeIn", ".stat-value", 0.1, { duration: 0.1 });
    // Counter steps in coarse jumps, like a tape counter.
    if (num)
      tl.progress(0.2, { duration: 1.4, ease: "power2.out" }, (p) => {
        const stepped = p >= 1 ? 1 : Math.floor(p * 12) / 12;
        num.textContent = formatNumber(value * stepped, decimals);
      });
    enter("fadeIn", ".stat-label", 0.7, { duration: 0.2 });
    const bars = qa<HTMLElement>(".bar");
    const max = Math.max(...bars.map((b) => Number(b.dataset.v ?? 0)), 1);
    for (const b of bars) b.style.height = `${Math.round((Number(b.dataset.v ?? 0) / max) * 100)}%`;
    if (bars.length)
      tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1 }, { duration: 0.5, ease: "power2.out", stagger: 0.1 }, 0.5);
    wobble(tl, rng, qa, ".stat-value", duration);
  },
});
