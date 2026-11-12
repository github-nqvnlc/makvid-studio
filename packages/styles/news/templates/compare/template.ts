import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "compare",
  build({ enter, q, tl, duration }) {
    // Ticker: scroll one copy of the line over the whole scene (linear, deterministic).
    const run = q<HTMLElement>(".tk-run");
    if (run) tl.fromTo(run, { x: 0 }, { x: -Math.round(run.scrollWidth / 3) }, { duration, ease: "none" }, 0);
    enter("slideRight", ".tk-label", 0, { duration: 0.35 });
    enter("slideRight", ".cmp-title", 0.05);
    enter("fadeUp", ".card.left", 0.35);
    enter("fadeUp", ".card.right", 0.85);
    enter("fadeIn", ".ci", 1.1, { stagger: 0.12 });
  },
});
