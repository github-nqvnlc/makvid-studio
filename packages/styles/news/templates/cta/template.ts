import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "cta",
  build({ enter, q, tl, duration }) {
    // Ticker: scroll one copy of the line over the whole scene (linear, deterministic).
    const run = q<HTMLElement>(".tk-run");
    if (run) tl.fromTo(run, { x: 0 }, { x: -Math.round(run.scrollWidth / 3) }, { duration, ease: "none" }, 0);
    enter("slideRight", ".tk-label", 0, { duration: 0.35 });
    enter("slideRight", ".cta-head", 0.1, { duration: 0.5 });
    enter("fadeUp", ".cta-btn", 0.6);
    enter("fadeIn", ".cta-handle", 0.9);
  },
});
