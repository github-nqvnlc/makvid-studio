import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "stat",
  build({ tl, enter, q, qa, slots, formatNumber, rng, width, height, duration }) {
    // The pre-rendered background drifts slowly for the whole scene (seeded: repeatable per scene).
    const d = Math.round(Math.min(width, height) * 0.035);
    const dx = Math.round((rng.next() - 0.5) * 2 * d);
    const dy = Math.round((rng.next() - 0.5) * 2 * d);
    tl.fromTo(
      ".blobs",
      { x: 0, y: 0, scale: 1 },
      { x: dx, y: dy, scale: 1.04 },
      { duration, ease: "sine.inOut" },
      0,
    );
    enter("fadeIn", ".pane", 0, { duration: 0.8 });
    tl.fromTo(".pane", { scale: 0.97 }, { scale: 1 }, { duration: 0.9, ease: "power3.out" }, 0);
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    enter("fadeUp", ".stat-value", 0.1);
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
      tl.fromTo(bars, { scaleY: 0 }, { scaleY: 1 }, { duration: 0.6, ease: "power3.out", stagger: 0.1 }, 0.5);
  },
});
