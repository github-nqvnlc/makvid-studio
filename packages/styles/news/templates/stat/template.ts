import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "stat",
  build({ tl, enter, q, qa, slots, formatNumber, duration }) {
    // Ticker: scroll one copy of the line over the whole scene (linear, deterministic).
    const run = q<HTMLElement>(".tk-run");
    if (run) tl.fromTo(run, { x: 0 }, { x: -Math.round(run.scrollWidth / 3) }, { duration, ease: "none" }, 0);
    enter("slideRight", ".tk-label", 0, { duration: 0.35 });
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    enter("fadeUp", ".stat-value", 0.1);
    if (num)
      tl.progress(
        0.15,
        { duration: 1.5, ease: "power2.out" },
        (p) => (num.textContent = formatNumber(value * p, decimals)),
      );
    enter("fadeUp", ".stat-label", 0.6);
    const bars = qa<HTMLElement>(".bar");
    const max = Math.max(...bars.map((b) => Number(b.dataset.v ?? 0)), 1);
    for (const b of bars) b.style.height = `${Math.round((Number(b.dataset.v ?? 0) / max) * 100)}%`;
    if (bars.length)
      tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1 }, { duration: 0.6, ease: "power3.out", stagger: 0.1 }, 0.5);
  },
});
