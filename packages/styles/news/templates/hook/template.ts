import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "hook",
  build({ tl, enter, q, duration }) {
    // Ticker: scroll one copy of the line over the whole scene (linear, deterministic).
    const run = q<HTMLElement>(".tk-run");
    if (run) tl.fromTo(run, { x: 0 }, { x: -Math.round(run.scrollWidth / 3) }, { duration, ease: "none" }, 0);
    enter("slideRight", ".tk-label", 0, { duration: 0.35 });
    enter("pop", ".hot", 0.05, { duration: 0.3, ease: "back.out" });
    tl.fromTo(".hot", { opacity: 1 }, { opacity: 0.55 }, { duration: 0.35, ease: "sine.inOut" }, 1.2);
    tl.fromTo(".hot", { opacity: 0.55 }, { opacity: 1 }, { duration: 0.35, ease: "sine.inOut" }, 1.55);
    enter("fadeIn", ".kicker", 0.15);
    enter("slideRight", ".headline", 0.25, { duration: 0.5 });
    tl.fromTo(".rule", { scaleX: 0 }, { scaleX: 1 }, { duration: 0.8, ease: "power2.out" }, 0.5);
  },
});
