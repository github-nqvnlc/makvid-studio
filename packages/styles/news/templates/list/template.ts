import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "list",
  build({ enter, q, tl, duration }) {
    // Ticker: scroll one copy of the line over the whole scene (linear, deterministic).
    const run = q<HTMLElement>(".tk-run");
    if (run) tl.fromTo(run, { x: 0 }, { x: -Math.round(run.scrollWidth / 3) }, { duration, ease: "none" }, 0);
    enter("slideRight", ".tk-label", 0, { duration: 0.35 });
    enter("slideRight", ".list-title", 0.05);
    const step = Math.min(0.45, (duration - 1.6) / 5);
    enter("slideRight", ".item", 0.4, { stagger: step, duration: 0.4 });
  },
});
