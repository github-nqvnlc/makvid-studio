import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "quote",
  build({ tl, enter, rng, width, height, duration }) {
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
    enter("fadeIn", ".qmark", 0.1, { duration: 0.8 });
    enter("fadeUp", ".q-text .ln", 0.3, { stagger: 0.15 });
    enter("fadeIn", ".q-author", 1.2);
  },
});
