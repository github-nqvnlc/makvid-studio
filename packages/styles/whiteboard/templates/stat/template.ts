import { defineTemplate } from "@makvid/style-kit";
import { draw, stroke, underline } from "../../lib/board";

export default defineTemplate({
  id: "stat",
  build({ tl, enter, q, qa, rng, slots, formatNumber }) {
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    enter("fadeIn", ".stat-value", 0.1);
    if (num)
      tl.progress(
        0.15,
        { duration: 1.3, ease: "power2.out" },
        (p) => (num.textContent = formatNumber(value * p, decimals)),
      );
    const sv = q(".stat-value");
    if (sv) {
      const host = sv.ownerDocument.createElement("span");
      host.className = "wb-stat-ul";
      sv.appendChild(host);
      draw(tl, stroke(host, "wb-ul", underline(rng)), 1.5, 0.45);
    }
    enter("fadeIn", ".stat-label", 0.6);
    const bars = qa<HTMLElement>(".bar");
    const max = Math.max(...bars.map((b) => Number(b.dataset.v ?? 0)), 1);
    for (const b of bars) b.style.height = `${Math.round((Number(b.dataset.v ?? 0) / max) * 100)}%`;
    if (bars.length)
      tl.fromTo(
        bars,
        { scaleY: 0 },
        { scaleY: 1 },
        { duration: 0.5, ease: "power2.out", stagger: 0.15 },
        0.5,
      );
  },
});
