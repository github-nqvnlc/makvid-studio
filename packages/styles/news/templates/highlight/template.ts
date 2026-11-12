import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "highlight",
  build({ enter, qa, q, tl, duration }) {
    // Ticker: scroll one copy of the line over the whole scene (linear, deterministic).
    const run = q<HTMLElement>(".tk-run");
    if (run) tl.fromTo(run, { x: 0 }, { x: -Math.round(run.scrollWidth / 3) }, { duration, ease: "none" }, 0);
    enter("slideRight", ".tk-label", 0, { duration: 0.35 });
    enter("fadeIn", ".hl-text .w", 0.1, { stagger: 0.03, duration: 0.3 });
    const em = qa(".hl-text .w.em");
    if (em.length) enter("fadeIn", em, 0.8, { stagger: 0.06, duration: 0.3 });
  },
});
