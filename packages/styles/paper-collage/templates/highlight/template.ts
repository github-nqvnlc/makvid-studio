import { defineTemplate } from "@makvid/style-kit";
import { boil, pieces, stepIn } from "../../lib/collage";

export default defineTemplate({
  id: "highlight",
  build({ tl, qa, rng, duration }) {
    const lines = pieces(rng, qa(".hl-text .ln"), 0, true);
    const end = stepIn(tl, lines, 0.1, 0.25, -30, 3);
    // Emphasised words are glued on afterwards: a quick stepped "press" (scale), then a gentle jiggle.
    const em = qa(".hl-text .w.em");
    em.forEach((e, i) => {
      tl.set(e, { scale: 1.12 }, end + i * 0.25);
      tl.set(e, { scale: 1 }, end + i * 0.25 + 0.125);
    });
    boil(tl, rng, pieces(rng, em, 0, true), end + em.length * 0.25 + 0.2, duration);
  },
});
