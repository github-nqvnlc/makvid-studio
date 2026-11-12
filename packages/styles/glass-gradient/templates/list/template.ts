import { defineTemplate } from "@makvid/style-kit";

export default defineTemplate({
  id: "list",
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
    enter("fadeUp", ".list-title", 0.15);
    const step = Math.min(0.45, (duration - 1.8) / 5);
    enter("pop", ".bullet", 0.5, { stagger: step, ease: "back.out", duration: 0.5 });
    enter("fadeUp", ".item-text", 0.55, { stagger: step });
  },
});
