import { defineTemplate } from "@makvid/style-kit";
import { sketchBox, draw, stroke } from "../../lib/board";

export default defineTemplate({
  id: "compare",
  build({ tl, enter, qa, rng }) {
    enter("fadeIn", ".cmp-title", 0.05);
    qa(".card").forEach((c, i) => draw(tl, stroke(c, "wb-box", sketchBox(rng)), 0.3 + i * 0.5, 0.7));
    enter("fadeIn", ".card-label", 0.5, { stagger: 0.5 });
    enter("fadeIn", ".ci", 1.2, { stagger: 0.14 });
  },
});
