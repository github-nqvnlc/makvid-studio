import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "quote",
  build({ enter, q, tl, duration }) {
    // Ticker: scroll one copy of the line over the whole scene (linear, deterministic).
    const run = q<HTMLElement>(".tk-run");
    if (run) tl.fromTo(run, { x: 0 }, { x: -Math.round(run.scrollWidth / 3) }, { duration, ease: "none" }, 0);
    enter("slideRight", ".tk-label", 0, { duration: 0.35 });
    enter("fadeIn", ".qmark", 0, { duration: 0.5 });
    enter("fadeUp", ".q-text .ln", 0.2, { stagger: 0.12 });
    enter("slideRight", ".q-author", 1.0);
  },
});
