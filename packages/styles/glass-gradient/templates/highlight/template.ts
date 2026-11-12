import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "highlight",
  build({ tl, enter, qa, rng, width, height, duration }) {
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
    enter("fadeUp", ".hl-text .w", 0.2, { stagger: 0.04 });
    const em = qa(".hl-text .w.em");
    if (em.length) enter("pop", em, 1.0, { stagger: 0.08, ease: "back.out" });
  },
});
