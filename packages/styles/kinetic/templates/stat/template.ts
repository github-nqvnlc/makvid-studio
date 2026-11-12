import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "stat",
  build({ tl, enter, q, qa, slots, formatNumber }) {
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    tl.fromTo(
      ".stat-value",
      { opacity: 0, scale: 0.4 },
      { opacity: 1, scale: 1 },
      { duration: 0.5, ease: "back.out" },
      0.05,
    );
    if (num)
      tl.progress(
        0.05,
        { duration: 1.3, ease: "expo.out" },
        (p) => (num.textContent = formatNumber(value * p, decimals)),
      );
    enter("fadeUp", ".stat-label", 0.7, { duration: 0.4 });
    const bars = qa<HTMLElement>(".bar");
    const max = Math.max(...bars.map((b) => Number(b.dataset.v ?? 0)), 1);
    for (const b of bars) b.style.height = `${Math.round((Number(b.dataset.v ?? 0) / max) * 100)}%`;
    if (bars.length)
      tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1 }, { duration: 0.35, ease: "back.out", stagger: 0.07 }, 0.6);
  },
});
