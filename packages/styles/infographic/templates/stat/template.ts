import { defineTemplate, svg } from "@makvid/style-kit";

// Bar + line chart from the series (SVG line drawn with stroke-dashoffset), or a donut for percentages.
export default defineTemplate({
  id: "stat",
  build({ tl, enter, q, qa, slots, formatNumber, root }) {
    const value = typeof slots.value === "number" ? slots.value : 0;
    const decimals = Number.isInteger(value) ? 0 : 1;
    const num = q(".stat-value .num .w");
    enter("fadeUp", ".stat-value", 0.05);
    if (num)
      tl.progress(
        0.1,
        { duration: 1.8, ease: "power2.out" },
        (p) => (num.textContent = formatNumber(value * p, decimals)),
      );
    enter("fadeUp", ".stat-label", 0.6);
    const doc = root.ownerDocument;
    const chart = q(".chart");
    const bars = qa<HTMLElement>(".chart .bar");
    if (chart && bars.length) {
      const vals = bars.map((b) => Number(b.dataset.v ?? 0));
      const max = Math.max(...vals, 1);
      bars.forEach((b, i) => (b.style.height = `${Math.round((vals[i]! / max) * 100)}%`));
      tl.fromTo(
        bars,
        { scaleY: 0 },
        { scaleY: 1 },
        { duration: 0.6, ease: "power3.out", stagger: 0.08 },
        0.5,
      );
      // Pixel coordinates from the laid-out bars (CSS sizes only, no font dependency -> deterministic).
      const box = chart.getBoundingClientRect();
      const s = svg(doc, "svg", {
        class: "line",
        viewBox: `0 0 ${Math.round(box.width)} ${Math.round(box.height)}`,
        width: Math.round(box.width),
        height: Math.round(box.height),
      });
      const pts = bars.map((b, i) => {
        const col = b.parentElement!.getBoundingClientRect();
        return [col.left - box.left + col.width / 2, box.height - (vals[i]! / max) * box.height];
      });
      const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x!.toFixed(1)},${y!.toFixed(1)}`).join(" ");
      const path = svg(doc, "path", { d, pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
      for (const [x, y] of pts)
        s.appendChild(svg(doc, "circle", { cx: x!.toFixed(1), cy: y!.toFixed(1), r: 7, class: "dot" }));
      s.insertBefore(path, s.firstChild);
      chart.appendChild(s);
      tl.progress(1.0, { duration: 1.2, ease: "power2.inOut" }, (p) =>
        path.setAttribute("stroke-dashoffset", (1 - p).toFixed(4)),
      );
      enter("fadeIn", ".chart .bar-label", 0.7, { stagger: 0.08 });
    } else if (typeof slots.suffix === "string" && slots.suffix.includes("%")) {
      const host = q(".stat")!;
      const ring = svg(doc, "svg", { class: "donut", viewBox: "0 0 100 100" });
      ring.appendChild(svg(doc, "circle", { cx: 50, cy: 50, r: 38, stroke: "var(--c-line)" }));
      const arc = svg(doc, "circle", {
        cx: 50,
        cy: 50,
        r: 38,
        stroke: "var(--accent)",
        pathLength: 1,
        "stroke-dasharray": 1,
        "stroke-dashoffset": 1,
        transform: "rotate(-90 50 50)",
      });
      ring.appendChild(arc);
      host.appendChild(ring);
      const frac = Math.max(0, Math.min(1, value / 100));
      tl.progress(0.2, { duration: 1.6, ease: "power2.out" }, (p) =>
        arc.setAttribute("stroke-dashoffset", (1 - frac * p).toFixed(4)),
      );
    }
  },
});
